# 추가 active 원고 10건의 명제별 확인 — 2026-10-10

기준 원격 commit: `9a6d7b5e9336e9276742322bafe625c02be61727`. 기존 10건과 겹치지 않는 공개 글을 선정했다. `/400`, `/411`, `/367`, `/369`, `/395`는 `publishing/update-state`의 `updated` 원고를 사용하고, 나머지는 published 원고를 사용했다. 제목·현재 본문 digest·이미지 검토 데이터 hash는 비공개 연결 원장에 보존했다. 기존 글 또는 이미지 자체를 수정하지 않았다.

공식 원문 10개를 이번 작업에서 실제 열람하고, 현재 본문의 아래 명제만 대조했다. 날짜는 글 전체 감수 완료일이 아니라 해당 명제를 읽고 확인한 날짜다.

|글|실제 확인 명제와 적용 조건|공식 근거|결과|명제 재검토일|
|---|---|---|---|---|
|[/376](https://nhunnhun.tistory.com/376)|감기는 대체로 서서히, 독감은 갑자기 시작하며 독감에도 열이 없을 수 있음|[CDC 증상](https://www.cdc.gov/flu/signs-symptoms/index.html)|PASS|2026-11-09|
|[/382](https://nhunnhun.tistory.com/382)|새우 살이 단단하고 불투명해질 때까지 조리, 2일 이내 사용할 생해산물은 4℃ 이하 냉장|[FDA 해산물](https://www.fda.gov/food/buy-store-serve-safe-food/selecting-and-serving-fresh-and-frozen-seafood-safely)|PASS|2026-11-09|
|[/401](https://nhunnhun.tistory.com/401)|껍데기 있는 조개는 입이 열린 뒤 3~5분 추가 끓이기, 가열 후 열리지 않는 것은 버리기|[CDC 비브리오 예방](https://www.cdc.gov/vibrio/prevention/index.html)|PASS|2026-11-09|
|[/400](https://nhunnhun.tistory.com/400)|조개 알레르기는 가열해도 반응 위험이 없어지지 않음|[NHS 조개](https://www.nhs.uk/live-well/eat-well/food-types/fish-and-shellfish-nutrition/)|PASS|2026-11-09|
|[/402](https://nhunnhun.tistory.com/402)|이소플라본/대두 단백질의 안면홍조 개선은 소폭일 수 있고 연구가 일관되지 않음|[NCCIH Soy](https://www.nccih.nih.gov/health/soy)|PASS|2027-01-08|
|[/411](https://nhunnhun.tistory.com/411)|미국 FDA 글루텐 프리 표시의 불가피한 잔류 글루텐은 20ppm 미만|[FDA 표시 규칙](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/questions-and-answers-gluten-free-food-labeling-final-rule)|PASS|2026-11-09|
|[/367](https://nhunnhun.tistory.com/367)|생강의 임신 관련 구역·구토 연구 가능성, 멀미 연구 대부분 부정적, 항암·수술 후 근거 불확실. 보충제 연구를 생강청 한 잔 효과로 동일시하지 않음|[NCCIH Ginger](https://www.nccih.nih.gov/health/ginger)|PASS|2026-11-09|
|[/369](https://nhunnhun.tistory.com/369)|2017 AASM·2019 VA/DoD 지침은 만성 불면증에 멜라토닌을 권고하지 않았다는 역사적 지침 설명|[NCCIH 수면](https://www.nccih.nih.gov/health/sleep-disorders-and-complementary-health-approaches)|PASS|2026-11-09|
|[/395](https://nhunnhun.tistory.com/395)|석류 주스·추출물의 혈압 연구 가능성이 있으나 추가 확인이 필요함. 알맹이 섭취의 치료 효과로 확대하지 않음|[NCCIH Pomegranate](https://www.nccih.nih.gov/health/pomegranate)|PASS|2027-01-08|
|[/360](https://nhunnhun.tistory.com/360)|아시아 인삼의 흔한 부작용 불면, 드문 심한 피부·간 손상·알레르기 보고, 약 복용 시 상담|[NCCIH Asian Ginseng](https://www.nccih.nih.gov/health/asian-ginseng)|PASS|2026-11-09|

## 날짜 구분

- 위 10건의 명제 확인일: `2026-10-10`. 기존 안전·지침 30일, 건강 효능 90일 규칙으로 해당 명제에만 재검토일을 연결했다.
- CDC 증상 페이지 표시일 `2024-08-26`; CDC 비브리오 페이지 표시일 `2025-07-07`. 최초 발행일이라고 추정하지 않는다.
- NHS는 마지막 검토일 `2026-06-26`, 다음 검토 예정 `2029-06-26`을 표시한다. 이것은 우리 명제 확인일과 별개다.
- NCCIH 본문 업데이트: Soy·Pomegranate `2025-04`, Ginger·Asian Ginseng `2025-02`, Sleep `2024-05`. 월만 있는 날짜에 임의로 일자를 붙이지 않는다. 사이트 공통 footer의 `2026-10-09`는 개별 글 업데이트일이 아니다.
- 두 FDA 페이지의 열람 본문에서 명확한 개별 게시일을 확인하지 못했다. `publicationDate=null`로 유지한다. HTTP 성공이나 사이트 metadata를 최초 게시일로 대체하지 않는다.

## 검증 범위와 잔여

선택 명제 10 PASS / 0 FAIL / 0 확인 불가. 이번 선택 명제에서 확정된 새 본문 오류는 없으며 수정 후보를 만들지 않았다. `/369`의 2017·2019 지침 설명이 2026 최신 지침 전수 확인을 뜻하지 않는다. `/382`의 영양 수치·제철, `/401`의 영양 수치·패류독소, `/402`의 국내 기능성·개별 메타분석, `/360`의 국내 제품 진세노사이드 수치 등은 이번 검사 범위 밖이다.

10건 모두 `wholeSourceCheckedAt=null`, `wholeNextReviewAt=null`을 유지한다. 현재 active 미검토 141건에서 전체 감수 완료 건수가 늘었다고 계산하지 않는다. 부분 명제의 근거 연결은 진전이지만 원고 전체 근거·이미지·의학 감수 완료와 구분한다. 공개 제출·원격 변경·공통 코드 변경 없음. 새로운 발행 게이트 없음.
