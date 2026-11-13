// 화면(브라우저)에서 쓰는 도구 모음

import type { BirthInput } from './saju/types';

const INPUT_KEY = 'saju.input.v1';
const DEVICE_KEY = 'saju.device.v1';

/** 입력값을 휴대폰에만 기억해 둔다. */
export function saveInput(input: BirthInput): void {
  try {
    localStorage.setItem(INPUT_KEY, JSON.stringify(input));
  } catch {
    // 저장이 막힌 환경에서는 기억하지 않고 넘어간다.
  }
}

export function loadInput(): BirthInput | null {
  try {
    const raw = localStorage.getItem(INPUT_KEY);
    return raw ? (JSON.parse(raw) as BirthInput) : null;
  } catch {
    return null;
  }
}

export function clearInput(): void {
  try {
    localStorage.removeItem(INPUT_KEY);
  } catch {
    // 무시
  }
}

/** 기기마다 다른 임의 번호. 개인을 알아볼 수 있는 정보는 아니다. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'nostore';
  }
}

/** 이용 기록을 남긴다. 실패해도 화면에는 영향을 주지 않는다. */
export function logEvent(type: string, meta: Record<string, string | number | boolean> = {}): void {
  // 정적 배포에는 기록을 받을 서버가 없다.
  if (process.env.NEXT_PUBLIC_STATIC === '1') return;
  try {
    const body = JSON.stringify({ type, device: deviceId(), meta });
    fetch('/api/log', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
      .catch(() => undefined);
  } catch {
    // 무시
  }
}

/** 안드로이드 앱(웹을 감싼 형태) 안에서 열렸는지 확인한다. 앱 1.0 에서는 결제 버튼을 숨긴다. */
export function isAppShell(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('app') === '1') {
      sessionStorage.setItem('saju.app', '1');
    }
    if (sessionStorage.getItem('saju.app') === '1') return true;
    if (document.referrer.startsWith('android-app://')) {
      sessionStorage.setItem('saju.app', '1');
      return true;
    }
  } catch {
    // 무시
  }
  return false;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || '잠시 문제가 생겼습니다. 다시 시도해 주세요.');
  return data;
}

export function won(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}
