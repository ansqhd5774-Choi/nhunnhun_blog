# ChatGPT에서 블로그 작업 이어가기

대상 블로그: https://nhunnhun.tistory.com/
저장소: https://github.com/ansqhd5774-Choi/nhunnhun_blog
공개 범위: 비공개 / 기본 브랜치: main

## 새 대화에서 사용할 요청

“GitHub의 ansqhd5774-Choi/nhunnhun_blog 저장소에서 AGENTS.md, README.md, docs/STATUS.md, docs/SITE_BASELINE.md와 이번 작업의 workstreams 문서를 읽어라. 현재 읽은 브랜치와 커밋을 확인하고 [원하는 작업]을 진행하라. 기존 디자인은 유지하며 변경안을 changes에 기록하라. 티스토리 적용은 별도 승인 범위에서만 수행하라.”

## 가능한 작업과 접근 확인

- 새 글 자동 게시 요청은 posts/README.md와 docs/AUTO_PUBLISH.md를 먼저 읽는다. 2026-10-02 클라우드 연결/발행 활성화와 공개 테스트 글 /355 검증을 완료했다. 로그인 만료나 무료 한도 소진 시 운영이 중단될 수 있다. GitHub Actions 검증과 실제 공개 발행을 구분한다. 사용자가 내용 검토 후 ready/approved로 지정한 새 글만 발행 대상으로 사용한다.

- 문서 읽기, SEO 분석안, 카테고리 설계안, 글 초안, 서식, 검토용 소스 수정안을 작성할 수 있다. 실제 기능은 대화에 연결된 GitHub 도구를 기준으로 확인한다.
- 읽기만 가능하면 최종 결과를 파일별 수정 내용으로 제공한다. 저장/PR 도구가 있다면 브랜치·커밋·PR로 기록한다. 저장소 접근 성공을 쓰기 성공으로 간주하지 않는다.
- 이 설정을 수행한 대화에서는 새 비공개 저장소에 관리자·읽기·쓰기 권한을 확인했다. 이후 일반 ChatGPT 대화에서의 접근은 별도 검증 대상이다.
- 새 저장소가 검색되지 않으면 ChatGPT의 GitHub 연결에서 이 저장소가 허용됐는지 확인한다. 계정 전체 권한 확대를 자동 진행하지 않는다.
- 티스토리 관리자 로그인, 실제 화면 조작과 적용은 별도 브라우저 세션이 필요하다. GitHub에 티스토리 비밀번호·쿠키·토큰을 보관하지 않는다.

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
