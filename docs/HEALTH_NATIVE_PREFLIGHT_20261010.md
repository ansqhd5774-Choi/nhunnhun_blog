# 성분명 교정 3건 읽기 전용 사전 대조 후보

기준: 루트 PR159 source `78ccc90`. 별도 작업 트리 `health-native-text-preflight-20261010`. 원격 변경·workflow dispatch·실제 편집기 실행 없음.

새 workflow를 만들 필요는 없다. 기존 `observe-alt-maintenance.yml`의 `scope` 선택을 `alt-six`(기존 기본값) / `native-identity3`로 확장하고 기존 snapshot CLI를 그대로 사용한다. 권한은 contents:read, 기존 전용 Windows 러너 및 mutation concurrency 잠금을 유지한다.

## 범위

- 후보 경로는 `docs/candidates/repair-native-identity-{236,233,200}-20261010.json`으로 고정된다. draft/approved:false만 읽는다. 원고를 ready로 저장하거나 새 조건 원고를 생성하지 않는다.
- 기존 공식 read-only observer로 대상 편집기 열기, 발행창 메타 읽기, 취소, HTML 모드 실제 CodeMirror 읽기, 기본 모드 복귀 및 메타 불변 검사를 재사용한다. 키 입력·본문 삽입·제목 변경·최종 제출 없음.
- 실제 HTML mode 원문 전체 hash, 메타 hash, 기존 전체 텍스트 hash, 익명 공개 PC/모바일 이미지 자산 대응 및 예상 target DOM 조건을 대조한다. 적용은 메모리 문자열에서 exact diff 증명만 한다.
- 안전 출력은 articleId/sourceId, PASS/FAIL, stage, 안전 오류 코드 및 각 대조 단계 상태뿐이다. raw HTML, signed URL, 메타 본문, 예상 target HTML을 stdout/Git/artifact에 저장하지 않는다. 원본이나 예상 target preview를 추가 수집·저장하지 않는다.
- native scope artifact는 `safe-results.json`만 업로드한다. 기존 alt scope의 암호화 artifact 동작은 그대로다.

## 검증

프로젝트 등록 테스트 **455 PASS**(기존446 + 신규9), 전체 `tests/*.test.mjs` **504 PASS**. mutation 환경 거부, 다른 branch/scope 거부, 실제 모드 body drift, 메타 drift, draft 외 source 거부, 공개 asset mismatch, 오류 문자열 비밀 redaction, source 불변 및 입력/제출 API 부재 회귀 포함.

실제 런너 실행은 미실행이다. /200의 사용자 브라우저 HTML 모드 관측 timeout은 그대로 기록하며 exact hash 조건을 완화하지 않는다. 이 preflight의 FAIL은 해당 교정 후보의 실행 준비 대조 실패이지 기존 공개 블로그 자체의 기능 실패 판정이 아니다.

## 변경 파일

- `publishing/native-text-preflight.mjs` 신규.
- 기존 `publishing/alt-maintenance-snapshot.mjs` CLI scope 분기.
- 기존 `.github/workflows/observe-alt-maintenance.yml` scope 및 안전 artifact 분기.
- `tests/native-text-preflight.test.mjs` 신규, `package.json` 테스트 등록.

루트 검토 후 기존 workflow를 native-identity3로 실행하는 단계가 남았다. 이 후보는 제출 승인이나 자동 재원고 작성 gate가 아니다.
