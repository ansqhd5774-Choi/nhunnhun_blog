# nhunnhun_blog

사용자 티스토리 블로그 https://nhunnhun.tistory.com/ 의 반복 관리용 프로젝트.
GitHub: https://github.com/ansqhd5774-Choi/nhunnhun_blog (비공개, main).
기준일: 2026-10-04 (Asia/Seoul). 실제 사이트명: 건강 식품.

이 프로젝트는 작업 파일과 증거를 관리한다. GitHub 연결을 사용할 수 있는 ChatGPT에서는 저장소의 문서를 읽어 작업을 이어간다. 저장/수정/PR 기능은 해당 대화의 실제 도구와 권한을 별도로 확인한다. 로컬 프로젝트 생성과 GitHub 연결은 ChatGPT 클라우드 실행 환경 생성이나 티스토리 로그인 공유를 의미하지 않는다.

`docs/BLOG_PLUGIN_EXECUTION_RULES_R2.md`를 블로그 도구 선택·실행·완료 판정의 ACTIVE 최상위 운영 기준으로 사용한다. 신규 글 작성·발행 디자인 기준은 `docs/EDITORIAL_PUBLISH_STANDARD_R3.md`를 ACTIVE 기준으로 사용한다. 신규 글은 서로 다른 본문 이미지 최소 3개와 제한적 다색 형광펜 강조 계약을 통과해야 한다.

콘텐츠 운영 범위는 **음식 / 영양소 / 약학 / 질병 4개 카테고리 전체**다. 신규 주제는 카테고리 비율을 기계적으로 맞추지 않고 검색 수요·기존 검색의도 중복·GSC 성과·최신성 필요도를 기준으로 선택한다. 약학·질병 콘텐츠는 음식·영양소보다 높은 근거 수준과 안전성 검증을 적용한다.

실제 Tistory mutation은 Windows self-hosted runner가 표준 실행 환경이다. PC·runner가 켜져 있어야 한다. 신규 공개 발행은 `publish-posts.yml`, 기존 숫자 URL 수정은 `update-posts.yml`만 사용한다. 두 경로 모두 최신 main·테스트·source drift·checkpoint·익명 공개 검증을 요구한다. 초기 runner 등록·전용 프로필 로그인은 `docs/WINDOWS_TISTORY_PUBLISHER.md`를 따른다. Browserbase 등 과거 cloud-browser 발행 경로는 RETIRED이며 기록은 `evidence/legacy-browser-publisher-20261003/`에 보존했다.

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
| posts/ | 신규 공개 글 source |
| updates/ | 기존 숫자 URL 수정 source |
| publishing/state/ | 신규 발행 checkpoint/ledger |
| publishing/update-state/ | 기존 글 수정 checkpoint/ledger |
| changes/ | 변경별 요청·검증·백업·적용·복구 기록 |
| scripts/ | 공개 페이지 수집과 백업 무결성 확인 |

시작: docs/STATUS.md → docs/SITE_BASELINE.md → 해당 workstreams/README.md → docs/WORKFLOW.md 순서로 읽는다.

`scripts/*.ps1`은 과거 수동 점검용 기록이며 active publish/update workflow에는 사용하지 않는다. 현재 실제 발행·수정 runtime은 Windows CMD shell + self-hosted runner를 사용한다. 공개 검증은 workflow의 anonymous browser 또는 무료 공개 조회를 우선한다.

후속 요청 예: “nhunnhun_blog의 기준 문서를 읽고 /352의 잔여 문구 수정안을 만들어라. 실제 저장 전 원본을 백업하고 적용 범위를 확인하라.”
