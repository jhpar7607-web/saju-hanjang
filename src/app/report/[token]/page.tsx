'use client';
// S5. 유료 리포트 화면
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Chart, PaidReport } from '@/lib/saju/types';
import { logEvent } from '@/lib/client';
import { ChartTable, ElementBars, LuckRow, Standards } from '@/components/ChartView';
import ShareCard from '@/components/ShareCard';
import FlagButton from '@/components/FlagButton';
import { DAY_MASTER, DISCLAIMER } from '@/lib/saju/texts';

interface Data {
  chart: Chart;
  report: PaidReport;
  orderId: string;
}

export default function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/report/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || '리포트를 찾을 수 없습니다.');
        setData(d as Data);
        logEvent('report_view');
      })
      .catch((e) => setError(e instanceof Error ? e.message : '리포트를 불러오지 못했습니다.'));
  }, [token]);

  if (error) {
    return (
      <>
        <p className="error" role="alert">{error}</p>
        <Link href="/" className="btn">첫 화면으로</Link>
      </>
    );
  }
  if (!data) {
    return <div className="loading" role="status"><div className="spinner" />리포트를 여는 중입니다</div>;
  }

  const { chart, report } = data;
  const total = report.sections[0];
  const line = total.body.split('. ')[0].replace(/\.$/, '');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <p className="eyebrow">2027 정미년 신년운세 상세 리포트</p>
      <h1>{DAY_MASTER[chart.dayMaster]?.title ?? '나의 2027년'}</h1>

      <div className="notice">
        이 주소를 저장해 두면 언제든 다시 볼 수 있습니다. 주소를 아는 사람은 누구나 볼 수 있으니 공유에 주의하세요.
        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn light" onClick={copy}>{copied ? '주소를 복사했습니다' : '리포트 주소 복사'}</button>
        </div>
      </div>

      <section className="card">
        <h2>사주 여덟 글자</h2>
        <ChartTable chart={chart} />
        <div style={{ marginTop: 14 }}><ElementBars chart={chart} /></div>
      </section>

      {report.sections.map((s) => (
        <section className="card" key={s.id} aria-labelledby={`sec-${s.id}`}>
          <h2 id={`sec-${s.id}`}>{s.title}</h2>
          <p>{s.body}</p>
          {s.id === 'months' && (
            <div>
              {report.months.map((m) => (
                <div className="month" key={m.month}>
                  <span className="m">{m.month}월</span>
                  <span className="small">{m.pillar}월</span>
                  {report.goodMonths.includes(m.month) && <span className="tag good">힘이 실리는 달</span>}
                  {report.cautionMonths.includes(m.month) && <span className="tag care">여유를 둘 달</span>}
                  <p style={{ margin: '6px 0 0' }}>{m.body}</p>
                </div>
              ))}
            </div>
          )}
          {s.id === 'guide' && (
            <>
              <h3>올해의 실천 3가지</h3>
              <ol className="actions">
                {report.actions.map((a) => <li key={a}>{a}</li>)}
              </ol>
            </>
          )}
        </section>
      ))}

      <section className="card stack">
        <ShareCard chart={chart} title={DAY_MASTER[chart.dayMaster]?.title ?? ''} line={line} keywords={[]} />
      </section>

      <details className="more">
        <summary>대운과 계산 기준</summary>
        <div style={{ marginTop: 12 }}><LuckRow chart={chart} /></div>
        <div style={{ marginTop: 12 }}><Standards chart={chart} /></div>
      </details>

      <p className="small">{DISCLAIMER}</p>
      <p className="small">
        이 리포트는 {report.source === 'ai' ? 'AI가 작성했습니다.' : '정해진 풀이 규칙으로 작성했습니다.'} 주문 번호: {data.orderId}
      </p>
      <FlagButton where="paid" chartKey={chart.key} />
    </>
  );
}
