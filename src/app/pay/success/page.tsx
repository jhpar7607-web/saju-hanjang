'use client';
// 결제 완료 후 돌아오는 화면: 서버에 승인 확인을 요청하고 리포트로 이동한다.
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { postJson } from '@/lib/client';

function Confirm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const orderId = params.get('orderId');
    const paymentKey = params.get('paymentKey');
    const amount = Number(params.get('amount'));
    if (!orderId || !paymentKey || !amount) {
      setError('결제 정보가 올바르지 않습니다.');
      return;
    }
    postJson<{ token: string }>('/api/orders/confirm', { orderId, paymentKey, amount })
      .then((r) => router.replace(`/report/${r.token}`))
      .catch((e) => setError(e instanceof Error ? e.message : '결제 확인에 실패했습니다.'));
  }, [params, router]);

  if (error) {
    return (
      <>
        <p className="error" role="alert">{error}</p>
        <p className="small">주문 번호: {params.get('orderId') || '없음'}</p>
        <Link href="/pay" className="btn">다시 시도하기</Link>
      </>
    );
  }
  return (
    <div className="loading" role="status">
      <div className="spinner" />
      결제를 확인하고 리포트를 쓰는 중입니다. 화면을 닫지 말아 주세요.
    </div>
  );
}

export default function PaySuccessPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner" /></div>}>
      <Confirm />
    </Suspense>
  );
}
