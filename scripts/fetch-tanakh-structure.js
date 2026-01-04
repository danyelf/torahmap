#!/usr/bin/env node

// Fetch Tanakh structure from Sefaria API

const TANAKH_BOOKS = {
  torah: [
    { english: "Genesis", hebrew: "בראשית" },
    { english: "Exodus", hebrew: "שמות" },
    { english: "Leviticus", hebrew: "ויקרא" },
    { english: "Numbers", hebrew: "במדבר" },
    { english: "Deuteronomy", hebrew: "דברים" },
  ],
  neviim: [
    { english: "Joshua", hebrew: "יהושע" },
    { english: "Judges", hebrew: "שופטים" },
    { english: "I Samuel", hebrew: "שמואל א" },
    { english: "II Samuel", hebrew: "שמואל ב" },
    { english: "I Kings", hebrew: "מלכים א" },
    { english: "II Kings", hebrew: "מלכים ב" },
    { english: "Isaiah", hebrew: "ישעיהו" },
    { english: "Jeremiah", hebrew: "ירמיהו" },
    { english: "Ezekiel", hebrew: "יחזקאל" },
    { english: "Hosea", hebrew: "הושע" },
    { english: "Joel", hebrew: "יואל" },
    { english: "Amos", hebrew: "עמוס" },
    { english: "Obadiah", hebrew: "עובדיה" },
    { english: "Jonah", hebrew: "יונה" },
    { english: "Micah", hebrew: "מיכה" },
    { english: "Nahum", hebrew: "נחום" },
    { english: "Habakkuk", hebrew: "חבקוק" },
    { english: "Zephaniah", hebrew: "צפניה" },
    { english: "Haggai", hebrew: "חגי" },
    { english: "Zechariah", hebrew: "זכריה" },
    { english: "Malachi", hebrew: "מלאכי" },
  ],
  ketuvim: [
    { english: "Psalms", hebrew: "תהלים" },
    { english: "Proverbs", hebrew: "משלי" },
    { english: "Job", hebrew: "איוב" },
    { english: "Song of Songs", hebrew: "שיר השירים" },
    { english: "Ruth", hebrew: "רות" },
    { english: "Lamentations", hebrew: "איכה" },
    { english: "Ecclesiastes", hebrew: "קהלת" },
    { english: "Esther", hebrew: "אסתר" },
    { english: "Daniel", hebrew: "דניאל" },
    { english: "Ezra", hebrew: "עזרא" },
    { english: "Nehemiah", hebrew: "נחמיה" },
    { english: "I Chronicles", hebrew: "דברי הימים א" },
    { english: "II Chronicles", hebrew: "דברי הימים ב" },
  ],
};

async function fetchBookShape(bookName) {
  const url = `https://www.sefaria.org/api/shape/${encodeURIComponent(bookName)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${bookName}: ${response.status}`);
  }
  const data = await response.json();
  // The shape API returns an array with one object containing chapters
  return data[0].chapters;
}

async function main() {
  const allBooks = [
    ...TANAKH_BOOKS.torah,
    ...TANAKH_BOOKS.neviim,
    ...TANAKH_BOOKS.ketuvim,
  ];

  const books = [];
  let totalVerses = 0;

  for (const book of allBooks) {
    console.error(`Fetching ${book.english}...`);
    try {
      const chapters = await fetchBookShape(book.english);

      const verseCount = chapters.reduce((sum, c) => sum + c, 0);
      totalVerses += verseCount;

      books.push({
        name: book.english,
        hebrewName: book.hebrew,
        chapters: chapters,
      });

      console.error(`  ${chapters.length} chapters, ${verseCount} verses`);
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }

    // Be nice to the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.error(`\nTotal: ${books.length} books, ${totalVerses} verses`);

  const output = { books };
  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);
