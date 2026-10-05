@echo off
setlocal
set "TASK_NAME=NHUNNHUN-Tistory-Runner"
set "RUNNER_DIR=C:\actions-runner"

if exist "%RUNNER_DIR%\maintenance.stop" exit /b 0
if not exist "%RUNNER_DIR%\.runner" exit /b 10

tasklist /fi "IMAGENAME eq Runner.Listener.exe" /fo CSV /nh | find /i "Runner.Listener.exe" >nul
if not errorlevel 1 exit /b 0

schtasks /Run /TN "%TASK_NAME%" >nul 2>nul
exit /b %ERRORLEVEL%
