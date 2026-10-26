# AI Resume Analyzer (ResuMetric AI) — Localhost Setup Guide

This ZIP package contains every project source file required to run the full-stack **AI Resume Analyzer** (React 19 + TypeScript + Tailwind CSS + Express + MongoDB + Gemini AI) on your local computer (`http://localhost:3000`).

---

## 1. Prerequisites
- **Node.js** `v18+` (or `v20+` recommended) installed on your machine (`node -v`).
- **npm** (comes with Node.js).

---

## 2. Quick Start (Run on Localhost)

1. **Extract this ZIP file** to a folder on your computer and open a terminal in that folder:
   ```bash
   cd ai-resume-analyzer-localhost
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables (Optional)**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   - `GEMINI_API_KEY`: *(Optional)* Add your Google Gemini API key for live LLM calls. All modules include built-in deterministic fallback engines so the app works out-of-the-box even without an API key.
   - `MONGODB_URI`: *(Optional)* Add a MongoDB Atlas or local `mongodb://127.0.0.1:27017` URI. When left blank, the server automatically persists collections to `.mongodb-local-collections.json`.

4. **Start the Full-Stack Development Server**:
   ```bash
   npm run dev
   ```

5. **Open in Browser**:
   Visit **[http://localhost:3000](http://localhost:3000)**

---

## 3. Included Project Structure
- `package.json` — Dependencies & scripts (`npm run dev`, `npm run build`, `npm start`)
- `server.ts` — Express + Vite full-stack server, Auth/OTP/Password Reset routes, MongoDB persistence engine, Explainable AI, Resume Refinement Assistant, Career Path Predictor, and Localhost ZIP bundler
- `index.html`, `vite.config.ts`, `tsconfig.json`, `metadata.json`, `.env.example`
- `src/main.tsx`, `src/index.css`, `src/types.ts`, `src/App.tsx`
- `src/components/DashboardScreen.tsx` — Candidate Dashboard, Daily Resume Goal circle, Performance Overview chart, & Auth Portal
- `src/components/UploadResumeScreen.tsx` — PDF/DOCX/TXT resume uploader & parser
- `src/components/AnalysisResultScreen.tsx` — 100-Point ATS Diagnostic, Explainable AI (XAI), & AI Resume Refinement Assistant
- `src/components/JobMatcherScreen.tsx` — Role Matcher, Market Salary Insights chart, & AI Career Path Predictor
- `src/components/InterviewMockSimulator.tsx` — AI Technical & Behavioral Mock Interview Simulator
- `src/components/HistoryScreen.tsx` — Strict per-user isolated upload history & MongoDB Document Explorer
- `src/components/AuthResetCenterScreen.tsx` — Full-screen Sign In, Registration, & Direct Password Reset
