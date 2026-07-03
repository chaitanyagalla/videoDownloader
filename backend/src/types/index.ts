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
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface CreateDownloadInput {
  url: string;
}

export interface ProgressUpdate {
  id: string;
  progress: number;
  speed: string | null;
  eta: string | null;
}

export interface CompletionUpdate {
  id: string;
  filePath: string;
  fileSize: string | null;
}

export interface FailureUpdate {
  id: string;
  error: string;
}

export interface TitleUpdate {
  id: string;
  title: string;
}

// Socket.io event map (Server → Client)
export interface ServerToClientEvents {
  "download:progress": (data: ProgressUpdate) => void;
  "download:title": (data: TitleUpdate) => void;
  "download:completed": (data: CompletionUpdate) => void;
  "download:failed": (data: FailureUpdate) => void;
}

// Socket.io event map (Client → Server)
export interface ClientToServerEvents {
  "subscribe:download": (id: string) => void;
  "unsubscribe:download": (id: string) => void;
}

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}
