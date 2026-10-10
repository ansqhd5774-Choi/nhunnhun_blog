# 근거·날짜 실제 검토6차 및 원장 정확URL 연결

## 원래145건과 정확URL join

원장 sourceCommit8fc25a9의 sourceFile 본문URL과5차25URL을 정확문자열로 대조했다. **145건중60원고/114연결**이 실제읽은 원문과 연결됐다. 이는 일부출처 확인이며 전체원고 검토완료가 아니다. **전체확인일 미확인 감소0,145유지**. 리디렉트로 다른URL의 날짜까지 임의확정하지 않았다. private chunk5-original-register-join.json에 세부연결을 기록했다.

## 다음 청크

선정 도메인 목록의 남은URL은22개였다. 실제본문 접근21, 확인불가1(ODS Omega3 HealthProfessional 셸403+공식web오류). PDF는 HTML200을 읽은 것으로 처리하지 않고 공식web PDF본문을 별도로 읽었다. 전체최초게시일을 자동확정하지 않았다.

|번호|정확 원문|접근|날짜·검토범위|
|---|---|---|---|
|1|[원문](https://www.cdc.gov/flu/spread/)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|2|[원문](https://www.cdc.gov/flu/takingcare/index.html)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|3|[원문](https://www.cdc.gov/respiratory-viruses/prevention/precautions-when-sick.html)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|4|[원문](https://www.fda.gov/food/food-additives-petitions/sugars-are-metabolized-differently-traditional-sugars)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|5|[원문](https://www.nccih.nih.gov/health/ginger/)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|6|[원문](https://www.cdc.gov/flu/spread/index.html)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|7|[원문](https://www.cdc.gov/flu/signs-symptoms/index.html)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|8|[원문](https://www.cdc.gov/children-and-school-preparedness/infection-prevention/when-sick.html)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|9|[원문](https://www.cdc.gov/flu/treatment/index.html)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|10|[원문](https://ods.od.nih.gov/factsheets/Iron-Consumer/)|PASS|web실제읽기; Updated2023-08-17, 철분역할/용량/안전본문|
|11|[원문](https://ods.od.nih.gov/factsheets/Pregnancy-HealthProfessional/)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|12|[원문](https://www.nccih.nih.gov/health/sleep-disorders-and-complementary-health-approaches)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|13|[원문](https://ods.od.nih.gov/factsheets/Omega3FattyAcids-Consumer/)|PASS|web실제읽기; Updated2022-07-18|
|14|[원문](https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/)|확인불가|403/공식web오류; 확인일·재검토기한 미확정|
|15|[원문](https://www.fda.gov/media/128043/download)|PASS|FDA 실제응답서 PDF본문 읽기; 5g초과 출혈근거부족과5g조건 구분|
|16|[원문](https://www.nccih.nih.gov/health/pomegranate)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|17|[원문](https://www.nccih.nih.gov/health/asian-ginseng)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|18|[원문](https://www.nccih.nih.gov/health/providers/digest/herb-drug-interactions-science)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|19|[원문](https://www.cdc.gov/shingles/signs-symptoms/index.html)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|20|[원문](https://www.cdc.gov/shingles/vaccines/index.html)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|21|[원문](https://www.cdc.gov/shingles/hcp/vaccine-considerations/immunocompromised-adults.html)|PASS|기관본문관련성 확인; 전체주장대조 미완료|
|22|[원문](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/nutrition-information-raw-vegetables)|PASS|기관본문관련성 확인; 전체주장대조 미완료|

## 수정 우선순위 후보

- CDC flu/takingcare는 발열없는 의심·확진독감에서 증상발생후 최소5일 재택을 명시한다. influenza-contagious-isolation-return-school-work-20261007의 무열절은 일반호흡기24시간호전기준만 설명하므로, 현재공개본문/active최신원고를 확인해 독감특이기준 누락 여부를 확정해야 한다. 전체일반규정이 거짓이라는 판정은 아니다.
- CDC에는 표시일·first_published·last_published가 서로 다르거나 first_published빈값이 있다. 날짜메타자동충족 기준으로 쓰지 않는다.
- FDA128043 PDF는 제목에 Petition이 있지만 FDA가 GOED청원에 응답하는 실제서신이다. 민간청원자료 오인이나 FDA출처오류로 판정하지 않았다.
- 재검토30/90/365일 정책은 완결된 주장검토와 역할분류에 적용한다. URL접근만 완료된 원고전체의 nextReviewAt은 확정하지 않았다.
- 원격변경·신규수정후보 작성 없음.
