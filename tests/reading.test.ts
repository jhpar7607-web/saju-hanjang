// 풀이 엔진과 금지 표현 검사 시험
import { describe, expect, it } from 'vitest';
import { computeChart } from '@/lib/saju/engine';
import { buildFreeReading, buildPaidReport } from '@/lib/saju/reading';
import { findForbidden, flatten, isSafe } from '@/lib/saju/safety';
import { extractJson, parseFree, parsePaid, chartForAi } from '@/lib/saju/ai';
import type { BirthInput } from '@/lib/saju/types';

const base: BirthInput = {
  year: 1990, month: 1, day: 1, hour: 12, minute: 0,
  calendar: 'solar', leap: false, gender: 'male', trueSolar: true, dayBoundary: 'midnight',
};

// 고정 규칙으로 만든 예시 사주 200건 (남녀, 시간 모름 포함)
function samples(n: number): BirthInput[] {
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  const out: BirthInput[] = [];
  for (let i = 0; i < n; i += 1) {
    const unknown = next() % 5 === 0;
    out.push({
      ...base,
      year: 1935 + (next() % 90),
      month: 1 + (next() % 12),
      day: 1 + (next() % 28),
      hour: unknown ? null : next() % 24,
      minute: unknown ? null : next() % 60,
      gender: next() % 2 ? 'male' : 'female',
    });
  }
  return out;
}

describe('규칙 기반 풀이', () => {
  const list = samples(200);

  it('예시 사주 200건 모두 금지 표현 없이 풀이가 나온다', () => {
    const masters = new Set<string>();
    for (const input of list) {
      const chart = computeChart(input);
      masters.add(chart.dayMaster);
      const free = buildFreeReading(chart);
      const paid = buildPaidReport(chart);
      expect(isSafe(free).hits, JSON.stringify(input)).toEqual([]);
      expect(isSafe(paid).hits, JSON.stringify(input)).toEqual([]);
      expect(flatten(free)).not.toMatch(/undefined|null|NaN/);
      expect(flatten(paid)).not.toMatch(/undefined|null|NaN/);
    }
    // 일간 10가지가 모두 나왔는지 확인
    expect(masters.size).toBe(10);
  });

  it('무료 풀이는 정해진 모양을 가진다', () => {
    const r = buildFreeReading(computeChart({ ...base, year: 1992, month: 10, day: 24, hour: 5, minute: 30 }));
    expect(r.keywords).toHaveLength(3);
    expect(r.personality.length).toBeGreaterThan(150);
    expect(r.yearSummary).toContain('정미년');
    expect(r.personality).toContain('계');
  });

  it('유료 리포트는 목차 8개와 12개월을 가진다', () => {
    const r = buildPaidReport(computeChart({ ...base, year: 1985, month: 3, day: 9, hour: 22, minute: 10, gender: 'female' }));
    expect(r.sections.map((s) => s.id)).toEqual(['total', 'nature', 'money', 'work', 'love', 'health', 'months', 'guide']);
    expect(r.months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(r.months[1].pillar).toBe('임인');
    expect(r.actions).toHaveLength(3);
    expect(new Set(r.actions).size).toBe(3);
    for (const m of r.goodMonths) expect(r.cautionMonths).not.toContain(m);
  });

  it('같은 사주에는 같은 글이 나온다', () => {
    const a = buildPaidReport(computeChart({ ...base, year: 1977, month: 8, day: 15, hour: 9, minute: 0 }));
    const b = buildPaidReport(computeChart({ ...base, year: 1977, month: 8, day: 15, hour: 9, minute: 0 }));
    expect(a).toEqual(b);
  });

  it('시간을 모르면 그 사실을 알린다', () => {
    const r = buildFreeReading(computeChart({ ...base, hour: null, minute: null }));
    expect(r.personality).toContain('태어난 시간을 몰라');
  });
});

describe('금지 표현 검사', () => {
  it('문제 문장 30개를 모두 걸러낸다', () => {
    const bad = [
      '올해 죽음의 기운이 있습니다', '사망할 수 있습니다', '단명할 사주입니다', '죽을 고비가 옵니다',
      '큰 사고를 조심하세요', '교통사고가 납니다', '수술을 받게 됩니다', '대형 사고가 보입니다',
      '이혼하게 됩니다', '파산할 운입니다', '사업이 부도납니다', '올해는 망한다', '망하게 됩니다',
      '암에 걸립니다', '우울증이 옵니다', '당뇨를 조심하세요', '고혈압 진단을 받습니다', '뇌졸중 위험',
      '이 주식 종목을 사세요', '종목 추천드립니다', '코인에 투자하세요', '로또 번호는 이것', '대박이 납니다',
      '반드시 성공합니다', '절대로 안 됩니다', '틀림없이 합격합니다', '100% 이루어집니다',
      '재앙이 닥칩니다', '횡액이 있습니다', '급살을 맞습니다',
    ];
    expect(bad).toHaveLength(30);
    for (const s of bad) expect(findForbidden(s).length, s).toBeGreaterThan(0);
  });

  it('평범한 문장은 통과한다', () => {
    const good = [
      '꾸준히 한 일이 결과로 이어지기 쉬운 때입니다.',
      '지출이 늘기 쉬우니 한 번 더 살펴보세요.',
      '쉬는 날을 일정에 먼저 넣어 두세요.',
      '암기 과목을 공부하기 좋습니다.',
    ];
    for (const s of good) expect(findForbidden(s), s).toEqual([]);
  });
});

describe('AI 답 처리', () => {
  it('글 사이에 섞인 JSON 을 꺼낸다', () => {
    expect(extractJson('설명 {"a":1} 끝')).toEqual({ a: 1 });
    expect(extractJson('JSON 없음')).toBeNull();
    expect(extractJson('{깨진')).toBeNull();
  });

  it('형식이 틀린 무료 풀이는 버린다', () => {
    expect(parseFree({ personalityTitle: '제목' })).toBeNull();
    const okFree = {
      personalityTitle: '큰 나무 같은 사람',
      personality: '가'.repeat(100),
      yearLine: '차분히 쌓는 해',
      yearSummary: '나'.repeat(100),
      keywords: ['하나', '둘', '셋'],
    };
    expect(parseFree(okFree)?.source).toBe('ai');
    expect(parseFree({ ...okFree, keywords: ['하나'] })).toBeNull();
  });

  it('형식이 틀린 유료 리포트는 버린다', () => {
    const ids = ['total', 'nature', 'money', 'work', 'love', 'health', 'months', 'guide'];
    const good = {
      sections: ids.map((id) => ({ id, title: '제목', body: '다'.repeat(40) })),
      months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, pillar: '갑자', body: '라'.repeat(30) })),
      goodMonths: [3, 6], cautionMonths: [8], actions: ['실천 하나입니다', '실천 둘입니다', '실천 셋입니다'],
    };
    const parsed = parsePaid(good);
    expect(parsed?.months[1].pillar).toBe('임인'); // 월주는 AI 답이 아니라 우리 값으로 고정
    expect(parsePaid({ ...good, months: good.months.slice(0, 11) })).toBeNull();
    expect(parsePaid({ ...good, goodMonths: [13] })).toBeNull();
    expect(parsePaid({ ...good, sections: good.sections.slice().reverse() })).toBeNull();
  });

  it('AI 에 넘기는 값에는 생년월일과 이름이 없다', () => {
    const chart = computeChart({ ...base, year: 1992, month: 10, day: 24, hour: 5, minute: 30 });
    const text = JSON.stringify(chartForAi(chart));
    expect(text).not.toContain('1992');
    expect(text).not.toMatch(/"year"|"month"|"day"|이름/);
    expect(text).toContain('30대');
  });
});
