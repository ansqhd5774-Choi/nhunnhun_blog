# 티스토리 러너 역할 분리

- 발행: c06-tistory-publisher / tistory-publisher / C:\actions-runner
- 검증·발행 전달: c06-tistory-validation / tistory-validation / C:\actions-runner-tistory-validation
- 별도 등록·인증·_work 폴더 사용. 브라우저 작업은 기존 발행 러너와 공통 mutation mutex 유지.
- 검증 러너는 사용자 Startup 바로가기로 로그인 시 숨김 실행. start-validation.ps1은 동일 경로 Listener 중복 시작 방지.
- PC 종료·로그아웃 중 무인 실행은 보장하지 않는다. 다른 저장소의 러너·일정은 변경하지 않았다.
- runner-isolation-smoke.yml은 두 러너의 실제 배정 확인용이며 티스토리를 조작하지 않는다.
- 확인된 기존 회귀 검사 불일치: content-workflow update assertEmphasisContract 기대가 현재 사용자 정책과 다름. 이번 역할 분리의 검사 통과를 위해 해당 assertion을 삭제하지 않았다.
