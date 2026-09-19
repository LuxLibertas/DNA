import { useId, type ChangeEvent } from "react";
import { codePointLength, type Cipher, type Mode, type Scheme } from "@/lib/cipher/types";

const HARD_CAP_FACTOR = 10;

interface MessageInputProps {
  cipher: Cipher;
  mode: Mode;
  scheme: Scheme;
  /** Raw field text. */
  value: string;
  /** Message from the core when `value` is invalid, else null. */
  error: string | null;
  onChange: (value: string) => void;
}

/** Text field + live counter + scheme-aware length hint. Mode picks message vs DNA. */
export function MessageInput({ cipher, mode, scheme, value, error, onChange }: MessageInputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;

  const isEncode = mode === "encode";
  const perChar = cipher.basesPerChar(scheme);
  const maxDna = cipher.maxDnaLength(scheme);
  const maxChars = cipher.maxMessageChars;
  // Decode input is trimmed before validation, so count what will actually be checked.
  const count = codePointLength(isEncode ? value : value.trim());
  const limit = isEncode ? maxChars : maxDna;
  const overLimit = count > limit;
  // Not the validation limit (that must stay visible as an error), only a guard so a
  // multi-megabyte paste can't be re-validated on every keystroke.
  const hardCap = limit * HARD_CAP_FACTOR;

  const describedBy = [counterId, hintId, error ? errorId : null].filter(Boolean).join(" ");
  const common = {
    id,
    value,
    spellCheck: false,
    autoComplete: "off",
    autoCapitalize: "off",
    autoCorrect: "off",
    maxLength: hardCap,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    onChange: (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  } as const;

  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id} className="field-label">
          {isEncode ? "Message" : "DNA sequence"}
        </label>
        <span id={counterId} className={overLimit ? "counter counter-over" : "counter"}>
          {count}/{limit}
          {isEncode ? "" : " nt"}
        </span>
      </div>

      {isEncode ? (
        <input
          {...common}
          type="text"
          className="control"
          placeholder="Type a short message"
        />
      ) : (
        <textarea
          {...common}
          rows={4}
          className="control control-mono"
          placeholder="Paste a DNA sequence, e.g. CAACCAGA…"
        />
      )}

      <p id={hintId} className="hint">
        {isEncode ? (
          <>
            Up to {maxChars} printable ASCII characters. Output is {perChar} nt per character
            {count > 0 && !overLimit && ` — this message → ${cipher.expectedDnaLength(scheme, count)} nt`}
            {" "}(max {maxDna} nt).
          </>
        ) : (
          <>
            Length must be a multiple of {perChar} (max {maxDna} nt for this scheme). Letters A, C,
            G, T, any case.
          </>
        )}
      </p>

      <p id={errorId} className="field-error" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
