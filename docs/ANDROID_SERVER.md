# 익명 로그인 및 새 Render + Supabase 서버

Android `/auth/android` 인증이 구현되어 있다. 기존 화면과 게임/추천/거래 규칙을 유지하며 PostgreSQL에 사용자·세션·진행 기록을 저장한다. 기존 토스 운영 DB/서버와 별도의 새 프로젝트를 사용한다.

2026-11-18 현재 새 Android 서버는 `https://aimi-api.onrender.com`이며 Render Free 서비스 `aimi-api`와 Supabase `aimii` 프로젝트를 사용한다. 아래 Blueprint 예시는 Starter 기반의 새 배포 절차다. 현재 서비스는 migration 9개를 별도로 적용했고 런타임 `aimi_api` 계정으로 기동 전 DB 확인을 수행하므로 관리자 `MIGRATION_DATABASE_URL`을 서버에 보관하지 않는다. `AIMI_GEMINI_API_KEY` 등록과 배포 `live`는 확인했지만 공개 HTTP·Gemini 실제 요청은 현재 환경의 네트워크 제한으로 미검증이다.

## 인증 동작

앱은 최초 실행 시 256비트 설치 비밀값을 Android Preferences에 저장한다. `POST /auth/android`의 `installationSecret`을 서버가 검증하여 HMAC으로 저장하고 1시간짜리 세션을 발급한다. 원문 비밀값/세션은 DB나 로그에 저장하지 않는다. 동시 첫 로그인은 하나의 계정으로 합쳐지고 만료 세션은 같은 계정으로 갱신한다. 서버 재시작에도 기록을 유지한다.

회원가입/토스 인증서/Google OAuth 설정은 필요 없다. 설치 비밀값은 비밀번호처럼 취급한다. 앱 삭제·데이터 초기화·기기 변경 시 복원할 수 없다. 로그아웃은 현재 세션만 폐기하고, 계정 삭제는 세션·진행 기록·친구 연결을 제거한다. 삭제 후 다시 시작하면 새 계정이 생성된다.

로그인은 DB 기준으로 IP당 분당 30회, 설치 비밀값당 분당 10회로 제한한다. 활성 세션은 계정당 최대 5개다. 익명 계정 재생성 자체를 완전히 방지하는 기기 인증/Play Integrity는 포함하지 않았다.

## 1. 새 Supabase 준비

새 프로젝트를 생성한다. 실제 비밀번호나 키를 GitHub/채팅에 올리지 않는다.

로컬 `apps/api/.env.local`에 새 DB의 관리자 연결을 `MIGRATION_DATABASE_URL`로 넣는다. Supabase의 Connect 메뉴에서 direct connection 또는 **session pooler(5432)**를 사용한다. migration의 advisory lock에는 transaction pooler(6543)를 사용하지 않는다.

```sh
npm ci
npm run build:api
npm run db:migrate
npm run db:provision --workspace @aimi/api
```

마지막 명령은 `aimi_api` 최소 권한 계정을 생성하고 `.env.local`의 `DATABASE_URL`에 런타임 연결을 저장한다. 기존 역할을 덮어쓰지 않는다. 원래 `MIGRATION_DATABASE_URL`과 새 `DATABASE_URL`을 각각 보관한다. 실제 운영 DB에 이 bootstrap을 반복하지 않는다.

## 2. 새 Render 준비

저장소의 `render.yaml`을 Blueprint로 사용하여 **새 서비스**를 생성한다. Starter 요금제 설정이므로 Render에서 요금과 리전을 확인한다. 기존 Render 서비스를 교체하지 않는다. Blueprint 자동 배포는 꺼져 있다.

Render의 비밀 환경변수:

| 변수 | 값 |
| --- | --- |
| `DATABASE_URL` | 위에서 생성한 `aimi_api` 런타임 연결 |
| `MIGRATION_DATABASE_URL` | 새 Supabase 관리자/session pooler 연결 |
| `SESSION_SIGNING_KEY` | Blueprint가 생성. 계정 HMAC에 사용하므로 계속 유지하며 별도 보관 |
| `AIMI_GEMINI_API_KEY` | 본인의 Gemini API 키. AI 기능에 필요 |

`CORS_ALLOWED_ORIGINS=https://localhost`는 Android WebView origin이다. `TRUST_PROXY_HOPS=1`은 Render 바로 앞 프록시를 신뢰한다. 다른 호스팅에서는 실제 프록시 구조에 맞추고, 직접 노출 서버는 0으로 둔다. `ENABLE_DEV_AUTH`/`ENABLE_TEST_DEMO`는 false를 유지한다. 개발 fixture를 운영에 사용하지 않는다.

기존 검수된 10일 챌린지는 `AIMI_CONTENT_SOURCE=bundled`로 사용하며 이미지 경로는 APK 에셋을 가리킨다. `AIMI_RELEASE_VERSION=prototype-v1-reviewed`가 기존 서버의 출시 플래그다. 이 두 값은 Blueprint에 포함되어 있다.

배포는 `npm ci && npm run build:api`, `npm run db:migrate`, `npm run start:api` 순서다. `/health/ready`는 Android DB migration까지 적용되어야 200을 반환한다. Gemini 키가 없으면 인증/게임/정원은 가능하지만 AI 요청은 성공하지 않는다.

## 3. APK에 새 서버 연결

Android 전용 설정 `apps/miniapp/.env.android`에 새 서버 `https://aimi-api.onrender.com`을 연결했다. 다른 서버를 사용하려면 `apps/miniapp/.env.android.local`에 설정한다.

```dotenv
VITE_API_BASE_URL=https://실제-새-서비스.onrender.com
VITE_TEST_DEMO=false
```

```sh
npm run android:sync
cd android
./gradlew assembleDebug
```

APK에 서버 주소가 포함되므로 기존 APK는 주소 변경만으로 갱신되지 않는다. 기존 APK 위에 업데이트 설치하려면 같은 서명키를 사용한다.

## 검증

`npm test`: 기존 단위/게임/콘텐츠 테스트.
`npm run test:db`: 기존 PostgreSQL 통합 테스트(별도의 로컬 테스트 DB/관리자 연결 전용).
`npm run test:android --workspace @aimi/api`: 실제 로컬 PostgreSQL에서 동시 로그인, 계정 분리, 기록 복원, 프로필, 출석, 친구/정원, 만료/로그아웃/삭제, CORS, 개발 인증 차단, 요청 제한 및 세션 상한을 검사한다.

프로덕션 DB에 테스트를 실행하지 않는다. 새 Render/Supabase의 실제 배포, Gemini 호출, 휴대폰 네트워크 동작은 해당 환경의 값이 준비된 뒤 별도 확인해야 한다.
