# 공통 작성·저장·제출 계약 — 2026-10-12

적용: 네 카테고리의 신규 및 전체 수정 `direct-* / SP1`. 미변경 legacy·읽기 전용 공개 복구에는 새 제출 기준을 소급 적용하지 않는다. 카테고리별 내용만 바꾸며 디자인·러너를 분리하지 않는다.

## 단일 규격과 검사

`publishing/direct-authoring-contract.mjs`가 이미지 허용 키·최소 수·강조 최소 수·핵심 H2 상한을 제공한다. `publishing/direct-preflight.mjs`가 기존 이미지·강조·본문 집중 검사를 함께 호출한다. 작성 준비, 표준 러너 준비, 전달, 실제 신규·수정 제출 경계가 같은 검사를 사용한다.

- 이미지: 최소3개, 대표 이미지·본문 순서/alt 일치, 원출처·저작자·라이선스·출처 링크·중복 검사 유지.
- 허용 키: src, alt, role, composition, sourcePage, author, license, visualChecked.
- visualChecked는 **선택적 boolean 관찰 기록**이다. 누락/false 때문에 제출을 막지 않는다. true를 자동 생성하거나 사진 내용 확인으로 위장하지 않는다. 문자열이나 임의 키는 거부한다. 최근 사용자가 제거한 시각 확인 필수 게이트를 복원하지 않는다.
- visualChecked는 **현재 source/revision에서 실제 이미지 원본을 열어 확인한 관찰값**이다. 기존 원고·archive·같은 주제 글에서 이미지를 재사용할 때 `src`, `alt`, `role`, `composition`, `sourcePage`, `author`, `license` 같은 자산·귀속 메타데이터만 재사용하고 `visualChecked`는 승계하지 않는다. 새 source에서 실제로 다시 확인한 경우에만 true를 새로 기록한다. 이 규칙은 시각 확인을 발행 필수 게이트로 만들지 않는다.
- 실제 시각 검토에서 **대표 이미지로 부적합하다고 명시 판정된 Commons 원출처**는 `publishing/rejected-hero-sources.mjs`에 수동 등록한다. `assertImageReview`는 이 목록의 원출처가 hero/대표 이미지로 다시 들어오면 `E_IMAGE_HERO_REJECTED`로 차단한다. 이 목록은 사용자가 확인한 구체적 재발 사례를 막는 결정적 수동 목록이며 AI 의미 판정이 아니다. hero로 부적합하다는 판정은 해당 자산을 모든 본문 용도에서 자동 금지한다는 뜻은 아니다.
- 강조: strong18·mark8·mark>u>strong2 이상. 단독 mark·근거 한계 강조·안전 문구만의 강조를 기존 규칙으로 차단한다.
- 핵심 H2 최대6개; FAQ·핵심 정리·자료 출처 등 기존 보조 항목 제외. 기존 연구 세부 과다·근거 한계 반복 검사는 유지한다.
- preflight는 모든 실패 코드를 수집한다. FAIL인 원고는 같은 작성 과정에서 보완하고 저장·제출하지 않는다. 문장·강조·사진을 자동 변조하지 않는다. PREFLIGHT_PASS는 구조 검사이며 의학적 감수나 사진의 시각 확인을 뜻하지 않는다.

## 쉬운말 작성·저장 전 검토

- direct/SP1 원고는 건강·영양 배경지식이 없는 일반 독자가 **전문용어를 따로 검색하지 않아도 한 번에 이해할 수 있는 수준**으로 쓴다. 답을 먼저 말하고 이유와 근거를 뒤에 붙인다.
- 독자 판단에 꼭 필요하지 않은 기관 약어·DB 이름·연구 방법명·전문 성분명은 본문에서 빼고 출처에 둔다. 자료 출처의 권위는 유지하되 본문을 자료명 나열로 만들지 않는다.
- 전문명이 꼭 필요하면 **쉬운 설명을 먼저 쓰고 전문명은 괄호로 한 번만 보조**한다. 이후에는 쉬운 표현을 쓴다.
- 예: `USDA 자료`는 본문에서 `공식 영양 자료`, `비헴철`은 `콩·채소에 든 철분`, `옥살산`은 `신장결석과 관련될 수 있는 성분`, `표준화 분말`은 `연구에서 사용한 분말`, `메타분석`은 `여러 연구를 함께 살펴본 결과`처럼 바꾼다. 정확성을 위해 전문명이 필요한 경우에만 괄호로 남긴다.
- 연구 설계·표본·통계 수치는 결과를 이해하거나 실제 행동 기준을 정하는 데 필요한 것만 남긴다. `연구에서는/기관에 따르면`보다 독자가 원하는 결론을 먼저 쓴다.
- 저장 전 각 문단에서 **전문용어를 지워도 핵심 답과 행동 기준이 유지되는지** 확인한다. 유지된다면 본문에서는 쉬운 말로 바꾸고 세부 전문명은 출처로 보낸다.
- 이 검토는 작성자 편집 기준이다. 새 AI 의미 판정·자동 재작성·분야별 CI를 추가하지 않으며 기존 preflight의 구조 검사를 의학적·문체적 인증으로 확대 해석하지 않는다.

## 작성과 Gate 0

1. 완성 원고 JSON 전체를 자동 발행 경로 밖에 먼저 보존한다. 요약만 남기지 않는다. sourceId·articleId·title·전체 source digest·preflight·저장/실행 상태를 함께 보존한다.
2. 일반 Chat은 현재 지원하는 파일 첨부/산출물 기능으로 JSON과 상태를 남긴다. 로컬 명령이나 사용자 PC 기능을 요구하지 않는다. 운영자 선택 도구는 `node authoring/preserve-direct-source.mjs <원고.json>`이며 evidence/authoring-handoffs 안에 source.json 및 receipt.json을 저장한다. 이 경로는 자동 발행 대상이 아니다.
3. 저장 전 동일 preflight 결과를 확인한다. 일반 Chat이 검사를 실행할 연결 기능이 없으면 구조 검사를 했다고 주장하지 않는다. 표준 전달·러너가 입력 전에 반드시 다시 검사한다.
4. GitHub 저장 성공은 응답200만으로 판정하지 않는다. 실제 커밋 SHA에 고정한 파일을 다시 읽고 전체 JSON의 digest를 대조한다. `confirmGithubSource`가 이를 수행한다. 전달 및 실제 러너 준비에서 source ID·commit·digest를 안전하게 기록한다.
5. 상태: AUTHOR_COMPLETE / PREFLIGHT_PASS / GITHUB_SOURCE_CONFIRMED / WORKFLOW_STARTED / SUBMIT_CLICKED / PUBLIC_VERIFIED. 작성 전에 검사하거나 저장 뒤 재검사할 수 있으므로 이 상태를 단순 시간 순서로 오인하지 않는다. PREFLIGHT_PASS만으로 저장·발행을 완료했다고 하지 않는다.
6. 외부 보안 검사가 GitHub 쓰기를 거절하면 WRITE_BLOCKED. 파일 부재는 E_SOURCE_NOT_CONFIRMED, 조회 제약은 E_SOURCE_CONFIRM_UNAVAILABLE, 내용 불일치는 E_SOURCE_CONFIRM_MISMATCH로 구분한다. 조회 실패만으로 보안 차단을 단정하지 않는다. 저장소 코드가 OpenAI 보안 차단을 제거할 수는 없다.
7. 차단된 원고는 전체 JSON과 실제 오류 코드·단계·기존 실행 유무를 보존한다. 같은 파일의 저장/원장/실행 상태부터 확인해 이어받으며, 근거 변화가 없으면 조사부터 반복하지 않는다. 금지 도구·다른 계정·다른 인터페이스로 보안 차단을 우회하지 않는다.

## 대기열과 제출

기존 publish-posts/update-posts/direct-author-update 경로를 유지한다. 공통 mutation 잠금 및 수정·전달 대기열은 `queue: max`, `cancel-in-progress:false`로 여러 pending 실행을 보존한다. GitHub가 지원하는 대기 한도는100개다. 한도를 넘어 무한 보존되는 영속 작업 큐는 아니다.

pending/queued/cancelled는 제출 성공이나 실제 서비스 실패가 아니다. 큐 대기 후에도 선택 원고·최신 실행 코드·원장·source drift를 재검사한다. submitting/PUBLIC_VERIFICATION_MISMATCH 등 불명확 상태는 재제출하지 않으며 기존 읽기 전용 복구 계약을 적용한다. 실패한 한 글이 모든 후속 글을 영구 차단하게 만들지 않는다.

이번 변경은 계약·저장 확인·대기 보존 개선이다. 외부 쓰기 권한 부여, 예약 프롬프트의 실제 수정, 네 건 재발행, 공개 본문 수정은 별도 실행 증거가 없으면 완료로 보고하지 않는다.
