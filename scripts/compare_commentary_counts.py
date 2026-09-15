#!/usr/bin/env python3
"""
Compare two commentary counts files and report what moved.

Run this after regenerating the counts, passing the previous version, to see
whether a refresh was worth it and where the links actually grew:

    python3 scripts/compare_commentary_counts.py old.json [new.json]

`new.json` defaults to the file currently in public/data/.
"""

import json
import sys
from collections import defaultdict
from pathlib import Path


def load(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def totals_by_category(counts: dict) -> dict[str, int]:
    """Sum every category across the whole Tanakh."""
    totals: dict[str, int] = defaultdict(int)
    for chapters in counts.values():
        for verses in chapters.values():
            for data in verses.values():
                for category, n in data["categories"].items():
                    totals[category] += n
    return totals


def totals_by_book(counts: dict) -> dict[str, int]:
    return {
        book: sum(
            data["total"] for verses in chapters.values() for data in verses.values()
        )
        for book, chapters in counts.items()
    }


def verse_total(counts: dict, book: str, chapter: str, verse: str) -> int:
    return counts.get(book, {}).get(chapter, {}).get(verse, {}).get("total", 0)


def pct(old: int, new: int) -> str:
    if old == 0:
        return "new" if new else "—"
    change = (new - old) / old * 100
    return f"{change:+.1f}%"


def table(title: str, rows: list[tuple[str, int, int]], label_width: int = 22) -> None:
    print(f"\n{title}")
    print(f"  {'':<{label_width}} {'before':>10} {'after':>10} {'change':>9}")
    for label, old, new in rows:
        print(f"  {label:<{label_width}} {old:>10,} {new:>10,} {pct(old, new):>9}")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__.strip())
        return 1

    project_root = Path(__file__).parent.parent
    old_path = Path(sys.argv[1])
    new_path = (
        Path(sys.argv[2])
        if len(sys.argv) > 2
        else project_root / "public" / "data" / "overlays" / "commentary" / "counts.json"
    )

    for path in (old_path, new_path):
        if not path.exists():
            print(f"No such file: {path}")
            return 1

    old, new = load(old_path), load(new_path)

    print(f"before: {old_path}")
    print(f"after:  {new_path}")

    old_cats, new_cats = totals_by_category(old), totals_by_category(new)
    old_links, new_links = sum(old_cats.values()), sum(new_cats.values())

    def count_verses(counts: dict) -> int:
        return sum(len(verses) for chapters in counts.values() for verses in chapters.values())

    table(
        "Overall",
        [
            ("links", old_links, new_links),
            ("verses with links", count_verses(old), count_verses(new)),
        ],
    )

    categories = sorted(set(old_cats) | set(new_cats))
    table(
        "By category",
        [(c, old_cats.get(c, 0), new_cats.get(c, 0)) for c in categories],
    )

    old_books, new_books = totals_by_book(old), totals_by_book(new)
    books = sorted(
        set(old_books) | set(new_books),
        key=lambda b: new_books.get(b, 0) - old_books.get(b, 0),
        reverse=True,
    )
    movers = books[:5] + books[-5:] if len(books) > 10 else books
    table(
        "Books that moved most (top and bottom 5)",
        [(b, old_books.get(b, 0), new_books.get(b, 0)) for b in movers],
    )

    # Exodus 23:5 is the verse the issue and the generator both spot-check.
    table(
        "Spot check",
        [
            (
                "Exodus 23:5",
                verse_total(old, "Exodus", "23", "5"),
                verse_total(new, "Exodus", "23", "5"),
            )
        ],
    )

    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
