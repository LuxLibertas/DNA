import { MODES, type Mode } from "@/lib/cipher/types";

const LABELS: Record<Mode, string> = { encode: "Encode", decode: "Decode" };

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

/** Segmented control built on native radios: arrow keys and screen readers just work. */
export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <fieldset className="segmented">
      <legend className="sr-only">Mode</legend>
      {MODES.map((value) => (
        <label key={value} className="segmented-option">
          <input
            type="radio"
            name="mode"
            value={value}
            checked={mode === value}
            onChange={() => onChange(value)}
            className="segmented-input"
          />
          <span>{LABELS[value]}</span>
        </label>
      ))}
    </fieldset>
  );
}
