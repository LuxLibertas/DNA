import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { HistoryEntry } from "@/lib/storage/history";
import { HistoryPanel } from "./HistoryPanel";

const entries: HistoryEntry[] = [
  {
    id: "b",
    mode: "decode",
    scheme: "church",
    input: "ATACACAT",
    output: "A",
    createdAt: Date.UTC(2026, 8, 20, 12, 0, 0),
  },
  {
    id: "a",
    mode: "encode",
    scheme: "alphabetical",
    input: "<b>Hi</b>",
    output: "CAGACGGC",
    createdAt: Date.UTC(2026, 8, 19, 12, 0, 0),
  },
];

function setup(overrides: Partial<Parameters<typeof HistoryPanel>[0]> = {}) {
  const handlers = {
    onLoad: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
    onExport: vi.fn(),
  };
  render(<HistoryPanel entries={entries} {...handlers} {...overrides} />);
  return { user: userEvent.setup(), ...handlers };
}

describe("HistoryPanel", () => {
  it("renders each entry with mode, scheme, input and output, newest first", () => {
    setup();
    const items = screen.getAllByTestId("history-item");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("Decode")).toBeInTheDocument();
    expect(within(items[0]!).getByText("Church")).toBeInTheDocument();
    expect(within(items[0]!).getByText("ATACACAT")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Encode")).toBeInTheDocument();
    expect(within(items[1]!).getByText("CAGACGGC")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /History/ })).toHaveTextContent("2");
  });

  it("renders user text as text, never as HTML", () => {
    setup();
    expect(screen.getByText("<b>Hi</b>")).toBeInTheDocument();
    expect(document.querySelector("b")).toBeNull();
  });

  it("shows an empty state and disables export/clear when there is no history", () => {
    setup({ entries: [] });
    expect(screen.getByText(/No conversions yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeDisabled();
  });

  it("deletes a single entry", async () => {
    const { user, onDelete } = setup();
    const item = screen.getAllByTestId("history-item")[1]!;
    await user.click(within(item).getByRole("button", { name: /Delete/ }));
    expect(onDelete).toHaveBeenCalledWith("a");
  });

  it("loads an entry", async () => {
    const { user, onLoad } = setup();
    await user.click(within(screen.getAllByTestId("history-item")[0]!).getByRole("button", { name: /Load/ }));
    expect(onLoad).toHaveBeenCalledWith(entries[0]);
  });

  it("requires confirmation before clearing everything", async () => {
    const { user, onClear } = setup();
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClear).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClear).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    await user.click(screen.getByRole("button", { name: "Yes, clear all" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("exports", async () => {
    const { user, onExport } = setup();
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
