//! WebAssembly boundary. Thin adapters only: every rule lives in the core crate.
//!
//! Errors cross the boundary as a `CipherError` object exposing a stable `code`
//! and a human-readable `message`.

use wasm_bindgen::prelude::*;

use crate::{DecodeError, EncodeError, Scheme, MAX_MESSAGE_CHARS};

#[wasm_bindgen]
pub struct CipherError {
    code: &'static str,
    message: String,
}

#[wasm_bindgen]
impl CipherError {
    #[wasm_bindgen(getter)]
    pub fn code(&self) -> String {
        self.code.to_owned()
    }

    #[wasm_bindgen(getter)]
    pub fn message(&self) -> String {
        self.message.clone()
    }
}

impl From<EncodeError> for CipherError {
    fn from(err: EncodeError) -> Self {
        Self {
            code: err.code(),
            message: err.to_string(),
        }
    }
}

impl From<DecodeError> for CipherError {
    fn from(err: DecodeError) -> Self {
        Self {
            code: err.code(),
            message: err.to_string(),
        }
    }
}

fn parse_scheme(id: &str) -> Result<Scheme, CipherError> {
    Scheme::from_id(id).ok_or_else(|| CipherError {
        code: "UNKNOWN_SCHEME",
        message: format!("Unknown scheme {id:?}."),
    })
}

#[wasm_bindgen]
pub fn encode(scheme: &str, message: &str) -> Result<String, CipherError> {
    Ok(parse_scheme(scheme)?.encode(message)?)
}

#[wasm_bindgen]
pub fn decode(scheme: &str, dna: &str) -> Result<String, CipherError> {
    Ok(parse_scheme(scheme)?.decode(dna)?)
}

#[wasm_bindgen]
pub fn max_message_chars() -> usize {
    MAX_MESSAGE_CHARS
}

#[wasm_bindgen]
pub fn bases_per_char(scheme: &str) -> Result<usize, CipherError> {
    Ok(parse_scheme(scheme)?.bases_per_char())
}

#[wasm_bindgen]
pub fn expected_dna_length(scheme: &str, chars: usize) -> Result<usize, CipherError> {
    Ok(parse_scheme(scheme)?.dna_len(chars))
}

#[wasm_bindgen]
pub fn max_dna_length(scheme: &str) -> Result<usize, CipherError> {
    Ok(parse_scheme(scheme)?.max_dna_len())
}
