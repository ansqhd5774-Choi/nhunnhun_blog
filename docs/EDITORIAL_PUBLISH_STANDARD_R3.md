# Tistory Editorial Publish Standard R3

Status: ACTIVE
Target: 신규 티스토리 공개 글
Supersedes: R2 for new publications only. 기존 published ledger와 과거 글은 재발행하지 않는다.

## 1. 단일 발행 경로
신규 공개 글 생성은 `.github/workflows/publish-posts.yml` → `publishing/publish.mjs` 경로만 허용한다.
일회성/게시물 전용 발행 workflow는 금지한다.

## 2. Authoring Source
`posts/*.json` 신규 글은 의미 중심 HTML로 작성하고 최종 디자인은 `publishing/editorial.mjs`가 생성한다.

신규 공개 글 최소 Gate:
- H2 4개 이상
- 본문 첫 구간은 대표 이미지 → 도입 문단 순서
- `핵심만 먼저:` quick summary 필수
- **서로 다른 본문 이미지 최소 3개**
- 첫 이미지는 대표 이미지이며 `representativeImageUrl`과 정확히 일치
- 나머지 이미지는 내용 이해에 실제 도움이 되는 위치에 분산 배치
- 모든 이미지에 의미 있는 alt 필수
- 같은 이미지를 개수 충족 목적으로 반복 사용하면 FAIL
- `핵심 정리` 필수
- `자료 출처` 필수
- 자료 출처 외부 근거 URL 2개 이상
- 위험 HTML·비HTTPS URL 금지

## 3. 다색 형광펜 강조
원본에서 실제 핵심 단어나 짧은 구문만 `<u>...</u>`로 표시한다.
R3 renderer가 이를 다색 형광펜으로 변환한다.

승인 팔레트:
- Yellow: #fff1a8
- Lime: #d9f99d
- Blue: #bfdbfe
- Pink: #fbcfe8

규칙:
- 색은 강조 순서에 따라 자동 순환한다.
- 강조가 2개 이상이면 실제 렌더에서 최소 2색 이상 사용한다.
- 문단 전체·여러 문장 전체를 형광펜 처리하지 않는다.
- 제목 계층 → 여백 → 굵기 → 박스 → 형광펜 → 색상 우선순위를 유지한다.
- 색 자체에 의미를 고정하지 않는다.
- 한 문단에서는 실제 핵심 구문만 제한적으로 선택한다.

## 4. Editorial Render Contract
ACTIVE template: R3

게시 전 validate와 publish가 동일 renderer를 사용한다.
검사 항목:
- H2 26px / 800 및 H2별 accent 1:1
- H3 20px / 800
- 모든 표 responsive wrapper
- **이미지 3개 이상 및 모든 이미지 responsive**
- 첫 이미지 eager/fetchpriority high, 나머지 lazy
- source `<u>` 개수와 렌더 형광펜 개수 일치
- 강조 2개 이상이면 렌더 색상 최소 2종
- FAQ Q/A card 1:1
- 최신 근거 module
- 핵심 정리 box
- 관련 글 card
- 자료 출처 source list

정적 계약이 하나라도 다르면 공개 발행하지 않는다.

## 5. Representative Image Contract
대표 이미지 슬롯을 실제 티스토리 발행창에서 설정한다.
공개 페이지의 `og:image`가 기본 opengraph.png이거나 kakaocdn이 아니면 FAIL이다.

## 6. Public Runtime Contract
최종 발행 후 익명 공개 페이지에서 다음을 재검증한다.
- 제목/본문
- 본문 이미지 수와 kakaocdn 변환
- 이미지 responsive
- H2/H3/표/FAQ/최신 근거/핵심 정리/관련 글/출처
- **형광펜 개수와 다색 계약**
- 대표 og:image
- PC 및 모바일 가로 넘침 여부

## 7. Ledger / Duplicate Protection
최종 클릭 직전에 `submitting` checkpoint를 저장한다.
submitting은 자동 재발행하지 않는다.
published 글은 source가 바뀌어도 신규 글로 다시 만들지 않는다.
동시에 신규 ready 글이 2개 이상이면 중단한다.

## 8. 완료 조건
1. source validation
2. Editorial R3 render contract
3. 표준 publish workflow
4. 익명 공개 본문 검증
5. 공개 DOM 계약
6. 대표 이미지/OG 검증
7. PC/모바일 검증
8. published ledger 기록

GitHub 저장만으로 발행 완료라고 보고하지 않는다.
