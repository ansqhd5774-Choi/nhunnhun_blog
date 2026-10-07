@echo off
setlocal
cd /d "%~dp0.."
set "WRITER_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%WRITER_NODE%" set "WRITER_NODE=node"
if "%~1"=="" (
  "%WRITER_NODE%" authoring\ollama.mjs carnosic-acid-232-rewrite
) else (
  "%WRITER_NODE%" authoring\ollama.mjs "%~1"
)
if errorlevel 1 (
  echo FAILED: Stop. Do not retry before checking the error and checkpoint.
) else (
  echo DONE: Draft only. Review images and R1 before any Tistory update.
)
pause
