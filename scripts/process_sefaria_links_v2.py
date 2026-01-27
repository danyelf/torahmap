#!/usr/bin/env python3
"""
Process Sefaria links data to count commentary per Tanakh verse by category.
Reads from locally downloaded CSV files in data/sefaria-links/

Changes from v1:
- Drops "Tanakh" category (verse cross-references are confusing)
- Filters commentaries from Talmud category to show only direct Talmud text
- Uses local CSV files instead of downloading
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

# Major categories we care about (removed "Tanakh")
MAJOR_CATEGORIES = {
    "Talmud",
    "Midrash",
    "Halakhah",
    "Jewish Thought",
    "Responsa",
    "Kabbalah",
    "Chasidut",
    "Musar",
    "Commentary",
}

# Track seen link pairs globally to avoid double-counting bidirectional entries
seen_link_pairs: set[frozenset[str]] = set()

def parse_verse_ref(citation: str) -> tuple[str, int, int] | None:
    """Extract (book, chapter, verse) from a citation like 'Genesis 1:2'."""
    for book in sorted(TANAKH_BOOKS, key=len, reverse=True):
        if citation.startswith(book + " "):
            after_book = citation[len(book) + 1:]
            match = re.match(r'^(\d+):(\d+)', after_book)
            if match:
                chapter = int(match.group(1))
                verse = int(match.group(2))
                return (book, chapter, verse)
    return None


def is_direct_talmud(citation: str) -> bool:
    """
    Check if citation is a direct Talmud text reference vs a commentary on Talmud.

    Direct Talmud: "Bava Metzia 32a:17", "Tractate Derekh Eretz Zuta", "Introductions to..."
    Commentary: "Steinsaltz on Bava Metzia 32a:17", "Rashi on Pesachim 113b:4"

    Note: We match Sefaria's categorization, which includes:
    - Standard Babylonian Talmud tractates
    - Jerusalem Talmud
    - Minor tractates (Derekh Eretz, etc.)
    - Introductions to Talmudic literature (when marked as Talmud category)
    """
    # Exclude clear commentary patterns - commentaries ON Talmud texts
    exclude_patterns = [
        r'^Steinsaltz on',
        r'^Rashi on',
        r'^Tosafot on',
        r'^Reshimot Shiurim on',
        r'^Ohr LaYesharim on',
        r'^Rif ',  # Rif is an abbreviation/commentary
    ]

    for pattern in exclude_patterns:
        if re.match(pattern, citation, re.IGNORECASE):
            return False

    # If Sefaria categorizes it as "Talmud", we trust that
    # This includes:
    # - Babylonian Talmud: "Bava Metzia 32a:17"
    # - Jerusalem Talmud: "Jerusalem Talmud Bava Metzia 2:10:3"
    # - Minor tractates: "Tractate Derekh Eretz Zuta, Section on Peace 4"
    # - Introductions: "Introductions to Tanaitic Literature..."
    return True


def process_file(filepath: Path) -> dict:
    """Process a single links CSV file."""
    global seen_link_pairs

    # verse_counts[book][chapter][verse][category] = count
    verse_counts = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))
    duplicates_skipped = 0

    print(f"Processing {filepath.name}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header

        for row in reader:
            if len(row) < 7:
                continue

            citation1, citation2, conn_type, text1, text2, cat1, cat2 = row[:7]

            # Create normalized key for deduplication
            link_pair = frozenset({citation1, citation2})
            if link_pair in seen_link_pairs:
                duplicates_skipped += 1
                continue
            seen_link_pairs.add(link_pair)

            # Check if citation2 is a Tanakh verse
            verse_ref = parse_verse_ref(citation2)
            if verse_ref:
                book, chapter, verse = verse_ref
                category = cat1.strip()

                # Skip Tanakh category entirely
                if category == "Tanakh":
                    continue

                # Filter Talmud to only direct text references
                if category == "Talmud" and not is_direct_talmud(citation1):
                    continue

                # Count it
                if category in MAJOR_CATEGORIES:
                    verse_counts[book][chapter][verse][category] += 1
                else:
                    verse_counts[book][chapter][verse]["Other"] += 1

            # Also check citation1 (links are bidirectional)
            verse_ref = parse_verse_ref(citation1)
            if verse_ref:
                book, chapter, verse = verse_ref
                category = cat2.strip()

                # Skip Tanakh category entirely
                if category == "Tanakh":
                    continue

                # Filter Talmud to only direct text references
                if category == "Talmud" and not is_direct_talmud(citation2):
                    continue

                if category in MAJOR_CATEGORIES:
                    verse_counts[book][chapter][verse][category] += 1
                else:
                    verse_counts[book][chapter][verse]["Other"] += 1

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

    # Sample: Exodus 23:5
    if "Exodus" in output and "23" in output["Exodus"] and "5" in output["Exodus"]["23"]:
        print(f"\nSample - Exodus 23:5: {output['Exodus']['23']['5']}")


if __name__ == "__main__":
    main()
