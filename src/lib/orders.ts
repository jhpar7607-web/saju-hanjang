// 주문과 결제
// 금액은 서버가 정하고, 결제 승인은 결제사에 직접 확인한 뒤에만 완료로 바꾼다.

import { randomBytes } from 'node:crypto';
import { config, currentPrice, mockPaymentAllowed, paymentReady } from './config';
import { getStore, type Order } from './store';
import { computeChart } from './saju/engine';
import type { BirthInput } from './saju/types';
import { makePaidReport } from './service';

export class OrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'OrderError';
  }
}

function newOrderId(): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(2, 10).replace(/-/g, '');
  return `SJ${d}-${randomBytes(6).toString('hex')}`;
}

/** 주문을 만든다. 금액은 지금 적용되는 가격으로 서버가 정한다. */
export async function createOrder(input: BirthInput): Promise<Order> {
  if (!paymentReady() && !mockPaymentAllowed()) {
    throw new OrderError('결제 준비 중입니다. 잠시 후 다시 이용해 주세요.', 503);
  }
  // 계산이 되는 입력인지 먼저 확인한다.
  computeChart(input);
  const order: Order = {
    id: newOrderId(),
    token: randomBytes(32).toString('hex'),
    input,
    amount: currentPrice().amount,
    status: 'pending',
    paymentKey: null,
    report: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
  };
  await getStore().createOrder(order);
  return order;
}

function tossAuth(): string {
  return 'Basic ' + Buffer.from(`${config.toss.secretKey}:`).toString('base64');
}

async function tossConfirm(paymentKey: string, orderId: string, amount: number): Promise<void> {
  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: tossAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  if (!res.ok) {
    let message = '결제 승인에 실패했습니다.';
    try {
      const data = (await res.json()) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      // 결제사 응답을 읽지 못해도 기본 안내를 쓴다.
    }
    throw new OrderError(message, 402);
  }
}

async function tossCancel(paymentKey: string, reason: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: tossAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason: reason }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** 같은 주문의 승인이 동시에 두 번 들어오는 것을 막는다. */
const inFlight = new Map<string, Promise<{ token: string }>>();

/**
 * 결제 승인 확인 후 유료 리포트를 만든다.
 * - 화면이 보낸 금액이 주문 금액과 다르면 거부한다.
 * - 리포트 생성이 실패하면 2회 다시 시도하고, 그래도 안 되면 결제를 취소한다.
 */
export function confirmOrder(
  orderId: string,
  paymentKey: string,
  amount: number,
): Promise<{ token: string }> {
  const running = inFlight.get(orderId);
  if (running) return running;
  const job = doConfirm(orderId, paymentKey, amount).finally(() => inFlight.delete(orderId));
  inFlight.set(orderId, job);
  return job;
}

async function doConfirm(
  orderId: string,
  paymentKey: string,
  amount: number,
): Promise<{ token: string }> {
  const store = getStore();
  const order = await store.getOrder(orderId);
  if (!order) throw new OrderError('주문을 찾을 수 없습니다.', 404);
  if (order.status === 'paid' && order.report) return { token: order.token };
  if (order.status !== 'pending') throw new OrderError('이미 처리된 주문입니다.', 409);
  if (!Number.isInteger(amount) || amount !== order.amount) {
    throw new OrderError('결제 금액이 주문 금액과 다릅니다.', 400);
  }

  const mock = paymentKey.startsWith('mock_');
  if (mock) {
    if (!mockPaymentAllowed()) throw new OrderError('결제 준비 중입니다.', 503);
  } else {
    if (!paymentReady()) throw new OrderError('결제 준비 중입니다.', 503);
    await tossConfirm(paymentKey, orderId, order.amount);
  }
  // 승인된 결제 번호를 먼저 적어 둔다. 이후 단계에서 서버가 멈춰도 추적할 수 있다.
  await store.updateOrder(orderId, { paymentKey });

  const chart = computeChart(order.input);
  let report = null;
  for (let attempt = 0; attempt < 3 && !report; attempt += 1) {
    try {
      report = await makePaidReport(chart);
    } catch {
      report = null;
    }
  }

  if (!report) {
    const cancelled = mock ? true : await tossCancel(paymentKey, '리포트 생성 실패로 자동 취소');
    await store.updateOrder(orderId, {
      status: cancelled ? 'refunded' : 'failed',
      paymentKey,
    });
    throw new OrderError(
      cancelled
        ? '리포트를 만들지 못해 결제를 취소했습니다. 잠시 후 다시 시도해 주세요.'
        : '리포트를 만들지 못했습니다. 문의처로 주문 번호를 알려 주시면 바로 처리해 드립니다.',
      500,
    );
  }

  await store.updateOrder(orderId, {
    status: 'paid',
    paymentKey,
    report,
    paidAt: new Date().toISOString(),
  });
  return { token: order.token };
}
