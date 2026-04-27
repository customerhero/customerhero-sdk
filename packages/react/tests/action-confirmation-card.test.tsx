import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { ActionConfirmationCard } from "../src";
import type { ActionConfirmationBlock, TranslateFn } from "@customerhero/js";

const block: ActionConfirmationBlock = {
  type: "action_confirmation",
  pendingToolCallId: "ptc_1",
  actionName: "send_email",
  title: "Send the email?",
  summary: "I'll email support@example.com.",
  approveHref: "/x?decision=approve",
  cancelHref: "/x?decision=cancel",
};

const t: TranslateFn = (k) => {
  const map: Record<string, string> = {
    action_approve: "Approve",
    action_cancel: "Cancel",
    action_what_will_happen: "What will happen?",
    action_failed: "Couldn't complete that action.",
  };
  return map[k] ?? k;
};

describe("ActionConfirmationCard", () => {
  afterEach(cleanup);

  it("renders title, approve, cancel, and the disclosure trigger", () => {
    render(
      <ActionConfirmationCard
        block={block}
        primaryColor="#000"
        t={t}
        onApprove={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByText("Send the email?")).toBeTruthy();
    expect(screen.getByText("Approve")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getByText(/What will happen\?/)).toBeTruthy();
  });

  it("toggles the summary disclosure", () => {
    render(
      <ActionConfirmationCard
        block={block}
        primaryColor="#000"
        t={t}
        onApprove={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.queryByText(block.summary)).toBeNull();
    fireEvent.click(screen.getByText(/What will happen\?/));
    expect(screen.getByText(block.summary)).toBeTruthy();
  });

  it("calls onApprove with pendingId and disables both buttons after click", async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn().mockResolvedValue(undefined);
    render(
      <ActionConfirmationCard
        block={block}
        primaryColor="#000"
        t={t}
        onApprove={onApprove}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledWith("ptc_1");
    // Buttons disabled
    await waitFor(() => {
      const approveBtn = screen.getByText("Approve").closest("button");
      const cancelBtn = screen.getByText("Cancel").closest("button");
      expect(approveBtn?.disabled).toBe(true);
      expect(cancelBtn?.disabled).toBe(true);
    });
  });

  it("surfaces inline error when onApprove rejects", async () => {
    const onApprove = vi.fn().mockRejectedValue(new Error("nope"));
    render(
      <ActionConfirmationCard
        block={block}
        primaryColor="#000"
        t={t}
        onApprove={onApprove}
        onCancel={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    fireEvent.click(screen.getByText("Approve"));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("nope");
    });
  });
});

import { afterEach } from "vitest";
