// A7. 이용 기록과 신고 접수
import { fail, ok, readJson } from '@/lib/http';
import { allow, clientIp } from '@/lib/ratelimit';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';

/** 받는 기록 종류 */
const TYPES = ['visit', 'result_view', 'share', 'purchase_start', 'report_view', 'flag'];

export async function POST(req: Request) {
  if (!allow(`log:${clientIp(req)}`, 6000, 60 * 60 * 1000)) return ok({ ok: true });
  const body = (await readJson(req, 2000)) as Record<string, unknown> | null;
  if (!body || typeof body.type !== 'string' || !TYPES.includes(body.type)) {
    return fail('기록 종류가 올바르지 않습니다.');
  }
  const device = typeof body.device === 'string' ? body.device.slice(0, 64) : 'unknown';
  const meta: Record<string, unknown> = {};
  if (body.meta && typeof body.meta === 'object') {
    // 부가 정보는 짧은 글자와 숫자만 받는다. 생년월일시는 기록하지 않는다.
    for (const [k, v] of Object.entries(body.meta as Record<string, unknown>).slice(0, 6)) {
      if (['year', 'month', 'day', 'hour', 'minute'].includes(k)) continue;
      if (typeof v === 'string') meta[k.slice(0, 30)] = v.slice(0, 300);
      else if (typeof v === 'number' || typeof v === 'boolean') meta[k.slice(0, 30)] = v;
    }
  }
  try {
    await getStore().addEvent({ type: body.type, device, meta, at: new Date().toISOString() });
  } catch {
    // 기록 실패는 화면에 영향을 주지 않는다.
  }
  return ok({ ok: true });
}
