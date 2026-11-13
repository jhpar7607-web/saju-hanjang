import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
// 깃허브 무료 주소처럼 주소 뒤에 폴더 이름이 붙는 경우의 앞머리
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: '사주한장 | 2027 정미년 신년운세', template: '%s | 사주한장' },
  description: '가입 없이 30초. 한국천문연구원 자료 기준 만세력으로 계산하고, 쉬운 말로 풀어 한 장으로 보여 드립니다.',
  manifest: `${base}/manifest.webmanifest`,
  icons: { icon: `${base}/icon.svg`, apple: `${base}/icon-192.png` },
  openGraph: {
    title: '사주한장 | 2027 정미년 신년운세',
    description: '가입 없이 30초, 결과는 한 장.',
    type: 'website',
    locale: 'ko_KR',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1b1f3b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="wrap">
          <header className="top">
            <Link href="/" className="brand">사주<span>한장</span></Link>
            <Link href="/info" className="toplink">안내</Link>
          </header>
          <main>{children}</main>
          <footer className="foot">
            <p>
              <Link href="/info#terms">이용약관</Link>
              <Link href="/info#privacy">개인정보 처리방침</Link>
              <Link href="/info#refund">환불 규정</Link>
              <Link href="/info#biz">사업자 정보</Link>
            </p>
            <p>풀이는 참고용이며 일부는 AI가 작성합니다. 중요한 결정은 전문가와 상의하세요.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
