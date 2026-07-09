FROM node:22-trixie-slim AS deps

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

FROM deps AS build

COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate && npm run build

FROM node:22-trixie-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    ffmpeg \
    python3 \
    python3-venv \
  && rm -rf /var/lib/apt/lists/*

# Install the latest yt-dlp. YouTube changes its anti-bot measures often, so an
# outdated build starts failing with "Sign in to confirm you're not a bot".
# Rebuild this image (docker compose build --no-cache backend) periodically to
# pull a fresh yt-dlp release.
RUN python3 -m venv /opt/yt-dlp \
  && /opt/yt-dlp/bin/pip install --no-cache-dir --upgrade "yt-dlp[default]"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV YTDLP_PATH=/opt/yt-dlp/bin/yt-dlp
ENV FFMPEG_LOCATION=/usr/bin/ffmpeg
ENV DOWNLOADS_DIR=/tmp/videosave-downloads

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

RUN mkdir -p /tmp/videosave-downloads \
  && chown -R node:node /app /tmp/videosave-downloads

USER node

EXPOSE 4000

CMD ["node", "dist/server.js"]
