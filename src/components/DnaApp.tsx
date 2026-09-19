"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/lib/hooks";
import type { Cipher } from "@/lib/cipher/types";
import { loadWasmCipher } from "@/lib/cipher/wasm-cipher";
import { ThemeToggle } from "./ThemeToggle";
import { Workbench } from "./Workbench";

type CipherState =
  | { status: "loading" }
  | { status: "ready"; cipher: Cipher }
  | { status: "error" };

interface DnaAppProps {
  /** Injectable for tests; production loads the WASM module. */
  loadCipher?: () => Promise<Cipher>;
}

export function DnaApp({ loadCipher = loadWasmCipher }: DnaAppProps) {
  const { theme, toggle } = useTheme();
  const [state, setState] = useState<CipherState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadCipher().then(
      (cipher) => !cancelled && setState({ status: "ready", cipher }),
      () => !cancelled && setState({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [loadCipher, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
            <rect width="32" height="32" rx="8" fill="var(--accent)" />
            <path
              d="M10 6c0 6 12 6 12 12s-12 6-12 8M22 6c0 6-12 6-12 12s12 6 12 8M12 11h8M12 21h8"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <h1 className="brand-title">DNA Encoder</h1>
            <p className="brand-tagline">Text ⇄ nucleotides, entirely in your browser.</p>
          </div>
        </div>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </header>

      <main className="app-main">
        {state.status === "ready" && <Workbench cipher={state.cipher} />}
        {state.status === "loading" && (
          <p className="placeholder" role="status">
            Loading cipher module…
          </p>
        )}
        {state.status === "error" && (
          <div className="card" role="alert">
            <p className="field-error">
              The cipher module could not be loaded. Check that the page finished loading and that
              WebAssembly is enabled in your browser.
            </p>
            <button type="button" className="btn" onClick={retry}>
              Try again
            </button>
          </div>
        )}
      </main>
    </>
  );
}
