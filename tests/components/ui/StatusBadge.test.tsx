import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NotificationItem } from "@/components/domain/NotificationItem";
import type { AppNotification } from "@/types/domain";

describe("StatusBadge", () => {
  it("labels a withdrawn join", () => {
    render(<StatusBadge status="WITHDRAWN" domain="participant" />);
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
  });

  it.each([
    ["WITHDRAWN_REFUND_PENDING", "Withdrawn · Refund pending"],
    ["WITHDRAWN_REFUNDED", "Withdrawn · Refunded"],
    ["WITHDRAWN_REFUND_FAILED", "Withdrawn · Refund delayed"],
    ["REFUND_PENDING", "Refund Pending"],
    ["REFUNDED", "Refunded"],
    ["REFUND_FAILED", "Refund delayed"],
  ])("labels a join whose refund is %s as %s", (status, label) => {
    render(<StatusBadge status={status} domain="participant" />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("NotificationItem", () => {
  it("renders a refund-started notification with its own icon", () => {
    const notification = {
      _id: "n-1",
      type: "PAYMENT_REFUND_REQUESTED",
      title: "Refund started",
      message: "You withdrew from the pool, so we've started refunding your payment.",
      recipients: [],
      createdAt: new Date().toISOString(),
    } as unknown as AppNotification;

    render(<NotificationItem notification={notification} isRead={false} />);

    expect(screen.getByText("Refund started")).toBeInTheDocument();
    expect(screen.getByText("⏳")).toBeInTheDocument();
  });
});
