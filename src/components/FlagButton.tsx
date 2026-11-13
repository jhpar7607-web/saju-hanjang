'use client';
// 신고 버튼: 풀이 내용에 문제가 있을 때 화면을 떠나지 않고 알릴 수 있다.
import { useState } from 'react';
import Link from 'next/link';
import { logEvent } from '@/lib/client';

const REASONS = ['사주 계산이 틀린 것 같아요', '불쾌하거나 겁을 주는 내용이에요', '내용이 이상하거나 말이 안 돼요', '기타'];

export default function FlagButton({ where, chartKey }: { where: string; chartKey: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);

  if (process.env.NEXT_PUBLIC_STATIC === '1') {
    return (
      <p className="small">
        풀이에 문제가 있으면 <Link href="/info#biz">안내 화면의 문의처</Link>로 알려 주세요.
      </p>
    );
  }
  if (done) return <p className="small" role="status">신고가 접수되었습니다. 확인 후 고치겠습니다.</p>;
  if (!open) {
    return (
      <button type="button" className="toplink" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setOpen(true)}>
        이 풀이 신고하기
      </button>
    );
  }
  return (
    <div className="card stack">
      <label className="label" htmlFor="flag-reason">어떤 문제가 있나요?</label>
      <select id="flag-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map((r) => <option key={r}>{r}</option>)}
      </select>
      <textarea
        rows={3} maxLength={280} value={note} placeholder="자세한 내용 (선택)"
        aria-label="자세한 내용" onChange={(e) => setNote(e.target.value)}
      />
      <div className="btnrow">
        <button
          type="button" className="btn"
          onClick={() => { logEvent('flag', { where, reason, note, chartKey }); setDone(true); }}
        >
          신고 보내기
        </button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>닫기</button>
      </div>
    </div>
  );
}
