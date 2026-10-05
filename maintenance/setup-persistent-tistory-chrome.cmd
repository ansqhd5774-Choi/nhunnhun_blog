@echo off
setlocal EnableExtensions

set "CHROME_TASK=NHUNNHUN-Tistory-Chrome"
set "CHROME_WATCHDOG=NHUNNHUN-Tistory-Chrome-Watchdog"
set "RUNNER_DIR=C:\actions-runner"
set "REPO_DIR=C:\actions-runner\_work\nhunnhun_blog\nhunnhun_blog"
set "ENSURE_SCRIPT=%RUNNER_DIR%\ensure-tistory-chrome.cmd"
set "WATCH_SCRIPT=%RUNNER_DIR%\watch-tistory-chrome.cmd"

echo [1/6] prerequisite check
if not exist "%REPO_DIR%\maintenance\ensure-tistory-chrome.cmd" (
  echo FAIL: ENSURE_SCRIPT_MISSING
  exit /b 10
)
if not exist "%REPO_DIR%\maintenance\watch-tistory-chrome.cmd" (
  echo FAIL: WATCH_SCRIPT_MISSING
  exit /b 11
)
if not exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  echo FAIL: CHROME_MISSING
  exit /b 12
)

echo [2/6] persist browser environment
if not exist "C:\tistory-publisher\profile\" mkdir "C:\tistory-publisher\profile"
setx TISTORY_CHROME_PATH "C:\Program Files\Google\Chrome\Application\chrome.exe" >nul
setx TISTORY_PROFILE_DIR "C:\tistory-publisher\profile" >nul
setx TISTORY_CDP_URL "http://127.0.0.1:9223" >nul
setx TISTORY_CDP_PORT "9223" >nul

echo [3/6] install stable helper files
copy /y "%REPO_DIR%\maintenance\ensure-tistory-chrome.cmd" "%ENSURE_SCRIPT%" >nul
copy /y "%REPO_DIR%\maintenance\watch-tistory-chrome.cmd" "%WATCH_SCRIPT%" >nul

echo [4/6] create Chrome logon task
schtasks /Delete /TN "%CHROME_TASK%" /F >nul 2>nul
schtasks /Create /TN "%CHROME_TASK%" /TR "\"%ENSURE_SCRIPT%\"" /SC ONLOGON /DELAY 0000:20 /RL LIMITED /IT /F >nul
if errorlevel 1 (
  echo FAIL: CHROME_TASK_CREATE
  exit /b 20
)

echo [5/6] create Chrome watchdog
schtasks /Delete /TN "%CHROME_WATCHDOG%" /F >nul 2>nul
schtasks /Create /TN "%CHROME_WATCHDOG%" /TR "\"%WATCH_SCRIPT%\"" /SC MINUTE /MO 2 /RL LIMITED /IT /F >nul
if errorlevel 1 (
  echo FAIL: CHROME_WATCHDOG_CREATE
  exit /b 21
)

echo [6/6] start persistent Chrome
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
echo Chrome stays alive and is restarted by Windows if it exits.
echo Next: run publishing\login.mjs once and keep this dedicated Chrome open.
exit /b 0
