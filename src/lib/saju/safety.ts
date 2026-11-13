// 금지 표현 검사
// 겁을 주거나 단정하는 표현, 질병 진단, 투자 종목 추천이 풀이 글에 섞이지 않게 막는다.

import type { FreeReading, PaidReport } from './types';

/** 금지 표현 목록. 이름은 신고와 기록에 쓰인다. */
export const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: '죽음', pattern: /(죽음|죽을|죽는|죽게|사망|단명|요절|목숨을\s*잃)/ },
  { name: '큰 사고', pattern: /(큰\s*사고|교통사고|대형\s*사고|수술을?\s*(하게|받게))/ },
  { name: '이혼·파산 단정', pattern: /(이혼|파산|부도|망한다|망하게|망할)/ },
  { name: '질병 진단', pattern: /(암에|암이|암을|우울증|공황장애|당뇨|고혈압|뇌졸중|심장병|진단)/ },
  { name: '투자 권유', pattern: /(주식\s*종목|종목\s*추천|코인|비트코인|로또\s*번호|대박|일확천금|투자하면)/ },
  { name: '단정 표현', pattern: /(반드시|절대로|절대\s|틀림없이|100\s*%|백\s*퍼센트)/ },
  { name: '공포 조장', pattern: /(재앙|저주|흉살|횡액|급살|큰\s*화를)/ },
];

/** 글에서 걸리는 금지 표현의 이름을 돌려준다. 없으면 빈 배열. */
export function findForbidden(text: string): string[] {
  const hits: string[] = [];
  for (const f of FORBIDDEN) {
    if (f.pattern.test(text)) hits.push(f.name);
  }
  return hits;
}

/** 풀이 전체를 하나의 글로 이어 붙인다. */
export function flatten(reading: FreeReading | PaidReport): string {
  if (reading.kind === 'free') {
    return [
      reading.personalityTitle, reading.personality, reading.yearLine,
      reading.yearSummary, ...reading.keywords,
    ].join('\n');
  }
  return [
    ...reading.sections.map((s) => `${s.title}\n${s.body}`),
    ...reading.months.map((m) => m.body),
    ...reading.actions,
  ].join('\n');
}

/** 풀이가 안전한지 검사한다. */
export function isSafe(reading: FreeReading | PaidReport): { ok: boolean; hits: string[] } {
  const hits = findForbidden(flatten(reading));
  return { ok: hits.length === 0, hits };
}
