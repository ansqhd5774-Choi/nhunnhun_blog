# 근본 원인 조치 및 검증 — 2026-10-12

기준 main b593f17fff1f205bf990f3dccbbaf7b03c01c12d. 카테고리 수의 문제가 아니라 작성 준비·제출 검사 분리, 선택적 이미지 기록 거부, 기본 concurrency pending 교체가 확인된 문제다.

실제 실패:
- 로즈힙38169667183: E_IMAGE_REVIEW_SCHEMA, 제출 전 차단. 최근 시각 필수 게이트 제거와 원고/테스트의 필드가 불일치했다.
- 루테올린38169545982: E_DIRECT_EMPHASIS_LIMITATION, 제출 전 차단. 통합 검사에서는 E_DIRECT_FOCUS_RESEARCH_OVERLOAD 및 E_IMAGE_REVIEW_ATTRIBUTION도 확인했다. 원고 자체는 이번 범위에서 수정하지 않았다.
- 레티놀·루테인의 외부 GitHub write 거절 원문은 확보되지 않았다. 일반 Chat의 보고를 실제 거절 사유로 확대하지 않는다.

적용:
- 단일 코드 계약·공통 preflight를 작성 준비, 전달, 표준 러너, 실제 제출에 연결했다.
- visualChecked는 선택적 boolean 관찰 기록으로 호환한다. 필수 게이트 복원·자동 true 기록은 없다. 이미지 원출처·라이선스·대표/alt·출처 연결 검사는 유지했다.
- 완성 원고 전체 JSON 및 digest·검사/저장 상태를 자동 발행 경로 밖에 보존하는 운영자 선택 도구와 일반 Chat 인계 계약을 추가했다.
- 실제 commit에 고정한 파일 조회+내용 digest 일치 Gate 0를 전달 및 표준 준비에 연결했다. HTTP200·원고 작성만으로 저장/발행 성공을 선언하지 않는다.
- 공통 mutation 및 전달/수정 대기열에 queue:max를 적용했다. 동일 그룹 pending 교체를 막으며 지원 한도100개와 source drift·원장·중복 보호를 유지한다.

검증:
- 전체 회귀497 PASS, 실제 변경 범위 git diff --check PASS.
- 실제 GitHub 읽기 전용 confirmGithubSource: direct-154-rosehip-20261012, commit b593f17fff1f205bf990f3dccbbaf7b03c01c12d, GITHUB_SOURCE_CONFIRMED, digest c6c81043a59479b596fcf8dada60deeca40baba7b13174b95340beb0d5b7da41.
- 로즈힙 로컬 공통 preflight PASS. 루테올린 로컬 공통 preflight FAIL3개 수집. 사실·장식·원고 승인 상태 자동 변경 없음.
- 네 카테고리 동일 검사, 모든 오류 수집, 임의 이미지 키/자료 변조 거부, 전체 원고 인계, Gate0 부재/조회제약/불일치, 모든 공유 그룹의 pending 보존 회귀 확인.

구현/회귀 및 실제 GitHub 읽기 전용 확인은 완료다. 새 코드를 사용한 실제 Tistory 제출·공개 검증과 35건 대기열 부하 검사는 미실행이다. 프로젝트 지침 R6.4는7944자 전체본을 사용자 작업 폴더에 준비했으며 ChatGPT 프로젝트 설정에 직접 반영하지 않았다. 외부 보안 검사를 제거하거나 앞으로 모든 원고가 오류 없이 통과한다고 보장하지 않는다.
