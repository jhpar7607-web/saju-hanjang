// 외부 서비스 연결부 시험 (가짜 응답 사용)
// 실제 AI, 결제사, 저장소 대신 가짜 응답을 끼워 넣어 우리 쪽 처리 흐름을 확인한다.
// 실제 계정으로 하는 확인은 열쇠를 받은 뒤 따로 해야 한다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BirthInput } from '@/lib/saju/types';

const input: BirthInput = {
  year: 1988, month: 6, day: 15, hour: 14, minute: 20,
  calendar: 'solar', leap: false, gender: 'female', trueSolar: true, dayBoundary: 'midnight',
};

const KEYS = ['ANTHROPIC_API_KEY', 'TOSS_SECRET_KEY', 'NEXT_PUBLIC_TOSS_CLIENT_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];

beforeEach(() => {
  vi.resetModules();
  for (const k of KEYS) delete process.env[k];
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'saju-ext-'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of KEYS) delete process.env[k];
});

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });

const goodFree = {
  personalityTitle: '한여름의 등불 같은 사람',
  personality: '따뜻하고 세심한 사람입니다. '.repeat(10),
  yearLine: '차분히 실력을 쌓는 해',
  yearSummary: '꾸준히 준비하면 좋은 결과로 이어지기 쉬운 해입니다. '.repeat(5),
  keywords: ['준비', '꾸준함', '배움'],
};

describe('AI 연결', () => {
  it('올바른 답이 오면 AI 풀이를 쓰고 저장해 두었다가 다시 쓴다', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string), headers: init.headers as Record<string, string> });
      return json({ content: [{ type: 'text', text: '결과입니다.\n' + JSON.stringify(goodFree) }] });
    });
    const { getFreeReading } = await import('@/lib/service');
    const { computeChart } = await import('@/lib/saju/engine');
    const chart = computeChart(input);
    const r1 = await getFreeReading(chart);
    expect(r1.source).toBe('ai');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0].headers['x-api-key']).toBe('test-key');
    expect(calls[0].body.model).toBe('claude-haiku-5-5');
    expect(calls[0].body).not.toHaveProperty('temperature');
    // 보낸 글에 생년이 들어 있지 않다.
    expect(JSON.stringify(calls[0].body)).not.toContain('1988');
    // 두 번째는 저장된 글을 쓰므로 AI 를 다시 부르지 않는다.
    const r2 = await getFreeReading(chart);
    expect(r2).toEqual(r1);
    expect(calls).toHaveLength(1);
  });

  it('금지 표현이 섞인 답은 버리고 규칙 기반 풀이로 대신한다', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    let n = 0;
    vi.stubGlobal('fetch', async () => {
      n += 1;
      return json({ content: [{ type: 'text', text: JSON.stringify({ ...goodFree, yearSummary: '올해는 반드시 큰 사고가 납니다. '.repeat(8) }) }] });
    });
    const { getFreeReading } = await import('@/lib/service');
    const { computeChart } = await import('@/lib/saju/engine');
    const r = await getFreeReading(computeChart(input));
    expect(r.source).toBe('rule');
    expect(n).toBe(2); // 한 번 더 요청해 본 뒤 포기한다
  });

  it('AI 서버 오류가 나도 풀이는 나온다', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async () => new Response('error', { status: 529 }));
    const { makePaidReport } = await import('@/lib/service');
    const { computeChart } = await import('@/lib/saju/engine');
    const r = await makePaidReport(computeChart(input));
    expect(r.source).toBe('rule');
    expect(r.sections).toHaveLength(8);
  });
});

describe('결제사 연결', () => {
  const setKeys = () => {
    process.env.TOSS_SECRET_KEY = 'test_sk_abc';
    process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY = 'test_ck_abc';
  };

  it('결제사가 승인하면 완료 처리하고, 주문 금액으로 확인을 요청한다', async () => {
    setKeys();
    const calls: { url: string; body: Record<string, unknown>; auth: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string), auth: (init.headers as Record<string, string>).Authorization });
      return json({ status: 'DONE' });
    });
    const { createOrder, confirmOrder } = await import('@/lib/orders');
    const { getStore } = await import('@/lib/store');
    const order = await createOrder(input);
    await confirmOrder(order.id, 'pay_key_1', order.amount);
    expect(calls[0].url).toBe('https://api.tosspayments.com/v1/payments/confirm');
    expect(calls[0].body).toEqual({ paymentKey: 'pay_key_1', orderId: order.id, amount: order.amount });
    expect(calls[0].auth).toBe('Basic ' + Buffer.from('test_sk_abc:').toString('base64'));
    const saved = await getStore().getOrder(order.id);
    expect(saved?.status).toBe('paid');
    expect(saved?.paymentKey).toBe('pay_key_1');
  });

  it('결제사가 거부하면 주문은 대기 상태로 남는다', async () => {
    setKeys();
    vi.stubGlobal('fetch', async () => json({ code: 'REJECT_CARD_PAYMENT', message: '한도 초과입니다.' }, 400));
    const { createOrder, confirmOrder } = await import('@/lib/orders');
    const { getStore } = await import('@/lib/store');
    const order = await createOrder(input);
    await expect(confirmOrder(order.id, 'pay_key_2', order.amount)).rejects.toThrow('한도 초과');
    expect((await getStore().getOrder(order.id))?.status).toBe('pending');
  });

  it('운영 설정에서는 모의 결제 번호를 받지 않는다', async () => {
    setKeys();
    vi.stubGlobal('fetch', async () => json({}));
    const { createOrder, confirmOrder } = await import('@/lib/orders');
    const order = await createOrder(input);
    await expect(confirmOrder(order.id, `mock_${order.id}`, order.amount)).rejects.toThrow('준비 중');
  });

  it('리포트를 만들지 못하면 결제를 자동으로 취소한다', async () => {
    setKeys();
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      return json({ status: 'DONE' });
    });
    vi.doMock('@/lib/service', () => ({
      makePaidReport: async () => { throw new Error('실패'); },
      getFreeReading: async () => { throw new Error('실패'); },
    }));
    const { createOrder, confirmOrder } = await import('@/lib/orders');
    const { getStore } = await import('@/lib/store');
    const order = await createOrder(input);
    await expect(confirmOrder(order.id, 'pay_key_3', order.amount)).rejects.toThrow('취소');
    expect(urls.some((u) => u.endsWith('/v1/payments/pay_key_3/cancel'))).toBe(true);
    expect((await getStore().getOrder(order.id))?.status).toBe('refunded');
    vi.doUnmock('@/lib/service');
  });
});

describe('Supabase 저장소 연결', () => {
  it('정해진 주소와 열쇠로 요청을 보낸다', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
    const calls: { url: string; method: string; headers: Record<string, string>; body?: unknown }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      calls.push({
        url, method: init.method || 'GET', headers: init.headers as Record<string, string>,
        body: init.body ? JSON.parse(init.body as string) : undefined,
      });
      if (url.includes('/readings?')) return json([{ content: { kind: 'free' } }]);
      if (url.includes('/orders?token=')) {
        return json([{ id: 'SJ1', token: 't', input, amount: 3900, status: 'paid', payment_key: 'pk', report: null, created_at: 'c', paid_at: 'p' }]);
      }
      if (url.includes('/events?')) return json([], 200, { 'content-range': '0-0/7' });
      return new Response(null, { status: 201 });
    });
    const { getStore } = await import('@/lib/store');
    const store = getStore();
    expect(await store.getReading('free|v1|가나')).toEqual({ kind: 'free' });
    expect(calls[0].url).toBe(`https://example.supabase.co/rest/v1/readings?key=eq.${encodeURIComponent('free|v1|가나')}&select=content`);
    expect(calls[0].headers.apikey).toBe('service-key');
    expect(calls[0].headers.Authorization).toBe('Bearer service-key');

    await store.putReading('k', { a: 1 }, 'm');
    expect(calls[1].method).toBe('POST');
    expect(calls[1].headers.Prefer).toContain('merge-duplicates');

    const order = await store.getOrderByToken('t');
    expect(order?.paymentKey).toBe('pk');
    expect(order?.status).toBe('paid');

    await store.updateOrder('SJ1', { status: 'refunded', paymentKey: 'pk2' });
    const patch = calls[calls.length - 1];
    expect(patch.method).toBe('PATCH');
    expect(patch.body).toEqual({ status: 'refunded', payment_key: 'pk2' });

    expect(await store.countEvents('share', '2026-01-01T00:00:00Z')).toBe(7);
  });

  it('저장소가 고장 나도 무료 풀이는 나온다', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
    vi.stubGlobal('fetch', async () => new Response('down', { status: 500 }));
    const { getFreeReading } = await import('@/lib/service');
    const { computeChart } = await import('@/lib/saju/engine');
    const r = await getFreeReading(computeChart(input));
    expect(r.source).toBe('rule');
  });
});
