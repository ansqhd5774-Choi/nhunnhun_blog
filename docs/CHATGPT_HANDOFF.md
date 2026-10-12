> 최신 실행 기준: [일반 Chat 작성·러너 실행 계약](GENERAL_CHAT_EXECUTION.md)이 작성자 로컬 명령·GUI 의무와 공개 검증 담당에 우선합니다. 아래의 명령·미리보기·관리자 화면 절차는 러너/운영자용이며 일반 Chat의 필수 기능이 아닙니다. 직접 원고는 최신 DIRECT_AUTHORING_R1을 적용합니다.

# ChatGPT에서 블로그 작업 이어가기

## ACTIVE 인수인계 — 음식 전용

작성 시작 전 최신 main에서 [PROJECT_INSTRUCTIONS_FOOD_R8.1](project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt), [DIRECT_AUTHORING_R1](content/DIRECT_AUTHORING_R1.md), [공통 검사·저장 계약](content/DIRECT_AUTHORING_CONTRACT_20261012.md), GENERAL_CHAT_EXECUTION과 AGENTS.md를 확인한다. 음식 내용·소주제는 음식 전용 지침과 최신 사용자 지시로 정한다. 공통 문서의 다른 카테고리 예시는 기술 지원 범위이며 음식 편집 기준이 아니다. 직접 작성 SP1과 기존 R1 source/review 경로를 구분한다.

## Legacy 인수인계 — 2026-10-07

기존 비-direct R1 경로의 계약은 `docs/CONTENT_STANDARD_R1.md`, `docs/CONTENT_WRITER_PROMPT_R1.md`, `docs/content/DOMAIN_GUIDES_R1.md`, `docs/EDITORIAL_PUBLISH_STANDARD_R4.md`, `docs/CONTENT_REVIEW_FORMAT_R1.md`에서 확인한다. 과거 네 분야 분류·연결 안내로 현재 음식 전용 범위와 편집 기준을 덮어쓰지 않는다.

비-direct R1 source는 같은 id의 content-reviews를 함께 저장하고 실제 검토 후 해시를 일치시킨다. 코드 PASS는 의미 검토를 대체하지 않는다. 직접 작성 SP1에 R1 필수를 강제하지 않으며 legacy 글은 일괄 수정하지 않는다. 아래의 과거 클라우드 발행 연결 기록을 현재 운영 상태로 사용하지 않는다. 현재 실행 경로는 GENERAL_CHAT_EXECUTION과 실제 YAML을 읽는다.

대상 블로그: https://nhunnhun.tistory.com/
저장소: https://github.com/ansqhd5774-Choi/nhunnhun_blog
공개 범위: 공개 / 기본 브랜치: main

## 새 대화에서 사용할 요청

“GitHub의 ansqhd5774-Choi/nhunnhun_blog 저장소에서 AGENTS.md, README.md, docs/STATUS.md, docs/SITE_BASELINE.md와 이번 작업의 workstreams 문서를 읽어라. 현재 읽은 브랜치와 커밋을 확인하고 [원하는 작업]을 진행하라. 기존 디자인은 유지하며 변경안을 changes에 기록하라. 티스토리 적용은 별도 승인 범위에서만 수행하라.”

## 가능한 작업과 접근 확인

- 신규 posts는 publish-posts, 기존 direct updates는 자동 전달→update-posts를 사용한다. 과거 cloud-browser 성공 기록은 현재 경로가 아니다.

- 문서 읽기, SEO 분석안, 카테고리 설계안, 글 초안, 서식, 검토용 소스 수정안을 작성할 수 있다. 실제 기능은 대화에 연결된 GitHub 도구를 기준으로 확인한다.
- 읽기만 가능하면 최종 결과를 파일별 수정 내용으로 제공한다. 저장/PR 도구가 있다면 브랜치·커밋·PR로 기록한다. 저장소 접근 성공을 쓰기 성공으로 간주하지 않는다.
- 이 설정을 수행한 대화에서는 새 비공개 저장소에 관리자·읽기·쓰기 권한을 확인했다. 이후 일반 ChatGPT 대화에서의 접근은 별도 검증 대상이다.
- 새 저장소가 검색되지 않으면 ChatGPT의 GitHub 연결에서 이 저장소가 허용됐는지 확인한다. 계정 전체 권한 확대를 자동 진행하지 않는다.
- 관리자 세션은 발행 러너의 전용 Chrome에서 사용한다. 일반 Chat에는 로그인 세션·GUI 제어를 요구하지 않는다.

## 소스와 증거 구분

- skin/reference/skin.html: 최초 관리자 스킨의 검토용 사본. 검색엔진 인증 태그와 광고 publisher 식별자는 제거했다. REDACTED 표시를 실제 사이트에 적용하지 않는다.
- css/reference/style.css: 최초 CSS 검토 사본. 이후 운영 수정과 자동 동기화되지 않는다.
- backup/, skin/current/, css/current/, evidence/public/: 로컬 전용. ZIP·인증 파일·수집 원자료는 GitHub에 없다.
- docs/SITE_BASELINE.md와 evidence/admin/의 기록은 날짜가 있는 과거 직접 관찰이다. 최신 코드·로그인 상태로 간주하지 않는다.
- 실제 스킨 적용 작업에는 최신 원본을 확보하고 검토 변경분만 원본에 반영한다. 로컬 백업이 없는 환경에서는 복구 준비가 될 때까지 운영 적용을 중단한다.

## 공식 제품 안내

OpenAI 문서는 로컬 파일을 읽고 수정할 프로젝트와 GitHub 기반 클라우드 환경을 구분한다. GitHub 기반 환경은 저장소 선택과 환경 설정이 별도다. 이 저장소를 만들었다고 클라우드 환경이 자동 생성되는 것은 아니다.

- https://learn.chatgpt.com/docs/projects
- https://learn.chatgpt.com/docs/cloud

이 문서는 작업 인수인계용이며 계정 권한이나 제품 기능을 보장하지 않는다.
