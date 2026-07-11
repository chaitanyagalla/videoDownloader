import { createWriteStream } from "node:fs";
import { chmod, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

if (process.platform === "linux") {
  const asset = process.arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
  const directory = path.resolve("vendor");
  const destination = path.join(directory, "yt-dlp_linux");
  const temporary = `${destination}.tmp`;
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;

  await mkdir(directory, { recursive: true });
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Unable to download ${asset}: HTTP ${response.status}`);
  }

  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    await chmod(temporary, 0o755);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }

  console.log(`Installed the standalone ${asset} executable.`);
}
