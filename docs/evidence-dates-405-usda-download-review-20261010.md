# /405 USDA 공식 다운로드 대조 진전

2026-10-10 실제 조회. 상세페이지 도구 오류와 별개로 [USDA 공식 Download Datasets](https://fdc.nal.usda.gov/download-datasets/)가 제공하는 [SR Legacy April2018 JSON ZIP](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip)을 정상 HTTP로 다운로드했다. 키·로그인·보안 제한 우회 없음. 비공개 체크포인트에 ZIP(13,456,312 bytes)과 정확172467/172475 항목만 추출한 `usda-tempeh-tofu-exact.json` 저장. 전체 데이터는 저장소에 추가하지 않는다.

|공식 식별|원문 설명|직접 읽은 값|
|---|---|---|
|172467|Tempeh, cooked|195kcal, protein19.9g, fat11.4g, carbohydrate7.62g, iron2.13mg, magnesium77mg, calcium96mg, potassium401mg|
|172475|Tofu, raw, firm, prepared with calcium sulfate|protein17.3g|

본문195/7.62/2.13/77/96/401은 일치한다. 본문19.91/11.38/두부17.27은 공식 ZIP의 표시 정밀도로 반올림하면19.9/11.4/17.3과 일치한다. **표시 정밀도의 차이를 확정 수치 오류로 단정하지 않고, 더 많은 소수자리 자체는 이번 ZIP로 직접 확인하지 못했다고 구분한다.** 템페 항목에 섬유 영양성분 행이 없음을 확인해 '식이섬유 확정값을 채우지 않음'과 일치한다. 80/150g 계산은195/19.91을 조건으로 기존 산술 정확.

출시 자료월2018-04, 항목 publicationDate2019-04-01, 실제 확인일2026-10-10을 서로 구분한다. 데이터 문서에 SR Legacy는 최종 고정 release라고 명시한다. 현재 개별 FDC 상세화면을 새로 읽은 것으로 보고하지 않는다.

후속 확인: 상세 내용은 `docs/evidence-dates-381-405-prepared-whole-review-20261010.md`에 기록했다. 2021은 초록만 실제 읽었으며 세부 발효·B12 주장은 2026 공식 출판사 전체 관련 절로 대조했다. NIH Mg/Ca/Probiotics와 귀리 beta-glucan 공식 자료 연결을 완료했다. Leftovers는 live fetch 미확인이지만 공식 URL 검색에 반환된 원문 내용을 실제 읽었고 기존 직접 FSIS Freezing의 동일 조건을 재사용했다. 공식 표시 정밀도로 교정한 /405 준비 원고의 전체 핵심 출처 검토 후보를 작성했다. 현재 공개 수정 전이므로 `/405` 실제 전체 확인일·재검토일 null, 운영 추가검토140 그대로이며 공개 발행·원격 변경은 없다.
