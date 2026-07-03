type SameSite = "Strict" | "Lax" | "None";

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: SameSite;
  maxAge?: number;
  expires?: Date;
  path?: string;
};

export function getCookieValue(
  cookieHeader: string | undefined,
  name: string
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const pairs = cookieHeader.split(";");

  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = pair.slice(0, separatorIndex).trim();
    if (key !== name) {
      continue;
    }

    const value = pair.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  parts.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join("; ");
}

export function clearCookie(name: string, path = "/"): string {
  return serializeCookie(name, "", {
    expires: new Date(0),
    maxAge: 0,
    path,
  });
}
