# Windows 로그인 검사 보정

전용 Chrome만 세션 복원을 사용한다. 익명 공개 검증용 브라우저는 기존처럼 별도 무인증 컨텍스트를 사용한다. 로그인 스크립트는 로그인 직후 관리자 재접속과 브라우저 종료·재실행 후 관리자 접근을 확인한 뒤에만 LOGIN_SAVED를 출력한다.

관리자 화면에 동일한 이름의 글쓰기 링크가 2개 존재한다. 대기 검사는 첫 링크를 대상으로 하고, 관리자 origin/path 조건은 유지한다. 중복 locator 오류를 로그인 만료로 오판하지 않도록 수정했다.

2026-10-04 직접 검사: 일반 창과 headless 모두 /manage/posts 접근, 글쓰기 링크 2개, 로그인 요구 없음. 수정 후 smoke의 LOCAL_BROWSER_PASS / TISTORY_LOGIN_PASS / PUBLICATION_NOT_ATTEMPTED 확인. 기존 테스트 26개와 validate(6개 글, 신규 발행 대기 1개) 통과.

공식 runner 패키지 SHA256 검사 후 c06-tistory-publisher 등록 및 Online 확인. 현재 사용자 계정의 전용 프로필 사용. 실행 프로세스가 종료되거나 PC가 꺼지면 runner는 Offline이 된다. 상시 서비스 실행은 별도 설치 상태로 구분한다. 이 기록은 글 발행 성공을 의미하지 않는다.
