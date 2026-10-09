> RETIRED 운영 안내: Ollama 자동 작성은 현재 운영 경로에서 사용하지 않는다. 과거 절차·실험 기록으로만 보존한다. 일반 Chat 직접 작성은 GENERAL_CHAT_EXECUTION.md를 따른다.

# Ollama 카르노산 /232 재작성

GitHub에는 `authoring/jobs/carnosic-acid-232-rewrite.json`에 대상 URL·기존 제목·분류·수정 요구와 확인한 근거를 저장한다. 글 생성은 사용자의 PC에서 `http://127.0.0.1:11434`의 Ollama를 사용한다. GitHub hosted runner의 localhost는 사용자 PC가 아니므로 hosted Actions에서 이 주소로 실행하지 않는다. 기존 발행 러너를 수정하거나 외부에 Ollama 포트를 개방하지 않는다.

기본 모델은 `qwen3:4b`이며 로컬 모델만 허용한다. OpenAI API 키·요금·Ollama cloud를 사용하지 않는다. 다운로드·저장 공간·PC 전력은 필요하다. Ollama 자체 인터넷 검색을 구현한 것이 아니라 편집자가 확인해 넣은 자료를 바탕으로 초안을 쓴다. 자료가 오래됐거나 질문이 바뀌면 job의 출처를 다시 확인하고 갱신한다.

카르노산 job은 `evidence-bound-outline` 모드다. 작은 모델의 자유 생성 시험에서 사실 오류가 반복되어, 출처 확인 후 편집한 본문 문장을 job에 고정한다. Ollama는 질문 모듈의 순서를 구성하고 생성기는 그 근거 문장으로 글을 조립한다. 따라서 본문 전체가 Ollama의 자유 창작이라고 보고하지 않는다. 모델이 새로운 효능·용량을 끼워 넣을 수 없는 범위이며, 원래 근거 문장과 최종 글의 편집 검토는 여전히 필요하다.

## 준비와 실행

이번 작업에서는 Ollama 설치·실행 상태를 확인하고 모델을 다운로드한다. Node와 프로젝트 의존성이 필요하며 기존 pnpm lockfile을 유지한다.

1. 저장소 root의 `authoring/run-ollama.cmd` 또는 바탕화면에 제공된 `NHUNNHUN_OLLAMA_CARNOSIC_232.cmd`를 연다.
2. 기본 카르노산 job을 **1회** 실행한다. 따로 제목·키를 입력할 필요가 없다.
3. `OLLAMA_STARTED` 후 기다린다. 수분 걸릴 수 있다. 완료되면 `OLLAMA_DRAFT_CREATED`와 산출물 폴더가 표시된다.
4. `generated-drafts/<job-id>/<실행시각>/article.html`과 `updates/<id>.json`, `content-reviews/updates/<id>.json`, 작성 메모·checkpoint를 확인한다.
5. 오류가 나타나면 중지하고 코드와 checkpoint를 전달한다. 실행 중 CMD·Ollama를 닫거나 연속 실행하지 않는다. 진행 중이라는 이유만으로 실패로 판단하지 않는다.

각 실행은 별도 폴더를 사용한다. 산출물은 자동 덮어쓰기·커밋·티스토리 제출되지 않는다. GitHub에 결과를 보관하려면 `authoring/drafts/` 등 비운영 경로에 별도 저장한다. generated-drafts는 로컬 작업용으로 Git에서 제외한다.

응답은 스트리밍으로 받는다. checkpoint의 receivedChunks·receivedCharacters·lastProgressAt과 partial-response.txt에 진행 내용을 저장하며, 미완료 응답은 완성 원고로 처리하지 않는다. 추론 단계에서는 글자 수가 0이어도 청크가 증가할 수 있다. `E_OLLAMA_CLAIM_REVIEW`는 확인된 카르노산 오류 표현 재생산을 발견한 경우이며 원고·근거를 편집 검토해야 한다. 이 제한된 오류 패턴 검사는 전체 의학적 의미 검증을 대신하지 않는다.

## 검토와 실제 수정은 별도

산출물은 /232 수정 후보이며 `draft/approved:false`, review `pending`이다. 운영 `updates/`는 ready/approved와 실제 이미지 검토를 요구하므로 초안을 그대로 운영 경로에 복사하지 않는다. 최종 의미 검토·출처 재확인·이미지 3개·대표 이미지·사용권한·R4 강조/렌더·검토 해시를 완성한 뒤 사용자가 실제 수정 요청한 경우에만 기존 update-posts 경로로 넘긴다. 이 생성기는 수정 원장·발행 브라우저에 접근하지 않는다. 자동 HTML/링크 PASS가 의학적 정확성이나 R1 전체 검토 완료를 뜻하지 않는다.

공식 근거: [Ollama Chat API](https://docs.ollama.com/api/chat), [Qwen3 4B](https://ollama.com/library/qwen3:4b).
