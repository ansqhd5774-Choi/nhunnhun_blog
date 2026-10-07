# 공통 Producer 선택 조건 분리

요청: 네 분야에서 공용으로 작성하되 불필요한 확장 요구로 작업을 차단하지 않도록 수정.

변경:
- 알려진 주제 프로필의 확장 강제를 추천으로 변경. 명시적 적용/제외 이유와 포함된 모듈의 답변·출처 검사는 유지.
- 초안의 비교·추가 행동을 선택으로 변경. 확인되지 않은 수치·효과는 확인 자료의 한계를 설명하도록 지시하며 필수 의료 안전정보 부재의 우회는 금지.
- 대표 이미지/도입문/핵심 요약의 기존 R4 계약 준수와 의료 안전 배지 지원. HTML/이미지/source/렌더 검사를 AI 검토 전에 실행.

검증:
- bundled Node v24.19.0: package.json test 대상 194/194 PASS.
- authoring/ollama/keyword 추가 테스트 18/18 PASS.
- 구조화 초안 선택 필드·1회 보완 후 필수 누락 차단 테스트 추가 후 Queue 23/23 PASS.
- validate-update: 39개 PASS. validate-content --all: R1 3개 PASS, 실패 0.
- validate.mjs: 로컬 GitHub repository/token 실행 문맥 부재로 E_GITHUB_CONFIGURATION. 신규 발행 운영 검사는 미완료.
- pnpm 스크립트는 로컬 PATH의 Node 호환 오류로 실행 불가; 동일 검사 진입점을 bundled Node로 실행.

UI 변경 없음. 발행/수정 러너·CMD·mutex·원장·기존 글은 변경하지 않음.
실제 Ollama 원고 생성, 티스토리 저장, 공개 Runtime/PC·모바일 검증은 미실행. Queue 차단 기록은 보존.
남은 한계: AI 자체 검토와 주제 단어 검색은 의학적 의미 일치를 독립적으로 증명하지 않음.
복구: 변경 commit의 코드·정책만 revert하고 기존 글과 원장은 수정하지 않음.
