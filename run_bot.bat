@echo off
title Support Bot
color 0A

echo Starting Support Bot...
echo Working directory: %~dp0
echo Time: %date% %time%
echo.

cd /d "%~dp0"
python support.py

echo.
echo Bot stopped at %time%
pause
