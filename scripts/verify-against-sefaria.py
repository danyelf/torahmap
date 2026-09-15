#!/usr/bin/env python3
"""
Check a regenerated commentary-counts.json against Sefaria's live site.

    python3 scripts/verify-against-sefaria.py

Run this after a refresh. It is the check that catches a bad refresh, and it
catches a specific failure this project has already hit once: downloading only
part of the links export produces a counts file that looks completely normal.

What to look for is the *direction* of the difference, not its size.

Our numbers are not supposed to match the website. We drop Tanakh
cross-references, filter Talmud to direct references, ignore citations covering
more than ten verses, and work from a monthly export rather than the live
database. Roughly 70% of the site's total is normal and fine.

What is not fine is inconsistency. Stale or filtered data is wrong in one
direction for every verse. A partial corpus is wrong in both directions at
once — some verses far under the site, others far over — because the export is
split alphabetically by source text, so a missing file removes a coherent slice
of the library rather than a random sample. If the "shared categories" column
below scatters, suspect the download before you suspect the data.
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

# The categories that mean the same thing on both sides — which is now all of
# them, because we read a text's category out of Sefaria's own index rather
# than guessing it from the links export.
#
# Only Targum, Reference and Tanakh are missing, and those we drop on purpose.
SHARED_CATEGORIES = {
    "Commentary", "Quoting Commentary",
    "Talmud", "Midrash", "Mishnah", "Tosefta",
    "Halakhah", "Responsa", "Jewish Thought",
    "Kabbalah", "Chasidut", "Musar",
    "Liturgy", "Second Temple",
}

# Spread across Torah, Nevi'im and Ketuvim, and across heavily and lightly
# commented verses, so a problem confined to one part of the library shows up.
SAMPLE = [
    ("Genesis", 1, 1), ("Genesis", 2, 7), ("Exodus", 20, 2), ("Exodus", 23, 5),
    ("Leviticus", 19, 18), ("Numbers", 6, 24), ("Deuteronomy", 6, 4),
    ("Joshua", 1, 8), ("I Samuel", 2, 1), ("Isaiah", 6, 3),
    ("Isaiah", 53, 5), ("Jeremiah", 31, 30), ("Ezekiel", 1, 1),
    ("Jonah", 2, 1), ("Psalms", 1, 1), ("Psalms", 23, 1),
    ("Psalms", 119, 1), ("Proverbs", 3, 5), ("Job", 1, 1),
    ("Song of Songs", 1, 1), ("Ruth", 1, 1), ("Ecclesiastes", 1, 2),
    ("Esther", 2, 5), ("Daniel", 12, 2), ("Nehemiah", 8, 8),
    ("II Chronicles", 36, 23),
]

REQUEST_PAUSE_SECONDS = 1.5


def live_counts(book: str, chapter: int, verse: int) -> dict[str, int]:
    ref = urllib.parse.quote(f"{book}.{chapter}.{verse}")
    url = f"https://www.sefaria.org/api/related/{ref}"
    with urllib.request.urlopen(url, timeout=90) as response:
        payload = json.load(response)
    totals: dict[str, int] = defaultdict(int)
    for link in payload.get("links", []):
        totals[link.get("category", "Unknown")] += 1
    return totals


def main() -> int:
    project_root = Path(__file__).parent.parent
    counts_path = (
        Path(sys.argv[1]) if len(sys.argv) > 1
        else project_root / "public" / "data" / "commentary-counts.json"
    )
    if not counts_path.exists():
        print(f"No such file: {counts_path}")
        return 1

    ours_all = json.load(open(counts_path))
    print(f"checking {counts_path}\n")

    header = f"{'verse':<22} {'shared categories':>24}   {'all links':>16}"
    print(header)
    print(f"{'':<22} {'ours':>7} {'site':>7} {'diff':>7}   {'ours':>7} {'site':>7}")
    print("-" * len(header))

    shared_diffs: list[float] = []
    unreachable: list[str] = []

    for book, chapter, verse in SAMPLE:
        label = f"{book} {chapter}:{verse}"
        entry = ours_all.get(book, {}).get(str(chapter), {}).get(str(verse), {})
        our_categories = entry.get("categories", {})
        our_shared = sum(n for c, n in our_categories.items() if c in SHARED_CATEGORIES)
        our_total = entry.get("total", 0)

        try:
            live = live_counts(book, chapter, verse)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            print(f"{label:<22} {our_shared:>7}   could not reach Sefaria: {e}")
            unreachable.append(label)
            continue

        live_shared = sum(n for c, n in live.items() if c in SHARED_CATEGORIES)
        live_total = sum(live.values())

        if live_shared:
            diff = (our_shared - live_shared) / live_shared * 100
            shared_diffs.append(diff)
            diff_text = f"{diff:+.0f}%"
        else:
            diff_text = "-"

        print(
            f"{label:<22} {our_shared:>7} {live_shared:>7} {diff_text:>7}   "
            f"{our_total:>7} {live_total:>7}"
        )
        time.sleep(REQUEST_PAUSE_SECONDS)

    print()
    if unreachable:
        print(f"Sefaria did not answer for {len(unreachable)} verse(s): "
              f"{', '.join(unreachable)}")
        print("Those are unchecked, not passing.\n")

    if not shared_diffs:
        print("Nothing could be compared.")
        return 1

    below = [d for d in shared_diffs if d < -5]
    above = [d for d in shared_diffs if d > 5]
    print(f"compared {len(shared_diffs)} verses on shared categories: "
          f"{len(below)} below the site, {len(above)} above, "
          f"{len(shared_diffs) - len(below) - len(above)} within 5%")
    print(f"range: {min(shared_diffs):+.0f}% to {max(shared_diffs):+.0f}%")

    if below and above:
        print(
            "\nDifferences run in BOTH directions. That is the signature of an\n"
            "incomplete links export, not of stale data. Check that you have\n"
            "every links CSV the bucket offers before trusting these counts:\n"
            "  scripts/refresh-commentary-counts.sh"
        )
        return 1

    print("\nDifferences are consistent in one direction, which is what a good "
          "refresh looks like.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
