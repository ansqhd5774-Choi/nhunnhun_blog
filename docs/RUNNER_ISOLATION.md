# 티스토리 러너 역할 분리

## 2026-10-09 최신 운영 구성

공개 저장소 전환 후 콘텐츠 CI·작성 회귀·스킨 소스 검사·신규 글 사전 검증·원고 dispatch를 표준 `windows-latest`로 이동했다. Windows CMD 호환성을 유지하며 Node 24와 고정 pnpm, 제공 러너용 의존성 캐시를 사용한다. 원고 dispatch는 고정 SHA checkout을 사용하며 로컬 Node 경로와 PC 임시 폴더에 의존하지 않는다.

실제 발행·수정, Chrome 점검과 PC 유지보수는 `tistory-publisher`에 유지한다. 발행 직전 대상 검증·SHA drift 검사·공통 mutation mutex를 유지한다. 검증 러너의 기존 등록·Startup은 삭제하지 않으며 현재 워크플로우에서는 배정하지 않는다. 격리 smoke의 검증 작업은 제공 러너를, 발행 작업은 전용 PC 러너를 확인한다.

아래는 이전 역할 분리 당시 기록이다.

- 발행: c06-tistory-publisher / tistory-publisher / C:\actions-runner
- 검증·발행 전달: c06-tistory-validation / tistory-validation / C:\actions-runner-tistory-validation
- 별도 등록·인증·_work 폴더 사용. 브라우저 작업은 기존 발행 러너와 공통 mutation mutex 유지.
- 검증 러너는 사용자 Startup 바로가기로 로그인 시 숨김 실행. start-validation.ps1은 동일 경로 Listener 중복 시작 방지.
- PC 종료·로그아웃 중 무인 실행은 보장하지 않는다. 다른 저장소의 러너·일정은 변경하지 않았다.
- runner-isolation-smoke.yml은 두 러너의 실제 배정 확인용이며 티스토리를 조작하지 않는다.
- 확인된 기존 회귀 검사 불일치: content-workflow update assertEmphasisContract 기대가 현재 사용자 정책과 다름. 이번 역할 분리의 검사 통과를 위해 해당 assertion을 삭제하지 않았다.
