'use client';
// 결과 화면 아래의 "더 자세한 풀이" 메뉴: 주제별 운 7가지, 시기별 운 4가지
import Link from 'next/link';
import type { DetailItem, DetailReport } from '@/lib/saju/detail';
import { PREMIUM_OPEN } from '@/lib/premium';

function MenuCard({ item }: { item: DetailItem }) {
  return (
    <Link href={`/detail?item=${item.id}`} className="menu-card">
      <span className="menu-title">
        {item.title}
        {item.flowLabel && <span className={`tag flow-${item.flow}`}>2027 {item.flowLabel}</span>}
      </span>
      <span className="menu-sum">{item.summary}</span>
    </Link>
  );
}

export default function DetailMenu({ detail }: { detail: DetailReport }) {
  const topics = detail.items.filter((x) => x.group === 'topic');
  const periods = detail.items.filter((x) => x.group === 'period');
  return (
    <section className="card" aria-labelledby="h-more">
      <h2 id="h-more">더 자세한 풀이</h2>
      <p className="small" style={{ marginTop: 0 }}>
        {PREMIUM_OPEN
          ? '지금은 체험 기간이라 모든 풀이를 무료로 볼 수 있습니다.'
          : '항목마다 첫 풀이는 무료로 볼 수 있고, 전체 풀이는 곧 유료로 열립니다.'}
      </p>
      <h3 className="menu-head">주제별 운</h3>
      <div className="menu">
        {topics.map((it) => <MenuCard key={it.id} item={it} />)}
      </div>
      <h3 className="menu-head">시기별 운</h3>
      <div className="menu">
        {periods.map((it) => <MenuCard key={it.id} item={it} />)}
      </div>
    </section>
  );
}
