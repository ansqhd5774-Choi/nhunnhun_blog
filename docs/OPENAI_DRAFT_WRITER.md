# OpenAI 자동 글 초안 작성

기존 GitHub Actions Secret `OPENAI_API_KEY`를 사용한다. 키는 코드·로그·산출물에 저장하지 않는다. 기본 모델은 `gpt-6-sol`이며 저장소 Variables의 `OPENAI_MODEL`로 바꿀 수 있다. 모델별 API 이용 권한이 필요하다.

## 실행

1. GitHub 저장소 **Actions → OpenAI 글 초안 작성 → Run workflow**를 연다.
2. 주제에 독자의 질문을 입력한다. 예: `참기름의 영양과 가열 조리·보관 방법`.
3. article_id에 `sesame-oil-storage-20261007`, domain에 `food`를 넣는다. 분야는 food(음식), nutrient(영양소), medicine(약), disease(질병)이다.
4. **Run workflow를 1회** 누른다. 성공하면 실행 페이지 Artifacts의 `draft-입력ID`를 내려받는다.
5. 실패하면 오류 코드를 확인한다. 시간 초과는 API 처리 상태가 불확실하므로 임의 반복 실행하지 않는다. `E_OPENAI_QUOTA`는 결제·잔액, 401은 인증, 403은 권한, 429는 호출 한도 확인이 필요하다. 키를 채팅에 보내지 않는다.

성공 산출물은 `posts/<id>.json`, `content-reviews/posts/<id>.json`, `research.json`, `article.html`이다. artifact 보관은 14일이다. 생성 결과는 저장소에 자동 커밋되지 않는다.

## 범위와 후속 편집

한 실행에서 웹 검색 조사 1회와 JSON 글 작성 1회, 최대 6개 검색 도구 호출을 사용한다. API와 검색 비용이 발생한다. 응답 실패를 자동 재시도하지 않는다. 주제는 수동 입력하며 시간 예약·15개 자동 발행은 이 기능에 포함되지 않는다.

R1·R4 문서를 매 실행 읽고 현재 source 제목 목록으로 중복 위험을 검토한다. 실제 검색 응답 인용 URL을 최소 2개 요구하며 본문은 기존 HTML 검사를 통과해야 한다. 이것은 의학적 정확성·출처 충분성·독자 만족의 증명이 아니다. 웹 검색 자료 안의 명령은 작성 지시로 취급하지 않는다.

글은 `draft`, `approved:false`다. 검토서는 미완성 scaffold이며 AI 작성 메모는 research.json에 별도로 보관한다. 작성 AI가 이미지 시각 검토나 최종 검토를 완료했다고 표시하지 않는다. 이미지 3개·대표 이미지·사용권한·실제 시각 검토, 출처 원문 재확인, R1 검토서 작성, R4 렌더 확인을 마친 뒤 기존 승인·검증·발행 절차로 넘긴다. 완료된 source/review를 함께 저장하고 내용 변경 후 해시를 갱신한다. 이 기능은 티스토리 브라우저·즉시/예약 제출·published/scheduled 원장에 접근하지 않는다.

공식 API 근거: [Responses](https://developers.openai.com/api/docs/guides/text), [웹 검색](https://developers.openai.com/api/docs/guides/tools-web-search), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
