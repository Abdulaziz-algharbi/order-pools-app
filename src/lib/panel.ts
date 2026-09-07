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

// Preference order when a multi-role user lands without a specific panel
// in mind (e.g. right after login) — admin access is the least common and
// most likely the intended workspace when present.
const PANEL_PRIORITY: Panel[] = ["admin", "supplier", "retailer"];

export function defaultPanelFor(user: AppUser): Panel | null {
  return PANEL_PRIORITY.find((panel) => userHasPanel(user, panel)) ?? null;
}
