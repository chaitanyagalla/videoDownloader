import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { checkYtDlpAvailable, startJobCleanup } from './services/downloadService';
import { ensureDownloadsDir } from './utils/pathHelper';
import { ServerToClientEvents, ClientToServerEvents } from './types';

async function bootstrap(): Promise<void> {
  // ── Pre-flight checks ────────────────────────────────────────────────────
  logger.info('Running pre-flight checks...');

  try {
    const version = await checkYtDlpAvailable();
    logger.info(`✔  yt-dlp is available (${version})`);
  } catch (err) {
    logger.error('✘  yt-dlp check failed', { err });
    logger.error('   Install it from https://github.com/yt-dlp/yt-dlp#installation');
    process.exit(1);
  }

  try {
    ensureDownloadsDir();
    logger.info(`✔  Downloads directory ready: ${config.downloads.dir}`);
  } catch (err) {
    logger.error('✘  Cannot write to downloads directory', { dir: config.downloads.dir, err });
    process.exit(1);
  }

  // ── Create HTTP server with Socket.io ────────────────────────────────────
  const httpServer = createServer();
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'DELETE'],
      credentials: true,
    },
  });

  // ── Socket.io connection handling ────────────────────────────────────────
  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error', { socketId: socket.id, error });
    });
  });

  // ── Create Express app with Socket.io instance ───────────────────────────
  const app = createApp(io);
  httpServer.on('request', app);

  // ── Start background services ────────────────────────────────────────────
  startJobCleanup();

  // ── Start HTTP server ─────────────────────────────────────────────────────
  httpServer.listen(config.server.port, config.server.host, () => {
    logger.info(`🚀  Server running at http://${config.server.host}:${config.server.port}`);
    logger.info(`   Environment : ${config.env}`);
    logger.info(`   CORS origin : ${config.cors.origin}`);
    logger.info(`   Downloads   : ${config.downloads.dir}`);
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    io.disconnectSockets();
    logger.info('Socket.io clients disconnected');

    httpServer.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });

    // Force close after 10 s
    setTimeout(() => {
      logger.error('Forcefully shutting down after timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});