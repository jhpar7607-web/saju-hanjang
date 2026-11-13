'use client';
// S2. 입력 화면
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BirthInput, DayBoundary } from '@/lib/saju/types';
import { loadInput, saveInput } from '@/lib/client';
import { checkInput } from '@/lib/api';

const MIN_YEAR = 1930;
const MAX_YEAR = 2026;

export default function InputPage() {
  const router = useRouter();
  const [calendar, setCalendar] = useState<'solar' | 'lunar'>('solar');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('1');
  const [day, setDay] = useState('1');
  const [leap, setLeap] = useState(false);
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [hour, setHour] = useState('12');
  const [minute, setMinute] = useState('0');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [trueSolar, setTrueSolar] = useState(true);
  const [dayBoundary, setDayBoundary] = useState<DayBoundary>('midnight');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 전에 넣은 값이 있으면 다시 채운다.
  useEffect(() => {
    const prev = loadInput();
    if (!prev) return;
    setCalendar(prev.calendar);
    setYear(String(prev.year));
    setMonth(String(prev.month));
    setDay(String(prev.day));
    setLeap(prev.leap);
    setTimeUnknown(prev.hour === null);
    if (prev.hour !== null) {
      setHour(String(prev.hour));
      setMinute(String(prev.minute ?? 0));
    }
    setGender(prev.gender);
    setTrueSolar(prev.trueSolar);
    setDayBoundary(prev.dayBoundary);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const y = Number(year);
    if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) {
      return setError(`태어난 해를 ${MIN_YEAR}~${MAX_YEAR} 사이 숫자로 입력해 주세요.`);
    }
    if (!gender) return setError('성별을 선택해 주세요.');
    const input: BirthInput = {
      year: y,
      month: Number(month),
      day: Number(day),
      hour: timeUnknown ? null : Number(hour),
      minute: timeUnknown ? null : Number(minute),
      calendar,
      leap: calendar === 'lunar' && leap,
      gender,
      trueSolar,
      dayBoundary,
    };
    setBusy(true);
    try {
      // 실제로 있는 날짜인지 확인한다.
      await checkInput(input);
      saveInput(input);
      router.push('/result');
    } catch (err) {
      setError(err instanceof Error ? err.message : '입력값을 확인해 주세요.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <p className="eyebrow">1 / 2 단계</p>
      <h1>태어난 날을 알려 주세요</h1>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="field">
        <span className="label">달력</span>
        <div className="seg">
          <button type="button" aria-pressed={calendar === 'solar'} onClick={() => setCalendar('solar')}>양력</button>
          <button type="button" aria-pressed={calendar === 'lunar'} onClick={() => setCalendar('lunar')}>음력</button>
        </div>
        {calendar === 'lunar' && (
          <label className="check">
            <input type="checkbox" checked={leap} onChange={(e) => setLeap(e.target.checked)} />
            <span>윤달에 태어났어요</span>
          </label>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="year">생년월일</label>
        <div className="row">
          <input
            id="year" type="number" inputMode="numeric" placeholder="예: 1992"
            min={MIN_YEAR} max={MAX_YEAR} value={year} onChange={(e) => setYear(e.target.value)}
            aria-label="태어난 해"
          />
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="태어난 달">
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}월</option>)}
          </select>
          <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="태어난 날">
            {Array.from({ length: calendar === 'lunar' ? 30 : 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}일</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <span className="label">태어난 시간</span>
        {!timeUnknown && (
          <div className="row">
            <select value={hour} onChange={(e) => setHour(e.target.value)} aria-label="시">
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i < 12 ? '오전' : '오후'} {i % 12 === 0 ? 12 : i % 12}시 ({i}시)</option>
              ))}
            </select>
            <select value={minute} onChange={(e) => setMinute(e.target.value)} aria-label="분">
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i * 5}>{i * 5}분</option>)}
            </select>
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} />
          <span>태어난 시간을 몰라요 (시간 기둥 없이 풀이합니다)</span>
        </label>
      </div>

      <div className="field">
        <span className="label">성별</span>
        <div className="seg">
          <button type="button" aria-pressed={gender === 'female'} onClick={() => setGender('female')}>여성</button>
          <button type="button" aria-pressed={gender === 'male'} onClick={() => setGender('male')}>남성</button>
        </div>
        <p className="small" style={{ marginTop: 6 }}>대운(10년 단위 흐름)의 방향을 정하는 데만 씁니다.</p>
      </div>

      <details className="more">
        <summary>계산 기준 바꾸기 (선택)</summary>
        <label className="check">
          <input type="checkbox" checked={trueSolar} onChange={(e) => setTrueSolar(e.target.checked)} />
          <span>진태양시 보정 적용 (시계 시간과 실제 해의 위치 차이 약 30분을 바로잡습니다)</span>
        </label>
        <div style={{ marginTop: 12 }}>
          <label className="label" htmlFor="boundary">밤 11시대에 태어난 경우</label>
          <select id="boundary" value={dayBoundary} onChange={(e) => setDayBoundary(e.target.value as DayBoundary)}>
            <option value="midnight">자정에 날짜가 바뀐다고 봄 (기본)</option>
            <option value="jasi">밤 11시부터 다음 날로 봄</option>
            <option value="splitJasi">날짜는 그대로, 시간 기둥만 다음 날 기준</option>
          </select>
        </div>
        <p className="small" style={{ marginTop: 10 }}>
          이 기준은 보는 사람마다 다릅니다. 잘 모르면 그대로 두세요. 적용한 기준은 결과 화면에 적어 드립니다.
        </p>
      </details>

      <button type="submit" className="btn accent" disabled={busy}>
        {busy ? '확인하는 중' : '결과 보기'}
      </button>
      <p className="small" style={{ marginTop: 12 }}>
        이름과 연락처는 받지 않습니다. 입력한 값은 다음에 편하게 쓰도록 이 휴대폰에만 기억해 둡니다.
      </p>
    </form>
  );
}
