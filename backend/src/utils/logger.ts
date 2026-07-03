// src/utils/logger.ts
import winston from "winston";
import path from "path";
import fs from "fs";

const LOG_DIR = path.join(process.cwd(), "logs");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr =
      Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : "";
    return `${ts} [${level}] ${stack ?? message}${metaStr}`;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(LOG_DIR, "error.log"),
      level: "error",
      format: prodFormat,
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, "combined.log"),
      format: prodFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, "exceptions.log"),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, "rejections.log"),
    }),
  ],
});
