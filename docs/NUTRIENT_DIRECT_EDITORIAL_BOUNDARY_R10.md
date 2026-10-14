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
- `authoring/generate.mjs`의 legacy OpenAI writer
- `authoring/keywords.mjs`의 legacy keyword/Ollama writer
- `authoring/ollama.mjs`의 legacy Ollama writer
- 과거 영양소 source·content-review·audit 문서의 문체와 목차

과거 파일을 보존하는 것은 작성 예시로 재사용한다는 뜻이 아니다.

## 제거된 편집 진단

`publishing/direct-focus.mjs`는 다음을 더 이상 계산하거나 반환하지 않는다.

- 연구 상세 문장 수
- 한계·부정 문장 수
- 한계 문장 목록

기술 검사는 문체를 긍정/부정으로 평가하거나 특정 자료 표현을 요구하지 않는다.

## legacy 자동작성 하드 차단

영양소는 모든 legacy 자동작성 경로에서 공통 오류 `E_NUTRIENT_DIRECT_EDITORIAL_EXTERNAL`로 차단한다.

공통 차단 모듈은 `authoring/nutrient-editorial-boundary.mjs`이며 다음 경로가 이를 사용한다.

- `authoring/update-producer.mjs`: queue item 선택 직후 차단한다. 공개 페이지 fetch, `queue-research`, evidence 수집, Ollama 상태 조회, writer 호출보다 먼저 중단한다.
- `authoring/queue-single-pass.mjs`: legacy single-pass writer 진입을 차단한다.
- `authoring/generate.mjs`: OpenAI API key 확인 및 API 호출 전에 영양소 초안 생성을 차단한다.
- `authoring/keywords.mjs`: 확인된 영양소 alias는 디렉터리 생성·research·Ollama 호출 전에 차단하고, 모델 분류 결과가 영양소이면 research 전에 차단한다.
- `authoring/ollama.mjs`: job 검증 직후, Ollama 모델 상태 조회 전에 영양소 job을 차단한다.

영양소 원고는 일반 Chat에서 `nhunnhun_nutrients` 최신 기준에 따라 완성한 source를 표준 direct/SP1 제출 경로에 넘긴다.

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
2. 영양소 legacy writer가 model/research/evidence 호출 전에 차단된다.
3. verified nutrient keyword에서 fetch 호출은 0회다.
4. legacy Ollama nutrient job에서 모델 상태 조회 호출은 0회다.
5. legacy OpenAI writer는 API key 또는 유료 API 호출 전에 차단된다.
6. 일반 독자형 영양소 문장은 특정 연구 표현 없이도 기술 검사를 통과한다.
7. legacy R1 파일은 보존하되 영양소 direct 편집 기준으로 승격하지 않는다.
