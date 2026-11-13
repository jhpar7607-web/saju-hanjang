// A5. 유료 리포트 조회 (전용 주소 값을 아는 사람만 볼 수 있다)
import { fail, ok, toResponse } from '@/lib/http';
import { allow, clientIp } from '@/lib/ratelimit';
import { getStore } from '@/lib/store';
import { computeChart } from '@/lib/saju/engine';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!allow(`report:${clientIp(req)}`, 1200, 60 * 60 * 1000)) {
    return fail('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429);
  }
  const { token } = await ctx.params;
  if (!/^[0-9a-f]{64}$/.test(token)) return fail('리포트를 찾을 수 없습니다.', 404);
  try {
    const order = await getStore().getOrderByToken(token);
    if (!order || order.status !== 'paid' || !order.report) {
      return fail('리포트를 찾을 수 없습니다.', 404);
    }
    return ok({
      chart: computeChart(order.input),
      report: order.report,
      orderId: order.id,
      paidAt: order.paidAt,
    });
  } catch (e) {
    return toResponse(e);
  }
}
