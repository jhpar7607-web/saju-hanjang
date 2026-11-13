// 접속 증가 시험: 동시에 100명이 계산과 무료 풀이를 요청한다.
const base = 'http://localhost:3100';
const mk = (i) => ({ year: 1950 + (i % 70), month: 1 + (i % 12), day: 1 + (i % 28), hour: i % 24, minute: 0, calendar: 'solar', leap: false, gender: i % 2 ? 'male' : 'female', trueSolar: true, dayBoundary: 'midnight', device: 'load' + i });
async function round(path, n) {
  const t0 = Date.now(); const times = [];
  const res = await Promise.all(Array.from({ length: n }, async (_, i) => {
    const s = Date.now();
    const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(mk(i)) });
    await r.text(); times.push(Date.now() - s); return r.status;
  }));
  times.sort((a, b) => a - b);
  const okN = res.filter((s) => s === 200).length;
  console.log(`${path} 동시 ${n}건: 성공 ${okN}건, 전체 ${Date.now() - t0}ms, 가운데 ${times[Math.floor(n / 2)]}ms, 가장 느림 ${times[n - 1]}ms`);
  return okN === n;
}
let ok = true;
ok = (await round('/api/chart', 100)) && ok;
ok = (await round('/api/reading', 100)) && ok;
ok = (await round('/api/reading', 300)) && ok;
process.exit(ok ? 0 : 1);
