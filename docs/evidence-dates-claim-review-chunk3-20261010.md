# 약학 원문 대조 3차 /275

확인일2026-10-10. 원고 origin/main `b763abcf440aeb5e4c84eba68e3cd85c4c2865a9`의 `updates/update-275-roxithromycin-safety-20261004.json`. 공개 /275는 웹도구에서 조회되지 않았으나 공개 HTTP 응답을 실제 읽어 병용 및 설사 FAQ가 원고와 같음을 확인했다. 이는 로그인 브라우저 조작이나 단순HTTP200 판정이 아니다.

|대조 주장|판정|범위|
|---|---|---|
|록시마이신정 성분150mg, 처방 마크로라이드 항생제|PASS|MFDS199700945 제품 기본정보|
|성인150mg 하루2회 식전, 폐렴300mg 하루1회|PASS|동일제품 용법. 임의 처방변경 근거 아님|
|바이러스 감염 직접치료 아님|PASS|Australian Commission APX CMI|
|와파린·테오필린·디곡신·미다졸람 등 상호작용|PASS|MFDS 상세허가 및 CMI. 서로 동일한 금기조건은 아님|
|호주 CMI 음식15분전/식후3시간 공복|PASS|같은 CMI. 국내제품 처방지시를 우선|
|WHO2026-07-16 및2023 실험실확인 감염 약6분의1 내성|PASS|WHO 실제 원문|
|2024 문헌 록시트로마이신+알루미늄마그네슘 제산제 AUC 유의차 없음|PASS|Europe PMC 실제 XML Table3,1연구10명. 모든칼슘/모든안전 보장이 아님|
|에르고트 약물 등을 상담·알림만으로 설명|FAIL|국내 록시마이신정은 특정병용약 투여하지말것. 금기를 일반상담과 구분해야 함|
|중증·지속·출혈설사 FAQ의 임의중단보다상담 안내|FAIL|국내 허가상 위막성대장염 의심은 즉시 중지·평가. 계속복용하며 대기하도록 해석될 수 있음|
|중증 물집·점막손상 피부반응 경고 누락|FAIL|국내 허가 첫 경고. 일반발진 안내와 구분 필요|
|2024 제산제 연구의 최고농도 수치/유의차|UNKNOWN|직접 읽은 Table3은 AUC만 표시. 기존 Cmax까지 확대 문장은 별도 원시험 대조 필요|

[MFDS 국내허가](https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=199700945)의 금기는 마크로라이드과민반응과 테르페나딘·아스테미졸·시사프리드·피모짓·에르고타민·디히드로에르고타민·미졸라스틴 병용이다. 간장애는 신중투여이며, 호주 APX의 severe liver 금기를 국내 동일제품 금기로 옮기지 않는다. 국내저장 밀폐용기·실온보관, 어린이접근 방지·용기변경 주의도 실제 읽었다. cache일자를 임상개정일로 기록하지 않는다.

[Australian Commission CMI](https://www.safetyandquality.gov.au/medicine-finder/apx-roxithromycin-tablets), [WHO](https://www.who.int/news-room/fact-sheets/detail/antimicrobial-resistance) 및 [2024 원문](https://pmc.ncbi.nlm.nih.gov/articles/PMC11531826/)을 대조했다. PMC 화면 challenge는 EBI의 [동일 원문 XML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11531826/fullTextXML) 공식경로로 대체했다. 실제발행일2024-09-10, 검색종료2022-12, 오래되고 상이한 시험의 제한을 함께 확인했다.

**PASS7 / FAIL3 / 확인불가1.** 최소 안전수정 draft proposal과 pending검토를 private evidence-dates-batch에 준비했다. R1승인·정식CLI PASS로 보고하지 않는다. 기존사진3장 imageReview/visual검토가 없으며 전체R1 검토서가 추가로 필요하다. 개인처방약 임의중단 지시 대신 공식 긴급증상 경고와 단순 호전에 따른 임의중단을 구분했다. 원격commit·공개제출 없음. 안전/허가 다음검토 목표2026-11-09. 일괄145미확인 전체를 오늘 확인완료로 바꾸지 않았다.
