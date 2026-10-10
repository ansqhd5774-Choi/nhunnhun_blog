# /381 제철 범위 최소 교정 및 추가 출처 대조

검토일2026-10-10. 원고 원격 해시45716319a3f98c821f6046fce8f73532c5b743d0880cb238350cb5affa58e55a. 기존 숫자 URL·제목·본문 사진·imageReview·대표 이미지 유지. 신규 후보 `updates/evidence-dates-381-season-fix-20261010.json`, 생성 스크립트 `scripts/evidence-dates-prepare-381-season.mjs`. 원격/공개 변경 없음.

확정 문제: 미국 Big River Chestnuts 사례 수확기9월말~11월을 도입/12절/핵심에서 밤 일반 제철로 확대했다. 국내 농식품정보누리2015-12-07 밤 원문은 국내 생산8~10월 및 늦여름~가을을 안내한다. 국내 생산기간에 미국 농가의 시작·종료 시점을 일률 적용할 수 없다. 이 자료의 과장된 질병 예방 표현·오래된 영양표는 가져오지 않았다.

수정 범위는 정확3곳이다. 도입은 국내 늦여름~가을·지역품종차이,12절은 국내8~10월 안내와 미국 사례9월말~11월의 범위 구분, 핵심 정리는 같은 구분으로 맞췄다. 원문의 다른 건강·보관·영양 문장은 변경하지 않았다. 출처: [농식품정보누리 밤](https://www.foodnuri.go.kr/portal/bbs/B0000283/view.do?menuNo=300063&nttId=219916&pageIndex=1).

추가 직접 확인: [NIH 칼륨](https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/) 개정2022-06-02의 신경·근육·체액 기능, [NIH 엽산](https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/) 개정2022-11-30의 세포분열·결핍 거대적아구성 빈혈, [CDC 섬유](https://www.cdc.gov/diabetes/healthy-eating/fiber-helps-diabetes.html) 자료2024-05-15의 포만감·배변 기능과 기존본문 역할 일치. 식품별 질병 치료 효과로 확대하지 않음. 농식품정보누리의 단단함·무게·윤기·주름/벌레 점검, 냉장·냉동 보관은 기존 선택·보관 방향을 지지한다. 실제 확인일은 모두2026-10-10이다.

검증: 생성 스크립트의 exact3회 치환·현재 해시·update source·image review·title/image 보존 assertion PASS. 원문 HTML의 명시적 strong/mark/u/img 구조는 동일하다. SP1 렌더러가 기존 legacy에 자동 강조를 적용하므로 **legacy 기존렌더와 SP1 신규렌더의 strong 수는28→36**이며 사진 수는 같다. 같은 SP1 렌더러로 교정 전후를 비교하면 strong/mark/u/img 수가 동일하다. 자동 강조를 의미검토 증거로 쓰지 않는다.

정식 `publishing/validate-content.mjs --check` 결과는 SP1 `CONTENT_VALIDATION_SKIPPED`, semanticVerification=not-performed, failed0이다. 이를 R1 의미 계약 PASS로 보고하지 않는다. 위 제철3문구는 직접 수동 의미 대조했으며 기존 다른본문의 새 전체 승인과 구분한다. `/381` wholeSourceCheckedAt/nextReview는 공개 교정 및 잔여 확인 전 null, 운영 미검토140 유지.
