> 최신 실행 기준: [일반 Chat 작성·러너 실행 계약](GENERAL_CHAT_EXECUTION.md)이 작성자 로컬 명령·GUI 의무와 공개 검증 담당에 우선합니다. 아래의 명령·미리보기·관리자 화면 절차는 러너/운영자용이며 일반 Chat의 필수 기능이 아닙니다. 직접 원고는 최신 DIRECT_AUTHORING_R1을 적용합니다.

# BLOG PLUGIN & EXECUTION RULES R2

## 적용 우선순위 보완 — 2026-10-07

실행·인증·안전 운영 규칙 R2는 유지한다. 다만 신규 작성/앞으로 수정하는 글의 **내용·문체·의미형 강조**는 `CONTENT_STANDARD_R1.md`와 `EDITORIAL_PUBLISH_STANDARD_R4.md`가 아래 R3 관련 조항보다 우선한다. 변경 없는 기존 source에는 R3 호환 렌더를 유지한다. R4의 `<u>`는 실제 밑줄이고 `<mark data-tone>`만 형광펜이며, 색을 순환시키거나 최소 2색을 강제하지 않는다.

새로운 실제 mutation 전에는 source와 content-reviews의 R1 계약을 통과해야 한다. 검토 기록은 AI/사람 및 동일 작성자/독립 검토를 구분하며 자동 게이트를 의료 감수라고 표현하지 않는다. 신규/기존 수정은 같은 브라우저 mutex로 직렬화한다. 자세한 작성 절차는 `CONTENT_WRITER_PROMPT_R1.md`를 따른다.

Status: **ACTIVE**  
Target: `https://nhunnhun.tistory.com/`  
Effective: 2026-10-04 (Asia/Seoul)  
Supersedes: 기존 비버전 BLOG PLUGIN & EXECUTION RULES

## 0. 최상위 원칙
- 블로그 운영 플랫폼은 현재 티스토리(`https://nhunnhun.tistory.com/`)를 기준으로 한다.
- 사용자가 승인하지 않은 플랫폼 이전, 도메인 변경, 광고/수익화 구조 변경, 대규모 스킨 교체를 임의로 하지 않는다.
- 실제 실행하지 않은 작업을 실행했다고 보고하지 않는다.
- 조사 / 초안 / GitHub 반영 / Tistory 저장 / 실제 공개 / SEO 반영 / Production 검증을 서로 구분한다.
- 기존 글, 카테고리, 숫자 URL, 내부링크 구조를 훼손하지 않는 방향을 우선한다.
- 같은 문제를 여러 도구로 반복 조사하지 않는다. 실패 시 가장 최근 통과 단계와 최초 실패 단계를 기준으로 최소 수정한다.
- 무료 수단으로 충분하면 유료·종량제 도구를 호출하지 않는다.
- 사용자가 “시작”, “진행”, “작성”, “최신화”라고 지시한 경우 승인 범위 안에서 조사 → 수정 → 실행 → 공개 검증까지 중간 보고 때문에 멈추지 않는다.
- 결제, 가입, 삭제, URL 변경, 대규모 구조 변경, 복구 불가능 변경만 추가 승인을 요구한다.

## 1. GitHub — BLOG SOURCE / WORKFLOW SOURCE OF TRUTH
- 저장소 `ansqhd5774-Choi/nhunnhun_blog`의 `main`을 블로그 자동화 소스 기준으로 사용한다.
- 티스토리 글 source, Editorial renderer, 발행/수정 workflow, ledger, 스킨 후보, 운영 기준서를 GitHub에서 관리한다.
- 수정 전 최신 `main SHA`와 작업 기준 SHA를 확인한다.
- source drift가 있으면 stale source 위에 덮어쓰지 않는다.
- 완료된 소스 변경은 `main`에 반영하고 commit SHA를 Evidence로 남긴다.
- GitHub는 단순 저장소가 아니라 GitHub Actions를 통한 검증·오케스트레이션 역할도 수행한다.
- workflow 변경은 관련 경로에만 반응하도록 path trigger를 최소화한다. 기존 글 수정 코드 변경이 신규 발행 workflow를 불필요하게 실행시키거나 그 반대가 되지 않게 한다.

## 2. Windows Self-hosted Runner — TISTORY STANDARD EXECUTION SOURCE OF TRUTH
- 실제 신규 발행과 기존 글 수정의 표준 실행 환경은 Windows self-hosted GitHub Actions runner다.
- 현재 표준 label은 `self-hosted`, `windows`, `x64`, `tistory-publisher`다.
- PC와 runner가 Online이어야 실제 Tistory 변경 작업이 실행된다. Offline이면 우회 발행하지 않고 queue/blocker로 구분한다.
- active workflow의 Windows 명령 실행은 CMD shell을 사용한다. PowerShell/WSL/bash를 active publishing 경로에 새로 도입하지 않는다.
- Tistory 인증은 repo 밖의 **전용 Chrome persistent profile**을 사용한다.
- 일반 Chrome `User Data/Default` 프로필을 자동화 프로필로 사용하지 않는다.
- 전용 프로필, 쿠키, 세션, OTP, 비밀번호를 GitHub/Artifact/Cache/채팅에 업로드하지 않는다.
- 관리자 작업용 authenticated browser와 공개 검증용 anonymous browser를 분리한다.
- Browserbase 및 과거 cloud-browser 발행 경로는 RETIRED다. 사용자 승인 없이 재활성화하지 않는다.
- Steel, Browserless, Cloudflare Browser Run 등 대체 cloud browser도 현재 표준 경로가 아니다. 장애가 생겼다는 이유만으로 임의 전환하지 않는다.

## 3. TinyFish — FALLBACK REAL BROWSER / DIAGNOSTICS
- TinyFish는 표준 발행·수정 경로가 아니다.
- self-hosted runner 로그만으로 확인하기 어려운 관리자 UI 상태, 로그인 화면, 스킨 미리보기, 특수 UI 진단이 필요할 때 fallback으로 사용한다.
- 표준 `publish-posts.yml` 또는 `update-posts.yml`을 우회해 TinyFish로 직접 게시·수정하지 않는다.
- 단순 공개 페이지 확인은 무료 HTTP/공개 조회 또는 표준 anonymous browser 검증을 우선한다.
- TinyFish Browser/Agent는 종량제이므로 무료 수단으로 해결할 수 없을 때만 사용한다.
- TinyFish를 통한 삭제, 대규모 스킨 변경, 외부 서비스 가입/결제는 사용자 승인 없이 실행하지 않는다.

## 4. GSC Wizard — GOOGLE SEO SOURCE OF TRUTH
- Google Search Console의 색인, 검색어, CTR, 노출, 평균순위, 페이지 성과, sitemap 상태 확인에 우선 사용한다.
- SEO 판단은 추측보다 실제 GSC 데이터를 우선한다.
- 글 발행·기존 글 최신화 후 검색성과 판단은 즉시 색인 여부와 장기 성과를 구분한다.
- sitemap, robots, canonical, noindex 또는 URL 구조를 변경한 경우 필요 시 GSC에서 검증한다.
- 디자인 작업이나 단순 본문 교정에 GSC를 불필요하게 호출하지 않는다.

## 5. Firecrawl / Search — RESEARCH / COMPETITOR / SOURCE COLLECTION
- 최신 사실, 공식 문서, 전문기관, 경쟁 콘텐츠 구조, 누락 주제 확인에 사용한다.
- 단순 검색으로 충분하면 Firecrawl의 대규모 크롤링을 사용하지 않는다.
- 최신성이 중요한 글은 현재 시점의 공개 출처를 확인한다.
- 자료 우선순위는 공식기관·원문 연구·전문기관 → 신뢰도 높은 2차 자료 → 일반 웹 순으로 본다.
- 다른 블로그 글을 그대로 복제하거나 장문 전재하지 않는다.
- 출처가 불명확하거나 라이선스가 불명확한 이미지를 무단 사용하지 않는다.

## 6. Figma — BLOG UI SOURCE OF TRUTH
- 블로그 메인, 글 목록, 카드, 사이드바, 헤더, 카테고리, 모바일 레이아웃의 큰 UI 설계에 사용한다.
- Figma 원본이 있으면 스크린샷 추정보다 실제 spacing, typography, component 값을 우선한다.
- 스킨 대규모 개편 시 Figma 또는 명확한 UI 기준을 먼저 확보한다.
- 구현 후 실제 Production Tistory 화면과 비교한다.

## 7. PostHog — USER BEHAVIOR
- 실제 사용자 행동, 클릭, 이탈, 스크롤, 페이지 흐름 분석이 필요한 경우 사용한다.
- 테스트 이벤트와 실제 방문자 이벤트를 구분한다.
- 개인정보나 불필요한 민감정보를 저장하지 않는다.
- GSC는 검색 유입, PostHog는 사이트 내부 행동 분석 용도로 역할을 구분한다.

## 8. Adobe / Runway — VISUAL CONTENT
- 썸네일, 대표 이미지, 배너, 카드 이미지, 이미지 보정은 Adobe를 우선 검토한다.
- 영상·숏폼 소재가 필요한 경우에만 Runway를 사용할 수 있다.
- 무료 이미지 생성/편집 또는 적법한 공개 이미지로 충분하면 유료 크레딧을 사용하지 않는다.
- 생성형 미디어는 글 이해에 실제 도움이 될 때만 사용한다.
- 이미지마다 출처·라이선스 확인 가능성을 유지한다.

## 9. Context7 — TECHNICAL DOCUMENTATION
- HTML/CSS/JavaScript, Playwright, GitHub Actions, SEO 라이브러리, 외부 API처럼 버전 의존적인 기술 문법은 최신 문서를 확인한다.
- 기억에 의존해 최신 API나 selector 계약을 추정하지 않는다.
- 단순 콘텐츠 작성에는 사용하지 않는다.

## 10. Linear — LARGE BLOG PROJECT CONTROL
- 스킨 전면 개편, SEO 구조 개선, 대량 기존 글 현대화 등 장기 프로젝트에서만 사용한다.
- Stage / Revision / PASS / FAIL / BLOCKER / Evidence 관리가 필요할 때 활용한다.
- 단일 글 작성·수정이나 소규모 CSS 변경에는 이슈를 만들지 않는다.

## 11. Remote Desktop Commander — DISABLED BY DEFAULT / LAST RESORT
- 현재 Tistory 발행·수정 표준 구조에서는 사용하지 않는다.
- self-hosted runner, GitHub, TinyFish, 연결된 플러그인으로 해결 가능한 작업에 사용하지 않는다.
- 로컬 Windows 전용 파일 작업 등 다른 경로가 전혀 없고 사용자가 명시적으로 요구한 경우에만 검토한다.
- 월간 사용량 제한 때문에 진단용 반복 호출을 금지한다.
- Tistory 게시·수정·로그인 유지 목적으로 Remote Desktop Commander를 표준 경로에 포함하지 않는다.

## 12. 콘텐츠 작성 기준
- 검색 유입만을 위한 얇은 글보다 실제 정보 가치가 있는 글을 우선한다.
- 제목은 주 검색 의도와 실제 본문 내용이 일치해야 한다.
- 도입부는 검색 의도를 바로 설명하고 불필요하게 길게 쓰지 않는다.
- H2/H3 구조를 명확히 한다.
- 표, 수치, 비교가 실제 이해에 도움이 될 때 구조화한다.
- 최신 정보가 중요한 주제는 기준 연도와 확인 시점을 명시한다.
- 팩트·관찰·해석·의견을 구분한다.
- 수치, 정책, 건강·의학, 기술 정보는 검증 가능한 출처를 사용한다.
- AI 티가 강한 반복 문구, 의미 없는 결론 반복, 불필요한 장문을 피한다.
- 기존 글과 카니벌라이제이션이 예상되면 신규 글보다 기존 글 최신화를 우선 검토한다.
- 최신화 시 오래된 과장 표현, 근거 없는 효능, 잘못된 수치, 낡은 문체도 함께 정리한다.

## 13. SEO 기준
- 글마다 하나의 명확한 주 검색 의도를 잡는다.
- 제목, 본문, 소제목, 내부링크, 이미지 alt를 자연스럽게 구성한다.
- 키워드 반복 삽입을 목적으로 문장을 부자연스럽게 만들지 않는다.
- 동일 검색 의도의 기존 URL이 있으면 신규 글보다 기존 글 보강을 우선한다.
- 내부링크는 관련성과 독자 다음 행동을 기준으로 연결한다.
- 모바일 가독성, 이미지 용량, Core Web Vitals 영향을 고려한다.
- 기존 글 최신화는 가능하면 숫자 URL을 유지해 누적 신호와 외부 링크를 보존한다.
- robots, sitemap, canonical, noindex, URL을 변경하려면 검색 노출 영향을 먼저 검토한다.

## 14. 티스토리 스킨 수정 기준
- 수정 전 현재 스킨 원본을 보존한다.
- HTML / CSS / JS 변경 범위를 구분한다.
- 필요한 파일과 selector만 최소 범위로 수정한다.
- 데스크톱만 보고 완료 처리하지 않는다.
- 최소 PC / 태블릿 / 모바일을 확인한다.
- 글 본문, 목록, 카테고리, 검색, 태그, 댓글, 사이드바 등 주요 화면을 확인한다.
- 티스토리 치환자와 기본 기능을 임의 삭제하지 않는다.
- 광고, 통계, 검색도구 스크립트가 있다면 충돌 여부를 확인한다.

## 15. 실행 우선순위
### 블로그 소스 / workflow / 기준서
GitHub > 기타 도구

### 실제 신규 발행 / 기존 글 수정
GitHub Actions self-hosted Windows runner > TinyFish fallback

### 공개 화면 검증
workflow의 anonymous browser / 무료 공개 조회 > TinyFish fallback

### SEO
GSC Wizard > 공개 검색 조사

### 외부 자료 조사
Search > Firecrawl 대규모 수집

### UI
Figma > 실제 Production 화면 > GitHub CSS/HTML

### 사용자 행동
PostHog

### 이미지
무료·라이선스 확인 가능한 이미지 > Adobe 무료 범위 > 유료 기능

### 영상
Runway — 필요할 때만

### Remote Desktop Commander
표준 경로에서 제외

## 16. 비용 원칙
- GitHub, self-hosted runner, GSC Wizard, Figma Free, PostHog Free, 일반 검색을 우선한다.
- 상시 가동 PC의 전기·네트워크 비용 외에 cloud browser 정기 과금을 기본 전제로 두지 않는다.
- TinyFish Browser/Agent, Runway, Adobe 유료 기능, 기타 종량제 기능은 꼭 필요한 경우만 사용한다.
- 무료 수단으로 동일한 결과를 낼 수 있으면 유료 기능을 호출하지 않는다.
- 지속 과금 서비스 가입이나 유료 플랜 전환 전 사용자 승인을 받는다.

## 17. 신규 글 작성·발행 기본 동작
- 사용자가 “새 글 작성”, “시작”, “진행”, “작성”이라고 지시하면 조사 → 카니벌라이제이션 확인 → 원고 작성 → Editorial R3 적용 → 이미지 준비 → GitHub main 반영 → validate → 실제 Tistory 발행 → 익명 공개 검증까지 하나의 작업으로 본다.
- 사용자가 “초안만”, “게시하지 마”, “검토용”이라고 명시한 경우에만 실제 발행하지 않는다.
- GitHub에 JSON만 저장한 상태를 완료로 보고하지 않는다.
- 실제 게시 작업은 공개 숫자 URL이 생성되고 Production에서 확인되어야 완료다.
- 게시 후 제목·본문·카테고리·태그·이미지·대표 이미지·내부링크·OG를 확인한다.

## 18. 기존 글 최신화·수정 기본 동작
- 사용자가 “/111 최신화”, “기존 글 수정”, “이 글 보강”이라고 지시하면 **새 글을 만들지 않고 기존 숫자 URL을 유지**한다.
- 기존 글 수정 source는 `updates/*.json`을 사용한다.
- 실제 수정은 `.github/workflows/update-posts.yml` → `publishing/update.mjs` 한 경로만 사용한다.
- `articleId`, `targetUrl`, `expectedCurrentTitle`이 실제 관리자 화면과 일치해야 한다.
- 전체 최신화는 Editorial R3 수준으로 재구성한다.
- 오탈자·링크 한 건 등 좁은 수정은 요청 범위를 불필요하게 확대하지 않는다.
- 카테고리·태그는 기본적으로 보존한다. 변경이 필요하면 별도 검증 로직을 먼저 추가한 뒤 실행한다.
- 제목 변경이 검색 의도 개선에 필요하면 기존 URL을 유지한 채 변경하고 공개 페이지에서 확인한다.
- 기존 글을 최신화한다는 이유로 새 숫자 URL을 발행하면 FAIL이다.

## 19. 공통 콘텐츠 디자인 시스템 — Editorial R3
- ACTIVE 기준은 `docs/EDITORIAL_PUBLISH_STANDARD_R3.md`다.
- 신규 글과 전체 최신화 글은 동일한 전문 건강매체형 정보 위계를 사용한다.
- H2/H3, 표, FAQ, 핵심 요약, 최신 근거, 관련 글, 출처 영역은 공통 renderer 규칙을 적용한다.
- 개별 글만 별도 CSS/HTML 패치해 다음 글에 재사용되지 않는 구조를 만들지 않는다.
- 현재 renderer 계약은 H2 26px/800, H3 20px/800, 반응형 표·이미지, quick summary, summary box, FAQ card, related card, source list를 검증한다.

## 20. 신규 글 필수 구성 Gate
- 대표 이미지
- 검색 의도를 즉시 설명하는 짧은 도입부
- “이것만 먼저 보세요” 형태의 핵심 요약
- H2 최소 4개
- 필요한 경우 H3
- 필요한 경우 비교표·수치표
- 제한적인 핵심 구문 강조
- 최신 근거가 중요한 주제면 기준 연도와 연구 한계를 포함한 근거 영역
- FAQ가 유용한 주제면 Q/A 명확 구분
- 핵심 정리
- 관련성이 높은 내부링크
- 자료 출처
- 외부 근거 URL 최소 2개
- 대표 이미지 source와 본문 첫 이미지 source 일치

## 21. 이미지 Gate
- 신규 공개 글은 **서로 다른 본문 이미지 최소 3개**를 사용한다.
- 동일 이미지를 개수 충족 목적으로 반복하면 FAIL이다.
- 이미지는 장식이 아니라 내용 이해에 도움이 되는 위치에 분산 배치한다.
- 모든 이미지에 의미 있는 alt를 넣는다.
- 이미지 source는 HTTPS만 허용한다.
- 발행 시 본문 이미지는 Tistory에 업로드해 kakaocdn 기반으로 전환한다.
- 본문 첫 이미지는 eager / fetchpriority high, 나머지는 lazy를 기본으로 한다.
- 공개 페이지에서 모든 본문 이미지가 반응형이고 모바일 폭을 넘지 않는지 확인한다.
- 이미지의 원출처·라이선스는 자료 출처 영역에서 확인 가능하게 한다.

## 22. 대표 이미지 Gate
- 본문에 이미지가 있는 신규 글은 대표 이미지 지정이 필수다.
- 대표 이미지는 Tistory 발행창의 대표 이미지 영역에 실제 등록한다.
- 본문 첫 이미지만 존재한다고 대표 이미지 설정 완료로 간주하지 않는다.
- 공개 페이지 `og:image`가 Tistory 기본 `opengraph.png`이면 FAIL이다.
- 실제 kakaocdn 대표 이미지가 확인되어야 PASS다.
- 기존 글 전체 최신화에서 대표 이미지를 변경할 경우 기존 대표 슬롯을 명시적으로 제거한 뒤 새 대표 이미지를 지정한다.
- 기존 글 수정 후에도 `og:image`를 다시 확인한다.

## 23. 다색 형광펜 강조 Gate
- source의 실제 핵심 단어나 짧은 구문만 `<u>...</u>`로 표시한다.
- Editorial R3 renderer가 이를 형광펜으로 변환한다.
- 승인 팔레트:
  - Yellow `#fff1a8`
  - Lime `#d9f99d`
  - Blue `#bfdbfe`
  - Pink `#fbcfe8`
- 강조 색은 순서대로 순환하며 색 자체에 고정 의미를 부여하지 않는다.
- 강조가 2개 이상이면 실제 렌더에서 최소 2색 이상 사용되어야 한다.
- 한 문단 전체 또는 여러 문장 전체를 형광펜 처리하지 않는다.
- 제목 계층 → 여백 → 굵기 → 배경/박스 → 형광펜 → 색상 순으로 정보 위계를 만든다.

## 24. 벤치마킹 원칙
- 디자인이나 정보 구조에 확신이 없으면 임의로 만들기 전에 전문 매체를 벤치마킹한다.
- 건강·영양 콘텐츠는 Harvard Nutrition Source, Cleveland Clinic, Healthline 등 신뢰도 높은 전문 사이트의 정보 구조를 참고할 수 있다.
- 기술·정책 콘텐츠는 해당 분야의 공식 문서와 전문기관을 우선한다.
- 벤치마킹은 구조·위계·가독성을 참고하는 것이며 문장·디자인을 그대로 복제하지 않는다.
- 시행착오를 사용자에게 반복 노출하기 전에 비교·검토 후 가장 나은 안을 적용한다.

## 25. 신규 글 게시 전 자동 검증
- 신규 글은 Editorial R3 검증을 통과하지 못하면 공개하지 않는다.
- 최소 H2 수, 이미지 최소 3개, image alt, 대표 이미지, 도입부, 핵심 요약, 핵심 정리, 자료 출처, 외부 근거를 검사한다.
- H2/H3 실제 렌더 스타일을 검사한다.
- 표의 모바일 가로 스크롤 대응 여부를 검사한다.
- 이미지 반응형 표시 여부를 검사한다.
- source 강조 수와 렌더 강조 수가 일치하는지 검사한다.
- 강조가 2개 이상이면 최소 2색 이상인지 검사한다.
- FAQ가 있으면 Q/A 카드 수가 일치하는지 검사한다.
- 최신 근거 영역이 있으면 승인된 component로 표시되는지 검사한다.
- 관련 글이 있으면 내부링크 카드 수와 실제 링크를 검사한다.
- validate가 PASS하지 않으면 실제 Tistory 변경 job을 시작하지 않는다.

## 26. 신규 발행 단일 경로
- 신규 공개 글은 `.github/workflows/publish-posts.yml`만 사용한다.
- 특정 글만 급히 올리기 위한 별도 publish workflow를 만들지 않는다.
- 일회성 우회 발행 script로 표준 검증을 건너뛰지 않는다.
- 다른 workflow가 신규 게시 명령을 직접 호출하면 FAIL이다.
- 신규 글 source는 `posts/*.json`이다.
- ready + approved 신규 글은 한 실행에서 최대 1개만 처리한다.

## 27. 기존 글 수정 단일 경로
- 기존 공개 글 수정은 `.github/workflows/update-posts.yml`만 사용한다.
- 기존 글 source는 `updates/*.json`이다.
- 신규 발행 workflow에서 기존 숫자 URL을 수정하지 않는다.
- update workflow에서 새 공개 숫자 URL을 만들지 않는다.
- 수정 전 기존 title/URL을 확인하고 불일치하면 fail-closed한다.
- 최종 수정 후 동일 숫자 URL의 익명 공개 페이지를 검증한 뒤에만 완료 처리한다.

## 28. Workflow 격리 / 동시 실행
- 신규 발행 관련 파일 변경은 publish workflow만, 기존 글 수정 관련 파일 변경은 update workflow만 트리거하도록 유지한다.
- 광범위한 `publishing/**` trigger로 모든 workflow를 동시에 깨우지 않는다.
- 동일 Tistory 편집 세션을 두 mutation job이 동시에 조작하지 않게 한다.
- 현재 단일 self-hosted runner에서는 실행이 사실상 직렬화되지만, runner를 추가할 경우 publish/update에 공통 runtime lock을 먼저 도입한다.
- workflow가 queue 상태라고 실패로 보고하지 않는다. runner Offline/Busy/Queue를 구분한다.

## 29. Source Drift 방지
- validate와 실제 mutation은 최신 `main`을 기준으로 실행한다.
- 실제 mutation job에서도 테스트와 validate를 다시 수행한다.
- 최종 공개/저장 버튼 클릭 직전에 현재 작업 SHA와 GitHub remote main SHA를 비교한다.
- SHA가 다르면 stale source로 판단하고 클릭하지 않는다.
- 오래된 Actions 실행이 더 최신 source를 덮어쓰지 못하게 한다.
- ledger checkpoint commit으로 main이 이동한 경우, 그 이동이 현재 workflow 자신의 checkpoint인지 구분한다.

## 30. 게시·수정 상태 / 중복 방지
### 신규 발행
- 최종 발행 직전 `publishing/state/<id>.json`에 `submitting` checkpoint를 저장한다.
- 공개 검증까지 완료되면 `published`로 전환한다.
- `published` 글은 source가 바뀌어도 새 글로 재발행하지 않는다.
- `submitting` 상태에서 결과가 불명확하면 자동 재발행하지 않는다.

### 기존 글 수정
- 최종 저장 직전 `publishing/update-state/<id>.json`에 `submitting` checkpoint를 저장한다.
- 동일 URL 공개 검증까지 완료되면 `updated`로 전환한다.
- `submitting` 이후 실패하면 자동 재수정하지 않고 공개 페이지 상태부터 확인한다.
- `updated` fingerprint와 source가 동일하면 다시 수정하지 않는다.

## 31. Self-hosted Runner / 로그인 운영 규칙
- runner는 PC가 켜져 있고 실행 프로세스 또는 서비스가 살아 있어야 한다.
- 전용 Chrome 프로필은 repo 외부에 둔다.
- Kakao/Tistory 로그인 만료 시 자동 비밀번호 입력이나 CAPTCHA 우회를 하지 않는다.
- 재로그인은 사용자가 전용 Chrome에서 직접 수행한다.
- 로그인 완료 여부만 확인하고 비밀번호·OTP·cookie 값을 기록하지 않는다.
- runner 이름보다 label 계약을 우선한다.
- 서비스와 수동 `run.cmd`를 동시에 실행하지 않는다.

## 32. Secret / 인증정보 보안
- GitHub token, 등록 token, Kakao/Tistory 비밀번호, OTP, cookie, profile 파일을 commit하지 않는다.
- 로그에 raw provider exception, connect URL, token, credential query를 남기지 않는다.
- credential이 포함될 수 있는 URL·예외는 redaction하거나 오류 코드만 기록한다.
- 전용 프로필을 zip, artifact, cache, Drive 등 외부 저장소로 옮기지 않는다.

## 33. 실패 처리 / 재시도 규칙
- 실패 시 **마지막 PASS stage와 최초 FAIL stage**를 먼저 확정한다.
- `submitting` checkpoint가 없으면 최종 저장/발행 전 실패로 간주하고 공개 글이 변하지 않았는지 확인한 뒤 최소 수정 후 재실행할 수 있다.
- `submitting` checkpoint가 있거나 최종 클릭 이후 결과가 불명확하면 자동 재시도하지 않는다.
- 이 경우 실제 공개 URL을 먼저 확인해 성공/실패/부분 적용을 판정하고 ledger를 복구한다.
- 실패 원인을 숨기기 위해 다른 도구나 다른 발행 경로로 우회하지 않는다.
- 동일 실패를 근거 없이 반복 실행하지 않는다.
- selector/UI 변경은 실제 DOM Evidence를 수집한 뒤 최소 selector 수정으로 해결한다.

## 34. 실제 공개 화면 완료 Gate
- GitHub commit 성공만으로 게시·수정 성공으로 판단하지 않는다.
- Tistory editor 저장 성공만으로 완료하지 않는다.
- 인증 없는 공개 페이지에서 직접 검증한다.
- 제목·본문·H2/H3·강조·표·FAQ·최신 근거·관련 글·출처·이미지·대표 이미지가 의도대로 정상이어야 한다.
- 신규 글은 카테고리·태그도 공개/관리 상태와 대조한다.
- PC 1440px 수준과 모바일 390px 수준에서 최소 검증한다.
- 모바일에서 document overflow, wide image가 없어야 한다.
- 실패 시 완료라고 보고하지 않는다.

## 35. 기존 글 최신화 품질 Gate
- 오래된 인사말·이모지 남발·과장된 효능·근거 없는 단정·낡은 숫자를 제거한다.
- 기존 URL의 원래 검색 의도를 완전히 다른 주제로 바꾸지 않는다.
- 이미 별도 최신 글이 있는 세부 검색 의도는 내부링크로 분리해 카니벌라이제이션을 줄인다.
- 필요하면 제목을 현대화하되 URL은 유지한다.
- 전체 최신화에서는 이미지·대표 이미지·FAQ·최신 근거·내부링크·출처까지 R3 수준으로 보강한다.

## 36. 콘텐츠 품질 자가검수
완료 전 아래 항목을 엄격하게 자체 검수한다.
- 검색 의도 충족
- 정보 정확성
- SEO 구조
- 출처·신뢰성
- 디자인 완성도
- 최신 정보 반영
- 가독성
- 정보량
- 이미지의 실제 도움 정도
- 내부링크
- 기존 글과의 카니벌라이제이션
- 모바일 가독성
- 대표 이미지/OG 일치

낮은 점수를 발견하면 평가표만 보고 멈추지 말고 수정 가능한 항목부터 반영한다.
점수를 과대평가하지 않는다.

## 37. SEO 후속 검증
- 발행 또는 대규모 최신화 직후 “검색 성과가 개선됐다”고 단정하지 않는다.
- 색인 상태와 실제 CTR/노출/순위 변화는 시간축을 구분한다.
- GSC에서 데이터가 쌓인 뒤 성과를 판단한다.
- 기존 URL 유지 최신화의 경우 수정일, 색인 재처리, 검색어 변화 여부를 필요 시 확인한다.
- sitemap/robots/canonical 변경이 없으면 불필요하게 재설정하지 않는다.

## 38. Evidence / 완료 기록
작업 성격에 따라 아래를 Evidence로 남긴다.
- 작업 시작 기준 main SHA
- 최종 source commit SHA
- workflow run ID
- runner 상태/label
- validate/test 결과
- ledger phase
- 공개 URL
- 공개 title
- 이미지 수 / 대표 OG 상태
- Editorial contract 결과
- PC/mobile 결과
- 실패가 있었던 경우 최초 FAIL stage와 최종 해결 근거

민감정보는 Evidence에 포함하지 않는다.

## 39. 작업 보고 방식
- 사용자가 실행을 요청한 작업은 중간 설명 때문에 중단하지 않는다.
- 승인·로그인·결제·삭제·복구 불가능 변경 등 실제 사용자 판단이 필요한 경우에만 중간 확인을 요청한다.
- 일반 수정은 조사 → source 수정 → 테스트 → 실행 → 공개 검증 후 결과를 보고한다.
- 실행하지 않은 작업을 “완료”라고 표현하지 않는다.
- 성공 보고에는 최소한 공개 URL 또는 실제 Production Evidence를 포함한다.
- 실패 보고에는 “무엇이 안 됐는지”와 “어디까지는 실제로 됐는지”를 분리한다.

## 40. 최종 완료 정의
### 신규 글
- 사실 확인
- 카니벌라이제이션 확인
- Editorial R3 source 완료
- 이미지 최소 3개 / alt 완료
- GitHub main 반영
- validate/test PASS
- 표준 `publish-posts.yml` 실행
- Tistory 실제 공개
- 대표 이미지 및 `og:image` PASS
- PC/mobile 공개 화면 PASS
- ledger `published`

### 기존 글 최신화
- 기존 URL/제목 확인
- update source 완료
- GitHub main 반영
- validate/test PASS
- 표준 `update-posts.yml` 실행
- 같은 숫자 URL 유지
- 공개 본문/이미지/대표 이미지/Editorial 검증 PASS
- PC/mobile PASS
- update ledger `updated`

### 스킨
- 원본 보존
- 최소 범위 source 변경
- GitHub main 반영
- 실제 Tistory 적용
- 주요 페이지 PC/mobile 기능 검증
- 기존 URL/글 구조 훼손 없음

### SEO
- GSC 기준 문제 확인
- 수정 반영
- 필요 시 sitemap/robots/canonical 검증
- 색인 상태와 실제 검색 성과를 구분해 보고
