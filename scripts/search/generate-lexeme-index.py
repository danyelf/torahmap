#!/usr/bin/env python3
"""
Build the Hebrew lexeme index used by Torah Map's root-mode search.

Reads the ETCBC BHSA database through Text-Fabric and writes four files into
public/data/search/. What each file holds, where BHSA comes from and how to set
up Text-Fabric are all documented in public/data/search/README.md — read that
first.

Prerequisites:
  .venv/bin/pip install text-fabric
  The BHSA data must be present under ~/text-fabric-data/github/ETCBC/bhsa
  (Text-Fabric downloads it with: .venv/bin/text-fabric ETCBC/bhsa)

Usage:
  .venv/bin/python scripts/search/generate-lexeme-index.py
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

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(REPO_ROOT, "public", "data")
# The four generated files live in their own folder, alongside a README that
# records where they came from.
OUT_DIR = os.path.join(DATA_DIR, "search")
BHSA_VERSION = "2021"
BHSA_LOCATION = os.path.expanduser(
    f"~/text-fabric-data/github/ETCBC/bhsa/tf/{BHSA_VERSION}"
)

FEATURES = (
    "otype oslots book chapter verse "
    "g_cons_utf8 g_word_utf8 trailer_utf8 qere_utf8 qere_trailer_utf8 "
    "lex lex_utf8 voc_lex_utf8 gloss sp language root "
    "vs vt ps nu gn st prs"
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


def ends_printed_word(trailer):
    """True when something is printed after this unit, so it ends a word.

    A unit with an empty trailer runs straight into the next one: the two are
    printed as a single word, and the first of them is part of a word rather
    than a word.
    """
    return any(ch.isspace() or ch in "־׃" for ch in trailer or "")


def internal_separators(word_text):
    """The separators inside a single BHSA word.

    A few dozen proper names are one dictionary word written as two: תובל קין,
    רחבת עיר, בית לחם. BHSA gives the whole name one word, so the space or
    maqaf between its halves sits inside the word's own text rather than in the
    trailer that follows it. The printed page still shows two words there.
    """
    return [ch for ch in (word_text or "") if ch.isspace() or ch == "־"]


def is_maqaf_break(trailer):
    """True when the break is a maqaf, which binds this word to the next.

    כל־הארץ is one word on the page and two in the dictionary. Recording which
    breaks are maqafs lets a reader of the file have it either way.
    """
    return "־" in (trailer or "")


def printed_trailer(F, node):
    """What is printed after a unit, as the reader sees it.

    A corrected word carries a second trailer, for the reading rather than the
    writing, and the two can differ: בגד is written as one word and read as
    two, בא גד. What is printed is what says where a word ends.
    """
    if F.qere_utf8.v(node):
        return F.qere_trailer_utf8.v(node)
    return F.trailer_utf8.v(node)


def printed_words(F, L, verse_node):
    """Group a verse's ETCBC units into the words the page prints.

    Yields (units, trailer): the run of units printed with nothing between
    them, and what is printed after the last of them. The last unit of a verse
    ends a word whatever its trailer holds.

    This is the rule the whole index rests on. Everything the walk does with a
    word -- which lexeme it belongs to, which spellings lead to it, how many
    units it took -- follows from the grouping, so the grouping is made once,
    here, rather than reconstructed from accumulators as the walk goes.
    """
    run = []
    nodes = L.d(verse_node, "word")
    for position, node in enumerate(nodes):
        run.append(node)
        trailer = printed_trailer(F, node)
        if ends_printed_word(trailer) or position == len(nodes) - 1:
            yield run, trailer
            run = []


def close_word(word_lengths, maqaf_joins, morphemes, inner, trailer):
    """Record the printed word just finished, and any it was printed with.

    Nearly always this adds one word carrying all the morphemes read since the
    last break. Where BHSA held a two-part name in a single word, the extra
    halves follow it carrying no morphemes of their own -- a length of 0 means
    "the same dictionary word as the one before, printed separately".
    """
    word_lengths.append(morphemes)
    for separator in inner:
        if separator == "־":
            maqaf_joins.append(len(word_lengths) - 1)
        word_lengths.append(0)
    if is_maqaf_break(trailer):
        maqaf_joins.append(len(word_lengths) - 1)


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

    # ---- walk the text --------------------------------------------------
    # form_counts[(written form, lexeme)] -> how many printed words with that
    # spelling are read as that word, so that ambiguous forms can list their
    # likeliest lexeme first. One per occurrence, whatever the word's shape.
    form_counts = collections.Counter()
    verse_lexemes = collections.defaultdict(set)
    verse_morph = collections.defaultdict(list)
    # How many morphemes make up each printed word, and which of those words a
    # maqaf rather than a space follows.
    verse_words = collections.defaultdict(list)
    verse_joins = collections.defaultdict(list)
    morph_ids = {}
    morph_table = []

    unmapped_books = set()
    word_total = 0
    # Units printed with nothing after them, which are parts of a word rather
    # than words, and the reason the rule needs only one test: none of them
    # carries a pronominal suffix, so "bound" never has to be qualified.
    bound_total = 0
    bound_and_suffixed = []

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

        word_lengths = []
        maqaf_joins = []

        for units, trailer in printed_words(F, L, verse_node):
            word_total += len(units)

            word_forms = []   # the written form of each unit, in order
            word_inner = []   # separators printed inside those units
            for node in units:
                lexeme = lex_index[L.u(node, "lex")[0]]
                combo = tuple(
                    "" if (v := getattr(F, field).v(node)) in (None, "NA", "n/a")
                    else v
                    for field in MORPH_FIELDS
                )
                morph = morph_ids.get(combo)
                if morph is None:
                    morph = morph_ids[combo] = len(morph_table)
                    morph_table.append(".".join(combo))
                verse_morph[key].append([lexeme, morph])
                word_forms.append(normalize(F.g_cons_utf8.v(node) or ""))
                # Where the text is corrected, the page shows the qere, and the
                # two readings need not be the same number of words: בגד is
                # written as one and read as two, בא גד.
                word_inner.extend(
                    internal_separators(F.qere_utf8.v(node) or F.g_word_utf8.v(node))
                )

            # Every unit but the last has nothing printed after it, so it runs
            # into its neighbour and the two are one word on the page. A bound
            # unit is not a word: it is never indexed and never puts its lexeme
            # into the verse. These are the proclitics -- ו, ה, ל, ב, מן, כ --
            # and "every verse containing the letter ל" is not a question
            # anyone means to ask.
            for node in units[:-1]:
                bound_total += 1
                if F.prs.v(node) not in (None, "absent", "n/a", "NA"):
                    bound_and_suffixed.append(f"{key} {F.g_word_utf8.v(node)}")

            # The last unit is the word's stem, and the word belongs to its
            # lexeme. Both the whole word and the stem on its own are filed
            # there: the first is what a reader types when they copy בראשית off
            # the page, the second is what they type when they mean ראשית.
            stem = units[-1]
            lexeme = lex_index[L.u(stem, "lex")[0]]
            verse_lexemes[key].add(lexeme)

            # Three spellings lead to this word, and they are not always three
            # strings: a word of one unit is its own stem, so the stem's letters
            # and the whole printed word are written the same. Count each
            # distinct spelling once. Filing the same one twice would count a
            # word printed bare as two occurrences and the same word printed
            # with a prefix as one, which is not what the number claims to be
            # and, since nouns take the article and verbs mostly do not, would
            # quietly rank verbs above nouns.
            written = word_forms[-1]
            qere = normalize(F.qere_utf8.v(stem) or "")
            whole_word = "".join(word_forms)
            for form in dict.fromkeys([written, qere, whole_word]):
                if len(form) >= 2:
                    form_counts[(form, lexeme)] += 1

            # The same grouping, recorded rather than discarded. This is what
            # lets a reader of the file say which printed word a lexeme is,
            # instead of only which verse it is in.
            close_word(word_lengths, maqaf_joins, len(units), word_inner, trailer)

        # Four BHSA verses of Exodus 20 become one Sefaria verse, and four of
        # Deuteronomy 5 likewise, so a key can be written more than once. The
        # words append, and the join positions shift by what is already there.
        already = len(verse_words[key])
        verse_words[key].extend(word_lengths)
        verse_joins[key].extend(already + at for at in maqaf_joins)

    if unmapped_books:
        sys.exit(f"Unmapped BHSA book names: {sorted(unmapped_books)}")

    # The rule is a single test -- is anything printed after this unit? -- and
    # it can stay a single test only while no bound unit carries a suffix. That
    # holds in BHSA 2021 for all 426,590 units. If a later release breaks it,
    # the rule needs a second clause and this should say so rather than quietly
    # drop suffixed words from the index.
    if bound_and_suffixed:
        sys.exit(
            f"{len(bound_and_suffixed)} bound units carry a pronominal suffix, "
            "which the word rule assumes cannot happen:\n  "
            + "\n  ".join(bound_and_suffixed[:10])
        )

    word_lexemes = collections.defaultdict(list)
    for (written, lexeme), count in form_counts.items():
        word_lexemes[written].append((count, lexeme))
    word_lexemes = {
        written: [lexeme for _, lexeme in sorted(pairs, key=lambda p: (-p[0], p[1]))]
        for written, pairs in word_lexemes.items()
    }

    print(f"  {word_total} word occurrences across {len(verse_lexemes)} verses")
    print(f"  {bound_total} of them bound to the next "
          f"({100 * bound_total / word_total:.1f}%), and so not words")
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

    # ---- do the words line up with the text the app shows? --------------
    # A verse one word out would give every word after the discrepancy its
    # neighbour's dictionary entry -- wrong, and plausible enough to go
    # unnoticed. So the words counted here are checked against the Hebrew the
    # app actually displays, and the verses that disagree are named in the file
    # rather than left for a reader to trip over.
    texts = json.load(open(os.path.join(DATA_DIR, "all-texts.json")))

    def displayed_words(hebrew):
        """Split the Hebrew that Sefaria shows into the words a reader sees.

        Two things in that text are not words. Sefaria punctuates with the
        scribal paragraph marks {ס} and {פ}, of which there are 3,552 and which
        BHSA has nothing behind. And where the received text is corrected it
        prints both readings, the ketiv in round brackets and the qere in
        square ones; BHSA carries the one word that is read.
        """
        stripped = re.sub(r"\{[ספ]\}", " ", hebrew or "")
        stripped = re.sub(r"\([^)]*\)", " ", stripped)
        return [
            letters
            for piece in re.split(r"[\s\u05be]+", stripped)
            if (letters := consonants(piece))
        ]

    misaligned = []
    compared = 0
    for key, words in verse_words.items():
        book, chapter, verse = key.rsplit(":", 2)
        entry = texts.get(book, {}).get(chapter, {}).get(verse)
        if entry is None:
            continue
        compared += 1
        if len(displayed_words(entry.get("he", ""))) != len(words):
            misaligned.append(key)

    printed = sum(len(w) for w in verse_words.values())
    joins = sum(len(j) for j in verse_joins.values())
    print(f"  {printed} printed words, {joins} of them joined by a maqaf")
    print(
        f"  {compared - len(misaligned)} of {compared} verses divide into words "
        f"the same way the displayed text does"
    )
    if misaligned:
        # Nearly all of these are compound proper names that BHSA writes with a
        # maqaf and Sefaria writes solid, or the reverse: צורי־שדי against
        # צורישדי. They cannot be reconciled from BHSA alone.
        print(f"  {len(misaligned)} do not, and are listed in the file: "
              + ", ".join(misaligned[:5])
              + (", ..." if len(misaligned) > 5 else ""))

    # ---- write ----------------------------------------------------------
    def write(name, payload):
        path = os.path.join(OUT_DIR, name)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        print(f"  wrote {name} ({os.path.getsize(path) / 1024:.0f} KB)")

    os.makedirs(OUT_DIR, exist_ok=True)
    print("\nWriting:")
    write(
        "lexicon.json",
        {
            "source": f"ETCBC BHSA {BHSA_VERSION}",
            "fields": LEXEME_FIELDS,
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
            "verseFields": ["morphemes", "words", "joined"],
            "misaligned": misaligned,
            "note": (
                "verses[key] is [morphemes, words, joined]. morphemes lists "
                "every ETCBC unit of the verse in text order as [lexeme index, "
                "parsing index]. Those units are morphemes rather than printed "
                "words: the \u05d1 of \u05d1\u05e8\u05d0\u05e9\u05d9\u05ea is "
                "a unit of its own. words gives the number of units making up "
                "each printed word, in the same order, and so sums to the "
                "length of morphemes. A 0 means the printed word is a further "
                "part of the dictionary word before it, as the second half of "
                "\u05ea\u05d5\u05d1\u05dc \u05e7\u05d9\u05df is. A printed "
                "word ends at a space or at a "
                "maqaf; joined lists the positions in words that a maqaf "
                "follows, so that "
                "\u05db\u05dc\u05be\u05d4\u05d0\u05e8\u05e5 can be drawn "
                "as the single word it is printed as while staying two words "
                "here. misaligned names the verses whose words do not line up "
                "with the Hebrew in all-texts.json, because the two sources "
                "divide a compound name differently or the text is absent; "
                "positions in those verses must not be used to label a word."
            ),
            "verses": {
                key: [verse_morph[key], verse_words[key], verse_joins[key]]
                for key in verse_morph
            },
        },
    )

if __name__ == "__main__":
    main()
