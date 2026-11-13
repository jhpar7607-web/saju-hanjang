'use client';
// 공유 카드: 결과를 이미지 한 장으로 그려 저장하거나 공유한다.
// 카드에는 생년월일시를 넣지 않는다. 일간, 한 줄 총평, 키워드, 여덟 글자만 넣는다.
import { useEffect, useRef, useState } from 'react';
import type { Chart, Element } from '@/lib/saju/types';
import { logEvent } from '@/lib/client';

const COLORS: Record<Element, string> = {
  목: '#2f7d4f', 화: '#c2412d', 토: '#a8782a', 금: '#6b7280', 수: '#2b5c9e',
};
const FONT = "'Pretendard','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif";

/** 긴 글을 폭에 맞게 여러 줄로 나눈다. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(canvas: HTMLCanvasElement, chart: Chart, title: string, line: string, keywords: string[]) {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#1b1f3b';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#faf7f2';
  roundRect(ctx, 60, 60, W - 120, H - 120, 40);
  ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#b23a24';
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText('2027 정미년 신년운세', 120, 170);
  ctx.fillStyle = '#1b1f3b';
  ctx.font = `800 44px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('사주한장', W - 120, 172);
  ctx.textAlign = 'left';

  // 일간 큰 글자
  const dm = chart.pillars.day;
  ctx.fillStyle = COLORS[dm.stemElement];
  roundRect(ctx, 120, 230, 220, 220, 32);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 150px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(dm.stemHanja, 230, 392);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#6b7085';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText('나를 뜻하는 글자', 380, 285);
  ctx.fillStyle = '#1b1f3b';
  ctx.font = `800 46px ${FONT}`;
  let y = 350;
  for (const l of wrap(ctx, title, W - 380 - 120).slice(0, 2)) {
    ctx.fillText(l, 380, y);
    y += 62;
  }

  // 한 줄 총평
  ctx.fillStyle = '#b23a24';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('2027년 한 줄 총평', 120, 560);
  ctx.fillStyle = '#1b1f3b';
  ctx.font = `800 58px ${FONT}`;
  y = 650;
  for (const l of wrap(ctx, line, W - 240).slice(0, 3)) {
    ctx.fillText(l, 120, y);
    y += 80;
  }

  // 키워드
  let x = 120;
  y += 10;
  ctx.font = `700 34px ${FONT}`;
  for (const k of keywords.slice(0, 3)) {
    const w = ctx.measureText(k).width + 56;
    ctx.fillStyle = '#f6e4dd';
    roundRect(ctx, x, y, w, 68, 34);
    ctx.fill();
    ctx.fillStyle = '#b23a24';
    ctx.fillText(k, x + 28, y + 46);
    x += w + 16;
  }

  // 여덟 글자
  const pillars = [chart.pillars.hour, chart.pillars.day, chart.pillars.month, chart.pillars.year];
  const caps = ['시간', '날', '달', '해'];
  const cellW = 195;
  const gap = 20;
  const startX = 120;
  const top = 990;
  pillars.forEach((p, i) => {
    const cx = startX + i * (cellW + gap);
    ctx.fillStyle = '#6b7085';
    ctx.font = `500 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(caps[i], cx + cellW / 2, top - 16);
    const parts = p
      ? [{ ch: p.stemHanja, el: p.stemElement }, { ch: p.branchHanja, el: p.branchElement }]
      : [null, null];
    parts.forEach((part, j) => {
      const cy = top + j * 110;
      ctx.fillStyle = part ? COLORS[part.el] : '#e3ddd2';
      roundRect(ctx, cx, cy, cellW, 96, 20);
      ctx.fill();
      ctx.fillStyle = part ? '#ffffff' : '#6b7085';
      ctx.font = `700 62px ${FONT}`;
      ctx.fillText(part ? part.ch : '?', cx + cellW / 2, cy + 70);
    });
    ctx.textAlign = 'left';
  });

  ctx.fillStyle = '#6b7085';
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText('참고용 풀이입니다. 계산 기준: 한국천문연구원 자료 기반 만세력', 120, H - 100);
}

export default function ShareCard(props: {
  chart: Chart;
  title: string;
  line: string;
  keywords: string[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && ref.current) draw(ref.current, props.chart, props.title, props.line, props.keywords);
  }, [open, props.chart, props.title, props.line, props.keywords]);

  const toBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      if (!ref.current) return resolve(null);
      ref.current.toBlob((b) => resolve(b), 'image/png');
    });

  const save = async () => {
    const blob = await toBlob();
    if (!blob) return setMsg('이미지를 만들지 못했습니다.');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saju-hanjang-2027.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMsg('이미지를 저장했습니다.');
    logEvent('share', { how: 'save' });
  };

  const share = async () => {
    const blob = await toBlob();
    if (!blob) return setMsg('이미지를 만들지 못했습니다.');
    const file = new File([blob], 'saju-hanjang-2027.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try {
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: '사주한장', text: props.line });
        logEvent('share', { how: 'share' });
        return;
      }
    } catch {
      return; // 사용자가 공유 창을 닫은 경우
    }
    await save();
    setMsg('이 기기에서는 바로 공유가 되지 않아 이미지로 저장했습니다. 저장된 사진을 보내 주세요.');
  };

  if (!open) {
    return (
      <button type="button" className="btn ghost" onClick={() => setOpen(true)}>
        공유 카드 만들기
      </button>
    );
  }
  return (
    <div className="stack">
      <canvas ref={ref} className="preview" aria-label="공유 카드 미리보기" />
      <div className="btnrow">
        <button type="button" className="btn" onClick={share}>공유하기</button>
        <button type="button" className="btn ghost" onClick={save}>이미지 저장</button>
      </div>
      {msg && <p className="small" role="status">{msg}</p>}
      <p className="small">카드에는 생년월일과 태어난 시간이 들어가지 않습니다.</p>
    </div>
  );
}
