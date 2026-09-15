#!/usr/bin/env python3
"""
Process Sefaria links data to count commentary per Tanakh verse by category.

Reads two things, both under data/overlays/commentary/ and both downloaded by
scripts/overlays/commentary/refresh.sh: the links export in sefaria-links/, and
Sefaria's index of the library in sefaria-index.json.

- resolve_shelf() asks the index what a work actually is, because the export's
  own category column files a commentary under whatever it comments on
- link_bucket() turns a shelf and a connection type into a category; that is
  where the judgement calls about what counts as commentary live
- Counts a citation towards every verse it covers, up to MAX_RANGE_VERSES;
  longer ranges name a whole portion rather than a passage and are ignored
"""

import csv
import json
import re
from collections import defaultdict
from pathlib import Path

# All Tanakh books for detecting verses
TANAKH_BOOKS = {
    # Torah
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    # Nevi'im
    "Joshua", "Judges", "I Samuel", "II Samuel", "I Kings", "II Kings",
    "Isaiah", "Jeremiah", "Ezekiel", "Hosea", "Joel", "Amos", "Obadiah",
    "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
    "Zechariah", "Malachi",
    # Ketuvim
    "Psalms", "Proverbs", "Job", "Song of Songs", "Ruth", "Lamentations",
    "Ecclesiastes", "Esther", "Daniel", "Ezra", "Nehemiah",
    "I Chronicles", "II Chronicles"
}

# Shelves of the library that keep their own name in the counts. Anything not
# listed here, and not handled specially below, is counted under "Other" so
# that a shelf we have never seen shows up somewhere visible instead of
# disappearing.
COUNTED_CATEGORIES = {
    "Talmud",
    "Midrash",
    "Halakhah",
    "Jewish Thought",
    "Responsa",
    "Kabbalah",
    "Chasidut",
    "Musar",
    "Mishnah",
    "Liturgy",
    "Tosefta",
    "Second Temple",
}

# Shelves we drop entirely.
#
# Reference is dictionary and lexicon lookups: BDB, Jastrow, Klein, Sefer
# HaShorashim. Roughly a quarter of all links to verses, and they record which
# words a verse contains rather than anything anyone wrote about it.
#
# Targum is translation. Nearly every verse has one, the Torah has three, and
# the books already written partly in Aramaic have none — so counting them
# draws a picture of which books were translated rather than of the verses.
IGNORED_SHELVES = {"Reference", "Targum"}

# The two buckets we produce ourselves. Both come from works the index calls
# commentaries; see link_bucket() for how they are told apart.
COMMENTARY = "Commentary"
QUOTING_COMMENTARY = "Quoting Commentary"

# Track seen link pairs globally to avoid double-counting bidirectional entries
seen_link_pairs: set[frozenset[str]] = set()

# A citation may name one verse, a short passage, or a sweep of text so large
# that it is really a catalogue entry. Up to this many verses we treat the
# citation as a claim about each verse it covers; beyond it we ignore the
# citation entirely.
#
# The cutoff is not delicate. Anything between five and twenty produces
# essentially the same map, because half of all ranges are five verses or
# fewer and a fifth cover more than a hundred. Ten sits in the empty middle.
MAX_RANGE_VERSES = 10

BOOKS_LONGEST_FIRST = sorted(TANAKH_BOOKS, key=len, reverse=True)

# "1:2", "1:2-5" or "1:2-3:4", and nothing trailing: a citation like
# "Rashi on Genesis 1:1:1" names a comment, not a verse, and must not match.
_REF_RE = re.compile(r'^(\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$')

_chapter_lengths: dict[str, list[int]] | None = None
_shelves: dict[str, str] | None = None

# Everything this overlay downloads or produces lives under its own name, so
# that one overlay's data is one directory.
# scripts/overlays/commentary/ -> the repository root is three levels up.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
COMMENTARY_DATA = PROJECT_ROOT / "data" / "overlays" / "commentary"
COMMENTARY_COUNTS = PROJECT_ROOT / "public" / "data" / "overlays" / "commentary" / "counts.json"


def chapter_lengths() -> dict[str, list[int]]:
    """Verse count for every chapter of every book, from tanakh-structure.json."""
    global _chapter_lengths
    if _chapter_lengths is None:
        path = PROJECT_ROOT / "public" / "data" / "tanakh-structure.json"
        with open(path) as f:
            structure = json.load(f)
        _chapter_lengths = {b["name"]: b["chapters"] for b in structure["books"]}
    return _chapter_lengths


def parse_verse_refs(citation: str) -> list[tuple[str, int, int]]:
    """
    Every verse a citation refers to, as (book, chapter, verse).

    A single verse gives one entry. A range gives one entry per verse it
    covers, so a comment on "Deuteronomy 6:4-9" counts towards all six verses
    of the Shema rather than piling onto the first. A range longer than
    MAX_RANGE_VERSES gives nothing: "Genesis 1:1-6:8" is a pointer to the whole
    of Bereshit, and crediting it anywhere invents commentary that is not there.

    Returns an empty list for anything that is not a Tanakh verse reference.
    """
    for book in BOOKS_LONGEST_FIRST:
        if not citation.startswith(book + " "):
            continue

        match = _REF_RE.match(citation[len(book) + 1:])
        if not match:
            return []

        start_chapter, start_verse = int(match.group(1)), int(match.group(2))
        if match.group(4) is None:
            end_chapter, end_verse = start_chapter, start_verse
        else:
            end_chapter = int(match.group(3)) if match.group(3) else start_chapter
            end_verse = int(match.group(4))

        lengths = chapter_lengths().get(book)
        if not lengths:
            return []
        if not 1 <= start_chapter <= len(lengths) or not 1 <= end_chapter <= len(lengths):
            return []
        if (end_chapter, end_verse) < (start_chapter, start_verse):
            return []

        verses = []
        for chapter in range(start_chapter, end_chapter + 1):
            first = start_verse if chapter == start_chapter else 1
            # A citation can run past the end of a chapter. Take what exists.
            last = min(end_verse if chapter == end_chapter else lengths[chapter - 1],
                       lengths[chapter - 1])
            verses.extend((book, chapter, v) for v in range(first, last + 1))
            if len(verses) > MAX_RANGE_VERSES:
                return []

        return verses
    return []


def shelves() -> dict[str, str]:
    """Every text in Sefaria's library, mapped to what kind of text it is.

    Read from sefaria-index.json, which refresh.sh downloads
    alongside the links. The value is Sefaria's own primary_category:
    "Commentary", "Targum", "Talmud", "Mishnah", "Midrash" and so on.
    """
    global _shelves
    if _shelves is None:
        path = COMMENTARY_DATA / "sefaria-index.json"
        if not path.exists():
            raise SystemExit(
                f"ERROR: Sefaria's library index is not at {path}.\n"
                "It says which texts are commentaries, which the links export\n"
                "does not. Download it with:\n"
                "  scripts/overlays/commentary/refresh.sh"
            )
        found: dict[str, str] = {}

        def walk(node):
            if isinstance(node, list):
                for item in node:
                    walk(item)
            elif isinstance(node, dict):
                title, category = node.get("title"), node.get("primary_category")
                if title and category:
                    found[title] = category
                for value in node.values():
                    if isinstance(value, (list, dict)):
                        walk(value)

        with open(path, encoding="utf-8") as f:
            walk(json.load(f))

        # A response that parses but is not the index — an error object, a
        # truncation landing on valid JSON, a change of shape — would leave
        # this map empty or nearly so. Every work would then fall back to the
        # shelf the export files it on, which is exactly the bug the index is
        # here to fix, and the run would finish and overwrite the counts
        # without complaint. Refuse instead.
        if found.get("Rashi on Genesis") != "Commentary" or len(found) < 1000:
            raise SystemExit(
                f"ERROR: {path} does not look like Sefaria's library index.\n"
                f"Found {len(found)} titles; expected several thousand, with\n"
                "'Rashi on Genesis' among them. Download it again with:\n"
                "  scripts/overlays/commentary/refresh.sh"
            )
        _shelves = found
    return _shelves


def resolve_shelf(work: str, fallback: str, index: dict[str, str]) -> str:
    """What kind of text a work is, according to Sefaria's own index.

    `work` is the title the links export gives, `fallback` the shelf the export
    files it under, and `index` the map from shelves().

    This is the correction the whole category scheme rests on. The export's own
    category column gives a commentary the shelf of the thing it comments on:
    Rashi comes back as Tanakh, Ben Yehoyada as Talmud, Derekh Chayyim as
    Mishnah, Mishnah Berurah as Halakhah. Counting those under the shelf they
    are filed on means a category called Mishnah is mostly not the Mishnah.

    The export usually names a node inside a book — "Midrash Lekach Tov,
    Genesis" — where the index names the book, so trailing section names come
    off one at a time until something matches. Every work in the export
    resolves this way; the fallback is for texts added since the index was
    downloaded.

    One shelf needs a correction the index does not make. Sefaria keeps the
    thirty-nine books and a handful of modern commentaries together under
    Tanakh, and marks only some of the commentaries as commentaries. David Zvi
    Hoffmann on Exodus, Steinsaltz's introductions and Nechama Leibowitz arrive
    as plain Tanakh. A title that is not simply a book's name is one of those,
    so the rest of the shelf is the books themselves, and a link from a verse
    to one of the books is a cross-reference between two verses.

    The test is the whole title, not its opening words. Several books are named
    after people, and other works begin with those names without being them:
    Esther Rabbah is a midrash on Esther, Ruth Rabbah a midrash on Ruth, and
    Ezra ben Solomon a kabbalist who wrote about Song of Songs.
    """
    name = work.strip()
    shelf = fallback.strip()
    while name:
        category = index.get(name)
        if category is not None:
            shelf = category
            break
        if "," not in name:
            break
        name = name.rsplit(",", 1)[0].strip()

    if shelf == "Tanakh" and work.strip() not in TANAKH_BOOKS:
        return "Commentary"
    return shelf


def link_bucket(shelf: str, connection: str) -> str | None:
    """
    Which category a link to a verse counts towards, or None if it does not
    count at all.

    Takes what kind of text sits at the far end of the link, as resolve_shelf()
    determined it, and the export's connection type for the link itself.

    Two different questions, answered from two different places. Whether a work
    is a commentary at all comes from Sefaria's index, above. Whether *this
    particular link* is a comment on *this verse*, rather than a passing
    citation of it, comes from the connection type — the same column Sefaria's
    own site reads to split its Commentary and Quoting Commentary sections.

    So a commentary splits two ways:

      commentary      someone wrote about this verse
      anything else   someone writing about something else cited this verse

    Both are worth keeping and worth naming apart. When Abarbanel, in the
    middle of his commentary on Amos, reaches for Genesis 49:28, that is a real
    fact about Genesis 49:28 — but it is not commentary on it, and a map of
    which verses commentators reach for is a different map from one of which
    verses they write about.

    Quoting Commentary is not confined to commentaries on the Tanakh. A Zohar
    commentary, a Talmud commentary and a commentary on Pirkei Avot can all
    cite a verse, and Sefaria counts all of them here.
    """
    shelf = shelf.strip()
    connection = connection.strip()

    if shelf in IGNORED_SHELVES:
        return None

    if shelf == "Commentary":
        return COMMENTARY if connection == "commentary" else QUOTING_COMMENTARY

    if shelf == "Tanakh":
        # resolve_shelf() has moved every commentary off this shelf, so what is
        # left is one of the thirty-nine books: one verse pointing at another.
        return None

    return shelf if shelf in COUNTED_CATEGORIES else "Other"


def process_file(filepath: Path) -> dict:
    """Process a single links CSV file."""
    global seen_link_pairs

    # verse_counts[book][chapter][verse][category] = count
    verse_counts = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))
    duplicates_skipped = 0
    index = shelves()

    print(f"Processing {filepath.name}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header

        for row in reader:
            if len(row) < 7:
                continue

            citation1, citation2, connection, work1, work2, cat1, cat2 = row[:7]

            # Create normalized key for deduplication
            link_pair = frozenset({citation1, citation2})
            if link_pair in seen_link_pairs:
                duplicates_skipped += 1
                continue
            seen_link_pairs.add(link_pair)

            # A link is written once but read from both ends: either citation
            # may be the verse, and each verse it covers is credited with the
            # text at the other end.
            for verse_side, other_work, other_category in (
                (citation2, work1, cat1),
                (citation1, work2, cat2),
            ):
                verse_refs = parse_verse_refs(verse_side)
                if not verse_refs:
                    continue
                shelf = resolve_shelf(other_work, other_category, index)
                bucket = link_bucket(shelf, connection)
                if bucket is None:
                    continue
                for book, chapter, verse in verse_refs:
                    verse_counts[book][chapter][verse][bucket] += 1

    if duplicates_skipped > 0:
        print(f"  Skipped {duplicates_skipped} duplicate link pairs")

    return verse_counts


def merge_counts(target: dict, source: dict):
    """Merge source counts into target."""
    for book, chapters in source.items():
        for chapter, verses in chapters.items():
            for verse, categories in verses.items():
                for cat, count in categories.items():
                    if book not in target:
                        target[book] = {}
                    if chapter not in target[book]:
                        target[book][chapter] = {}
                    if verse not in target[book][chapter]:
                        target[book][chapter][verse] = {}
                    if cat not in target[book][chapter][verse]:
                        target[book][chapter][verse][cat] = 0
                    target[book][chapter][verse][cat] += count


def main():
    global seen_link_pairs
    all_counts = {}

    # Reset seen pairs
    seen_link_pairs = set()

    # Find local CSV files
    links_dir = COMMENTARY_DATA / "sefaria-links"

    if not links_dir.exists():
        print(f"ERROR: Links directory not found: {links_dir}")
        print("Download the export first:")
        print("  scripts/overlays/commentary/refresh.sh")
        return

    # Process all CSV files
    csv_files = sorted(links_dir.glob("links*.csv"))
    if not csv_files:
        print(f"ERROR: No CSV files found in {links_dir}")
        return

    print(f"Found {len(csv_files)} CSV files")

    for filepath in csv_files:
        counts = process_file(filepath)
        merge_counts(all_counts, counts)

    print(f"\nTotal unique link pairs processed: {len(seen_link_pairs)}")

    # Convert to compact format for frontend
    output = {}
    for book, chapters in all_counts.items():
        output[book] = {}
        for chapter, verses in chapters.items():
            output[book][str(chapter)] = {}
            for verse, categories in verses.items():
                total = sum(categories.values())
                output[book][str(chapter)][str(verse)] = {
                    "total": total,
                    "categories": dict(categories)
                }

    # Write output
    output_path = COMMENTARY_COUNTS
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(output, f, separators=(',', ':'))  # Compact JSON

    print(f"\nWritten to {output_path}")

    # Print stats
    total_verses = sum(
        len(verses)
        for chapters in output.values()
        for verses in chapters.values()
    )
    total_links = sum(
        data["total"]
        for chapters in output.values()
        for verses in chapters.values()
        for data in verses.values()
    )
    print(f"Total verses with links: {total_verses}")
    print(f"Total links: {total_links}")

    # What landed in each bucket. This is the check that would have caught the
    # commentaries going missing: "Commentary" sat in the category list for
    # months with zero links in it, because every commentary was arriving under
    # the Tanakh label and being thrown away. An empty bucket, or a surprising
    # one, should be visible the moment the counts are regenerated.
    by_bucket: dict[str, int] = defaultdict(int)
    for chapters in output.values():
        for verses in chapters.values():
            for data in verses.values():
                for bucket, count in data["categories"].items():
                    by_bucket[bucket] += count

    print("\nLinks by category:")
    for bucket, count in sorted(by_bucket.items(), key=lambda item: -item[1]):
        print(f"  {count:>9,}  {bucket}")
    for bucket in sorted(COUNTED_CATEGORIES | {COMMENTARY, QUOTING_COMMENTARY}):
        if bucket not in by_bucket:
            print(f"  {'0':>9}  {bucket}   <- nothing landed here, check why")

    # Sample: Exodus 23:5
    if "Exodus" in output and "23" in output["Exodus"] and "5" in output["Exodus"]["23"]:
        print(f"\nSample - Exodus 23:5: {output['Exodus']['23']['5']}")


if __name__ == "__main__":
    main()
