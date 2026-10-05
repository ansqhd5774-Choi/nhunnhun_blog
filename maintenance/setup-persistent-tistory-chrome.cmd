@echo off
setlocal EnableExtensions

set "RUNNER_DIR=C:\actions-runner"
set "REPO_DIR=C:\actions-runner\_work\nhunnhun_blog\nhunnhun_blog"
set "ENSURE_SCRIPT=%RUNNER_DIR%\ensure-tistory-chrome.cmd"

echo [1/4] prerequisite check
if not exist "%REPO_DIR%\maintenance\ensure-tistory-chrome.cmd" (
  echo FAIL: ENSURE_SCRIPT_MISSING
  exit /b 10
)
if not exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  echo FAIL: CHROME_MISSING
  exit /b 12
)

echo [2/4] persist browser environment
if not exist "C:\tistory-publisher\profile\" mkdir "C:\tistory-publisher\profile"
setx TISTORY_CHROME_PATH "C:\Program Files\Google\Chrome\Application\chrome.exe" >nul
setx TISTORY_PROFILE_DIR "C:\tistory-publisher\profile" >nul
setx TISTORY_CDP_URL "http://127.0.0.1:9223" >nul
setx TISTORY_CDP_PORT "9223" >nul

echo [3/4] install stable helper files
copy /y "%REPO_DIR%\maintenance\ensure-tistory-chrome.cmd" "%ENSURE_SCRIPT%" >nul

echo [4/4] remove legacy Chrome auto-start tasks
schtasks /Delete /TN "NHUNNHUN-Tistory-Chrome" /F >nul 2>nul
schtasks /Delete /TN "NHUNNHUN-Tistory-Chrome-Watchdog" /F >nul 2>nul

echo [4/4] start dedicated Chrome for explicit login/setup
set "TISTORY_CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "TISTORY_PROFILE_DIR=C:\tistory-publisher\profile"
set "TISTORY_CDP_URL=http://127.0.0.1:9223"
set "TISTORY_CDP_PORT=9223"
call "%ENSURE_SCRIPT%"
if errorlevel 1 (
  echo FAIL: CHROME_CDP_START
  echo NOTE: Close only the dedicated Tistory automation Chrome, then run this setup again.
  exit /b 22
)

echo PASS: NHUNNHUN_PERSISTENT_CHROME_READY
echo Chrome will NOT be auto-opened by Windows or GitHub Actions.\necho Run NHUNNHUN_TISTORY_LOGIN.cmd when you intentionally need to start or re-login.
exit /b 0
