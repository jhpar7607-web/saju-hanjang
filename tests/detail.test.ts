// 자세한 풀이(1.1) 시험: 대량 금지 표현 검사, 같은 사주 같은 글, 대운·세운 십신 대조
import { describe, expect, it } from 'vitest';
import { getBranchTenGod, getTenGod } from 'manseryeok';
import { computeChart } from '@/lib/saju/engine';
import { buildDetail, flattenDetail, groupCounts, YEARS_5 } from '@/lib/saju/detail';
import { findForbidden } from '@/lib/saju/safety';
import type { BirthInput } from '@/lib/saju/types';

const base: BirthInput = {
  year: 1990, month: 1, day: 1, hour: 12, minute: 0,
  calendar: 'solar', leap: false, gender: 'male', trueSolar: true, dayBoundary: 'midnight',
};

function samples(n: number): BirthInput[] {
  let seed = 20261118;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  const out: BirthInput[] = [];
  for (let i = 0; i < n; i += 1) {
    const unknown = next() % 5 === 0;
    out.push({
      ...base,
      year: 1930 + (next() % 97),
      month: 1 + (next() % 12),
      day: 1 + (next() % 28),
      hour: unknown ? null : next() % 24,
      minute: unknown ? null : next() % 60,
      gender: next() % 2 ? 'male' : 'female',
    });
  }
  return out;
}

const IDS = ['money', 'career', 'love', 'health', 'study', 'people', 'family', 'year1', 'year5', 'decade', 'life'];

describe('자세한 풀이', () => {
  it('무작위 사주 1,000건: 항목 11개, 빈 문장 없음, 금지 표현 0건', () => {
    const hits: string[] = [];
    for (const input of samples(1000)) {
      const d = buildDetail(computeChart(input));
      expect(d.items.map((x) => x.id)).toEqual(IDS);
      for (const it of d.items) {
        expect(it.summary.length).toBeGreaterThan(5);
        expect(it.sections.length).toBeGreaterThan(0);
        for (const s of it.sections) expect(s.body.trim().length).toBeGreaterThan(10);
        for (const r of it.rows ?? []) expect(r.body.trim().length).toBeGreaterThan(5);
      }
      const text = flattenDetail(d);
      expect(text).not.toMatch(/undefined|null|NaN|\[object/);
      const f = findForbidden(text);
      if (f.length) hits.push(`${JSON.stringify(input)} ${f.join(',')}`);
    }
    expect(hits).toEqual([]);
  });

  it('같은 사주는 두 번 계산해도 같은 글이 나온다', () => {
    for (const input of samples(30)) {
      expect(flattenDetail(buildDetail(computeChart(input)))).toBe(flattenDetail(buildDetail(computeChart(input))));
    }
  });

  it('시간을 모르면 노년운과 자녀 줄에 안내가 붙는다', () => {
    const d = buildDetail(computeChart({ ...base, hour: null, minute: null }));
    const life = d.items.find((x) => x.id === 'life')!;
    expect(life.rows!.length).toBe(4);
    expect(life.rows![3].body).toContain('태어난 시간을 몰라');
    const family = d.items.find((x) => x.id === 'family')!;
    expect(family.sections.find((s) => s.title === '자녀와 후배')!.body).toContain('태어난 시간을 몰라');
  });

  it('5년운 해별 간지와 십신이 직접 계산한 값과 같다 (1990-01-01 12시 남)', () => {
    const chart = computeChart(base);
    expect(YEARS_5.map((y) => y.stem + y.branch)).toEqual(['정미', '무신', '기유', '경술', '신해']);
    const d = buildDetail(chart);
    const rows = d.items.find((x) => x.id === 'year5')!.rows!;
    YEARS_5.forEach((y, i) => {
      const sg = getTenGod(chart.dayMaster as never, y.stem as never);
      expect(rows[i].sub).toContain(String(sg));
      expect(rows[i].sub).toContain(`${y.year - 1990}세`);
    });
  });

  it('대운 지도는 계산된 대운과 같은 순서, 같은 나이로 나온다', () => {
    for (const input of samples(20)) {
      const chart = computeChart(input);
      const rows = buildDetail(chart).items.find((x) => x.id === 'decade')!.rows!;
      expect(rows.length).toBe(chart.luck.pillars.length);
      rows.forEach((r, i) => {
        const p = chart.luck.pillars[i];
        expect(r.label).toBe(`${p.age}~${p.age + 9}세`);
        expect(r.sub).toContain(p.korean);
        expect(r.sub).toContain(String(getTenGod(chart.dayMaster as never, p.korean[0] as never)));
      });
      // 2027년에 지나는 대운이 '지금'으로 표시된다
      if (chart.luck.current) {
        const now = rows.find((r) => r.tag === '지금');
        expect(now?.sub).toContain(chart.luck.current.korean);
      }
    }
  });

  it('십신 묶음 개수는 일간을 뺀 글자 수와 같다', () => {
    for (const input of samples(50)) {
      const chart = computeChart(input);
      const total = Object.values(groupCounts(chart)).reduce((a, b) => a + b, 0);
      expect(total).toBe(chart.timeUnknown ? 5 : 7);
      // 일지 십신이 맞는지 직접 대조
      expect(chart.pillars.day.branchGod).toBe(getBranchTenGod(chart.dayMaster as never, chart.pillars.day.branch as never));
    }
  });
});
