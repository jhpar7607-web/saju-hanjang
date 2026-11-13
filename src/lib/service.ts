// 풀이 서비스: 저장된 글 찾기 → AI → 규칙 기반 순서로 풀이를 마련한다.

import { config } from './config';
import { getStore } from './store';
import type { Chart, FreeReading, PaidReport } from './saju/types';
import { aiFreeReading, aiPaidReport } from './saju/ai';
import { buildFreeReading, buildPaidReport } from './saju/reading';

function cacheKey(chart: Chart, product: 'free' | 'paid'): string {
  return `${product}|${config.promptVersion}|${chart.key}`;
}

/** 무료 풀이를 돌려준다. 같은 사주면 저장된 글을 다시 쓴다. */
export async function getFreeReading(chart: Chart): Promise<FreeReading> {
  const store = getStore();
  const key = cacheKey(chart, 'free');
  try {
    const saved = (await store.getReading(key)) as FreeReading | null;
    if (saved && saved.kind === 'free') return saved;
  } catch {
    // 저장소가 잠시 안 되어도 풀이는 계속 만든다.
  }
  const ai = await aiFreeReading(chart);
  const reading = ai ?? buildFreeReading(chart);
  // AI 가 쓴 글만 저장한다. 규칙 기반 글은 매번 바로 만들 수 있고,
  // 저장해 두면 나중에 AI 가 켜졌을 때 AI 글로 바뀌지 않기 때문이다.
  if (ai) {
    try {
      await store.putReading(key, reading, config.ai.modelFree);
    } catch {
      // 저장 실패는 무시한다.
    }
  }
  return reading;
}

/** 유료 리포트를 만든다. 실패하면 예외를 던진다. */
export async function makePaidReport(chart: Chart): Promise<PaidReport> {
  const store = getStore();
  const key = cacheKey(chart, 'paid');
  try {
    const saved = (await store.getReading(key)) as PaidReport | null;
    if (saved && saved.kind === 'paid') return saved;
  } catch {
    // 무시
  }
  const ai = await aiPaidReport(chart);
  const report = ai ?? buildPaidReport(chart);
  if (ai) {
    try {
      await store.putReading(key, report, config.ai.modelPaid);
    } catch {
      // 무시
    }
  }
  return report;
}
