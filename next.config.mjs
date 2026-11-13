// Next.js 설정
// STATIC_EXPORT=1 이면 서버 없이 올릴 수 있는 정적 파일로 내보낸다 (깃허브 무료 주소용).
const isStatic = process.env.STATIC_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const common = { poweredByHeader: false };

const staticConfig = {
  ...common,
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

const serverConfig = {
  ...common,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        // 유료 리포트 주소는 검색 엔진에 잡히지 않게 한다.
        source: '/report/:token',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default isStatic ? staticConfig : serverConfig;
