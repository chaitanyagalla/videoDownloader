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
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.415-1.414m-.758-4.9a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656L12.07 4.343" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-7-4-4m0 0-4 4m4-4v12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3m0 4h.01m-7.938 4h15.876c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L2.33 17c-.77 1.333.192 3 1.732 3Z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4Z" />
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
        // parent hook owns the visible error state
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

    const hasText = Array.from(event.dataTransfer.items).some(
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
      return "border-[rgba(101,230,173,0.54)]";
    }

    if (dragState === "invalid" || validationError) {
      return "border-[rgba(255,107,127,0.58)]";
    }

    if (value && !validationError) {
      return "border-[rgba(101,230,173,0.42)]";
    }

    return "border-[var(--border)]";
  }, [dragState, validationError, value]);

  const helperText = useMemo(() => {
    if (validationError) {
      return validationError;
    }

    if (detectedPlatform) {
      return "Source recognized.";
    }

    return "Paste or drop a supported URL.";
  }, [detectedPlatform, validationError]);

  const overlayContent = useMemo(() => {
    if (dragState === "hovering") {
      return {
        text: "Drop to capture",
        className: "border-[rgba(101,230,173,0.54)] bg-[rgba(101,230,173,0.11)] text-[var(--mint-strong)]",
        icon: <ArrowUpIcon />,
      };
    }

    if (dragState === "invalid") {
      return {
        text: "Use a video link",
        className: "border-[rgba(255,107,127,0.54)] bg-[rgba(255,107,127,0.1)] text-[var(--danger)]",
        icon: <AlertIcon />,
      };
    }

    return null;
  }, [dragState]);

  return (
    <form onSubmit={handleFormSubmit} className="w-full" noValidate>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Capture</p>
          <h2 className="mt-2 text-2xl font-semibold leading-8 text-[var(--text-main)]">
            Source dock
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {detectedPlatform ? (
            <PlatformBadge platform={detectedPlatform} />
          ) : (
            ["YouTube", "Instagram", "X"].map((label) => (
              <span key={label} className="rounded-md border border-[var(--border-soft)] px-2.5 py-1 font-mono-system text-[11px] text-[var(--text-muted)]">
                {label}
              </span>
            ))
          )}
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
          <div className={`absolute inset-0 z-10 flex items-center justify-center rounded-xl border backdrop-blur-md ${overlayContent.className}`}>
            <span className="flex items-center gap-3 px-4 text-center font-mono-system text-sm font-bold">
              {overlayContent.icon}
              {overlayContent.text}
            </span>
          </div>
        ) : null}

        <div aria-label="Video URL input area" className={`surface-strong p-3 transition-all duration-200 sm:p-4 ${frameClassName}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3 rounded-xl border border-[var(--border-soft)] bg-[rgba(0,0,0,0.16)] p-3 sm:items-center">
              <div className={validationError ? "mt-0.5 text-[var(--danger)] sm:mt-0" : value ? "mt-0.5 text-[var(--mint)] sm:mt-0" : "mt-0.5 text-[var(--text-dim)] sm:mt-0"}>
                <LinkIcon />
              </div>

              <div className="min-w-0 flex-1">
                <label htmlFor="target-url" className="text-sm font-medium text-[var(--text-soft)]">
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
                  className="mt-1 block w-full bg-transparent text-base leading-7 text-[var(--text-main)] outline-none placeholder:text-[rgba(201,216,208,0.42)] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {value && !isSubmitting ? (
                <button
                  type="button"
                  onClick={() => {
                    resetInput();
                    inputRef.current?.focus();
                  }}
                  className="shrink-0 rounded-lg border border-transparent p-2 text-[var(--text-dim)] transition-colors hover:border-[var(--border)] hover:text-[var(--text-main)]"
                  aria-label="Clear target URL"
                >
                  <ClearIcon />
                </button>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[rgba(101,230,173,0.5)] bg-[var(--mint)] px-5 py-3 font-semibold text-[var(--text-inverse)] transition-all duration-200 hover:translate-y-[-1px] hover:bg-[var(--mint-strong)] disabled:cursor-not-allowed disabled:border-[var(--border-soft)] disabled:bg-[rgba(255,255,255,0.06)] disabled:text-[var(--text-muted)] disabled:hover:translate-y-0 lg:w-auto lg:min-w-[11.5rem]"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon />
                  Processing
                </>
              ) : (
                <>
                  <ArrowUpIcon />
                  Capture
                </>
              )}
            </button>
          </div>

          <p
            id="target-url-helper"
            className={`mt-3 flex max-w-full items-start gap-2 text-sm leading-6 ${
              validationError
                ? "text-[var(--danger)]"
                : detectedPlatform
                ? "text-[var(--mint-strong)]"
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
        </div>
      </div>
    </form>
  );
}
