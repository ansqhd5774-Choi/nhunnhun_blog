@echo off
setlocal EnableExtensions

set "TASK_NAME=NHUNNHUN-Tistory-Runner"
set "WATCHDOG_NAME=NHUNNHUN-Tistory-Runner-Watchdog"
set "RUNNER_DIR=C:\actions-runner"
set "REPO_DIR=C:\actions-runner\_work\nhunnhun_blog\nhunnhun_blog"
set "RUNNER_SCRIPT=%RUNNER_DIR%\nhunnhun-runner.cmd"
set "WATCHDOG_SCRIPT=%RUNNER_DIR%\nhunnhun-watchdog.cmd"

echo [1/7] Prerequisite check
if not exist "%RUNNER_DIR%\.runner" (
  echo FAIL: RUNNER_CONFIG_MISSING
  exit /b 10
)
if not exist "%REPO_DIR%\maintenance\run-windows-runner.cmd" (
  echo FAIL: REPO_RUNNER_SCRIPT_MISSING
  exit /b 11
)
if not exist "%REPO_DIR%\maintenance\watch-windows-runner.cmd" (
  echo FAIL: REPO_WATCHDOG_SCRIPT_MISSING
  exit /b 12
)

echo [2/7] Persist Tistory browser paths
if not exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  echo FAIL: CHROME_MISSING
  exit /b 13
)
if not exist "C:\tistory-publisher\profile\" mkdir "C:\tistory-publisher\profile"
setx TISTORY_CHROME_PATH "C:\Program Files\Google\Chrome\Application\chrome.exe" >nul
setx TISTORY_PROFILE_DIR "C:\tistory-publisher\profile" >nul

echo [3/7] Install stable runner helper
copy /y "%REPO_DIR%\maintenance\run-windows-runner.cmd" "%RUNNER_SCRIPT%" >nul
copy /y "%REPO_DIR%\maintenance\watch-windows-runner.cmd" "%WATCHDOG_SCRIPT%" >nul

echo [4/7] Recreate logon runner task
schtasks /End /TN "%TASK_NAME%" >nul 2>nul
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>nul
schtasks /Create /TN "%TASK_NAME%" /TR "\"%RUNNER_SCRIPT%\"" /SC ONLOGON /DELAY 0000:30 /RL LIMITED /IT /F >nul
if errorlevel 1 (
  echo FAIL: RUNNER_TASK_CREATE
  exit /b 20
)

echo [5/7] Create 2-minute watchdog
schtasks /Delete /TN "%WATCHDOG_NAME%" /F >nul 2>nul
schtasks /Create /TN "%WATCHDOG_NAME%" /TR "\"%WATCHDOG_SCRIPT%\"" /SC MINUTE /MO 2 /RL LIMITED /F >nul
if errorlevel 1 (
  echo FAIL: WATCHDOG_TASK_CREATE
  exit /b 21
)

echo [6/7] Start runner once
schtasks /Run /TN "%TASK_NAME%" >nul
if errorlevel 1 (
  echo FAIL: RUNNER_TASK_START
  exit /b 22
)

echo [7/7] Verify task registration
schtasks /Query /TN "%TASK_NAME%" >nul 2>nul || (echo FAIL: RUNNER_TASK_QUERY & exit /b 23)
schtasks /Query /TN "%WATCHDOG_NAME%" >nul 2>nul || (echo FAIL: WATCHDOG_TASK_QUERY & exit /b 24)

echo PASS: NHUNNHUN_RUNNER_AUTOSTART_READY
echo NOTE: Closing the runner console may make it offline briefly, but the hidden watchdog will restart it within about 2 minutes.
echo NOTE: Tistory login helper is still only needed when the saved login session expires.
exit /b 0
