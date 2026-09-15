#!/usr/bin/env python3
"""
Process Sefaria links data to count commentary per Tanakh verse by category.

Reads the links export from data/sefaria-links/ and Sefaria's index of the
library from data/sefaria-index.json. Both are downloaded by
scripts/refresh-commentary-counts.sh.

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


def chapter_lengths() -> dict[str, list[int]]:
    """Verse count for every chapter of every book, from tanakh-structure.json."""
    global _chapter_lengths
    if _chapter_lengths is None:
        path = Path(__file__).parent.parent / "public" / "data" / "tanakh-structure.json"
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

    Read from data/sefaria-index.json, which refresh-commentary-counts.sh
    downloads alongside the links. The value is Sefaria's own primary_category:
    "Commentary", "Targum", "Talmud", "Mishnah", "Midrash" and so on.
    """
    global _shelves
    if _shelves is None:
        path = Path(__file__).parent.parent / "data" / "sefaria-index.json"
        if not path.exists():
            raise SystemExit(
                f"ERROR: Sefaria's library index is not at {path}.\n"
                "It says which texts are commentaries, which the links export\n"
                "does not. Download it with:\n"
                "  scripts/refresh-commentary-counts.sh"
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
    """
    name = work.strip()
    while name:
        category = index.get(name)
        if category is not None:
            return category
        if "," not in name:
            break
        name = name.rsplit(",", 1)[0].strip()
    return fallback.strip()


def link_bucket(citation: str, shelf: str, connection: str) -> str | None:
    """
    Which category a link to a verse counts towards, or None if it does not
    count at all.

    The arguments describe the far end of the link from the verse: the citation
    ("Rashi on Genesis 1:1:1"), what kind of text it is as resolve_shelf()
    determined ("Commentary"), and the export's connection type ("commentary").

    Two different questions, answered from two different places. Whether a work
    is a commentary at all comes from Sefaria's index. Whether *this particular
    link* is a comment on *this verse*, rather than a passing citation of it,
    comes from the connection type — the same column Sefaria's own site reads
    to split its Commentary and Quoting Commentary sections.

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
        if parse_verse_refs(citation):
            return None  # a cross-reference from one verse to another
        # A handful of modern Torah commentaries sit on the Tanakh shelf
        # without being marked as commentaries — David Zvi Hoffmann, Nechama
        # Leibowitz, Steinsaltz's introductions. The citation is not a bare
        # verse, so they are not cross-references. Treat them as what they are.
        return COMMENTARY if connection == "commentary" else QUOTING_COMMENTARY

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
            for verse_side, other_side, other_work, other_category in (
                (citation2, citation1, work1, cat1),
                (citation1, citation2, work2, cat2),
            ):
                verse_refs = parse_verse_refs(verse_side)
                if not verse_refs:
                    continue
                shelf = resolve_shelf(other_work, other_category, index)
                bucket = link_bucket(other_side, shelf, connection)
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
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    links_dir = project_root / "data" / "sefaria-links"

    if not links_dir.exists():
        print(f"ERROR: Links directory not found: {links_dir}")
        print("Please download the CSV files first using:")
        print("  mkdir -p data/sefaria-links && cd data/sefaria-links")
        print("  for i in {0..12}; do curl -O https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/links/links$i.csv; done")
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
    output_path = project_root / "public" / "data" / "commentary-counts.json"
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
