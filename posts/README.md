# 자동 발행할 글

파일 하나가 새 게시글 하나다. example-post.json을 복사해 `고유ID.json`으로 저장하고 id도 파일명과 일치시킨다. 현재 예시는 draft이며 발행되지 않는다.

1. title에 제목, category에 현재 관리자 카테고리의 정확한 표시 이름, tags에 태그를 입력한다.
2. bodyHtml에 본문 HTML을 넣는다. 이미지·링크는 HTTPS 주소만 허용하며 파일 업로드 기능은 아직 없다. script·iframe·폼·광고 코드·인라인 스타일은 금지한다.
3. 초안은 status=draft, approved=false를 유지한다.
4. 공개 게시할 최종 내용을 검토한 뒤 status=ready, approved=true로 바꾸어 main에 저장한다. 이 지정은 해당 내용의 공개 발행 승인이다.
5. 클라우드 연결·운영 검증·발행 활성화 후에는 GitHub Actions가 자동 처리한다. PC와 Codex 앱은 켜 둘 필요가 없다.

최초 버전은 실행당 새 글 1개만 처리한다. 한 번에 미발행 ready 글 여러 개를 넣으면 중단한다. 승인된 글의 제목을 기존 공개 글과 중복시키지 않는다.
published 기록이 있는 글을 수정해도 기존 티스토리 글 자동 수정이나 재게시를 하지 않는다. 해당 기능은 별도 작업이다.
발행 결과가 불명확하면 publishing/state의 submitting 기록을 유지하고 중단한다. 기록을 삭제해 임의 재시도하지 않는다.
현재 활성화 상태와 검증 범위는 docs/AUTO_PUBLISH.md를 확인한다.


## 신규 글 디자인·게시 ACTIVE 기준
신규 공개 글은 `docs/EDITORIAL_PUBLISH_STANDARD_R2.md`를 따른다.
디자인은 게시물마다 직접 복제하지 않고 `publishing/editorial.mjs`의 공통 renderer가 적용한다.
본문 이미지가 있으면 `representativeImageUrl`을 반드시 지정하고 본문 이미지 URL과 일치시킨다.
신규 발행은 `.github/workflows/publish-posts.yml` 단일 경로만 사용한다.
