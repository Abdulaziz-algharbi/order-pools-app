/**
 * Thin fetch wrapper around the backend API. Callers get back whatever
 * JSON body the endpoint sent — response envelopes are NOT uniform across
 * the backend (`{message,data}` vs a raw document vs `{user}`, see
 * order-pools-backend docs) — so unwrapping the right shape is each
 * `lib/api.ts` function's job, not this layer's.
 *
 * Handles attaching the access token, and transparently retrying once
 * after a silent refresh on a 401 (concurrent 401s share one in-flight
 * refresh rather than each firing their own).
 */
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
} from "./tokenStore";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export class ApiError extends Error {
  status: number;
  errors?: unknown;

  constructor(message: string, status: number, errors?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Set false for the two auth endpoints that must never attach a stale/absent token. */
  auth?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

// Refreshes the access token at most once for any number of concurrent
// 401s — every caller awaits the same in-flight attempt instead of each
// racing the refresh endpoint separately.
async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const body = await res.json();
        setAccessToken(body.accessToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  // The base is `window.location.origin` because VITE_API_BASE_URL may be
  // a relative path (e.g. "/api/v1" behind an nginx reverse proxy) — the
  // one-argument `new URL()` form only accepts an absolute URL and throws
  // otherwise. Passing a base is a no-op when BASE_URL is already
  // absolute (e.g. local dev's http://localhost:8000/api/v1), so this
  // works for both.
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, auth = true } = options;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && auth && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch();
    } else {
      clearTokens();
      window.dispatchEvent(new Event("order-pool:session-expired"));
    }
  }

  const data = await parseBody(res);

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) ?? `Request failed with status ${res.status}`;
    const errors =
      data && typeof data === "object" && "errors" in data
        ? (data as { errors: unknown }).errors
        : undefined;
    throw new ApiError(message, res.status, errors);
  }

  return data as T;
}
