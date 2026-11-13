# 사주한장

2027 정미년 신년운세를 한 장으로 보여 주는, 가입 없는 모바일 웹 서비스입니다.
사주 계산은 한국천문연구원 자료 기반 만세력 라이브러리(manseryeok)가 맡고, 풀이 글은 AI 또는 규칙 기반 엔진이 씁니다.

## 바로 실행하기

```bash
npm install
npm run dev        # http://localhost:3000
```

열쇠를 하나도 넣지 않아도 동작합니다. 이때는 규칙 기반 풀이, 파일 저장소(.data 폴더), 모의 결제로 움직입니다.

## 명령

| 명령 | 하는 일 |
| --- | --- |
| npm run dev | 개발 서버 |
| npm run build | 운영용 빌드 |
| npm run start | 운영 서버 (빌드 후) |
| npm test | 자동 시험 53건 |
| npm run typecheck | 형식 검사 |
| python3 scripts/e2e.py http://localhost:3000 | 브라우저 사용 흐름 점검 52건 (개발 서버, 크롬과 playwright 필요) |
| node scripts/build-static.mjs | 정적 웹 빌드 (out 폴더) |
| python3 scripts/e2e-static.py | 정적 웹 브라우저 점검 13건 |
| node scripts/load.mjs | 접속 증가 시험 (운영 서버를 3100번으로 띄운 뒤) |

## 환경 변수

`.env.example` 을 `.env.local` 로 복사해 채웁니다.

| 묶음 | 변수 | 비워 두면 |
| --- | --- | --- |
| AI | ANTHROPIC_API_KEY, AI_MODEL_FREE, AI_MODEL_PAID, AI_DAILY_LIMIT | 규칙 기반 풀이 |
| 결제 | NEXT_PUBLIC_TOSS_CLIENT_KEY, TOSS_SECRET_KEY | 개발 환경은 모의 결제, 운영 환경은 '결제 준비 중' |
| 저장소 | SUPABASE_URL, SUPABASE_SERVICE_KEY | .data 폴더 파일 저장 |
| 가격 | PRICE_REGULAR, PRICE_PROMO, PROMO_START, PROMO_END | 3,900원 / 2,900원 / 2026-12-14 ~ 2027-01-03 |
| 사업자 | NEXT_PUBLIC_BIZ_* 6개 | 안내 화면에 '입력 필요' 표시 |
| 기타 | NEXT_PUBLIC_SITE_URL | http://localhost:3000 |

## 폴더 구조

```
src/lib/saju/engine.ts    사주 계산 (입력 검사, 여덟 글자, 오행, 십신, 대운)
src/lib/saju/texts.ts     풀이 문장 재료
src/lib/saju/reading.ts   규칙 기반 풀이 (무료, 유료)
src/lib/saju/ai.ts        Claude 연결과 답 형식 검사
src/lib/saju/safety.ts    금지 표현 검사
src/lib/service.ts        저장된 글 → AI → 규칙 순서로 풀이 마련
src/lib/orders.ts         주문, 결제 승인, 실패 시 자동 취소
src/lib/store.ts          저장소 (파일 / Supabase)
src/lib/config.ts         설정과 가격
src/lib/ratelimit.ts      호출 제한
src/app/                  화면 6개와 서버 기능
src/components/           사주 표, 공유 카드, 신고 버튼
supabase/schema.sql       저장 표 3개 정의
tests/                    자동 시험
scripts/                  브라우저 점검, 접속 증가 시험
```

## 서버 기능

| 주소 | 하는 일 |
| --- | --- |
| POST /api/chart | 사주 계산 |
| POST /api/reading | 무료 풀이 |
| GET /api/orders | 가격 정보 |
| POST /api/orders | 주문 만들기 (금액은 서버가 정함) |
| POST /api/orders/confirm | 결제 승인 확인, 유료 리포트 생성 |
| GET /api/report/{주소 값} | 유료 리포트 조회 |
| POST /api/log | 이용 기록, 신고 접수 |

공유 카드는 서버가 아니라 휴대폰 화면에서 직접 그립니다. 한글 글꼴 문제를 피하고 서버 비용을 줄이기 위해서입니다.

## 배포 순서 (Vercel + Supabase)

1. Supabase 에서 프로젝트를 만들고 SQL 편집기에서 `supabase/schema.sql` 을 실행합니다.
2. Vercel 에 이 폴더를 올리고 환경 변수를 넣습니다. SUPABASE_SERVICE_KEY 와 TOSS_SECRET_KEY, ANTHROPIC_API_KEY 는 서버 전용 값입니다.
3. 도메인을 연결하고 NEXT_PUBLIC_SITE_URL 을 그 주소로 바꿉니다.
4. 토스페이먼츠 심사가 끝나면 시험용 열쇠를 실제 열쇠로 바꿉니다.

운영 환경에서는 반드시 Supabase 를 연결해야 합니다. Vercel 같은 서버리스 환경은 파일을 저장할 수 없어 주문이 남지 않습니다.

## 두 가지 배포 방식

| 방식 | 명령 | 되는 기능 | 올리는 곳 |
| --- | --- | --- | --- |
| 서버 방식 | npm run build | 전부 (AI, 결제, 유료 리포트, 이용 기록) | Vercel 같은 서버 |
| 정적 방식 (무료판) | node scripts/build-static.mjs | 입력, 사주 표, 규칙 기반 풀이, 공유 카드, 안내 | 깃허브 무료 주소 |

정적 방식은 계산과 풀이를 휴대폰 안에서 합니다. 입력한 생년월일은 서버로 나가지 않습니다.

## 깃허브 자동 빌드

main 가지에 올리면 두 작업이 자동으로 돕니다.

| 작업 | 파일 | 하는 일 |
| --- | --- | --- |
| 웹 시험과 배포 | .github/workflows/web.yml | 자동 시험, 형식 검사, 정적 웹 빌드, 깃허브 무료 주소 배포 |
| 안드로이드 앱 빌드 | .github/workflows/android.yml | 시험 설치용 APK, 서명 열쇠가 있으면 제출용 AAB |

결과 파일은 깃허브 저장소의 Actions → 해당 실행 → Artifacts 에서 내려받습니다.

## 안드로이드 앱 (TWA)

- 프로젝트 위치: android 폴더
- 패키지 이름: io.github.jhpar7607web.sajuhanjang
- 감싸는 주소: https://jhpar7607-web.github.io/saju-hanjang/?app=1 (android/app/build.gradle 의 webHost, webPath)
- 대상 API 36, 최소 API 23, 버전 1.0.0

### 서명 열쇠 만들기 (한 번만)

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 upload.jks > upload.jks.base64     # 맥에서는: base64 -i upload.jks -o upload.jks.base64
```

저장소 Settings → Secrets and variables → Actions 에 아래 4개를 등록합니다.

| 이름 | 값 |
| --- | --- |
| KEYSTORE_BASE64 | upload.jks.base64 파일의 내용 |
| KEYSTORE_PASSWORD | 열쇠 파일 비밀번호 |
| KEY_ALIAS | upload |
| KEY_PASSWORD | 열쇠 비밀번호 |

upload.jks 파일과 비밀번호는 저장소에 올리지 말고 따로 보관합니다. 잃어버리면 앱을 업데이트할 수 없습니다.

### 주소창 없애기 (확인 파일)

확인 파일은 주소의 맨 위에 있어야 합니다: https://jhpar7607-web.github.io/.well-known/assetlinks.json
이 위치는 jhpar7607-web.github.io 라는 이름의 저장소만 올릴 수 있습니다. 그 저장소에 public/.well-known/assetlinks.json 을 올리고,
파일 안의 지문 자리에 빌드 기록에 출력된 SHA256 값을 넣습니다. 플레이 스토어에 올린 뒤에는 플레이 콘솔의 '앱 서명' 화면에 나오는 지문도 함께 넣어야 합니다.
그 저장소에는 빈 .nojekyll 파일도 함께 올려야 점으로 시작하는 폴더가 배포됩니다.

## 확인된 것과 확인되지 않은 것

- 확인됨: 계산 대조(한국천문연구원 2027 자료 13건, 설명서 예시, 두 번째 프로그램과 120건), 풀이 200건 금지 표현 검사, 모의 결제 전 과정, 브라우저 사용 흐름, 동시 300건 요청.
- 가짜 응답으로만 확인됨: Claude, 토스페이먼츠, Supabase 연결부. 실제 계정의 열쇠를 넣은 뒤 한 번씩 실제로 확인해야 합니다.
- 하지 않음: 실제 도메인 배포, 안드로이드 앱 빌드와 스토어 등록.

## 라이선스

- manseryeok: MIT (Yoohyojun)
- lunar-javascript: MIT (시험에서만 사용)
