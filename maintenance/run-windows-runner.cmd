@echo off
setlocal
if not defined TISTORY_RUNNER_DIR set "TISTORY_RUNNER_DIR=C:\actions-runner"
if not exist "%TISTORY_RUNNER_DIR%\.runner" exit /b 10
if exist "%TISTORY_RUNNER_DIR%\.service" exit /b 11
if not defined TISTORY_CHROME_PATH exit /b 12
if not defined TISTORY_PROFILE_DIR exit /b 13
if not exist "%TISTORY_CHROME_PATH%" exit /b 12
if not exist "%TISTORY_PROFILE_DIR%\" exit /b 13
if exist "%TISTORY_RUNNER_DIR%\maintenance.stop" exit /b 0
cd /d "%TISTORY_RUNNER_DIR%"
rem Task scheduler IgnoreNew prevents duplicate task processes. A manual listener is never killed.
tasklist /fi "IMAGENAME eq Runner.Listener.exe" /fo CSV /nh | find /i "Runner.Listener.exe" >nul
if not errorlevel 1 exit /b 14
rem Official run.cmd launches PowerShell for Unblock-File. CMD-only uses its packaged CMD helper instead.
:retry
copy /y run-helper.cmd.template run-helper.cmd >nul
call run-helper.cmd
set "RESULT=%ERRORLEVEL%"
if exist maintenance.stop exit /b 0
if "%RESULT%"=="0" exit /b 0
if not "%RESULT%"=="1" exit /b %RESULT%
timeout /t 60 /nobreak >nul
goto retry
