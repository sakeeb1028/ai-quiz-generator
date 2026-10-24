# AI Quiz Generator

React, TypeScript, and Vite frontend with a TypeScript/Express API. Gemini is called only by the backend through Google's `@google/genai` SDK. The client uses same-origin `/api/...` requests; Vite proxies them to Express in local development.

## Local setup

Requirements: Node.js 20+ and npm 10+.

```powershell
npm install
Copy-Item .env.example server/.env
npm run dev
```

Set `GEMINI_API_KEY` in `server/.env`. The app runs at <http://localhost:5173> and the API at <http://localhost:3001>. Locally, the server creates a temporary quiz-session encryption key if `QUIZ_SESSION_SECRET` is omitted; active quizzes expire if the server restarts.

Run validation and production builds with:

```powershell
npm test
npm run build
```

## Deploy one app to Vercel

The repository is configured as one Vercel project: Vite output is served as a static site from `client/dist`, and `/api/*` is handled by an Express Node.js Function. Vercel does not run a persistent Express listener; the Express app is exported from `server/src/index.ts` through the standard `api/index.ts` function entry. Quiz state is encrypted into an opaque, authenticated session token so submission can be handled by another serverless invocation without a database. The browser never receives plaintext answer keys.

1. Push the project to a Git provider and import that repository in Vercel.
2. Set **Root Directory** to the repository root. Keep **Include source files outside of the Root Directory** enabled if the project is in a monorepo.
3. Use these project build settings (also recorded in `vercel.json`):
   - Framework preset: **Other** (or Vite if Vercel detects it; preserve the explicit commands below).
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `client/dist`
   - Node.js version: **22.x**
4. In **Project Settings → Environment Variables**, add the following for Production and Preview (and Development if using `vercel dev`):
   - `GEMINI_API_KEY`: your Gemini API key.
   - `GEMINI_MODEL`: `gemini-3.1-flash-lite` (or another model you have verified is available to your account).
   - `QUIZ_SESSION_SECRET`: a private random secret with at least 32 characters. Generate one locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Do not use the example placeholder.
   - `QUIZ_GENERATION_MODE`: `gemini`.
5. Deploy. Vercel assigns one public URL for both the frontend and `/api` routes. No CORS origin setting is needed for same-origin traffic; `CLIENT_ORIGIN` is only used for local development.

`GEMINI_MODEL` defaults to `gemini-3.1-flash-lite`. Check Google's [model list](https://ai.google.dev/gemini-api/docs/models) and [pricing page](https://ai.google.dev/gemini-api/docs/pricing) for current model IDs, Free Tier status, and your account's quotas before changing it. Model access can vary by account and region.

`vercel.json` first rewrites `/api/:path*` to the shared `api/index.ts` Function while carrying the original API path to Express. The later SPA fallback excludes `/api/*`, so frontend routes cannot consume API requests. The Function is configured for up to 60 seconds. The generation handler retains the 10-per-minute in-process rate limit; serverless instances do not share memory, so configure Vercel Firewall rate limiting on `POST /api/quizzes` as well if you need a deployment-wide limit.

## API and security

- `POST /api/quizzes` validates topic (2–80 characters), difficulty, and count (5, 10, or 15), then returns questions without correct indexes or explanations.
- Gemini structured output is strictly validated. Scores and explanations come from the decrypted server-authenticated quiz state, never from client-supplied scores or correct answers.
- Quiz sessions are encrypted with AES-256-GCM and expire after one hour. Set `QUIZ_SESSION_SECRET` consistently across Vercel environments and redeploying instances. Changing it invalidates active quizzes.
- JSON bodies are limited to 128 KB to accommodate the encrypted session on submission; schema checks still cap answer counts and values.
- Keep `.env` and `server/.env` local. They are ignored by Git. Add secrets only through Vercel's Environment Variables settings.

## Explicit demo mode

For the original hand-written sample bank, set `QUIZ_GENERATION_MODE=demo`. The app never silently substitutes demo questions when Gemini is unavailable.
