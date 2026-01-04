#!/usr/bin/env python3
"""
Process Sefaria links data to count commentary per Torah verse by category.
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

def parse_verse_ref(citation: str) -> tuple[str, int, int] | None:
    """Extract (book, chapter, verse) from a citation like 'Genesis 1:2' or 'Genesis 1:2-3'."""
    # Match patterns like "Genesis 1:2" or "Genesis 1:2-3"
    pattern = r'^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\s+(\d+):(\d+)'
    match = re.match(pattern, citation)
    if match:
        book = match.group(1)
        chapter = int(match.group(2))
        verse = int(match.group(3))
        return (book, chapter, verse)
    return None

def download_and_process_file(file_num: int) -> dict:
    """Download and process a single links file."""
    url = f"{BASE_URL}/links{file_num}.csv"
    print(f"Processing {url}...")

    # verse_counts[book][chapter][verse][category] = count
    verse_counts = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))

    try:
        with urllib.request.urlopen(url) as response:
            lines = response.read().decode('utf-8').splitlines()
            reader = csv.reader(lines)
            header = next(reader)  # Skip header

            for row in reader:
                if len(row) < 7:
                    continue

                citation1, citation2, conn_type, text1, text2, cat1, cat2 = row[:7]

                # Check if citation2 is a Torah verse
                verse_ref = parse_verse_ref(citation2)
                if verse_ref:
                    book, chapter, verse = verse_ref
                    category = cat1.strip()
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
                    if category in MAJOR_CATEGORIES:
                        verse_counts[book][chapter][verse][category] += 1
                    else:
                        verse_counts[book][chapter][verse]["Other"] += 1

    except Exception as e:
        print(f"Error processing {url}: {e}")

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
    all_counts = {}

    # Process all link files (0-12)
    for i in range(13):
        counts = download_and_process_file(i)
        merge_counts(all_counts, counts)

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
