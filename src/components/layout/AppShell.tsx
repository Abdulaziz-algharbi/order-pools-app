import { useState } from "react";
import { Outlet, useMatches } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CloseIcon } from "@/components/ui/icons";
import type { Panel } from "@/lib/panel";

interface RouteHandle {
  title?: string;
}

export function AppShell({ role }: { role: Panel }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const matches = useMatches();
  const title =
    [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.title)?.handle as
      | RouteHandle
      | undefined;

  return (
    <div className="flex h-dvh bg-neutral">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <Sidebar role={role} />
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full w-72 max-w-[80vw]">
            <Sidebar role={role} onNavigate={() => setMobileNavOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-300 hover:bg-white/10"
              aria-label="Close navigation menu"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          role={role}
          onMenuClick={() => setMobileNavOpen(true)}
          title={title?.title ?? "Order Pool"}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
