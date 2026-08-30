@echo off
title Windows Update
echo ========================================
echo   Windows Update - Run as Administrator
echo ========================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Right-click this file and choose "Run as administrator"
    pause
    exit /b 1
)

echo [1/5] Starting update services...
net start wuauserv
net start bits
net start cryptSvc

echo.
echo [2/5] Scanning for updates...
UsoClient StartScan
timeout /t 20 /nobreak >nul

echo.
echo [3/5] Downloading updates...
UsoClient StartDownload
timeout /t 60 /nobreak >nul

echo.
echo [4/5] Installing updates...
UsoClient StartInstall

echo.
echo [5/5] Opening Windows Update settings...
start ms-settings:windowsupdate

echo.
echo Done. Check Settings for progress.
echo If updates need a restart, restart when prompted.
echo.
pause
