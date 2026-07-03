# VideoSave - Video Downloader

VideoSave is a full-stack video downloader for YouTube, X/Twitter, and Instagram links. Paste or drag in a supported URL, start the download, and watch live progress updates from the backend.

The project is split into a Next.js frontend and an Express/TypeScript backend. Downloads are handled by `yt-dlp`, realtime updates are delivered with Socket.io, and download/account records are stored with Prisma.

## Features

- Download videos from supported social platforms using `yt-dlp`
- Live progress, speed, ETA, completion, and failure events
- Guest download flow without sign-in
- Optional Google OAuth sign-in for saved user history
- Rate-limited backend API
- Prisma data model for users, sessions, and downloads
- Responsive Next.js UI with Tailwind CSS

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL with Prisma ORM |
| Realtime | Socket.io |
| Downloader | yt-dlp |
| Validation | Zod |

## Prerequisites

- Node.js 18 or later
- npm
- PostgreSQL database, such as Neon
- `yt-dlp` installed locally

Install `yt-dlp`:

| OS | Command |
| --- | --- |
| Windows | `winget install yt-dlp` |
| macOS | `brew install yt-dlp` |
| Linux | `sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp` |

## Project Structure

```text
video-downloader/
|-- backend/
|   |-- prisma/
|   |   |-- migrations/
|   |   `-- schema.prisma
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middleware/
|   |   |-- models/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- types/
|   |   |-- utils/
|   |   |-- app.ts
|   |   `-- server.ts
|   |-- .env.example
|   |-- package.json
|   `-- tsconfig.json
|-- frontend/
|   |-- src/
|   |   |-- app/
|   |   |-- components/
|   |   |-- hooks/
|   |   |-- lib/
|   |   |-- services/
|   |   |-- types/
|   |   `-- utils/
|   |-- .env.local.example
|   |-- package.json
|   `-- tsconfig.json
|-- .gitignore
`-- README.md
```

## Environment Variables

### Backend

Create `backend/.env` from `backend/.env.example`.

```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/videosave?sslmode=require"
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
AUTH_COOKIE_NAME=videosave_session
AUTH_SESSION_DAYS=30
YTDLP_PATH=yt-dlp
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=20
```

Google OAuth values are optional for basic guest downloads. Add them when you want account sign-in.

### Frontend

Create `frontend/.env` or `frontend/.env.local` from `frontend/.env.local.example`.

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

## Local Setup

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Configure the backend

```bash
cp .env.example .env
npx prisma generate
npx prisma migrate dev
```

On Windows PowerShell, use this copy command instead:

```powershell
Copy-Item .env.example .env
```

### 3. Start the backend

```bash
npm run dev
```

The backend runs at `http://localhost:4000`.

### 4. Install frontend dependencies

Open a second terminal:

```bash
cd frontend
npm install
```

### 5. Configure the frontend

```bash
cp .env.local.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

### 6. Start the frontend

```bash
npm run dev
```

The frontend runs at `http://localhost:3000`.

## Available Scripts

### Backend

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Express server in development mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled backend |
| `npm run typecheck` | Run TypeScript checks without emitting files |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Run Prisma development migrations |
| `npm run prisma:studio` | Open Prisma Studio |

### Frontend

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the production frontend |
| `npm start` | Start the production Next.js server |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run Next.js linting |

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/api/downloads` | List downloads |
| `GET` | `/api/downloads/:id` | Get one download |
| `POST` | `/api/downloads` | Start a download |
| `DELETE` | `/api/downloads/:id` | Remove a download |
| `GET` | `/api/auth/me` | Get current auth state |
| `GET` | `/api/auth/google` | Start Google OAuth |
| `GET` | `/api/auth/google/callback` | Handle Google OAuth callback |
| `POST` | `/api/auth/logout` | Sign out |

Example download request:

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

## Socket.io Events

Server to client:

| Event | Payload |
| --- | --- |
| `download:progress` | `{ id, progress, speed, eta }` |
| `download:title` | `{ id, title }` |
| `download:completed` | `{ id, filePath, fileSize }` |
| `download:failed` | `{ id, error }` |

Client to server:

| Event | Payload |
| --- | --- |
| `subscribe:download` | `downloadId` |
| `unsubscribe:download` | `downloadId` |

## GitHub Push Checklist

Before pushing, make sure these files stay local and are not committed:

- `node_modules/`
- `.next/`
- `dist/`
- `.env` and `.env.local`
- local logs
- local database files
- downloaded videos and temporary files

This repository already includes a `.gitignore` for those files.

Typical first push:

```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

If the remote is already added, use:

```bash
git push -u origin main
```

## License

Add a license before publishing if you want others to reuse or contribute to this project.
