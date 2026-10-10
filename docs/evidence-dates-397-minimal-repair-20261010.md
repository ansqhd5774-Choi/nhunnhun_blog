# 확정 안전 문장 최소 교정 — 독감 /397

2026-10-10 CDC 공식 flu/takingcare 실제본문과 부모의 실제 Chrome 공개 /397 확인을 대조했다. 공개6절·시나리오C·FAQ·핵심정리에 무열 의심/확진독감의 증상시작후 최소5일 직장재택 조건이 누락됐다. /387은 해당조건이 이미 있어 수정대상이 아니다.

최소 교정 후보는6절,시나리오C,FAQ,핵심요약,최신근거 요약에 미국 CDC 특이조건을 추가한다. 국내일률5일 규정으로 바꾸지 않고 기관규정·의료진판단을 별도로 표시한다. 기존 제목·사진·구조·무관 강조는 보존한다.

- private update-397-candidate.json / review-397-candidate.json
- 재현 scripts/evidence-dates-prepare-397.mjs
- 기존유효이미지검토 재사용. CDC새문구 실제확인일2026-10-10만 갱신, 다른출처과거검토일은 보존.
- strict update/image schema PASS.
- **CONTENT CONTRACT FAIL**: 현행R1 강조밀도 기준은 기존14섹션에 추가강조를 요구한다. 최소안전교정과 무관한 전면강조보완은 부모지시에 따라 실행하지 않았다. 검토서digest는 변경본문기준이나 최종approved로 사용해서는 안 된다.
- published-product-link-repair는 legacy의 정해진 health.kr제품주소교체만 허용하므로 본R1글에 적용불가. alt-maintenance는이미지alt전용이라불가.
- SP1은 ollama-user-policy validation SKIPPED이며 정상검토통과가 아니므로 사용하지 않았다.
- 원격제출없음. 게시가능후보로 보고하지 않는다. 부모가 최소교정의 정상경로를 결정한다.

원문: https://www.cdc.gov/flu/takingcare/index.html

## 최종 검증 갱신

부모가 정상R1에 필요한 기존문장강조 보완을 승인했다. 새내용은 무열독감조건만 추가했고 기존문장 의미는 보존하며 읽을시점·증상·복귀행동 강조를 보완했다. 중복decision모듈은 추가하지 않고 기존유효모듈을 유지했다. 변경구역은1~15절중12절을제외한14절, 최신근거요약, FAQ, 핵심정리이며 도입핵심에도무열조건을추가했다.
최종 strict update/image/evaluateContent density=true PASS. 정식CLI checked1 failed0. 앞의CONTENT CONTRACT FAIL은 보완전 진단이며 최종후보는 정상계약PASS다. SP1·maintenance예외미사용. 기존이미지/원문유효검토재사용, 새CDC조건을직접대조했고 독립의료인감수는아님. 원격미실행.
