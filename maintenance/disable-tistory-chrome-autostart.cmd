@echo off
setlocal EnableExtensions

net session >nul 2>nul
if errorlevel 1 (
  echo FAIL: ADMIN_REQUIRED
  echo Right-click this CMD file and choose "Run as administrator".
  pause
  exit /b 5
)

schtasks /End /TN "NHUNNHUN-Tistory-Chrome" >nul 2>nul
schtasks /End /TN "NHUNNHUN-Tistory-Chrome-Watchdog" >nul 2>nul
schtasks /Delete /TN "NHUNNHUN-Tistory-Chrome" /F >nul 2>nul
schtasks /Delete /TN "NHUNNHUN-Tistory-Chrome-Watchdog" /F >nul 2>nul

schtasks /Query /TN "NHUNNHUN-Tistory-Chrome" >nul 2>nul
if not errorlevel 1 (
  echo FAIL: CHROME_LOGON_TASK_STILL_EXISTS
  pause
  exit /b 21
)

schtasks /Query /TN "NHUNNHUN-Tistory-Chrome-Watchdog" >nul 2>nul
if not errorlevel 1 (
  echo FAIL: CHROME_WATCHDOG_TASK_STILL_EXISTS
  pause
  exit /b 22
)

if exist "C:\actions-runner\watch-tistory-chrome.cmd" del /q "C:\actions-runner\watch-tistory-chrome.cmd" >nul 2>nul

echo PASS: TISTORY_CHROME_AUTO_OPEN_DISABLED
echo The currently open Chrome window is not closed by this script.
echo You may close it manually after this PASS message.
pause
exit /b 0
