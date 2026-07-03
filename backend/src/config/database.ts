// src/config/database.ts
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

declare global {
  // Prevent multiple Prisma instances in development (hot reload)
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });

  client.$on("error", (e) => {
    logger.error("Prisma error", { message: e.message, target: e.target });
  });

  client.$on("warn", (e) => {
    logger.warn("Prisma warning", { message: e.message, target: e.target });
  });

  return client;
}

export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("✅  Database connected successfully");
  } catch (error) {
    logger.error("❌  Failed to connect to database", { error });
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info("Database disconnected");
}
