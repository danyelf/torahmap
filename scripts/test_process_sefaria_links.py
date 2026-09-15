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

from process_sefaria_links import MAX_RANGE_VERSES, link_bucket, parse_verse_refs


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


# Which category a link counts towards.
#
# Sefaria's export gives each side of a link the category of the shelf its text
# sits on, not the kind of link it is. Rashi sits under Tanakh, so a link from
# Genesis 1:1 to Rashi's comment on it arrives labelled "Tanakh" — the same
# label a plain cross-reference to another verse carries. The connection-type
# column is what tells them apart, and it is the same column Sefaria's own site
# reads to build its Commentary and Quoting Commentary sections.


def test_rashi_is_commentary():
    assert link_bucket("Rashi on Genesis 1:1:1", "Tanakh", "commentary") == "Commentary"


def test_a_commentary_citing_a_verse_it_is_not_written_on():
    # Abarbanel, writing about Amos, reaches for Genesis 49:28. That says
    # something about Genesis 49:28, but it is not commentary on it.
    assert link_bucket("Abarbanel on Amos 1:11:1", "Tanakh", "") == "Quoting Commentary"


@pytest.mark.parametrize("connection", ["", "parshanut", "quotation", "quotation_auto"])
def test_every_other_connection_type_is_quoting_commentary(connection):
    assert link_bucket("Sforno on Genesis 1:16:1", "Tanakh", connection) == (
        "Quoting Commentary"
    )


def test_verse_to_verse_cross_reference_is_not_counted():
    # Both ends are bare verses, so this is the map pointing at itself.
    assert link_bucket("Psalms 33:6", "Tanakh", "related") is None


def test_targum_is_not_counted():
    # Almost every verse has a targum, and the Torah has three, so counting
    # them draws a band across the Torah that is about which books were
    # translated rather than about the verses.
    assert link_bucket("Onkelos Genesis 1:1:1", "Tanakh", "targum") is None


def test_dictionary_entries_are_not_counted():
    # BDB, Jastrow, Klein and Sefer HaShorashim are lexicon lookups.
    assert link_bucket("BDB, בְּרֵאשִׁית", "Reference", "reference") is None


def test_talmud_text_is_counted():
    assert link_bucket("Bava Metzia 32a:17", "Talmud", "") == "Talmud"


def test_commentary_on_the_talmud_is_not_counted_as_talmud():
    assert link_bucket("Steinsaltz on Bava Metzia 32a:17", "Talmud", "") is None


@pytest.mark.parametrize(
    "category", ["Mishnah", "Liturgy", "Tosefta", "Second Temple"]
)
def test_corpora_that_used_to_land_in_other_are_named(category):
    assert link_bucket("Mishnah Berakhot 1:1", category, "") == category


def test_a_category_we_have_never_seen_lands_in_other():
    # A later export can introduce a shelf we do not know about. It should show
    # up in a bucket someone can notice, not vanish.
    assert link_bucket("Something 1:1", "A New Shelf", "") == "Other"


def test_a_commentary_connection_outside_tanakh_keeps_its_own_category():
    # Chasidut and Midrash works do use the commentary connection type, on a
    # small share of their links. We do not split those out: for them the
    # distinction is a thin tail, where under Tanakh it is two thirds of the
    # links and the whole point of the category.
    assert link_bucket("Sefat Emet, Genesis, Bereshit 1:4", "Chasidut", "commentary") == (
        "Chasidut"
    )
