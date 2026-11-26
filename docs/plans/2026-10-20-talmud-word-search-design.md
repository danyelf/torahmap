# Searching the Talmud by dictionary word

**Status:** Plan, decisions open for Danyel. Issue #382.
Nothing built from Sefaria's word list ships until Sefaria says how it may be used.

## What we want

In the Tanakh, typing a Hebrew word finds every form of it: typing אמר also
finds ויאמר and אמרו. It also lets the reader narrow the results by meaning.
That works because ETCBC's BHSA tags every word of the Bible with its
dictionary word.

Nobody has done that for the Babylonian Talmud. We want the same search
there. This document sets out what we can build from data that already exists,
as a series of numbered decisions. Each one gives the choices, examples, and
what I recommend.

## Words used here

- **Spelling.** A word as it is written in the text, without vowels: אמר, ליה.
  The Talmud's search text has 92,015 different spellings of two letters or
  more.
- **Occurrence.** One place where a spelling appears. There are 1,849,397
  occurrences in all. (Single letters are left out, because search leaves them
  out.) Most of the percentages below count occurrences, because those are
  what a reader sees on the map.
- **Jastrow.** Marcus Jastrow's *Dictionary of the Targumim, the Talmud Bavli
  and Yerushalmi* (1903), the standard dictionary of Talmudic Hebrew and
  Aramaic. It is out of copyright.
- **Entry.** One headword in Jastrow, with its definition, such as אֲמַר "to
  say" (Aramaic). Jastrow often has several entries with the same letters.
- **Segment.** One of Sefaria's numbered passages within a page, usually a
  sentence or two ("Berakhot 2a:3").

The text measured is `public/data/talmud/search.json`, the William Davidson
edition with its abbreviations spelled out, which is what the Talmud's search
already reads.

## Where the data comes from

Sefaria publishes its whole database as a download (2.6 GB;
DATA_REGENERATION.md says how to get it). One part of it is a word list that
links spellings to entries in Jastrow: 130,058 links in all. Each link records
how Sefaria made it. There are four kinds, and they mean different things:

1. **Spellings found in the Talmud by a program** (65,286 links). These are
   spellings as they appear in the Talmud, prefixes included, such as דאמר and
   ליה. Each link also lists every segment where the spelling appears. They
   seem to have been made by a program that took prefix letters off and looked
   the rest up, so some links are wrong. For example, it links ליה ("to him")
   to the entry יָהּ ("Yah", a name of God), by reading it as ל + יה. It links
   מאי ("what?") to eight entries spelled אי, by reading it as מ + אי.
2. **The entry's own spelling** (about 55,000 links). Jastrow's headword
   itself, usually with vowels, and its plurals and verb forms. These list no
   passages.
3. **Jastrow's quotations** (9,866 links). The spelling where Jastrow's entry
   quotes a passage of the Talmud, with that passage named.
4. **Sefaria's hand-picked entries** (279 links). For a few hundred common
   Talmud words, someone at Sefaria chose the right entry: ליה → לְ־ ("to"),
   רבי → רַבִּי ("Rabbi"), מאי → מַאי ("what?"), דאמר → אֲמַר ("to say").

`scripts/talmud/word-forms-report.ts` measures everything below. The figures
are from the download of 2026-10-19.

## How far the list reaches

- **77.6% of occurrences** have a spelling that is in the list.
- Of those, **30.6%** link to a single entry. The rest link to several: 52.0%
  to two to five entries, 17.3% to more than five.

So for most words the list says "this could be any of these entries", not
"this is that entry". Here is what it says for three common words. The
definitions are the first words of Jastrow's entry.

**אמר** (44,000 occurrences), six entries, none hand-picked:

| entry | Jastrow's definition |
|---|---|
| אָמַר I (Hebrew) | to join, knot … to join words, compose (that is, to say) |
| אֲמַר (Aramaic) | the same: to say |
| אָמַר II (Hebrew) | to be thick, strong |
| אֵמֶר | a saying |
| אִמַּר | a lamb |
| מְרַר (Aramaic) | to be bitter; to grieve |

**רבי**, seven entries; Sefaria picked רַבִּי:

| entry | Jastrow's definition |
|---|---|
| רַבִּי | Rabbi, title of scholars ← Sefaria's pick |
| רבי (Hebrew) | to be many; to grow |
| רְבֵי (Aramaic) | to grow, become great |
| *רְבֵי | to shoot (a bow) |
| רְבֵי ² | to lie down, die |
| רִבֵּי | plural of "ten thousand" |
| רָבֵי | boy; apprentice |

**ליה**: יָהּ ("Yah"), יָהּ II ("Oh!") and, picked by Sefaria, לְ־ ("to").
The first two come only from the program that takes prefixes off.

## The decisions

### Decision 1. Build on Sefaria's word list at all?

- **1a. Yes, once Sefaria says we may.** It is the only existing data that
  links Talmud spellings to Jastrow. The list states no license; Danyel has
  asked Sefaria.
- **1b. Build our own tagger.** Train a model, for example on Dicta's
  vowelled text (see #382), to pick the entry for each occurrence from its
  context. This is the only way to do much better than the figures below, but
  it is a research project, not a feature.
- **1c. Don't build a dictionary search for the Talmud.** Search keeps finding
  exact spellings, as it does now.

**I recommend 1a.** The rest of this document assumes it.

### Decision 2. Look up only the spelling as written, or also take prefixes off?

Hebrew and Aramaic attach short words to the front of the next word: ו "and",
ד "that/of", ב "in", ל "to", מ "from", ש "that", ה "the", כ "like". The
question is whether, when a spelling is not in the list, we take up to three of
these letters off and look up what is left.

- **2a. Only as written.** Reaches 77.6% of occurrences.
- **2b. Also with prefixes taken off.** Reaches 82.8%.

The extra 5.2 points are about half right. Of the 40 commonest spellings that
are found only this way, about 54% of their occurrences are right: משום as מ +
שום ("because of"), במקום as ב + מקום ("in place of"), לעולם, בתוך. The rest are
wrong: לומר ("to say") as ל + ומר, דברים ("things") as ד + ברים, the name כהנא as
כ + הנא, בנים ("sons") as ב + נים. A wrong match puts an occurrence under a
word it isn't.

The list already holds most prefixed spellings as they appear (דאמר, ליה),
which is why 2a reaches as far as it does.

**I recommend 2a.**

### Decision 3. Drop the entries that only the prefix program found?

The first kind of link above makes the same mistake that Decision 2 avoids. It
gives מאי eight entries spelled אי, and ליה the entry "Yah".

- **3a. Keep every entry the list gives.** Typing מאי then offers nine
  meanings, eight of them wrong.
- **3b. Drop an entry when its only link to the spelling comes from the prefix
  program.** Typing מאי then offers only מַאי. This alone leaves 12.9% of the
  ambiguous occurrences with a single entry.

The risk of 3b is dropping a right entry that only the program found. I have
not measured how often that happens.

**I recommend 3b.**

### Decision 4. Use Sefaria's hand-picked entries?

For 279 spellings, Sefaria chose one entry. Using the pick means every
occurrence of that spelling counts under that entry, and under no other.

- **4a. Use the pick.** It decides רבי, ליה, אלא, מאי, דאמר, נמי, הא, הכי,
  רבא, להו, which are among the commonest words in the Talmud. It leaves
  28.6% of the ambiguous occurrences with a single entry, more than any other
  rule here.
- **4b. Ignore it.** Every entry of רבי stays possible everywhere, so picking
  "to lie down, die" finds every Rabbi in the Talmud.

The pick is the same for every occurrence of the spelling, so it is sometimes
wrong in context. In a random sample of 100 occurrences that rely on it, judged
by me rather than by someone who reads the Talmud, I found:

- one clearly wrong: דמי in שפיר דמי ("it is fine") read as דְּמֵי I "to be
  dumb";
- one probably wrong: אבא in the name אבא שאול;
- three where הא, read as "this", could be the interjection "behold".

That is 1 to 5 wrong in 100. The sample is mostly the commonest words, so the
rarer picks are barely tested.

**I recommend 4a.**

### Decision 5. Use the passages to tell entries apart?

It looks as if the passage lists should say which entry is meant at each
place: a link from אמר to אֲמַר that lists Berakhot 2a:3 seems to say "at 2a:3,
אמר is אֲמַר". It doesn't. The program's links list every place the spelling
appears, and all of a spelling's entries nearly always carry the same list. So
the list names the right passage for 73.2% of occurrences found in the list,
which is the figure behind #382's "62% have a headword citing that very
passage". But it names it for the wrong entries just as often.

Jastrow's own quotations do say which entry is meant at a place, but they name
the passage for only 1.6% of occurrences, and the page for 2.6%.

- **5a. Use what little there is.** Where Jastrow quotes the passage under one
  entry, or where only one entry's list names it, take that entry. Together
  they settle up to 6.5% of the ambiguous occurrences.
- **5b. Ignore the passages.**

**I recommend 5a.** It costs little and is right when it applies.

**Decisions 3, 4 and 5 together** leave 56.1% of occurrences found in the list
with a single entry, against 30.6% with none of them. The other 44% are still
ambiguous, which is what Decision 6 is about.

### Decision 6. What happens to an occurrence that could be several entries?

Take אמר, with six entries and no pick. The reader types אמר and then chooses
"to say".

- **6a. It counts under every entry it could be.** Choosing "to say" finds all
  44,000 occurrences of אמר. Choosing "a lamb" also finds all of them. Nothing
  real is hidden, but choosing a meaning narrows less than it seems to.
- **6b. It counts under none of them.** Choosing a meaning finds only
  occurrences that are certainly that meaning. For אמר, that is none at all,
  which hides the commonest verb in the Talmud.
- **6c. It counts under every entry, but is marked as uncertain**, for
  example drawn fainter. The reader sees what is certain and what is only
  possible. This needs a second look for a match, which the search does not
  have yet, and the rule that each search term gets one colour constrains how
  it could look.

**I recommend 6a for the first version,** and looking at it before deciding on
6c.

### Decision 7. How to show Jastrow's entries in the list of meanings?

Jastrow often has several entries for what a reader thinks of as one word.
רבי has seven, and six of them are other words that never mean "Rabbi" in the
Talmud.

- **7a. Show every entry, as Jastrow has them.** Simple, and honest about the
  data. The list for רבי shows seven lines.
- **7b. Merge entries that are really one word.** This needs a rule for which
  entries belong together, and Jastrow's numbering (I, II, ²) doesn't give one:
  אָמַר I and אֲמַר are one word in two languages; אָמַר II is a different word.
- **7c. Show the picked entry first and the others below it**, where Decision 4
  gives a pick.

**I recommend 7a,** then look at real words in the built search before choosing
7b or 7c.

### Decision 8. What about the 22% the list doesn't reach?

The spellings the list misses are spread thin: 45,636 different spellings,
the commonest 100 make up a quarter of the missed occurrences. Read by hand,
those 100 are:

| what it is | occurrences | examples |
|---|---|---|
| Verb forms the list lacks | about 36,000 | אומר, אמרו, אומרים, תניא, איתמר, היו, עושה |
| A word with a pronoun ending | about 26,000 | לה, בה, עליו, אותו, עצמו, אשתו |
| Plurals and feminines | about 8,000 | חכמים, נשים, טמאה, אסורה, טפחים |
| Names and set phrases | about 5,000 | רחמנא, חנינא, (סלקא) דעתך |
| Section markers | about 5,000 | גמ׳, מתני׳, וגו׳ |

So the gaps are inflected forms of words the list already has, not
abbreviations (2.3% of the gap, because this edition spells them out) or rare
spellings.

- **8a. Leave the gaps.** These words are still found by spelling, as now.
- **8b. Add entries by hand, commonest first.** Each one links a spelling to
  an entry Jastrow already has: אומר → אָמַר I, לה → לְ־, חכמים → חָכָם. 317
  spellings take the search to 85% of occurrences, 1,872 to 90%, 8,773 to 95%.
  This needs someone who reads the Talmud; my readings aren't reliable
  enough.
- **8c. Generate them.** Take common endings (ו, ה, יו, ים, ין, ות) and
  prefixes off a missing spelling and look up the rest. No hand work, but
  Decision 2 shows how often taking letters off goes wrong, and it would
  read תניא ("it was taught") as תנא ("a teacher").

**I recommend 8a for the first version and 8b after it,** in batches, each
measured with the report.

### Decision 9. Use Dicta's vowels to tell entries apart?

Dicta has vowelled the whole Talmud (see #382). Vowels would separate many
entries: אָמַר and אִמַּר look alike only without them. But in Sefaria's list,
only the entries' own spellings carry vowels. The spellings found in the
Talmud, Jastrow's quotations and Sefaria's picks have none. So a vowelled word
from Dicta could only be compared to an entry's dictionary form, which works
for words that aren't inflected and little else.

- **9a. Not now.**
- **9b. Try it on uninflected words.**

**I recommend 9a.** It belongs with the tagger in Decision 1b.

## The plan, if every recommendation is taken

1. When Sefaria answers: a script builds, from the download, one file that
   links each of the text's spellings to entry numbers (36,773 spellings, about
   0.4 MB compressed; the text itself is 4.1 MB compressed), and a list of
   entries.
2. The Talmud gets its own dictionary search through the slot the Tanakh's
   uses (`ExtraMode` in `packages/search/src/extraMode.ts`), with no change to
   the shared search.
3. Look at it with real words, then decide 6c and 7b/7c.
4. Hand entries for the commonest gaps, in batches.

## Other uses of the same data, later

Both wanted, neither started:

- **Jastrow's definition in the word popup** (#659).
- **A Hebrew/Aramaic overlay** (#660). Jastrow marks Aramaic entries "ch."
  and biblical Hebrew ones "b. h.". For 14.7% of occurrences found in the
  list, every entry carries such a note. If an entry with no note is read as
  Hebrew, which is plausible but not checked, 64.9% have entries that agree on
  one language.

## Open questions

- The license. Danyel is asking Sefaria.
- How often Sefaria's picks are wrong in context. A sample drawn by spelling
  rather than by occurrence, judged by a reader of the Talmud, would say.
- How often Decision 3b drops a right entry.
- Whether an entry with no language note in Jastrow is Hebrew.
