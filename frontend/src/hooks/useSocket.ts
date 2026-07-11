"use client";

import {
  ProgressEvent,
  TitleEvent,
  CompletedEvent,
  FailedEvent,
} from "@/types";

export interface SocketEventHandlers {
  onProgress?: (data: ProgressEvent) => void;
  onTitle?: (data: TitleEvent) => void;
  onCompleted?: (data: CompletedEvent) => void;
  onFailed?: (data: FailedEvent) => void;
}

export function useSocket(
  handlers: SocketEventHandlers,
  downloadIds: string[] = []
): void {
  // Vercel Functions do not provide a durable process for the previous
  // Socket.IO singleton. useDownload polls the persisted job state instead.
  void handlers;
  void downloadIds;
}
