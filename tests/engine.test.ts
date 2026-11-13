// 사주 계산 엔진 대조 시험
// 1) 한국천문연구원 월력요항(2027)과 공개 달력에서 확인한 값
// 2) 라이브러리 설명서의 예시 값
// 3) 두 번째 프로그램(lunar-javascript)과의 교차 검증 120건
import { describe, expect, it } from 'vitest';
import { Solar } from 'lunar-javascript';
import { computeChart, validateInput, toSolar } from '@/lib/saju/engine';
import type { BirthInput } from '@/lib/saju/types';

const base: BirthInput = {
  year: 1990, month: 1, day: 1, hour: 12, minute: 0,
  calendar: 'solar', leap: false, gender: 'male',
  trueSolar: false, dayBoundary: 'midnight',
};
const mk = (o: Partial<BirthInput>): BirthInput => ({ ...base, ...o });
const gz = (p: { stem: string; branch: string }) => p.stem + p.branch;

describe('한국천문연구원 2027년 자료 대조', () => {
  // 음력 매달 1일의 양력 날짜와 일진 (월력요항 2027)
  const rows: [number, number, number, string][] = [
    [1, 2, 7, '정사'], [2, 3, 8, '병술'], [3, 4, 7, '병진'], [4, 5, 6, '을유'],
    [5, 6, 5, '을묘'], [6, 7, 4, '갑신'], [7, 8, 2, '계축'], [8, 9, 1, '계미'],
    [9, 9, 30, '임자'], [10, 10, 29, '신사'], [11, 11, 28, '신해'],
  ];
  for (const [lm, sm, sd, iljin] of rows) {
    it(`음력 2027년 ${lm}월 1일 = 양력 ${sm}월 ${sd}일, 일진 ${iljin}`, () => {
      // 범위 검사를 피하려고 계산 함수만 직접 부른다.
      const input = mk({ year: 2027, month: lm, day: 1, calendar: 'lunar' });
      const solar = toSolar(input);
      expect([solar.year, solar.month, solar.day]).toEqual([2027, sm, sd]);
      const c = computeChart(input);
      expect(gz(c.pillars.day)).toBe(iljin);
    });
  }

  it('2027년 2월 15일: 세차 정미, 월건 임인, 일진 을축', () => {
    const c = computeChart(mk({ year: 2027, month: 2, day: 15 }));
    expect(gz(c.pillars.year)).toBe('정미');
    expect(gz(c.pillars.month)).toBe('임인');
    expect(gz(c.pillars.day)).toBe('을축');
  });

  it('입춘(2027년 2월 4일) 전날은 병오년, 다음 날은 정미년', () => {
    expect(gz(computeChart(mk({ year: 2027, month: 2, day: 3 })).pillars.year)).toBe('병오');
    expect(gz(computeChart(mk({ year: 2027, month: 2, day: 5 })).pillars.year)).toBe('정미');
    expect(gz(computeChart(mk({ year: 2027, month: 2, day: 4 })).pillars.day)).toBe('갑인');
  });
});

describe('라이브러리 설명서 예시', () => {
  it('1992년 10월 24일 05:30 = 임신 경술 계유 을묘', () => {
    const c = computeChart(mk({ year: 1992, month: 10, day: 24, hour: 5, minute: 30 }));
    expect([c.pillars.year, c.pillars.month, c.pillars.day, c.pillars.hour!].map(gz))
      .toEqual(['임신', '경술', '계유', '을묘']);
  });

  it('음력 1992년 9월 29일은 같은 결과', () => {
    const c = computeChart(mk({ year: 1992, month: 9, day: 29, hour: 5, minute: 30, calendar: 'lunar' }));
    expect(gz(c.pillars.day)).toBe('계유');
    expect(c.solar).toEqual({ year: 1992, month: 10, day: 24 });
  });

  it('윤달: 음력 2020년 윤4월 1일 = 양력 5월 23일', () => {
    expect(toSolar(mk({ year: 2020, month: 4, day: 1, calendar: 'lunar', leap: true })))
      .toEqual({ year: 2020, month: 5, day: 23 });
  });

  it('밤 11시 30분 출생의 세 가지 기준', () => {
    const t = { year: 2024, month: 3, day: 10, hour: 23, minute: 30 };
    const a = computeChart(mk({ ...t, dayBoundary: 'midnight' }));
    const b = computeChart(mk({ ...t, dayBoundary: 'jasi' }));
    const s = computeChart(mk({ ...t, dayBoundary: 'splitJasi' }));
    expect([gz(a.pillars.day), gz(a.pillars.hour!)]).toEqual(['계유', '임자']);
    expect([gz(b.pillars.day), gz(b.pillars.hour!)]).toEqual(['갑술', '갑자']);
    expect([gz(s.pillars.day), gz(s.pillars.hour!)]).toEqual(['계유', '갑자']);
  });

  it('진태양시 보정: 1990년 5월 15일 07:05 는 묘시', () => {
    const on = computeChart(mk({ year: 1990, month: 5, day: 15, hour: 7, minute: 5, trueSolar: true }));
    const off = computeChart(mk({ year: 1990, month: 5, day: 15, hour: 7, minute: 5, trueSolar: false }));
    expect(on.pillars.hour!.branch).toBe('묘');
    expect(off.pillars.hour!.branch).toBe('진');
  });
});

describe('두 번째 프로그램과 교차 검증 120건', () => {
  // 절기가 바뀌는 날(매달 4~8일쯤)은 한국·중국 표준시 차이로 결과가 갈릴 수 있어
  // 10~28일 한낮으로 고른다. 날짜는 고정된 규칙으로 만들어 매번 같은 120건을 쓴다.
  let seed = 20261113;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed;
  };
  const cases: [number, number, number][] = [];
  while (cases.length < 120) {
    cases.push([1930 + (next() % 97), 1 + (next() % 12), 10 + (next() % 19)]);
  }
  const H: Record<string, string> = {
    甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
    子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
  };
  const ko = (s: string) => [...s].map((ch) => H[ch]).join('');

  it('연주, 월주, 일주, 시주가 모두 같다', () => {
    let checked = 0;
    for (const [y, m, d] of cases) {
      const ours = computeChart(mk({ year: y, month: m, day: d }));
      const ec = Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar().getEightChar();
      expect(gz(ours.pillars.year), `${y}-${m}-${d} 연주`).toBe(ko(ec.getYear()));
      expect(gz(ours.pillars.month), `${y}-${m}-${d} 월주`).toBe(ko(ec.getMonth()));
      expect(gz(ours.pillars.day), `${y}-${m}-${d} 일주`).toBe(ko(ec.getDay()));
      expect(gz(ours.pillars.hour!), `${y}-${m}-${d} 시주`).toBe(ko(ec.getTime()));
      checked += 1;
    }
    expect(checked).toBe(120);
  });
});

describe('입력 검사와 부가 계산', () => {
  it('없는 날짜는 거부한다', () => {
    expect(() => validateInput({ year: 1991, month: 2, day: 30, gender: 'male' })).toThrow();
    expect(() => validateInput({ year: 1800, month: 1, day: 1, gender: 'male' })).toThrow();
    expect(() => validateInput({ year: 1991, month: 13, day: 1, gender: 'male' })).toThrow();
    expect(() => validateInput({ year: 1991, month: 5, day: 1 })).toThrow();
    expect(() => validateInput({ year: 1991, month: 5, day: 1, gender: 'female', hour: 24 })).toThrow();
    expect(() => validateInput({ year: 2021, month: 4, day: 1, gender: 'female', calendar: 'lunar', leap: true })).toThrow();
  });

  it('시간을 모르면 시주 없이 여섯 글자만 센다', () => {
    const c = computeChart(mk({ year: 1988, month: 7, day: 20, hour: null, minute: null }));
    expect(c.pillars.hour).toBeNull();
    expect(c.timeUnknown).toBe(true);
    expect(Object.values(c.elements).reduce((a, b) => a + b, 0)).toBe(6);
    expect(c.settings.trueSolar).toBe(false);
  });

  it('오행 개수의 합은 여덟이고 대운이 나온다', () => {
    const c = computeChart(mk({ year: 1992, month: 10, day: 24, hour: 5, minute: 30 }));
    expect(Object.values(c.elements).reduce((a, b) => a + b, 0)).toBe(8);
    expect(c.luck.startAge).toBe(5);
    expect(c.luck.pillars[0].korean).toBe('신해');
    expect(c.luck.current?.korean).toBe('갑인');
    expect(c.ageBand).toBe('30대');
    expect(c.key).toContain('임신경술계유을묘|male|갑인');
  });

  it('같은 사주는 같은 열쇠를 가진다', () => {
    const a = computeChart(mk({ year: 1992, month: 10, day: 24, hour: 5, minute: 30 }));
    const b = computeChart(mk({ year: 1992, month: 10, day: 24, hour: 6, minute: 10 }));
    expect(a.key).toBe(b.key);
  });
});
