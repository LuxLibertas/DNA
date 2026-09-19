import { describe, expect, it, vi } from "vitest";
import { csvFilename, downloadTextFile } from "./download";

describe("csvFilename", () => {
  it("is filesystem-safe and sortable", () => {
    expect(csvFilename("dna-history", new Date("2026-09-20T12:30:45.678Z"))).toBe(
      "dna-history-2026-09-20T12-30-45.csv",
    );
  });
});

describe("downloadTextFile", () => {
  it("builds a Blob object URL, clicks a download link and revokes the URL", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      // Capture link state at click time (it is removed right after).
      expect(this.download).toBe("out.csv");
      expect(this.href).toBe("blob:test");
    });

    downloadTextFile("out.csv", "a,b\r\n");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(blob.size).toBe(5);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector("a[download]")).toBeNull(); // cleaned up
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    vi.useRealTimers();
  });
});
