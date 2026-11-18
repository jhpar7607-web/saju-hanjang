'use client';
// S3. 결과 화면: 사주 표, 무료 풀이, 2027 총운 요약, 공유 카드, 자세한 풀이 메뉴, 상세 리포트 안내
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Chart, FreeReading } from '@/lib/saju/types';
import { isAppShell, loadInput, logEvent, won } from '@/lib/client';
import { getDetail, getReading, IS_STATIC } from '@/lib/api';
import type { DetailReport } from '@/lib/saju/detail';
import DetailMenu from '@/components/DetailMenu';
import { ChartTable, ElementBars, GodGlossary, LuckRow, Standards } from '@/components/ChartView';
import ShareCard from '@/components/ShareCard';
import FlagButton from '@/components/FlagButton';
import { DISCLAIMER } from '@/lib/saju/texts';

interface Result {
  chart: Chart;
  reading: FreeReading;
  price: { amount: number; regular: number; promo: boolean; promoEnd: string };
  canPay: boolean;
}

export default function ResultPage() {
  const router = useRouter();
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [app, setApp] = useState(false);
  const [detail, setDetail] = useState<DetailReport | null>(null);

  useEffect(() => {
    const input = loadInput();
    if (!input) {
      router.replace('/input');
      return;
    }
    // 정적 배포에는 결제 기능이 없으므로 앱 안과 같게 구매 안내를 숨긴다.
    setApp(isAppShell() || IS_STATIC);
    getReading(input)
      .then((r) => {
        setData(r);
        logEvent('result_view', { source: r.reading.source });
      })
      .catch((e) => setError(e instanceof Error ? e.message : '결과를 불러오지 못했습니다.'));
    // 자세한 풀이 메뉴는 따로 만든다. 실패해도 무료 결과는 그대로 보인다.
    getDetail(input).then((r) => setDetail(r.detail)).catch(() => setDetail(null));
  }, [router]);

  if (error) {
    return (
      <>
        <p className="error" role="alert">{error}</p>
        <Link href="/input" className="btn">다시 입력하기</Link>
      </>
    );
  }
  if (!data) {
    return (
      <div className="loading" role="status">
        <div className="spinner" />
        사주를 계산하고 풀이를 쓰는 중입니다
      </div>
    );
  }

  const { chart, reading, price, canPay } = data;
  return (
    <>
      <p className="eyebrow">2 / 2 단계 · 내 사주</p>
      <h1>{reading.personalityTitle}</h1>

      <section className="card" aria-labelledby="h-chart">
        <h2 id="h-chart">사주 여덟 글자</h2>
        <ChartTable chart={chart} />
        {chart.timeUnknown && (
          <p className="small" style={{ marginTop: 10 }}>태어난 시간을 몰라 시간 기둥은 비워 두었습니다.</p>
        )}
      </section>

      <section className="card" aria-labelledby="h-el">
        <h2 id="h-el">오행 분포</h2>
        <ElementBars chart={chart} />
      </section>

      <section className="card" aria-labelledby="h-nature">
        <h2 id="h-nature">타고난 성향</h2>
        <p>{reading.personality}</p>
      </section>

      <section className="card" aria-labelledby="h-year">
        <p className="eyebrow">2027 정미년 총운</p>
        <p className="yearline" id="h-year">{reading.yearLine}</p>
        <p>{reading.yearSummary}</p>
        <div className="chips">
          {reading.keywords.map((k) => <span className="chip" key={k}>{k}</span>)}
        </div>
      </section>

      {detail && <DetailMenu detail={detail} />}

      <section className="card stack" aria-label="공유">
        <ShareCard chart={chart} title={reading.personalityTitle} line={reading.yearLine} keywords={reading.keywords} />
      </section>

      {!app && (
        <section className="card" aria-labelledby="h-paid">
          <h2 id="h-paid">2027 신년운세 상세 리포트</h2>
          <p className="lead" style={{ fontSize: 15 }}>
            재물, 직업과 공부, 연애와 관계, 건강 생활, 1월부터 12월까지 월별 흐름, 좋은 달과 조심할 달, 실천 3가지를 담았습니다.
          </p>
          <p className="price">
            {price.promo && <s>{won(price.regular)}</s>}
            {won(price.amount)}
          </p>
          {price.promo && <p className="small">오픈 기념가는 {price.promoEnd}까지 적용됩니다.</p>}
          {canPay ? (
            <Link href="/pay" className="btn accent" onClick={() => logEvent('purchase_start')}>상세 리포트 보기</Link>
          ) : (
            <p className="notice">결제 준비 중입니다. 곧 열립니다.</p>
          )}
        </section>
      )}

      <details className="more">
        <summary>대운과 용어 풀이</summary>
        <h3 style={{ marginTop: 12 }}>대운 (10년 단위의 큰 흐름)</h3>
        <LuckRow chart={chart} />
        <p className="small" style={{ marginTop: 8 }}>
          {chart.luck.startAge}세부터 시작해 10년마다 바뀝니다. 색이 다른 칸이 2027년에 지나는 대운입니다.
        </p>
        <h3 style={{ marginTop: 12 }}>십신 (나와 다른 글자의 관계)</h3>
        <GodGlossary chart={chart} />
      </details>

      <details className="more">
        <summary>이렇게 계산했습니다</summary>
        <div style={{ marginTop: 12 }}><Standards chart={chart} /></div>
      </details>

      <p className="small">{DISCLAIMER}</p>
      <p className="small">
        이 풀이는 {reading.source === 'ai' ? 'AI가 작성했습니다.' : '정해진 풀이 규칙으로 작성했습니다.'}{' '}
      </p>
      <FlagButton where="free" chartKey={chart.key} />
      <div style={{ marginTop: 16 }}>
        <Link href="/input" className="btn ghost">다른 사주 보기</Link>
      </div>
    </>
  );
}
