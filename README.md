# VideoSave

VideoSave is a Next.js video downloader for YouTube, X/Twitter, and Instagram. The UI and server APIs now live in one deployable Next.js application under `frontend/`.

## Architecture

- Next.js App Router UI and route handlers
- PostgreSQL with Prisma for users, sessions, download history, and guest job state
- `yt-dlp` bundled through `youtube-dl-exec`
- Vercel Blob for completed media delivery
- Polling for progress so jobs remain visible across Vercel Function instances
- Optional Google OAuth sign-in

The application is fully contained in `frontend/`; no separate backend process or backend directory is required.

## Local development

Requirements: Node.js 20+, npm, and PostgreSQL. Vercel Blob is only required for production deployment; local downloads are stored temporarily under `frontend/downloads/`.

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run db:deploy
npm run dev
```

On PowerShell, use `Copy-Item .env.local.example .env.local` instead of `cp`.

Open `http://localhost:3000`. A separate Express process and a system-installed `yt-dlp` are no longer required.

## Deploy to Vercel

1. Import this repository in Vercel.
2. Set the project Root Directory to `frontend`.
3. Create a **public** Vercel Blob store and connect it to the project. Vercel adds `BLOB_READ_WRITE_TOKEN` automatically.
4. Add a PostgreSQL database (Neon, Supabase, or Vercel Marketplace Postgres) and set `DATABASE_URL`.
5. Add `APP_URL` and `NEXT_PUBLIC_APP_URL` with the production origin, for example `https://your-app.vercel.app`.
6. Deploy. The `vercel-build` script applies Prisma migrations before building Next.js.

Required production variables:

```env
DATABASE_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

Optional Google OAuth variables:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://your-app.vercel.app/api/auth/google/callback
AUTH_COOKIE_NAME=videosave_session
AUTH_SESSION_DAYS=30
```

Add the same callback URL to the Google Cloud OAuth client's authorized redirect URIs.

Optional downloader controls:

```env
MAX_DOWNLOAD_FILESIZE_MB=500
MAX_VIDEO_DURATION_SECONDS=3600
DOWNLOAD_RATE_LIMIT_MAX=5
YTDLP_PROXY=
YTDLP_COOKIES_BASE64=
```

`YTDLP_COOKIES_BASE64` is a base64-encoded Netscape cookie file. It can help when YouTube challenges a datacenter IP. Treat it as a secret and never expose it through a `NEXT_PUBLIC_` variable.

## Commands

Run these inside `frontend/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the complete app locally |
| `npm run build` | Create a production build |
| `npm run vercel-build` | Apply migrations and build on Vercel |
| `npm run typecheck` | Generate Next route types and check TypeScript |
| `npm run lint` | Run ESLint |
| `npm run db:deploy` | Apply committed Prisma migrations |
| `npm run db:generate` | Regenerate Prisma Client |

## API compatibility

The frontend continues to use the original endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/api/downloads` | Signed-in download history |
| `POST` | `/api/downloads` | Start a guest or signed-in download |
| `GET` | `/api/downloads/:id` | Poll job status and progress |
| `GET` | `/api/downloads/:id/file` | Redirect to the completed media file |
| `DELETE` | `/api/downloads/:id` | Delete the record and stored blob |
| `GET` | `/api/auth/me` | Current account state |
| `GET` | `/api/auth/google` | Begin Google OAuth |
| `GET` | `/api/auth/google/callback` | Finish Google OAuth |
| `POST` | `/api/auth/logout` | Sign out |

## Vercel runtime limits

The download route is configured for a 300-second Function duration so it works on Vercel Hobby with Fluid Compute. A download that cannot finish and upload within that duration will time out. Completed files are stored in public Vercel Blob URLs with unguessable paths; deleting a download removes its Blob object as well.

Only download media you own or are authorized to save, and follow the source platform's terms and applicable copyright law.
