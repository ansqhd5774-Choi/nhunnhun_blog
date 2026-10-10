# 추가 3차 active 원고 10건 — 명제·출처 날짜 확인

확인일: 2026-10-10. 기준 원격 commit: `ee29cc3ef06f8becb3f0d48b4ca575c9779ebe1f`. 앞선 20건과 중복되지 않는 글을 확인했다. 현재 공개 원장에 연결된 원고를 사용했으며 `/383`, `/365`, `/64`는 updated 원고를 적용했다. 미제출 상태인 `posts/omega3-epa-dha-dose-safety-20261004.json`은 active 원고로 사용하지 않았다.

|글|이번에 직접 대조한 명제|근거와 자료 날짜|판정|명제 재검토일|
|---|---|---|---|---|
|[/391](https://nhunnhun.tistory.com/391)|아프타성 궤양은 헤르페스 감염과 다르고 다른 사람에게 전염되지 않음|[Mayo Clinic](https://www.mayoclinic.org/diseases-conditions/canker-sore/symptoms-causes/syc-20370615), 이번 열람 범위의 명확한 게시일 미확인|PASS|2026-11-09|
|[/381](https://nhunnhun.tistory.com/381)|냉장실·찬물·전자레인지는 USDA가 안내하는 냉동 식품의 안전한 해동 경로|[USDA FSIS](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/freezing-and-food-safety), 개별 게시일 미확인|PASS|2026-11-09|
|[/405](https://nhunnhun.tistory.com/405)|비타민 C가 식물성 비헴철 흡수에 유리하고 콩·곡류 피트산은 흡수를 방해할 수 있음|[NIH ODS Iron](https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/), 기존 확인된 업데이트 2025-09-04|PASS|2027-10-10|
|[/398](https://nhunnhun.tistory.com/398)|WHO 유리당 기준은 총 에너지 10% 미만, 추가 감소 5% 미만. 2,000kcal 예시는 50g·25g이며 유자차 전용 허용량이 아님|[WHO 정보 노트](https://www.who.int/publications/i/item/WHO-NMH-NHD-15.3), 2015-03-10|PASS|2026-11-09|
|[/365](https://nhunnhun.tistory.com/365)|FDA 2025년 정보 요청 문서는 그릭·그릭스타일 고단백 요거트의 다양한 제조 공정·원료를 다룸|[FDA 정보 요청](https://www.fda.gov/food/hfp-constituent-updates/fda-issues-request-information-high-protein-yogurt), 2025-01-14|PASS|2026-11-09|
|[/383](https://nhunnhun.tistory.com/383)|비타민 C는 비헴철 흡수에 도움을 줌. 모든 사람이 비타민 C 보충제를 의무적으로 복용해야 한다는 뜻이 아님|[NIH ODS Iron](https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/), 업데이트 2025-09-04|PASS|2027-10-10|
|[/64](https://nhunnhun.tistory.com/64)|고용량 오메가3 장기 시험에서 심혈관질환 또는 고위험군의 심방세동 위험 증가가 관찰됨|[NIH ODS Omega3](https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/), 이번 열람의 업데이트 날짜 미확인|PASS|2026-11-09|
|[/379](https://nhunnhun.tistory.com/379)|2일 이내 사용할 생해산물은 4℃ 이하 냉장, 늦게 사용할 경우 냉동. 고위험군은 날것·덜 익힌 해산물 회피|[FDA 해산물](https://www.fda.gov/food/buy-store-serve-safe-food/selecting-and-serving-fresh-and-frozen-seafood-safely), 개별 게시일 미확인|PASS|2026-11-09|
|[/384](https://nhunnhun.tistory.com/384)|CDC는 싱그릭스를 다른 백신과 동시에 접종할 수 있다고 설명|[CDC 접종](https://www.cdc.gov/shingles/vaccines/index.html), 페이지 표시일 2025-08-19|PASS|2026-11-09|
|[/390](https://nhunnhun.tistory.com/390)|작은 편도결석은 흔하고 대개 경과 관찰. 구취에 양치·소금물 가글, 큰 결석의 수술은 드묾|[AAFP 원문](https://www.aafp.org/afp/2023/0100/tonsillitis-tonsilloliths), 2023년 1월호|PASS|2026-11-09|

## 실제 접근과 조건

공식·원문 자료 9개를 실제 읽었다. 철분 원문은 서로 다른 두 글의 명제에 연결했다. USDA FSIS는 웹 조회 도구에서 403이었지만 정상적인 공개 HTTP 요청에서는 200으로 본문을 읽었다. 보안 challenge 우회·인증정보 사용은 없었다. 본문에서 안전 해동 세 경로를 실제 확인했으며 HTTP 200만으로 PASS를 판정하지 않았다.

밤의 별도 USDA Climate Hub PDF는 웹 조회 실패, 정상 HTTP에서 PDF 200까지 확인했으나 PDF 내용을 읽지 않았다. **이 PDF의 내용 지지와 날짜는 확인 불가**로 남긴다. 파일명 December2025를 공식 발행일이라고 확정하지 않는다. 밤의 생것·구운것 영양 수치는 이번에 검증하지 않았다.

CDC 동시접종 확인은 국내 18세 이상 면역저하자 허가조건 검증이 아니다. 미국 CDC는 면역저하자 19세 이상으로 안내하므로 국내 허가조건과 혼합하지 않았다. `/384`의 국내 허가·무료지원·항바이러스 시작 시간은 이번 범위 밖이다.

`/64`의 일부 고위험군·4g/일·여러 해 시험 결과를 모든 사람 또는 모든 용량의 위험으로 확대하지 않는다. 해당 원고의 2026 메타분석 상대위험·절대위험 수치는 이번 ODS 명제 확인과 별개로 미검토를 유지한다. `/365`의 FDA 문서는 정보 요청이지 새 그릭요거트 영양 규격 확정 문서가 아니다.

## 결과와 잔여

선택 명제: **10 PASS / 0 FAIL / 0 확인 불가**. 별도 밤 PDF 접근·내용 대조: **확인 불가 1**. 새 확정 본문 오류나 게시용 수정 후보는 이번 범위에서 발견되지 않았다.

명제별 확인일은 실제 읽은 2026-10-10이고, 안전·규정·지침 명제 30일과 영양소 생리 역할 365일을 적용했다. 개별 자료 게시일·업데이트일·조회일·우리 재검토일은 구분한다. 게시일 미확인은 null이다. 월 단위 자료에는 임의 일자를 붙이지 않는다.

전체 본문·전체 근거·이미지 재감수가 끝난 것은 아니므로 10건 모두 `wholeSourceCheckedAt=null`, `wholeNextReviewAt=null` 유지. active 미검토 141건을 이번 부분 검토만으로 감소시키지 않는다. 기존 지침이나 전체 감수 게이트 변경 없음. 코드·게시·원격 변경 없음. 비공개 원장에 현재 원고 digest·검토 데이터 hash와 연결 범위를 보존했다.
