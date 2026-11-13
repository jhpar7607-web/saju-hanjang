// 서버 기능 공통 도구

import { NextResponse } from 'next/server';
import { InputError } from './saju/types';
import { OrderError } from './orders';

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** 요청 본문을 JSON 으로 읽는다. 너무 크거나 형식이 틀리면 null. */
export async function readJson(req: Request, maxBytes = 4000): Promise<unknown | null> {
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 예외를 사용자에게 보여 줄 응답으로 바꾼다. */
export function toResponse(e: unknown) {
  if (e instanceof InputError) return fail(e.message, 400);
  if (e instanceof OrderError) return fail(e.message, e.status);
  console.error('[서버 오류]', e);
  return fail('잠시 문제가 생겼습니다. 조금 뒤에 다시 시도해 주세요.', 500);
}
