'use client';
// 결제 실패 또는 취소 화면
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function Fail() {
  const params = useSearchParams();
  const message = params.get('message');
  return (
    <>
      <h1>결제가 완료되지 않았습니다</h1>
      <p className="lead">{message ? message.slice(0, 200) : '결제를 취소했거나 문제가 생겼습니다.'} 돈은 나가지 않았습니다.</p>
      <div className="stack">
        <Link href="/pay" className="btn accent">다시 결제하기</Link>
        <Link href="/result" className="btn ghost">결과 화면으로</Link>
      </div>
    </>
  );
}

export default function PayFailPage() {
  return (
    <Suspense fallback={null}>
      <Fail />
    </Suspense>
  );
}
