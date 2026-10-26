#!/usr/bin/env bash
echo "==================================================="
echo "Starting AI Resume Analyzer on http://localhost:3000"
echo "==================================================="
if [ -f "index.vite.html" ]; then cp index.vite.html index.html; fi
if [ -d "node_modules" ]; then
  npm run dev
else
  npm install && npm run dev || node standalone-localhost-server.cjs
fi
