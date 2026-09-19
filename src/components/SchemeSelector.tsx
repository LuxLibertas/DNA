import { SCHEME_INFO } from "@/lib/cipher/schemes";
import { SCHEMES, type Cipher, type Scheme } from "@/lib/cipher/types";

interface SchemeSelectorProps {
  cipher: Cipher;
  scheme: Scheme;
  onChange: (scheme: Scheme) => void;
}

export function SchemeSelector({ cipher, scheme, onChange }: SchemeSelectorProps) {
  return (
    <fieldset className="schemes">
      <legend className="field-label">Encoding scheme</legend>
      <div className="scheme-grid">
        {SCHEMES.map((value) => {
          const info = SCHEME_INFO[value];
          return (
            <label key={value} className="scheme-card">
              <input
                type="radio"
                name="scheme"
                value={value}
                checked={scheme === value}
                onChange={() => onChange(value)}
              />
              <span className="scheme-body">
                <span className="scheme-title">{info.label}</span>
                <span className="scheme-facts">
                  {cipher.basesPerChar(value)} nt per character · max {cipher.maxDnaLength(value)}{" "}
                  nt
                </span>
                <span className="scheme-summary">{info.summary}</span>
                <span className="scheme-cite">{info.citation}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
