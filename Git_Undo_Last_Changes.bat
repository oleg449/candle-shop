@echo off
setlocal

echo What do you want to undo?
echo.
echo 1 - Undo uncommitted file changes only
echo 2 - Undo last commit, keep changes in files
echo 3 - Undo last commit and delete its changes
echo.
set /p choice="Choose 1, 2, or 3: "

if "%choice%"=="1" goto undo_worktree
if "%choice%"=="2" goto undo_commit_soft
if "%choice%"=="3" goto undo_commit_hard

echo Invalid choice.
pause
exit /b 1

:undo_worktree
echo.
echo This will discard uncommitted changes in tracked files.
set /p confirm="Type YES to continue: "
if /i not "%confirm%"=="YES" goto cancelled
git restore .
if errorlevel 1 goto error
echo Done.
pause
exit /b 0

:undo_commit_soft
echo.
echo This will remove the last commit, but keep its changes in your files.
set /p confirm="Type YES to continue: "
if /i not "%confirm%"=="YES" goto cancelled
git reset --soft HEAD~1
if errorlevel 1 goto error
echo Done.
pause
exit /b 0

:undo_commit_hard
echo.
echo WARNING: This will remove the last commit and delete its file changes.
set /p confirm="Type DELETE to continue: "
if /i not "%confirm%"=="DELETE" goto cancelled
git reset --hard HEAD~1
if errorlevel 1 goto error
echo Done.
pause
exit /b 0

:cancelled
echo Cancelled.
pause
exit /b 0

:error
echo Git undo failed.
pause
exit /b 1
