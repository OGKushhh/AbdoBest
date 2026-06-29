@echo off
echo Updating package-lock.json only...
npm install --package-lock-only --legacy-peer-deps
echo Done.
pause