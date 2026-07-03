"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { validateUrl } from "@/lib/validators";
import type { Platform } from "@/types";
import { PlatformBadge } from "./PlatformBadge";

interface URLInputProps {
  onSubmit: (url: string) => Promise<void>;
  isSubmitting: boolean;
  disabled?: boolean;
}

type DragState = "idle" | "hovering" | "invalid";

function LinkIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.415-1.414m-.758-4.9a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656L12.07 4.343"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M6 18 18 6M6 6l12 12"
      />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-7-4-4m0 0-4 4m4-4v12"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 9v3m0 4h.01m-7.938 4h15.876c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L2.33 17c-.77 1.333.192 3 1.732 3Z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4Z"
      />
    </svg>
  );
}

export function URLInput({
  onSubmit,
  isSubmitting,
  disabled = false,
}: URLInputProps) {
  const [value, setValue] = useState("");
  const [dragState, setDragState] = useState<DragState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<Platform | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const validateAndSet = useCallback((url: string) => {
    const trimmed = url.trim();
    setValue(trimmed);

    if (!trimmed) {
      setValidationError(null);
      setDetectedPlatform(null);
      return;
    }

    const result = validateUrl(trimmed);

    if (result.valid) {
      setValidationError(null);
      setDetectedPlatform(result.platform);
      return;
    }

    setValidationError(result.error);
    setDetectedPlatform(null);
  }, []);

  const resetInput = useCallback(() => {
    setValue("");
    setValidationError(null);
    setDetectedPlatform(null);
  }, []);

  const handleSubmit = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      const result = validateUrl(trimmed);

      if (!result.valid) {
        setValidationError(result.error);
        setDetectedPlatform(null);
        inputRef.current?.focus();
        return;
      }

      try {
        await onSubmit(trimmed);
        resetInput();
      } catch {
        // parent hook handles global error state
      }
    },
    [onSubmit, resetInput]
  );

  const handleFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleSubmit(value);
    },
    [handleSubmit, value]
  );

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current += 1;

    const items = Array.from(event.dataTransfer.items);

    const hasText = items.some(
      (item) =>
        item.kind === "string" &&
        (item.type === "text/uri-list" || item.type === "text/plain")
    );

    setDragState(hasText ? "hovering" : "invalid");
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragCounter.current -= 1;

    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragState("idle");
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      dragCounter.current = 0;
      setDragState("idle");

      const uri = event.dataTransfer.getData("text/uri-list");
      const plain = event.dataTransfer.getData("text/plain");
      const dropped = (uri || plain).split("\n")[0]?.trim() ?? "";

      if (!dropped) {
        return;
      }

      validateAndSet(dropped);
      void handleSubmit(dropped);
    },
    [handleSubmit, validateAndSet]
  );

  const isDisabled = disabled || isSubmitting;
  const canSubmit = value.length > 0 && !validationError && !isDisabled;

  const frameClassName = useMemo(() => {
    if (dragState === "hovering") {
      return "border-[rgba(0,255,159,0.42)]";
    }

    if (dragState === "invalid" || validationError) {
      return "border-[rgba(255,77,109,0.45)]";
    }

    if (value && !validationError) {
      return "border-[rgba(122,255,193,0.34)]";
    }

    return "border-[var(--border)]";
  }, [dragState, validationError, value]);

  const overlayContent = useMemo(() => {
    if (dragState === "hovering") {
      return {
        text: "DROP LINK TO START DOWNLOAD",
        className:
          "border-[rgba(0,255,159,0.45)] bg-[rgba(0,255,159,0.08)] text-[var(--neon)]",
        icon: <ArrowUpIcon />,
      };
    }

    if (dragState === "invalid") {
      return {
        text: "ONLY VALID VIDEO LINKS ARE ACCEPTED",
        className:
          "border-[rgba(255,77,109,0.45)] bg-[rgba(255,77,109,0.08)] text-[var(--danger)]",
        icon: <AlertIcon />,
      };
    }

    return null;
  }, [dragState]);

  const helperText = useMemo(() => {
    if (validationError) {
      return validationError;
    }

    if (detectedPlatform) {
      return "Link recognized. Ready to start the download.";
    }

    return "Paste a link or drag one anywhere into this card to begin.";
  }, [detectedPlatform, validationError]);

  return (
    <form onSubmit={handleFormSubmit} className="w-full" noValidate>
      <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 font-mono-system text-[10px] uppercase tracking-[0.14em] text-[var(--text-neutral)]">
              Step 01
            </span>
            <p className="section-label">Paste Video URL</p>
          </div>
          <p className="mt-3 max-w-[34ch] text-sm leading-6 text-[var(--text-muted)]">
            Enter one supported link to start the download flow. Detection and
            save handling happen automatically.
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 sm:flex">
          <span className="h-2 w-2 rounded-full bg-[var(--neon-soft)]" />
          <span className="font-mono-system text-[11px] uppercase tracking-[0.14em] text-[var(--text-neutral)]">
            Ready
          </span>
        </div>
      </div>

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative"
      >
        {overlayContent ? (
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center rounded-2xl border backdrop-blur-md ${overlayContent.className}`}
          >
            <span className="flex items-center gap-3 px-4 text-center font-mono-system text-xs font-bold uppercase tracking-[0.22em] sm:text-sm">
              {overlayContent.icon}
              {overlayContent.text}
            </span>
          </div>
        ) : null}

        <div
          aria-label="Video URL input area"
          className={`rounded-[1.35rem] border bg-[linear-gradient(180deg,rgba(255,255,255,0.028)_0%,rgba(0,0,0,0.18)_100%)] p-4 transition-all duration-200 sm:p-5 ${frameClassName}`}
        >
          <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <span className="font-mono-system text-[11px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
                Link Input
              </span>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Paste, drag, or drop a supported URL.
              </p>
              <span className="mt-2 inline-flex rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 font-mono-system text-[10px] uppercase tracking-[0.12em] text-[var(--text-neutral)]">
                Drag & drop supported
              </span>
            </div>

            {detectedPlatform ? (
              <PlatformBadge
                platform={detectedPlatform}
                className="shrink-0 self-start sm:self-center"
              />
            ) : (
              <span className="font-mono-system text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
                Awaiting link
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 shrink-0 ${
                  validationError
                    ? "text-[var(--danger)]"
                    : value
                    ? "text-[var(--neon)]"
                    : "text-[var(--text-dim)]"
                }`}
              >
                <LinkIcon />
              </div>

              <div className="min-w-0 flex-1">
                <label
                  htmlFor="target-url"
                  className="text-sm font-medium text-[var(--text-neutral)]"
                >
                  Video URL
                </label>

                <input
                  id="target-url"
                  ref={inputRef}
                  type="url"
                  inputMode="url"
                  enterKeyHint="go"
                  autoCapitalize="none"
                  value={value}
                  onChange={(event) => validateAndSet(event.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  disabled={isDisabled}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(validationError)}
                  aria-describedby="target-url-helper"
                  className="mt-2 block w-full bg-transparent font-sans-system text-[15px] leading-7 text-[var(--text-main)] outline-none placeholder:text-[rgba(184,203,194,0.34)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
                />
              </div>

              {value && !isSubmitting ? (
                <button
                  type="button"
                  onClick={() => {
                    resetInput();
                    inputRef.current?.focus();
                  }}
                  className="shrink-0 rounded-lg border border-transparent p-2 text-[var(--text-dim)] transition-colors hover:border-[rgba(0,255,159,0.14)] hover:text-[var(--text-main)]"
                  aria-label="Clear target URL"
                >
                  <ClearIcon />
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {["YouTube", "Instagram", "X"].map((label) => (
              <span
                key={label}
                className="rounded-xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-center font-mono-system text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] last:col-span-2 sm:last:col-span-1"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-4 border-t border-[var(--border-soft)] pt-4 lg:flex-row lg:items-center lg:justify-between">
            <p
              id="target-url-helper"
              className={`flex max-w-full items-start gap-2 text-sm leading-6 lg:max-w-[38ch] ${
                validationError
                  ? "text-[var(--danger)]"
                  : detectedPlatform
                  ? "text-[var(--neon-soft)]"
                  : "text-[var(--text-muted)]"
              }`}
              aria-live="polite"
            >
              {validationError ? (
                <span className="mt-1 shrink-0">
                  <AlertIcon />
                </span>
              ) : null}
              <span>{helperText}</span>
            </p>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[rgba(98,227,170,0.42)] bg-[linear-gradient(180deg,#62e3aa_0%,#2fcf8f_100%)] px-5 py-3 font-mono-system text-xs font-bold uppercase tracking-[0.18em] text-[#04140d] shadow-[0_12px_28px_rgba(47,207,143,0.18)] transition-all duration-200 hover:translate-y-[-1px] hover:border-[rgba(122,255,193,0.5)] hover:bg-[linear-gradient(180deg,#78ebb9_0%,#39d596_100%)] disabled:cursor-not-allowed disabled:border-[rgba(145,167,156,0.16)] disabled:bg-[rgba(255,255,255,0.045)] disabled:text-[rgba(214,228,220,0.76)] disabled:shadow-none disabled:hover:translate-y-0 sm:min-w-[11rem] lg:w-auto"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon />
                  Starting Download
                </>
              ) : (
                <>
                  <ArrowUpIcon />
                  Start Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
