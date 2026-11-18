// 화면에서 쓰는 계산·풀이 창구
// 서버가 있는 배포에서는 서버에 요청하고, 정적 배포(깃허브 무료 주소, 안드로이드 앱 1.0)에서는
// 같은 계산 프로그램을 휴대폰 안에서 직접 돌린다. 정적 배포에서는 생년월일이 휴대폰 밖으로 나가지 않는다.

import type { BirthInput, Chart, FreeReading } from './saju/types';
import type { DetailReport } from './saju/detail';
import { deviceId, postJson } from './client';

/** 정적 배포인지 여부 (빌드할 때 정해진다) */
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC === '1';

export interface ReadingResult {
  chart: Chart;
  reading: FreeReading;
  price: { amount: number; regular: number; promo: boolean; promoEnd: string };
  canPay: boolean;
}

/** 입력이 계산 가능한지 확인한다. 문제가 있으면 쉬운 말의 오류를 던진다. */
export async function checkInput(input: BirthInput): Promise<void> {
  if (IS_STATIC) {
    const { validateInput, computeChart } = await import('./saju/engine');
    computeChart(validateInput(input));
    return;
  }
  await postJson('/api/chart', input);
}

/** 사주 계산과 무료 풀이를 가져온다. */
export async function getReading(input: BirthInput): Promise<ReadingResult> {
  if (IS_STATIC) {
    const [{ validateInput, computeChart }, { buildFreeReading }] = await Promise.all([
      import('./saju/engine'),
      import('./saju/reading'),
    ]);
    const chart = computeChart(validateInput(input));
    return {
      chart,
      reading: buildFreeReading(chart),
      price: { amount: 0, regular: 0, promo: false, promoEnd: '' },
      canPay: false,
    };
  }
  return postJson<ReadingResult>('/api/reading', { ...input, device: deviceId() });
}

/**
 * 자세한 풀이(주제별 운, 시기별 운)를 만든다.
 * 계산 규칙만 쓰므로 어느 배포에서든 휴대폰 안에서 만든다. 생년월일은 밖으로 나가지 않는다.
 */
export async function getDetail(input: BirthInput): Promise<{ chart: Chart; detail: DetailReport }> {
  const [{ validateInput, computeChart }, { buildDetail }] = await Promise.all([
    import('./saju/engine'),
    import('./saju/detail'),
  ]);
  const chart = computeChart(validateInput(input));
  return { chart, detail: buildDetail(chart) };
}
