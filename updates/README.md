> 최신 실행 기준: [일반 Chat 작성·러너 실행 계약](../docs/GENERAL_CHAT_EXECUTION.md)이 작성자 로컬 명령·GUI 의무와 공개 검증 담당에 우선합니다. 아래의 명령·미리보기·관리자 화면 절차는 러너/운영자용이며 일반 Chat의 필수 기능이 아닙니다. 직접 원고는 최신 DIRECT_AUTHORING_R1을 적용합니다.

# Existing Tistory post updates

이 디렉터리는 이미 공개된 티스토리 글을 **같은 숫자 URL에서 수정**하기 위한 source-of-truth다.

원칙:
- 신규 공개 글은 `.github/workflows/publish-posts.yml`만 사용한다.
- 기존 글 수정은 `.github/workflows/update-posts.yml`만 사용한다.
- update source의 `articleId`, `targetUrl`, `expectedCurrentTitle`이 실제 관리자 화면과 모두 일치해야 수정 가능하다.
- 수정 직전 remote main SHA와 작업 SHA가 다르면 중단한다.
- 최종 저장 직전 `publishing/update-state/<id>.json`에 `submitting` checkpoint를 기록한다.
- `submitting` 상태에서 결과가 불명확하면 자동 재수정하지 않는다.
- 수정 후 같은 URL의 익명 공개 페이지에서 제목·본문·Editorial R3·대표 이미지·PC/모바일을 검증한 뒤에만 `updated`로 기록한다.
- 기존 글을 수정한다는 이유로 새 숫자 URL을 만들지 않는다.

- 같은 articleId를 다시 최신화해야 할 경우 기존 완료 source를 `updates/archive/`로 보존하고, 현재 공개 제목을 `expectedCurrentTitle`로 둔 새 revision source 1개만 root에 둔다. 과거 update revision과 ledger는 삭제하지 않는다.
