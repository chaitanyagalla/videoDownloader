"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

type TerminalLogsProps = {
  logs: string[];
  compact?: boolean;
};

type AnimatedLogLine = {
  id: string;
  fullText: string;
  text: string;
  isComplete: boolean;
};

const BASE_LINE_DELAY = 0.14;
const MIN_TYPING_DURATION = 0.35;
const SECONDS_PER_CHARACTER = 0.018;

function buildLogId(log: string, index: number): string {
  return `${index}-${log}`;
}

function getCommonPrefixLength(previousLogs: string[], nextLogs: string[]): number {
  const maxLength = Math.min(previousLogs.length, nextLogs.length);
  let index = 0;

  while (index < maxLength && previousLogs[index] === nextLogs[index]) {
    index += 1;
  }

  return index;
}

export default function TerminalLogs({
  logs,
  compact = false,
}: TerminalLogsProps) {
  const [renderedLogs, setRenderedLogs] = useState<AnimatedLogLine[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousLogsRef = useRef<string[]>([]);
  const activeTweensRef = useRef<gsap.core.Tween[]>([]);
  const generationRef = useRef(0);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [renderedLogs]);

  useEffect(() => {
    const clearActiveTweens = () => {
      activeTweensRef.current.forEach((tween) => tween.kill());
      activeTweensRef.current = [];
    };

    const previousLogs = previousLogsRef.current;
    const commonPrefixLength = getCommonPrefixLength(previousLogs, logs);

    clearActiveTweens();

    generationRef.current += 1;
    const currentGeneration = generationRef.current;

    setRenderedLogs(
      logs.slice(0, commonPrefixLength).map((log, index) => ({
        id: buildLogId(log, index),
        fullText: log,
        text: log,
        isComplete: true,
      }))
    );

    let totalDelay = 0;

    logs.slice(commonPrefixLength).forEach((fullText, localIndex) => {
      const absoluteIndex = commonPrefixLength + localIndex;
      const lineId = buildLogId(fullText, absoluteIndex);

      const startTween = gsap.delayedCall(totalDelay, () => {
        if (generationRef.current !== currentGeneration) {
          return;
        }

        setRenderedLogs((currentLogs) => [
          ...currentLogs,
          {
            id: lineId,
            fullText,
            text: "",
            isComplete: false,
          },
        ]);

        const typingState = { count: 0 };
        const typingDuration = Math.max(
          MIN_TYPING_DURATION,
          fullText.length * SECONDS_PER_CHARACTER
        );

        const typingTween = gsap.to(typingState, {
          count: fullText.length,
          duration: typingDuration,
          ease: "none",
          onUpdate: () => {
            if (generationRef.current !== currentGeneration) {
              return;
            }

            const visibleLength = Math.floor(typingState.count);
            const visibleText = fullText.slice(0, visibleLength);

            setRenderedLogs((currentLogs) =>
              currentLogs.map((line) =>
                line.id === lineId
                  ? {
                      ...line,
                      text: visibleText,
                    }
                  : line
              )
            );
          },
          onComplete: () => {
            if (generationRef.current !== currentGeneration) {
              return;
            }

            setRenderedLogs((currentLogs) =>
              currentLogs.map((line) =>
                line.id === lineId
                  ? {
                      ...line,
                      text: fullText,
                      isComplete: true,
                    }
                  : line
              )
            );
          },
        });

        activeTweensRef.current.push(typingTween);
      });

      activeTweensRef.current.push(startTween);

      totalDelay +=
        BASE_LINE_DELAY +
        Math.max(MIN_TYPING_DURATION, fullText.length * SECONDS_PER_CHARACTER);
    });

    previousLogsRef.current = logs;

    return () => {
      clearActiveTweens();
    };
  }, [logs]);

  return (
    <div className={compact ? "" : "ops-panel p-4 sm:p-5"}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="section-label">
            Activity
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--text-main)]">
            Event rail
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="h-2 w-2 rounded-full bg-[var(--mint)]" />
          <span className="font-mono-system text-[11px] text-[var(--text-muted)]">
            {renderedLogs.length} updates
          </span>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className={`surface overflow-y-auto p-3 sm:p-4 ${
          compact
            ? "max-h-[210px] min-h-[160px] md:max-h-[230px] md:min-h-[180px] xl:max-h-[280px] xl:min-h-[220px]"
            : "max-h-[260px] min-h-[210px] md:max-h-[290px] md:min-h-[230px] xl:max-h-[320px] xl:min-h-[260px]"
        }`}
      >
        <div className="mb-3 flex flex-col gap-2 border-b border-[var(--border-soft)] pb-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono-system text-[11px] text-[var(--text-dim)]">
            Current session
          </span>
          <span className="font-mono-system text-[11px] text-[var(--text-muted)]">
            Live
          </span>
        </div>

        <div className="space-y-2.5">
          {renderedLogs.map((logLine) => (
            <p key={logLine.id} className="terminal-text break-normal">
              <span>{logLine.text}</span>
              {!logLine.isComplete ? (
                <span
                  aria-hidden="true"
                  className="terminal-cursor ml-1 inline-block h-[1.05em] w-[0.6ch] align-[-0.18em] bg-[var(--text-soft)]"
                />
              ) : null}
            </p>
          ))}

          {renderedLogs.length === 0 ? (
            <p className="terminal-text text-[var(--text-dim)]">
              Updates will appear here once the download starts.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
