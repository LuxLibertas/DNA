//! Error types for encode / decode. Each variant carries enough context for a
//! precise, user-facing message and exposes a stable machine-readable `code()`.

use std::fmt;

/// Why a message could not be encoded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EncodeError {
    /// The message has no characters.
    Empty,
    /// The message has more than `max` characters.
    TooLong { max: usize, actual: usize },
    /// A character outside printable ASCII (32–126). `index` is a 0-based char index.
    InvalidCharacter { ch: char, index: usize },
}

/// Why a DNA sequence could not be decoded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DecodeError {
    /// The sequence has no characters.
    Empty,
    /// The sequence has more than `max` bases.
    TooLong { max: usize, actual: usize },
    /// A character other than A, C, G, T. `index` is a 0-based char index.
    InvalidCharacter { ch: char, index: usize },
    /// The sequence length is not a multiple of `multiple_of`.
    InvalidLength { multiple_of: usize, actual: usize },
    /// A decoded byte is outside printable ASCII (32–126), so the sequence is
    /// not a message this scheme could have produced. `index` is the 0-based
    /// index of the decoded character.
    NonPrintableByte { byte: u8, index: usize },
}

impl EncodeError {
    /// Stable identifier, safe to match on across the WASM boundary.
    pub const fn code(&self) -> &'static str {
        match self {
            Self::Empty => "EMPTY",
            Self::TooLong { .. } => "TOO_LONG",
            Self::InvalidCharacter { .. } => "INVALID_CHARACTER",
        }
    }
}

impl DecodeError {
    /// Stable identifier, safe to match on across the WASM boundary.
    pub const fn code(&self) -> &'static str {
        match self {
            Self::Empty => "EMPTY",
            Self::TooLong { .. } => "TOO_LONG",
            Self::InvalidCharacter { .. } => "INVALID_CHARACTER",
            Self::InvalidLength { .. } => "INVALID_LENGTH",
            Self::NonPrintableByte { .. } => "NON_PRINTABLE_BYTE",
        }
    }
}

impl fmt::Display for EncodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Empty => write!(f, "Message is empty. Enter at least 1 character."),
            Self::TooLong { max, actual } => {
                write!(f, "Message is {actual} characters; the maximum is {max}.")
            }
            Self::InvalidCharacter { ch, index } => write!(
                f,
                "Character {ch:?} at position {} is not printable ASCII (space to ~).",
                index + 1
            ),
        }
    }
}

impl fmt::Display for DecodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Empty => write!(f, "Sequence is empty. Paste a DNA sequence to decode."),
            Self::TooLong { max, actual } => {
                write!(f, "Sequence is {actual} bases; the maximum is {max}.")
            }
            Self::InvalidCharacter { ch, index } => write!(
                f,
                "Character {ch:?} at position {} is not one of A, C, G, T.",
                index + 1
            ),
            Self::InvalidLength {
                multiple_of,
                actual,
            } => write!(
                f,
                "Sequence length {actual} is not a multiple of {multiple_of}."
            ),
            Self::NonPrintableByte { byte, index } => write!(
                f,
                "Character {} decodes to byte {byte}, which is not printable ASCII (32–126). \
                 Check that the sequence and the selected scheme match.",
                index + 1
            ),
        }
    }
}

impl std::error::Error for EncodeError {}
impl std::error::Error for DecodeError {}
