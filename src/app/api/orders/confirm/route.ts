// A4. 결제 승인 확인과 유료 리포트 생성
import { fail, ok, readJson, toResponse } from '@/lib/http';
import { allow, clientIp } from '@/lib/ratelimit';
import { confirmOrder } from '@/lib/orders';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!allow(`confirm:${clientIp(req)}`, 300, 60 * 60 * 1000)) {
    return fail('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429);
  }
  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body) return fail('입력값을 읽지 못했습니다.');
  const { orderId, paymentKey, amount } = body;
  if (typeof orderId !== 'string' || typeof paymentKey !== 'string' || paymentKey.length > 300) {
    return fail('결제 정보가 올바르지 않습니다.');
  }
  try {
    const result = await confirmOrder(orderId, paymentKey, Number(amount));
    try {
      await getStore().addEvent({
        type: 'purchase_done', device: 'server', meta: { orderId }, at: new Date().toISOString(),
      });
    } catch {
      // 기록 실패는 결제 결과에 영향을 주지 않는다.
    }
    return ok(result);
  } catch (e) {
    return toResponse(e);
  }
}
