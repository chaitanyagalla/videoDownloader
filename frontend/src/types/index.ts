// src/types/index.ts

export type Platform =
  | "youtube"
  | "twitter"
  | "instagram"
  | "unknown";

export type DownloadStatus =
  | "pending"
  | "downloading"
  | "completed"
  | "failed";

export interface DownloadRecord {
  id: string;
  url: string;
  platform: Platform;
  title: string | null;
  status: DownloadStatus;
  progress: number;
  speed: string | null;
  eta: string | null;
  filePath: string | null;
  fileSize: string | null;
  errorMsg: string | null;
  createdAt: string; // ISO string from API
  updatedAt: string;
}

// ─── API Response Shapes ───────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Socket.io Events ──────────────────────────────────────────────────────

export interface ProgressEvent {
  id: string;
  progress: number;
  speed: string | null;
  eta: string | null;
}

export interface TitleEvent {
  id: string;
  title: string;
}

export interface CompletedEvent {
  id: string;
  filePath: string;
  fileSize: string | null;
}

export interface FailedEvent {
  id: string;
  error: string;
}

// ─── UI State ──────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}


// ─── SSE Types ─────────────────────────────────────────────────────────────

export type SseEventType =
  | "connected"
  | "info"
  | "progress"
  | "status"
  | "completed"
  | "error"
  | "heartbeat";

export interface SseEvent<T = unknown> {
  jobId: string;
  type: SseEventType;
  data: T;
}

// ─── Video Info ────────────────────────────────────────────────────────────

export interface VideoInfo {
  title: string;
  thumbnail: string | null;
  duration: number | null;      // seconds
  uploader: string | null;
  viewCount: number | null;
  description: string | null;
}

// ─── Download Progress ─────────────────────────────────────────────────────

export interface DownloadProgress {
  percent: number;              // 0–100
  speed: string | null;         // e.g. "1.23MiB/s"
  eta: string | null;           // e.g. "00:42"
  downloaded: string | null;    // e.g. "10.23MiB"
  total: string | null;         // e.g. "24.50MiB"
}

// ─── Download Job ──────────────────────────────────────────────────────────

export interface DownloadJob {
  jobId: string;
  url: string;
  platform: Platform;
  status: DownloadStatus;
  createdAt: string;
}

// ─── Download Entry (UI state — one card in the list) ──────────────────────

export interface DownloadEntry {
  id: string;
  url: string;
  displayUrl: string;
  platform: Platform;
  status: DownloadStatus | "queued";
  progress: DownloadProgress;
  info: VideoInfo | null;
  outputPath: string | null;
  filename: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
