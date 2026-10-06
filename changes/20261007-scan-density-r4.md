# 2026-10-07 — Editorial R4 Scan Density 보강

## 요청
긴 건강 글에서 강조가 너무 적어 모든 문장을 정독해야 하는 문제를 줄인다. 독자가 굵은 글씨와 형광펜을 따라가며 소제목별 결론·조건·행동을 빠르게 찾을 수 있게 한다.

## 변경
- 일반 H2 본문 120~249자: 최소 2개 시각 앵커.
- 250~399자: 최소 3개.
- 400자 이상: 최소 4개.
- 각 일반 섹션은 굵게 계열과 형광펜 계열을 함께 포함한다.
- 의미형 danger/caution/tip/check/care 배지는 강한 시각 구조라 3개 앵커로 계산하고 두 역할을 대신할 수 있다.
- 핵심 정리·관련글·자료 출처·FAQ 보조 섹션은 최소량 검사에서 제외한다.
- 기존 형광펜 15% 상한 경고, 80자 제한, 중첩 금지, 의미별 색상은 유지한다.
- 새 글·새 수정·실제 mutation에서는 hard gate. 이미 공개 완료된 R1 source의 전체 감사에는 소급 적용하지 않는다. 다음 수정부터 적용한다.

## 호환성
렌더링 HTML·색상·기존 공개 글을 변경하지 않는다. 기존 R3/R4 source·ledger·공개 글을 자동 수정하지 않는다. `validate:content --all` 및 archival `validate:update`는 새 최소량을 소급 강제하지 않으며, `--changed`, `--check`, publish/update runtime은 새 기준을 강제한다.

## 오류
`E_CONTENT_SCAN_EMPHASIS`는 H2별 실제 글자 수, 현재 anchor/strongLike/highlightLike, 필요한 최소값을 JSON detail로 출력한다.
