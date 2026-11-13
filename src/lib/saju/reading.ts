// 규칙 기반 풀이
// AI 열쇠가 없거나 AI 호출이 실패했을 때도 서비스가 멈추지 않도록,
// 계산된 사주만으로 풀이 글을 만들어 낸다. 같은 사주에는 항상 같은 글이 나온다.

import { getTenGod, getBranchTenGod } from 'manseryeok';
import type { Chart, Element, FreeReading, PaidReport, TenGod } from './types';
import {
  DAY_MASTER, ELEMENT_NOTE, GOD_EASY, MONTH_LINE, MONTH_TAIL,
  MONTHS_2027, YEAR_2027, YEAR_GROUND, YEAR_THEME,
} from './texts';

const ELEMENTS: Element[] = ['목', '화', '토', '금', '수'];

/** 일간 기준으로 2027년 천간과 지지의 십신을 구한다. */
export function yearGods(chart: Chart): { stem: TenGod; branch: TenGod } {
  return {
    stem: getTenGod(chart.dayMaster as never, YEAR_2027.stem as never) as TenGod,
    branch: getBranchTenGod(chart.dayMaster as never, YEAR_2027.branch as never) as TenGod,
  };
}

/** 가장 많은 오행과 가장 적은 오행 */
export function elementExtremes(chart: Chart): { most: Element; least: Element; missing: Element[] } {
  let most: Element = '목';
  let least: Element = '목';
  for (const e of ELEMENTS) {
    if (chart.elements[e] > chart.elements[most]) most = e;
    if (chart.elements[e] < chart.elements[least]) least = e;
  }
  const missing = ELEMENTS.filter((e) => chart.elements[e] === 0);
  return { most, least, missing };
}

/** 일간의 힘이 넉넉한 편인지 (돕는 기운이 절반 이상이면 넉넉하다고 본다) */
export function isStrong(chart: Chart): boolean {
  return chart.supportRatio >= 0.5;
}

/** 간단한 기준으로 본, 나에게 힘이 되는 십신 묶음 */
function helpfulGods(chart: Chart): TenGod[] {
  return isStrong(chart)
    ? ['식신', '상관', '편재', '정재', '정관']
    : ['비견', '편인', '정인', '식신'];
}

function elementSentence(chart: Chart): string {
  const { most, least, missing } = elementExtremes(chart);
  const parts: string[] = [];
  parts.push(`오행 가운데 ${ELEMENT_NOTE[most].name} 기운이 ${chart.elements[most]}개로 가장 많습니다. ${ELEMENT_NOTE[most].many}`);
  if (missing.length > 0) {
    const names = missing.map((e) => ELEMENT_NOTE[e].name).join(', ');
    parts.push(`${names} 기운은 사주에 보이지 않습니다. ${ELEMENT_NOTE[missing[0]].few}`);
  } else if (least !== most) {
    parts.push(`${ELEMENT_NOTE[least].name} 기운은 ${chart.elements[least]}개로 적은 편입니다. ${ELEMENT_NOTE[least].few}`);
  }
  return parts.join(' ');
}

function strengthSentence(chart: Chart): string {
  return isStrong(chart)
    ? '나를 돕는 기운이 넉넉한 편이라, 힘을 밖으로 쓰고 결과를 만드는 일에 잘 맞습니다.'
    : '나를 돕는 기운이 적은 편이라, 혼자 버티기보다 배우고 도움받으며 갈 때 힘이 납니다.';
}

function timeNote(chart: Chart): string {
  return chart.timeUnknown
    ? '태어난 시간을 몰라 시주(태어난 시간 기둥)는 빼고 풀이했습니다. '
    : '';
}

/** 무료 풀이: 기본 성향과 2027년 총운 요약 */
export function buildFreeReading(chart: Chart): FreeReading {
  const dm = DAY_MASTER[chart.dayMaster];
  const g = yearGods(chart);
  const theme = YEAR_THEME[g.stem];

  const personality = [
    timeNote(chart) + `일간(나를 뜻하는 글자)은 '${chart.dayMaster}'이고, 자연에 빗대면 ${dm.image}입니다.`,
    dm.nature,
    elementSentence(chart),
    strengthSentence(chart),
    dm.tip,
  ].join(' ');

  const yearSummary = [
    `2027년은 정미년(丁未年)입니다. 나에게 정(丁)은 ${g.stem}(${GOD_EASY[g.stem]}), 미(未)는 ${g.branch}(${GOD_EASY[g.branch]})에 해당합니다.`,
    theme.total,
    YEAR_GROUND[g.branch],
  ].join(' ');

  return {
    kind: 'free',
    source: 'rule',
    personalityTitle: dm.title,
    personality,
    yearLine: theme.line,
    yearSummary,
    keywords: [...theme.keywords],
  };
}

/** 월별 흐름과 좋은 달, 조심할 달 */
export function buildMonths(chart: Chart): {
  months: PaidReport['months'];
  goodMonths: number[];
  cautionMonths: number[];
} {
  const helpful = helpfulGods(chart);
  const careful: TenGod[] = isStrong(chart) ? ['겁재', '편관'] : ['겁재', '편관', '상관'];
  const months: PaidReport['months'] = [];
  const good: number[] = [];
  const caution: number[] = [];

  for (const m of MONTHS_2027) {
    const sg = getTenGod(chart.dayMaster as never, m.stem as never) as TenGod;
    const bg = getBranchTenGod(chart.dayMaster as never, m.branch as never) as TenGod;
    const head = m.month === 1 ? '아직 입춘 전이라 지난해의 기운이 이어집니다. ' : '';
    months.push({
      month: m.month,
      pillar: m.stem + m.branch,
      body: `${head}${m.stem}${m.branch}월은 나에게 ${sg}(${GOD_EASY[sg]})의 달입니다. ${MONTH_LINE[sg]} ${MONTH_TAIL[bg]}`,
    });
    if (careful.includes(sg)) caution.push(m.month);
    else if (helpful.includes(sg)) good.push(m.month);
  }
  return { months, goodMonths: good.slice(0, 4), cautionMonths: caution.slice(0, 3) };
}

function monthList(ms: number[]): string {
  return ms.map((m) => `${m}월`).join(', ');
}

/** 유료 리포트: 목차 8개 */
export function buildPaidReport(chart: Chart): PaidReport {
  const dm = DAY_MASTER[chart.dayMaster];
  const g = yearGods(chart);
  const theme = YEAR_THEME[g.stem];
  const ground = YEAR_THEME[g.branch];
  const { months, goodMonths, cautionMonths } = buildMonths(chart);
  const luck = chart.luck.current
    ? `지금은 ${chart.luck.current.korean} 대운(약 10년 단위의 큰 흐름)을 지나고 있습니다. `
    : '';

  const strong = isStrong(chart);
  const actions = [
    theme.action,
    ground.action !== theme.action ? ground.action : '한 달에 한 번, 잘된 일과 아쉬운 일을 세 줄로 적어 보기',
    strong
      ? '넘치는 힘은 결과물로 바꾸기: 분기마다 끝낼 일 하나를 정하기'
      : '혼자 끌어안지 않기: 어려울 때 물어볼 사람 두 명을 정해 두기',
  ];

  const goodText = goodMonths.length
    ? `힘이 실리기 쉬운 달은 ${monthList(goodMonths)}입니다. 중요한 시작이나 발표, 만남을 이 무렵에 두면 좋습니다.`
    : '올해는 특별히 튀는 달 없이 고르게 흘러갑니다. 꾸준함이 가장 큰 힘이 됩니다.';
  const cautionText = cautionMonths.length
    ? `${monthList(cautionMonths)}은 지출과 일이 몰리기 쉬우니 일정에 여유를 두고, 큰 결정은 한 번 더 살펴보세요.`
    : '특별히 조심할 달은 눈에 띄지 않습니다. 다만 무리한 일정은 어느 달이든 피하는 편이 좋습니다.';

  const sections: PaidReport['sections'] = [
    {
      id: 'total',
      title: '2027년 한 줄 총평',
      body: `${theme.line}. ${timeNote(chart)}2027년 정미년(丁未年)의 정(丁)은 나에게 ${g.stem}(${GOD_EASY[g.stem]}), 미(未)는 ${g.branch}(${GOD_EASY[g.branch]})입니다. ${theme.total} ${YEAR_GROUND[g.branch]} ${luck}`.trim(),
    },
    {
      id: 'nature',
      title: '타고난 성향',
      body: `일간(나를 뜻하는 글자)은 '${chart.dayMaster}', 자연에 빗대면 ${dm.image}입니다. ${dm.nature} 가장 큰 강점은 ${dm.strength}입니다. ${elementSentence(chart)} ${strengthSentence(chart)} ${dm.tip}`,
    },
    {
      id: 'money',
      title: '재물',
      body: `${theme.money} ${strong ? '힘이 넉넉한 사주라 벌 기회를 직접 만들어 나서는 편이 잘 맞습니다.' : '무리하게 벌리기보다 지금 가진 것을 지키고 실력을 쌓는 쪽이 남는 것이 많습니다.'} 생활 쪽에서는 이런 흐름이 더해집니다. ${ground.money}`,
    },
    {
      id: 'work',
      title: '직업과 공부',
      body: `${theme.work} ${ground.work}`,
    },
    {
      id: 'love',
      title: '연애와 관계',
      body: `${theme.love} 가족과 동료 사이에서는 이런 점을 챙겨 보세요. ${ground.love}`,
    },
    {
      id: 'health',
      title: '건강 생활',
      body: `${theme.health} ${ground.health !== theme.health ? ground.health : ''} 몸에 불편한 곳이 있다면 미루지 말고 병원에서 확인해 보세요.`.replace(/\s+/g, ' ').trim(),
    },
    {
      id: 'months',
      title: '월별 흐름',
      body: '1월부터 12월까지 달마다 어떤 기운이 들어오는지 아래에 정리했습니다. 날짜는 양력 기준이며, 달이 바뀌는 때는 절기에 따라 며칠 차이가 날 수 있습니다.',
    },
    {
      id: 'guide',
      title: '좋은 달, 조심할 달, 실천 3가지',
      body: `${goodText} ${cautionText}`,
    },
  ];

  return { kind: 'paid', source: 'rule', sections, months, goodMonths, cautionMonths, actions };
}
