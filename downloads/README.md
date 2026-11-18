# AIMI Android APK

[새 로고를 적용한 APK 다운로드](https://github.com/rktzjql/slooooppp/raw/refs/heads/main/downloads/aimi-debug.apk)

- 직접 설치용 debug APK이며 Google Play 출시용 빌드는 아니다.
- 앱 ID: `com.aimi.android`, 버전 **1.0.2 (3)**, Android 6.0 이상, target SDK 35.
- 앱 아이콘: 사용자 선택 시안의 크림색 배경과 진한 초록색 AIMI 로고. 기본·원형·적응형 아이콘에 적용했다.
- 빌드일: 2026-11-18. 연결 주소: **https://aimi-api.onrender.com**.
- Android 전용 `.env.android`를 읽어 빌드한다. 테스트 데모는 꺼져 있고 Gemini·DB·세션 비밀키는 APK에 포함하지 않는다.
- 무료 Render 서버의 첫 기동을 기다리도록 Android 로그인 요청에 최대 90초를 허용한다.

## 설치

APK를 휴대폰에서 내려받아 설치하고 앱의 **시작하기**를 누른다.

이번 **1.0.2는 1.0.1과 같은 서명키**를 사용하므로 삭제하지 않고 업데이트 설치할 수 있다. 1.0.1을 설치했다면 그대로 APK를 실행한다.

그보다 이전 1.0 APK와는 서명이 다르다. 이전 1.0이 설치되어 있다면 삭제 후 설치해야 하며, **삭제하면 앱 저장 데이터와 익명 계정 자격증명도 사라진다**. 보존할 기록이 있다면 삭제하지 말고 기존 서명키로 재빌드해야 한다. 서명키는 저장소에 포함하지 않는다.

## 확인한 항목

- JDK 21 / Gradle 8.11.1 / SDK 35 `assembleDebug` 성공.
- TypeScript/Vite Android 빌드, Capacitor 플러그인 4개 동기화 완료.
- 로그인 중복 방지·설치 자격증명 재사용·세션 갱신·사용자 전환·읽기 병합 검사 8개 통과.
- APK v1/v2 서명, zipalign, ZIP 무결성, 버전·인터넷 권한 확인.
- APK 안의 새 API 주소 및 `/auth/android` 경로 확인. 이전 서버 주소와 서버 비밀키 미포함 확인.
- Render의 새 서비스 배포 상태 `live`, 이전 단계에서 런타임 DB 접속과 migration 확인 완료.

## 아직 확인하지 못한 항목

- 현재 빌드 환경의 외부 요청 정책이 Render 공개 주소 접속을 차단한다. 따라서 이 APK의 실제 서버 로그인·저장·실기기 실행 성공은 아직 확인하지 못했다.
- Gemini 키는 새 서버에 등록되어 있으나 실제 개선·추천 요청은 미검증이다.
- 모델 추천 자료는 2026-11-10 검수 이후 유효기간이 지났다. 추천 기능 정상화를 위해 실제 근거를 다시 검수해야 하며 날짜만 바꿔 우회하지 않았다.

파일 무결성 확인: `sha256sum -c aimi-debug.apk.sha256`

[Android 빌드 문서](../docs/ANDROID_BUILD.md) · [서버 설정](../docs/ANDROID_SERVER.md)
