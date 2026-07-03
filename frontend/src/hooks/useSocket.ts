"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  ProgressEvent,
  TitleEvent,
  CompletedEvent,
  FailedEvent,
} from "@/types";

interface ServerToClientEvents {
  "download:progress": (data: ProgressEvent) => void;
  "download:title": (data: TitleEvent) => void;
  "download:completed": (data: CompletedEvent) => void;
  "download:failed": (data: FailedEvent) => void;
}

interface ClientToServerEvents {
  "subscribe:download": (id: string) => void;
  "unsubscribe:download": (id: string) => void;
}

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface SocketEventHandlers {
  onProgress?: (data: ProgressEvent) => void;
  onTitle?: (data: TitleEvent) => void;
  onCompleted?: (data: CompletedEvent) => void;
  onFailed?: (data: FailedEvent) => void;
}

let sharedSocket: AppSocket | null = null;
let socketRefCount = 0;

function getSocket(): AppSocket {
  if (!sharedSocket) {
    sharedSocket = io(
      process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000",
      {
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      }
    ) as AppSocket;
  }

  return sharedSocket;
}

export function useSocket(
  handlers: SocketEventHandlers,
  downloadIds: string[] = []
): void {
  const socket = useRef<AppSocket | null>(null);
  const handlersRef = useRef(handlers);
  const subscribedIdsRef = useRef<Set<string>>(new Set());
  const downloadIdsKey = downloadIds.join("|");

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const s = getSocket();
    socket.current = s;
    socketRefCount++;

    const onProgress = (data: ProgressEvent) =>
      handlersRef.current.onProgress?.(data);
    const onTitle = (data: TitleEvent) =>
      handlersRef.current.onTitle?.(data);
    const onCompleted = (data: CompletedEvent) =>
      handlersRef.current.onCompleted?.(data);
    const onFailed = (data: FailedEvent) =>
      handlersRef.current.onFailed?.(data);

    s.on("download:progress", onProgress);
    s.on("download:title", onTitle);
    s.on("download:completed", onCompleted);
    s.on("download:failed", onFailed);

    return () => {
      subscribedIdsRef.current.forEach((id) => {
        s.emit("unsubscribe:download", id);
      });
      subscribedIdsRef.current = new Set();

      s.off("download:progress", onProgress);
      s.off("download:title", onTitle);
      s.off("download:completed", onCompleted);
      s.off("download:failed", onFailed);

      socketRefCount--;
      if (socketRefCount <= 0) {
        s.disconnect();
        sharedSocket = null;
        socketRefCount = 0;
      }
    };
  }, []);

  useEffect(() => {
    const s = socket.current;
    if (!s) {
      return;
    }

    const nextIds = new Set(
      downloadIdsKey ? downloadIdsKey.split("|") : []
    );
    const previousIds = subscribedIdsRef.current;

    nextIds.forEach((id) => {
      if (!previousIds.has(id)) {
        s.emit("subscribe:download", id);
      }
    });

    previousIds.forEach((id) => {
      if (!nextIds.has(id)) {
        s.emit("unsubscribe:download", id);
      }
    });

    subscribedIdsRef.current = nextIds;
  }, [downloadIdsKey]);
}
