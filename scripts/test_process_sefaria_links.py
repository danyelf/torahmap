#!/usr/bin/env python3
"""
Tests for how citations are turned into verses.

Run with:  python3 -m pytest scripts/test_process_sefaria_links.py

The interesting cases are all about ranges. A citation can name one verse
("Genesis 1:2"), a short passage ("Deuteronomy 6:4-9"), or an entire weekly
portion ("Genesis 1:1-6:8"). The first two are claims about specific verses.
The third is a catalogue entry, and crediting it to any single verse invents a
concentration of commentary that is not there.
"""

import pytest

from process_sefaria_links import MAX_RANGE_VERSES, parse_verse_refs


def test_single_verse():
    assert parse_verse_refs("Genesis 1:2") == [("Genesis", 1, 2)]


def test_book_with_spaces_in_its_name():
    assert parse_verse_refs("Song of Songs 2:3") == [("Song of Songs", 2, 3)]


def test_book_with_numeral_prefix():
    assert parse_verse_refs("II Samuel 12:7") == [("II Samuel", 12, 7)]


def test_short_range_covers_every_verse_in_it():
    assert parse_verse_refs("Genesis 19:20-21") == [
        ("Genesis", 19, 20),
        ("Genesis", 19, 21),
    ]


def test_the_shema_paragraph_credits_all_six_verses():
    # Deuteronomy 6:4-9 is a passage people genuinely comment on as a unit.
    assert parse_verse_refs("Deuteronomy 6:4-9") == [
        ("Deuteronomy", 6, v) for v in range(4, 10)
    ]


def test_range_crossing_a_chapter_boundary():
    # Genesis 1 has 31 verses, so 1:30-2:2 is five verses: 1:30, 1:31, 2:1-2:3.
    assert parse_verse_refs("Genesis 1:30-2:3") == [
        ("Genesis", 1, 30),
        ("Genesis", 1, 31),
        ("Genesis", 2, 1),
        ("Genesis", 2, 2),
        ("Genesis", 2, 3),
    ]


def test_range_at_the_length_limit_is_kept():
    assert len(parse_verse_refs("Psalms 119:1-10")) == MAX_RANGE_VERSES


def test_range_one_verse_past_the_limit_is_dropped():
    assert parse_verse_refs("Psalms 119:1-11") == []


def test_whole_chapter_range_is_dropped():
    # "All of Psalm 76" is not a claim about any particular verse.
    assert parse_verse_refs("Psalms 76:1-13") == []


def test_weekly_portion_range_is_dropped():
    # Bereshit. Crediting this to Genesis 1:1 is what inflated it.
    assert parse_verse_refs("Genesis 1:1-6:8") == []


def test_reeh_does_not_land_on_its_opening_verse():
    # The regression this whole change exists for: Deuteronomy 11:26 was the
    # brightest verse on the map purely because the portion Re'eh starts there.
    assert parse_verse_refs("Deuteronomy 11:26-16:17") == []


def test_non_tanakh_citation():
    assert parse_verse_refs("Rashi on Genesis 1:1:1") == []


def test_citation_that_is_not_a_reference_at_all():
    assert parse_verse_refs("A Dictionary of the Talmud, Abbreviations 140") == []


def test_book_name_alone_without_a_verse():
    assert parse_verse_refs("Genesis") == []


@pytest.mark.parametrize(
    "citation",
    [
        "Exodus 1:1-6:1",
        "Numbers 1:1-4:20",
        "Leviticus 1:1-5:26",
        "Exodus 25:1-27:19",
    ],
)
def test_portion_sized_ranges_are_all_dropped(citation):
    assert parse_verse_refs(citation) == []


def test_range_running_past_the_end_of_a_chapter_is_clamped():
    # Genesis 1 has 31 verses. A citation claiming 1:29-1:40 is malformed;
    # take the verses that exist rather than inventing 32 through 40.
    assert parse_verse_refs("Genesis 1:29-40") == [
        ("Genesis", 1, 29),
        ("Genesis", 1, 30),
        ("Genesis", 1, 31),
    ]


def test_backwards_range_is_rejected():
    assert parse_verse_refs("Genesis 5:10-5:2") == []


def test_unknown_chapter_is_rejected():
    # Genesis has 50 chapters.
    assert parse_verse_refs("Genesis 99:1-99:3") == []
