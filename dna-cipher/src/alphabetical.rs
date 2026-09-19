//! Alphabetical scheme: 2 bits → 1 base, stateless (`00→A, 01→C, 10→G, 11→T`).
//! Same mapping as DNA Fountain (Erlich & Zielinski, Science 2017).

use crate::base::{bytes_to_message, parse_dna, validate_message, Base};
use crate::error::{DecodeError, EncodeError};

pub const BASES_PER_CHAR: usize = 4;

pub fn encode(message: &str) -> Result<String, EncodeError> {
    let bytes = validate_message(message)?;
    Ok(bytes
        .iter()
        .flat_map(|&byte| [6u8, 4, 2, 0].map(|shift| Base::from_two_bits(byte >> shift).to_char()))
        .collect())
}

pub fn decode(dna: &str) -> Result<String, DecodeError> {
    let bases = parse_dna(dna, BASES_PER_CHAR)?;
    bytes_to_message(bases.chunks_exact(BASES_PER_CHAR).map(|quad| {
        quad.iter()
            .fold(0u8, |acc, base| (acc << 2) | base.two_bits())
    }))
}
