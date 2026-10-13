# 음식 프로젝트 일반 Chat·러너 실행 계약

대상은 `https://nhunnhun.tistory.com/`, 저장소는 `ansqhd5774-Choi/nhunnhun_blog`다. 이 저장소에서 일반 Chat이 새로 조사·작성·수정하는 콘텐츠는 **음식 카테고리만** 허용한다.

음식의 내용·검색 의도·6개 소주제·문체는 `docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt`가 결정한다. `docs/content/CATEGORY_CONTENT_PARITY.md`, direct/SP1 계약과 이 문서는 실행·디자인·저장·발행의 기술 계약에만 사용하며 다른 카테고리의 질문·목차·편집 기준을 음식 작업에 사용하지 않는다.

## 역할

### 예약 실행의 격리와 준비 상태
- 예약 실행을 설정할 때는 **글 1건 = 독립 1회성 ChatGPT 예약 작업**으로 작업 ID·원고·결과를 구분한다. 이 문서 변경으로 새 예약을 생성하거나 기존 예약을 바꾸지 않는다.
- 원고가 실제 커밋 파일로 확인되지 않은 상태는 `WRITE_NOT_COMMITTED`다. 명시적인 보안 거절은 `WRITE_BLOCKED`로 구분한다. 두 상태 모두 발행 완료가 아니며 완성 원고를 보존한다.
- 러너의 `TISTORY_CHROME_READY`와 `TISTORY_AUTH_READY`는 브라우저·인증 준비 증거다. 일반 Chat이 Chrome을 조작해야 한다는 조건이나 최종 제출·공개 검증 성공으로 해석하지 않는다.

### 일반 Chat
- 최신 main SHA와 음식 전용 지침을 확인한다.
- 기존 음식 글과 검색 의도 중복을 확인한다.
- **원고를 `posts/` 또는 `updates/`에 넣기 전에 신규/기존 대상을 먼저 확정한다.**
- 공식 자료와 원문 연구를 조사한다.
- 쉬운 한국어 본문, 3단계 강조, 관련 음식 내부링크, 이미지 근거를 함께 준비한다.
- 저장 전 음식 6개 H2와 첫 문장 답변을 직접 검토한다.
- Gate 0으로 완성 JSON 전체를 자동 발행 경로 밖에 보존한다.
- GitHub 저장 후 실제 커밋에 고정한 source를 다시 읽어 digest 일치를 확인한다.
- 자동 워크플로우를 관찰하고 원장과 PUBLIC_VERIFIED까지 확인한다.

### 공통 러너
- 작성 전 인증된 관리자 전체 글 목록을 읽기 전용으로 조회해 `NEW / EXISTING_CANDIDATE` 증거를 남긴다.
- direct preflight
- 기존 인증 세션 사용
- **신규 발행 직전 같은 관리자 글 목록을 다시 조회해 작성 전 판정이 아직 유효한지 확인한다.**
- 티스토리 최종 제출
- 익명 공개 확인
- 제목·본문·이미지·대표 이미지·강조·PC1440·모바일390 렌더 검증
- 신규 `published` / 기존 `updated` 원장 최종화

## 금지

- TinyFish 사용·호출·연결·승인 요청
- Browserbase 등 과거 cloud-browser 발행
- Remote Desktop Commander 발행
- Ollama 작성·강조 생성
- 금지 도구·다른 계정·다른 인터페이스를 이용한 보안 차단 우회
- 일반 Chat에서 사용자에게 Node·CMD·gh·Chrome·GUI·로컬 HTML 실행 요구
- 비밀번호·OTP·CAPTCHA·쿠키·토큰·인증 헤더 노출

## 작성 전 — Target Resolution Gate 0

1. 최신 main SHA를 확인한다.
2. 음식 프로젝트 지침과 현재 direct/SP1 기술 계약을 읽는다.
3. GitHub 음식 원고·기존 글 목록·허용된 공개 검색으로 1차 중복을 확인한다.
4. 신규 가능성이 있는 음식은 **본문 작성 전에** `authoring/target-resolution/<sourceId>.json`만 먼저 저장한다. 이 파일은 `sourceId`, `operation:"create"`, 대표 음식명 `topic`, 검색 의도를 찾는 `aliases`, 선택적 `proposedTitle`, `reviewed:true`를 가진다.
5. 이 파일 저장은 `.github/workflows/resolve-target.yml`을 실행한다. 러너는 인증된 `/manage/posts.json`의 공개·비공개를 포함한 관리자 글 목록 전체를 읽기 전용으로 조회하고 `authoring/target-resolution-results/<sourceId>.json`에 결과를 저장한다.
6. 결과가 `existing_candidate`이면 **신규 원고를 만들지 않는다.** 후보의 숫자 `articleId`, 현재 제목, 공개 URL을 기준으로 기존 수정 `updates/direct-*.json` 작업으로 전환한다.
7. 결과가 `new`이고 request digest가 현재 target-resolution 요청과 일치할 때만 신규 원고 작성과 `posts/*.json` 저장을 허용한다.
8. 결과 파일이 없거나, 요청 digest가 다르거나, 관리자 조회가 실패하거나, 후보가 둘 이상이라 판정이 불명확하면 **fail closed**로 신규 발행을 금지한다.
9. 판정 뒤 독자의 실제 검색 질문과 음식 6개 축, 최대 6개 핵심 H2를 확정한다.

`target-resolution` 요청은 일반 Chat이 대표 음식명과 별칭을 명시하는 영수증이며 자동 AI 의미 판정기가 아니다. `posts/`와 `updates/` 폴더는 더 이상 신규/기존을 결정하는 근거가 아니라 **이미 확정된 target 판정 결과를 담는 실행 경로**다.

비음식 source·비음식 큐·다른 카테고리 편집 문서는 음식 원고의 기준이나 예시로 읽지 않는다. 음식 기준에서 필요한 내용이 없으면 다른 분야 자료로 보충하지 않고 미확인으로 처리한다.

## 작성·검토

- 답을 먼저 쓰고 이유와 근거를 뒤에 붙인다.
- 전문용어를 몰라도 이해되는 쉬운 한국어로 쓴다.
- 기관·DB·연구방법 이름은 독자 판단에 필요하지 않으면 출처로 보낸다.
- 저장 전 핵심 H2마다 `음식 축 → 실제 독자 질문 → H2 → 첫 문장 직접 답변`을 대조한다.
- 효능 항목을 근거 부족·안전 경고·맛과 향 같은 다른 축의 내용으로 대신 채우지 않는다.
- 연구 설계·표본·통계는 실제 해석에 필요한 범위만 남긴다.
- 사진은 최소 3장, 실제 관련 내부링크만 사용한다.
- 강조는 작성과 동시에 적용한다.

## Gate 0·GitHub 저장

- 완성 원고 전체 JSON과 sourceId·articleId·title·digest·검사 상태를 자동 발행 경로 밖에 먼저 보존한다.
- 신규 음식이면 target-resolution 요청과 판정 결과도 source와 함께 보존한다.
- GitHub 쓰기 성공 문구만으로 저장 완료라고 하지 않는다.
- 실제 커밋 SHA에 고정한 파일을 다시 읽고 전체 JSON digest가 일치해야 `GITHUB_SOURCE_CONFIRMED`다.
- 실제 보안 거절은 `WRITE_BLOCKED`로 구분하고 우회하지 않는다.
- 조회 실패·파일 부재·내용 불일치를 보안 차단과 구분한다.

## 표준 실행

- 신규: `target-resolution request → resolve-target.yml → result=new → 원고 작성/Gate0 → posts/*.json → publish-posts.yml → 관리자 대상 재확인 Gate → 단일 제출`
- 기존 수정: `result=existing_candidate 또는 기존 numeric URL 확인 → updates/direct-*.json → direct-author-update.yml → update-posts.yml`
- direct source는 `contentStandard=SP1`을 유지한다.
- 신규 mutation 직전 `target-resolution-gate.mjs`는 작성 전 판정 결과의 request digest를 다시 대조한 다음 관리자 전체 글을 **다시 조회**한다. 기존 후보가 생겼으면 `E_TARGET_EXISTING_CANDIDATE`로 새 글 편집기 진입 전에 중단한다.
- 자동 실행이 있으면 그 실행을 관찰하고 수동 실행을 겹치지 않는다.
- 실제 제출 시작 뒤 최종 상태가 확인될 때까지 해당 source와 실행 코드를 변경하지 않는다.
- queued·busy·offline·cancelled·failed를 구분한다.

## 단일 완료·복구 루프

- **제출 전 실패**는 `submitting` 원장이 생기지 않았고 제출 단계가 시작되지 않은 경우다. 이때는 실패한 단계의 로그를 한 번만 확인해 직접 원인을 수정하고, 같은 source를 그대로 재실행해 발행을 계속한다. 별도 사용자 승인이나 새 sourceId를 요구하지 않는다.
- source 또는 관련 실행 코드가 바뀌지 않았다면 이미 PASS한 조사·Gate 0·digest·preflight를 같은 근거로 반복 점검하지 않는다. 실패한 단계와 그 이후만 이어간다.
- 직접 원인이 확인된 장애에 별도 우회 게이트·중복 검사·보조 규칙을 추가하지 않는다. 원인 코드를 고치는 것을 우선한다.
- **제출 후 불명확**은 `submitting` 원장이 있거나 최종 제출이 시작된 경우다. 이때만 재제출을 금지하고 읽기 전용 복구를 사용한다.
- 완료 판정은 한 번만 한다. 신규는 `phase=published + PUBLIC_VERIFIED`, 기존 수정은 `phase=updated + PUBLIC_VERIFIED`가 확인되면 종료하며, 모순 증거가 없는 한 같은 공개 상태를 별도 수동 점검으로 다시 확인하지 않는다.

## 공개 검증·복구

- HTTP200, SUBMIT_CLICKED, Actions SUCCESS만으로 완료라고 하지 않는다.
- 해당 source의 `PUBLIC_VERIFIED`와 신규 `published` 또는 기존 `updated` 원장을 확인한다.
- PUBLIC_VERIFIED는 공개 반영·렌더 검증이며 의학적 또는 편집 의미 인증이 아니다.
- 제출 후 상태가 불명확하면 **발행 버튼을 다시 누르지 않는다.**
- 신규 제출 직후 본문·이미지·대표 이미지·모바일 본문·제목 메타가 아직 전파되지 않아 검증이 실패한 경우에는 **같은 숫자 URL만 제한 횟수 재조회**한다. 이 재검증은 mutation을 수행하지 않는다.
- 제한 재검증으로도 실패하면 `submitting`을 유지하고 원인을 보고한다.
- 기존 수정은 `update=false + source_id`, 신규는 `recover-publication + source_id + 확인된 public_url`로 읽기 전용 확인을 수행한다.

## 보고

최종적으로 target 판정, source SHA, Run 링크, 공개 URL, 원장 상태, 실제 중요한 문제만 짧게 보고한다. 확인하지 않은 결과를 PASS로 쓰지 않는다.
