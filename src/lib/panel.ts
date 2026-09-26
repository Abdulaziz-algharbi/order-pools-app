/**
 * The frontend's own concept of which role-scoped panel/route-tree is
 * active. Kept separate from the backend's `UserRole` (see
 * `types/domain.ts`) because a single account can hold more than one
 * backend role at once (e.g. RETAILER + SUPPLIER after an approved
 * supplier request) but only browses one panel at a time.
 */
import type { AppUser, UserRole } from "@/types/domain";

export type Panel = "retailer" | "supplier" | "admin";

const PANEL_TO_ROLE: Record<Panel, UserRole> = {
  retailer: "RETAILER",
  supplier: "SUPPLIER",
  admin: "ADMIN",
};

export function panelToRole(panel: Panel): UserRole {
  return PANEL_TO_ROLE[panel];
}

export function userHasPanel(user: AppUser, panel: Panel): boolean {
  return user.roles.includes(panelToRole(panel));
}

export const PANEL_LABEL: Record<Panel, string> = {
  retailer: "Retailer",
  supplier: "Supplier",
  admin: "Administrator",
};

// Fallback order when a multi-role user has no remembered panel (first
// login on this browser) — admin access is the least common and most
// likely the intended workspace when present.
const PANEL_PRIORITY: Panel[] = ["admin", "supplier", "retailer"];

/** Every panel the user can open, in PANEL_PRIORITY order. */
export function panelsFor(user: AppUser): Panel[] {
  return PANEL_PRIORITY.filter((panel) => userHasPanel(user, panel));
}

// Where a user lands without a specific panel in mind (after login, or on
// `/`): the one they last used on this browser, if they still hold it.
export function defaultPanelFor(user: AppUser): Panel | null {
  const last = lastPanelFor(user._id);
  if (last && userHasPanel(user, last)) return last;
  return panelsFor(user)[0] ?? null;
}

// The last-used panel is a per-browser convenience, keyed by user so two
// accounts sharing a browser don't inherit each other's. Storage can be
// unavailable (private mode, blocked site data) — then this is a no-op
// and defaultPanelFor falls back to PANEL_PRIORITY.
const LAST_PANEL_KEY = (userId: string) => `orderpools.lastPanel.${userId}`;

export function rememberPanel(userId: string, panel: Panel): void {
  try {
    localStorage.setItem(LAST_PANEL_KEY(userId), panel);
  } catch {
    // ignore — see above
  }
}

function lastPanelFor(userId: string): Panel | null {
  try {
    const stored = localStorage.getItem(LAST_PANEL_KEY(userId));
    return stored && stored in PANEL_TO_ROLE ? (stored as Panel) : null;
  } catch {
    return null;
  }
}

// The panel is the URL (`/retailer/*`, `/supplier/*`, `/admin/*`) — not
// separate state that could drift from what's on screen. Null outside a
// panel (login, payment result page, …).
export function activePanel(pathname = window.location.pathname): Panel | null {
  const segment = pathname.split("/")[1];
  return segment && segment in PANEL_TO_ROLE ? (segment as Panel) : null;
}
