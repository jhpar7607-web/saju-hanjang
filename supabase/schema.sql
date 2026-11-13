-- 사주한장 저장 표 3개 (Supabase SQL 편집기에서 한 번 실행)
-- 이름, 전화번호, 이메일은 어디에도 저장하지 않는다.

-- 1) 풀이 글: AI 가 쓴 글을 저장해 같은 사주에 다시 쓴다.
create table if not exists readings (
  key text primary key,              -- 상품|지시문 버전|여덟 글자|성별|대운
  content jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

-- 2) 주문: 결제와 유료 리포트를 잇는다.
create table if not exists orders (
  id text primary key,               -- 주문 번호
  token text not null unique,        -- 리포트 전용 주소 값 (64자 무작위)
  input jsonb not null,              -- 입력한 생년월일시와 성별
  amount integer not null,
  status text not null check (status in ('pending','paid','failed','refunded')),
  payment_key text,
  report jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- 3) 이용 기록: 지표 계산과 신고 접수에 쓴다. 90일 뒤 지운다.
create table if not exists events (
  id bigint generated always as identity primary key,
  type text not null,
  device text not null,
  meta jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists events_type_at on events (type, at);

-- 서버 열쇠(service key)로만 접근하도록 행 수준 보안을 켠다. 공개 열쇠에는 권한을 주지 않는다.
alter table readings enable row level security;
alter table orders enable row level security;
alter table events enable row level security;

-- 90일 지난 이용 기록 지우기 (필요할 때 실행하거나 예약 작업으로 등록)
-- delete from events where at < now() - interval '90 days';

-- 지표 5개 조회 예시
-- select type, count(*) from events where at >= now() - interval '7 days' group by type;
