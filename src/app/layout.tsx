import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DNA Encoder",
  description:
    "Encode short text messages into DNA sequences and decode them back, entirely in your browser. Two schemes: Alphabetical (DNA Fountain) and Church (2012).",
  // The page is a client-side tool; keep it out of referrer leakage by default.
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: theme-init.js sets data-theme before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking, same-origin script: applies the saved theme before first paint. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body>
        <noscript>
          <p className="noscript">This app needs JavaScript and WebAssembly to run.</p>
        </noscript>
        {children}
        <footer className="app-footer">
          <p className="disclaimer">
            Educational &amp; experimental use only. The tools are provided “as is”, without
            warranty. Outputs should be independently verified and should not be relied upon as a
            substitute for professional judgement. You use the tools at your own discretion and
            risk.
          </p>
          <p className="sources">
            Sources: Erlich &amp; Zielinski, “DNA Fountain enables a robust and efficient storage
            architecture”, <i>Science</i> 355, 950–954 (2017). Church, Gao &amp; Kosuri,
            “Next-Generation Digital Information Storage in DNA”, <i>Science</i> 337, 1628 (2012).
          </p>
        </footer>
      </body>
    </html>
  );
}
