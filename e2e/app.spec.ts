import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Small page-object so the specs read like the user's steps. */
function app(page: Page) {
  return {
    field: page.getByRole("textbox"),
    sequence: page.getByTestId("result-sequence"),
    message: page.getByTestId("result-message"),
    historyItems: page.getByTestId("history-item"),
    scheme: (name: "Alphabetical" | "Church") => page.getByRole("radio", { name: new RegExp(name) }),
    mode: (name: "Encode" | "Decode") => page.getByRole("radio", { name }),
    run: (name: "Encode" | "Decode") => page.getByRole("button", { name, exact: true }),
    async open() {
      await page.goto("/");
      // The WASM module loads asynchronously; the form only appears once it is ready.
      await expect(this.run("Encode")).toBeVisible();
    },
  };
}

test.describe("encode / decode round trip", () => {
  for (const [scheme, perChar] of [
    ["Alphabetical", 4],
    ["Church", 8],
  ] as const) {
    test(`${scheme}: encode → sequence → decode matches the original`, async ({ page }) => {
      const a = app(page);
      await a.open();
      const message = "Hello, DNA! 123";

      await a.scheme(scheme).check();
      await a.field.fill(message);
      await a.run("Encode").click();

      await expect(a.sequence).toBeVisible();
      const dna = (await a.sequence.textContent()) ?? "";
      expect(dna).toMatch(/^[ACGT]+$/);
      expect(dna).toHaveLength(message.length * perChar);
      if (scheme === "Church") expect(dna).not.toMatch(/(.)\1/);

      // Decode by pasting the sequence into the decoder, like a real user would.
      await a.mode("Decode").check();
      await a.field.fill(dna);
      await a.run("Decode").click();
      await expect(a.message).toHaveText(message);
    });
  }

  test("the 'Decode this sequence' shortcut carries the sequence over", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.field.fill("Round trip");
    await a.run("Encode").click();
    await page.getByRole("button", { name: "Decode this sequence" }).click();
    await expect(a.field).toHaveValue(/^[ACGT]{40}$/);
    await a.run("Decode").click();
    await expect(a.message).toHaveText("Round trip");
  });

  test("decoding is case-insensitive and tolerates surrounding whitespace", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.mode("Decode").check();
    await a.field.fill("  caag\n");
    await a.run("Decode").click();
    await expect(a.message).toHaveText("B");
  });

  test("Enter submits the encode form (keyboard-only flow)", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.field.focus();
    await page.keyboard.type("A");
    await page.keyboard.press("Enter");
    await expect(a.sequence).toHaveText("CAAC");
  });
});

test.describe("schemes", () => {
  test("switching schemes changes the output and the expected length", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.field.fill("AB");
    await a.run("Encode").click();

    const alphabetical = await a.sequence.textContent();
    expect(alphabetical).toBe("CAACCAAG");
    await expect(page.getByText(/2 characters → 8 nt \(4 nt per character, max 200 nt/)).toBeVisible();

    await a.scheme("Church").check();
    const church = await a.sequence.textContent();
    expect(church).toHaveLength(16);
    expect(church).not.toBe(alphabetical);
    await expect(page.getByText(/2 characters → 16 nt \(8 nt per character, max 400 nt/)).toBeVisible();
  });

  test("the hint shows each scheme's own max length", async ({ page }) => {
    const a = app(page);
    await a.open();
    await expect(page.getByText(/\(max 200 nt\)\./)).toBeVisible();
    await a.scheme("Church").check();
    await expect(page.getByText(/\(max 400 nt\)\./)).toBeVisible();
  });

  test("the chosen scheme survives a reload", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.scheme("Church").check();
    await page.reload();
    await expect(a.run("Encode")).toBeVisible();
    await expect(a.scheme("Church")).toBeChecked();
  });
});

test.describe("input validation", () => {
  test("blocks more than 50 characters with a visible error", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.field.fill("x".repeat(50));
    await expect(page.getByText("50/50")).toBeVisible();
    await expect(a.run("Encode")).toBeEnabled();

    await a.field.fill("x".repeat(51));
    await expect(page.getByText("51/50")).toBeVisible();
    await expect(page.getByText("Message is 51 characters; the maximum is 50.")).toBeVisible();
    await expect(a.run("Encode")).toBeDisabled();
    await expect(a.historyItems).toHaveCount(0);
  });

  test("rejects non-ASCII characters", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.field.fill("naïve");
    await expect(page.getByText(/Character 'ï' at position 3 is not printable ASCII/)).toBeVisible();
    await expect(a.run("Encode")).toBeDisabled();
  });

  test("decode uses the multiple-of-4 rule for Alphabetical", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.mode("Decode").check();
    await a.field.fill("CAACC");
    await expect(page.getByText("Sequence length 5 is not a multiple of 4.")).toBeVisible();
    await expect(a.run("Decode")).toBeDisabled();
    await a.field.fill("CAAC");
    await expect(a.run("Decode")).toBeEnabled();
  });

  test("decode uses the multiple-of-8 rule for Church", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.scheme("Church").check();
    await a.mode("Decode").check();
    await a.field.fill("CAAC"); // valid length for Alphabetical, not for Church
    await expect(page.getByText("Sequence length 4 is not a multiple of 8.")).toBeVisible();
    await expect(a.run("Decode")).toBeDisabled();
    await a.field.fill("ATACACAT");
    await expect(a.run("Decode")).toBeEnabled();
  });

  test("decode rejects characters outside A/C/G/T", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.mode("Decode").check();
    await a.field.fill("CAAU");
    await expect(page.getByText("Character 'U' at position 4 is not one of A, C, G, T.")).toBeVisible();
    await expect(a.run("Decode")).toBeDisabled();
  });

  test("decode rejects sequences that do not map to printable text", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.mode("Decode").check();
    await a.field.fill("AAAA");
    await expect(page.getByText(/not printable ASCII/)).toBeVisible();
  });
});

test.describe("history", () => {
  test("persists across a reload, can delete one entry, and can be cleared", async ({ page }) => {
    const a = app(page);
    await a.open();
    for (const message of ["one", "two", "three"]) {
      await a.field.fill(message);
      await a.run("Encode").click();
      await expect(a.sequence).toBeVisible();
    }
    await expect(a.historyItems).toHaveCount(3);

    await page.reload();
    await expect(a.run("Encode")).toBeVisible();
    await expect(a.historyItems).toHaveCount(3);
    await expect(a.historyItems.first()).toContainText("three");

    await a.historyItems.first().getByRole("button", { name: /Delete/ }).click();
    await expect(a.historyItems).toHaveCount(2);
    await page.reload();
    await expect(a.historyItems).toHaveCount(2);

    await page.getByRole("button", { name: "Clear all" }).click();
    await page.getByRole("button", { name: "Yes, clear all" }).click();
    await expect(a.historyItems).toHaveCount(0);
    await page.reload();
    await expect(a.run("Encode")).toBeVisible();
    await expect(page.getByText(/No conversions yet/)).toBeVisible();
  });

  test("records decodes too, and 'Load' restores an entry", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.scheme("Church").check();
    await a.mode("Decode").check();
    await a.field.fill("ATACACAT");
    await a.run("Decode").click();
    await expect(a.historyItems.first()).toContainText("Decode");

    await a.scheme("Alphabetical").check();
    await a.historyItems.first().getByRole("button", { name: /Load/ }).click();
    await expect(a.scheme("Church")).toBeChecked();
    await expect(a.field).toHaveValue("ATACACAT");
    await expect(a.message).toHaveText("A");
  });

  test("recovers from corrupted localStorage instead of crashing", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("dna-encoder:history", "{definitely not json");
      localStorage.setItem("dna-encoder:settings", '{"version":1,"data":{"scheme":"<script>","theme":5}}');
    });
    const a = app(page);
    await a.open();
    await expect(a.historyItems).toHaveCount(0);
    await expect(a.scheme("Alphabetical")).toBeChecked();

    await a.field.fill("ok");
    await a.run("Encode").click();
    await expect(a.historyItems).toHaveCount(1);
  });

  test("ignores hostile history entries (markup is rendered as text)", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "dna-encoder:history",
        JSON.stringify({
          version: 1,
          data: [
            {
              id: "1",
              mode: "encode",
              scheme: "church",
              input: "<img src=x onerror=window.__pwned=1>",
              output: "ACGT",
              createdAt: 1_700_000_000_000,
            },
            { id: "2", mode: "hax", scheme: "church", input: "x", output: "y", createdAt: 1 },
          ],
        }),
      );
    });
    const a = app(page);
    await a.open();
    await expect(a.historyItems).toHaveCount(1);
    await expect(a.historyItems.first()).toContainText("<img src=x onerror=window.__pwned=1>");
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    expect(await page.locator("img").count()).toBe(0);
  });
});

test.describe("CSV export", () => {
  test("history export downloads a correct, injection-safe file", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.field.fill("=1+1");
    await a.run("Encode").click();
    await a.field.fill("Hello, \"world\"");
    await a.run("Encode").click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^dna-history-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
    const stream = await download.createReadStream();
    let csv = "";
    for await (const chunk of stream) csv += chunk.toString("utf8");

    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("timestamp,mode,scheme,input,output");
    expect(lines).toHaveLength(4); // header + 2 rows + trailing empty
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z,encode,alphabetical,"Hello, ""world""",[ACGT]{56}$/);
    expect(lines[2]).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z,encode,alphabetical,'=1\+1,[ACGT]{16}$/);
  });

  test("the current result can be exported on its own", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.field.fill("A");
    await a.run("Encode").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export result (CSV)" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^dna-result-/);
    const stream = await download.createReadStream();
    let csv = "";
    for await (const chunk of stream) csv += chunk.toString("utf8");
    expect(csv.split("\r\n")[1]).toMatch(/,encode,alphabetical,A,CAAC$/);
  });
});

test.describe("clipboard", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copies the DNA sequence", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.field.fill("A");
    await a.run("Encode").click();
    await page.getByRole("button", { name: "Copy DNA sequence" }).click();
    await expect(page.getByRole("button", { name: "Copy DNA sequence" })).toHaveText(/Copied/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("CAAC");
  });
});

test.describe("theme", () => {
  test("toggle persists across reloads and is applied before hydration", async ({ page }) => {
    const a = app(page);
    await a.open();
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.getByRole("switch", { name: "Dark mode" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page.reload({ waitUntil: "commit" });
    // theme-init.js is a blocking head script, so the attribute exists at first parse.
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await expect(a.run("Encode")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Dark mode" })).toHaveAttribute("aria-checked", "true");
  });

  test("follows the OS preference when nothing is saved", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await app(page).open();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await context.close();
  });
});

test.describe("security & offline", () => {
  test("makes no external requests, throws no errors, and has no CSP violations", async ({ page }) => {
    const external: string[] = [];
    const problems: string[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (!["127.0.0.1"].includes(url.hostname) && !["data:", "blob:"].includes(url.protocol)) {
        external.push(req.url());
      }
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
    });
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    await page.addInitScript(() => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener("securitypolicyviolation", (event) =>
        (window as unknown as { __csp: string[] }).__csp.push(`${event.violatedDirective}: ${event.blockedURI}`),
      );
    });

    const a = app(page);
    await a.open();
    // Exercise the app so lazy paths (WASM, storage, animation, download, copy) run too.
    await a.field.fill("Security check");
    await a.run("Encode").click();
    await expect(a.sequence).toBeVisible();
    await page.getByRole("switch", { name: "Dark mode" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    await download;

    expect(external).toEqual([]);
    expect(problems).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  });

  test("every page ships a strict CSP <meta> with no unsafe-inline / unsafe-eval", async ({ page }) => {
    await page.goto("/");
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toMatch(/unsafe-inline|'unsafe-eval'/);
  });

  test("keeps working fully offline once loaded", async ({ page, context }) => {
    const a = app(page);
    await a.open();
    await context.setOffline(true);

    await a.scheme("Church").check();
    await a.field.fill("Offline ok");
    await a.run("Encode").click();
    await expect(a.sequence).toHaveText(/^[ACGT]{80}$/);
    await expect(a.historyItems).toHaveCount(1);
  });

  test("JavaScript execution from input is impossible (rendered as text)", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.mode("Decode").check();
    await a.field.fill("<img src=x onerror=window.__pwned=1>");
    await expect(page.getByText(/is not one of A, C, G, T/)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  });
});

test.describe("accessibility & responsiveness", () => {
  test("has no axe violations (light and dark, with a result on screen)", async ({ page }) => {
    const a = app(page);
    await a.open();
    await a.field.fill("Accessible");
    await a.run("Encode").click();
    await expect(a.sequence).toBeVisible();

    const light = await new AxeBuilder({ page }).analyze();
    expect(light.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    await page.getByRole("switch", { name: "Dark mode" }).click();
    const dark = await new AxeBuilder({ page }).analyze();
    expect(dark.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test("controls are reachable and show a focus indicator by keyboard", async ({ page }) => {
    const a = app(page);
    await a.open();
    await page.keyboard.press("Tab"); // theme switch
    await expect(page.getByRole("switch", { name: "Dark mode" })).toBeFocused();
    const outline = await page.getByRole("switch", { name: "Dark mode" }).evaluate(
      (el) => getComputedStyle(el).outlineStyle,
    );
    expect(outline).not.toBe("none");
  });

  test("fits a 360px-wide phone without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const a = app(page);
    await a.open();
    await a.scheme("Church").check();
    await a.field.fill("x".repeat(50));
    await a.run("Encode").click();
    await expect(a.sequence).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("shows the required disclaimer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Educational & experimental use only\. The tools are provided “as is”/)).toBeVisible();
    await expect(page.getByText(/at your own discretion and risk\./)).toBeVisible();
  });
});
