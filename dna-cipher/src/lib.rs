//! Deterministic bit-to-nucleotide cipher for short ASCII messages.
//!
//! Two schemes share one [`Scheme`] interface:
//! * [`Scheme::Alphabetical`] – 2 bits per base, stateless (DNA Fountain mapping).
//! * [`Scheme::Church`] – 1 bit per base, no adjacent repeated base (Church 2012).
//!
//! Everything is pure and deterministic; there is no RNG and no I/O.

pub mod alphabetical;
mod base;
pub mod church;
mod error;
#[cfg(target_arch = "wasm32")]
mod wasm;

pub use error::{DecodeError, EncodeError};

/// Maximum message length in characters.
pub const MAX_MESSAGE_CHARS: usize = 50;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Scheme {
    Alphabetical,
    Church,
}

impl Scheme {
    pub const ALL: [Self; 2] = [Self::Alphabetical, Self::Church];

    /// Stable identifier used across the WASM boundary and in persisted data.
    pub const fn id(self) -> &'static str {
        match self {
            Self::Alphabetical => "alphabetical",
            Self::Church => "church",
        }
    }

    pub fn from_id(id: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|scheme| scheme.id() == id)
    }

    /// DNA bases produced per plaintext character.
    pub const fn bases_per_char(self) -> usize {
        match self {
            Self::Alphabetical => alphabetical::BASES_PER_CHAR,
            Self::Church => church::BASES_PER_CHAR,
        }
    }

    /// DNA length for a message of `chars` characters.
    pub const fn dna_len(self, chars: usize) -> usize {
        chars * self.bases_per_char()
    }

    /// DNA length of a maximum-length message.
    pub const fn max_dna_len(self) -> usize {
        self.dna_len(MAX_MESSAGE_CHARS)
    }

    pub fn encode(self, message: &str) -> Result<String, EncodeError> {
        match self {
            Self::Alphabetical => alphabetical::encode(message),
            Self::Church => church::encode(message),
        }
    }

    pub fn decode(self, dna: &str) -> Result<String, DecodeError> {
        match self {
            Self::Alphabetical => alphabetical::decode(dna),
            Self::Church => church::decode(dna),
        }
    }
}
