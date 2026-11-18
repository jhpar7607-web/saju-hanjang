// S1. 첫 화면
import Link from 'next/link';
import VisitLog from '@/components/VisitLog';

export default function Home() {
  return (
    <>
      <VisitLog type="visit" />
      <p className="eyebrow">2027 정미년(丁未年) 신년운세와 평생 사주</p>
      <h1>가입 없이 30초,<br />내 사주를 한 장으로</h1>
      <p className="lead">
        생년월일만 넣으면 사주 여덟 글자와 2027년 운세를 쉬운 말로 풀어 드립니다. 재물, 직업, 연애, 건강처럼 궁금한 주제와 5년운, 10년운, 인생 시기별 흐름도 골라 볼 수 있습니다.
      </p>
      <div className="stack" style={{ margin: '22px 0 26px' }}>
        <Link href="/input" className="btn accent">내 사주 보기</Link>
      </div>

      <div className="card">
        <h3>계산 근거가 보입니다</h3>
        <p className="lead" style={{ fontSize: 15, margin: 0 }}>
          한국천문연구원 자료 기준 만세력으로 계산하고, 어떤 기준을 썼는지 결과 화면에 그대로 적습니다.
        </p>
      </div>
      <div className="card">
        <h3>말이 쉽습니다</h3>
        <p className="lead" style={{ fontSize: 15, margin: 0 }}>
          어려운 한자 용어 옆에 누구나 알 수 있는 풀이를 붙였습니다.
        </p>
      </div>
      <div className="card">
        <h3>궁금한 운을 골라 봅니다</h3>
        <p className="lead" style={{ fontSize: 15, margin: 0 }}>
          재물운, 성공·직업운, 연애·결혼운, 건강운, 학업·시험운, 대인관계운, 가족운과 1년운, 5년운, 10년운, 초년부터 노년까지의 흐름을 따로 풀어 드립니다.
        </p>
      </div>
      <div className="card">
        <h3>한 장으로 끝납니다</h3>
        <p className="lead" style={{ fontSize: 15, margin: 0 }}>
          핵심을 카드 한 장으로 만들어 가족, 친구와 바로 나눌 수 있습니다.
        </p>
      </div>
      <p className="small">
        이름과 연락처는 받지 않습니다. 무료 이용 시 입력한 생년월일은 서버에 저장하지 않습니다.
      </p>
    </>
  );
}
