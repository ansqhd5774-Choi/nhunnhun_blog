> 최신 실행 기준: [일반 Chat 작성·러너 실행 계약](GENERAL_CHAT_EXECUTION.md)이 작성자 로컬 명령·GUI 의무와 공개 검증 담당에 우선합니다. 아래의 명령·미리보기·관리자 화면 절차는 러너/운영자용이며 일반 Chat의 필수 기능이 아닙니다. 직접 원고는 최신 DIRECT_AUTHORING_R1을 적용합니다.

# Windows 전용 티스토리 자동화 Runner — 최초 설정

## 2026-10-04 자동 운영 및 Queue 보호

현재 PC는 `NHUNNHUN-Tistory-Runner` 작업 스케줄러로 동일 프로필 소유자의 **Windows 로그인 30초 후** 자동 시작한다. `InteractiveToken` / 최소 권한 / 중복 실행 IgnoreNew / 실행시간 제한 없음으로 구성한다. 로그인하지 않은 부팅 직후에는 실행되지 않는다. 비밀번호 없는 S4U는 네트워크 접근 제약이 있어 사용하지 않는다. Windows 자동 로그인을 활성화하지 않는다.

장애 복구는 작업 실패 후 1분 간격 3회 재시작과 2분 간격 listener 확인으로 구성한다. 이미 실행 중인 listener는 중복 시작하거나 종료하지 않는다. 유지보수 때 `C:\actions-runner\maintenance.stop`을 먼저 생성하고 작업을 중지한다. 재개할 때 해당 marker만 제거한 뒤 작업을 1회 실행한다. 공식 runner의 CMD helper를 사용하며 `run.cmd`의 PowerShell Unblock-File 단계는 사용하지 않는다. listener 정상 종료와 session conflict는 CMD helper의 정상 종료 규칙을 유지한다. 반복 복구를 중지하려면 marker를 유지한다.

서비스가 필요한 경우 GitHub 공식 절차에 따라 기존 runner를 재등록하고 **동일 Windows 사용자**의 서비스 계정을 사용한다. 관리자 CMD와 해당 계정 비밀번호 입력은 사용자가 로컬에서 수행한다. LocalSystem 변경, profile 복사, 비밀번호 인수/로그/채팅 저장은 금지한다. 서비스 복구 정책은 `sc failure <service-name> reset= 86400 actions= restart/60000/restart/120000/restart/300000`으로 적용한다. 서비스와 위 예약 작업은 동시에 사용하지 않는다.

현재 전원 연결 AC 절전 및 최대절전 타이머는 모두 0(사용 안 함)이다. 불필요한 전원 설정 변경은 하지 않았다. NIC 절전 설정은 미검증이며 네트워크가 정상일 때 장애 원인으로 단정하지 않는다.

상태 확인: GitHub Settings → Actions → Runners에서 Online/Idle 또는 Active를 확인한다. Offline은 listener/서비스/작업/PC 상태부터 확인한다. 읽기 전용 `maintenance\check-windows-runner.cmd`는 값이나 프로필 내용 없이 존재 여부를 출력한다. GitHub API 조회 권한이 없는 hosted 진단은 RUNNER_UNREACHABLE로 기록하며 Offline으로 단정하지 않는다.

Queue 확인 순서: 다른 job 사용 여부 → Online → self-hosted/windows/x64/tistory-publisher 네 label → 예약 작업 또는 서비스 실행 여부 → 절전 → 네트워크 → source drift. queued mutation job은 matching self-hosted runner가 아직 배정되지 않았다는 뜻이다. 권한을 추가하거나 PAT를 생성하지 않는다.

모든 checkout은 workflow의 `github.sha`에 고정한다. Windows job의 Gate A는 workflow SHA = checkout SHA = 최신 remote main을 검사하고 불일치하면 BLOCKED_SOURCE_DRIFT로 브라우저 전에 차단한다. 최종 클릭 전 Gate B도 동일 검사한다. Queue 나이 자체로 차단하지 않고 SHA 일치를 기준으로 한다. 기존 테스트/validate와 submitting/published/updated 보호를 유지한다.

재부팅 자체는 작업 중 자동 실행하지 않는다. 로그인 후 자동 실행 설정과 재시작 실측을 구분하고, 실제 재부팅 검증 전에는 reboot PASS로 보고하지 않는다.

실제 운영 검증: PR #18 main 반영, runner idle 재시작 후 Online 및 네 label 확인. 로그인 smoke PASS. Run `37194435494`의 hosted validate/Windows Gate A/테스트/수정/익명 공개 품질 단계 모두 성공. `/313`은 기존 숫자 URL에서 수정됐고 ledger `updated`이다. PC/full-body/Editorial/mobile 검증은 ledger에 기록했다. TISTORY_PUBLISH_ENABLED는 true로 복구했다. 상세 증거: `evidence/windows-runner-queue-20261004.json`.

목적: 상시 가동 Windows PC의 전용 Chrome 로그인으로 GitHub main의 승인된 신규 글 발행과 기존 글 수정을 수행한다. PC가 꺼져 있거나 runner가 Offline이면 실제 Tistory mutation을 수행하지 못한다. 유료 cloud browser는 표준 경로에서 사용하지 않는다.

소스·테스트 준비 후 실제 runner 등록과 최초 Kakao 로그인은 사용자가 아래 순서로 한 번만 한다. 설정 중 TISTORY_PUBLISH_ENABLED는 false로 유지한다. 등록·로그인 성공을 알려주면 Codex가 runner Online과 표준 workflow를 확인하고 활성화한다.

## 1. CMD와 실행 계정 준비

시작 메뉴에서 **명령 프롬프트(CMD)**를 연다. PowerShell/WSL/bash는 사용하지 않는다. 아래 실행 계정은 Chrome, 전용 프로필, runner 작업 폴더를 읽고 쓸 수 있어야 한다.

현재 PC에는 Chrome과 Git이 있다. 기본 PATH의 Node 실행 파일은 호환 오류를 보였으므로 최초 설정에서는 아래 확인된 Node 24 x64를 사용한다. 이 경로는 PC 설정용 예시이며 발행 소스에 하드코딩되지 않는다. 다른 PC에서는 공식 Node 24 x64 설치 후 node 경로를 사용한다.

```cmd
set "NODE_EXE=C:\Users\c06\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%NODE_EXE%" --version
git --version
```

정상: Node v24.x, Git 버전. 오류면 중단하고 **오류 코드만** 알려준다. 토큰·쿠키·비밀번호는 보내지 않는다.

## 2. 프로필·환경변수 먼저 준비

CMD에서 Chrome 실행 파일의 실제 위치를 확인한다. 아래 첫 위치가 없으면 두 번째 위치를 확인하고 존재하는 위치만 설정한다.

```cmd
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" echo CHROME_PRESENT
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" echo CHROME_X86_PATH_PRESENT
if not exist C:\tistory-publisher mkdir C:\tistory-publisher
if not exist C:\tistory-publisher\profile mkdir C:\tistory-publisher\profile
set "TISTORY_CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "TISTORY_PROFILE_DIR=C:\tistory-publisher\profile"
setx TISTORY_CHROME_PATH "%TISTORY_CHROME_PATH%"
setx TISTORY_PROFILE_DIR "%TISTORY_PROFILE_DIR%"
```

set는 현재 CMD에, setx는 **현재 사용자 계정의 이후 새 프로세스**에 적용된다. runner 서비스도 같은 사용자 계정으로 등록해야 한다. 다른 계정으로 실행할 경우 관리자 CMD에서 setx 명령에 /M을 붙여 machine 범위로 설정하고 해당 계정의 폴더 권한을 확인한다. 실행 중인 runner는 환경변수 설정 후 재시작한다. 경로는 비밀 값이 아니지만 로그에 출력하지 않는다.

프로필은 repo 밖에 둔다. 일반 Chrome의 User Data/Default 프로필을 지정하지 않는다. 프로필 내용을 압축·공유·commit·artifact/cache로 올리지 않는다.

## 3. 최신 저장소에서 최초 로그인

아래 폴더가 없을 때만 clone한다. 이미 별도 clone이 있으면 그 폴더의 변경을 보존하고 최신 main을 사용한다. 원본 작업 폴더를 reset/clean하지 않는다.

```cmd
if not exist C:\tistory-publisher\repo git clone https://github.com/ansqhd5774-Choi/nhunnhun_blog.git C:\tistory-publisher\repo
cd /d C:\tistory-publisher\repo
git status --short
git switch main
git pull --ff-only origin main
set "PATH=C:\Users\c06\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
pnpm --version
pnpm install --frozen-lockfile --ignore-scripts
node publishing\login.mjs
```

pnpm 정상 버전은 11.19.0이다. pnpm이 없으면 Node 24가 정상 실행되는 같은 CMD에서 npm install --global pnpm@11.19.0을 한 번 실행한다.

마지막 login 명령을 **1회** 실행하면 전용 Chrome이 열린다. 사용자가 그 창에서 직접 Kakao/Tistory 로그인을 완료한다. 비밀번호·OTP는 Chrome에만 입력한다. 프로그램은 /manage/posts와 **글쓰기** 링크를 확인하고 Chrome을 정상 종료하며 LOGIN_SAVED를 출력한다. 4분 내 미완료, 창 닫힘, 오류, CAPTCHA 또는 예상치 못한 권한 요청이면 멈추고 상태/오류 코드만 알려준다. 로그인 script는 글을 만들거나 발행하지 않는다. CAPTCHA를 자동으로 풀지 않는다.

## 4. Runner 설치·등록

GitHub의 nhunnhun_blog → Settings → Actions → Runners → New self-hosted runner → Windows → x64를 연다. **그 화면의 현재 공식 ZIP URL, 파일명, SHA256, 실제 등록 token**을 사용한다. 임의 버전·token을 만들지 않는다.

화면의 다운로드 예시가 PowerShell이면 그대로 실행하지 않는다. CMD에서는 curl.exe와 tar.exe로 같은 공식 ZIP을 다운로드/추출한다. 아래 URL/파일명 자리는 현재 GitHub 화면의 값으로 치환한다.

```cmd
if not exist C:\actions-runner mkdir C:\actions-runner
cd /d C:\actions-runner
curl.exe --fail --location --output RUNNER_FILE.zip OFFICIAL_GITHUB_DOWNLOAD_URL
certutil -hashfile RUNNER_FILE.zip SHA256
tar.exe -xf RUNNER_FILE.zip
```

출력 SHA256이 GitHub 화면의 값과 정확히 같을 때만 진행한다. 다운로드·해시·추출 실패면 재실행하지 말고 오류 종류만 보낸다. 기존 C:\actions-runner에 등록된 runner가 있으면 덮어쓰지 않는다.

GitHub가 제공한 **config.cmd** 등록 명령을 현재 CMD에서 1회 실행하고 사용자 지정 label에 **tistory-publisher**를 추가한다. self-hosted/windows/x64 기본 label은 유지한다. 등록 token은 채팅·repo·문서·스크린샷으로 보내지 않는다.

상시 운영은 서비스 등록이 권장된다. Windows service 설치 질문에서 서비스 실행 계정을 **위 최초 로그인과 같은 사용자 계정**으로 선택한다. 공식 config.cmd는 --windowslogonaccount를 지원한다. 계정의 Windows 비밀번호는 로컬 config.cmd prompt에서만 입력하고 명령 인수/문서/GitHub Secret에 넣지 않는다. 서비스 설치는 관리자 CMD가 필요할 수 있다. 다른 계정의 프로필을 복사해서 우회하지 않는다.

처음에는 서비스 대신 동일 사용자의 CMD에서 run.cmd를 실행해 Online을 확인할 수도 있다. 그 CMD를 닫으면 Offline이 된다. 서비스와 run.cmd를 동시에 실행하지 않는다.

## 5. 사용자에게 반환할 결과 / 발행 Gate

정확히 다음 세 가지만 알려준다.

1. GitHub Runners에 Online/Idle 표시 여부와 runner label 네 개.
2. 최초 login 실행의 LOGIN_SAVED 여부.
3. 실패한 경우 오류 코드만. token/비밀번호/OTP/profile 파일 금지.

정상 기대값: runner Online, LOGIN_SAVED. 이후 실제 작업은 최신 main과 해당 ledger를 확인한 다음 표준 workflow만 사용한다.

- 신규 공개 글: `.github/workflows/publish-posts.yml`
- 기존 숫자 URL 수정: `.github/workflows/update-posts.yml`
- 신규 글 source: `posts/*.json`
- 기존 글 수정 source: `updates/*.json`

신규 글이 `submitting`이면 자동 재발행하지 않고, `published`이면 재발행하지 않는다. 기존 글 수정이 `submitting`이면 자동 재수정하지 않고, 공개 URL 상태를 먼저 확인한다. 완료 판정은 익명 공개 URL·전체 제목/본문·이미지·대표 이미지 및 kakaocdn `og:image`·Editorial R3 계약·PC/mobile 검증과 최종 ledger 상태까지 확인했을 때만 한다.

공식 참고: [runner 추가](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners), [Windows 서비스](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/configure-the-application?platform=windows), [runner config 인수](https://github.com/actions/runner/blob/main/src/Runner.Listener/Runner.cs).
