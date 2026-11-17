# Android 전환 실행 및 새 서버 연결

기존 화면/CSS/게임/추천 규칙/콘텐츠/서버 소스는 유지하고 React를 Capacitor 7 Android 앱으로 패키징한다. 토스 SDK 및 TDS 런타임은 제거하고 기존 CSS 버튼을 사용한다. 앱 ID 기본값은 `com.aimi.android`이다.

## 빌드

Node 22.12+, JDK 21, Android Studio/SDK 35 필요.

```sh
npm ci
# apps/miniapp/.env.local에 아래 한 줄 설정 (실제 새 서버 주소)
# VITE_API_BASE_URL=https://YOUR-NEW-API-HOST
npm run android:sync
npm run android:open
# 또는
cd android
./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
서명 배포는 Android Studio에서 별도 키로 진행한다. 키를 저장소에 넣지 않는다.
API 주소는 빌드 시 포함되므로 변경 후 `android:sync`와 APK 재빌드가 필요하다.
주소 미설정 시 앱 화면은 열리지만 서버 요청은 차단하고 안내한다. 기존 Render 서버로 대체 연결하지 않는다.

## 사용자가 구현할 서버 계약

기존 `apps/api`는 참고 소스로 보존되어 있으며 새 Android 서버를 구현/배포하지 않았다.

- `POST /auth/android`: `{ "installationSecret": "64자리 hex" }`를 받고 기존 `SessionResult`에 맞는 `{ "token": "서버가 발급한 토큰" }` 반환.
- 설치별 256비트 난수는 Android 앱 전용 Preferences에 보관한다. 서버는 이를 비밀번호와 같은 비밀로 취급하고 해시로 저장하며 로그에 남기지 않는다. 최초 요청 시 익명 계정을 생성하고 이후 같은 비밀로 해당 계정 세션을 재발급한다. 요청 빈도 제한과 세션 만료/폐기를 구현한다.
- 앱은 기존 API와 동일하게 `Authorization: Bearer …` 및 변경 요청의 `Idempotency-Key`를 보낸다. 나머지 경로/스키마는 `apps/api/src/modules`와 `packages/contracts`를 따른다.
- CORS는 Capacitor origin `https://localhost`를 허용하고 필요한 Authorization/Content-Type/Idempotency-Key 헤더를 허용한다. 실제 API는 HTTPS를 사용한다.
- 토스 사용자 코드나 클라이언트 지정 사용자 ID를 인증으로 받지 않는다. 기존 토스 계정 자동 이전은 없다.
- 앱 삭제/데이터 초기화 시 익명 계정 자격증명을 잃는다. 기기 변경 복구가 필요하면 별도 로그인/계정 연결 기능이 필요하다. Android 백업은 비활성화했다.
- Gemini 키 및 DB 연결정보는 서버에만 둔다.

공유는 Android 공유 시트로 친구 코드를 전달한다. 토스 딥링크는 사용하지 않는다. 뒤로가기는 기존 화면 전환/게임 확인 흐름에 연결하고 종료는 Android 앱 종료로 처리한다.

## 검증 범위

웹 TypeScript/Vite 빌드와 Capacitor 플러그인 동기화를 검증한다. 실제 서버 인증, 실기기 인셋/키보드/게임, 서명 APK/AAB 테스트는 새 서버와 Android 빌드 환경에서 별도 수행해야 한다.

2026-11-17: 클라우드에서 JDK 21/Gradle 8.11.1/SDK 35로 `assembleDebug` 성공. [설치용 APK와 검증 범위](../downloads/README.md). 기존 다운로드 실패는 Java의 프록시 설정 누락을 수정해 해결했으며, 별도로 JDK 컴파일러와 Android SDK를 설치했다.
