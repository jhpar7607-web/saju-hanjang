// A3. 주문 만들기 (금액은 서버가 정한다)
import { validateInput } from '@/lib/saju/engine';
import { fail, ok, readJson, toResponse } from '@/lib/http';
import { allow, clientIp } from '@/lib/ratelimit';
import { createOrder } from '@/lib/orders';
import { config, currentPrice, mockPaymentAllowed, paymentReady } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!allow(`orders:${clientIp(req)}`, 200, 60 * 60 * 1000)) {
    return fail('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429);
  }
  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body) return fail('입력값을 읽지 못했습니다.');
  if (body.agree !== true) {
    return fail('이용약관과 개인정보 수집에 동의해 주세요.');
  }
  try {
    const input = validateInput(body.input);
    const order = await createOrder(input);
    return ok({
      orderId: order.id,
      amount: order.amount,
      orderName: config.productName,
      clientKey: config.toss.clientKey,
      mock: mockPaymentAllowed(),
    });
  } catch (e) {
    return toResponse(e);
  }
}

/** 결제 화면에 보여 줄 가격 정보 */
export async function GET() {
  return ok({
    price: currentPrice(),
    productName: config.productName,
    canPay: paymentReady() || mockPaymentAllowed(),
    mock: mockPaymentAllowed(),
  });
}
