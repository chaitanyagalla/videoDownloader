// src/lib/api.ts
import axios, { AxiosError, AxiosInstance } from "axios";
import {
  ApiSuccessResponse,
  ApiErrorResponse,
  AuthUser,
  DownloadRecord,
} from "@/types";

// ─── Axios Instance ────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: undefined,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

const apiBaseUrl = "";

// ─── Error Normalisation ───────────────────────────────────────────────────

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function normalizeError(error: unknown): never {
  if (error instanceof AxiosError && error.response) {
    const body = error.response.data as ApiErrorResponse;
    throw new ApiClientError(
      body?.error?.message ?? "An error occurred",
      body?.error?.code ?? "UNKNOWN",
      error.response.status,
      body?.error?.details
    );
  }

  if (error instanceof AxiosError && error.request) {
    throw new ApiClientError(
      "Cannot reach the application server. Please try again.",
      "NETWORK_ERROR",
      0
    );
  }

  throw error;
}

// ─── API Functions ─────────────────────────────────────────────────────────

export async function fetchDownloads(): Promise<DownloadRecord[]> {
  try {
    const res = await apiClient.get<ApiSuccessResponse<DownloadRecord[]>>(
      "/api/downloads"
    );
    return res.data.data;
  } catch (err) {
    normalizeError(err);
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await apiClient.get<ApiSuccessResponse<AuthUser | null>>(
      "/api/auth/me"
    );
    return res.data.data;
  } catch (err) {
    normalizeError(err);
  }
}

export function getGoogleSignInUrl(): string {
  return `${apiBaseUrl}/api/auth/google`;
}

export async function logoutCurrentUser(): Promise<void> {
  try {
    await apiClient.post("/api/auth/logout");
  } catch (err) {
    normalizeError(err);
  }
}

export async function fetchDownloadById(id: string): Promise<DownloadRecord> {
  try {
    const res = await apiClient.get<ApiSuccessResponse<DownloadRecord>>(
      `/api/downloads/${id}`
    );
    return res.data.data;
  } catch (err) {
    normalizeError(err);
  }
}

export async function startDownload(url: string): Promise<DownloadRecord> {
  try {
    const res = await apiClient.post<ApiSuccessResponse<DownloadRecord>>(
      "/api/downloads",
      { url }
    );
    return res.data.data;
  } catch (err) {
    normalizeError(err);
  }
}

export async function deleteDownload(id: string): Promise<void> {
  try {
    await apiClient.delete(`/api/downloads/${id}`);
  } catch (err) {
    normalizeError(err);
  }
}

export async function downloadFile(id: string): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const link = document.createElement("a");
  link.href = `${apiBaseUrl}/api/downloads/${encodeURIComponent(id)}/file`;
  link.download = `videosave-${id}.mp4`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
