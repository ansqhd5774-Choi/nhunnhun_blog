# 음식 프로젝트 일반 Chat·러너 실행 계약

대상은 `https://nhunnhun.tistory.com/`, 저장소는 `ansqhd5774-Choi/nhunnhun_blog`다. 이 저장소에서 일반 Chat이 새로 조사·작성·수정하는 콘텐츠는 **음식 카테고리만** 허용한다.

음식의 내용·검색 의도·6개 소주제·문체는 `docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt`가 결정한다. 이 문서는 실행 역할만 정한다. 다른 카테고리의 질문·목차·편집 기준을 음식 작업에 사용하지 않는다.

## 역할

### 일반 Chat
- 최신 main SHA와 음식 전용 지침을 확인한다.
- 기존 음식 글과 검색 의도 중복을 확인한다.
- **원고를 `posts/` 또는 `updates/`에 넣기 전에 신규/기존 대상을 먼저 판정한다.**
- 공식 자료와 원문 연구를 조사한다.
- 쉬운 한국어 본문, 3단계 강조, 관련 음식 내부링크, 이미지 근거를 함께 준비한다.
- 저장 전 음식 6개 H2와 첫 문장 답변을 직접 검토한다.
- Gate 0으로 완성 JSON 전체를 자동 발행 경로 밖에 보존한다.
- GitHub 저장 후 실제 커밋에 고정한 source를 다시 읽어 digest 일치를 확인한다.
- 자동 워크플로우를 관찰하고 원장과 PUBLIC_VERIFIED까지 확인한다.

### 공통 러너
- direct preflight
- 기존 인증 세션 사용
- **신규 발행 전 인증된 관리자 글 목록 전체를 읽기 전용으로 조회해 신규/기존 대상을 다시 확인**
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

## 작성 전

1. 최신 main SHA를 확인한다.
2. 음식 프로젝트 지침과 현재 direct/SP1 기술 계약을 읽는다.
3. GitHub 음식 원고·기존 글 목록·허용된 공개 검색으로 중복을 확인한다.
4. **같은 검색 의도의 기존 글이 있으면 숫자 URL을 유지하는 `updates/direct-*.json` 작업으로 확정한다. 기존 후보가 없을 때만 신규 작업으로 진행한다.**
5. 신규 direct/SP1 음식은 `authoring/target-resolution/<sourceId>.json`을 먼저 저장한다. 이 파일은 `sourceId`, `operation:"create"`, 대표 음식명 `topic`, 제목에서 기존 글을 찾는 데 필요한 `aliases`, `reviewed:true`를 가진다.
6. 독자의 실제 검색 질문을 정한다.
7. 음식 6개 축에 맞춰 최대 6개 핵심 H2를 확정한다.

`target-resolution` 기록은 일반 Chat의 의미 판정을 저장하는 영수증이며 자동 의미 판정기가 아니다. 실제 신규 mutation 직전 러너는 인증된 `/manage/posts.json` 전체 목록을 다시 조회한다. 정확히 같은 제목 또는 `topic/aliases`와 일치하는 기존 제목 후보가 하나라도 나오면 `E_TARGET_EXISTING_CANDIDATE`로 **새 글 편집기 진입 전에 중단**한다. 이 경우 신규 재시도를 하지 않고 후보의 숫자 articleId·현재 제목을 확인해 기존 수정 source로 다시 준비한다.

비음식 source·비음식 큐·다른 카테고리 편집 문서는 음식 원고의 기준이나 예시로 읽지 않는다. 음식 기준에서 필요한 내용이 없으면 다른 분야 자료로 보충하지 않고 미확인으로 처리한다.

## 작성·검토

- 답을 먼저 쓰고 이유와 근거를 뒤에 붙인다.
- 전문용어를 몰라도 이해되는 쉬운 한국어를 쓴다.
- 기관·DB·연구방법 이름은 독자 판단에 필요하지 않으면 출처로 보낸다.
- 저장 전 핵심 H2마다 `음식 축 → 실제 독자 질문 → H2 → 첫 문장 직접 답변`을 대조한다.
- 효능 항목을 근거 부족·안전 경고·맛과 향 같은 다른 축의 내용으로 대신 채우지 않는다.
- 연구 설계·표본·통계는 실제 해석에 필요한 범위만 남긴다.
- 사진은 최소 3장, 실제 관련 내부링크만 사용한다.
- 강조는 작성과 동시에 적용한다.

## Gate 0·GitHub 저장

- 완성 원고 전체 JSON과 sourceId·articleId·title·digest·검사 상태를 자동 발행 경로 밖에 먼저 보존한다.
- 신규 음식이면 target-resolution 판정 기록도 source와 함께 보존한다.
- GitHub 쓰기 성공 문구만으로 저장 완료라고 하지 않는다.
- 실제 커밋 SHA에 고정한 파일을 다시 읽고 전체 JSON digest가 일치해야 `GITHUB_SOURCE_CONFIRMED`다.
- 실제 보안 거절은 `WRITE_BLOCKED`로 구분하고 우회하지 않는다.
- 조회 실패·파일 부재·내용 불일치를 보안 차단과 구분한다.

## 표준 실행

- 신규: `target-resolution → posts/*.json → publish-posts.yml → 관리자 대상 식별 Gate → 단일 제출`
- 기존 수정: `updates/direct-*.json → direct-author-update.yml → update-posts.yml`
- direct source는 `contentStandard=SP1`을 유지한다.
- 자동 실행이 있으면 그 실행을 관찰하고 수동 실행을 겹치지 않는다.
- 실제 제출 시작 뒤 최종 상태가 확인될 때까지 해당 source와 실행 코드를 변경하지 않는다.
- queued·busy·offline·cancelled·failed를 구분한다.

## 공개 검증·복구

- HTTP200, SUBMIT_CLICKED, Actions SUCCESS만으로 완료라고 하지 않는다.
- 해당 source의 `PUBLIC_VERIFIED`와 신규 `published` 또는 기존 `updated` 원장을 확인한다.
- PUBLIC_VERIFIED는 공개 반영·렌더 검증이며 의학적 또는 편집 의미 인증이 아니다.
- 제출 후 상태가 불명확하면 **발행 버튼을 다시 누르지 않는다.**
- 신규 제출 직후 본문·이미지·대표 이미지·모바일 본문·제목 메타가 아직 전파되지 않아 검증이 실패한 경우에는 **같은 숫자 URL만 제한 횟수 재조회**한다. 이 재검증은 mutation을 수행하지 않는다.
- 제한 재검증으로도 실패하면 `submitting`을 유지하고 원인을 보고한다.
- 기존 수정은 `update=false + source_id`, 신규는 `recover-publication + source_id + 확인된 public_url`로 읽기 전용 확인을 수행한다.

## 보고

최종적으로 source SHA, Run 링크, 공개 URL, 원장 상태, 실제 중요한 문제만 짧게 보고한다. 확인하지 않은 결과를 PASS로 쓰지 않는다.
