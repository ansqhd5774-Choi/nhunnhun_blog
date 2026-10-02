# PC를 꺼도 실행되는 티스토리 자동 발행

설계: GitHub main의 posts/*.json 변경 → GitHub Actions 형식/승인 검사 → Browserbase 클라우드 브라우저 → 티스토리 공식 에디터 → 공개 발행 → 제목/본문 실사이트 확인 → GitHub 발행 기록.

2026-10-02 현재: 코드 작성·로컬 검증 완료. 클라우드 계정/세션 연결 및 실제 발행 미검증. 발행 작업은 저장소 변수 TISTORY_PUBLISH_ENABLED가 true인 경우에만 실행되며 아직 설정하지 않았다. 워크플로 검사 성공과 실제 티스토리 발행 성공은 별개다.

## 공식 게시 수단

티스토리 Open API는 종료됐다. 폐지된 API 또는 로그인 쿠키를 추출해 비공식 게시 API를 호출하는 방법을 사용하지 않는다. Browserbase의 로그인된 Chromium에서 일반 에디터를 조작한다.
- https://notice.tistory.com/2664
- https://docs.browserbase.com/features/contexts
- https://docs.browserbase.com/reference/api/create-a-session
- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

## 연결에 필요한 승인

새 Browserbase 계정/프로젝트 연결과 티스토리 전용 Context 생성이 필요하다. 이 서비스의 Context에는 티스토리/카카오 로그인에 필요한 쿠키·브라우저 데이터가 클라우드에 보관된다. Context는 삭제 전까지 지속될 수 있으며 사이트가 로그인 세션을 만료하면 다시 로그인해야 한다. 기존 PC의 쿠키를 추출하거나 전송하지 않는다. 별도 클라우드 브라우저에서 사용자가 로그인한다.
Browserbase는 무료 사용 한도와 유료 요금제가 있다. 사용자 승인 없이 결제·유료 구독·유료 프록시를 신청하지 않는다. 무료 범위에서 연결 검증 가능 여부를 먼저 확인한다.
- https://www.browserbase.com/pricing
- https://docs.browserbase.com/features/session-live-view

GitHub에는 BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, BROWSERBASE_CONTEXT_ID를 Actions Secrets에 설정해야 한다. 키·세션 URL·쿠키를 채팅에 보내거나 일반 파일/commit에 넣지 않는다. 승인 후 연결 도구로 필요한 값만 안전하게 설정한다. 회원가입 약관 동의와 인증/CAPTCHA는 사용자 확인 또는 직접 조작이 필요할 수 있다.

## 활성화 순서

1. 새 서비스 연결과 클라우드 로그인 세션 보관 승인을 받는다.
2. 무료 범위에서 서비스 계정·프로젝트를 준비하고 티스토리 전용 Context를 생성한다. 로그인 화면은 직접 안내하며 사용자에게 비밀번호/OTP를 전달하도록 요구하지 않는다.
3. Context가 저장된 두 번째 세션에서 티스토리 관리자 접근을 확인한다. 실패하면 중단한다.
4. Secrets를 준비하고 사용자가 승인한 실제 글 1개로 에디터 입력·발행 버튼·공개 옵션·게시 결과를 검증한다. 현재 CodeMirror HTML 입력, 최종 공개 옵션/버튼은 클라우드 실검증 전이다. 확인되지 않으면 활성화하지 않는다.
5. 운영 시험을 위한 활성화부터 실제 공개 부작용이 발생하므로 준비된 글과 실행 1회의 범위를 기록한다. 승인된 시험이 통과한 뒤 지속 활성화한다.
6. 이후 사용자는 posts의 ready/approved 글을 main에 저장한다. Actions 실행이 자동 시작된다.

## 동작과 중단 기준

- 초안·미승인 글·실행 가능한 HTML·자리표시자·상대 이미지 URL은 게시하지 않는다. 본문을 임의로 정리해 다른 내용으로 게시하지 않는다.
- 동시 실행은 직렬화한다. 새 글 1개만 처리하며 발행 전 submitting 기록을 먼저 원격 저장한다. 기록 저장 실패 시 발행하지 않는다.
- 발행 클릭/화면 검수 중 실패하면 결과 불명 상태를 유지한다. 다음 실행에서 자동 재발행하지 않는다. 실제 관리자/공개 화면을 확인하고 기록을 복구한다.
- GitHub 기록은 일반 공개 URL·글 fingerprint·시각·상태뿐이다. 인증정보가 아니다.
- 세션 녹화/로그/CAPTCHA 자동 해결은 비활성화했다. 보안 경고·재로그인·CAPTCHA가 나타나면 자동화가 중단된다. 우회하지 않는다.
- 정상 글 취소는 즉시 반복 삭제하지 않는다. 해당 글을 draft로 바꾸면 미래 발행을 막는다. 이미 게시한 글은 관리자에서 대상 확인 후 비공개 전환 등 가역적인 조치부터 수행한다.
- 긴급 중단은 TISTORY_PUBLISH_ENABLED를 false로 설정하고 진행 중인 Actions 실행 상태를 확인한다. 이미 발행 클릭이 이루어졌다면 실제 상태부터 확인한다.

## 검증 결과

로컬: 승인 상태·중복 게시·불명 상태 재시도 방지·본문 변경·대상 URL·HTML 위험 요소·워크플로 활성화 제한 등 14개 테스트 통과. 예시 글 형식 검사 통과, 발행 대기 글 0개. 발행 비활성 경로 실행 확인.
사용자 Chrome: 관리자 글쓰기 화면의 제목·모드·카테고리·태그·완료 버튼과 실제 글 관리 목록의 공개 URL 구조 읽기 확인. 글 발행 없음.
클라우드 브라우저: 계정 미연결 / 로그인 미확인 / 에디터 입력·공개 발행 미검증.
GitHub Actions: 실행 결과는 evidence의 별도 검증 기록을 확인한다.
