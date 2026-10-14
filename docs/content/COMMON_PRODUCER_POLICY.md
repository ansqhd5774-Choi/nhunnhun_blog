# 공통 Producer 적용 정책

## 영양소 direct/SP1 예외

영양소 direct/SP1은 이 문서의 Queue 작성·검토 정책을 사용하지 않는다.

- 영양소 내용·소제목·문체·정보 배치는 `ansqhd5774-Choi/nhunnhun_nutrients` 최신 main의 `PROJECT_INSTRUCTIONS.txt`만 따른다.
- 이 저장소의 legacy Queue/Ollama writer/research/review 경로는 영양소 direct/SP1 원고를 작성하지 않는다.
- 영양소 legacy single-pass writer 호출은 `E_NUTRIENT_DIRECT_EDITORIAL_EXTERNAL`로 중단한다.
- `nhunnhun_blog`는 영양소에 대해 source 무결성·구조·이미지·강조 태그·제출·공개검증·원장만 담당한다.
- 상세 경계는 `docs/NUTRIENT_DIRECT_EDITORIAL_BOUNDARY_R10.md`를 따른다.

## Legacy 공통 Producer

기존 비-direct R1 및 보존된 legacy 경로의 음식·약·질병에는 기존 공통 Producer 계약을 유지한다. 주제 전용 러너를 추가하지 않는다.

- 공통 필수: 주제와 실제 대상 일치, 안전정보, 기존 R1/R4 HTML·이미지·검토 계약, source SHA·mutex·원장·중복 제출 방지.
- 분야 core: 해당 분야의 기본 질문을 실제로 답한다. 확인하지 않은 수치·효과를 만들지 않는다. 허가사항·필수 의료 안전정보를 확인하지 못한 경우에는 제출하지 않는다.
- 확장: 프로필은 검토 후보이며 강제가 아니다. 현재 독자 질문에 따라 applies/reason을 결정한다. 제외된 확장은 필수 모듈을 늘리지 않는다.
- 일반 자료: 적용되는 일반 생활 안내로 사용할 수 있으나 개별 식품의 치료·예방·권장량으로 임의 확대하지 않는다.
- 문체: 섹션별 비교·추가 행동은 선택이다. 형식을 채우기 위한 주장·반복을 만들지 않는다.
- 조기 검사: 조립 직후 HTML/이미지/source/렌더 계약을 검사하고 assembled 기록을 남긴다.

Ollama 기반 legacy 작성은 현재 direct 영양소 작성 경로가 아니다. 코드 PASS는 기술 계약 검사이며 공개 콘텐츠 품질 자체의 인증이 아니다.
