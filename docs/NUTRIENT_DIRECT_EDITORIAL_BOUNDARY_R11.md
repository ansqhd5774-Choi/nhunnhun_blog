# 영양소 direct/SP1 편집 경계 R11

개정일: 2026-10-16

## 목적

`nhunnhun_blog`는 영양소 direct/SP1 원고의 **내용·소제목·문체·정보 배치**를 결정하지 않는다.

영양소 편집 기준의 유일한 원본은 다음이다.

- `ansqhd5774-Choi/nhunnhun_nutrients`
- 최신 `main`
- `PROJECT_INSTRUCTIONS.txt`

이 저장소는 영양소 direct/SP1에 대해 제출·구조 검사·이미지·강조 태그·source 무결성·공개 검증·원장 기록 같은 기술 역할만 담당한다.

## direct 영양소에서 사용하지 않는 legacy 편집 입력

과거 R1 자동작성 문서·템플릿·Queue/Ollama writer·과거 영양소 source·content-review·audit 문서는 복구·감사·호환 기록으로만 보존한다.

이 자료들의 문체·목차·정보 배치를 새 영양소 direct/SP1 원고의 작성 기준으로 재사용하지 않는다.

## 편집 판단과 기술 검사의 분리

`publishing/direct-focus.mjs`와 preflight는 영양소 본문의 문체 방향이나 자료 설명 방식을 정하지 않는다.

기술 검사는 다음처럼 제출 안전과 구조 무결성만 확인한다.

- 핵심 H2 최대 개수 같은 공통 구조 계약
- HTML 안전성
- sourceId·articleId·targetUrl·source drift
- 이미지·대표 이미지·강조 태그 구조
- TOP 순위에서 계산·추정값을 실제 측정값처럼 사용하는 명백한 구조 오류
- 제출·checkpoint·PUBLIC_VERIFIED·ledger

## legacy 자동작성 하드 차단

영양소는 legacy 자동작성 경로에서 공통 오류 `E_NUTRIENT_DIRECT_EDITORIAL_EXTERNAL`로 차단한다.

공통 차단 모듈은 `authoring/nutrient-editorial-boundary.mjs`다. 영양소 작업은 외부 모델 호출이나 자동 자료 수집보다 먼저 중단되며, 일반 Chat에서 `nhunnhun_nutrients` 최신 기준에 따라 완성한 source만 표준 direct/SP1 제출 경로에 넘긴다.

## 회귀 방지

회귀 테스트는 다음을 확인한다.

1. direct focus가 영양소 문체 방향을 결정하지 않는다.
2. 영양소 legacy writer가 외부 모델·자동 자료 수집 전에 차단된다.
3. verified nutrient keyword에서 불필요한 fetch 호출은 0회다.
4. legacy Ollama nutrient job에서 모델 상태 조회 호출은 0회다.
5. legacy OpenAI writer는 API key 또는 유료 API 호출 전에 차단된다.
6. 일반 독자형 영양소 문장이 별도 편집 프레이밍 없이 기술 검사를 통과한다.
7. legacy R1 파일은 보존하되 영양소 direct 편집 기준으로 승격하지 않는다.
