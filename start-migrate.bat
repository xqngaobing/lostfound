@echo off
setlocal
set ROOT=%~dp0
powershell -ExecutionPolicy Bypass -File "%ROOT%start-migrate.ps1"
endlocal
