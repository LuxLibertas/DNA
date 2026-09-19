#![allow(clippy::unwrap_used, clippy::expect_used, clippy::indexing_slicing)]

use dna_cipher::{DecodeError, EncodeError, Scheme, MAX_MESSAGE_CHARS};
use proptest::prelude::*;

fn printable_ascii() -> impl Strategy<Value = String> {
    proptest::collection::vec(32u8..=126, 1..=MAX_MESSAGE_CHARS)
        .prop_map(|bytes| bytes.into_iter().map(char::from).collect())
}

fn no_adjacent_repeats(dna: &str) -> bool {
    dna.as_bytes().windows(2).all(|pair| pair[0] != pair[1])
}

// ---------------------------------------------------------------- known vectors

#[test]
fn alphabetical_known_vectors() {
    // 'A' = 0x41 = 01 00 00 01
    assert_eq!(Scheme::Alphabetical.encode("A").unwrap(), "CAAC");
    // 'H' = 01 00 10 00, 'i' = 01 10 10 01
    assert_eq!(Scheme::Alphabetical.encode("Hi").unwrap(), "CAGACGGC");
    // ' ' = 00 10 00 00, '~' = 01 11 11 10
    assert_eq!(Scheme::Alphabetical.encode(" ").unwrap(), "AGAA");
    assert_eq!(Scheme::Alphabetical.encode("~").unwrap(), "CTTG");
}

#[test]
fn church_known_vectors() {
    // 'A' = 0100 0001 -> A T A C A C A T (hand-derived from the spec's rule)
    assert_eq!(Scheme::Church.encode("A").unwrap(), "ATACACAT");
    // '~' = 0111 1110 -> A T G T G T G A
    assert_eq!(Scheme::Church.encode("~").unwrap(), "ATGTGTGA");
}

#[test]
fn church_bit_stream_is_continuous_across_characters() {
    // "AA" is 01000001 01000001. The second 'A' starts with bit 0 right after
    // a trailing T, so it starts with A -- the same as it would in isolation --
    // but the stream must not reset: check the whole string against the rule.
    assert_eq!(Scheme::Church.encode("AA").unwrap(), "ATACACATATACACAT");
    // "\x7f"-free example where the boundary matters: '~' ends in bit 0 after G
    // (-> A); a following '~' starts with bit 0 -> last=A is candidate[0] -> C.
    let encoded = Scheme::Church.encode("~~").unwrap();
    assert_eq!(&encoded[..8], "ATGTGTGA");
    assert_eq!(&encoded[8..], "CTGTGTGA");
}

#[test]
fn church_decode_ignores_which_synonym_was_used() {
    // Same bits as 'A' (0,1,0,0,0,0,0,1) but every 0 -> C and every 1 -> G.
    assert_eq!(Scheme::Church.decode("CGCCCCCG").unwrap(), "A");
    assert_eq!(Scheme::Church.decode("ATACACAT").unwrap(), "A");
}

// ------------------------------------------------------------ boundaries / sizes

#[test]
fn boundary_lengths() {
    for scheme in Scheme::ALL {
        let one = scheme.encode("x").unwrap();
        assert_eq!(one.len(), scheme.bases_per_char());
        assert_eq!(scheme.decode(&one).unwrap(), "x");

        let fifty = "x".repeat(50);
        let dna = scheme.encode(&fifty).unwrap();
        assert_eq!(dna.len(), scheme.max_dna_len());
        assert_eq!(scheme.decode(&dna).unwrap(), fifty);

        assert_eq!(scheme.encode(""), Err(EncodeError::Empty));
        assert_eq!(
            scheme.encode(&"x".repeat(51)),
            Err(EncodeError::TooLong {
                max: 50,
                actual: 51
            })
        );
    }
}

#[test]
fn scheme_metadata_is_scheme_specific() {
    assert_eq!(Scheme::Alphabetical.bases_per_char(), 4);
    assert_eq!(Scheme::Church.bases_per_char(), 8);
    assert_eq!(Scheme::Alphabetical.max_dna_len(), 200);
    assert_eq!(Scheme::Church.max_dna_len(), 400);
    assert_eq!(Scheme::Alphabetical.dna_len(7), 28);
    assert_eq!(Scheme::Church.dna_len(7), 56);
}

#[test]
fn scheme_ids_round_trip() {
    for scheme in Scheme::ALL {
        assert_eq!(Scheme::from_id(scheme.id()), Some(scheme));
    }
    assert_eq!(Scheme::from_id("Church"), None);
    assert_eq!(Scheme::from_id(""), None);
}

// ------------------------------------------------------------- invalid encode

#[test]
fn encode_rejects_non_printable_and_non_ascii() {
    for scheme in Scheme::ALL {
        for (input, ch, index) in [
            ("a\nb", '\n', 1),
            ("\tx", '\t', 0),
            ("abc\u{7f}", '\u{7f}', 3), // DEL is outside 32..=126
            ("h\u{e9}llo", '\u{e9}', 1),
            ("hi \u{1f9ec}", '\u{1f9ec}', 3),
            ("\0", '\0', 0),
        ] {
            assert_eq!(
                scheme.encode(input),
                Err(EncodeError::InvalidCharacter { ch, index }),
                "{scheme:?} / {input:?}"
            );
        }
    }
}

#[test]
fn encode_accepts_every_printable_character() {
    let all: String = (32u8..=126).map(char::from).collect(); // 95 chars
    for scheme in Scheme::ALL {
        for chunk in all.as_bytes().chunks(MAX_MESSAGE_CHARS) {
            let msg = std::str::from_utf8(chunk).unwrap();
            assert_eq!(scheme.decode(&scheme.encode(msg).unwrap()).unwrap(), msg);
        }
    }
}

#[test]
fn too_long_takes_precedence_over_invalid_character_and_reports_true_length() {
    let input = format!("{}\n", "x".repeat(60));
    assert_eq!(
        Scheme::Church.encode(&input),
        Err(EncodeError::TooLong {
            max: 50,
            actual: 61
        })
    );
}

// ------------------------------------------------------------- invalid decode

#[test]
fn alphabetical_decode_requires_multiple_of_4() {
    for len in [1, 2, 3, 5, 6, 7, 9, 199] {
        assert_eq!(
            Scheme::Alphabetical.decode(&"C".repeat(len)),
            Err(DecodeError::InvalidLength {
                multiple_of: 4,
                actual: len
            }),
            "len {len}"
        );
    }
}

#[test]
fn church_decode_requires_multiple_of_8_not_4() {
    // 4 and 12 are valid for Alphabetical but must fail for Church.
    for len in [1, 4, 7, 9, 12, 20, 399] {
        assert_eq!(
            Scheme::Church.decode(&"C".repeat(len)),
            Err(DecodeError::InvalidLength {
                multiple_of: 8,
                actual: len
            }),
            "len {len}"
        );
    }
}

#[test]
fn decode_rejects_characters_outside_acgt() {
    for scheme in Scheme::ALL {
        let base = "C".repeat(scheme.bases_per_char());
        for bad in ['N', 'U', 'X', '0', ' ', '\n', '-', '\u{e9}', '\u{1f9ec}'] {
            let input = format!("{}{bad}", &base[..base.len() - 1]);
            assert_eq!(
                scheme.decode(&input),
                Err(DecodeError::InvalidCharacter {
                    ch: bad,
                    index: base.len() - 1
                }),
                "{scheme:?} / {bad:?}"
            );
        }
    }
}

#[test]
fn decode_rejects_empty_and_oversized_input() {
    for scheme in Scheme::ALL {
        assert_eq!(scheme.decode(""), Err(DecodeError::Empty));
        let too_long = "A".repeat(scheme.max_dna_len() + scheme.bases_per_char());
        assert_eq!(
            scheme.decode(&too_long),
            Err(DecodeError::TooLong {
                max: scheme.max_dna_len(),
                actual: too_long.len()
            })
        );
    }
}

#[test]
fn decode_is_case_insensitive() {
    assert_eq!(Scheme::Alphabetical.decode("caac").unwrap(), "A");
    assert_eq!(Scheme::Alphabetical.decode("CaAc").unwrap(), "A");
    assert_eq!(Scheme::Church.decode("atacacat").unwrap(), "A");
}

#[test]
fn decode_rejects_bytes_outside_printable_ascii() {
    // 0x00, 0xFF, 0x1F (just below space), 0x7F (DEL) in the Alphabetical scheme.
    for (dna, byte) in [("AAAA", 0u8), ("TTTT", 255), ("ACTT", 31), ("CTTT", 127)] {
        assert_eq!(
            Scheme::Alphabetical.decode(dna),
            Err(DecodeError::NonPrintableByte { byte, index: 0 }),
            "{dna}"
        );
    }
    // 0x20 (space) is the lowest accepted byte.
    assert_eq!(Scheme::Alphabetical.decode("AGAA").unwrap(), " ");
    // Church: all-A is byte 0; index points at the offending character.
    assert_eq!(
        Scheme::Church.decode("ATACACATAAAAAAAA"),
        Err(DecodeError::NonPrintableByte { byte: 0, index: 1 })
    );
}

#[test]
fn error_codes_and_messages_are_stable() {
    assert_eq!(EncodeError::Empty.code(), "EMPTY");
    assert_eq!(
        EncodeError::InvalidCharacter { ch: 'x', index: 0 }.code(),
        "INVALID_CHARACTER"
    );
    assert_eq!(
        DecodeError::InvalidLength {
            multiple_of: 8,
            actual: 4
        }
        .to_string(),
        "Sequence length 4 is not a multiple of 8."
    );
    assert_eq!(
        DecodeError::NonPrintableByte { byte: 0, index: 0 }.code(),
        "NON_PRINTABLE_BYTE"
    );
    // Control characters are escaped in messages, never echoed raw.
    let msg = EncodeError::InvalidCharacter { ch: '\n', index: 2 }.to_string();
    assert!(msg.contains("'\\n'") && msg.contains("position 3"), "{msg}");
}

// ------------------------------------------------------ Church: homopolymers

#[test]
fn church_never_repeats_a_base_for_every_one_and_two_char_message() {
    let printable: Vec<char> = (32u8..=126).map(char::from).collect();
    for &a in &printable {
        let single = Scheme::Church.encode(&a.to_string()).unwrap();
        assert!(no_adjacent_repeats(&single), "{a:?} -> {single}");
        for &b in &printable {
            let pair: String = [a, b].iter().collect();
            let dna = Scheme::Church.encode(&pair).unwrap();
            assert!(no_adjacent_repeats(&dna), "{pair:?} -> {dna}");
            assert_eq!(Scheme::Church.decode(&dna).unwrap(), pair);
        }
    }
}

#[test]
fn church_worst_case_runs_of_identical_bits_alternate() {
    // '@' is 0100 0000 and DEL-adjacent '~' is 0111 1110: long same-bit runs.
    let dna = Scheme::Church.encode(&"@".repeat(50)).unwrap();
    assert!(no_adjacent_repeats(&dna));
    let dna = Scheme::Church.encode(&"~".repeat(50)).unwrap();
    assert!(no_adjacent_repeats(&dna));
}

#[test]
fn alphabetical_does_produce_homopolymers() {
    // Expected per spec: a repeated 2-bit chunk is a repeated base.
    assert!(!no_adjacent_repeats(
        &Scheme::Alphabetical.encode("A").unwrap()
    ));
}

#[test]
fn church_output_bases_match_their_bit_class() {
    let msg = "The quick brown fox";
    let dna = Scheme::Church.encode(msg).unwrap();
    let bits: Vec<u8> = msg
        .bytes()
        .flat_map(|byte| (0..8).rev().map(move |shift| (byte >> shift) & 1))
        .collect();
    for (base, bit) in dna.chars().zip(bits) {
        match bit {
            0 => assert!(matches!(base, 'A' | 'C'), "{base}"),
            _ => assert!(matches!(base, 'T' | 'G'), "{base}"),
        }
    }
}

// ------------------------------------------------------------------ properties

proptest! {
    #![proptest_config(ProptestConfig { failure_persistence: None, ..ProptestConfig::default() })]

    #[test]
    fn prop_round_trip(msg in printable_ascii()) {
        for scheme in Scheme::ALL {
            let dna = scheme.encode(&msg).unwrap();
            prop_assert_eq!(dna.len(), scheme.dna_len(msg.chars().count()));
            prop_assert!(dna.chars().all(|c| matches!(c, 'A' | 'C' | 'G' | 'T')));
            prop_assert_eq!(scheme.decode(&dna).unwrap(), msg.clone());
        }
    }

    #[test]
    fn prop_encode_is_deterministic(msg in printable_ascii()) {
        for scheme in Scheme::ALL {
            prop_assert_eq!(scheme.encode(&msg).unwrap(), scheme.encode(&msg).unwrap());
        }
    }

    #[test]
    fn prop_church_has_no_adjacent_repeats(msg in printable_ascii()) {
        prop_assert!(no_adjacent_repeats(&Scheme::Church.encode(&msg).unwrap()));
    }

    #[test]
    fn prop_decode_accepts_lowercase(msg in printable_ascii()) {
        for scheme in Scheme::ALL {
            let dna = scheme.encode(&msg).unwrap().to_ascii_lowercase();
            prop_assert_eq!(scheme.decode(&dna).unwrap(), msg.clone());
        }
    }

    /// Arbitrary text must never panic; a success must be printable ASCII and within limits.
    #[test]
    fn prop_decode_is_total_on_arbitrary_input(input in any::<String>()) {
        for scheme in Scheme::ALL {
            if let Ok(msg) = scheme.decode(&input) {
                prop_assert!(!msg.is_empty() && msg.chars().count() <= MAX_MESSAGE_CHARS);
                prop_assert!(msg.bytes().all(|b| (32..=126).contains(&b)));
            }
        }
    }

    /// Arbitrary ACGT of a valid length either decodes or reports a printable-range error.
    #[test]
    fn prop_decode_of_random_valid_dna(
        units in 1usize..=MAX_MESSAGE_CHARS,
        bases in proptest::collection::vec(prop_oneof![Just('A'), Just('C'), Just('G'), Just('T')], 400),
    ) {
        for scheme in Scheme::ALL {
            let dna: String = bases.iter().take(scheme.dna_len(units)).collect();
            match scheme.decode(&dna) {
                Ok(msg) => prop_assert_eq!(msg.chars().count(), units),
                Err(DecodeError::NonPrintableByte { .. }) => {}
                Err(other) => prop_assert!(false, "unexpected error {other:?}"),
            }
        }
    }

    #[test]
    fn prop_encode_is_total_on_arbitrary_input(input in any::<String>()) {
        for scheme in Scheme::ALL {
            if let Ok(dna) = scheme.encode(&input) {
                prop_assert_eq!(dna.len(), scheme.dna_len(input.chars().count()));
            }
        }
    }
}
