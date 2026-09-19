import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { loadTestCipher } from "@/lib/cipher/test-cipher";
import { SchemeSelector } from "./SchemeSelector";

const cipher = loadTestCipher();

describe("SchemeSelector", () => {
  it("offers exactly the two schemes, with the active one checked", () => {
    render(<SchemeSelector cipher={cipher} scheme="church" onChange={() => {}} />);
    const group = screen.getByRole("group", { name: "Encoding scheme" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /Church/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Alphabetical/ })).not.toBeChecked();
  });

  it("shows each scheme's own length figures from the core", () => {
    render(<SchemeSelector cipher={cipher} scheme="alphabetical" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: /Alphabetical/ })).toHaveAccessibleName(
      expect.stringContaining("4 nt per character · max 200 nt"),
    );
    expect(screen.getByRole("radio", { name: /Church/ })).toHaveAccessibleName(
      expect.stringContaining("8 nt per character · max 400 nt"),
    );
  });

  it("reports the chosen scheme", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SchemeSelector cipher={cipher} scheme="alphabetical" onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: /Church/ }));
    expect(onChange).toHaveBeenCalledWith("church");
  });

  it("is keyboard operable (arrow keys move the selection)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SchemeSelector cipher={cipher} scheme="alphabetical" onChange={onChange} />);
    screen.getByRole("radio", { name: /Alphabetical/ }).focus();
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenCalledWith("church");
  });
});
