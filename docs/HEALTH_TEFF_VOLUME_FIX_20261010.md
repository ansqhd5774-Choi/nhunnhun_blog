# /411 테프 조리 부피비 최소 교정

- 후보: `updates/direct-411-teff-volume-fix-20261010.json`
- 원천: 최신 origin/main `posts/direct-teff-nutrition-gluten-20261010.json`, SP1 유지.
- 기존 제목·URL·카테고리·대표이미지·imageReview·본문 전체 구조 보존.
- 변경 3곳: 조리 설명에서 동일 계량컵 명시, 표의 `40g + 물120mL`를 `알곡1컵 + 물3컵`으로 교정, FAQ의 `30~40g에 물3배`를 동일 부피비로 교정.
- 근거: CSU와 WGC는 cup:cup 1:3을 안내한다. 질량 g과 물 부피 mL를 직접 1:3으로 환산할 근거가 없다.
- 검증: 지정 `validate-update` PASS(기존 SP1이므로 일반 콘텐츠 validator SKIPPED 명시), 별도 `assertImageReview` PASS, 기존/수정 렌더 strong·mark·u·img 개수 동일, 제목·대표이미지·imageReview deep equality PASS, git diff --check PASS.
- R4 semantic-source 강조 equality는 SP1 자동 강조 출력과 계약이 달라 적용하지 않는다. 처음 적용 시 실패했으며, 기존/수정 SP1 렌더 비교로 보존 여부를 검증했다.
- 원격 커밋·제출·공개 검증 미실행. parent가 최신 공개 상태와 표준 수정 실행을 최종 취합한다.
