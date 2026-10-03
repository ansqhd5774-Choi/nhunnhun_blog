# 자동 발행 — Windows self-hosted

현재 발행 경로는 PRIVATE GitHub main → Ubuntu validate/test → Windows self-hosted CMD → 전용 Chrome → 익명 공개 검증 → GitHub ledger다. PC와 runner가 실행 중이어야 한다. 외부 유료 브라우저 SDK는 제거했다.

초기 runner 등록·로그인은 [WINDOWS_TISTORY_PUBLISHER.md](WINDOWS_TISTORY_PUBLISHER.md)를 따른다. 준비 중 TISTORY_PUBLISH_ENABLED=false. 등록/로그인 후 현재 ledger와 source를 확인해 활성화한다.

신규 발행은 publish-posts.yml 한 개뿐이다. ready/approved 신규 글 1개, R2, 대표 이미지, source SHA, submitting checkpoint, 익명 전체 본문/이미지/편집 계약 검증을 유지한다. submitting 자동 재시도와 published 재발행은 금지한다. 현재 전복은 발행 미완료다.

과거 클라우드 운영/성공 기록은 ../evidence/legacy-browser-publisher-20261003/docs/AUTO_PUBLISH.md.txt와 기존 evidence에 보존했다. 과거 성공이 현재 Windows 발행 완료를 뜻하지 않는다.
