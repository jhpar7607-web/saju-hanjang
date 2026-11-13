// A1. 사주 계산
import { computeChart, validateInput } from '@/lib/saju/engine';
import { fail, ok, readJson, toResponse } from '@/lib/http';
import { allow, clientIp } from '@/lib/ratelimit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!allow(`chart:${clientIp(req)}`, 3000, 60 * 60 * 1000)) {
    return fail('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429);
  }
  const body = await readJson(req);
  if (!body) return fail('입력값을 읽지 못했습니다.');
  try {
    const input = validateInput(body);
    return ok({ input, chart: computeChart(input) });
  } catch (e) {
    return toResponse(e);
  }
}
