# VideoSave - Video Downloader

VideoSave is a full-stack video downloader for YouTube, X/Twitter, and Instagram links. Paste or drag in a supported URL, start the download, watch live progress updates, and receive the final file through the browser on the user's device.

The project is split into a Next.js frontend and an Express/TypeScript backend. Downloads are handled by `yt-dlp`, realtime updates are delivered with Socket.io, and download/account records are stored with Prisma. Completed media files are treated as temporary backend files: the browser downloads them through `/api/downloads/:id/file`, then the backend removes the temporary copy.

## Features

- Download videos from supported social platforms using `yt-dlp`
- Live progress, speed, ETA, completion, and failure events
- Browser delivery endpoint so completed files are saved on the user's device
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
YTDLP_COOKIES_FILE=
YTDLP_COOKIES_FROM_BROWSER=
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=20
```

Google OAuth values are optional for basic guest downloads. Add them when you want account sign-in.

If YouTube returns a "Sign in to confirm you're not a bot" error, provide cookies to `yt-dlp`. For local development, set `YTDLP_COOKIES_FROM_BROWSER=firefox`, `chrome`, `edge`, or another supported browser name, then restart the backend. The browser named in `.env` must be signed in to YouTube; it does not have to be the same browser used to open the app. On Windows, Chrome and Edge may lock their cookie database while running, so close them before downloading or use Firefox. For the most reliable setup, export a Netscape-format cookie file and set `YTDLP_COOKIES_FILE=/absolute/path/to/cookies.txt`.

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
| `GET` | `/api/downloads/:id/file` | Send completed file to the user's device |
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
