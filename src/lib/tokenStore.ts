/**
 * Access/refresh token persistence, kept outside React so the plain fetch
 * wrapper in `lib/http.ts` can read/refresh a token without needing to be
 * a hook itself. `AuthContext` is the only thing that should call
 * `setTokens`/`clearTokens` in response to a user action (login/logout) —
 * everywhere else should only ever read via `getAccessToken`.
 */

const ACCESS_TOKEN_KEY = "order-pool.access-token";
const REFRESH_TOKEN_KEY = "order-pool.refresh-token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function setAccessToken(accessToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
