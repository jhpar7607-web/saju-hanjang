// 자세한 풀이의 공개 설정
// 빌드할 때 NEXT_PUBLIC_PREMIUM_OPEN=1 이면 체험 공개(전부 보임), 아니면 잠금(첫 문단만 보임).
// 구글 플레이 결제가 붙으면 이 값 대신 구매 여부로 연다.

export const PREMIUM_OPEN = process.env.NEXT_PUBLIC_PREMIUM_OPEN === '1';

/** 자세한 풀이 항목 순서 (메뉴와 이전/다음 이동에 쓴다) */
export const DETAIL_ORDER = [
  'money', 'career', 'love', 'health', 'study', 'people', 'family',
  'year1', 'year5', 'decade', 'life',
] as const;
