# 카르노산 /232 — 로컬 Ollama 작업 결과

2026-10-07 09:16 KST, 실제 Ollama `qwen3:4b` 로컬 호출 및 초안 조립 성공.

`article.html`은 읽기용 초안이다. `updates/`와 `content-reviews/updates/`는 후보 source와 미완성 검토서이며 저장소 root의 운영 경로가 아니다. source는 `draft/approved:false`, review는 `pending`이다.

작업 역할: 근거 입력 AI가 공식 자료와 사람 연구를 확인하고 문장을 준비했다. Ollama는 질문 모듈의 순서를 구성했다. `writer-notes.json`에 실제 모델 출력과 조립한 글을 구분해 보관하며 checkpoint에 로컬 실행 결과와 input digest를 남겼다. 본문 전체를 Ollama가 자유 생성했다고 주장하지 않는다.

초기 자유 생성 결과는 연구량·효능 해석 오류가 있어 채택하지 않았다. 현재 입력은 근거 문장을 고정해 오류 재생산을 제한한다. 이것은 자동 의료 검증이 아니다. 최종 출처·R1·강조·이미지·PC/모바일 검토와 실제 수정 승인은 미완료이며 티스토리 /232 저장은 실행하지 않았다.

재실행 입력: `authoring/jobs/carnosic-acid-232-rewrite.json`.
