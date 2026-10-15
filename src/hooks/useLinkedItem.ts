import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/** Marks the element a linked item renders as; see useLinkedItem. */
export const LINKED_ITEM_ATTR = "data-linked-item";

/** The highlight a linked item gets, so the user sees what they came for. */
export const LINKED_ITEM_CLASS = "ring-2 ring-secondary ring-offset-2";

/** Spread onto a linked item's element, so useLinkedItem can scroll to it. */
export function linkedItemAttrs(isLinked: boolean): Record<string, string> {
  return isLinked ? { [LINKED_ITEM_ATTR]: "" } : {};
}

/**
 * The item a link pointed at — `?offer=`, `?request=`, `?pool=` or
 * `?payment=` from a notification (see lib/notification-target.ts) — on a
 * page listing such items. Once the list has loaded (`ids` non-null), the
 * linked item is scrolled into view and `isLinked(id)` is true for it, so
 * the page can highlight it (LINKED_ITEM_CLASS) and mark its element with
 * linkedItemAttrs(). If it isn't in the list, `notFound` is true, so the
 * page can say why instead of showing nothing (e.g. another admin already
 * reviewed it).
 *
 * Found or not is decided once per link, on the first loaded list: acting
 * on the item usually drops it from the list (an approved offer), and that
 * mustn't turn into "not found".
 */
export function useLinkedItem(param: string, ids: string[] | null) {
  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get(param);
  const [decided, setDecided] = useState<{ id: string; found: boolean } | null>(null);

  // Adjusting state during render on a new link or the first loaded list —
  // React's pattern for state derived from changing inputs.
  if (linkedId && ids !== null && decided?.id !== linkedId) {
    setDecided({ id: linkedId, found: ids.includes(linkedId) });
  }
  const current = decided && decided.id === linkedId ? decided : null;
  const found = !!current?.found;

  useEffect(() => {
    if (!found) return;
    // A DataTable renders each row twice (table and mobile cards, one
    // hidden by CSS): scroll to the copy that's showing.
    const elements = [...document.querySelectorAll<HTMLElement>(`[${LINKED_ITEM_ATTR}]`)];
    const visible = elements.find((el) => el.offsetParent !== null) ?? elements[0];
    visible?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [found, linkedId]);

  return {
    isLinked: (id: string) => found && id === linkedId,
    notFound: !!current && !current.found,
  };
}
