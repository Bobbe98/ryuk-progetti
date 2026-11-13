@echo off
rem Avvia vram.ps1 senza dover cambiare la ExecutionPolicy di PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vram.ps1" %*
