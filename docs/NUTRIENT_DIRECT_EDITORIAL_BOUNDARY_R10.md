# 영양소 direct/SP1 편집 경계 R10

개정일: 2026-10-15

## 목적

`nhunnhun_blog`는 영양소 direct/SP1 원고의 **내용·소제목·문체·정보 배치**를 결정하지 않는다.

영양소 편집 기준의 유일한 원본은 다음이다.

- `ansqhd5774-Choi/nhunnhun_nutrients`
- 최신 `main`
- `PROJECT_INSTRUCTIONS.txt`

이 저장소는 영양소 direct/SP1에 대해 제출·구조 검사·이미지·강조 태그·source 무결성·공개 검증·원장 기록 같은 기술 역할만 담당한다.

## direct 영양소에서 사용 금지하는 legacy 편집 입력

다음 자료는 과거 R1/자동작성 호환 기록으로만 보존하며 영양소 direct/SP1 원고의 작성 기준으로 사용하지 않는다.

- `docs/CONTENT_STANDARD_R1.md`
- `docs/CONTENT_WRITER_PROMPT_R1.md`
- `docs/CONTENT_REVIEW_FORMAT_R1.md`
- `docs/content/DOMAIN_GUIDES_R1.md`
- `workstreams/posts/templates/article.md`
- `authoring/queue-single-pass.mjs`의 legacy writer
- `authoring/queue-plan.mjs`
- `authoring/queue-r53.mjs`
- `authoring/queue-research.mjs`
- `authoring/queue-evidence-support.mjs`
- 과거 영양소 source·content-review·audit 문서의 문체와 목차

과거 파일을 보존하는 것은 작성 예시로 재사용한다는 뜻이 아니다.

## 제거된 편집 진단

`publishing/direct-focus.mjs`는 다음을 더 이상 계산하거나 반환하지 않는다.

- 연구 상세 문장 수
- 한계·부정 문장 수
- 한계 문장 목록

기술 검사는 문체를 긍정/부정으로 평가하거나 특정 자료 표현을 요구하지 않는다.

## legacy 자동작성 차단

영양소는 `authoring/queue-single-pass.mjs`의 legacy writer를 사용할 수 없다.

호출 시 `E_NUTRIENT_DIRECT_EDITORIAL_EXTERNAL`로 즉시 중단한다. 영양소 원고는 일반 Chat에서 `nhunnhun_nutrients` 최신 기준에 따라 완성한 source를 표준 direct/SP1 제출 경로에 넘긴다.

## 유지하는 기술 보호

다음은 편집 방향과 무관한 기술·안전 보호이므로 유지한다.

- 핵심 H2 최대 개수 같은 공통 구조 계약
- HTML 안전성
- sourceId·articleId·targetUrl·source drift
- 이미지·대표 이미지·강조 태그 구조
- TOP 순위에서 계산·추정값을 실제 측정값처럼 사용하는 명백한 구조 오류 차단
- 제출·checkpoint·PUBLIC_VERIFIED·ledger

## 회귀 방지

회귀 테스트는 다음을 확인한다.

1. direct focus 결과에 연구/한계 카운터가 존재하지 않는다.
2. 영양소 legacy single-pass writer가 모델 호출 전에 차단된다.
3. 일반 독자형 영양소 문장은 특정 연구 표현 없이도 기술 검사를 통과한다.
4. legacy R1 파일은 보존하되 영양소 direct 편집 기준으로 승격하지 않는다.
