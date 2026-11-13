'use client';
// 방문 기록을 한 번 남긴다.
import { useEffect } from 'react';
import { isAppShell, logEvent } from '@/lib/client';

export default function VisitLog({ type }: { type: string }) {
  useEffect(() => {
    logEvent(type, { app: isAppShell() });
  }, [type]);
  return null;
}
