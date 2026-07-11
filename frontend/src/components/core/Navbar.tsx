"use client";

import type { AuthUser } from "@/types";

type NavbarProps = {
  user: AuthUser | null;
  isAuthLoading: boolean;
  isSigningOut: boolean;
  onSignIn: () => void;
  onSignOut: () => Promise<void>;
};

function getUserInitial(user: AuthUser): string {
  return (user.name?.trim() || user.email).slice(0, 1).toUpperCase();
}

export default function Navbar({
  user,
  isAuthLoading,
  isSigningOut,
  onSignIn,
  onSignOut,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-soft)] bg-[rgba(5,7,6,0.78)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-14 w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-3 py-2 sm:flex-nowrap sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] text-sm font-semibold text-[var(--mint)]"
          >
            VS
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-[var(--text-main)]">
              VideoSave
            </h1>
            <p className="hidden text-xs text-[var(--text-muted)] sm:block">
              Capture, process, archive
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <div className="ml-1 flex min-w-0 items-center gap-2 sm:ml-3">
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

                  <span className="hidden max-w-[11rem] truncate text-sm text-[var(--text-soft)] md:inline">
                    {user.name?.trim() || user.email}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  disabled={isSigningOut}
                  className="rounded-lg border border-[var(--border-soft)] bg-[rgba(255,255,255,0.035)] px-3 py-1.5 text-xs font-medium text-[var(--text-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? "Signing out" : "Sign out"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                disabled={isAuthLoading}
                className="rounded-lg border border-[rgba(101,230,173,0.42)] bg-[rgba(101,230,173,0.1)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] transition hover:border-[rgba(101,230,173,0.58)] hover:bg-[rgba(101,230,173,0.16)] disabled:cursor-wait disabled:opacity-70"
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
