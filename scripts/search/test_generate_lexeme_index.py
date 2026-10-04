#!/usr/bin/env python3
"""
Tests for the folding rules the lexeme index is built on.

Run with:  python3 -m pytest scripts/search/test_generate_lexeme_index.py

normalize() here and normalizeHebrewForSearch() in src/hebrew.ts must fold
Hebrew identically. If they drift, the index keys and the lookups spell words
differently, so the lookup silently misses and meanings search finds nothing.
Both read folding-cases.json; the TypeScript half is in
src/__tests__/unit/search-normalization.test.ts.
"""

import importlib.util
import json
import os

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))


def _load_generator():
    """Import the generator by path, since its filename is hyphenated."""
    path = os.path.join(HERE, "generate-lexeme-index.py")
    spec = importlib.util.spec_from_file_location("generate_lexeme_index", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


generator = _load_generator()
normalize = generator.normalize

with open(os.path.join(HERE, "folding-cases.json"), encoding="utf-8") as handle:
    CASES = json.load(handle)


@pytest.mark.parametrize("case", CASES, ids=[case["rule"] for case in CASES])
def test_folding_case(case):
    assert normalize(case["in"]) == case["out"]


def test_verse_id_spells_a_verse_as_the_map_does():
    assert generator.verse_id("I Samuel", 1, 5) == "I.Samuel.1.5"


def test_none_is_safe():
    # Only Python can be handed None; BHSA returns it for an absent feature.
    assert normalize(None) == ""


def test_a_different_spelling_still_divides_alike():
    printed = ["ויפל", "גורלות"]
    morphemes = [("ו", "and", 0), ("יפל", "fall", 0), ("גורלות", "lot", 1)]
    assert generator.line_up(["ויפל", "גרלות"], printed, morphemes) == (True, None)


def test_equal_counts_that_join_and_split_do_not_divide_alike():
    shown = ["אבי", "עד", "כדרלעמר"]
    printed = ["אביעד", "כדר", "לעמר"]
    morphemes = [("אבי", "father", 0), ("עד", "eternity", 0), ("כדרלעמר", "Chedorlaomer", 1)]
    alike, lexemes = generator.line_up(shown, printed, morphemes)
    assert not alike
    assert lexemes == [["father"], ["eternity"], ["Chedorlaomer"]]


def test_the_page_splitting_one_printed_word_gives_each_part_its_own_word():
    # הללויה: one printed word of two morphemes, "praise" and "Yah".
    morphemes = [("הללו", "praise", 0), ("יה", "Yah", 0)]
    assert generator.line_up(["הללו", "יה"], ["הללויה"], morphemes) == (
        False,
        [["praise"], ["Yah"]],
    )


def test_the_page_joining_two_printed_words_names_each():
    # צורי שדי: two printed words of one name.
    morphemes = [("צורישדי", "Zurishaddai", 0)]
    assert generator.line_up(["צורישדי"], ["צורי", "שדי"], morphemes) == (
        False,
        [["Zurishaddai"]],
    )


def test_a_word_is_its_stem_not_its_prefix():
    printed = ["הסופר", "אמר", "גד"]
    morphemes = [("ה", "the", 0), ("סופר", "scribe", 0), ("אמר", "say", 1), ("גד", "Gad", 2)]
    assert generator.line_up(["הספר", "אמרגד"], printed, morphemes) == (
        False,
        [["scribe"], ["say", "Gad"]],
    )


def test_a_stray_letter_does_not_carry_a_word_into_its_neighbour():
    # Deuteronomy 22:27: הנער is read הנערה, and the reading's extra ה lines up
    # with the first letter of the next word unless it is ignored.
    shown = ["כי", "בשדה", "מצאה", "צעקה", "הנער", "המארשה", "ואינ", "מושיע", "לה"]
    printed = ["כי", "בשדה", "מצאה", "צעקה", "הנערה", "המארשה", "ואינ", "מושיע", "לה"]
    letters = ["כי", "ב", "", "שדה", "מצאה", "צעקה", "ה", "נערה", "ה", "מארשה", "ו", "אינ"]
    letters += ["מושיע", "לה"]
    words = [0, 1, 1, 1, 2, 3, 4, 4, 5, 5, 6, 6, 7, 8]
    morphemes = [(text, text, word) for text, word in zip(letters, words)]
    assert generator.line_up(shown, printed, morphemes) == (True, None)
