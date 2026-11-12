@echo off
title Trace by MITE - Localhost Server
cd /d "%~dp0"
start "" "http://localhost:8080/"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080

