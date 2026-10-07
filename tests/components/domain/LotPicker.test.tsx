import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LotPicker } from "@/components/domain/LotPicker";
import { allowedJoinQuantities } from "@/lib/pool-pricing";

type Terms = { minimumContribution: number; currentQuantity: number; minimumContributionPrice?: number };

function renderPicker({ minimumContribution, currentQuantity, minimumContributionPrice = 300 }: Terms) {
  const onChange = vi.fn();
  render(
    <LotPicker
      pool={{ minimumContribution, currentQuantity, minimumContributionPrice, unit: "CARTON" }}
      onChange={onChange}
    />,
  );
  return { onChange, last: () => onChange.mock.calls.at(-1)?.[0] };
}

const user = () => userEvent.setup();
const lotsField = () => screen.getByLabelText(/Number of lots/);
const more = () => screen.getByRole("button", { name: "More lots" });
const fewer = () => screen.getByRole("button", { name: "Fewer lots" });

async function typeLots(value: string) {
  await user().clear(lotsField());
  if (value) await user().type(lotsField(), value);
}

// The picker must only ever produce what the backend accepts — exactly
// allowedJoinQuantities(), no more, no fewer.
describe("LotPicker offers exactly the sizes the backend accepts", () => {
  it.each([
    [25, 100],
    [30, 100],
    [30, 70],
    [7, 50],
    [10, 10],
    [2, 5],
  ])("in lots of %s with %s free", async (minimumContribution, currentQuantity) => {
    const { last } = renderPicker({ minimumContribution, currentQuantity });
    const reachable = new Set<number>();

    const lotsMode = screen.queryByLabelText(/Number of lots/);
    if (lotsMode) {
      // Every whole number of lots that's accepted…
      for (let lots = 1; lots * minimumContribution <= currentQuantity; lots++) {
        await typeLots(String(lots));
        const quantity = last();
        if (quantity !== null) reachable.add(quantity);
      }
    }
    // …plus taking everything, when it's a separate choice.
    const takeAll = screen.queryByLabelText(/Take everything still free/);
    if (takeAll) {
      await user().click(takeAll);
      reachable.add(last());
    }
    if (!lotsMode && !takeAll) reachable.add(last());

    expect([...reachable].sort((a, b) => a - b)).toEqual(allowedJoinQuantities({ minimumContribution, currentQuantity }));
  });
});

describe("LotPicker stepper", () => {
  it("starts at one lot", () => {
    const { last } = renderPicker({ minimumContribution: 25, currentQuantity: 100 });

    expect(lotsField()).toHaveValue(1);
    expect(last()).toBe(25);
    expect(fewer()).toBeDisabled();
  });

  it("steps up to every lot when nothing is left over, then stops", async () => {
    const { last } = renderPicker({ minimumContribution: 25, currentQuantity: 100 });

    for (let i = 0; i < 3; i++) await user().click(more());

    expect(lotsField()).toHaveValue(4);
    expect(last()).toBe(100);
    expect(more()).toBeDisabled();
    expect(screen.queryByLabelText(/Take everything still free/)).not.toBeInTheDocument();
  });

  it("reports nothing while the typed number isn't allowed, and says why", async () => {
    const { last } = renderPicker({ minimumContribution: 30, currentQuantity: 100 });

    await typeLots("3");

    expect(last()).toBeNull();
    expect(screen.getByText("Choose 1 to 2 lots.")).toBeInTheDocument();
  });

  it.each([
    ["99", "fewer", 2],
    ["99", "more", 2],
    ["0", "more", 1],
    ["", "more", 1],
  ])("snaps a typed %j back into range with %s", async (typed, button, expected) => {
    const { last } = renderPicker({ minimumContribution: 30, currentQuantity: 100 });

    await typeLots(typed);
    await user().click(button === "more" ? more() : fewer());

    expect(lotsField()).toHaveValue(expected);
    expect(last()).toBe(expected * 30);
  });

  it("says 1 lot when only one fits", async () => {
    renderPicker({ minimumContribution: 30, currentQuantity: 70 });

    await typeLots("2");

    expect(screen.getByText("Choose 1 lot.")).toBeInTheDocument();
  });

  // A list of 10,000 sizes wouldn't work; a number of lots does.
  it("handles a large pool without listing anything", async () => {
    const { last } = renderPicker({ minimumContribution: 1, currentQuantity: 10000, minimumContributionPrice: 0.1 });

    await typeLots("10000");

    expect(last()).toBe(10000);
    expect(screen.getByText("10,000 carton · 1,000.000 OMR")).toBeInTheDocument();
  });
});

describe("LotPicker with a leftover", () => {
  it("offers taking everything, with the leftover spelled out, and switches back", async () => {
    const { last } = renderPicker({ minimumContribution: 30, currentQuantity: 100 });

    await user().click(more());
    expect(last()).toBe(60);

    await user().click(screen.getByLabelText("Take everything still free: 100 carton (3 lots + 10 left over)"));
    expect(last()).toBe(100);
    expect(lotsField()).toBeDisabled();
    expect(screen.getByText("100 carton · 1,000.000 OMR")).toBeInTheDocument();

    await user().click(screen.getByLabelText("Choose a number of lots"));
    expect(last()).toBe(60);
    expect(lotsField()).toBeEnabled();
  });

  it("offers only everything when just the last lot and the leftover are free", () => {
    const { last } = renderPicker({ minimumContribution: 30, currentQuantity: 40 });

    expect(screen.queryByLabelText(/Number of lots/)).not.toBeInTheDocument();
    expect(screen.getByText("40 carton (1 lot + 10 left over)")).toBeInTheDocument();
    expect(last()).toBe(40);
  });

  // A pool that's somehow below one lot (data from before the rules).
  it("offers only everything when less than a lot is free", () => {
    const { last } = renderPicker({ minimumContribution: 30, currentQuantity: 20 });

    expect(screen.getByText("20 carton")).toBeInTheDocument();
    expect(last()).toBe(20);
  });
});

describe("LotPicker accessibility", () => {
  it("labels the field and the buttons, and describes the field with the lot price", () => {
    renderPicker({ minimumContribution: 30, currentQuantity: 100 });

    expect(lotsField()).toHaveAccessibleName("Number of lots (30 carton each)");
    expect(lotsField()).toHaveAccessibleDescription("300.000 OMR per lot · up to 2 lots");
    expect(fewer()).toBeInTheDocument();
    expect(more()).toBeInTheDocument();
  });

  it("marks a typed number that isn't allowed invalid and reads the reason with it", async () => {
    renderPicker({ minimumContribution: 30, currentQuantity: 100 });

    await typeLots("5");

    expect(lotsField()).toHaveAttribute("aria-invalid", "true");
    expect(lotsField()).toHaveAccessibleDescription("Choose 1 to 2 lots.");
  });

  it("groups the two choices under a question", () => {
    renderPicker({ minimumContribution: 30, currentQuantity: 100 });

    expect(screen.getByRole("group", { name: "How much would you like to join?" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("announces the total as it changes", async () => {
    renderPicker({ minimumContribution: 25, currentQuantity: 100 });

    await user().click(more());

    expect(screen.getByText("50 carton · 600.000 OMR").closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });
});
