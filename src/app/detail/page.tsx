'use client';
// S4. 자세한 풀이 화면: 주제별 운 7가지, 시기별 운 4가지
// 주소의 ?item= 으로 항목을 고른다. 뒤로 가기를 누르면 이전 항목으로 돌아간다.
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DetailItem, DetailReport } from '@/lib/saju/detail';
import { loadInput, logEvent } from '@/lib/client';
import { getDetail } from '@/lib/api';
import { DETAIL_ORDER, PREMIUM_OPEN } from '@/lib/premium';
import { DISCLAIMER } from '@/lib/saju/texts';

function pickItem(id: string | null): string {
  return id && (DETAIL_ORDER as readonly string[]).includes(id) ? id : 'money';
}

function Locked({ item }: { item: DetailItem }) {
  const inside = [
    ...item.sections.slice(1).map((s) => s.title),
    ...(item.rows?.length ? [`${item.rowsTitle} (${item.rows.length}개)`] : []),
    ...(item.tips?.length ? ['실천 팁'] : []),
  ];
  return (
    <section className="card locked" aria-label="잠긴 풀이">
      <h2>전체 풀이에 담긴 내용</h2>
      <ul>
        {inside.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <p className="notice" style={{ marginBottom: 0 }}>전체 풀이는 곧 유료로 열립니다.</p>
    </section>
  );
}

function Body({ item }: { item: DetailItem }) {
  const [first, ...rest] = item.sections;
  return (
    <>
      <section className="card">
        <h2>{first.title}</h2>
        <p style={{ marginBottom: 0 }}>{first.body}</p>
      </section>
      {!PREMIUM_OPEN ? (
        <Locked item={item} />
      ) : (
        <>
          {rest.map((s) => (
            <section className="card" key={s.title}>
              <h2>{s.title}</h2>
              <p style={{ marginBottom: 0 }}>{s.body}</p>
            </section>
          ))}
          {item.rows && item.rows.length > 0 && (
            <section className="card" aria-label={item.rowsTitle}>
              <h2>{item.rowsTitle}</h2>
              {item.rows.map((r) => (
                <div className={`month${r.highlight ? ' hl' : ''}`} key={r.label}>
                  <div>
                    <span className="m">{r.label}</span>
                    {r.tag && <span className={`tag ${r.highlight ? 'good' : r.tag === '보통' || r.tag === '잔잔함' ? 'plain' : 'care'}`}>{r.tag}</span>}
                  </div>
                  {r.sub && <div className="small" style={{ margin: '2px 0 4px' }}>{r.sub}</div>}
                  <div>{r.body}</div>
                </div>
              ))}
            </section>
          )}
          {item.tips && item.tips.length > 0 && (
            <section className="card">
              <h2>실천 팁</h2>
              <ol className="actions">
                {item.tips.map((t) => <li key={t}>{t}</li>)}
              </ol>
            </section>
          )}
        </>
      )}
    </>
  );
}

function Loading() {
  return (
    <div className="loading" role="status">
      <div className="spinner" />
      자세한 풀이를 만드는 중입니다
    </div>
  );
}

export default function DetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DetailInner />
    </Suspense>
  );
}

function DetailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const itemId = pickItem(params.get('item'));
  const [detail, setDetail] = useState<DetailReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const input = loadInput();
    if (!input) {
      router.replace('/input');
      return;
    }
    getDetail(input)
      .then((r) => setDetail(r.detail))
      .catch((e) => setError(e instanceof Error ? e.message : '풀이를 불러오지 못했습니다.'));
  }, [router]);

  useEffect(() => {
    if (detail) logEvent('detail_view', { item: itemId, open: PREMIUM_OPEN });
  }, [detail, itemId]);

  const go = (id: string) => {
    router.push(`/detail?item=${id}`, { scroll: true });
  };

  if (error) {
    return (
      <>
        <p className="error" role="alert">{error}</p>
        <Link href="/input" className="btn">다시 입력하기</Link>
      </>
    );
  }
  if (!detail) return <Loading />;

  const item = detail.items.find((x) => x.id === itemId) ?? detail.items[0];
  const group = item.group;
  const list = detail.items.filter((x) => x.group === group);
  const idx = DETAIL_ORDER.indexOf(item.id as (typeof DETAIL_ORDER)[number]);
  const prev = idx > 0 ? detail.items.find((x) => x.id === DETAIL_ORDER[idx - 1]) : null;
  const next = idx < DETAIL_ORDER.length - 1 ? detail.items.find((x) => x.id === DETAIL_ORDER[idx + 1]) : null;

  return (
    <>
      <p className="eyebrow">자세한 풀이{PREMIUM_OPEN ? ' · 체험 기간 무료 공개' : ''}</p>
      <div className="seg" role="group" aria-label="풀이 묶음" style={{ margin: '10px 0 12px' }}>
        <button type="button" aria-pressed={group === 'topic'} onClick={() => go('money')}>주제별 운</button>
        <button type="button" aria-pressed={group === 'period'} onClick={() => go('year1')}>시기별 운</button>
      </div>
      <div className="pick" role="group" aria-label="항목 고르기">
        {list.map((x) => (
          <button type="button" key={x.id} aria-pressed={x.id === item.id} onClick={() => go(x.id)}>
            {x.title.replace(/ \(.+\)$/, '')}
          </button>
        ))}
      </div>

      <h1 style={{ marginTop: 18 }}>{item.title}</h1>
      <p className="yearline">{item.summary}</p>
      {item.flowLabel && (
        <p className="small" style={{ marginTop: -4 }}>
          2027년 흐름 <span className={`tag flow-${item.flow}`}>{item.flowLabel}</span>
        </p>
      )}

      <Body item={item} />

      <div className="btnrow" style={{ margin: '4px 0 16px' }}>
        {prev ? <button type="button" className="btn ghost" onClick={() => go(prev.id)}>이전: {prev.title.replace(/ \(.+\)$/, '')}</button> : <span />}
        {next ? <button type="button" className="btn ghost" onClick={() => go(next.id)}>다음: {next.title.replace(/ \(.+\)$/, '')}</button> : <span />}
      </div>

      <p className="small">{detail.note}</p>
      <p className="small">{DISCLAIMER}</p>
      <p className="small">이 풀이는 정해진 풀이 규칙으로 작성했습니다.</p>
      <Link href="/result" className="btn light">내 사주 한 장으로 돌아가기</Link>
    </>
  );
}
