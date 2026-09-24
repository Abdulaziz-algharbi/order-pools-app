/**
 * Thin axios wrapper around the backend API. Callers get back whatever
 * JSON body the endpoint sent — response envelopes are NOT uniform across
 * the backend (`{message,data}` vs a raw document vs `{user}`, see
 * order-pools-backend docs) — so unwrapping the right shape is each
 * `services/api.ts` function's job, not this layer's.
 *
 * Auth is entirely cookie-based (httpOnly access/refresh tokens set by the
 * backend, see order-pools-backend/src/utils/cookies.util.ts) — this
 * module never sees a token itself. `withCredentials` sends those cookies
 * on every request; `withXSRFToken` is required in addition to
 * `withCredentials` for axios to attach the CSRF header cross-origin
 * (api./app. are different subdomains in production, hence different
 * origins even though they're the same site) — axios's default
 * same-origin-only XSRF behavior (its fix for CVE-2023-45857) would
 * otherwise silently drop the header there. `xsrfCookieName`/
 * `xsrfHeaderName` are left at axios's defaults (`XSRF-TOKEN` /
 * `X-XSRF-TOKEN`), which the backend's csrf.middleware.ts matches.
 *
 * Handles transparently retrying once after a silent refresh on a 401
 * (concurrent 401s share one in-flight refresh rather than each racing
 * the refresh endpoint separately).
 */
import axios, { AxiosError, type AxiosRequestConfig } from "axios";

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

const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
});

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Set false for the auth endpoints (login/register/anonymous address
   *  creation) where a 401 is a real failure, not an expired session to
   *  silently retry after refreshing. */
  auth?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

// Refreshes the session at most once for any number of concurrent 401s —
// every caller awaits the same in-flight attempt instead of each racing
// the refresh endpoint separately. No request/response body involved —
// the refresh token is the httpOnly cookie the browser already sent.
async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = client
      .post("/auth/refresh")
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data as
      | { message?: unknown; errors?: unknown }
      | undefined;
    const message =
      (typeof data?.message === "string" ? data.message : null) ??
      error.message ??
      `Request failed with status ${status}`;
    return new ApiError(message, status, data?.errors);
  }
  return new ApiError(
    error instanceof Error ? error.message : "Unknown error",
    0,
  );
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, auth = true } = options;

  const config: AxiosRequestConfig = {
    url: path,
    method,
    params: query,
    data: body,
  };

  try {
    const res = await client.request<T>(config);
    return res.data;
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? (error as AxiosError).response?.status
      : undefined;

    if (status === 401 && auth) {
      const refreshed = await refreshSession();
      if (refreshed) {
        try {
          const retryRes = await client.request<T>(config);
          return retryRes.data;
        } catch (retryError) {
          throw toApiError(retryError);
        }
      }
      window.dispatchEvent(new Event("order-pool:session-expired"));
    }

    throw toApiError(error);
  }
}
