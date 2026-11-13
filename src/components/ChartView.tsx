// 사주 표, 오행 분포, 대운, 계산 기준을 보여 주는 화면 조각
import type { Chart, Element, PillarView } from '@/lib/saju/types';
import { GOD_EASY } from '@/lib/saju/texts';

const ELEMENT_LABEL: Record<Element, string> = {
  목: '나무(목)', 화: '불(화)', 토: '흙(토)', 금: '쇠(금)', 수: '물(수)',
};
const BOUNDARY_LABEL = {
  midnight: '자정에 날짜가 바뀜',
  jasi: '밤 11시부터 다음 날',
  splitJasi: '날짜는 그대로, 시간 기둥만 다음 날 기준',
};

function Pillar({ cap, p }: { cap: string; p: PillarView | null }) {
  if (!p) {
    return (
      <div className="pillar">
        <div className="cap">{cap}</div>
        <div className="god">&nbsp;</div>
        <div className="cell empty"><div className="han">?</div><div className="ko">모름</div></div>
        <div className="cell empty"><div className="han">?</div><div className="ko">모름</div></div>
        <div className="god">&nbsp;</div>
      </div>
    );
  }
  return (
    <div className="pillar">
      <div className="cap">{cap}</div>
      <div className="god">{p.stemGod === '일간' ? '나(일간)' : p.stemGod}</div>
      <div className={`cell el-${p.stemElement}`}>
        <div className="han">{p.stemHanja}</div>
        <div className="ko">{p.stem} · {p.stemElement}</div>
      </div>
      <div className={`cell el-${p.branchElement}`}>
        <div className="han">{p.branchHanja}</div>
        <div className="ko">{p.branch} · {p.branchElement}</div>
      </div>
      <div className="god">{p.branchGod}</div>
    </div>
  );
}

export function ChartTable({ chart }: { chart: Chart }) {
  const p = chart.pillars;
  return (
    <div className="chart" role="group" aria-label="사주 여덟 글자">
      <Pillar cap="시간 기둥" p={p.hour} />
      <Pillar cap="날 기둥" p={p.day} />
      <Pillar cap="달 기둥" p={p.month} />
      <Pillar cap="해 기둥" p={p.year} />
    </div>
  );
}

export function ElementBars({ chart }: { chart: Chart }) {
  const total = Object.values(chart.elements).reduce((a, b) => a + b, 0);
  const order: Element[] = ['목', '화', '토', '금', '수'];
  return (
    <div className="bars">
      {order.map((e) => (
        <div className="bar" key={e}>
          <span>{ELEMENT_LABEL[e]}</span>
          <div className="track">
            <div className={`fill el-${e}`} style={{ width: `${(chart.elements[e] / total) * 100}%` }} />
          </div>
          <b>{chart.elements[e]}</b>
        </div>
      ))}
    </div>
  );
}

export function LuckRow({ chart }: { chart: Chart }) {
  if (chart.luck.pillars.length === 0) return null;
  return (
    <div className="luck" aria-label="대운">
      {chart.luck.pillars.slice(0, 9).map((x) => (
        <div key={x.age} className={chart.luck.current?.age === x.age ? 'now' : ''}>
          <div>{x.age}세~</div>
          <b>{x.korean}</b>
        </div>
      ))}
    </div>
  );
}

export function Standards({ chart }: { chart: Chart }) {
  const s = chart.solar;
  const l = chart.lunar;
  return (
    <div className="kv">
      <span>양력</span><b>{s.year}년 {s.month}월 {s.day}일</b>
      <span>음력</span><b>{l.year}년 {l.leap ? '윤' : ''}{l.month}월 {l.day}일</b>
      <span>만세력</span><b>한국천문연구원 자료 기준 (manseryeok)</b>
      <span>해와 달 기둥</span><b>입춘과 절기가 드는 시각 기준</b>
      <span>진태양시</span>
      <b>{chart.timeUnknown ? '시간 모름으로 쓰지 않음' : chart.settings.trueSolar ? '적용 (동경 127.5도 기준)' : '적용 안 함'}</b>
      <span>밤 11시대</span><b>{BOUNDARY_LABEL[chart.settings.dayBoundary]}</b>
    </div>
  );
}

export function GodGlossary({ chart }: { chart: Chart }) {
  const p = chart.pillars;
  const seen = new Set<string>();
  for (const x of [p.year, p.month, p.day, p.hour]) {
    if (!x) continue;
    if (x.stemGod !== '일간') seen.add(x.stemGod);
    seen.add(x.branchGod);
  }
  return (
    <div className="kv">
      {[...seen].map((g) => (
        <span key={g} style={{ display: 'contents' }}>
          <span>{g}</span><b>{GOD_EASY[g as keyof typeof GOD_EASY]}</b>
        </span>
      ))}
    </div>
  );
}
