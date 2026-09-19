"use client";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Last-resort boundary: an unexpected failure (e.g. a WASM trap) shows this, not a blank page. */
export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="app-main">
      <div className="card" role="alert">
        <h1 className="card-title">Something went wrong</h1>
        <p className="field-error">
          An unexpected error stopped the app. Your saved history is unaffected.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
