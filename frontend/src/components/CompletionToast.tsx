"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export interface Celebration {
  id: string;
  title: string;
  fileSize: string | null;
}

interface CompletionToastProps {
  celebration: Celebration | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 4600;

export function CompletionToast({
  celebration,
  onDismiss,
}: CompletionToastProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!celebration) {
      return;
    }

    const card = cardRef.current;
    if (!card) {
      return;
    }

    let timer: number | null = null;

    const context = gsap.context(() => {
      gsap.fromTo(
        card,
        { y: 28, opacity: 0, scale: 0.92 },
        { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.7)" }
      );

      gsap.fromTo(
        card.querySelector("[data-toast-check]"),
        { scale: 0, rotate: -30 },
        { scale: 1, rotate: 0, duration: 0.5, ease: "back.out(2.2)", delay: 0.12 }
      );

      gsap.fromTo(
        card.querySelectorAll("[data-toast-spark]"),
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          stagger: 0.05,
          ease: "power2.out",
          delay: 0.18,
        }
      );
    }, card);

    const close = () => {
      gsap.to(card, {
        y: 18,
        opacity: 0,
        scale: 0.96,
        duration: 0.32,
        ease: "power2.in",
        onComplete: () => dismissRef.current(),
      });
    };

    timer = window.setTimeout(close, AUTO_DISMISS_MS);

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      context.revert();
    };
  }, [celebration]);

  if (!celebration) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 sm:inset-x-auto sm:right-6 sm:justify-end">
      <div
        ref={cardRef}
        role="status"
        aria-live="polite"
        onClick={() => dismissRef.current()}
        className="pointer-events-auto relative flex w-full max-w-sm cursor-pointer items-start gap-3 overflow-hidden rounded-[var(--radius-panel)] border border-[rgba(140,243,198,0.35)] bg-[var(--bg-surface-2)] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.5)]"
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--mint-strong)] to-transparent"
        />
        <span
          aria-hidden="true"
          className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(101,230,173,0.22),transparent_70%)]"
        />

        <span className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full border border-[rgba(140,243,198,0.4)] bg-[rgba(101,230,173,0.12)]">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              data-toast-spark
              aria-hidden="true"
              className="absolute h-1 w-1 rounded-full bg-[var(--mint-strong)]"
              style={{
                transform: `rotate(${index * 90}deg) translateY(-16px)`,
              }}
            />
          ))}
          <svg
            data-toast-check
            className="h-5 w-5 text-[var(--mint-strong)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.4}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </span>

        <div className="relative min-w-0 flex-1">
          <p className="font-mono-system text-[11px] uppercase tracking-wide text-[var(--mint-strong)]">
            Download completed
          </p>
          <p className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-5 text-[var(--text-main)]">
            {celebration.title}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            {celebration.fileSize
              ? `Download completed - ${celebration.fileSize}`
              : "Download completed"}
          </p>
        </div>
      </div>
    </div>
  );
}
