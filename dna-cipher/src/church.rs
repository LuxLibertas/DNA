//! Church scheme: 1 bit → 1 base (Church, Gao & Kosuri, Science 2012).
//!
//! Encoding is stateful: the message is one continuous bit stream and each bit
//! picks from `{A,C}` (0) or `{T,G}` (1), never repeating the previous base.
//! Decoding is stateless: `A,C→0`, `G,T→1`.

use crate::base::{bytes_to_message, parse_dna, validate_message, Base};
use crate::error::{DecodeError, EncodeError};

pub const BASES_PER_CHAR: usize = 8;

/// Candidate bases for a bit, in preference order.
const fn candidates(bit: u8) -> (Base, Base) {
    if bit == 0 {
        (Base::A, Base::C)
    } else {
        (Base::T, Base::G)
    }
}

/// Picks the base for `bit` given the previously emitted base.
///
/// The candidate sets `{A,C}` and `{T,G}` are disjoint, so a repeat can only
/// occur inside a run of equal bits, and this rule breaks every such repeat.
fn next_base(bit: u8, last: Option<Base>) -> Base {
    let (first, second) = candidates(bit);
    if last == Some(first) {
        second
    } else {
        first
    }
}

pub fn encode(message: &str) -> Result<String, EncodeError> {
    let bytes = validate_message(message)?;
    let mut last = None;
    let mut out = String::with_capacity(bytes.len() * BASES_PER_CHAR);
    for byte in bytes {
        for shift in (0..8).rev() {
            let base = next_base((byte >> shift) & 1, last);
            out.push(base.to_char());
            last = Some(base);
        }
    }
    Ok(out)
}

pub fn decode(dna: &str) -> Result<String, DecodeError> {
    let bases = parse_dna(dna, BASES_PER_CHAR)?;
    bytes_to_message(bases.chunks_exact(BASES_PER_CHAR).map(|octet| {
        octet
            .iter()
            .fold(0u8, |acc, base| (acc << 1) | base.one_bit())
    }))
}
