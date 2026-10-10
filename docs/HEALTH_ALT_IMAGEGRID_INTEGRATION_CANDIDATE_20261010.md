# ImageGrid alt 통합 후보 검증

기준: ce7b338 (PR155 병합본). 기존 filename 추출 및 provider-filename fallback 보호를 보존했다.

변경: alt-maintenance-runner.mjs의 macro apply import를 새 applyMappedImageGridAlt alias로 연결하고, alt-maintenance-public.mjs의 macro parser import를 새 parseImageGridMacros alias로 연결했다. 다른 runtime 로직은 변경하지 않았다. 새 alt-image-grid-contract.mjs와 계약 검사, 통합 검사만 추가했다.

검증: Node --test 신규 통합5 + 신규 계약8 + 기존 계약/매크로/스냅샷/워크플로41 = 54 PASS, 0 FAIL.

통합 검사는 실제 captureAltBaseline 함수 경로의 PC1440/mobile390 네 번의 익명 관찰 흐름, Grid immutable asset proof, provider filename fallback, asset reorder 거부를 합성 browser fixture로 검사한다. 실제 runAltMaintenance 경로의 정확한 alt staging, body hash precondition 거부, staged body drift 거부, durable checkpoint 이후 정확히 한 번의 최종 클릭을 합성 editor fixture로 검사한다.

이는 fixture 통합 검사다. 실제 브라우저 DOM, 현재 공개글 baseline, 실제 원장 쓰기, 발행 또는 수정 runtime 성공을 뜻하지 않는다. 실제 원고 후보 생성, 외부 dispatch, commit/push/게시를 실행하지 않았다.

통합 후보 작업 트리: health-alt-grid-integration-20261010. 원래 strict 모듈 작업 트리와 root 작업 트리는 보존했다. package.json 명시적 test 목록 연결은 root 통합 시 필요하다.
