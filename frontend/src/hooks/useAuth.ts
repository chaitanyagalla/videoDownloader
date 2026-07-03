"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiClientError,
  fetchCurrentUser,
  getGoogleSignInUrl,
  logoutCurrentUser,
} from "@/lib/api";
import type { AuthUser } from "@/types";

type UseAuthReturn = {
  user: AuthUser | null;
  isLoading: boolean;
  isSigningOut: boolean;
  error: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
};

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const currentUser = await fetchCurrentUser();

        if (!cancelled) {
          setUser(currentUser);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof ApiClientError
              ? err.message
              : "Failed to load account";
          setError(message);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(() => {
    window.location.href = getGoogleSignInUrl();
  }, []);

  const signOut = useCallback(async () => {
    setIsSigningOut(true);
    setError(null);

    try {
      await logoutCurrentUser();
      setUser(null);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to sign out";
      setError(message);
      throw err;
    } finally {
      setIsSigningOut(false);
    }
  }, []);

  return {
    user,
    isLoading,
    isSigningOut,
    error,
    signIn,
    signOut,
  };
}
