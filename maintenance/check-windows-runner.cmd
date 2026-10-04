@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (echo NODE_MISSING) else (echo NODE_PRESENT)
where pnpm >nul 2>nul
if errorlevel 1 (echo PNPM_MISSING) else (echo PNPM_PRESENT)
if defined TISTORY_CHROME_PATH (if exist "%TISTORY_CHROME_PATH%" (echo CHROME_PRESENT) else (echo CHROME_MISSING)) else (echo CHROME_ENV_MISSING)
if defined TISTORY_PROFILE_DIR (if exist "%TISTORY_PROFILE_DIR%\" (echo PROFILE_PRESENT) else (echo PROFILE_MISSING)) else (echo PROFILE_ENV_MISSING)
if not defined TISTORY_RUNNER_DIR set "TISTORY_RUNNER_DIR=C:\actions-runner"
if exist "%TISTORY_RUNNER_DIR%\.runner" (echo RUNNER_CONFIG_PRESENT) else (echo RUNNER_CONFIG_MISSING)
if exist "%TISTORY_RUNNER_DIR%\.service" (echo RUNNER_SERVICE_CONFIG_PRESENT) else (echo RUNNER_SERVICE_CONFIG_ABSENT)
tasklist /fi "IMAGENAME eq Runner.Listener.exe" /fo CSV /nh | find /i "Runner.Listener.exe" >nul
if errorlevel 1 (echo RUNNER_LISTENER_ABSENT) else (echo RUNNER_LISTENER_PRESENT)
sc query type= service state= all | findstr /i "actions.runner" >nul
if errorlevel 1 (echo RUNNER_SERVICE_ABSENT) else (echo RUNNER_SERVICE_PRESENT)
curl.exe --fail --silent --head --connect-timeout 10 https://github.com >nul 2>nul
if errorlevel 1 (echo NETWORK_UNREACHABLE) else (echo NETWORK_BASIC_PASS)
echo QUEUED_MUTATION_JOB = MATCHING_SELF_HOSTED_RUNNER_NOT_ASSIGNED
endlocal
