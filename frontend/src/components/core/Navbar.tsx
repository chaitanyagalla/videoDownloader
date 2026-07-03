"use client";

import type { AuthUser } from "@/types";
import type { HeistStatus } from "@/components/heist/StatusIndicator";

type NavbarProps = {
  statusLabel: HeistStatus;
  user: AuthUser | null;
  isAuthLoading: boolean;
  isSigningOut: boolean;
  onSignIn: () => void;
  onSignOut: () => Promise<void>;
};

function getCompactStatusLabel(status: HeistStatus): string {
  switch (status) {
    case "LOCKING TARGET":
      return "Preparing";
    case "DOWNLOADING":
      return "Live";
    case "MISSION COMPLETED":
      return "Done";
    case "MISSION FAILED":
      return "Failed";
    default:
      return "Idle";
  }
}

function getUserInitial(user: AuthUser): string {
  return (user.name?.trim() || user.email).slice(0, 1).toUpperCase();
}

export default function Navbar({
  statusLabel,
  user,
  isAuthLoading,
  isSigningOut,
  onSignIn,
  onSignOut,
}: NavbarProps) {
  const compactStatusLabel = getCompactStatusLabel(statusLabel);

  return (
    <header className="sticky top-0 z-20 border-b border-[rgba(176,200,188,0.08)] bg-[rgba(2,4,4,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-11 w-full max-w-[1440px] flex-wrap items-center justify-between gap-2 px-3 py-2 sm:flex-nowrap sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="font-mono-system text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-neutral)] sm:text-[12px]">
            Video Downloader
          </h1>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <div className="flex items-center gap-2 sm:hidden">
            <span className="h-2 w-2 rounded-full bg-[var(--text-subtle)]" />
            <span className="font-mono-system text-[10px] uppercase tracking-[0.12em] text-[var(--text-neutral)]">
              {compactStatusLabel}
            </span>
          </div>

          <div className="hidden items-center gap-2.5 sm:flex">
            <span className="font-mono-system text-[10px] uppercase tracking-[0.14em] text-[var(--text-subtle)]">
              Status
            </span>
            <span className="rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 font-mono-system text-[10px] uppercase tracking-[0.12em] text-[var(--text-neutral)]">
              {statusLabel}
            </span>
          </div>

          <div className="ml-1 flex min-w-0 items-center gap-2 border-l border-[var(--border-soft)] pl-2 sm:ml-3 sm:pl-3">
            {user ? (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full border border-[var(--border-soft)]"
                    />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.04)] text-xs font-semibold text-[var(--text-main)]">
                      {getUserInitial(user)}
                    </span>
                  )}

                  <span className="hidden max-w-[11rem] truncate text-sm text-[var(--text-neutral)] md:inline">
                    {user.name?.trim() || user.email}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  disabled={isSigningOut}
                  className="rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-medium text-[var(--text-neutral)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? "Signing out" : "Sign out"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                disabled={isAuthLoading}
                className="rounded-full border border-[rgba(122,255,193,0.28)] bg-[rgba(122,255,193,0.08)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] transition hover:border-[rgba(122,255,193,0.44)] hover:bg-[rgba(122,255,193,0.12)] disabled:cursor-wait disabled:opacity-70"
              >
                {isAuthLoading ? "Checking" : "Sign in"}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
