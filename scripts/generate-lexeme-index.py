#!/usr/bin/env python3
"""
Build the Hebrew lexeme index used by Torah Map's root-mode search.

Source: the ETCBC BHSA database (Biblia Hebraica Stuttgartensia Amstelodamensis),
read through Text-Fabric. BHSA identifies every word in the Hebrew Bible with a
lexeme -- a dictionary entry -- and keeps homographs apart, so the preposition
"upon" and the verb "ascend" are separate entries even where they are spelled
alike. It also carries an English gloss per lexeme and the grammatical parsing of
each occurrence.

Outputs, all under public/data/:

  lexicon.json          the dictionary: one row per lexeme, holding its
                        vocalized display form, English gloss, part of speech,
                        language and (where BHSA supplies one) the derivational
                        root
  word-lexemes.json     written form (nikkud stripped, final letters folded to
                        their medial shape) -> the lexemes it can be, most
                        frequent reading first
  verse-lexemes.json    verse key -> the distinct lexemes occurring in it
  verse-morphology.json every word occurrence in order, with its lexeme and its
                        grammatical parsing, for a future grammatical-form
                        filter. Search does not load this file.

Lexemes are referred to by their position in the lexicon.json array, which keeps
the two large per-verse files compact.

Prerequisites:
  pip install text-fabric
  The BHSA data must be present under ~/text-fabric-data/github/ETCBC/bhsa
  (Text-Fabric downloads it with: text-fabric ETCBC/bhsa)

Usage:
  python3 scripts/generate-lexeme-index.py
"""

import collections
import json
import os
import re
import sys

try:
    from tf.fabric import Fabric
except ImportError:  # pragma: no cover - operator-facing message
    sys.exit(
        "text-fabric is not installed. Install it into a virtual environment:\n"
        "  python3 -m venv .venv && .venv/bin/pip install text-fabric"
    )

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "public", "data")
BHSA_VERSION = "2021"
BHSA_LOCATION = os.path.expanduser(
    f"~/text-fabric-data/github/ETCBC/bhsa/tf/{BHSA_VERSION}"
)

FEATURES = (
    "otype oslots book chapter verse "
    "g_cons_utf8 g_word_utf8 trailer_utf8 qere_utf8 "
    "lex lex_utf8 voc_lex_utf8 gloss sp language freq_lex root "
    "vs vt ps nu gn st"
)

# BHSA names its books in Latin; the app uses Sefaria's English names.
BOOK_NAMES = {
    "Genesis": "Genesis",
    "Exodus": "Exodus",
    "Leviticus": "Leviticus",
    "Numbers": "Numbers",
    "Deuteronomy": "Deuteronomy",
    "Joshua": "Joshua",
    "Judges": "Judges",
    "1_Samuel": "I Samuel",
    "2_Samuel": "II Samuel",
    "1_Kings": "I Kings",
    "2_Kings": "II Kings",
    "Isaiah": "Isaiah",
    "Jeremiah": "Jeremiah",
    "Ezekiel": "Ezekiel",
    "Hosea": "Hosea",
    "Joel": "Joel",
    "Amos": "Amos",
    "Obadiah": "Obadiah",
    "Jonah": "Jonah",
    "Micah": "Micah",
    "Nahum": "Nahum",
    "Habakkuk": "Habakkuk",
    "Zephaniah": "Zephaniah",
    "Haggai": "Haggai",
    "Zechariah": "Zechariah",
    "Malachi": "Malachi",
    "Psalms": "Psalms",
    "Job": "Job",
    "Proverbs": "Proverbs",
    "Ruth": "Ruth",
    "Song_of_songs": "Song of Songs",
    "Ecclesiastes": "Ecclesiastes",
    "Lamentations": "Lamentations",
    "Esther": "Esther",
    "Daniel": "Daniel",
    "Ezra": "Ezra",
    "Nehemiah": "Nehemiah",
    "1_Chronicles": "I Chronicles",
    "2_Chronicles": "II Chronicles",
}

# BHSA and Sefaria number the verses identically in 926 of the 929 chapters.
# The three exceptions, and the whole of the difference, are:
#
#   Exodus 20      BHSA gives each of the short prohibitions of the Decalogue
#                  its own verse (13, 14, 15, 16); Sefaria keeps them together
#                  as verse 13. Everything after that runs three verses ahead.
#   Deuteronomy 5  the same split, at verses 17-20 against Sefaria's 17.
#   Numbers 25     BHSA closes the chapter with a nineteenth verse ("and it was
#                  after the plague"), which Sefaria reads as the opening of
#                  chapter 26.
#
# Both mappings were derived by lining up the consonantal text word by word and
# are re-checked at the bottom of this script against the verse counts the app
# already ships in tanakh-structure.json.
VERSE_REMAP = {}
for _bhsa, _sefaria in [(13, 13), (14, 13), (15, 13), (16, 13)]:
    VERSE_REMAP[("Exodus", 20, _bhsa)] = ("Exodus", 20, _sefaria)
for _bhsa in range(17, 27):
    VERSE_REMAP[("Exodus", 20, _bhsa)] = ("Exodus", 20, _bhsa - 3)
for _bhsa in (17, 18, 19, 20):
    VERSE_REMAP[("Deuteronomy", 5, _bhsa)] = ("Deuteronomy", 5, 17)
for _bhsa in range(21, 34):
    VERSE_REMAP[("Deuteronomy", 5, _bhsa)] = ("Deuteronomy", 5, _bhsa - 3)
VERSE_REMAP[("Numbers", 25, 19)] = ("Numbers", 26, 1)

# Hebrew points and accents. Everything in this block is dropped except the
# separators listed below, which become spaces.
POINT_START = 0x0591
POINT_END = 0x05C7
SEPARATORS = {0x05BE, 0x05C0, 0x05C3, 0x05C6}  # maqaf, paseq, sof pasuq, nun hafukha

FINAL_TO_MEDIAL = {
    "ך": "כ",  # kaf
    "ם": "מ",  # mem
    "ן": "נ",  # nun
    "ף": "פ",  # pe
    "ץ": "צ",  # tsadi
}

# Occurrence-level grammar recorded for each word, in this order.
MORPH_FIELDS = ["vs", "vt", "ps", "nu", "gn", "st"]

# Column order of the rows in lexicon.json.
LEXEME_FIELDS = ["id", "form", "gloss", "pos", "lang", "root"]

# Function words make poor "related word" suggestions, so lexemes with these
# parts of speech are left out of the related-word grouping.
FUNCTION_WORD_POS = {
    "art", "conj", "prep", "nega", "inrg", "intj",
    "prde", "prin", "prps", "advb",
}


def normalize(text):
    """Fold Hebrew text to the shape the search box works in.

    Points and accents are removed, word separators become spaces, and final
    letters become their medial form. This mirrors normalizeHebrewForSearch()
    in src/search.ts; the two must agree or lookups will miss.
    """
    out = []
    for ch in text or "":
        code = ord(ch)
        if POINT_START <= code <= POINT_END and code not in SEPARATORS:
            continue
        if code in SEPARATORS or ch == "-":
            out.append(" ")
        else:
            out.append(FINAL_TO_MEDIAL.get(ch, ch))
    return " ".join("".join(out).split())


def consonants(text):
    """Keep only Hebrew letters, folding finals to medial forms."""
    return "".join(
        FINAL_TO_MEDIAL.get(ch, ch)
        for ch in text or ""
        if 0x05D0 <= ord(ch) <= 0x05EA
    )


def is_token_break(trailer):
    """True when the trailer after a word ends the whitespace-delimited token."""
    return any(ch.isspace() or ch in "־׃" for ch in trailer or "")


def main():
    if not os.path.isdir(BHSA_LOCATION):
        sys.exit(
            f"BHSA data not found at {BHSA_LOCATION}\n"
            "Download it with: text-fabric ETCBC/bhsa"
        )

    print(f"Loading BHSA {BHSA_VERSION} from {BHSA_LOCATION}")
    api = Fabric(locations=BHSA_LOCATION, silent="deep").load(FEATURES, silent="deep")
    F, L, T = api.F, api.L, api.T

    # ---- the dictionary -------------------------------------------------
    lex_nodes = sorted(F.otype.s("lex"))
    lex_index = {node: i for i, node in enumerate(lex_nodes)}

    lexemes = []
    for node in lex_nodes:
        display = F.voc_lex_utf8.v(node) or F.lex_utf8.v(node) or ""
        # BHSA spells roots in its own transliteration, where ">" is aleph and
        # "<" is ayin; the only angle brackets that are not letters are the
        # placeholders "<unknown>", "<uncertain>" and "<unclear>".
        root = F.root.v(node)
        if root and re.fullmatch(r"<[a-z]+>", root):
            root = None
        lexemes.append(
            [
                F.lex.v(node),
                display,
                F.gloss.v(node) or "",
                F.sp.v(node) or "",
                "arc" if F.language.v(node) == "Aramaic" else "heb",
                root,
            ]
        )
    print(f"  {len(lexemes)} lexemes "
          f"({sum(1 for x in lexemes if x[4] == 'arc')} Aramaic)")

    # Function words are indexed only under their own spelling. A reader typing
    # a word into root search wants the word, and a preposition carrying a
    # pronominal suffix -- Aramaic על + ה, written עלה, "upon him" -- would
    # otherwise attach itself to a search for the verb עלה "ascend" and drag in
    # every one of the 5,700 places the preposition occurs.
    function_word_spelling = [
        consonants(row[1]) if row[3] in FUNCTION_WORD_POS else None
        for row in lexemes
    ]

    def indexable(written, lexeme):
        expected = function_word_spelling[lexeme]
        return expected is None or written == expected

    # ---- walk the text --------------------------------------------------
    # form_counts[(written form, lexeme)] -> how often that reading occurs, so
    # that ambiguous forms can list their likeliest lexeme first.
    form_counts = collections.Counter()
    verse_lexemes = collections.defaultdict(set)
    verse_morph = collections.defaultdict(list)
    morph_ids = {}
    morph_table = []

    unmapped_books = set()
    word_total = 0

    for verse_node in F.otype.s("verse"):
        bhsa_book, chapter, verse = T.sectionFromNode(verse_node)
        book = BOOK_NAMES.get(bhsa_book)
        if book is None:
            unmapped_books.add(bhsa_book)
            continue
        book, chapter, verse = VERSE_REMAP.get(
            (book, chapter, verse), (book, chapter, verse)
        )
        key = f"{book}:{chapter}:{verse}"

        token_forms = []       # written forms making up the current token
        token_last_lexeme = None

        for word_node in L.d(verse_node, "word"):
            word_total += 1
            lexeme = lex_index[L.u(word_node, "lex")[0]]
            verse_lexemes[key].add(lexeme)

            combo = tuple(
                "" if (v := getattr(F, field).v(word_node)) in (None, "NA", "n/a")
                else v
                for field in MORPH_FIELDS
            )
            morph = morph_ids.get(combo)
            if morph is None:
                morph = morph_ids[combo] = len(morph_table)
                morph_table.append(".".join(combo))
            verse_morph[key].append([lexeme, morph])

            written = normalize(F.g_cons_utf8.v(word_node) or "")
            if len(written) >= 2 and indexable(written, lexeme):
                form_counts[(written, lexeme)] += 1
            qere = normalize(F.qere_utf8.v(word_node) or "")
            if len(qere) >= 2 and qere != written and indexable(qere, lexeme):
                form_counts[(qere, lexeme)] += 1

            token_forms.append(written)
            token_last_lexeme = lexeme

            if is_token_break(F.trailer_utf8.v(word_node)):
                # The whole token, prefixes and all, is filed under the lexeme
                # of its final segment -- the stem. BHSA splits proclitics such
                # as the ב of בראשית into their own words, so without this a
                # reader who types the word as it is printed would find nothing.
                token = "".join(token_forms)
                if (
                    len(token) >= 2
                    and token_last_lexeme is not None
                    and indexable(token, token_last_lexeme)
                ):
                    form_counts[(token, token_last_lexeme)] += 1
                token_forms = []
                token_last_lexeme = None

        if token_forms and token_last_lexeme is not None:
            token = "".join(token_forms)
            if len(token) >= 2 and indexable(token, token_last_lexeme):
                form_counts[(token, token_last_lexeme)] += 1

    if unmapped_books:
        sys.exit(f"Unmapped BHSA book names: {sorted(unmapped_books)}")

    word_lexemes = collections.defaultdict(list)
    for (written, lexeme), count in form_counts.items():
        word_lexemes[written].append((count, lexeme))
    word_lexemes = {
        written: [lexeme for _, lexeme in sorted(pairs, key=lambda p: (-p[0], p[1]))]
        for written, pairs in word_lexemes.items()
    }

    print(f"  {word_total} word occurrences across {len(verse_lexemes)} verses")
    print(f"  {len(word_lexemes)} distinct written forms")
    print(f"  {len(morph_table)} distinct grammatical parsings")

    # ---- checks ---------------------------------------------------------
    structure = json.load(open(os.path.join(DATA_DIR, "tanakh-structure.json")))
    expected = {b["name"]: b["chapters"] for b in structure["books"]}

    produced = collections.defaultdict(dict)
    for key in verse_lexemes:
        book, chapter, verse = key.rsplit(":", 2)
        produced[book][int(chapter)] = max(
            produced[book].get(int(chapter), 0), int(verse)
        )

    problems = []
    for book, chapters in expected.items():
        if book not in produced:
            problems.append(f"{book}: no verses produced")
            continue
        if len(produced[book]) != len(chapters):
            problems.append(
                f"{book}: {len(produced[book])} chapters, expected {len(chapters)}"
            )
        for i, count in enumerate(chapters):
            got = produced[book].get(i + 1)
            if got != count:
                problems.append(f"{book} {i + 1}: last verse {got}, expected {count}")
    if problems:
        print("\nVerse alignment does not match tanakh-structure.json:")
        for p in problems[:40]:
            print("  " + p)
        sys.exit(1)
    print("  verse keys agree with tanakh-structure.json in all 929 chapters")

    covered = sum(
        1
        for book, chapters in expected.items()
        for i, count in enumerate(chapters)
        for v in range(1, count + 1)
        if f"{book}:{i + 1}:{v}" in verse_lexemes
    )
    total = sum(sum(b) for b in expected.values())
    print(f"  {covered} of {total} verses carry lexemes")

    # ---- write ----------------------------------------------------------
    def write(name, payload):
        path = os.path.join(DATA_DIR, name)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        print(f"  wrote {name} ({os.path.getsize(path) / 1024:.0f} KB)")

    print("\nWriting:")
    write(
        "lexicon.json",
        {
            "source": f"ETCBC BHSA {BHSA_VERSION}",
            "fields": LEXEME_FIELDS,
            "functionWordPos": sorted(FUNCTION_WORD_POS),
            "lexemes": lexemes,
        },
    )
    write("word-lexemes.json", word_lexemes)
    write(
        "verse-lexemes.json",
        {key: sorted(values) for key, values in verse_lexemes.items()},
    )
    write(
        "verse-morphology.json",
        {
            "fields": MORPH_FIELDS,
            "parsings": morph_table,
            "note": "verses[key] lists every word occurrence in text order as "
                    "[lexeme index, parsing index]",
            "verses": verse_morph,
        },
    )


if __name__ == "__main__":
    main()
