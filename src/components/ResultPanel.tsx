import { useCopyToClipboard } from "@/lib/hooks";
import { SCHEME_INFO } from "@/lib/cipher/schemes";
import { codePointLength, type Cipher, type Mode, type Scheme } from "@/lib/cipher/types";
import { NucleotideSequence } from "./NucleotideSequence";

export interface ConversionResult {
  readonly mode: Mode;
  readonly scheme: Scheme;
  readonly input: string;
  readonly output: string;
  /** Epoch milliseconds. */
  readonly createdAt: number;
}

interface ResultPanelProps {
  cipher: Cipher;
  result: ConversionResult | null;
  onExport: () => void;
  /** Encode results only: send the sequence to the decoder. */
  onDecodeThis: () => void;
}

export function ResultPanel({ cipher, result, onExport, onDecodeThis }: ResultPanelProps) {
  const { state: copyState, copy } = useCopyToClipboard();

  if (!result) {
    return (
      <section className="card result" aria-labelledby="result-title">
        <h2 id="result-title" className="card-title">
          Result
        </h2>
        <p className="placeholder">Your result will appear here.</p>
      </section>
    );
  }

  const isEncode = result.mode === "encode";
  const dnaLength = codePointLength(isEncode ? result.output : result.input);
  const messageLength = codePointLength(isEncode ? result.input : result.output);
  const schemeLabel = SCHEME_INFO[result.scheme].label;
  const maxDna = cipher.maxDnaLength(result.scheme);

  return (
    <section className="card result" aria-labelledby="result-title">
      <div className="card-head">
        <h2 id="result-title" className="card-title">
          {isEncode ? "DNA sequence" : "Decoded message"}
        </h2>
        <span className="badge">{schemeLabel}</span>
      </div>

      {isEncode ? (
        <NucleotideSequence sequence={result.output} />
      ) : (
        <output className="message-out" data-testid="result-message">
          {result.output}
        </output>
      )}

      <p className="result-meta" role="status">
        {isEncode
          ? `${messageLength} characters → ${dnaLength} nt (${cipher.basesPerChar(result.scheme)} nt per character, max ${maxDna} nt for ${schemeLabel}).`
          : `${dnaLength} nt → ${messageLength} characters.`}
      </p>

      <div className="actions">
        <button
          type="button"
          className="btn"
          onClick={() => void copy(result.output)}
          aria-label={isEncode ? "Copy DNA sequence" : "Copy decoded message"}
        >
          {copyState === "copied" ? "Copied ✓" : "Copy"}
        </button>
        <button type="button" className="btn" onClick={onExport}>
          Export result (CSV)
        </button>
        {isEncode && (
          <button type="button" className="btn btn-ghost" onClick={onDecodeThis}>
            Decode this sequence
          </button>
        )}
        <span className="sr-only" role="status">
          {copyState === "copied" && "Copied to clipboard"}
        </span>
        {copyState === "failed" && (
          <span className="field-error" role="alert">
            Copy failed — select the text and copy it manually.
          </span>
        )}
      </div>
    </section>
  );
}
