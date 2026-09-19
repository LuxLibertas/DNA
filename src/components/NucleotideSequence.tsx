import type { CSSProperties } from "react";

/**
 * Renders a DNA string with one colour per base, grouped in tens via CSS (no
 * whitespace in the text, so copy/select and `textContent` give the raw sequence).
 * The staggered fade-in is decorative and disabled under `prefers-reduced-motion`.
 */
export function NucleotideSequence({ sequence }: { sequence: string }) {
  return (
    // Keyed on the sequence so a new result replays the reveal animation.
    <code key={sequence} className="sequence" data-testid="result-sequence" translate="no">
      {Array.from(sequence, (base, index) => (
        <span
          key={index}
          className={`nt nt-${base}`}
          style={{ "--i": index } as CSSProperties}
        >
          {base}
        </span>
      ))}
    </code>
  );
}
