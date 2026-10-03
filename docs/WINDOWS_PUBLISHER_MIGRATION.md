# 2026-10-03 Windows publisher 전환

작업 기준 remote main: 3da3e9d25a15922abb11176bb4c64444e42285d5. 로컬 이전 checkout c0de426은 사용하지 않고 최신 main의 별도 worktree에서 작업했다.

validate는 Ubuntu, 공개 발행만 self-hosted/windows/x64/tistory-publisher 및 CMD로 전환했다. Node 24/pnpm 11.19.0 유지. 로그인 persistent context와 익명 별도 Chrome을 분리했다. 임시 이미지는 Node tmpdir의 실행별 폴더에 보관 후 제거한다.

Browserbase SDK/session/runtime 의존을 제거했다. 과거 해당 SDK 기반 유지보수 코드·workflow 92개는 evidence/legacy-browser-publisher-20261003/에 원문 .txt와 SHA256 manifest로 보존했다. 해당 파일은 실행용이 아니다. 과거 스킨·글 수정 기능을 자동 재활성화하지 않는다. cloud-login/cloud-smoke의 이전 원문도 별도 보존한다. 기존 docs/evidence 과거 기록은 삭제하지 않았다.

source drift/submitting/published/ready 승인 1개/R2/대표 이미지/익명 공개 검증 Gate를 보존했다. posts, publication ledger, 현재 스킨·CSS·광고·카테고리는 변경하지 않았다. 현재 6개 글 검증, 신규 pending 1개(기존 전복)다.

설정 준비 중 TISTORY_PUBLISH_ENABLED=false. runner 등록과 LOGIN_SAVED 이후에만 true로 복원하고 표준 workflow를 1회 실행한다. 준비 중 자동 발행이나 중복 재시도는 하지 않는다.

현재 repo private, runner 등록 0개. Chrome/Git 존재, 전용 환경변수 미설정. 사용자 작업은 WINDOWS_TISTORY_PUBLISHER.md에 있다. 구현·fixture 테스트 통과는 실제 Tistory 로그인/발행/공개 검증 통과를 뜻하지 않는다.
