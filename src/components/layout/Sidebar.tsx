import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/config/nav";
import type { Panel } from "@/lib/panel";

const ROLE_LABEL: Record<Panel, string> = {
  retailer: "Retailer",
  supplier: "Supplier",
  admin: "Administrator",
};

interface SidebarProps {
  role: Panel;
  onNavigate?: () => void;
}

export function Sidebar({ role, onNavigate }: SidebarProps) {
  const items = NAV_ITEMS[role];

  return (
    <div className="flex h-full flex-col bg-primary text-slate-300">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-white">
          OP
        </div>
        <div>
          <p className="font-heading text-sm font-semibold text-white">Order Pool</p>
          <p className="text-xs text-slate-400">{ROLE_LABEL[role]}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )
            }
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-500">
        Order Pool &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}
