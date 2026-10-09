# 일반 Chat 작성·러너 실행 계약

일반 Chat과 Codex 모두 이 역할 분리를 따른다. 기존 문서의 작성자 로컬 명령·브라우저·미리보기 의무, 사용자 공개 확인 의무, 과거 실행 경로와 충돌하면 이 문서가 우선한다. 콘텐츠 의미·강조 기준은 DIRECT_AUTHORING_R1 또는 해당 R1 기준을 유지한다.

## 작성자

연결된 자료 도구로 조사하고 원고·강조·내부링크·이미지 근거를 함께 준비한다. GitHub 저장과 결과 읽기 기능은 현재 연결에서 확인한다. 원고 저장은 발행 성공이 아니다. 일반 Chat에 사용자 PC의 Node, CMD, gh, Chrome, GUI, 로컬 HTML 파일 열기를 요구하지 않는다. 필요한 연결 기능이 없으면 해당 단계의 접근 제약을 보고하며 발행 실패로 단정하지 않는다.

사진은 유효한 시각 검토 기록을 재사용한다. 새 사진을 관찰하지 못했으면 시각 검토 완료로 표시하지 않는다. 러너의 태그 검사는 글의 의료적 의미나 사진의 내용을 검토한 결과가 아니다.

## 제출과 실행

- 기존 수정: 완성된 승인 원고를 updates/direct-*.json의 main에 저장하면 direct-author-update가 기존 update-posts로 전달한다. 자동 실행이 있으면 그 실행을 관찰한다. 수동 실행을 겹쳐 호출하지 않는다.
- 신규: posts/*.json의 승인 원고는 기존 publish-posts 경로를 사용한다. start-direct-publish CLI는 기존 수정 운영자용이며 신규 공통 진입점이 아니다.
- 초안은 자동 발행 대상에 ready/approved로 저장하지 않는다. updates는 draft 계약을 지원하지 않으므로 초안은 별도 작업 경로/브랜치에 보존한다.
- prepare-selected-source를 기존 러너 단계에서 실행해 보안·렌더 준비·강조 현황을 확인한다. 작성자는 출력된 문구를 실제 의미 검토 증거로 과장하지 않는다. 로컬 prepare 실행은 선택적인 운영자 보조 도구다.

## 결과 확인

러너가 실행·제출·공개 검증을 담당한다. 일반 Chat은 GitHub 실행 로그 및 publishing/state 또는 publishing/update-state의 해당 source 기록을 읽는다. 기존 수정은 publicResult에 source ID, fingerprint, sourceCommit, runUrl, checkedAt, status, 검증 항목을 기록한다. 원장 경로는 발행 trigger 대상이 아니므로 결과 기록이 새 원고 발행을 시작하지 않는다.

- PUBLIC_VERIFIED: 해당 원고 제목·전체 본문·이미지·대표 이미지·direct 강조·PC/모바일 확인 완료, updated 전환.
- PUBLIC_VERIFICATION_UNAVAILABLE: 조회/자산 접근 불가. submitting 보존, 재제출 없음.
- PUBLIC_VERIFICATION_MISMATCH: 실제 비교 불일치. submitting 보존, 저장 실패 단정·재제출 없음.
- Actions 실패와 위 상태를 함께 읽는다. SUBMIT_CLICKED는 제출 클릭 증거이고 공개 반영 완료가 아니다.

기존 submitting 공개 재확인은 update-posts에서 update=false와 기존 source_id로 수행한다. 편집기 접근·mutation 없이 원격 원고 및 원장과 익명 공개 결과를 대조한다. 결과가 불명확하면 중복 수정하지 않는다. public_verify_article_ids는 과거 호환 입력이며 현재 source_id를 사용한다.

최초 러너 등록·로그인·PC/Chrome 유지와 스킨 원본 백업·관리자 조작은 운영자 작업이다. 이를 매 글 일반 Chat의 완료 조건으로 요구하지 않는다. 승인·URL 보호·HTML 보안·source drift·인증·중복 제출 방지는 유지한다. 결과 기록이나 연결 권한 없이 완료라고 보고하지 않는다.
