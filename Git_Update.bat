@echo off
setlocal

git add .
if errorlevel 1 goto error

git commit -m "Updated site"
if errorlevel 1 goto error

git push
if errorlevel 1 goto error

echo Done.
pause
exit /b 0

:error
echo Git update failed.
pause
exit /b 1
