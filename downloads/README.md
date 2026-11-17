# AIMI Android APK

[aimi-debug.apk 다운로드](https://github.com/rktzjql/slooooppp/raw/refs/heads/main/downloads/aimi-debug.apk)

- 직접 설치용 debug APK. Google Play 출시용 서명 빌드가 아니다.
- 앱 ID: `com.aimi.android`, 버전 1.0 (1), Android 6.0 이상, target SDK 35.
- 소스: `c48c428`, 빌드일: 2026-11-17.
- JDK 21 / Gradle 8.11.1 / SDK 35로 `assembleDebug` 성공.
- APK v1/v2 서명, zipalign, ZIP 무결성, 웹 에셋 및 네이티브 플러그인 4개 포함 확인.
- 실기기 설치/실행은 아직 검증하지 않았다.
- 새 API 주소 미설정. 로그인 및 서버 기능은 새 서버 구현과 주소 설정 후 재빌드해야 한다. 기존 운영 서버에 연결하지 않는다.
- 서명키는 GitHub에 포함하지 않았다. 다른 키로 재빌드한 APK는 기존 앱 위에 업데이트 설치되지 않을 수 있다.

파일 무결성 확인: `sha256sum -c aimi-debug.apk.sha256`

서버 연결 및 재빌드는 [Android 빌드 문서](../docs/ANDROID_BUILD.md)를 참고한다.
