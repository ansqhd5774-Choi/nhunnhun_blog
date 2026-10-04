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
