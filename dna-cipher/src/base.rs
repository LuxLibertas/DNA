//! The four nucleotides and the shared input validation used by both schemes.

use crate::error::{DecodeError, EncodeError};
use crate::MAX_MESSAGE_CHARS;

/// Lowest printable ASCII code point (space).
pub(crate) const MIN_PRINTABLE: u8 = 32;
/// Highest printable ASCII code point (`~`).
pub(crate) const MAX_PRINTABLE: u8 = 126;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Base {
    A,
    C,
    G,
    T,
}

impl Base {
    pub(crate) const fn to_char(self) -> char {
        match self {
            Self::A => 'A',
            Self::C => 'C',
            Self::G => 'G',
            Self::T => 'T',
        }
    }

    /// Case-insensitive; anything but A/C/G/T (ASCII) is `None`.
    const fn from_char(ch: char) -> Option<Self> {
        match ch.to_ascii_uppercase() {
            'A' => Some(Self::A),
            'C' => Some(Self::C),
            'G' => Some(Self::G),
            'T' => Some(Self::T),
            _ => None,
        }
    }

    /// Alphabetical scheme: `00→A, 01→C, 10→G, 11→T`. Only the low 2 bits are used.
    pub(crate) const fn from_two_bits(bits: u8) -> Self {
        match bits & 0b11 {
            0b00 => Self::A,
            0b01 => Self::C,
            0b10 => Self::G,
            _ => Self::T,
        }
    }

    pub(crate) const fn two_bits(self) -> u8 {
        match self {
            Self::A => 0b00,
            Self::C => 0b01,
            Self::G => 0b10,
            Self::T => 0b11,
        }
    }

    /// Church scheme: `A,C→0` and `G,T→1`.
    pub(crate) const fn one_bit(self) -> u8 {
        match self {
            Self::A | Self::C => 0,
            Self::G | Self::T => 1,
        }
    }
}

/// Validates a plaintext message (1–50 printable-ASCII chars) and returns its bytes.
pub(crate) fn validate_message(message: &str) -> Result<Vec<u8>, EncodeError> {
    // Bounded count: never walks more than MAX + 1 chars just to detect "too long".
    let count = message.chars().take(MAX_MESSAGE_CHARS + 1).count();
    if count == 0 {
        return Err(EncodeError::Empty);
    }
    if count > MAX_MESSAGE_CHARS {
        return Err(EncodeError::TooLong {
            max: MAX_MESSAGE_CHARS,
            actual: message.chars().count(),
        });
    }
    message
        .chars()
        .enumerate()
        .map(|(index, ch)| match u8::try_from(ch) {
            Ok(b) if (MIN_PRINTABLE..=MAX_PRINTABLE).contains(&b) => Ok(b),
            _ => Err(EncodeError::InvalidCharacter { ch, index }),
        })
        .collect()
}

/// Validates and parses a DNA sequence for a scheme that uses `bases_per_char`
/// bases per character. Checks, in order: non-empty, within the length cap,
/// alphabet, then length multiple.
pub(crate) fn parse_dna(dna: &str, bases_per_char: usize) -> Result<Vec<Base>, DecodeError> {
    let max = MAX_MESSAGE_CHARS * bases_per_char;
    let count = dna.chars().take(max + 1).count();
    if count == 0 {
        return Err(DecodeError::Empty);
    }
    if count > max {
        return Err(DecodeError::TooLong {
            max,
            actual: dna.chars().count(),
        });
    }
    let bases = dna
        .chars()
        .enumerate()
        .map(|(index, ch)| Base::from_char(ch).ok_or(DecodeError::InvalidCharacter { ch, index }))
        .collect::<Result<Vec<_>, _>>()?;
    if bases.len() % bases_per_char != 0 {
        return Err(DecodeError::InvalidLength {
            multiple_of: bases_per_char,
            actual: bases.len(),
        });
    }
    Ok(bases)
}

/// Turns decoded bytes into a `String`, rejecting anything outside printable ASCII.
pub(crate) fn bytes_to_message(bytes: impl Iterator<Item = u8>) -> Result<String, DecodeError> {
    bytes
        .enumerate()
        .map(|(index, byte)| {
            if (MIN_PRINTABLE..=MAX_PRINTABLE).contains(&byte) {
                Ok(char::from(byte))
            } else {
                Err(DecodeError::NonPrintableByte { byte, index })
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_bit_mapping_round_trips() {
        for bits in 0..4u8 {
            assert_eq!(Base::from_two_bits(bits).two_bits(), bits);
        }
    }

    #[test]
    fn from_char_is_case_insensitive_and_ascii_only() {
        assert_eq!(Base::from_char('a'), Some(Base::A));
        assert_eq!(Base::from_char('T'), Some(Base::T));
        assert_eq!(Base::from_char('U'), None);
        assert_eq!(Base::from_char('\u{131}'), None); // dotless i must not fold to an ASCII letter
        assert_eq!(Base::from_char('\u{212A}'), None); // Kelvin sign
    }

    #[test]
    fn one_bit_mapping_matches_spec() {
        assert_eq!(Base::A.one_bit(), 0);
        assert_eq!(Base::C.one_bit(), 0);
        assert_eq!(Base::G.one_bit(), 1);
        assert_eq!(Base::T.one_bit(), 1);
    }

    #[test]
    fn oversized_input_reports_full_length_but_is_rejected_early() {
        let huge = "A".repeat(1_000_000);
        assert_eq!(
            parse_dna(&huge, 4),
            Err(DecodeError::TooLong {
                max: 200,
                actual: 1_000_000
            })
        );
    }
}
