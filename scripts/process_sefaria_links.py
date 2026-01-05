#!/usr/bin/env python3
"""
Process Sefaria links data to count commentary per Tanakh verse by category.
Downloads CSV files from Sefaria-Export repo and aggregates.
"""

import csv
import json
import re
import urllib.request
from collections import defaultdict
from pathlib import Path

# Torah books
TORAH_BOOKS = {"Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"}

# All Tanakh books for detecting direct cross-references
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

# Major categories we care about
MAJOR_CATEGORIES = {
    "Talmud",
    "Midrash",
    "Halakhah",
    "Tanakh",
    "Jewish Thought",
    "Responsa",
    "Kabbalah",
    "Chasidut",
    "Musar",
    "Commentary",  # General commentary
}

BASE_URL = "https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/links"

# Track seen link pairs globally to avoid double-counting bidirectional entries
# Key: frozenset({citation1, citation2}) - normalized pair
seen_link_pairs: set[frozenset[str]] = set()

def parse_verse_ref(citation: str) -> tuple[str, int, int] | None:
    """Extract (book, chapter, verse) from a citation like 'Genesis 1:2' or 'Psalms 23:1'."""
    # Check each Tanakh book - use longest match first to handle "I Samuel" vs "I"
    for book in sorted(TANAKH_BOOKS, key=len, reverse=True):
        if citation.startswith(book + " "):
            # Extract chapter:verse after the book name
            after_book = citation[len(book) + 1:]
            match = re.match(r'^(\d+):(\d+)', after_book)
            if match:
                chapter = int(match.group(1))
                verse = int(match.group(2))
                return (book, chapter, verse)
    return None


def is_direct_tanakh_ref(citation: str) -> bool:
    """
    Check if a citation is a direct Tanakh verse reference (like "Amos 1:1")
    vs a commentary on a Tanakh book (like "Abarbanel on Amos 1:1:1").

    Only direct verse references should be counted in the "Tanakh" category.
    Commentary-on-Tanakh should be counted as "Commentary".
    """
    for book in TANAKH_BOOKS:
        # Check if citation starts with "BookName " followed by chapter:verse
        if citation.startswith(book + " "):
            # Get the part after the book name
            after_book = citation[len(book) + 1:]
            # Should start with a digit (chapter number)
            if after_book and after_book[0].isdigit():
                return True
    return False

def download_and_process_file(file_num: int) -> dict:
    """Download and process a single links file."""
    global seen_link_pairs
    url = f"{BASE_URL}/links{file_num}.csv"
    print(f"Processing {url}...")

    # verse_counts[book][chapter][verse][category] = count
    verse_counts = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))
    duplicates_skipped = 0

    try:
        with urllib.request.urlopen(url) as response:
            lines = response.read().decode('utf-8').splitlines()
            reader = csv.reader(lines)
            header = next(reader)  # Skip header

            for row in reader:
                if len(row) < 7:
                    continue

                citation1, citation2, conn_type, text1, text2, cat1, cat2 = row[:7]

                # Create a normalized key for this link pair to detect duplicates
                # This handles cases where Sefaria has both A→B and B→A as separate rows
                link_pair = frozenset({citation1, citation2})
                if link_pair in seen_link_pairs:
                    duplicates_skipped += 1
                    continue
                seen_link_pairs.add(link_pair)

                # Check if citation2 is a Torah verse
                verse_ref = parse_verse_ref(citation2)
                if verse_ref:
                    book, chapter, verse = verse_ref
                    category = cat1.strip()

                    # Fix: Only count as "Tanakh" if citation1 is a direct verse reference
                    # Commentary-on-Tanakh (like "Abarbanel on Amos") should count as Commentary
                    if category == "Tanakh" and not is_direct_tanakh_ref(citation1):
                        category = "Commentary"

                    # Normalize category
                    if category in MAJOR_CATEGORIES:
                        verse_counts[book][chapter][verse][category] += 1
                    else:
                        verse_counts[book][chapter][verse]["Other"] += 1

                # Also check citation1 (links are bidirectional)
                verse_ref = parse_verse_ref(citation1)
                if verse_ref:
                    book, chapter, verse = verse_ref
                    category = cat2.strip()

                    # Fix: Only count as "Tanakh" if citation2 is a direct verse reference
                    if category == "Tanakh" and not is_direct_tanakh_ref(citation2):
                        category = "Commentary"

                    if category in MAJOR_CATEGORIES:
                        verse_counts[book][chapter][verse][category] += 1
                    else:
                        verse_counts[book][chapter][verse]["Other"] += 1

    except Exception as e:
        print(f"Error processing {url}: {e}")

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

    # Reset seen pairs for fresh run
    seen_link_pairs = set()

    # Process all link files (0-12)
    for i in range(13):
        counts = download_and_process_file(i)
        merge_counts(all_counts, counts)

    print(f"\nTotal unique link pairs processed: {len(seen_link_pairs)}")

    # Convert to more compact format for the frontend
    # Structure: { "Genesis": { "1": { "1": { "total": N, "categories": {...} } } } }
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
    output_path = Path(__file__).parent.parent / "public" / "data" / "commentary-counts.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(output, f, separators=(',', ':'))  # Compact JSON

    print(f"\nWritten to {output_path}")

    # Print some stats
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

    # Sample output
    if "Genesis" in output and "9" in output["Genesis"] and "1" in output["Genesis"]["9"]:
        print(f"\nSample - Genesis 9:1: {output['Genesis']['9']['1']}")

if __name__ == "__main__":
    main()
