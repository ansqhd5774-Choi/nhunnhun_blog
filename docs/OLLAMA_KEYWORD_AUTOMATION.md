# GitHub 키워드 → 로컬 Ollama 자동 실행

GitHub 저장소의 **authoring/keywords.txt**를 열어 연필(Edit)을 누르고 한 줄에 키워드 하나를 입력한 뒤 **Commit changes → main에 저장**합니다. 최대 15개, 순차 실행입니다. 별도 CMD를 실행할 필요는 없습니다. PC·기존 GitHub 로컬 러너·Ollama 서버가 켜져 있어야 합니다.

Actions의 **키워드 로컬 Ollama 자동 작성**에서 진행 상태를 확인합니다. 완료된 글은 **codex/ollama-result-…** 브랜치의 **authoring/results/keyword-…/**에 저장됩니다. draft.json이 글 원문, article.html이 검토용 본문, research.json이 조회한 자료, checkpoint.json이 실제 진행 상태입니다. 동일 키워드의 결과 브랜치가 이미 있으면 재생성하지 않습니다. 실패하면 다음 키워드를 처리하지 않고 중단하며 artifact에 checkpoint를 보존합니다. 성공 결과를 지우지 말고 오류 원인을 해결한 뒤 Actions의 workflow_dispatch로 재개하세요.

현재 자동화 범위는 **키워드 분류 → 영문 검색어 → PubMed 상위 3개 초록 조회 → 로컬 Ollama 초안 생성 → GitHub 결과 저장**입니다. 의약품 국내 허가사항·전체 최신 근거 조사 및 의료 의미 검토는 완료로 간주하지 않습니다. OpenAI API 키를 사용하지 않으며 Ollama 클라우드 모델을 호출하지 않습니다. PC 전기·기존 GitHub 이용 한도는 별개입니다.

**검토 없는 자동 발행은 연결하지 않습니다.** qwen3:4b가 건강 효능·섭취량을 잘못 생성한 실제 사례가 있고, 현재 R1/R4에는 이미지 시각 검토와 의미 검토가 필요합니다. 모든 결과는 draft/approved=false입니다. 검토 완료 후 기존 한 건 제한 발행 러너에 제출하는 경로를 유지합니다. 기존 러너 CMD·즉시/예약 발행 코드는 변경하지 않습니다.

실제 시험에서 카르노산을 카르노신(Carnosine)으로 잘못 번역하는 오류를 확인했습니다. 카르노산·참기름·홍삼은 확인된 영문 검색명을 사용합니다. 그 외 키워드는 모델 번역이며 checkpoint.translationStatus=model-translation-needs-review로 표시합니다. 검토자는 검색어가 실제 주제와 일치하는지 먼저 확인해야 합니다. 기본 입력의 카르노산은 자동 실행 연결 점검용 초안이며 /232 수정 요청이 아닙니다.

카르노산 /232는 2026-10-07 01:13 KST에 기존 수정 러너에서 updated 기록 및 공개 본문 검증이 완료된 글입니다. 이 자동화 검증 과정에서는 기존 글을 다시 덮어쓰지 않습니다.

자료 조회: [NCBI E-utilities 공식 규격](https://www.ncbi.nlm.nih.gov/sites/books/NBK25499/). 초록만 조회한 자료는 indexed-abstract-only로 기록하며 원문 확인으로 표시하지 않습니다.
