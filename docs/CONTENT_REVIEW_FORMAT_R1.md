> 최신 실행 기준: [일반 Chat 작성·러너 실행 계약](GENERAL_CHAT_EXECUTION.md)이 작성자 로컬 명령·GUI 의무와 공개 검증 담당에 우선합니다. 아래의 명령·미리보기·관리자 화면 절차는 러너/운영자용이며 일반 Chat의 필수 기능이 아닙니다. 직접 원고는 최신 DIRECT_AUTHORING_R1을 적용합니다.

# Content Review R1 — source와 검토서 계약

## 1. 파일 두 개가 한 글이다

- 신규: `posts/<id>.json` + `content-reviews/posts/<id>.json`
- 기존 수정: `updates/<id>.json` + `content-reviews/updates/<id>.json`

source의 `id`와 파일 이름은 일치한다. source에는 기존 필드 외 `contentStandard: "R1"`만 추가한다. updates에는 실제 `category`도 넣는다. 주제·원문·의미·검토서 데이터를 source 안에 임의 필드로 넣지 않는다. 신규와 수정 namespace는 분리하며 실제 기존 URL은 보존한다.

## 2. CLI (추가 AI API·비용 없음)

Windows 작업도 CMD에서 저장소 root를 기준으로 실행한다. `food-example`은 실제 id로 바꾼다.

```cmd
node publishing/validate-content.mjs --scaffold posts/food-example.json
node publishing/validate-content.mjs --hash posts/food-example.json
node publishing/validate-content.mjs --check posts/food-example.json
npm run test:content
npm test
npm run validate:content
```

scaffold는 stdout으로 **미승인 빈 검토서**를 출력한다. 작성자가 실제 조사·검토를 채워 지정 경로에 저장한다. 해시 도구는 source 전체 JSON을 키 정렬한 후 SHA256을 계산한다. body뿐 아니라 이미지·category·status·approved까지 바뀌면 재검토해야 한다. 검토서 자체의 해시가 아니므로 자기참조는 없다.

`--all`은 모든 R1을 검사하고 과거 미변경 source는 legacy로 집계한다. **Scan Density 최소 강조량은 소급 감사에서는 적용하지 않고**, `--changed`, `--check`, 실제 발행·수정 직전에 강제한다. 이미 공개 완료된 R1 글도 다음에 다시 수정하면 새 최소 강조량을 충족해야 한다. `--changed`는 CI가 제공한 정확한 base/head SHA 범위의 source 또는 검토서 변경을 검사한다. `--check`와 실제 발행·수정은 R1을 반드시 요구한다. 테스트 fixture를 real posts에 복사해 발행하지 않는다.

## 3. 검토서 최상위 필드

| 필드 | 내용 |
| --- | --- |
| version | R1 |
| domain | food / nutrient / medicine / disease |
| classification | rawInput, topic, meaning, entityId, status=resolved, reason |
| sourceDigest | 최종 source 전체의 SHA256 |
| intent | primaryQuestion, readerSituation, nextActions 배열 |
| extensions | 확장 19개 각각 applies:boolean, reason |
| coverage | module, heading, answerQuote, sourceIds 배열 |
| connections | 나머지 세 domain의 포함 또는 제외 검토 |
| sources | 실제 읽고 본문에 연결한 근거 자료 |
| glossary | 첫 전문용어와 가까이에 있는 explanation |
| comparisons | 비교 대상·목적·기준·직접성·한계·본문·근거 |
| combinations | 조합의 목적·관계·본문·근거 |
| selectionCriteria | 무엇을·왜·어디서 확인하는지와 본문·근거 |
| review | 검토자·실제 검토일·상태·체크별 근거·경고 해소 |

최상위 허용 필드 이외는 실패한다. 빈 값·짧은 채우기 문구를 통과시키는 도구가 아니다. 구조적 최소 글자 수는 무의미한 빈 기록을 거르기 위한 기준이며 답변의 의학적 충분성을 뜻하지 않는다.

## 4. 답변·출처를 실제 본문에 연결

`coverage.heading`은 본문 H2 또는 H3의 유일한 실제 텍스트다. `answerQuote`는 해당 섹션 본문에서 가져온 실제 설명 구절(최소 12자)이다. 질문이나 제목만으로는 답변을 대체하지 않는다. 한 소제목 안에서 여러 모듈에 답할 수 있다. 같은 문자열의 소제목을 반복하면 위치가 모호해져 실패한다.

`sourceIds`는 실제 sources의 id를 가리키고 해당 섹션에도 그 URL 링크가 있어야 한다. 맨 아래 자료 출처 목록에만 넣고 본문과 연결을 생략하지 않는다. decision의 자체 요약 외 모듈은 출처를 연결한다. 문장을 옮기거나 링크를 없앤 경우 재검토서가 필요하다.

sources 원소: `id`, `url`, `title`, `kind`, `role`, `checkedAt`(YYYY-MM-DD), `scopeNote`. 확인하지 않은 미래 날짜는 허용하지 않는다. kind는 official/guideline/systematic-review/trial/nutrition-database/manufacturer/local-authority/article, role은 health/safety/nutrition/product/origin/context/authorization다. scopeNote에는 이 자료가 실제 뒷받침하는 대상·기간·제품·조건과 적용 한계를 적는다.

건강·안전·영양·허가 역할의 공식자료·지침·원문 연구·영양 데이터 URL 최소 2개가 필요하다. 판매자·지역 홍보·기사의 존재만으로 이 최소 근거를 충족시키지 않는다. 이미지·제품·산지 출처만으로 대체하지 않는다. 의약품에는 국내 식약처 공식 authorization 근거가 필요하며 실제 글의 정확한 제품 또는 성분과 일치해야 한다. 도메인 검사만으로 자료의 일치나 최신성이 증명되는 것은 아니므로 편집자가 실제 읽는다. 기사만으로 중요한 의료 주장을 확정하지 않는다.

## 5. 타 분야·비교·병용·선택

연결 포함 형식은 `status=included`, `reason`, `relationship`, `heading`, `answerQuote`, `sourceIds`다. 관계는 supportive-food/nutrient-source/symptom-care/interaction/treatment-context/alternative/risk-context. 제외는 `status=not-applicable`과 구체적인 reason이다. 다른 세 분야를 전부 고려하되 억지로 넣지 않는다.

comparison extension 적용 시 comparisons는 실제 비교별로 `left`, `right`, `goal`, `basis`, `directness`(head-to-head/indirect/qualitative), `limitations`, `heading`, `answerQuote`, `sourceIds`를 적는다. 직접 비교가 아니면 직접 우월성처럼 본문에 쓰지 않는다. basis에는 수치 비교의 단위·대상·기간을 적는다.

combinations extension 적용 시 `items`(2개 이상), `relationship`(benefit/compatible-only/symptom-support/avoid/consult/insufficient-evidence), `purpose`, `heading`, `answerQuote`, `sourceIds`를 적는다. benefit은 추가 이익 주장이고 compatible-only는 함께 사용할 수 있다는 뜻이다. benefit에는 공식자료·지침·체계적 고찰·시험 수준의 근거가 필요하며, 판매자 설명만으로 보강하지 않는다.

products extension 적용 시 selectionCriteria는 `criterion`, `whyItMatters`, `howToCheck`, `heading`, `answerQuote`, `sourceIds`를 적는다. “믿을 만한 브랜드” 같은 추상적 표현보다 해당 성분의 유효 함량·제형·추가 성분·표시사항·비용 등을 실제로 확인하는 방법을 설명한다.

## 6. 실제 검토 기록

review: `status=approved`, `checkedAt`, `reviewer={name,kind,independence}`, `checks`, `warningResolutions`.
검토자 kind는 ai/human, independence는 same-author/independent다. 같은 GPT의 재검토는 독립 검토나 의사 검토가 아니다. 실제 존재하지 않는 검토자의 이름·자격을 넣지 않는다.

checks 11개는 readerIntent, accuracy, expectations, comparison, combinations, crossDomain, safety, tone, emphasis, images, linksAndSearch이며 각각 `status=pass`와 구체적인 `note`를 남긴다. 해당되지 않는 비교도 “이 주제는 비교할 구매 선택이 없어 제외했다”처럼 실제 판단을 쓴다. 자가 검토 true만 나열하면 안 된다.

자동 경고가 있으면 원인을 수정하거나 warningResolutions에 `code`, `note`를 적는다. 글의 일부가 의도적으로 길거나 경고가 반복되는 이유를 실제로 검토한다. 의미 없는 사유로 검사를 무력화하지 않는다. 의료 위험·필수 답변·미완성 검토·stale hash 오류는 경고 해소로 건너뛸 수 없다.

## 7. 주요 실패와 조치

| 오류 | 조치 |
| --- | --- |
| E_CONTENT_STANDARD_REQUIRED | 해당 발행/수정 source를 실제 검토한 R1으로 준비 |
| E_CONTENT_REVIEW_MISSING / STALE | 검토서 경로 확인, 변경 내용을 재검토 후 최신 해시 |
| E_CONTENT_CLASSIFICATION / CATEGORY_MISMATCH | 원문 의미·주 도메인·실제 category 일치 |
| W_CONTENT_TOPIC_EXTENSION_OMITTED | 추천 프로필의 제외 이유를 검토하고 기록; 적용을 강제하지 않음 |
| E_CONTENT_REQUIRED_MODULE / ANSWER_NOT_FOUND | 제목만 추가하지 말고 독자가 사용할 답을 작성 |
| E_CONTENT_MODULE_CITATION | 해당 답변 가까이 올바른 원문 출처 연결 |
| E_CONTENT_KR_AUTHORIZATION | 정확한 국내 의약품 허가사항 확인 |
| E_CONTENT_REVIEW_CHECK | 실제 11개 검토를 수행하고 판단 이유 작성 |
| E_CONTENT_SCAN_EMPHASIS | 해당 H2 길이에 맞게 굵은 핵심어·형광펜·배지 등 스캔 앵커를 추가하고 결론·조건·행동이 눈에 보이게 배치 |
| E_EDITORIAL_R4_* | 허용된 의미형 HTML과 렌더 계약 확인 |

이 검토서는 자동 의료 검증 또는 법적·전문적 감수 인증이 아니다. PASS 문구는 계약 검사 결과이며 실제 게시 완료는 별도의 표준 공개 검증으로 판단한다.
