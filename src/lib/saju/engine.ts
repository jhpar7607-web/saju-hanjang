// 사주 계산 엔진
// 계산 자체는 한국천문연구원 자료 기반의 manseryeok 라이브러리가 맡고,
// 이 파일은 입력 검사와 화면에 쓰기 좋은 모양으로 바꾸는 일을 한다.

import {
  calculateFourPillars,
  lunarToSolar,
  solarToLunar,
  isValidSolarDate,
  HEAVENLY_STEMS,
  HEAVENLY_STEMS_HANJA,
  EARTHLY_BRANCHES,
  EARTHLY_BRANCHES_HANJA,
  getHeavenlyStemElement,
  getEarthlyBranchElement,
  getHeavenlyStemYinYang,
  getEarthlyBranchYinYang,
  getTenGod,
  getBranchTenGod,
} from 'manseryeok';
import type { BirthInput, Chart, Element, PillarView, TenGod } from './types';
import { InputError } from './types';

/** 입력을 받는 출생 연도 범위 */
export const MIN_YEAR = 1930;
export const MAX_YEAR = 2026;
/** 풀이 대상 연도 (정미년) */
export const TARGET_YEAR = 2027;

/** 오행의 생(生) 순서: 목 → 화 → 토 → 금 → 수 → 목 */
export const ELEMENT_ORDER: Element[] = ['목', '화', '토', '금', '수'];

/** 어떤 오행을 낳아 주는 오행 (예: 화를 낳는 것은 목) */
export function motherOf(el: Element): Element {
  const i = ELEMENT_ORDER.indexOf(el);
  return ELEMENT_ORDER[(i + 4) % 5];
}

function stemHanja(stem: string): string {
  const i = (HEAVENLY_STEMS as readonly string[]).indexOf(stem);
  return i >= 0 ? HEAVENLY_STEMS_HANJA[i] : '';
}

function branchHanja(branch: string): string {
  const i = (EARTHLY_BRANCHES as readonly string[]).indexOf(branch);
  return i >= 0 ? EARTHLY_BRANCHES_HANJA[i] : '';
}

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

/** 입력값 검사. 문제가 있으면 쉬운 말로 된 InputError 를 던진다. */
export function validateInput(raw: unknown): BirthInput {
  if (!raw || typeof raw !== 'object') throw new InputError('입력값이 비어 있습니다.');
  const r = raw as Record<string, unknown>;
  const { year, month, day } = r;
  if (!isInt(year) || !isInt(month) || !isInt(day)) {
    throw new InputError('생년월일을 숫자로 입력해 주세요.');
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new InputError(`태어난 해는 ${MIN_YEAR}년부터 ${MAX_YEAR}년까지 입력할 수 있습니다.`);
  }
  if (month < 1 || month > 12) throw new InputError('월은 1부터 12까지입니다.');
  if (day < 1 || day > 31) throw new InputError('일은 1부터 31까지입니다.');

  const calendar = r.calendar === 'lunar' ? 'lunar' : 'solar';
  const leap = calendar === 'lunar' && r.leap === true;
  if (r.gender !== 'male' && r.gender !== 'female') {
    throw new InputError('성별을 선택해 주세요.');
  }

  let hour: number | null = null;
  let minute: number | null = null;
  if (r.hour !== null && r.hour !== undefined) {
    if (!isInt(r.hour) || r.hour < 0 || r.hour > 23) {
      throw new InputError('시간은 0시부터 23시까지입니다.');
    }
    hour = r.hour;
    const m = r.minute ?? 0;
    if (!isInt(m) || m < 0 || m > 59) throw new InputError('분은 0부터 59까지입니다.');
    minute = m;
  }

  const dayBoundary =
    r.dayBoundary === 'jasi' || r.dayBoundary === 'splitJasi' ? r.dayBoundary : 'midnight';
  const trueSolar = r.trueSolar !== false;

  const input: BirthInput = {
    year, month, day, hour, minute, calendar, leap,
    gender: r.gender, trueSolar, dayBoundary,
  };

  // 실제로 있는 날짜인지 확인한다.
  const solar = toSolar(input);
  const now = new Date();
  const birth = new Date(Date.UTC(solar.year, solar.month - 1, solar.day));
  if (birth.getTime() > now.getTime()) {
    throw new InputError('아직 오지 않은 날짜입니다.');
  }
  return input;
}

/** 입력 날짜를 양력으로 바꾼다. 없는 날짜면 InputError. */
export function toSolar(input: BirthInput): { year: number; month: number; day: number } {
  if (input.calendar === 'solar') {
    if (!isValidSolarDate(input.year, input.month, input.day)) {
      throw new InputError('달력에 없는 날짜입니다. 날짜를 다시 확인해 주세요.');
    }
    return { year: input.year, month: input.month, day: input.day };
  }
  try {
    return lunarToSolar(input.year, input.month, input.day, input.leap);
  } catch {
    throw new InputError(
      input.leap
        ? '그 해에는 해당 윤달이 없거나 날짜가 맞지 않습니다.'
        : '음력 달력에 없는 날짜입니다. 날짜를 다시 확인해 주세요.',
    );
  }
}

function ageBandOf(birthYear: number): string {
  const age = TARGET_YEAR - birthYear;
  if (age < 10) return '10세 미만';
  if (age >= 90) return '90대 이상';
  return `${Math.floor(age / 10) * 10}대`;
}

/** 사주를 계산해 화면용 결과로 돌려준다. */
export function computeChart(input: BirthInput): Chart {
  const timeUnknown = input.hour === null;
  const solar = toSolar(input);

  let detail;
  try {
    detail = calculateFourPillars({
      year: input.year,
      month: input.month,
      day: input.day,
      // 시간을 모르면 날짜가 바뀌지 않는 한낮으로 계산하고 시주는 쓰지 않는다.
      hour: timeUnknown ? 12 : (input.hour as number),
      minute: timeUnknown ? 0 : (input.minute ?? 0),
      isLunar: input.calendar === 'lunar',
      isLeapMonth: input.leap,
      trueSolarTime: !timeUnknown && input.trueSolar ? {} : undefined,
      dayBoundary: input.dayBoundary,
      gender: input.gender,
    });
  } catch (e) {
    if (e instanceof RangeError) {
      throw new InputError('계산할 수 없는 날짜입니다. 날짜를 다시 확인해 주세요.');
    }
    throw e;
  }

  const dayMaster = detail.day.heavenlyStem;

  const view = (
    p: { heavenlyStem: string; earthlyBranch: string },
    isDay: boolean,
  ): PillarView => ({
    stem: p.heavenlyStem,
    branch: p.earthlyBranch,
    stemHanja: stemHanja(p.heavenlyStem),
    branchHanja: branchHanja(p.earthlyBranch),
    stemElement: getHeavenlyStemElement(p.heavenlyStem as never) as Element,
    branchElement: getEarthlyBranchElement(p.earthlyBranch as never) as Element,
    stemYinYang: getHeavenlyStemYinYang(p.heavenlyStem as never) as '양' | '음',
    branchYinYang: getEarthlyBranchYinYang(p.earthlyBranch as never) as '양' | '음',
    stemGod: isDay ? '일간' : (getTenGod(dayMaster as never, p.heavenlyStem as never) as TenGod),
    branchGod: getBranchTenGod(dayMaster as never, p.earthlyBranch as never) as TenGod,
  });

  const pillars = {
    year: view(detail.year, false),
    month: view(detail.month, false),
    day: view(detail.day, true),
    hour: timeUnknown ? null : view(detail.hour, false),
  };

  // 오행 개수 세기
  const elements: Record<Element, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const used = [pillars.year, pillars.month, pillars.day, pillars.hour].filter(
    (p): p is PillarView => p !== null,
  );
  for (const p of used) {
    elements[p.stemElement] += 1;
    elements[p.branchElement] += 1;
  }

  // 일간을 돕는 기운(같은 오행 + 낳아 주는 오행)의 비율
  const dmEl = pillars.day.stemElement;
  const total = used.length * 2;
  const supportRatio = (elements[dmEl] + elements[motherOf(dmEl)]) / total;

  // 대운
  const lp = detail.luckPillars;
  const ageIn2027 = TARGET_YEAR - solar.year;
  const luckPillars = (lp?.pillars ?? []).map((x) => ({ age: x.age, korean: x.korean }));
  let current: { age: number; korean: string } | null = null;
  for (const x of luckPillars) {
    if (x.age <= ageIn2027) current = x;
  }

  let lunar;
  try {
    const l = solarToLunar(solar.year, solar.month, solar.day);
    lunar = { year: l.year, month: l.month, day: l.day, leap: l.isLeapMonth };
  } catch {
    lunar = { year: solar.year, month: solar.month, day: solar.day, leap: false };
  }

  const eight = [
    detail.yearString,
    detail.monthString,
    detail.dayString,
    timeUnknown ? '--' : detail.hourString,
  ].join('');
  const key = [eight, input.gender, current?.korean ?? 'none'].join('|');

  return {
    pillars,
    dayMaster,
    dayMasterElement: dmEl,
    elements,
    supportRatio,
    voidBranches: [...detail.voidBranches],
    luck: {
      forward: lp?.forward ?? true,
      startAge: lp?.startAge ?? 0,
      pillars: luckPillars,
      current,
    },
    solar,
    lunar,
    timeUnknown,
    gender: input.gender,
    ageBand: ageBandOf(solar.year),
    settings: {
      trueSolar: !timeUnknown && input.trueSolar,
      dayBoundary: input.dayBoundary,
    },
    key,
  };
}
