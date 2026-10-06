# Content Review R1

발행/수정 source와 분리된 **검토 증거**를 보관한다. 실제 source와 동일한 id를 사용한다.

- `posts/<id>.json` ↔ `content-reviews/posts/<id>.json`
- `updates/<id>.json` ↔ `content-reviews/updates/<id>.json`

본문 없이 체크만 작성하거나 실제 검토하지 않은 approved 기록을 만들지 않는다. 변경 없는 과거 source 전체에 빈 검토서를 자동 생성하지 않는다. source 전체 해시가 검토 대상과 일치해야 한다. 신규·수정의 namespace는 분리한다.

작성 방법: [검토서 형식](../docs/CONTENT_REVIEW_FORMAT_R1.md), [작성 기준](../docs/CONTENT_STANDARD_R1.md), [작성 GPT 프롬프트](../docs/CONTENT_WRITER_PROMPT_R1.md).

`--scaffold`는 미승인 템플릿만 출력한다. tests/fixtures의 합성 검토서는 의료 콘텐츠나 실제 발행 승인이 아니므로 이 폴더에 복사하지 않는다. 작성에 사용한 모델과 의료 자격을 혼동하지 않는다.
