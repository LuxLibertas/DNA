import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { convert, type Mode, type Scheme } from "@/lib/cipher/types";
import { loadTestCipher } from "@/lib/cipher/test-cipher";
import { MessageInput } from "./MessageInput";

const cipher = loadTestCipher();

/** Minimal harness: wires the field to the real cipher the way Workbench does. */
function Harness({ mode, scheme }: { mode: Mode; scheme: Scheme }) {
  const [value, setValue] = useState("");
  const trimmed = mode === "decode" ? value.trim() : value;
  const result = trimmed ? convert(cipher, mode, scheme, trimmed) : null;
  return (
    <MessageInput
      cipher={cipher}
      mode={mode}
      scheme={scheme}
      value={value}
      error={result && !result.ok ? result.error.message : null}
      onChange={setValue}
    />
  );
}

describe("MessageInput (encode): character counter and limit", () => {
  it("starts at 0/50 and counts as the user types", async () => {
    const user = userEvent.setup();
    render(<Harness mode="encode" scheme="alphabetical" />);
    expect(screen.getByText("0/50")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Message"), "hello");
    expect(screen.getByText("5/50")).toBeInTheDocument();
  });

  it("accepts exactly 50 characters without an error", async () => {
    const user = userEvent.setup();
    render(<Harness mode="encode" scheme="alphabetical" />);
    await user.click(screen.getByLabelText("Message"));
    await user.paste("x".repeat(50));
    expect(screen.getByText("50/50")).not.toHaveClass("counter-over");
    expect(screen.getByLabelText("Message")).not.toHaveAttribute("aria-invalid");
  });

  it("flags 51 characters with an over-limit counter and a visible error", async () => {
    const user = userEvent.setup();
    render(<Harness mode="encode" scheme="church" />);
    await user.click(screen.getByLabelText("Message"));
    await user.paste("x".repeat(51));
    expect(screen.getByText("51/50")).toHaveClass("counter-over");
    expect(screen.getByText("Message is 51 characters; the maximum is 50.")).toBeVisible();
    expect(screen.getByLabelText("Message")).toHaveAttribute("aria-invalid", "true");
  });

  it("explains invalid characters", async () => {
    const user = userEvent.setup();
    render(<Harness mode="encode" scheme="church" />);
    await user.type(screen.getByLabelText("Message"), "café");
    expect(screen.getByText(/Character 'é' at position 4 is not printable ASCII/)).toBeVisible();
  });

  it("shows scheme-specific expected and max lengths", () => {
    const noop = () => {};
    const { rerender } = render(
      <MessageInput cipher={cipher} mode="encode" scheme="alphabetical" value="" error={null} onChange={noop} />,
    );
    expect(screen.getByText(/4 nt per character/)).toHaveTextContent("(max 200 nt)");
    rerender(
      <MessageInput cipher={cipher} mode="encode" scheme="church" value="abc" error={null} onChange={noop} />,
    );
    expect(screen.getByText(/8 nt per character/)).toHaveTextContent("this message → 24 nt");
    expect(screen.getByText(/8 nt per character/)).toHaveTextContent("(max 400 nt)");
  });
});

describe("MessageInput (decode): length rule follows the scheme", () => {
  it("Alphabetical: multiple of 4", async () => {
    const user = userEvent.setup();
    render(<Harness mode="decode" scheme="alphabetical" />);
    const field = screen.getByLabelText("DNA sequence");
    expect(screen.getByText("0/200 nt")).toBeInTheDocument();
    await user.type(field, "CAACC");
    expect(screen.getByText("Sequence length 5 is not a multiple of 4.")).toBeVisible();
    await user.type(field, "AAC");
    expect(screen.queryByText(/is not a multiple of/)).not.toBeInTheDocument();
  });

  it("Church: multiple of 8 (4 is not enough)", async () => {
    const user = userEvent.setup();
    render(<Harness mode="decode" scheme="church" />);
    expect(screen.getByText("0/400 nt")).toBeInTheDocument();
    await user.type(screen.getByLabelText("DNA sequence"), "CAAC");
    expect(screen.getByText("Sequence length 4 is not a multiple of 8.")).toBeVisible();
  });

  it("rejects characters outside A/C/G/T", async () => {
    const user = userEvent.setup();
    render(<Harness mode="decode" scheme="alphabetical" />);
    await user.type(screen.getByLabelText("DNA sequence"), "CAAN");
    expect(screen.getByText("Character 'N' at position 4 is not one of A, C, G, T.")).toBeVisible();
  });

  it("does not count surrounding whitespace toward the limit", async () => {
    const user = userEvent.setup();
    render(<Harness mode="decode" scheme="alphabetical" />);
    await user.click(screen.getByLabelText("DNA sequence"));
    await user.paste("  CAAC \n");
    expect(screen.getByText("4/200 nt")).toBeInTheDocument();
    expect(screen.queryByText(/is not/)).not.toBeInTheDocument();
  });

  it("caps pasted input at 10x the limit so huge pastes are not re-validated per keystroke", () => {
    const noop = () => {};
    const { rerender } = render(
      <MessageInput cipher={cipher} mode="encode" scheme="church" value="" error={null} onChange={noop} />,
    );
    expect(screen.getByLabelText("Message")).toHaveAttribute("maxlength", "500");
    rerender(
      <MessageInput cipher={cipher} mode="decode" scheme="church" value="" error={null} onChange={noop} />,
    );
    expect(screen.getByLabelText("DNA sequence")).toHaveAttribute("maxlength", "4000");
  });
});
