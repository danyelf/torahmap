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

from process_sefaria_links import (
    MAX_RANGE_VERSES,
    link_bucket,
    parse_verse_refs,
    resolve_shelf,
)


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


# Finding the shelf a work really sits on.
#
# The links export labels each side of a link with a shelf, but it gives the
# shelf the text is *filed under*, which for a commentary is the shelf of the
# thing it comments on. Rashi comes back as Tanakh, Ben Yehoyada as Talmud,
# Derekh Chayyim as Mishnah. Sefaria's index says "Commentary" for all three,
# and that is the answer we want.

INDEX = {
    "Rashi on Genesis": "Commentary",
    "Ben Yehoyada on Sanhedrin": "Commentary",
    "Derekh Chayyim": "Commentary",
    "Onkelos Genesis": "Targum",
    "Yalkut Shimoni on Torah": "Midrash",
    "Midrash Lekach Tov": "Midrash",
    "Mishnah Chagigah": "Mishnah",
    "Sanhedrin": "Talmud",
    "BDB": "Reference",
    "Genesis": "Tanakh",
    "David Zvi Hoffmann on Exodus": "Tanakh",
}


def test_a_work_the_index_names_directly():
    assert resolve_shelf("Rashi on Genesis", "Tanakh", INDEX) == "Commentary"


def test_a_section_inside_a_book_resolves_to_the_book():
    # The export names a node ("Midrash Lekach Tov, Genesis"); the index names
    # the book. Strip section names until something matches.
    assert resolve_shelf("Midrash Lekach Tov, Genesis", "Midrash", INDEX) == "Midrash"


def test_a_section_several_levels_down():
    assert resolve_shelf(
        "Midrash Lekach Tov, Genesis, Bereshit", "Midrash", INDEX
    ) == "Midrash"


def test_a_work_the_index_does_not_know_keeps_the_export_s_shelf():
    # Four index entries carry no category of their own, and new texts appear
    # between exports. Falling back beats guessing.
    assert resolve_shelf("Some Work Published Yesterday", "Musar", INDEX) == "Musar"


# Which category a link counts towards.
#
# Two questions, two different sources. Whether a work is a commentary at all
# comes from the index, above. Whether *this particular link* is a comment on
# *this verse*, rather than a passing citation of it, comes from the export's
# connection type — the same column Sefaria's own site reads to separate its
# Commentary and Quoting Commentary sections.


def test_rashi_on_the_verse_he_is_writing_about():
    assert link_bucket("Rashi on Genesis 1:1:1", "Commentary", "commentary") == (
        "Commentary"
    )


def test_a_commentary_citing_a_verse_it_is_not_written_on():
    # Abarbanel, writing about Amos, reaches for Genesis 49:28. That says
    # something about Genesis 49:28, but it is not commentary on it.
    assert link_bucket("Abarbanel on Amos 1:11:1", "Commentary", "") == (
        "Quoting Commentary"
    )


@pytest.mark.parametrize("connection", ["", "parshanut", "quotation", "quotation_auto"])
def test_every_other_connection_type_is_quoting_commentary(connection):
    assert link_bucket("Sforno on Genesis 1:16:1", "Commentary", connection) == (
        "Quoting Commentary"
    )


def test_a_talmud_commentary_quoting_a_verse_is_not_talmud():
    # Ben Yehoyada is filed on the Talmud shelf and used to be counted as
    # Talmud, because the hand-written list of Talmud commentaries never
    # included it. Sefaria puts it under Quoting Commentary and so do we.
    assert link_bucket("Ben Yehoyada on Sanhedrin 38b:9", "Commentary", "") == (
        "Quoting Commentary"
    )


def test_the_talmud_itself_is_talmud():
    assert link_bucket("Sanhedrin 38b:9", "Talmud", "") == "Talmud"


def test_the_mishnah_itself_is_mishnah():
    assert link_bucket("Mishnah Chagigah 2:1", "Mishnah", "") == "Mishnah"


def test_translations_are_not_counted():
    # Almost every verse has one and the Torah has three, so counting them
    # draws a picture of which books were translated, not of the verses.
    assert link_bucket("Onkelos Genesis 1:1:1", "Targum", "targum") is None


def test_dictionary_entries_are_not_counted():
    assert link_bucket("BDB, בְּרֵאשִׁית", "Reference", "reference") is None


def test_verse_to_verse_cross_reference_is_not_counted():
    assert link_bucket("Psalms 33:6", "Tanakh", "related") is None


def test_a_tanakh_shelf_work_the_index_has_not_marked_as_commentary():
    # A few modern Torah commentaries sit on the Tanakh shelf without being
    # flagged. They are not cross-references — the citation is not a bare verse
    # — so treat them as the commentaries they are.
    assert link_bucket("David Zvi Hoffmann on Exodus 1:1:1", "Tanakh", "commentary") == (
        "Commentary"
    )


@pytest.mark.parametrize(
    "shelf", ["Mishnah", "Liturgy", "Tosefta", "Second Temple", "Responsa"]
)
def test_corpora_that_used_to_land_in_other_are_named(shelf):
    assert link_bucket("Some Citation 1:1", shelf, "") == shelf


def test_a_shelf_we_have_never_seen_lands_in_other():
    # A later export can introduce a shelf we do not know about. It should show
    # up somewhere someone can notice, not vanish.
    assert link_bucket("Something 1:1", "A New Shelf", "") == "Other"


