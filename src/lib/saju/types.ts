// 사주한장 공통 자료형 모음

export type Element = '목' | '화' | '토' | '금' | '수';
export type TenGod =
  | '비견' | '겁재' | '식신' | '상관' | '편재'
  | '정재' | '편관' | '정관' | '편인' | '정인';
export type Gender = 'male' | 'female';
export type DayBoundary = 'midnight' | 'jasi' | 'splitJasi';

/** 사용자가 입력하는 값 */
export interface BirthInput {
  year: number;
  month: number;
  day: number;
  /** 태어난 시간을 모르면 null */
  hour: number | null;
  minute: number | null;
  calendar: 'solar' | 'lunar';
  /** 음력 윤달 여부 */
  leap: boolean;
  gender: Gender;
  /** 진태양시 보정 적용 여부 */
  trueSolar: boolean;
  /** 밤 11시대 출생의 날짜 기준 */
  dayBoundary: DayBoundary;
}

/** 사주의 한 기둥 */
export interface PillarView {
  stem: string;
  branch: string;
  stemHanja: string;
  branchHanja: string;
  stemElement: Element;
  branchElement: Element;
  stemYinYang: '양' | '음';
  branchYinYang: '양' | '음';
  /** 일간 기준 십신. 일간 자신은 '일간' */
  stemGod: TenGod | '일간';
  branchGod: TenGod;
}

export interface LuckView {
  /** 순행이면 true */
  forward: boolean;
  startAge: number;
  pillars: { age: number; korean: string }[];
  /** 2027년 기준으로 지나고 있는 대운 (없으면 null) */
  current: { age: number; korean: string } | null;
}

/** 계산 결과 전체 */
export interface Chart {
  pillars: {
    year: PillarView;
    month: PillarView;
    day: PillarView;
    hour: PillarView | null;
  };
  /** 일간(나를 뜻하는 글자) */
  dayMaster: string;
  dayMasterElement: Element;
  /** 여덟 글자(시간 모름이면 여섯 글자)의 오행 개수 */
  elements: Record<Element, number>;
  /** 일간을 돕는 기운의 비율 (0~1) */
  supportRatio: number;
  voidBranches: string[];
  luck: LuckView;
  solar: { year: number; month: number; day: number };
  lunar: { year: number; month: number; day: number; leap: boolean };
  timeUnknown: boolean;
  gender: Gender;
  ageBand: string;
  settings: { trueSolar: boolean; dayBoundary: DayBoundary };
  /** 같은 사주인지 가리는 열쇠 (풀이 글 재사용에 쓴다) */
  key: string;
}

/** 무료 풀이 */
export interface FreeReading {
  kind: 'free';
  source: 'ai' | 'rule';
  personalityTitle: string;
  personality: string;
  yearLine: string;
  yearSummary: string;
  keywords: string[];
}

/** 유료 리포트 */
export interface PaidReport {
  kind: 'paid';
  source: 'ai' | 'rule';
  sections: { id: string; title: string; body: string }[];
  months: { month: number; pillar: string; body: string }[];
  goodMonths: number[];
  cautionMonths: number[];
  actions: string[];
}

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}
