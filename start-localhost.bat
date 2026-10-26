@echo off
echo ===================================================
echo Starting AI Resume Analyzer on http://localhost:3000
echo ===================================================
if exist index.vite.html copy /Y index.vite.html index.html >nul
if exist node_modules (
  call npm run dev
) else (
  echo Installing dependencies and starting full-stack server...
  call npm install && call npm run dev || node standalone-localhost-server.cjs
)
pause
