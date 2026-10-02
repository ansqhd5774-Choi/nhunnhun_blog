# nhunnhun_blog

사용자 티스토리 블로그 https://nhunnhun.tistory.com/ 의 반복 관리용 프로젝트.
GitHub: https://github.com/ansqhd5774-Choi/nhunnhun_blog (비공개, main).
기준일: 2026-10-02 (Asia/Seoul). 실제 사이트명: 건강 식품.

이 프로젝트는 작업 파일과 증거를 관리한다. GitHub 연결을 사용할 수 있는 ChatGPT에서는 저장소의 문서를 읽어 작업을 이어간다. 저장/수정/PR 기능은 해당 대화의 실제 도구와 권한을 별도로 확인한다. 로컬 프로젝트 생성과 GitHub 연결은 ChatGPT 클라우드 실행 환경 생성이나 티스토리 로그인 공유를 의미하지 않는다.

PC를 꺼도 실행되는 자동 발행은 [docs/AUTO_PUBLISH.md](docs/AUTO_PUBLISH.md)에 설명했다. 클라우드 로그인 유지와 /355의 실제 공개 발행을 검증했고 현재 활성화했다. posts/*.json의 status=ready, approved=true인 새 글 1개를 main에 저장하면 GitHub Actions가 검증·게시한다. 초안은 발행하지 않는다. 로그인 만료 시 재로그인이 필요하다.

ChatGPT 인수인계: [docs/CHATGPT_HANDOFF.md](docs/CHATGPT_HANDOFF.md). GitHub에 올린 skin/reference/skin.html은 인증·광고 식별자를 제거한 검토용 소스다. 실제 적용 파일로 사용하지 않는다. 원본 백업과 수집 원자료는 로컬에만 보존한다.

| 위치 | 용도 |
| --- | --- |
| backup/날짜-작업명/ | 관리자 원본 ZIP, 추출 원본, SHA256 manifest; 덮어쓰기 금지 |
| skin/current/ | 최초 다운로드 스킨 패키지 작업 기준; HTML과 이미지·설정 포함 |
| skin/proposals/ | 변경별 전체 패키지 후보와 차이 기록 |
| css/current/style.css | 원본 CSS의 작업 사본; 후보 패키지 작성 시 style.css로 복사 |
| skin/reference/, css/reference/ | GitHub에서 검토할 소스 사본; HTML 식별자 제거, 적용 금지 |
| css/proposals/ | 변경별 CSS 후보 |
| js/current/ | JS 구조 설명; 기존 인라인 코드는 skin.html에 보존 |
| js/proposals/ | 승인된 JS 변경 후보 |
| docs/ | 운영 기준, 초기 분석, 상태, 복구 절차 |
| evidence/public/ | 공개 응답 스냅샷·상태·해시 |
| evidence/admin/ | 민감정보를 제외한 관리자 관찰 기록 |
| workstreams/ | SEO, AdSense, 카테고리, 게시글 독립 작업 |
| changes/ | 변경별 요청·검증·백업·적용·복구 기록 |
| scripts/ | 공개 페이지 수집과 백업 무결성 확인 |

시작: docs/STATUS.md → docs/SITE_BASELINE.md → 해당 workstreams/README.md → docs/WORKFLOW.md 순서로 읽는다.

공개 증거 갱신: PowerShell에서 `./scripts/capture-public.ps1` 실행. 공개 URL 5개를 각각 한 번만 조회하며 실패는 재시도하지 않는다. 관리자 세션이나 인증정보를 사용하지 않는다.
백업 확인: `./scripts/verify-backup.ps1` 실행. 이것은 파일 무결성 검사이며 복구 적용 실험은 아니다.

후속 요청 예: “nhunnhun_blog의 기준 문서를 읽고 /352의 잔여 문구 수정안을 만들어라. 실제 저장 전 원본을 백업하고 적용 범위를 확인하라.”
