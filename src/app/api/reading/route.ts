// A2. 무료 풀이 (저장된 글이 있으면 다시 쓴다)
import { computeChart, validateInput } from '@/lib/saju/engine';
import { fail, ok, readJson, toResponse } from '@/lib/http';
import { allow, clientIp } from '@/lib/ratelimit';
import { getFreeReading } from '@/lib/service';
import { buildFreeReading } from '@/lib/saju/reading';
import { currentPrice, mockPaymentAllowed, paymentReady } from '@/lib/config';

export const runtime = 'nodejs';

const DAY = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const ip = clientIp(req);
  // 통신사나 회사처럼 여러 사람이 같은 주소를 쓰는 경우가 있어 주소 기준 제한은 넉넉히 둔다.
  if (!allow(`reading:${ip}`, 3000, 60 * 60 * 1000)) {
    return fail('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429);
  }
  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body) return fail('입력값을 읽지 못했습니다.');
  try {
    const input = validateInput(body);
    const chart = computeChart(input);
    // 같은 기기는 하루 5번까지만 AI 풀이를 쓰고, 그 뒤로는 규칙 기반 풀이를 준다.
    const device = typeof body.device === 'string' ? body.device.slice(0, 64) : ip;
    const reading = allow(`ai:${device}`, 5, DAY)
      ? await getFreeReading(chart)
      : buildFreeReading(chart);
    const price = currentPrice();
    return ok({
      chart,
      reading,
      price,
      canPay: paymentReady() || mockPaymentAllowed(),
    });
  } catch (e) {
    return toResponse(e);
  }
}
