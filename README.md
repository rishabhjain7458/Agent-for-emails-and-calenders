# AI Executive Assistant

A multi-tenant full-stack productivity dashboard for Gmail, Google Calendar, Google Tasks, optional Outlook/Microsoft Graph support, and a Gemini-powered assistant.

## Stack

- Frontend: React, Vite, React Router, Material UI, Axios, FullCalendar
- Backend: Node.js, Express.js, TypeScript
- Database: PostgreSQL migrations
- Auth: Google OAuth 2.0 and optional Microsoft OAuth with refresh-token support
- Integrations: Gmail API, Google Calendar API, Google Tasks API, Microsoft Graph, Gemini API

## Project Structure

```text
ai-executive-assistant/
  backend/
    migrations/
    src/
      config/
      controllers/
      middleware/
      repositories/
      routes/
      services/
      utils/
  frontend/
    src/
      api/
      components/
      contexts/
      layouts/
      pages/
      router/
      theme/
```

## Multi-Tenant Model

The app is multi-tenant from day one:

- Every user belongs to a tenant through `tenant_memberships`.
- Tenant-owned tables include `tenant_id`.
- Protected API requests derive `tenantId` from the signed session token.
- Backend repositories always filter by `tenant_id`.
- Google tokens are stored per user, while drafts, tasks, conversations, and settings are tenant-scoped.

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

Create a Google OAuth client and set the redirect URI to:

```text
http://localhost:4000/api/auth/google/callback
```

Required scopes are configured in `backend/src/config/google.ts`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Hosting

The app supports two deployment styles.

### Option A: One Hosted Service

Use this when your platform can run one Node service, such as Render, Railway, Fly.io, or a VM.

Build command:

```bash
npm install
npm run build
npm run migrate:prod
```

Start command:

```bash
npm start
```

In production, Express serves the built React app from `frontend/dist` and the API from `/api`.

Set backend environment variables:

```text
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-app.example.com
DATABASE_URL=postgres://...
JWT_SECRET=replace-with-long-random-secret
TOKEN_ENCRYPTION_KEY=replace-with-long-random-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-app.example.com/api/auth/google/callback
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

If you use Microsoft OAuth, also set:

```text
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_REDIRECT_URI=https://your-app.example.com/api/auth/microsoft/callback
```

Do not set `VITE_API_URL` for one-service hosting unless your API is on a different domain. The frontend defaults to same-origin `/api`.

### Option B: Split Frontend And Backend

Use this when the frontend is hosted separately, such as Vercel/Netlify plus a backend service.

Frontend build command:

```bash
npm run build -w frontend
```

Frontend environment:

```text
VITE_API_URL=https://your-api.example.com/api
```

Backend build command:

```bash
npm run build -w backend
npm run migrate:prod -w backend
```

Backend start command:

```bash
npm run start -w backend
```

Backend environment:

```text
NODE_ENV=production
FRONTEND_URL=https://your-frontend.example.com
GOOGLE_REDIRECT_URI=https://your-api.example.com/api/auth/google/callback
MICROSOFT_REDIRECT_URI=https://your-api.example.com/api/auth/microsoft/callback
```

`FRONTEND_URL` can contain multiple comma-separated origins if needed.

### 3. PostgreSQL

Create a database, then set `DATABASE_URL` in `backend/.env`.

Example:

```text
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ai_executive_assistant
```

## Security Notes

- OAuth access and refresh tokens are encrypted at rest.
- Email sending is never automatic. Draft replies must be edited or approved by the user before send.
- Calendar conflicts require explicit confirmation before creating overlapping events.
- API routes are protected by JWT sessions.
- Never expose OAuth client secrets in frontend environment variables.
- Register production OAuth redirect URIs before deploying publicly.

## API Surface

- `/api/auth/*`
- `/api/emails/*`
- `/api/calendar/*`
- `/api/tasks/*`
- `/api/assistant/*`
- `/api/settings/*`

## Development Commands

Backend:

```bash
npm run dev
npm run build
npm run migrate
```

Frontend:

```bash
npm run dev
npm run build
npm run preview
```

Root:

```bash
npm run build
npm run migrate
npm run migrate:prod
npm start
```
