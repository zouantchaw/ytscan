FROM node:23-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    dumb-init \
    ffmpeg \
    python3 \
    python3-pip \
  && python3 -m pip install --no-cache-dir --break-system-packages yt-dlp \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/scripts/package.json ./packages/scripts/package.json

RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV SCAN_POLL_INTERVAL_SECONDS=15
ENV SCAN_DOWNLOAD_PROGRESS_SECONDS=10
ENV MEDIA_POLL_INTERVAL_SECONDS=15
ENV MEDIA_HEARTBEAT_INTERVAL_SECONDS=60
ENV PREVIS_SCENE_DURATION_SECONDS=5

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "worker:run"]
