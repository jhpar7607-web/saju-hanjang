// AI 풀이
// Claude 에는 계산된 사주만 넘기고, 정해진 JSON 형식으로만 답하게 한다.
// 이름, 연락처, 정확한 생년월일시는 보내지 않는다.
// 형식이 틀리거나 금지 표현이 나오면 null 을 돌려주고, 부르는 쪽이 규칙 기반 풀이로 대신한다.

import { config, kstDate } from '../config';
import type { Chart, FreeReading, PaidReport } from './types';
import { GOD_EASY, MONTHS_2027 } from './texts';
import { yearGods } from './reading';
import { isSafe } from './safety';

/** 하루 AI 호출 수 (서버가 다시 켜지면 0부터 센다) */
const usage = { day: '', count: 0 };

function underDailyLimit(): boolean {
  const today = kstDate();
  if (usage.day !== today) {
    usage.day = today;
    usage.count = 0;
  }
  return usage.count < config.ai.dailyLimit;
}

export function aiAvailable(): boolean {
  return Boolean(config.ai.key) && underDailyLimit();
}

/** AI 에 넘기는 값. 개인을 알아볼 수 있는 정보는 넣지 않는다. */
export function chartForAi(chart: Chart): Record<string, unknown> {
  const p = chart.pillars;
  const g = yearGods(chart);
  return {
    사주: {
      연주: p.year.stem + p.year.branch,
      월주: p.month.stem + p.month.branch,
      일주: p.day.stem + p.day.branch,
      시주: p.hour ? p.hour.stem + p.hour.branch : null,
    },
    일간: chart.dayMaster,
    일간오행: chart.dayMasterElement,
    오행개수: chart.elements,
    십신: {
      연간: p.year.stemGod, 연지: p.year.branchGod,
      월간: p.month.stemGod, 월지: p.month.branchGod,
      일지: p.day.branchGod,
      시간: p.hour?.stemGod ?? null, 시지: p.hour?.branchGod ?? null,
    },
    대운: chart.luck.current
      ? { 현재: chart.luck.current.korean, 시작나이: chart.luck.current.age }
      : null,
    올해: { 간지: '정미', 천간십신: g.stem, 지지십신: g.branch },
    성별: chart.gender === 'male' ? '남' : '여',
    나이대: chart.ageBand,
    시간모름: chart.timeUnknown,
  };
}

const RULES = `너는 한국 명리학 풀이를 쉬운 말로 써 주는 작가다. 아래 규칙을 지킨다.
- 넘겨받은 값에 없는 글자나 기둥, 신살을 지어내지 않는다. 사주 계산을 다시 하지 않는다.
- 중학생이 읽을 수 있는 문장으로 쓴다. 한자 용어는 처음 나올 때 괄호로 쉽게 푼다.
- 단정하지 않는다. "~하기 쉬운 때입니다", "~하면 좋습니다"처럼 쓴다.
- 나쁜 내용은 조심할 점과 대처 방법을 함께 적는다.
- 죽음, 큰 사고, 이혼이나 파산, 질병 이름, 투자 종목, 복권 번호는 쓰지 않는다.
- 이모지와 마크다운 기호를 쓰지 않는다.
- 태어난 시간을 모르면 시주 풀이는 빼고 그 사실을 첫 문단에 밝힌다.
- 설명 없이 JSON 하나만 출력한다.`;

function freePrompt(chart: Chart): string {
  return `${RULES}

[사주 자료]
${JSON.stringify(chartForAi(chart), null, 1)}

[출력 형식]
{"personalityTitle":"한 줄 제목(30자 이내)","personality":"타고난 성향 300~400자","yearLine":"2027년 한 줄 총평(40자 이내)","yearSummary":"2027년 총운 요약 250~350자","keywords":["키워드1","키워드2","키워드3"]}`;
}

function paidPrompt(chart: Chart): string {
  const g = yearGods(chart);
  const months = MONTHS_2027.map((m) => `${m.month}월 ${m.stem}${m.branch}`).join(', ');
  return `${RULES}

[사주 자료]
${JSON.stringify(chartForAi(chart), null, 1)}

[참고]
정(丁)은 이 사람에게 ${g.stem}(${GOD_EASY[g.stem]}), 미(未)는 ${g.branch}(${GOD_EASY[g.branch]})이다.
2027년 양력 달별 월주: ${months}. 1월은 입춘 전이라 지난해 기운이 이어진다.

[출력 형식]
{"sections":[{"id":"total","title":"2027년 한 줄 총평","body":"300자"},{"id":"nature","title":"타고난 성향","body":"500자"},{"id":"money","title":"재물","body":"500자"},{"id":"work","title":"직업과 공부","body":"500자"},{"id":"love","title":"연애와 관계","body":"500자"},{"id":"health","title":"건강 생활","body":"300자, 생활 습관 조언만"},{"id":"months","title":"월별 흐름","body":"월별 흐름을 읽는 법 100자"},{"id":"guide","title":"좋은 달, 조심할 달, 실천 3가지","body":"400자"}],"months":[{"month":1,"pillar":"신축","body":"150자"}],"goodMonths":[3,6],"cautionMonths":[8],"actions":["실천1","실천2","실천3"]}
months 는 1월부터 12월까지 12개를 모두 쓴다. sections 의 id 와 title 은 위와 똑같이 쓴다.`;
}

async function callClaude(model: string, prompt: string, maxTokens: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    usage.count += 1;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.ai.key,
        'anthropic-version': '2023-06-01',
      },
      // 온도 같은 선택 설정은 넣지 않고 기본값으로 부른다.
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text || '')
      .join('');
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 답에서 JSON 부분만 꺼낸다. */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const str = (v: unknown, min: number, max: number): v is string =>
  typeof v === 'string' && v.trim().length >= min && v.length <= max;

/** 무료 풀이 형식 검사 */
export function parseFree(raw: unknown): FreeReading | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!str(r.personalityTitle, 2, 80) || !str(r.personality, 80, 1500)) return null;
  if (!str(r.yearLine, 2, 100) || !str(r.yearSummary, 80, 1500)) return null;
  if (!Array.isArray(r.keywords) || r.keywords.length !== 3) return null;
  if (!r.keywords.every((k) => str(k, 1, 20))) return null;
  return {
    kind: 'free',
    source: 'ai',
    personalityTitle: r.personalityTitle.trim(),
    personality: r.personality.trim(),
    yearLine: r.yearLine.trim(),
    yearSummary: r.yearSummary.trim(),
    keywords: (r.keywords as string[]).map((k) => k.trim()),
  };
}

const SECTION_IDS = ['total', 'nature', 'money', 'work', 'love', 'health', 'months', 'guide'];

/** 유료 리포트 형식 검사 */
export function parsePaid(raw: unknown): PaidReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.sections) || r.sections.length !== 8) return null;
  const sections: PaidReport['sections'] = [];
  for (let i = 0; i < 8; i += 1) {
    const s = r.sections[i] as Record<string, unknown>;
    if (!s || s.id !== SECTION_IDS[i] || !str(s.title, 2, 60) || !str(s.body, 30, 3000)) return null;
    sections.push({ id: s.id as string, title: s.title.trim(), body: s.body.trim() });
  }
  if (!Array.isArray(r.months) || r.months.length !== 12) return null;
  const months: PaidReport['months'] = [];
  for (let i = 0; i < 12; i += 1) {
    const m = r.months[i] as Record<string, unknown>;
    if (!m || m.month !== i + 1 || !str(m.body, 20, 1000)) return null;
    const ref = MONTHS_2027[i];
    months.push({ month: i + 1, pillar: ref.stem + ref.branch, body: m.body.trim() });
  }
  const monthNums = (v: unknown): number[] | null => {
    if (!Array.isArray(v)) return null;
    const out = v.filter((n) => Number.isInteger(n) && n >= 1 && n <= 12) as number[];
    return out.length === v.length ? out.slice(0, 4) : null;
  };
  const good = monthNums(r.goodMonths);
  const caution = monthNums(r.cautionMonths);
  if (!good || !caution) return null;
  if (!Array.isArray(r.actions) || r.actions.length !== 3 || !r.actions.every((a) => str(a, 4, 200))) {
    return null;
  }
  return {
    kind: 'paid',
    source: 'ai',
    sections,
    months,
    goodMonths: good,
    cautionMonths: caution,
    actions: (r.actions as string[]).map((a) => a.trim()),
  };
}

/** AI 무료 풀이. 실패하면 null. 형식이 틀리면 한 번 더 요청한다. */
export async function aiFreeReading(chart: Chart): Promise<FreeReading | null> {
  if (!aiAvailable()) return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await callClaude(config.ai.modelFree, freePrompt(chart), 2000);
    if (!text) continue;
    const parsed = parseFree(extractJson(text));
    if (parsed && isSafe(parsed).ok) return parsed;
  }
  return null;
}

/** AI 유료 리포트. 실패하면 null. */
export async function aiPaidReport(chart: Chart): Promise<PaidReport | null> {
  if (!aiAvailable()) return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await callClaude(config.ai.modelPaid, paidPrompt(chart), 12000);
    if (!text) continue;
    const parsed = parsePaid(extractJson(text));
    if (parsed && isSafe(parsed).ok) return parsed;
  }
  return null;
}
