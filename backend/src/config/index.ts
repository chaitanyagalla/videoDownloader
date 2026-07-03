import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getDownloadsDir(): string {
  // Respect explicit override from .env; otherwise use OS default
  if (process.env['DOWNLOADS_DIR']) {
    return process.env['DOWNLOADS_DIR'];
  }

  const platform = os.platform();

  if (platform === 'win32') {
    // Windows: C:\Users\<user>\Downloads
    return path.join(os.homedir(), 'Downloads');
  }

  if (platform === 'darwin') {
    // macOS: ~/Downloads
    return path.join(os.homedir(), 'Downloads');
  }

  // Linux / other UNIX
  return path.join(os.homedir(), 'Downloads');
}

export const config = {
  env: requireEnv('NODE_ENV', 'development') as 'development' | 'production' | 'test',

  server: {
    port: parseInt(requireEnv('PORT', '4000'), 10),
    host: requireEnv('HOST', '0.0.0.0'),
  },

  cors: {
    origin: requireEnv('CORS_ORIGIN', 'http://localhost:3000'),
  },

  rateLimit: {
    windowMs: parseInt(requireEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    max: parseInt(requireEnv('RATE_LIMIT_MAX', '10'), 10),
  },

  downloads: {
    dir: getDownloadsDir(),
    // Max concurrent downloads running at once
    maxConcurrent: parseInt(requireEnv('MAX_CONCURRENT_DOWNLOADS', '3'), 10),
    // Seconds before a completed/failed job is auto-removed from memory
    jobTtlSeconds: parseInt(requireEnv('JOB_TTL_SECONDS', '3600'), 10),
  },

  sse: {
    heartbeatIntervalMs: parseInt(requireEnv('SSE_HEARTBEAT_MS', '15000'), 10),
  },

  logging: {
    level: requireEnv('LOG_LEVEL', 'info'),
  },
} as const;
