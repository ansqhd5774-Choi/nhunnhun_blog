# 남은 3개 글 R1 교정 후보

최신 origin/main `9b3fabe6d5bdb8d21ee4b95c329a1f6e574cae11` 확인. 콘텐츠 계약·렌더·이미지 모듈은 실행에 사용한 로컬 코드와 diff 없음. /365·/129·/256을 새로 HTTP 조회해 현재 공개 제목이 expectedCurrentTitle과 같음을 확인했다.

## 준비 원고와 근거

- /365: `updates/update-365-greek-yogurt-quality-20261010.json`. 그릭요거트 단백질·영양｜다이어트·혈당·고르는 법. FDA 고단백 요거트의 제조·성분 정보, NIH 칼슘·프로바이오틱스, 실제 2013 요거트 교차시험, FDA 첨가당·알레르기·냉장 안내로 정리. 제품 공통 열량을 생성하지 않았다. 포만감 시험의 차이 없음 결과를 체중 감량 보장으로 옮기지 않았다.
- /129: `updates/update-129-watermelon-quality-20261010.json`. 수박(Watermelon) 영양·먹는 법｜분량·고르는 법·보관. FDA 가식부 280g·2컵: 80kcal·탄수화물21g·당류20g·섬유1g을 원문에서 확인. 공식 하루 권장량으로 표현하지 않았다. 품종별 정확한 수치로 확대하지 않았다. FDA 농산물 세척·자른 수박 냉장 진열과 보관 안내 반영.
- /256: `updates/update-256-beef-jerky-quality-20261010.json`. 육포(Beef Jerky) 단백질·영양｜섭취량·표시·보관법. 실제 EU Original 제품 제조사 표시 100g 기준 단백질35g·253kcal·당류18g·소금5.0g 확인. 소금g와 나트륨mg 구별. 보충제 대체·운동 후 회복 비교 삭제. USDA FSIS의 가정 제조 안전 가열 조건은 완성 시판품 재가열 지침과 구분했다.

각 대응 `content-reviews/updates/<같은 id>.json`에 분류·9핵심 모듈·원문·검토 범위를 기록했다. 실제 의학 감수는 AI 동일 작성자 검토이며 독립적 감수가 아니다.

## 사진

Commons 공식 API에서 각 사진의 작가·라이선스를 읽고 9개 이미지 전체를 직접 시각 확인했다. 본문 하단에 개별 파일·작가·라이선스를 연결했다. /365는 기존 요거트 사진을 같은 원문으로 재확인했다. 사진이 특정 제조사의 영양값이나 안전 공정을 입증한다고 표현하지 않았다.

육포: Aomorikuma(CC BY-SA3.0), Stefano A.(CC BY2.0), Kusie(CC BY-SA3.0).
수박: B SAYnT(CC BY-SA4.0), Caroline Ford(CC BY-SA3.0), USDA Scott Bauer(Public Domain).
요거트: ProjectManhattan(CC BY-SA3.0), Takeaway(CC BY-SA4.0), Jumbocombo0811(CC BY-SA4.0).

## 검사와 제한

3건 콘텐츠 계약 PASS. /365·/256 경고0. /129 품종·제철·비교·다이어트 확장 생략 경고4는 실제 범위를 검토해 이유를 명시했다. 검사 기대값을 삭제·완화하지 않았다. 3건 이미지 검토·R1 렌더 강조 계약 PASS. diff-check PASS.

MyPlate·FAGE 조회는 TLS 인증 실패로 본문 원문 확인을 못해 근거로 사용하지 않았다. TLS 검증을 우회하지 않고 다른 공식 자료로 전환했다.

현재 상태는 준비·로컬 검증 완료다. 원격 저장·제출·공개 검증·원장 변경은 미실행. 재현 스크립트 `scripts/content-quality-write-three-foods.mjs`는 로컬의 공개 사진 검토 metadata를 사용하므로 이 스크립트만으로 새 조사 완료를 주장하지 않는다.
