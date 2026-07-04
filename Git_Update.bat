@echo off
setlocal

git add .
if errorlevel 1 goto error

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Updated site"
  if errorlevel 1 goto error
) else (
  echo No changes to commit.
)

git push
if errorlevel 1 goto error

echo Done.
pause
exit /b 0

:error
echo Git update failed.
pause
exit /b 1
