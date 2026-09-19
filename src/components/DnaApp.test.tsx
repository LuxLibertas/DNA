import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTestCipher } from "@/lib/cipher/test-cipher";
import { SETTINGS_KEY } from "@/lib/storage/settings";
import { DnaApp } from "./DnaApp";

const cipher = loadTestCipher();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DnaApp: module loading", () => {
  it("shows a loading state, then the workbench", async () => {
    render(<DnaApp loadCipher={() => Promise.resolve(cipher)} />);
    expect(screen.getByText("Loading cipher module…")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Encode" })).toBeInTheDocument();
    expect(screen.queryByText("Loading cipher module…")).not.toBeInTheDocument();
  });

  it("shows an actionable error and can retry", async () => {
    const loadCipher = vi
      .fn<() => Promise<typeof cipher>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(cipher);
    const user = userEvent.setup();
    render(<DnaApp loadCipher={loadCipher} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Encode" })).toBeInTheDocument();
    expect(loadCipher).toHaveBeenCalledTimes(2);
  });
});

describe("DnaApp: theme", () => {
  const toggle = () => screen.getByRole("switch", { name: "Dark mode" });

  it("toggles, applies data-theme and persists it in settings", async () => {
    const user = userEvent.setup();
    render(<DnaApp loadCipher={() => Promise.resolve(cipher)} />);
    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    await user.click(toggle());
    expect(toggle()).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null")).toMatchObject({
      version: 1,
      data: { theme: "dark" },
    });

    await user.click(toggle());
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("restores a persisted theme", () => {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ version: 1, data: { scheme: "alphabetical", theme: "dark" } }),
    );
    render(<DnaApp loadCipher={() => Promise.resolve(cipher)} />);
    expect(toggle()).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("follows the OS preference when nothing is saved", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("dark"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<DnaApp loadCipher={() => Promise.resolve(cipher)} />);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
