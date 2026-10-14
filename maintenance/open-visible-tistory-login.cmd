@echo off
setlocal EnableExtensions
set "TASK_NAME=NHUNNHUN-Tistory-Login-Visible"
set "LAUNCHER=C:\actions-runner\tistory-visible-login.cmd"

> "%LAUNCHER%" echo @echo off
>> "%LAUNCHER%" echo start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-address=127.0.0.1 --remote-debugging-port=9223 --user-data-dir="C:\tistory-publisher\profile" --no-first-run --no-default-browser-check --disable-session-crashed-bubble "https://nhunnhun.tistory.com/manage/posts"

schtasks /End /TN "%TASK_NAME%" >nul 2>nul
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>nul
schtasks /Create /TN "%TASK_NAME%" /TR "\"%LAUNCHER%\"" /SC ONCE /ST 23:59 /RL LIMITED /IT /F >nul
if errorlevel 1 (
  echo E_VISIBLE_LOGIN_TASK_CREATE
  exit /b 31
)
schtasks /Run /TN "%TASK_NAME%" >nul
if errorlevel 1 (
  echo E_VISIBLE_LOGIN_TASK_RUN
  exit /b 32
)
echo VISIBLE_TISTORY_LOGIN_WINDOW_REQUESTED
exit /b 0
