import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadTestCipher } from "@/lib/cipher/test-cipher";
import { historyStore } from "@/lib/storage/history";
import { settingsStore } from "@/lib/storage/settings";
import { Workbench } from "./Workbench";

const cipher = loadTestCipher();

function setup() {
  const user = userEvent.setup();
  render(<Workbench cipher={cipher} />);
  return {
    user,
    field: () => screen.getByRole("textbox"),
    sequence: () => screen.getByTestId("result-sequence").textContent,
    pickScheme: (name: RegExp) => user.click(screen.getByRole("radio", { name })),
    pickMode: (name: "Encode" | "Decode") => user.click(screen.getByRole("radio", { name })),
    submit: (name: "Encode" | "Decode") => user.click(screen.getByRole("button", { name })),
  };
}

beforeEach(() => {
  // The stores are module singletons; reset their persisted state between tests.
  settingsStore.update(() => ({ scheme: "alphabetical", theme: null }));
  historyStore.update(() => []);
});

describe("Workbench: encode → decode round trip", () => {
  it("encodes with Alphabetical, then decodes back to the original", async () => {
    const t = setup();
    await t.user.type(t.field(), "Hi there");
    await t.submit("Encode");
    expect(t.sequence()).toBe(
      (cipher.encode("alphabetical", "Hi there") as { value: string }).value,
    );
    expect(t.sequence()).toHaveLength(32);

    await t.user.click(screen.getByRole("button", { name: "Decode this sequence" }));
    await t.submit("Decode");
    expect(screen.getByTestId("result-message")).toHaveTextContent("Hi there");
  });

  it("does the same with Church", async () => {
    const t = setup();
    await t.pickScheme(/Church/);
    await t.user.type(t.field(), "Hi there");
    await t.submit("Encode");
    expect(t.sequence()).toHaveLength(64);
    expect(t.sequence()).not.toMatch(/(.)\1/); // homopolymer-free
    await t.user.click(screen.getByRole("button", { name: "Decode this sequence" }));
    await t.submit("Decode");
    expect(screen.getByTestId("result-message")).toHaveTextContent("Hi there");
  });
});

describe("Workbench: scheme switching", () => {
  it("changes both the output and the expected length", async () => {
    const t = setup();
    await t.user.type(t.field(), "AB");
    await t.submit("Encode");
    const alphabetical = t.sequence();
    expect(alphabetical).toHaveLength(8);
    expect(screen.getByText(/2 characters → 8 nt \(4 nt per character, max 200 nt/)).toBeVisible();

    await t.pickScheme(/Church/);
    const church = t.sequence();
    expect(church).toHaveLength(16);
    expect(church).not.toBe(alphabetical);
    expect(screen.getByText(/2 characters → 16 nt \(8 nt per character, max 400 nt/)).toBeVisible();
  });

  it("persists the chosen scheme", async () => {
    const t = setup();
    await t.pickScheme(/Church/);
    expect(settingsStore.getSnapshot().scheme).toBe("church");
  });

  it("clears a decode result that is invalid under the new scheme, and says why", async () => {
    const t = setup();
    await t.pickMode("Decode");
    await t.user.type(t.field(), "CAAC");
    await t.submit("Decode");
    expect(screen.getByTestId("result-message")).toHaveTextContent("A");

    await t.pickScheme(/Church/);
    expect(screen.queryByTestId("result-message")).not.toBeInTheDocument();
    expect(screen.getByText("Sequence length 4 is not a multiple of 8.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Decode" })).toBeDisabled();
  });
});

describe("Workbench: validation blocks conversion", () => {
  it("disables Encode above 50 characters and shows the error", async () => {
    const t = setup();
    await t.user.click(t.field());
    await t.user.paste("x".repeat(51));
    expect(screen.getByRole("button", { name: "Encode" })).toBeDisabled();
    expect(screen.getByText("Message is 51 characters; the maximum is 50.")).toBeVisible();
    expect(historyStore.getSnapshot()).toHaveLength(0);
  });

  it("uses the active scheme's length rule for decode", async () => {
    const t = setup();
    await t.pickMode("Decode");
    await t.user.type(t.field(), "CAAC");
    expect(screen.getByRole("button", { name: "Decode" })).toBeEnabled(); // 4 ok for Alphabetical
    await t.pickScheme(/Church/);
    expect(screen.getByRole("button", { name: "Decode" })).toBeDisabled(); // 8 needed for Church
  });

  it("rejects decode input that is valid DNA but not a valid message", async () => {
    const t = setup();
    await t.pickMode("Decode");
    await t.user.type(t.field(), "AAAA");
    expect(screen.getByText(/decodes to byte 0, which is not printable ASCII/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Decode" })).toBeDisabled();
  });

  it("keeps a separate draft per mode", async () => {
    const t = setup();
    await t.user.type(t.field(), "hello");
    await t.pickMode("Decode");
    expect(t.field()).toHaveValue("");
    await t.user.type(t.field(), "CAAC");
    await t.pickMode("Encode");
    expect(t.field()).toHaveValue("hello");
  });

  it("clears a stale result as soon as the input is edited", async () => {
    const t = setup();
    await t.user.type(t.field(), "A");
    await t.submit("Encode");
    expect(t.sequence()).toBe("CAAC");
    await t.user.type(t.field(), "B");
    expect(screen.queryByTestId("result-sequence")).not.toBeInTheDocument();
    expect(screen.getByText("Your result will appear here.")).toBeInTheDocument();
  });
});

describe("Workbench: history", () => {
  it("records every conversion, in both modes, newest first", async () => {
    const t = setup();
    await t.user.type(t.field(), "A");
    await t.submit("Encode");
    await t.pickMode("Decode");
    await t.user.type(t.field(), "CAAC");
    await t.submit("Decode");

    const items = screen.getAllByTestId("history-item");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("Decode")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Encode")).toBeInTheDocument();
    expect(historyStore.getSnapshot().map((e) => [e.mode, e.input, e.output])).toEqual([
      ["decode", "CAAC", "A"],
      ["encode", "A", "CAAC"],
    ]);
  });

  it("stores the trimmed DNA (not the pasted whitespace) for decodes", async () => {
    const t = setup();
    await t.pickMode("Decode");
    await t.user.click(t.field());
    await t.user.paste("  caac\n");
    await t.submit("Decode");
    expect(historyStore.getSnapshot()[0]).toMatchObject({ input: "caac", output: "A" });
  });

  it("persists to localStorage, so a fresh page load sees it", async () => {
    const t = setup();
    await t.user.type(t.field(), "A");
    await t.submit("Encode");
    const raw = window.localStorage.getItem("dna-encoder:history");
    expect(JSON.parse(raw ?? "null")).toMatchObject({ version: 1, data: [{ input: "A" }] });
  });

  it("deletes one entry and clears all", async () => {
    const t = setup();
    for (const message of ["a", "b"]) {
      await t.user.clear(t.field());
      await t.user.type(t.field(), message);
      await t.submit("Encode");
    }
    expect(screen.getAllByTestId("history-item")).toHaveLength(2);

    await t.user.click(
      within(screen.getAllByTestId("history-item")[0]!).getByRole("button", { name: /Delete/ }),
    );
    expect(screen.getAllByTestId("history-item")).toHaveLength(1);

    await t.user.click(screen.getByRole("button", { name: "Clear all" }));
    await t.user.click(screen.getByRole("button", { name: "Yes, clear all" }));
    expect(screen.queryAllByTestId("history-item")).toHaveLength(0);
    expect(historyStore.getSnapshot()).toHaveLength(0);
  });

  it("loads an entry back into the form and result", async () => {
    const t = setup();
    await t.pickScheme(/Church/);
    await t.user.type(t.field(), "Hi");
    await t.submit("Encode");
    const expected = t.sequence();

    await t.pickScheme(/Alphabetical/); // changes result & scheme
    await t.user.click(
      within(screen.getAllByTestId("history-item")[1]!).getByRole("button", { name: /Load/ }),
    );
    expect(screen.getByRole("radio", { name: /Church/ })).toBeChecked();
    expect(t.field()).toHaveValue("Hi");
    expect(t.sequence()).toBe(expected);
  });

  it("warns, but keeps working, when storage is full", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const t = setup();
    await t.user.type(t.field(), "A");
    await t.submit("Encode");
    expect(t.sequence()).toBe("CAAC"); // conversion still works
    expect(screen.getByText(/storage is full/i)).toBeVisible();
  });
});

describe("Workbench: copy and export", () => {
  it("copies the sequence to the clipboard", async () => {
    const t = setup();
    await t.user.type(t.field(), "A");
    await t.submit("Encode");
    await t.user.click(screen.getByRole("button", { name: "Copy DNA sequence" }));
    expect(await navigator.clipboard.readText()).toBe("CAAC");
    expect(screen.getByRole("button", { name: "Copy DNA sequence" })).toHaveTextContent("Copied");
  });

  it("reports a failed copy instead of failing silently", async () => {
    const t = setup();
    await t.user.type(t.field(), "A");
    await t.submit("Encode");
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    await t.user.click(screen.getByRole("button", { name: "Copy DNA sequence" }));
    expect(await screen.findByText(/Copy failed/)).toBeVisible();
  });

  it("exports the history as an injection-safe CSV download", async () => {
    let captured = "";
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        void blob.text().then((text) => (captured = text));
        return "blob:x";
      },
      revokeObjectURL: () => {},
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const t = setup();
    await t.user.type(t.field(), "=1+1");
    await t.submit("Encode");
    await t.user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(click).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(captured).not.toBe(""));
    const [header, row] = captured.split("\r\n");
    expect(header).toBe("timestamp,mode,scheme,input,output");
    expect(row).toMatch(/,encode,alphabetical,'=1\+1,[ACGT]{16}$/);
  });
});
