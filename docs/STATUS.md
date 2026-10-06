# 2026-10-03 현재 상태

Windows self-hosted 전환 구현·테스트 준비. Browserbase 운영 경로 제거, 기존 운영 기록 보존. runner 미등록/최초 전용 로그인 미완료로 실제 발행은 대기 중이다. 기존 전복 1개만 대상이며 새 글·스킨·광고는 수정하지 않았다. 상세: WINDOWS_PUBLISHER_MIGRATION.md / WINDOWS_TISTORY_PUBLISHER.md.

아래는 전환 전 역사 기록이며 현재 브라우저 연결 상태를 의미하지 않는다.

# 현재 상태

자동 게시: 활성화 완료. Browserbase 무료 계정 연결·GitHub Secrets 등록·새 세션 로그인 유지 검증 완료. GitHub Actions에서 /355를 실제 공개 발행했고 제목·전체 본문·음식 카테고리·블로그소식 태그를 공개 브라우저로 확인했다. 본문 검증 selector 불일치를 수정하고 submitting 기록을 published로 복구했다. 재발행은 하지 않았다. 로그인 만료 또는 무료 이용량 소진 시 중단될 수 있다. docs/AUTO_PUBLISH.md 참조.

GitHub 연결 완료: https://github.com/ansqhd5774-Choi/nhunnhun_blog (비공개, main). 로컬 origin 연결, 관리 문서·서식·검토용 HTML/CSS commit 및 push 완료. 로컬/원격 커밋 일치와 GitHub 연결 도구의 인수인계 문서 읽기 성공 확인. 원본 백업과 수집 원자료는 제외. 실제 원격 반영 증거는 evidence/github-20261002.json에서 확인한다. 다른 일반 ChatGPT 대화의 접근/쓰기 권한은 아직 미검증.

2026-10-02 / DONE: 로컬 반복 관리 구조와 초기 백업 준비 완료.

- 공개 홈페이지·게시글 /354·robots.txt·sitemap.xml·RSS: 직접 HTTP 200 확인, 원문·해시 저장.
- Chrome 사용자 세션: 관리자 홈 및 스킨 변경 화면 접근 성공. 추가 로그인 불필요.
- 관리자 현재 스킨: 한눈에 스킨 (사용자 수정). 공식 다운로드 ZIP 확보.
- 원본 ZIP 포함 13개 파일의 SHA256 기록. ZIP 내부 파일은 12개.
- verify-backup.ps1 실제 실행 PASS: 13개 파일의 크기·SHA256 및 필수 파일 존재 확인. 작업 사본 HTML·CSS와 원본 해시 일치 확인.
- skin.html 44,239 bytes / style.css 46,551 bytes. 관리자 원본 그대로 보존.
- 별도 .js 파일 0개. script 태그 18개 중 src가 있는 태그 4개; 인라인 코드와 외부 의존성은 HTML에서 유지.
- 적용·게시·카테고리·광고·디자인 변경: 수행하지 않음.
- 전체 글 원본·댓글·플러그인·광고 계정·모든 관리자 설정 백업: 미수행. RSS 50개는 전체 글 백업이 아님.
- 실제 복구 적용 시험, PC/모바일 회귀 검사: 미수행. 이번에는 UI 변경 없음.
- 스케줄/클라우드 프로젝트 등록: 미수행. 요청 때마다 이 프로젝트에서 작업하는 구조.

NON_BLOCKING 후속 후보: 중복 description, /352 목록 잔여 문구, 외부 의존성 가용성, 카테고리 총합과 전체 글 수 차이의 실제 소속 확인.
NEXT: 사용자가 지정하는 SEO·광고·카테고리·게시글 작업 중 하나를 독립 변경 기록으로 시작한다. 적용 전 최신 관리자 원본을 다시 확보한다.


## 2026-10-03 / PROPOSAL READY — LIVE APPLY PENDING

기준 운영 전 점검 시작 SHA: `39e22c09e1674f052f4bd73b1893984d90f63180`.

GitHub 구조 정정:
- `skin/reference/skin.html`, `css/reference/style.css`는 README 규칙대로 2026-10-02 검토 원본으로 복원.
- 개선본은 별도 proposal로 분리:
  - `skin/proposals/20261003-seo-a11y-r2.html`
  - `css/proposals/20261003-seo-a11y-r2.css`
- proposal HTML은 인증/광고 식별자가 REDACTED 된 검토 사본이므로 전체 파일 배포 금지.
- 실제 적용 시 최신 티스토리 관리자 원본에 proposal delta만 적용해야 함.

Proposal 개선 범위:
- `<head>` 구조 정상화, charset 단일화, `dns-prefetch` 오타 수정.
- 중복 generic `meta title/description` 제거.
- `robots=index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1` 후보 반영.
- Material Icons CSS를 render-blocking preload 없이 비차단 로딩 + noscript fallback으로 정리.
- 미사용 mainFont Google Fonts 요청 제거.
- 공개 목록/페이지 이동의 Material Icons ligature 문자열을 SVG로 교체.
- 목록 summary `p.post_text` 닫는 태그 보정, 잘못된 `<ui>`를 `<ul>`로 수정.
- 검색 입력 `aria-label`, 48px 터치영역, 포커스 표시 추가.
- 검색/메뉴 버튼에 명시적 button semantics 및 한국어 접근성 이름 부여.
- 댓글 Namecard 설명 텍스트 대비 강화.
- 운영에서 검증된 R1B/R2/R3 안정화 CSS를 proposal에 동기화.
- 기존 광고 슬롯/수익화 구조는 변경하지 않음.
- 이전 스킨 제작자 외부 푸터 브랜딩 제거, 현재 블로그 제목 기반 푸터 후보로 변경.
- 사과 글 GitHub 원본에 실제 이미지/alt/srcset 상태 동기화.

정적 QA:
- `maintenance/validate-blog-source.mjs`는 proposal HTML/CSS를 검증.
- GitHub Actions `Validate blog source` run `37044258639`: PASS.
- 주요 Gate: head 1/1, UTF-8 charset 1, generic meta 중복 0, crawler ligature 0, legacy footer 0, search aria 1, 필수 CSS marker 전부 존재.

검색/콘텐츠 감사:
- 기존 게시글 다수는 공개 검색엔진에서 크롤링/검색 결과 노출 확인.
- 신규 `/356` exact site 검색 결과는 감사 시점에 아직 미확인.
- 기존 `/195` 사과 글이 이미 색인되어 `/356`과 검색의도 중복 가능성 확인.
- 카니벌라이제이션 대응안은 `changes/20261003-apple-cannibalization.md`에 기록.
- /195 삭제/병합/리라이트는 사용자 승인 없는 실제 기존글 변경이므로 미실행.

LIVE APPLY 상태:
- GitHub Actions + 기존 Browserbase persisted context 우회 경로로 proposal delta를 실제 티스토리 운영 스킨에 적용 완료.
- 적용 workflow run: `37045048765` — SUCCESS.
- 재실행 결과 `changed:false`로 idempotent 확인.
- TinyFish는 할당량 소진 상태라 사용하지 않음.
- Remote Desktop Commander: device offline + remote calls left 0%.
- Firecrawl: credits 부족.
- GSC Wizard: trial/subscription 종료.
- 추가 과금 없이 진행 원칙에 따라 유료 충전/가입은 실행하지 않음.

실제 화면 회귀검증:
- PC 홈: PASS.
- PC /356 글: PASS.
- 모바일 /356: PASS.
- 태블릿 /356: PASS.
- 모바일 음식 카테고리: PASS.
- 모바일 검색(사과): PASS.
- 모바일 태그(사과): PASS.
- 검색 버튼 최소 48x48 충족.
- 데스크톱/태블릿 검색 입력 높이 50px, aria-label 정상.
- legacy footer 문구 노출 0.
- 목록 crawler ligature 노이즈 0.

현재 완료 범위:
- GitHub proposal 작성/검증: PASS.
- reference 원본 보존: PASS.
- 실제 티스토리 스킨 delta 적용: PASS.
- PC/태블릿/모바일 주요 페이지 회귀검증: PASS.
- Evidence/상태 기록: PASS.
- GSC 색인/검색성과 검증만 BLOCKED_BY_GSC_ACCESS.


## 2026-10-03 / FINAL SEO CONTENT PASS

완료:
- 실제 티스토리 스킨 SEO/A11Y R2 delta 적용 PASS.
- 최종 live 회귀검증 Run `37047067542` PASS.
- /195 제목·본문을 "사과 품종·고르는 법·보관법·활용법 총정리"로 재구성하여 /356과 검색의도 분리.
- /195 → /356 내부링크 적용.
- /195 기존 건강효능 중복 본문 및 오래된 외부 상업 링크 제거 확인.
- /352 템플릿 잔여문구 미검출.
- /356 canonical 정상.
- /356 robots: `index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1`.
- /356 대표 OG 이미지가 기본 placeholder가 아닌 실제 대표 이미지로 확인.
- robots.txt HTTP 200.
- sitemap.xml HTTP 200 및 /195, /352, /356 포함 확인.
- 모바일 검색 버튼 48x48 확인.
- 홈/본문의 legacy footer 및 crawler ligature 노이즈 미검출.
- 일회성 deploy/verify workflow 정리 완료.

의도적으로 미변경:
- 카테고리 `약약`: URL 구조 변경 가능성이 있어 프로젝트 URL 보존 원칙에 따라 자동 rename하지 않음.

외부 확인 제한:
- GSC Wizard 구독 종료로 실제 Google Search Console 색인/노출/CTR 데이터 검증은 미실행.
- 공개 site 검색에서 /356 exact 결과는 감사 시점에 아직 확인되지 않음. 이 항목은 색인 결과가 아니라 공개 검색 관측치로만 취급.

Evidence:
- `evidence/blog-source-r2-20261003.json`
- `evidence/post-195-rewrite-20261003.json`
- `evidence/final-blog-seo-20261003.json`


## 2026-10-07 / Content Standard R1·Editorial R4 소스 구축

`docs/CONTENT_STANDARD_R1.md`와 `changes/20261007-content-standard-r1.md`를 현재 작성/검증 기준으로 추가했다. 4개 분야·46개 질문·19개 확장·문체·의미형 강조·검토 해시를 신규 및 기존 수정 경로에 연결했다. 기존 글·ledger·스킨·광고는 변경하지 않는다. 로컬 단위/회귀 165개, 기존 source 80개의 렌더 보존, 3개 화면 폭 오프라인 미리보기를 확인했다. 최종 GitHub 통합/CI는 해당 PR/commit을 확인하며 실제 공개 발행은 이번 범위에 포함하지 않는다.
