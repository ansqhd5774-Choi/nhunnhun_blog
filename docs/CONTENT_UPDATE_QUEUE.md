# URL별 기존 글 자동 수정 Queue

대상 저장소는 ansqhd5774-Choi/nhunnhun_blog의 main입니다. 일반 Chat은 automation/content-update-queue.json에 목록을 한 번 등록합니다. 실제 일반 Chat에 GitHub 쓰기 도구가 없는 경우는 그 대화의 접근 한계이며 저장소 부재를 의미하지 않습니다.

목록 형식: version=1, items 배열. 항목은 id, keyword, url, domain(food/nutrient/medicine/disease), 실제 category, revision, approved를 포함합니다. 기존 URL은 nhunnhun.tistory.com의 숫자 경로만 허용합니다. 기존 수정 개수에 15개 제한을 적용하지 않습니다. 현재 /327 가지 1건은 연결 검증 대상입니다. 전달되지 않은 108개 전체 목록을 임의로 만들어 등록하지 않습니다.

## 실제 실행 경로

GitHub Actions의 콘텐츠 수정 Queue Producer가 30분마다 실행합니다. GitHub cron은 정확한 시각 실행을 보장하지 않습니다. CONTENT_UPDATE_QUEUE_ENABLED=true인 경우에만 Windows self-hosted에서 다음 미완료 승인 항목 한 건을 처리합니다. 작업 목록이나 검토 완료 bundle 변경으로도 실행할 수 있습니다.

1. Queue 체크포인트를 읽어 같은 request revision의 done을 SKIP합니다.
2. 기존 update workflow가 진행 중이면 새 main 체크포인트도 만들지 않습니다.
3. 현재 공개 제목 확인 → PubMed 초록과 분야별 공식자료 조회 → Commons 라이선스 조회 → Gemma 3의 실제 픽셀 검토를 수행합니다.
4. Qwen 3가 원고와 검토서 구조를 만들고, Gemma 3가 원천·주제·수치·안전·이미지 등을 실제 AI 검토합니다. 이는 의사 감수가 아닙니다.
5. 기존 R1 의미 증거 계약, R4 Scan Density, 이미지 검토, renderer, 실제 링크 요청이 모두 통과해야 원문을 제출합니다. 작성·검토는 실제 오류 피드백을 반영해 최대 3번 시도하며, 최종 의미 검토 실패는 제출 없이 중단합니다.
6. source + 같은 ID review + dispatching checkpoint를 main에 한 commit으로 저장합니다. 기존 URL의 완료된 운영 source는 archive로 옮겨 보존하며 과거 ledger는 변경하지 않습니다. 다른 pending source가 있으면 제출하지 않습니다.
7. 기존 update-posts.yml을 workflow_dispatch(update=true)로 명시 호출합니다. GITHUB_TOKEN의 commit만으로 다음 push workflow가 자동 실행된다고 가정하지 않습니다.
8. 다음 tick에서 source fingerprint/URL/source SHA가 같은 updated ledger와 기존 workflow 성공을 모두 확인한 뒤 done을 기록합니다. 원장·workflow 중 하나만으로 완료를 선언하지 않습니다.

## 상태와 재개

automation/update-queue-state/<id>.json은 producing / blocked / dispatching / done을 기록합니다. producer 결과와 실제 이미지·의미 검토 기록은 Actions artifact에 보존합니다. BLOCKED는 같은 입력을 자동으로 반복 생성하지 않습니다. workflow timeout으로 producing이 남아도 처음부터 무조건 재실행하지 않습니다.

검토로 실제 문제를 해결한 뒤 automation/update-queue-ready/<id>.json에 {requestDigest, source, review}를 등록하면 다음 실행이 동일 대상과 최신 검토 해시를 확인해 재개합니다. 실제 재검토 없이 ready/approved 또는 sourceDigest만 바꾸면 안 됩니다. revision은 새로운 편집 작업 요청을 구분하는 값이며 실패한 submitting 원장을 우회하는 수단이 아닙니다.

dispatch 결과가 불확실하면 자동 재제출하지 않습니다. 15분 후에도 실제 consumer 실행을 확인하지 못하면 E_QUEUE_DISPATCH_NOT_CONFIRMED로 보고하며, 원문과 원장이 실제로 반영됐는지 확인해야 합니다. 소비 workflow가 ledger 작성 전에 실패한 경우도 원문 제출 commit으로 연결해 확인합니다.

이미지 모델: gemma3:4b, 작성 모델: qwen3:4b. 로컬 모델만 사용합니다. Gemma의 이미지/내용 판정도 오류가 있을 수 있으며 코드 PASS는 의학적 진실을 증명하지 않습니다. 국내 허가·지침 등 필수 근거가 확보되지 않은 약학/질병 항목을 임의로 승인하지 않습니다. 자료 접근 실패는 해당 Producer 단계 실패이며 티스토리 Runtime 실패로 확대하지 않습니다.

## 완료 범위

Queue/Producer 구현과 실제 한 건 수정 운영 검증은 별도입니다. 한 건이 공개 검증까지 완료되기 전에는 전체 자동 수정 시스템 운영 성공 또는 108개 완료로 보고하지 않습니다. 보호된 publisher/runner CMD와 기존 update workflow는 변경하지 않습니다.
