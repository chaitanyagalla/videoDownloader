"use client";

import { useEffect } from "react";
import {
  setHeistBackgroundStatus,
  type BackgroundMissionState,
} from "@/lib/heist-background";

type BackgroundStateBridgeProps = {
  status: BackgroundMissionState;
};

export default function BackgroundStateBridge({
  status,
}: BackgroundStateBridgeProps) {
  useEffect(() => {
    setHeistBackgroundStatus(status);
  }, [status]);

  useEffect(() => {
    return () => {
      setHeistBackgroundStatus("IDLE");
    };
  }, []);

  return null;
}