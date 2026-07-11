/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["youtube-dl-exec", "ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/downloads": [
      "./node_modules/youtube-dl-exec/bin/**",
      "./node_modules/ffmpeg-static/**",
    ],
  },
};

module.exports = nextConfig;
