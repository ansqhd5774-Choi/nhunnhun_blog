# GitHub 글의 클라우드 자동 게시

사용자 요청: GitHub에서 글을 쓰면 티스토리에 자동 게시. 추가 조건: PC가 꺼져 있어도 실행.

구현: posts JSON 입력, 승인/draft 구분, HTML 검사, GitHub Actions push 트리거, Browserbase 전용 세션에서 공식 티스토리 에디터 조작, 원격 submitting/published 기록, 익명 공개 화면 제목·본문 검증.
최초 범위: 신규 글, 실행당 1개, 본문 HTML 및 HTTPS 이미지/링크. 기존 글 수정·스킨 적용·파일 업로드·광고 변경 없음.

로컬 검증: 14개 테스트 PASS, 형식 검사 PASS, draft 예시 발행 대상 0개, 비활성 경로 확인, lockfile 고정 설치 PASS.
읽기 관찰: 실제 티스토리 에디터와 글 관리 링크/카테고리 구조 확인. 공개 글 발행 없음.
외부 활성화: Browserbase 새 계정·로그인 세션 클라우드 보관·연결 키의 GitHub Actions Secrets 저장 승인 대기. 현재 발행 비활성.
BLOCKED 범위: 실제 클라우드 로그인과 발행 검증. 티스토리 서비스 실패가 아님.
기존 원본 백업과 source snapshot 변경 없음.
NEXT: 승인 후 무료 범위에서 연결, 클라우드 로그인, 실제 승인 글 1개로 검증하고 활성화.
