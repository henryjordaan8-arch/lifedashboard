@echo off
rem Double-click once to log in to Garmin (Windows).
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (py -3 start.py --login) else (python start.py --login)
pause
