#!/bin/bash
# Download all Tanakh texts from Sefaria's public export bucket.
#
# We ask for two specific editions by name rather than for Sefaria's "merged"
# file. A merged file is not an edition: it fills each verse from whichever
# version ranks highest for that verse, so its contents can change without any
# change here, and it can mix editions from one book to the next.
#
# The bucket strips the colon out of filenames, so the English URL says
# "THE JPS TANAKH Gender-Sensitive Edition" while the file's own versionTitle
# field keeps it. scripts/bundle-texts.ts checks that field against the name
# below, so a wrong or stale download stops the build.
set -euo pipefail

BASE_URL="https://storage.googleapis.com/sefaria-export/json/Tanakh"
OUT_DIR="data/texts"

# Edition names as they appear in the bucket path (no colon; see above).
HEBREW_VERSION="Miqra according to the Masorah"
ENGLISH_VERSION="THE JPS TANAKH Gender-Sensitive Edition"

mkdir -p "$OUT_DIR"

# Torah
TORAH_BOOKS="Genesis Exodus Leviticus Numbers Deuteronomy"

# Prophets (Nevi'im)
PROPHETS_BOOKS="Joshua Judges I%20Samuel II%20Samuel I%20Kings II%20Kings Isaiah Jeremiah Ezekiel Hosea Joel Amos Obadiah Jonah Micah Nahum Habakkuk Zephaniah Haggai Zechariah Malachi"

# Writings (Ketuvim)
WRITINGS_BOOKS="Psalms Proverbs Job Song%20of%20Songs Ruth Lamentations Ecclesiastes Esther Daniel Ezra Nehemiah I%20Chronicles II%20Chronicles"

# Percent-encode the spaces in an edition name for use in a URL path.
url_escape() {
    echo "${1// /%20}"
}

HEBREW_PATH=$(url_escape "$HEBREW_VERSION")
ENGLISH_PATH=$(url_escape "$ENGLISH_VERSION")

# Fetch one file, leaving the existing copy untouched if anything goes wrong.
# Without -f, curl writes the server's 404 page into the output file and exits
# 0, which is how a broken URL can sit unnoticed for months.
fetch() {
    local url=$1
    local dest=$2
    local tmp="${dest}.download"

    if ! curl -fsSL "$url" -o "$tmp"; then
        rm -f "$tmp"
        echo "ERROR: could not download $url" >&2
        return 1
    fi
    mv "$tmp" "$dest"
}

download_book() {
    local category=$1
    local book=$2
    local book_clean=${book//%20/ }
    local filename
    filename=$(echo "$book_clean" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')

    echo "Downloading $book_clean..."

    fetch "$BASE_URL/$category/$book/Hebrew/$HEBREW_PATH.json" "$OUT_DIR/${filename}-he.json"
    fetch "$BASE_URL/$category/$book/English/$ENGLISH_PATH.json" "$OUT_DIR/${filename}-en.json"
}

echo "Hebrew:  $HEBREW_VERSION"
echo "English: $ENGLISH_VERSION"
echo

echo "Downloading Torah..."
for book in $TORAH_BOOKS; do
    download_book "Torah" "$book"
done

echo "Downloading Prophets..."
for book in $PROPHETS_BOOKS; do
    download_book "Prophets" "$book"
done

echo "Downloading Writings..."
for book in $WRITINGS_BOOKS; do
    download_book "Writings" "$book"
done

echo "Done! Downloaded files:"
ls -la "$OUT_DIR"
