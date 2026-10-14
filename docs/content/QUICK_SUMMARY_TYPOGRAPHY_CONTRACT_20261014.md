# direct/SP1 핵심 요약 카드 타이포그래피 계약

개정일: 2026-10-14

- 공통 `publishing/direct-design.mjs`가 `핵심만 먼저` 블록을 6카드 `quick-summary`로 렌더링한다.
- 카드 답변 본문 `.quick-summary-item p`는 PC·모바일 공통 `font-weight:600`을 사용한다.
- 제목·라벨은 기존 더 강한 굵기를 유지한다.
- 이 굵기는 **표시 규칙**이며 source의 의미 강조 태그를 추가하는 규칙이 아니다. 카드 전체를 `<strong>`이나 `<mark>`로 감싸 강조 수를 부풀리지 않는다.
- 영양소 의미 강조 하한 `strong25 / mark14 / mark>u>strong8`과 카드 표시 굵기는 서로 독립적으로 유지한다.
- `tests/public-verification.test.mjs`가 6카드 구조, PC 2열·모바일 1열, 답변 `font-weight:600`을 회귀 보호한다.
