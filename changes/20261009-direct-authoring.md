# 직접 작성 전환 및 사진 수정

목적: 승인한 카드 디자인을 향후 글에 재사용하고 Ollama 작성 운영을 중단한다.

주요 변경:
- 기존 Ollama 예약 workflow를 삭제하고 direct-author-update.yml의 수동 source 발행으로 전환.
- GPT 직접 source에만 direct-design renderer 적용. 기존 R1·legacy source는 기존 렌더링 유지.
- 승인 CSS 및 직접 작성/강조/사진 절차를 저장. 감자 시안 대표 사진은 고해상도 식용 감자로 교체하고 꽃·중복 사진 제거.

검증: node --test tests/direct-authoring.test.mjs 3/3 통과. CLI 문법 검사 통과. 시안 PC1440·모바일390에서 카드 3열/1열, 페이지 넘침 없음. 대표 이미지 1280×842 로드 확인.

운영: 스킨에 nh-direct scoped CSS 저장. 백업은 ../backup/20261009-skin-design/style-before-direct-approved.css (private). 감자 글 자체는 이번 작업에서 재발행하지 않음. GitHub는 완성 원고 발행만 수행하며, 이 대화의 GPT를 백그라운드에서 자동 호출하지 않음. 새로운 OpenAI API 연결 없음.
