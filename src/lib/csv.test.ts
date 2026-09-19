import { describe, expect, it } from "vitest";
import { CSV_HEADER, escapeCsvField, historyToCsv } from "./csv";
import type { HistoryEntry } from "@/lib/storage/history";

describe("escapeCsvField", () => {
  it("leaves plain values untouched", () => {
    expect(escapeCsvField("hello world")).toBe("hello world");
    expect(escapeCsvField("ACGT")).toBe("ACGT");
    expect(escapeCsvField("")).toBe("");
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])(
    "neutralises a leading %j (formula injection)",
    (trigger) => {
      const escaped = escapeCsvField(`${trigger}SUM(1+1)`);
      // Either "'<trigger>..." or the quoted equivalent: never starts with the trigger.
      expect(escaped.replace(/^"/, "")[0]).toBe("'");
    },
  );

  it.each([
    ['=HYPERLINK("http://evil","x")', `"'=HYPERLINK(""http://evil"",""x"")"`],
    ["=1+1", "'=1+1"],
    ["+1", "'+1"],
    ["-2", "'-2"],
    ["@SUM(A1)", "'@SUM(A1)"],
  ])("escapes %j to %j", (input, expected) => {
    expect(escapeCsvField(input)).toBe(expected);
  });

  it("only escapes when the trigger is the FIRST character", () => {
    expect(escapeCsvField("a=b")).toBe("a=b");
    expect(escapeCsvField("1-2")).toBe("1-2");
    expect(escapeCsvField(" =1")).toBe(" =1");
  });

  it("quotes fields containing commas, quotes or line breaks", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvField("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("applies both protections together", () => {
    expect(escapeCsvField("=A1,B1")).toBe(`"'=A1,B1"`);
  });
});

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: "1",
  mode: "encode",
  scheme: "alphabetical",
  input: "Hi",
  output: "CAGACGGC",
  createdAt: Date.UTC(2026, 8, 20, 12, 30, 0),
  ...overrides,
});

describe("historyToCsv", () => {
  it("emits a header and one CRLF-terminated row per entry", () => {
    const csv = historyToCsv([entry(), entry({ id: "2", mode: "decode", input: "CAAC", output: "A" })]);
    expect(csv).toBe(
      [
        CSV_HEADER.join(","),
        "2026-09-20T12:30:00.000Z,encode,alphabetical,Hi,CAGACGGC",
        "2026-09-20T12:30:00.000Z,decode,alphabetical,CAAC,A",
        "",
      ].join("\r\n"),
    );
  });

  it("is header-only for empty history", () => {
    expect(historyToCsv([])).toBe(`${CSV_HEADER.join(",")}\r\n`);
  });

  it("escapes hostile message text in the output", () => {
    const csv = historyToCsv([entry({ input: "=cmd|' /C calc'!A0", output: "-1,2" })]);
    expect(csv).toContain(`'=cmd|' /C calc'!A0`);
    expect(csv).toContain(`"'-1,2"`);
    expect(csv.split("\r\n")[1]).not.toMatch(/,=cmd/);
  });
});
