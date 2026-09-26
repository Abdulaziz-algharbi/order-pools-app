import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import type { Panel } from "@/lib/panel";
import { PANEL_LABEL, panelsFor } from "@/lib/panel";

/**
 * Segmented toggle between the panels an account can open (e.g. Retailer
 * ↔ Supplier after an approved supplier request). Renders nothing for a
 * single-panel account. Switching lands on the other panel's dashboard —
 * the two panels' pages don't map one-to-one — and ProtectedRoute
 * remembers it as the panel to open next time.
 */
export function PanelSwitcher({ current, onSwitch }: { current: Panel; onSwitch?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const panels = panelsFor(user);
  if (panels.length < 2) return null;

  return (
    <div role="group" aria-label="Switch panel" className="flex rounded-lg bg-white/5 p-1">
      {panels.map((panel) => (
        <button
          key={panel}
          type="button"
          aria-pressed={panel === current}
          onClick={() => {
            if (panel === current) return;
            navigate(`/${panel}`);
            onSwitch?.();
          }}
          className={cn(
            "flex-1 truncate rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            panel === current
              ? "bg-white/15 text-white"
              : "text-slate-400 hover:bg-white/5 hover:text-white",
          )}
        >
          {PANEL_LABEL[panel]}
        </button>
      ))}
    </div>
  );
}
