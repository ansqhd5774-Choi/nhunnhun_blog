# 기존 URL 자동 수정 Queue

목록은 `authoring/update-queue.txt`에 `음식 - 가지 - https://nhunnhun.tistory.com/327` 형식으로 한 번 저장합니다. 현재 108개 항목이 등록돼 있습니다. 신규 발행의 하루 15개 제한을 기존 수정 개수에 적용하지 않습니다.

`기존 글 Queue 로컬 Ollama 자동 수정` workflow를 수동 실행하면 다음 미완료 1건을 조사·작성·검토합니다. R1/R4 및 이미지 gate를 통과한 source/review만 저장하고, 기존 `update-posts.yml`을 명시 호출합니다. GitHub 토큰으로 만든 commit이 push workflow를 자동 실행한다고 가정하지 않습니다.

`CONTENT_UPDATE_QUEUE_ENABLED=true`이면 GitHub cron으로 30분마다 실행하며 목록 변경으로도 실행합니다. cron은 정확한 실행 시간을 보장하지 않습니다. 최초 실제 한 건의 수정·공개 검증·DONE 확인을 완료한 후 자동 운영을 활성화합니다. 로컬 PC, Ollama, Windows runner와 로그인된 Chrome이 실행 중이어야 합니다.

같은 URL의 이전 완료 source/review는 `authoring/update-source-archive/`, `authoring/update-review-archive/`로 보존하며 기존 수정 원장은 변경하지 않습니다. 미완료 기존 source는 archive하지 않습니다. 생성·수정은 기존 공통 브라우저 mutex로 직렬 실행합니다.

DONE은 source fingerprint·URL·source SHA가 맞는 updated 원장, 같은 SHA의 실제 수정 workflow 성공, 공개 제목 확인이 모두 필요합니다. 공개 본문·이미지·레이아웃 검증은 기존 수정 workflow가 담당합니다. Queue의 형식 검사 통과만으로 의학적 진실이나 실제 수정 완료를 선언하지 않습니다.

BLOCKED/RUNNING/READY_FOR_UPDATE 상태에서는 자동 재생성하지 않습니다. timeout이나 dispatch 응답 유실을 실제 수정 실패로 단정하지 않으며, 원장·Actions·공개 페이지를 확인해 같은 제출을 이어서 점검합니다. 실제 재검토 없이 승인 상태·digest를 바꿔 gate를 우회하지 않습니다. 기존 publisher/CMD 파일은 이 변경에서 수정하지 않습니다.
