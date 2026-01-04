#!/bin/bash
# Download all Tanakh texts from Sefaria-Export

BASE_URL="https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/json/Tanakh"
OUT_DIR="data/texts"

mkdir -p "$OUT_DIR"

# Torah
TORAH_BOOKS="Genesis Exodus Leviticus Numbers Deuteronomy"

# Prophets (Nevi'im)
PROPHETS_BOOKS="Joshua Judges I%20Samuel II%20Samuel I%20Kings II%20Kings Isaiah Jeremiah Ezekiel Hosea Joel Amos Obadiah Jonah Micah Nahum Habakkuk Zephaniah Haggai Zechariah Malachi"

# Writings (Ketuvim)
WRITINGS_BOOKS="Psalms Proverbs Job Song%20of%20Songs Ruth Lamentations Ecclesiastes Esther Daniel Ezra Nehemiah I%20Chronicles II%20Chronicles"

download_book() {
    local category=$1
    local book=$2
    local book_clean=$(echo "$book" | sed 's/%20/ /g')
    local filename=$(echo "$book_clean" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')

    echo "Downloading $book_clean..."

    # Hebrew
    curl -s "$BASE_URL/$category/$book/Hebrew/merged.json" -o "$OUT_DIR/${filename}-he.json"

    # English
    curl -s "$BASE_URL/$category/$book/English/merged.json" -o "$OUT_DIR/${filename}-en.json"
}

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
