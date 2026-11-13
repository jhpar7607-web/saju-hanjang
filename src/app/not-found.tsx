import Link from 'next/link';

export default function NotFound() {
  return (
    <>
      <h1>찾는 화면이 없습니다</h1>
      <p className="lead">주소가 바뀌었거나 잘못 입력되었습니다.</p>
      <Link href="/" className="btn">첫 화면으로</Link>
    </>
  );
}
