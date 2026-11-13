// 저장소
// 표 3개(풀이 글, 주문, 이용 기록)를 다룬다.
// SUPABASE_URL 이 있으면 Supabase 에, 없으면 .data 폴더의 파일에 저장한다.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from './config';
import type { BirthInput, PaidReport } from './saju/types';

export interface Order {
  id: string;
  token: string;
  input: BirthInput;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentKey: string | null;
  report: PaidReport | null;
  createdAt: string;
  paidAt: string | null;
}

export interface EventRow {
  type: string;
  device: string;
  meta: Record<string, unknown>;
  at: string;
}

export interface Store {
  getReading(key: string): Promise<unknown | null>;
  putReading(key: string, content: unknown, model: string): Promise<void>;
  createOrder(order: Order): Promise<void>;
  getOrder(id: string): Promise<Order | null>;
  getOrderByToken(token: string): Promise<Order | null>;
  updateOrder(id: string, patch: Partial<Order>): Promise<void>;
  addEvent(ev: EventRow): Promise<void>;
  countEvents(type: string, sinceIso: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// 파일 저장소 (개발과 시험용). 한 서버에서만 쓸 때 적합하다.
// ---------------------------------------------------------------------------
class FileStore implements Store {
  private dir: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.dir = dir;
  }

  private file(name: string) {
    return path.join(this.dir, name);
  }

  // 여러 요청이 동시에 같은 파일을 쓰지 않도록 차례대로 처리한다.
  private lock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async readJson<T>(name: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await fs.readFile(this.file(name), 'utf8')) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(name: string, data: unknown): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const tmp = this.file(`${name}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(data), 'utf8');
    await fs.rename(tmp, this.file(name));
  }

  getReading(key: string) {
    return this.lock(async () => {
      const all = await this.readJson<Record<string, { content: unknown }>>('readings.json', {});
      return all[key]?.content ?? null;
    });
  }

  putReading(key: string, content: unknown, model: string) {
    return this.lock(async () => {
      const all = await this.readJson<Record<string, unknown>>('readings.json', {});
      all[key] = { content, model, at: new Date().toISOString() };
      await this.writeJson('readings.json', all);
    });
  }

  createOrder(order: Order) {
    return this.lock(async () => {
      const all = await this.readJson<Record<string, Order>>('orders.json', {});
      all[order.id] = order;
      await this.writeJson('orders.json', all);
    });
  }

  getOrder(id: string) {
    return this.lock(async () => {
      const all = await this.readJson<Record<string, Order>>('orders.json', {});
      return all[id] ?? null;
    });
  }

  getOrderByToken(token: string) {
    return this.lock(async () => {
      const all = await this.readJson<Record<string, Order>>('orders.json', {});
      return Object.values(all).find((o) => o.token === token) ?? null;
    });
  }

  updateOrder(id: string, patch: Partial<Order>) {
    return this.lock(async () => {
      const all = await this.readJson<Record<string, Order>>('orders.json', {});
      if (!all[id]) return;
      all[id] = { ...all[id], ...patch };
      await this.writeJson('orders.json', all);
    });
  }

  addEvent(ev: EventRow) {
    return this.lock(async () => {
      await fs.mkdir(this.dir, { recursive: true });
      await fs.appendFile(this.file('events.jsonl'), JSON.stringify(ev) + '\n', 'utf8');
    });
  }

  countEvents(type: string, sinceIso: string) {
    return this.lock(async () => {
      let text = '';
      try {
        text = await fs.readFile(this.file('events.jsonl'), 'utf8');
      } catch {
        return 0;
      }
      let n = 0;
      for (const line of text.split('\n')) {
        if (!line) continue;
        try {
          const ev = JSON.parse(line) as EventRow;
          if (ev.type === type && ev.at >= sinceIso) n += 1;
        } catch {
          // 깨진 줄은 건너뛴다.
        }
      }
      return n;
    });
  }
}

// ---------------------------------------------------------------------------
// Supabase 저장소 (운영용). REST 주소를 직접 부른다. 표 정의는 supabase/schema.sql 참고.
// ---------------------------------------------------------------------------
class SupabaseStore implements Store {
  constructor(private url: string, private key: string) {}

  private async call(pathAndQuery: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${this.url}/rest/v1/${pathAndQuery}`, {
      ...init,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`저장소 오류 ${res.status}: ${await res.text()}`);
    }
    return res;
  }

  private toOrder(r: Record<string, unknown>): Order {
    return {
      id: r.id as string,
      token: r.token as string,
      input: r.input as BirthInput,
      amount: r.amount as number,
      status: r.status as Order['status'],
      paymentKey: (r.payment_key as string) ?? null,
      report: (r.report as PaidReport) ?? null,
      createdAt: r.created_at as string,
      paidAt: (r.paid_at as string) ?? null,
    };
  }

  async getReading(key: string) {
    const res = await this.call(`readings?key=eq.${encodeURIComponent(key)}&select=content`);
    const rows = (await res.json()) as { content: unknown }[];
    return rows[0]?.content ?? null;
  }

  async putReading(key: string, content: unknown, model: string) {
    await this.call('readings', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key, content, model }),
    });
  }

  async createOrder(o: Order) {
    await this.call('orders', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: o.id, token: o.token, input: o.input, amount: o.amount, status: o.status,
        payment_key: o.paymentKey, report: o.report, created_at: o.createdAt, paid_at: o.paidAt,
      }),
    });
  }

  async getOrder(id: string) {
    const res = await this.call(`orders?id=eq.${encodeURIComponent(id)}&select=*`);
    const rows = (await res.json()) as Record<string, unknown>[];
    return rows[0] ? this.toOrder(rows[0]) : null;
  }

  async getOrderByToken(token: string) {
    const res = await this.call(`orders?token=eq.${encodeURIComponent(token)}&select=*`);
    const rows = (await res.json()) as Record<string, unknown>[];
    return rows[0] ? this.toOrder(rows[0]) : null;
  }

  async updateOrder(id: string, patch: Partial<Order>) {
    const body: Record<string, unknown> = {};
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.paymentKey !== undefined) body.payment_key = patch.paymentKey;
    if (patch.report !== undefined) body.report = patch.report;
    if (patch.paidAt !== undefined) body.paid_at = patch.paidAt;
    await this.call(`orders?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
  }

  async addEvent(ev: EventRow) {
    await this.call('events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ type: ev.type, device: ev.device, meta: ev.meta, at: ev.at }),
    });
  }

  async countEvents(type: string, sinceIso: string) {
    const res = await this.call(
      `events?type=eq.${encodeURIComponent(type)}&at=gte.${encodeURIComponent(sinceIso)}&select=id`,
      { headers: { Prefer: 'count=exact', Range: '0-0' } },
    );
    const range = res.headers.get('content-range') || '*/0';
    return Number(range.split('/')[1]) || 0;
  }
}

let cached: Store | null = null;

/** 설정에 맞는 저장소를 돌려준다. */
export function getStore(): Store {
  if (cached) return cached;
  if (config.supabase.url && config.supabase.key) {
    cached = new SupabaseStore(config.supabase.url, config.supabase.key);
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[저장소] SUPABASE_URL 이 없어 파일 저장소를 씁니다. 여러 서버나 서버리스 환경에서는 주문이 저장되지 않으니 Supabase 를 연결하세요.');
    }
    cached = new FileStore(process.env.DATA_DIR || path.join(process.cwd(), '.data'));
  }
  return cached;
}

/** 시험에서 저장소를 바꿔 끼울 때 쓴다. */
export function resetStoreForTest(): void {
  cached = null;
}
