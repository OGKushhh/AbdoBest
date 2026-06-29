@echo off
echo =============================================
echo   Updating package-lock.json (lock‑only)
echo =============================================
echo.

echo Running: npm install --package-lock-only --legacy-peer-deps
npm install --package-lock-only --legacy-peer-deps

echo.
echo Command finished with exit code: %errorlevel%
echo.
pause