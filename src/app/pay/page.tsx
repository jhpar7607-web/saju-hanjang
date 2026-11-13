'use client';
// S4. 결제 화면: 상품 설명, 가격, 환불 규정, 동의, 결제창
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAppShell, loadInput, postJson, won } from '@/lib/client';

interface PriceInfo {
  price: { amount: number; regular: number; promo: boolean; promoEnd: string };
  productName: string;
  canPay: boolean;
  mock: boolean;
}
interface OrderResult {
  orderId: string;
  amount: number;
  orderName: string;
  clientKey: string;
  mock: boolean;
}

/** 토스페이먼츠 결제창 스크립트를 불러온다. */
function loadToss(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { TossPayments?: unknown }).TossPayments) return resolve();
    const s = document.createElement('script');
    s.src = 'https://js.tosspayments.com/v2/standard';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('결제창을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(s);
  });
}

export default function PayPage() {
  const router = useRouter();
  const [info, setInfo] = useState<PriceInfo | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAppShell() || !loadInput()) {
      router.replace('/result');
      return;
    }
    fetch('/api/orders')
      .then((r) => r.json())
      .then((d: PriceInfo) => setInfo(d))
      .catch(() => setError('가격 정보를 불러오지 못했습니다.'));
  }, [router]);

  const pay = async () => {
    const input = loadInput();
    if (!input) return router.replace('/input');
    setError('');
    setBusy(true);
    try {
      const order = await postJson<OrderResult>('/api/orders', { input, agree });
      if (order.mock) {
        // 개발 환경의 모의 결제: 실제 돈은 나가지 않는다.
        const done = await postJson<{ token: string }>('/api/orders/confirm', {
          orderId: order.orderId, paymentKey: `mock_${order.orderId}`, amount: order.amount,
        });
        router.push(`/report/${done.token}`);
        return;
      }
      await loadToss();
      const TossPayments = (window as unknown as {
        TossPayments: (key: string) => { payment: (o: { customerKey: string }) => { requestPayment: (o: unknown) => Promise<void> } };
      }).TossPayments;
      const payment = TossPayments(order.clientKey).payment({ customerKey: 'ANONYMOUS' });
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: order.amount },
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: `${window.location.origin}/pay/success`,
        failUrl: `${window.location.origin}/pay/fail`,
      });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : '결제를 진행하지 못했습니다.');
      setBusy(false);
    }
  };

  if (!info) {
    return error
      ? <p className="error" role="alert">{error}</p>
      : <div className="loading" role="status"><div className="spinner" />불러오는 중입니다</div>;
  }

  const { price } = info;
  return (
    <>
      <p className="eyebrow">상세 리포트</p>
      <h1>{info.productName}</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {info.mock && <p className="notice">지금은 시험용 모의 결제입니다. 실제 돈은 나가지 않습니다.</p>}

      <div className="card">
        <h3>담긴 내용</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>2027년 한 줄 총평과 타고난 성향</li>
          <li>재물, 직업과 공부, 연애와 관계, 건강 생활</li>
          <li>1월부터 12월까지 월별 흐름</li>
          <li>좋은 달, 조심할 달, 실천 3가지</li>
        </ul>
      </div>

      <div className="card">
        <p className="price">
          {price.promo && <s>{won(price.regular)}</s>}
          {won(price.amount)}
        </p>
        <p className="small">
          부가세 포함, 1회 결제입니다.
          {price.promo && ` 오픈 기념가는 ${price.promoEnd}까지 적용됩니다.`}
        </p>
      </div>

      <div className="card">
        <h3>환불 안내</h3>
        <p className="small" style={{ margin: 0 }}>
          리포트는 결제 즉시 제공되는 디지털 콘텐츠라 열람 후에는 환불이 어렵습니다. 다만 사주 계산이 틀렸거나
          리포트가 열리지 않는 경우에는 전액 환불해 드립니다. 자세한 내용은 <Link href="/info#refund">환불 규정</Link>을 확인해 주세요.
        </p>
      </div>

      <label className="check" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          <Link href="/info#terms">이용약관</Link>과 <Link href="/info#privacy">개인정보 수집·이용</Link>에 동의합니다.
          리포트를 다시 보여 드리기 위해 입력한 생년월일시와 성별을 저장합니다.
        </span>
      </label>

      <button type="button" className="btn accent" disabled={!agree || busy || !info.canPay} onClick={pay}>
        {busy ? '진행하는 중' : `${won(price.amount)} 결제하기`}
      </button>
      {!info.canPay && <p className="notice" style={{ marginTop: 12 }}>결제 준비 중입니다. 곧 열립니다.</p>}
      <div style={{ marginTop: 10 }}>
        <Link href="/result" className="btn ghost">돌아가기</Link>
      </div>
    </>
  );
}
