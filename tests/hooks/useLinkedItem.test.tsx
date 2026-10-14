import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkedItemAttrs, useLinkedItem } from "@/hooks/useLinkedItem";

// jsdom doesn't lay out, so it has no scrollIntoView.
const scrollIntoView = vi.fn();
beforeEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(() => {
  scrollIntoView.mockReset();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

function List({ ids }: { ids: string[] | null }) {
  const linked = useLinkedItem("offer", ids);
  return (
    <div>
      {linked.notFound && <p>not found</p>}
      {(ids ?? []).map((id) => (
        <p key={id} data-testid={id} {...linkedItemAttrs(linked.isLinked(id))}>
          {linked.isLinked(id) ? "linked" : "plain"}
        </p>
      ))}
    </div>
  );
}

function renderList(url: string, ids: string[] | null) {
  const view = render(
    <MemoryRouter initialEntries={[url]}>
      <List ids={ids} />
    </MemoryRouter>,
  );
  const rerender = (next: string[] | null) =>
    view.rerender(
      <MemoryRouter initialEntries={[url]}>
        <List ids={next} />
      </MemoryRouter>,
    );
  return { rerender };
}

describe("useLinkedItem", () => {
  it("marks the linked item and scrolls it into view", () => {
    renderList("/admin/offers?offer=b", ["a", "b"]);

    expect(screen.getByTestId("b")).toHaveTextContent("linked");
    expect(screen.getByTestId("b")).toHaveAttribute("data-linked-item");
    expect(screen.getByTestId("a")).toHaveTextContent("plain");
    expect(screen.queryByText("not found")).not.toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId("b"));
  });

  it("says when the linked item isn't in the list", () => {
    renderList("/admin/offers?offer=gone", ["a"]);

    expect(screen.getByText("not found")).toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("waits for the list to load before deciding", () => {
    const { rerender } = renderList("/admin/offers?offer=b", null);
    expect(screen.queryByText("not found")).not.toBeInTheDocument();

    rerender(["a", "b"]);

    expect(screen.getByTestId("b")).toHaveTextContent("linked");
  });

  // Acting on the item (approving the offer) drops it from the list; that
  // isn't "not found".
  it("doesn't call it not found once the user dealt with it", () => {
    const { rerender } = renderList("/admin/offers?offer=b", ["a", "b"]);

    rerender(["a"]);

    expect(screen.queryByText("not found")).not.toBeInTheDocument();
  });

  it("does nothing without a link", () => {
    renderList("/admin/offers", ["a"]);

    expect(screen.getByTestId("a")).toHaveTextContent("plain");
    expect(screen.queryByText("not found")).not.toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
