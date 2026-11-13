// 호출 제한: 같은 곳에서 너무 자주 부르는 것을 막는다.
// 서버 한 대의 기억 장치에서만 세므로, 서버가 여러 대면 대략적인 제한이 된다.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** 허용되면 true. limit 은 windowMs 동안 허용할 횟수. */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // 오래된 기록을 가끔 치운다.
    if (buckets.size > 20000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

/** 요청을 보낸 곳의 주소 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'local';
}

export function resetRateLimitForTest(): void {
  buckets.clear();
}
