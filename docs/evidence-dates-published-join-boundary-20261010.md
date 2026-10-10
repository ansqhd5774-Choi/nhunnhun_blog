# /381·/405 공개 수정후 전체 검토 연결

새 `scripts/evidence-dates-join-published-review.mjs`는 두 준비 검토 JSON을 기존 비공개 운영 overlay에 연결하는 함수와 CLI이다. 현재 실 원장 적용은 실행하지 않았다. 메인에서 진행 중인 공개 수정 Run의 성공을 이 구현이나 fixture PASS로 대신하지 않는다.

기존 historical sourceId·sourceFile·공개 URL·null 확인일을 정확히 대조한다. 최종 active update source의 정확 bytes SHA256·id·articleId·targetUrl이 준비 검토와 같아야 한다. 실제 update ledger의 `phase=updated`, `publicResult.status=PUBLIC_VERIFIED`, 양쪽 URL·sourceId·sourceCommit·runUrl·checkedAt 및 `updateFingerprint` 일치를 함께 요구한다. 준비·실패·submitting 원장으로는 연결할 수 없다. 이것은 날짜 원장 연결용 확인이며 새 발행 게이트가 아니다.

역사적 null·확인불가와 과거 metadata discrepancy는 보존하고 별도 supersession mapping만 추가한다. 기존 /398 mapping과 idempotency는 보존한다. 다른 원고의 날짜는 채우지 않는다. 최초 145 미확인 기록은 immutable이며 두 건 모두 실제 성공한 뒤만 현재 actionable140에서138로 줄일 수 있다. 한 건 실패하면 CLI는 출력 파일을 쓰지 않는다. 실제 전체 검토일2026-10-10, 기존 안전정보30일 목표에 따른 재검토일2026-11-09는 배포시간과 구분한다.

사용법: `node scripts/evidence-dates-join-published-review.mjs <private historical register> <private prior overlay> docs/evidence-dates-381-405-prepared-whole-review-20261010.json <private output overlay> origin/main`. 먼저 최신 원격 원장 반영을 확인해야 한다. 실제 파일은 비공개 evidence에 유지하며 저장소에 원자료를 추가하지 않는다.

검증: portable synthetic fixture에서 exact 성공, 입력 역사·기존 /398 보존, 반복 동일성 PASS. source bytes drift·prepared/failed/submitting·공개 mismatch·URL/sourceId·fingerprint·sourceCommit·checkedAt 누락·UNKNOWN/주장검토 미완료 거부 PASS. 기존398 join fixture도 그대로 PASS. 이 검사는 Production 검증이 아니다.
