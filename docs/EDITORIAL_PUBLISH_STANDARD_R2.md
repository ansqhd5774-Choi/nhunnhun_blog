# Tistory Editorial Publish Standard R2

Status: ACTIVE
Target: 신규 티스토리 공개 글

## 1. 단일 발행 경로
신규 공개 글 생성은 `.github/workflows/publish-posts.yml` → `publishing/publish.mjs` 경로만 허용한다.
일회성/게시물 전용 워크플로가 `pnpm publish` 또는 `publishing/publish.mjs`를 직접 실행하면 테스트에서 FAIL 한다.

## 2. Authoring Source
`posts/*.json`의 신규 글은 의미 중심 HTML만 작성한다.
본문 디자인용 inline style, div/aside/figure 등 최종 렌더 전용 마크업을 신규 발행 원본에 직접 넣지 않는다.
최종 디자인은 `publishing/editorial.mjs`의 ACTIVE 템플릿이 생성한다.

신규 공개 글 최소 Gate:
- H2 4개 이상
- 본문 첫 구간은 대표 이미지 → 도입 문단 순서 필수
- `핵심만 먼저:` quick summary 필수
- 대표 이미지 1개 이상
- `representativeImageUrl` 필수
- 대표 이미지는 본문 이미지 중 하나와 정확히 일치
- `핵심 정리` 필수
- `자료 출처` 필수
- `자료 출처` 영역에 서로 다른 외부 근거 URL 2개 이상
- 위험 HTML·비HTTPS URL 금지

## 3. Editorial Render Contract
ACTIVE template: R2

게시 전 동일 renderer를 validate와 publish가 함께 사용한다.
검사 항목:
- H2 26px / 800 및 H2별 34x4 accent 1:1
- H3 20px / 800
- 모든 표 responsive wrapper 적용
- 모든 이미지 responsive 처리
- FAQ가 있으면 Q/A card 수 1:1
- 최신 근거가 있으면 aside module로 변환
- 핵심 정리 box 적용
- 함께 보면 좋은 글이 있으면 related card 적용
- 자료 출처는 저강도 source list 적용

정적 계약이 하나라도 다르면 공개 발행 금지.

## 4. Representative Image Contract
본문 이미지가 있는 신규 글은 대표 이미지 지정이 필수다.
발행 dialog에서 티스토리 대표 이미지 슬롯이 비어 있으면 `representativeImageUrl`을 실제 업로드한다.
공개 검증에서 `og:image`가 기본 `opengraph.png`이거나 kakaocdn 이미지가 아니면 FAIL 한다.

## 5. Public Runtime Contract
최종 발행 클릭 후 익명 공개 페이지에서 다음을 재검증한다.
- 제목/본문
- 본문 이미지가 Tistory native kakaocdn으로 노출
- H2/H3 디자인 계약
- H2 accent 개수
- 표 responsive wrapper
- FAQ Q/A
- 최신 근거
- 핵심 정리
- 관련 글 카드
- 출처 목록
- 대표 og:image

공개 Runtime 계약 실패 시 published 처리하지 않는다.

## 6. Ledger / Duplicate Protection
최종 클릭 직전에 `submitting` checkpoint를 저장한다.
기록에는 source commit, fingerprint, editorial template version을 남긴다.
submitting 상태는 자동 재시도하지 않는다.
published 상태의 기존 글은 source가 바뀌어도 신규 글로 다시 생성하지 않는다.
동시에 신규 ready 글이 2개 이상이면 발행 중단.

## 7. Workflow Safety
표준 publish workflow는 main 전용이며 publish job은 `nhunnhun-tistory-publish` concurrency group으로 직렬화한다.
validate와 publish 모두 동일한 current main source를 기준으로 검사한다.
publication ledger를 읽는 validate job에는 repository/token context가 명시되어야 한다.

## 8. 완료 조건
신규 글 완료는 다음 모두 PASS일 때만 인정한다.
1. source validation
2. editorial render contract
3. publish workflow
4. anonymous public body verification
5. public editorial DOM contract
6. representative image / OG verification
7. published ledger 기록

초안 저장이나 GitHub 반영만으로 실제 게시 완료라고 보고하지 않는다.
