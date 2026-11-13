// 가격, 주문과 결제, 저장소, 호출 제한 시험
import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BirthInput } from '@/lib/saju/types';

const input: BirthInput = {
  year: 1992, month: 10, day: 24, hour: 5, minute: 30,
  calendar: 'solar', leap: false, gender: 'male', trueSolar: true, dayBoundary: 'midnight',
};

beforeAll(() => {
  // 시험마다 새 임시 폴더를 저장소로 쓴다.
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'saju-test-'));
});

describe('가격', () => {
  it('오픈 기념 기간에는 기념가, 그 밖에는 정가', async () => {
    const { currentPrice } = await import('@/lib/config');
    // 한국 시각 2026-12-14 00:30 (UTC 12-13 15:30)
    expect(currentPrice(new Date('2026-12-13T15:30:00Z')).amount).toBe(2900);
    expect(currentPrice(new Date('2026-12-13T14:30:00Z')).amount).toBe(3900);
    // 한국 시각 2027-01-03 23:30 은 기념가, 2027-01-04 00:30 은 정가
    expect(currentPrice(new Date('2027-01-03T14:30:00Z')).amount).toBe(2900);
    expect(currentPrice(new Date('2027-01-03T15:30:00Z')).amount).toBe(3900);
    expect(currentPrice(new Date('2026-11-20T03:00:00Z')).promo).toBe(false);
  });
});

describe('주문과 결제 (모의 결제)', () => {
  it('주문을 만들고 승인하면 리포트가 저장된다', async () => {
    const { createOrder, confirmOrder } = await import('@/lib/orders');
    const { getStore } = await import('@/lib/store');
    const order = await createOrder(input);
    expect(order.status).toBe('pending');
    expect(order.token).toMatch(/^[0-9a-f]{64}$/);
    expect([2900, 3900]).toContain(order.amount);

    const done = await confirmOrder(order.id, `mock_${order.id}`, order.amount);
    expect(done.token).toBe(order.token);
    const saved = await getStore().getOrderByToken(order.token);
    expect(saved?.status).toBe('paid');
    expect(saved?.report?.sections).toHaveLength(8);

    // 같은 주문을 다시 승인해도 같은 리포트 주소를 돌려준다.
    const again = await confirmOrder(order.id, `mock_${order.id}`, order.amount);
    expect(again.token).toBe(order.token);
  });

  it('금액을 바꿔 보내면 거부한다', async () => {
    const { createOrder, confirmOrder } = await import('@/lib/orders');
    const { getStore } = await import('@/lib/store');
    const order = await createOrder(input);
    await expect(confirmOrder(order.id, `mock_${order.id}`, 100)).rejects.toThrow('금액');
    expect((await getStore().getOrder(order.id))?.status).toBe('pending');
  });

  it('없는 주문은 거부한다', async () => {
    const { confirmOrder } = await import('@/lib/orders');
    await expect(confirmOrder('SJ000000-none', 'mock_x', 3900)).rejects.toThrow('찾을 수 없습니다');
  });

  it('토스 열쇠 없이 실제 결제 번호가 오면 거부한다', async () => {
    const { createOrder, confirmOrder } = await import('@/lib/orders');
    const order = await createOrder(input);
    await expect(confirmOrder(order.id, 'real_payment_key', order.amount)).rejects.toThrow('준비 중');
  });

  it('동시에 두 번 승인해도 한 번만 처리된다', async () => {
    const { createOrder, confirmOrder } = await import('@/lib/orders');
    const order = await createOrder(input);
    const [a, b] = await Promise.all([
      confirmOrder(order.id, `mock_${order.id}`, order.amount),
      confirmOrder(order.id, `mock_${order.id}`, order.amount),
    ]);
    expect(a.token).toBe(b.token);
  });
});

describe('저장소와 이용 기록', () => {
  it('풀이 글을 저장하고 다시 읽는다', async () => {
    const { getStore } = await import('@/lib/store');
    const store = getStore();
    expect(await store.getReading('없는열쇠')).toBeNull();
    await store.putReading('열쇠1', { kind: 'free', text: '글' }, 'model');
    expect(await store.getReading('열쇠1')).toEqual({ kind: 'free', text: '글' });
  });

  it('이용 기록을 종류별로 센다', async () => {
    const { getStore } = await import('@/lib/store');
    const store = getStore();
    const since = new Date(Date.now() - 1000).toISOString();
    await Promise.all([
      store.addEvent({ type: 'share', device: 'd1', meta: {}, at: new Date().toISOString() }),
      store.addEvent({ type: 'share', device: 'd2', meta: {}, at: new Date().toISOString() }),
      store.addEvent({ type: 'visit', device: 'd1', meta: {}, at: new Date().toISOString() }),
    ]);
    expect(await store.countEvents('share', since)).toBe(2);
    expect(await store.countEvents('visit', since)).toBe(1);
  });
});

describe('호출 제한', () => {
  it('정해진 횟수를 넘으면 막고, 시간이 지나면 다시 연다', async () => {
    const { allow } = await import('@/lib/ratelimit');
    const t = 1_000_000;
    for (let i = 0; i < 5; i += 1) expect(allow('k', 5, 1000, t)).toBe(true);
    expect(allow('k', 5, 1000, t + 10)).toBe(false);
    expect(allow('k', 5, 1000, t + 1001)).toBe(true);
    expect(allow('다른열쇠', 5, 1000, t)).toBe(true);
  });
});

describe('무료 풀이 서비스', () => {
  it('AI 열쇠가 없으면 규칙 기반 풀이를 돌려준다', async () => {
    const { getFreeReading } = await import('@/lib/service');
    const { computeChart } = await import('@/lib/saju/engine');
    const r = await getFreeReading(computeChart(input));
    expect(r.source).toBe('rule');
    expect(r.keywords).toHaveLength(3);
  });
});
