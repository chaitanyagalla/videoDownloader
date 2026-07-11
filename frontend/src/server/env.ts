function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function positiveInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  appUrl: optional("APP_URL") ?? optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  authCookieName: optional("AUTH_COOKIE_NAME") ?? "videosave_session",
  authSessionDays: positiveInt("AUTH_SESSION_DAYS", 30),
  googleClientId: optional("GOOGLE_CLIENT_ID"),
  googleClientSecret: optional("GOOGLE_CLIENT_SECRET"),
  googleCallbackUrl: optional("GOOGLE_CALLBACK_URL"),
  maxDownloadMb: positiveInt("MAX_DOWNLOAD_FILESIZE_MB", 500),
  maxDurationSeconds: positiveInt("MAX_VIDEO_DURATION_SECONDS", 3600),
  ytdlpProxy: optional("YTDLP_PROXY"),
  ytdlpCookies: optional("YTDLP_COOKIES"),
  ytdlpCookiesBase64: optional("YTDLP_COOKIES_BASE64"),
};
