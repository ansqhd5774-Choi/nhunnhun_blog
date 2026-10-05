@echo off
setlocal EnableExtensions

net session >nul 2>nul
if errorlevel 1 (
  echo FAIL: ADMIN_REQUIRED
  echo Right-click this CMD file and choose "Run as administrator".
  pause
  exit /b 5
)

set "TASK_NAME=NHUNNHUN-Tistory-Runner-Watchdog"
set "WATCHDOG_SCRIPT=C:\actions-runner\nhunnhun-watchdog.cmd"

if not exist "%WATCHDOG_SCRIPT%" (
  echo FAIL: WATCHDOG_SCRIPT_MISSING
  echo Expected: %WATCHDOG_SCRIPT%
  pause
  exit /b 10
)

schtasks /End /TN "%TASK_NAME%" >nul 2>nul
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>nul

schtasks /Create /TN "%TASK_NAME%" /TR "\"%WATCHDOG_SCRIPT%\"" /SC MINUTE /MO 2 /RL LIMITED /F >nul
if errorlevel 1 (
  echo FAIL: WATCHDOG_TASK_CREATE
  pause
  exit /b 20
)

schtasks /Query /TN "%TASK_NAME%" >nul 2>nul
if errorlevel 1 (
  echo FAIL: WATCHDOG_TASK_QUERY
  pause
  exit /b 21
)

echo PASS: NHUNNHUN_RUNNER_WATCHDOG_HIDDEN
echo The 2-minute runner watchdog remains enabled, but it no longer runs interactively.
echo Flashing CMD windows should stop.
pause
exit /b 0
