// 환경 설정 모음. 값이 비어 있으면 로컬 대체 방식으로 동작한다.

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  ai: {
    key: process.env.ANTHROPIC_API_KEY || '',
    modelFree: process.env.AI_MODEL_FREE || 'claude-haiku-5-5',
    modelPaid: process.env.AI_MODEL_PAID || 'claude-sonnet-5-5',
    dailyLimit: num(process.env.AI_DAILY_LIMIT, 3000),
  },
  toss: {
    clientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || '',
    secretKey: process.env.TOSS_SECRET_KEY || '',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_KEY || '',
  },
  price: {
    regular: num(process.env.PRICE_REGULAR, 3900),
    promo: num(process.env.PRICE_PROMO, 2900),
    promoStart: process.env.PROMO_START || '2026-12-14',
    promoEnd: process.env.PROMO_END || '2027-01-03',
  },
  /** 풀이 지시문 버전. 지시문이나 규칙 문장을 바꾸면 숫자를 올린다. */
  promptVersion: 'v1',
  productName: '2027 정미년 신년운세 상세 리포트',
};

/** 한국 시각 기준 오늘 날짜를 'YYYY-MM-DD' 로 돌려준다. */
export function kstDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 지금 적용되는 가격. 오픈 기념 기간이면 기념가를 돌려준다. */
export function currentPrice(now: Date = new Date()): {
  amount: number;
  regular: number;
  promo: boolean;
  promoEnd: string;
} {
  const today = kstDate(now);
  const { regular, promo, promoStart, promoEnd } = config.price;
  const inPromo = promo < regular && today >= promoStart && today <= promoEnd;
  return { amount: inPromo ? promo : regular, regular, promo: inPromo, promoEnd };
}

/** 실제 결제가 가능한지 (토스 열쇠 두 개가 모두 있어야 한다) */
export function paymentReady(): boolean {
  return Boolean(config.toss.clientKey && config.toss.secretKey);
}

/** 모의 결제를 허용하는지 (운영 환경에서는 항상 금지) */
export function mockPaymentAllowed(): boolean {
  return !paymentReady() && process.env.NODE_ENV !== 'production';
}
