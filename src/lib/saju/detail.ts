// 자세한 풀이 (1.1)
// 주제별 운 7가지와 시기별 운 4가지를 규칙으로 만든다. 같은 사주에는 항상 같은 글이 나온다.
// 각 항목의 첫 묶음(sections[0])은 무료 미리보기로 쓰고, 나머지는 유료로 열 예정이다.

import { getBranchTenGod, getTenGod } from 'manseryeok';
import type { Chart, Element, PillarView, TenGod } from './types';
import { GOD_EASY, MONTHS_2027, YEAR_GROUND, YEAR_THEME } from './texts';
import { buildMonths, buildPaidReport, elementExtremes, isStrong } from './reading';
import {
  DAEUN_GROUND, DAEUN_THEME, DETAIL_NOTE, FAMILY_CHILD, FAMILY_PARENT, FAMILY_SIBLING,
  FLOW_LABEL, GROUP_EASY, GROUP_OF, HEALTH_FEW, HEALTH_MANY, LATE_UNKNOWN, LEVEL_LABEL,
  PEACH_LINE, SPOUSE_SEAT, STAGES, STAGE_TEXT, TOPIC_BASE, TOPIC_FLOW, TOPIC_STRENGTH,
  TOPIC_SUB, TOPIC_TIPS,
  type Flow, type GodGroup, type StageId, type TopicId,
} from './detail-texts';

export type { Flow } from './detail-texts';

/** 풀이 화면의 한 줄 목록 (월별, 해별, 대운별) */
export interface DetailRow {
  label: string;
  sub?: string;
  body: string;
  highlight?: boolean;
  tag?: string;
}

/** 자세한 풀이 한 항목 */
export interface DetailItem {
  id: string;
  group: 'topic' | 'period';
  title: string;
  /** 메뉴와 미리보기에 쓰는 한 줄 요약 */
  summary: string;
  /** 2027년 흐름 (주제별 운에만) */
  flow?: Flow;
  flowLabel?: string;
  sections: { title: string; body: string }[];
  rows?: DetailRow[];
  rowsTitle?: string;
  tips?: string[];
}

export interface DetailReport {
  items: DetailItem[];
  note: string;
}

/** 5년운에 쓰는 해별 간지 */
export const YEARS_5: { year: number; stem: string; branch: string }[] = [
  { year: 2027, stem: '정', branch: '미' },
  { year: 2028, stem: '무', branch: '신' },
  { year: 2029, stem: '기', branch: '유' },
  { year: 2030, stem: '경', branch: '술' },
  { year: 2031, stem: '신', branch: '해' },
];

const GROUPS: GodGroup[] = ['비겁', '식상', '재성', '관성', '인성'];
const PEACH = ['자', '오', '묘', '유'];

function stemGod(chart: Chart, stem: string): TenGod {
  return getTenGod(chart.dayMaster as never, stem as never) as TenGod;
}
function branchGod(chart: Chart, branch: string): TenGod {
  return getBranchTenGod(chart.dayMaster as never, branch as never) as TenGod;
}

/** 일간을 뺀 글자들의 십신 묶음 개수 */
export function groupCounts(chart: Chart): Record<GodGroup, number> {
  const counts: Record<GodGroup, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  const { year, month, day, hour } = chart.pillars;
  const gods: TenGod[] = [];
  for (const p of [year, month, hour]) {
    if (!p) continue;
    gods.push(p.stemGod as TenGod, p.branchGod);
  }
  gods.push(day.branchGod);
  for (const g of gods) counts[GROUP_OF[g]] += 1;
  return counts;
}

function level(n: number): number {
  return Math.min(n, 3);
}

/** 나에게 힘이 되는 묶음 */
export function helpfulGroups(chart: Chart): GodGroup[] {
  return isStrong(chart) ? ['식상', '재성', '관성'] : ['비겁', '인성'];
}

/** 어떤 해(또는 대운)의 글자가 주제 묶음에 닿는지로 흐름을 정한다. */
export function flowOf(chart: Chart, gods: TenGod[], topicGroups: GodGroup[]): Flow {
  const hits = gods.map((g) => GROUP_OF[g]).filter((g) => topicGroups.includes(g));
  if (hits.length === 0) return 'calm';
  const helpful = helpfulGroups(chart);
  return hits.some((g) => helpful.includes(g)) ? 'strong' : 'busy';
}

/** 해 하나의 전체 흐름: 천간 십신 기준 */
function yearFlow(chart: Chart, sg: TenGod): Flow {
  if (sg === '겁재' || sg === '편관') return 'busy';
  return helpfulGroups(chart).includes(GROUP_OF[sg]) ? 'strong' : 'calm';
}

/** 해 전체 흐름의 이름 (주제별 '잔잔함' 대신 '보통') */
const YEAR_FLOW_LABEL: Record<Flow, string> = { strong: '힘이 실림', busy: '바쁜 해', calm: '보통' };

function ageIn(chart: Chart, year: number): number {
  return year - chart.solar.year;
}

function yearsList(ys: number[]): string {
  return ys.map((y) => `${y}년`).join(', ');
}

/** 주제의 바탕이 되는 묶음 */
function topicGroups(chart: Chart, id: TopicId): { main: GodGroup; sub: GodGroup | null } {
  switch (id) {
    case 'money': return { main: '재성', sub: '식상' };
    case 'career': return { main: '관성', sub: '식상' };
    case 'love': return { main: chart.gender === 'male' ? '재성' : '관성', sub: null };
    case 'study': return { main: '인성', sub: '관성' };
    case 'people': return { main: '비겁', sub: '식상' };
  }
}

const TOPIC_TITLE: Record<TopicId, string> = {
  money: '재물운',
  career: '성공·직업운',
  love: '연애·결혼운',
  study: '학업·시험운',
  people: '대인관계운',
};

/** 2027년 정미년의 천간·지지 십신 */
function gods2027(chart: Chart): TenGod[] {
  return [stemGod(chart, '정'), branchGod(chart, '미')];
}

/** 5년 동안 해마다 그 주제의 흐름 */
function topicYears(chart: Chart, groups: GodGroup[]): { year: number; flow: Flow }[] {
  return YEARS_5.map((y) => ({
    year: y.year,
    flow: flowOf(chart, [stemGod(chart, y.stem), branchGod(chart, y.branch)], groups),
  }));
}

function fiveYearLine(chart: Chart, groups: GodGroup[], what: string): string {
  const ys = topicYears(chart, groups);
  const strong = ys.filter((y) => y.flow === 'strong').map((y) => y.year);
  const busy = ys.filter((y) => y.flow === 'busy').map((y) => y.year);
  const parts: string[] = [];
  if (strong.length) {
    parts.push(`2027년부터 2031년까지 5년 가운데 ${what}에 힘이 실리기 쉬운 해는 ${yearsList(strong)}입니다. 중요한 시작은 이 무렵에 두면 좋습니다.`);
  } else {
    parts.push(`2027년부터 2031년까지 5년 가운데 ${what}에 크게 힘이 실리는 해는 눈에 띄지 않습니다. 해마다 조금씩 쌓아 가는 방식이 잘 맞습니다.`);
  }
  if (busy.length) {
    parts.push(`${yearsList(busy)}은 ${what} 쪽으로 일이 많아지는 해이니 서두르지 말고 차근차근 살펴 가세요.`);
  } else if (!strong.length) {
    parts.push('크게 출렁이는 해도 없어, 꾸준함이 가장 큰 힘이 됩니다.');
  }
  return parts.join(' ');
}

/** 2027 신년운세 문장에서 주제에 맞는 한 단락 */
function theme2027(chart: Chart, key: 'money' | 'work' | 'love' | 'health'): string {
  return YEAR_THEME[stemGod(chart, '정')][key];
}

// ---------------------------------------------------------------------------
// 주제별 운
// ---------------------------------------------------------------------------

function buildTopic(chart: Chart, id: TopicId): DetailItem {
  const counts = groupCounts(chart);
  const { main, sub } = topicGroups(chart, id);
  const lv = level(counts[main]);
  const base = TOPIC_BASE[id][lv];
  const strong = isStrong(chart);
  const flow = flowOf(chart, gods2027(chart), [main]);

  const nature = [base.body, TOPIC_STRENGTH[id][strong ? 'strong' : 'weak']];
  if (sub) nature.push(TOPIC_SUB[id][counts[sub] > 0 ? 'has' : 'none']);

  const sections: DetailItem['sections'] = [
    { title: '타고난 바탕', body: nature.join(' ') },
  ];

  if (id === 'love') {
    const spouse = SPOUSE_SEAT[chart.pillars.day.branchGod];
    const branches = [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour]
      .filter((p): p is PillarView => p !== null)
      .map((p) => p.branch);
    const peach = branches.some((b) => PEACH.includes(b));
    sections.push({
      title: '나에게 맞는 인연',
      body: `${spouse} ${peach ? PEACH_LINE.has : PEACH_LINE.none}`,
    });
  }

  // 2027 신년운세 문장 가운데 그 주제에 맞는 단락을 덧붙인다. 공부운에는 맞는 단락이 없어 붙이지 않는다.
  const extra = id === 'money' ? theme2027(chart, 'money')
    : id === 'career' ? theme2027(chart, 'work')
    : id === 'love' || id === 'people' ? theme2027(chart, 'love')
    : '';
  sections.push({
    title: '2027년 흐름',
    body: `${TOPIC_FLOW[id][flow]} ${extra}`.trim(),
  });
  sections.push({
    title: '앞으로 5년',
    body: fiveYearLine(chart, [main], TOPIC_TITLE[id].replace('운', '')),
  });

  return {
    id,
    group: 'topic',
    title: TOPIC_TITLE[id],
    summary: base.line,
    flow,
    flowLabel: FLOW_LABEL[flow],
    sections,
    tips: TOPIC_TIPS[id],
  };
}

const ELEMENTS: Element[] = ['목', '화', '토', '금', '수'];
const EL_NAME: Record<Element, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };

function buildHealth(chart: Chart): DetailItem {
  const { most, least, missing } = elementExtremes(chart);
  const few = missing.length ? missing : least !== most ? [least] : [];
  const sg = stemGod(chart, '정');
  const flow: Flow = sg === '편관' || sg === '겁재' || sg === '상관'
    ? 'busy'
    : sg === '식신' || sg === '정인' || sg === '정재' ? 'strong' : 'calm';
  const balanced = ELEMENTS.every((e) => chart.elements[e] >= 1 && chart.elements[e] <= 2);

  const summary = balanced
    ? '오행이 고르게 놓여 생활 리듬이 무너지지 않게 지키는 것이 열쇠'
    : `${EL_NAME[most]} 기운은 덜고${few.length ? ` ${few.map((e) => EL_NAME[e]).join('·')} 기운은 채우는` : ''} 생활이 열쇠`;

  const habit = [HEALTH_MANY[most], ...few.slice(0, 2).map((e) => HEALTH_FEW[e])];
  return {
    id: 'health',
    group: 'topic',
    title: '건강운',
    summary,
    flow,
    flowLabel: FLOW_LABEL[flow],
    sections: [
      {
        title: '타고난 바탕',
        body: balanced
          ? '사주의 다섯 기운이 고르게 놓여 있어 한쪽으로 크게 치우치지 않습니다. 특별히 조심할 곳보다, 무리한 일정과 불규칙한 생활을 피하는 것이 가장 좋은 관리입니다.'
          : `오행 가운데 ${EL_NAME[most]} 기운이 가장 많고${few.length ? `, ${few.map((e) => EL_NAME[e]).join('과 ')} 기운이 적은 편` : ''}입니다. 넘치는 기운은 덜어 주고 모자란 기운은 생활 습관으로 채워 주면 몸과 마음이 편안해집니다.`,
      },
      { title: '챙기면 좋은 생활 습관', body: habit.join(' ') },
      { title: '2027년 흐름', body: `${TOPIC_FLOW.health[flow]} ${theme2027(chart, 'health')}` },
      {
        title: '알아 두세요',
        body: '이 풀이는 생활 습관을 돌아보는 참고용이며 몸 상태를 판단하지 않습니다. 불편한 곳이 있다면 미루지 말고 병원에서 확인해 보세요.',
      },
    ],
    tips: TOPIC_TIPS.health,
  };
}

function buildFamily(chart: Chart): DetailItem {
  const { year, month, day, hour } = chart.pillars;
  const g = (p: PillarView) => GROUP_OF[p.stemGod as TenGod];
  const childGroup: GodGroup = chart.gender === 'male' ? '관성' : '식상';
  const counts = groupCounts(chart);
  const flow = flowOf(chart, gods2027(chart), ['인성', '비겁']);

  const childBody = hour
    ? FAMILY_CHILD[g(hour)]
    : `태어난 시간을 몰라 자녀의 자리(시주)는 보지 못했습니다. 대신 자녀를 뜻하는 ${GROUP_EASY[childGroup]}이 사주에 ${counts[childGroup] > 0 ? `${counts[childGroup]}개 있어, 자녀나 후배와 인연이 이어지는 편입니다.` : '드러나 있지 않아, 자녀와는 서로의 독립을 존중하는 관계가 편합니다.'}`;

  return {
    id: 'family',
    group: 'topic',
    title: '가족운',
    summary: `부모의 자리에 ${GROUP_EASY[g(year)]}, 배우자 자리에 ${GROUP_EASY[GROUP_OF[day.branchGod]]}`,
    flow,
    flowLabel: FLOW_LABEL[flow],
    sections: [
      { title: '부모와 집안', body: FAMILY_PARENT[g(year)] },
      { title: '형제와 또래', body: FAMILY_SIBLING[g(month)] },
      { title: '배우자와 가정', body: SPOUSE_SEAT[day.branchGod] },
      { title: '자녀와 후배', body: childBody },
      { title: '2027년 흐름', body: TOPIC_FLOW.family[flow] },
    ],
    tips: TOPIC_TIPS.family,
  };
}

// ---------------------------------------------------------------------------
// 시기별 운
// ---------------------------------------------------------------------------

function buildYear1(chart: Chart): DetailItem {
  const report = buildPaidReport(chart);
  const { months, goodMonths, cautionMonths } = buildMonths(chart);
  const total = report.sections.find((s) => s.id === 'total')!;
  const guide = report.sections.find((s) => s.id === 'guide')!;
  const theme = YEAR_THEME[stemGod(chart, '정')];
  return {
    id: 'year1',
    group: 'period',
    title: '1년운 (2027년)',
    summary: theme.line,
    sections: [
      { title: '2027년 한 줄 총평', body: total.body },
      { title: '좋은 달과 조심할 달', body: guide.body },
    ],
    rowsTitle: '1월부터 12월까지',
    rows: months.map((m, i) => ({
      label: `${m.month}월`,
      sub: `${MONTHS_2027[i].stem}${MONTHS_2027[i].branch}월`,
      body: m.body,
      highlight: goodMonths.includes(m.month),
      tag: goodMonths.includes(m.month) ? '좋은 달' : cautionMonths.includes(m.month) ? '살필 달' : undefined,
    })),
    tips: report.actions,
  };
}

function buildYear5(chart: Chart): DetailItem {
  const rows: DetailRow[] = YEARS_5.map((y) => {
    const sg = stemGod(chart, y.stem);
    const bg = branchGod(chart, y.branch);
    const t = YEAR_THEME[sg];
    const flow = yearFlow(chart, sg);
    return {
      label: `${y.year}년 ${y.stem}${y.branch}년`,
      sub: `${ageIn(chart, y.year)}세 · ${sg}(${GOD_EASY[sg]})`,
      body: `${t.line}. ${t.total} ${YEAR_GROUND[bg]}`,
      highlight: flow === 'strong',
      tag: YEAR_FLOW_LABEL[flow],
    };
  });
  const strongYears = YEARS_5.filter((y) => yearFlow(chart, stemGod(chart, y.stem)) === 'strong').map((y) => y.year);
  const busyYears = YEARS_5.filter((y) => yearFlow(chart, stemGod(chart, y.stem)) === 'busy').map((y) => y.year);
  const summary = strongYears.length
    ? `5년 가운데 ${yearsList(strongYears)}에 힘이 실리는 흐름`
    : '5년 동안 크게 출렁이지 않고 고르게 가는 흐름';

  const overview = [
    strongYears.length
      ? `2027년부터 2031년까지 5년을 보면, ${yearsList(strongYears)}에 나에게 힘이 되는 기운이 들어옵니다. 새로운 시작과 큰 결정은 이 해에 두면 좋습니다.`
      : '2027년부터 2031년까지 5년은 특별히 튀는 해 없이 고르게 흘러갑니다. 해마다 작은 목표를 이루며 쌓아 가는 방식이 잘 맞습니다.',
    busyYears.length
      ? `${yearsList(busyYears)}은 할 일과 지출이 몰리기 쉬우니 일정과 돈에 여유를 두세요.`
      : '눈에 띄게 바쁜 해는 보이지 않습니다.',
  ].join(' ');

  return {
    id: 'year5',
    group: 'period',
    title: '5년운 (2027~2031)',
    summary,
    sections: [{ title: '5년 한눈에 보기', body: overview }],
    rowsTitle: '해마다 흐름',
    rows,
  };
}

interface LuckPillar { age: number; korean: string; stem: string; branch: string }

function luckPillars(chart: Chart): LuckPillar[] {
  return chart.luck.pillars.map((p) => ({
    age: p.age,
    korean: p.korean,
    stem: p.korean.slice(0, 1),
    branch: p.korean.slice(1, 2),
  }));
}

function daeunText(chart: Chart, p: LuckPillar): { line: string; body: string; sg: TenGod } {
  const sg = stemGod(chart, p.stem);
  const bg = branchGod(chart, p.branch);
  const t = DAEUN_THEME[sg];
  return { line: t.line, body: `${t.body} ${DAEUN_GROUND[bg]}`, sg };
}

function buildDecade(chart: Chart): DetailItem {
  const list = luckPillars(chart);
  const age2027 = ageIn(chart, 2027);
  let idx = list.findIndex((p, i) => p.age <= age2027 && (i === list.length - 1 || list[i + 1].age > age2027));
  const notStarted = idx < 0;
  if (notStarted) idx = 0;
  const now = list[idx];
  const next = list[idx + 1];

  const sections: DetailItem['sections'] = [];
  if (now) {
    const t = daeunText(chart, now);
    sections.push({
      title: `${notStarted ? '처음 맞는' : '지금'} 대운: ${now.age}~${now.age + 9}세 ${now.korean}`,
      body: `${notStarted ? `대운은 ${now.age}세부터 시작합니다. ` : ''}${t.line}입니다. ${t.body}`,
    });
  }
  if (next) {
    const t = daeunText(chart, next);
    sections.push({
      title: `다음 대운: ${next.age}~${next.age + 9}세 ${next.korean}`,
      body: `${t.line}입니다. ${t.body}`,
    });
  }

  return {
    id: 'decade',
    group: 'period',
    title: '10년운 (대운)',
    summary: now ? `${now.age}~${now.age + 9}세, ${daeunText(chart, now).line}` : '대운을 계산하지 못했습니다',
    sections,
    rowsTitle: '평생 대운 지도',
    rows: list.map((p, i) => {
      const t = daeunText(chart, p);
      return {
        label: `${p.age}~${p.age + 9}세`,
        sub: `${p.korean} · ${t.sg}`,
        body: t.line,
        highlight: i === idx && !notStarted,
        tag: i === idx && !notStarted ? '지금' : undefined,
      };
    }),
  };
}

function stagePillarGroup(chart: Chart, id: StageId): GodGroup | null {
  const { year, month, day, hour } = chart.pillars;
  switch (id) {
    case 'early': return GROUP_OF[year.stemGod as TenGod];
    case 'youth': return GROUP_OF[month.stemGod as TenGod];
    case 'middle': return GROUP_OF[day.branchGod];
    case 'late': return hour ? GROUP_OF[hour.stemGod as TenGod] : null;
  }
}

function buildLife(chart: Chart): DetailItem {
  const list = luckPillars(chart);
  const helpful = helpfulGroups(chart);
  const age2027 = ageIn(chart, 2027);
  const scores: { id: StageId; score: number }[] = [];

  const rows: DetailRow[] = STAGES.map((s) => {
    const group = stagePillarGroup(chart, s.id);
    const lucks = list.filter((p) => p.age <= s.to && p.age + 9 >= s.from);
    const luckGroups = lucks.map((p) => GROUP_OF[stemGod(chart, p.stem)]);
    const score = (group && helpful.includes(group) ? 1 : 0) + luckGroups.filter((g) => helpful.includes(g)).length;
    scores.push({ id: s.id, score });

    const head = group ? STAGE_TEXT[s.id][group] : LATE_UNKNOWN;
    const luckLine = lucks.length
      ? `이 시기에 지나는 대운은 ${lucks.map((p) => `${p.korean}(${p.age}세부터, ${daeunText(chart, p).line})`).join(', ')}입니다.`
      : '';
    const nowMark = age2027 >= s.from && age2027 <= s.to;
    return {
      label: s.to >= 120 ? `${s.title} (${s.from}세 이후)` : `${s.title} (${s.from}~${s.to}세)`,
      sub: group ? `${s.seat} · ${GROUP_EASY[group]}` : s.seat,
      body: `${head} ${luckLine}`.trim(),
      highlight: nowMark,
      tag: nowMark ? '지금' : undefined,
    };
  });

  const best = [...scores].sort((a, b) => b.score - a.score)[0];
  const bestTitle = STAGES.find((s) => s.id === best.id)!.title.replace('운', '기');
  const allSame = scores.every((x) => x.score === scores[0].score);
  const summary = allSame ? '인생 네 시기가 고르게 흘러가는 사주' : `${bestTitle}에 가장 힘이 실리는 흐름`;

  return {
    id: 'life',
    group: 'period',
    title: '인생 시기별 운',
    summary,
    sections: [
      {
        title: '한눈에 보기',
        body: allSame
          ? '초년, 청년, 중년, 노년의 흐름이 한쪽으로 치우치지 않고 고르게 이어집니다. 시기마다 맞는 과제를 차근차근 해 나가면 됩니다.'
          : `사주의 네 기둥과 대운을 함께 보면 ${bestTitle}에 나에게 힘이 되는 기운이 가장 많이 모입니다. 그 시기를 내다보고 앞 시기에 준비를 해 두면 좋습니다.`,
      },
    ],
    rowsTitle: '초년, 청년, 중년, 노년',
    rows,
  };
}

/** 자세한 풀이 전체 */
export function buildDetail(chart: Chart): DetailReport {
  const topics: TopicId[] = ['money', 'career', 'love'];
  const items: DetailItem[] = [
    ...topics.map((id) => buildTopic(chart, id)),
    buildHealth(chart),
    buildTopic(chart, 'study'),
    buildTopic(chart, 'people'),
    buildFamily(chart),
    buildYear1(chart),
    buildYear5(chart),
    buildDecade(chart),
    buildLife(chart),
  ];
  return { items, note: DETAIL_NOTE };
}

/** 금지 표현 검사용: 자세한 풀이를 하나의 글로 */
export function flattenDetail(d: DetailReport): string {
  return d.items
    .map((it) => [
      it.title, it.summary,
      ...it.sections.map((s) => `${s.title}\n${s.body}`),
      ...(it.rows ?? []).map((r) => `${r.label} ${r.sub ?? ''}\n${r.body}`),
      ...(it.tips ?? []),
    ].join('\n'))
    .concat(d.note)
    .join('\n');
}

export { GROUPS, LEVEL_LABEL };
