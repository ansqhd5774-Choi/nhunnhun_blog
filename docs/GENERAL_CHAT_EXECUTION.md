# 음식 프로젝트 일반 Chat·러너 실행 계약

대상은 `https://nhunnhun.tistory.com/`, 저장소는 `ansqhd5774-Choi/nhunnhun_blog`다. 이 저장소에서 일반 Chat이 새로 조사·작성·수정하는 콘텐츠는 **음식 카테고리만** 허용한다.

음식의 내용·검색 의도·소제목·문체는 `docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt`와 `docs/content/FOOD_CONTENT_QUALITY_R1.md`가 결정한다. 이 문서는 **대상 판정·저장·실행·발행·공개 검증의 기술 계약에만** 사용한다. 음식의 편집 질문이나 본문 내용을 이 문서에서 추가하지 않는다.

## 역할

### 일반 Chat
- 최신 main SHA와 음식 전용 기준을 확인한다.
- 기존 음식 글과 검색 의도 중복을 확인한다.
- 신규/기존 대상을 확정한 뒤 음식 전용 기준으로 원고를 완성한다.
- Gate 0으로 완성 JSON 전체를 자동 발행 경로 밖에 보존한다.
- GitHub 저장 후 실제 커밋에 고정한 source를 다시 읽어 digest 일치를 확인한다.
- 자동 워크플로우를 관찰하고 원장과 PUBLIC_VERIFIED까지 확인한다.

### 공통 러너
- 작성 전 인증된 관리자 전체 글 목록을 읽기 전용으로 조회해 `NEW / EXISTING_CANDIDATE` 증거를 남긴다.
- direct preflight를 실행한다.
- 기존 인증 세션을 사용한다.
- 신규 발행 직전 같은 관리자 글 목록을 다시 조회해 작성 전 판정이 아직 유효한지 확인한다.
- 티스토리 최종 제출과 익명 공개 확인을 수행한다.
- 제목·본문·이미지·대표 이미지·강조·PC1440·모바일390 렌더를 검증한다.
- 신규 `published` / 기존 `updated` 원장을 최종화한다.

## 금지
- TinyFish 사용·호출·연결·승인 요청
- Browserbase 등 과거 cloud-browser 발행
- Remote Desktop Commander 발행
- Ollama 작성·강조 생성
- 음식 원고에 Queue/Ollama 작성 경로 사용
- 금지 도구·다른 계정·다른 인터페이스를 이용한 보안 차단 우회
- 일반 Chat에서 사용자에게 Node·CMD·gh·Chrome·GUI·로컬 HTML 실행 요구
- 비밀번호·OTP·CAPTCHA·쿠키·토큰·인증 헤더 노출

## 작성 전 — Target Resolution Gate 0
1. 최신 main SHA를 확인한다.
2. 음식 프로젝트 지침과 현재 direct/SP1 기술 계약을 읽는다.
3. GitHub 음식 원고·기존 글 목록·허용된 공개 검색으로 1차 중복을 확인한다.
4. 신규 가능성이 있는 음식은 **본문 작성 전에** `authoring/target-resolution/<sourceId>.json`만 먼저 저장한다.
5. 이 파일 저장은 `.github/workflows/resolve-target.yml`을 실행한다. 러너는 인증된 `/manage/posts.json`의 공개·비공개를 포함한 관리자 글 목록 전체를 읽기 전용으로 조회하고 `authoring/target-resolution-results/<sourceId>.json`에 결과를 저장한다.
6. 결과가 `existing_candidate`이면 신규 원고를 만들지 않고 해당 숫자 URL의 기존 수정 작업으로 전환한다.
7. 결과가 `new`이고 request digest가 현재 요청과 일치할 때만 신규 원고 작성과 `posts/*.json` 저장을 허용한다.
8. 결과 파일 부재·digest 불일치·관리자 조회 실패·판정 불명확은 fail closed로 신규 발행을 금지한다.

`target-resolution` 요청은 신규/기존 대상을 판정하기 위한 실행 영수증이며 음식 내용 기준이 아니다. `posts/`와 `updates/`는 이미 확정된 대상의 실행 경로다.

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
- 음식 source는 `contentStandard=SP1`을 유지하며 direct/SP1 경로만 사용한다.
- 신규 mutation 직전 `target-resolution-gate.mjs`는 작성 전 판정 결과의 request digest를 다시 대조한 다음 관리자 전체 글을 다시 조회한다.
- 자동 실행이 있으면 그 실행을 관찰하고 수동 실행을 겹치지 않는다.
- 실제 제출 시작 뒤 최종 상태가 확인될 때까지 해당 source와 실행 코드를 변경하지 않는다.
- queued·busy·offline·cancelled·failed를 구분한다.

## 단일 완료·복구 루프
- 제출 전 실패는 실패한 단계의 직접 원인을 수정하고 같은 source를 재실행한다.
- source 또는 관련 실행 코드가 바뀌지 않았다면 이미 PASS한 단계 전체를 불필요하게 반복하지 않는다.
- 제출 후 상태가 불명확하면 재제출하지 않고 읽기 전용 복구를 사용한다.
- 신규는 `phase=published + PUBLIC_VERIFIED`, 기존 수정은 `phase=updated + PUBLIC_VERIFIED`가 확인되면 완료다.

## 공개 검증·복구
- HTTP200, SUBMIT_CLICKED, Actions SUCCESS만으로 완료라고 하지 않는다.
- 해당 source의 `PUBLIC_VERIFIED`와 신규 `published` 또는 기존 `updated` 원장을 확인한다.
- PUBLIC_VERIFIED는 공개 반영·렌더 검증이며 콘텐츠 의미 인증이 아니다.
- 제출 후 상태가 불명확하면 발행 버튼을 다시 누르지 않는다.
- 공개 전파 지연으로 검증이 실패한 경우 같은 숫자 URL만 제한 횟수 재조회하며 mutation을 수행하지 않는다.
- 제한 재검증으로도 실패하면 `submitting`을 유지하고 원인을 보고한다.

## 보고
최종적으로 target 판정, source SHA, Run 링크, 공개 URL, 원장 상태, 실제 중요한 문제만 짧게 보고한다. 확인하지 않은 결과를 PASS로 쓰지 않는다.
