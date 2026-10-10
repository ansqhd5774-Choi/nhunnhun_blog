# 근거·날짜 실제 검토 4차 — 인공눈물 /392

- 확인일: 2026-10-10. 기준 origin/main: 026ce22f3346adfcf6f5e64b95195005bc1f641b.
- 대상은 /390이 아니라 **/392**. 공개 URL과 published 원장 artificial-tears-preservative-free-vs-preserved-20261006을 대조했다.
- 이번 범위는 기존 글의 출처·제품별 사용조건 교정이다. 전체 날짜 미확인145건 완료를 의미하지 않는다.

## 실제 확인 결과

| 항목 | 판정 | 근거 및 조치 |
|---|---|---|
| 기존 emc101467의 제품 정체 | FAIL | Dorzolamide20mg/ml 녹내장 처방약이다. 윤활제 설명의 대표 출처로 잘못 연결했다. 폐기 원칙 자체가 거짓이라는 판정은 아니다. |
| 실제 윤활제 Celluvisc1% | PASS | emc1430 공식 SmPC의 성분·적응증·개봉 즉시 사용·잔액폐기를 읽었다. 해당 제품으로 교체했다. |
| 국내 제품 기준 | PASS | MFDS 눈앤0.5%(200710762) 현행 허가에서 일회용·다회용 및 BAK 유무를 구분했다. 1~2방울은 이 제품의 예시다. |
| 다른 점안제 간격 | FAIL | 기존 5~10분 문구가 확인한 제품의15분 안내와 다르다. 국내 눈앤·영국 Celluvisc 예시로 범위를 명시해 교정했다. |
| 금기·악화 시 대응 | PASS | 국내 다회용 과민증 금기·소프트렌즈 주의와 두 제형의 증상 악화/72시간 지속 시 중지·상담을 확인했다. 심한 통증·시력저하는72시간 기다리는 지시가 아니다. |
| 제품별 보관 | PASS | 국내 상온15~25℃, 영국25℃ 이하 및 원포장 기준을 각각 표시했다. |
| 방부제 사용빈도 | PASS | Mayo와 Cleveland 기관 안내를 실제 읽었다. 기관별 범위를 제품 공통 용량으로 단정하지 않았다. 접근하지 못한 AAO의6회 기준은 후보에서 제외했다. |
| FOREVER 연구 유형 | PASS | PubMed 공식 XML의 단면 관찰연구를 확인했다. 전체67,951명 중 인공눈물 사용자8,039명으로 인과관계 입증 시험이 아니다. 검토서도 article로 분류했다. |
| 방부제 독성 검토·전문가 제언 | PASS | PMID39921541,40937610 초록을 실제 읽고 간접 근거임을 유지했다. |
| 특수 다회용 용기 | PASS | TFOS 실제 원문은 무방부제 다회용 사용을 다룬다. 직접 확인하지 않은 밸브·필터 세부 기전은 제거했다. |
| 단회용24시간 문구 | PASS | Cleveland 일반안내에 있으나 국내 해당제품의 즉시폐기 허가를 덮어쓰지 않았다. |

이번 청크: PASS9 / FAIL2. FAIL은 교정 후보에 반영했으며 공개 교정 여부는 부모 작업의 제출·공개 검증으로 확정한다.

## 날짜 구분

- Celluvisc 공식 SmPC: 페이지 갱신2025-05-13, 문서 텍스트 개정2025-03-27. 실제 확인2026-10-10과 다르다.
- Cleveland 기관 안내:2023-02-21. 실제 확인2026-10-10.
- 국내 눈앤: 허가 변경이력의 보관 변경2025-11-13은 전체 본문의 발행일로 쓰지 않았다.
- PMID40259827/39921541/40937610:2025년 연구. 실제 확인2026-10-10.
- Mayo·TFOS의 최초 게시일은 이번 범위에서 확정하지 않았으며 실제 읽은 확인일만 기록한다.

## 표준 후보와 검증

- source: evidence-dates-392-eye-drop-source-20261010 (기존 URL392 유지).
- 정상 R1 medicine14모듈과 의미 있는 강조를 적용했다. scan density 정책은 낮추지 않았다.
- 기존 원고의 유효3이미지 검토를 재사용했다. 새 시각검토를 수행했다고 표현하지 않는다.
- strict update schema / imageReview / render / evaluateContent density=true: PASS.
- validate-content.mjs --check updates/evidence-dates-392-eye-drop-source-20261010.json: checked1 failed0.
- 검토는 AI 동일작성자 검토이며 독립 의료인 감수가 아니다. 계약 검사는 의미적 정확성을 자동 증명하지 않는다.
- 후보 및 검토서: 로컬 private evidence-dates-batch/update-392-candidate.json, review-392-candidate.json. 재현: scripts/evidence-dates-prepare-392.mjs.
- 이 서브에이전트는 commit/push/공개수정 미실행.

## 원문

- https://www.medicines.org.uk/emc/product/101467/smpc (기존 오류 제품 식별)
- https://www.medicines.org.uk/emc/product/1430/smpc
- https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=200710762
- https://www.mayoclinic.org/diseases-conditions/dry-eyes/diagnosis-treatment/drc-20371869
- https://my.clevelandclinic.org/health/treatments/24804-artificial-tears
- https://tfosdewsreport.org/report-management_and_therapy/147_36/en/
- https://pubmed.ncbi.nlm.nih.gov/40259827/
- https://pubmed.ncbi.nlm.nih.gov/39921541/
- https://pubmed.ncbi.nlm.nih.gov/40937610/
