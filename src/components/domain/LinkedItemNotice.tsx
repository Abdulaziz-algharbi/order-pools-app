import type { ReactNode } from "react";

/** Shown where a linked item (see useLinkedItem) isn't on the page any
 *  more, saying why, instead of leaving the user to look for it. */
export function LinkedItemNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      {children}
    </div>
  );
}
