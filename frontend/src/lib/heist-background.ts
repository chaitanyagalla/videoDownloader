export type BackgroundMissionState =
  | "IDLE"
  | "LOCKING TARGET"
  | "DOWNLOADING"
  | "MISSION COMPLETED"
  | "MISSION FAILED";

type BackgroundListener = (status: BackgroundMissionState) => void;

let currentBackgroundStatus: BackgroundMissionState = "IDLE";

const listeners = new Set<BackgroundListener>();

export function getHeistBackgroundStatus(): BackgroundMissionState {
  return currentBackgroundStatus;
}

export function setHeistBackgroundStatus(
  status: BackgroundMissionState
): void {
  currentBackgroundStatus = status;

  listeners.forEach((listener) => {
    listener(status);
  });
}

export function subscribeToHeistBackgroundStatus(
  listener: BackgroundListener
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}