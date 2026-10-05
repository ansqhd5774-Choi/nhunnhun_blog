@echo off
setlocal
if not defined TISTORY_RUNNER_DIR set "TISTORY_RUNNER_DIR=C:\actions-runner"
if exist "%TISTORY_RUNNER_DIR%\maintenance.stop" exit /b 0
call "%~dp0ensure-tistory-chrome.cmd"
exit /b %ERRORLEVEL%
