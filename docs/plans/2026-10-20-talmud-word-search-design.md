# Searching the Talmud by dictionary word

**Status:** Plan. Danyel took decisions 1 to 10 on 2026-11-25; the pilot in decision 10 has run, and decision 11 is open. Issue #382.
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

- **Spelling.** A word's letters, without vowels: אמר, ליה. The Talmud's
  search text has 92,015 different spellings of two letters or more. The text
  the map shows is the same words with Koren's vowels: אֲמַר, לֵיהּ.
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

**Decided: 1a.** The rest of this document assumes it.

### Decision 2. Should our lookup take prefixes off?

This decision and the next are about two different programs. This one is ours:
the lookup that will run when we build the file. The next is Sefaria's, which
made part of the list before we got it.

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

**Decided: 2a.** Our lookup never takes letters off.

### Decision 3. Drop the entries that only Sefaria's prefix program found?

Sefaria made the first kind of link above with a program of its own that does
take prefixes off, so the list arrives with the mistakes Decision 2 keeps out of
our lookup. It gives מאי eight entries spelled אי, and ליה the entry "Yah". We
can't stop that program; we can only throw away what it alone produced.

- **3a. Keep every entry the list gives.** Typing מאי then offers nine
  meanings, eight of them wrong.
- **3b. Drop an entry when its only link to the spelling comes from the prefix
  program.** Typing מאי then offers only מַאי. This alone leaves 12.9% of the
  ambiguous occurrences with a single entry.

The risk of 3b is dropping a right entry that only the program found. I have
not measured how often that happens.

**Decided: 3b.**

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

**Decided: 4a.**

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

**Decided: 5a.** It costs little and is right when it applies.

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

**Decided: 6a for the first version,** and look at it before deciding on 6c.

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

**Decided: 7a,** then look at real words in the built search before choosing
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

**Decided: 8a for the first version and 8b after it,** in batches, each
measured with the report.

### Decision 9. Use the vowels to tell entries apart?

The text the map shows already has vowels, Koren's, word for word the same
text as the search's.

The vowels can choose between a spelling's entries: an occurrence shown as
אִמַּר is "a lamb", and one shown as אֲמַר is "to say". The rule is to take the
entries whose own vowelled spellings (Jastrow's headword, its other headwords,
and the vowelled forms in Sefaria's list) match the occurrence's vowels, first
as shown, then with prefix letters and their vowels taken off (דְּאָמַר as
אָמַר). It only chooses among the entries the spelling already has, so it
cannot add a wrong one the way Decision 2b would.

Of the occurrences with several entries, the vowels match exactly one entry for
41% (30% as shown, 11% with prefixes off), several for 38% and none for 21%. For
25% they settle an occurrence that nothing in Decisions 3 to 5 does. With them,
**73.4% of occurrences found in the list come down to one entry**, against
56.1% without.

What they settle, among the commonest:

| spelling | as shown → entry |
|---|---|
| רבי | רַבִּי "Rabbi", 27,756 times |
| את | אֵת (object marker) 9,939, אַתְּ "you" 342 |
| אחר | אַחֵר "other" 1,162, אַחַר "after" 961 |
| דבר | דָּבָר "thing" 1,954, דְּבַר 355, דֶּבֶר "plague" 17 |
| אם | אִם "if" 4,599, אֵם "mother" 148 |

Where it goes wrong or does nothing:

- **Two entries with the same vowels stay ambiguous.** אָמַר I "to say" and
  אָמַר II "to be strong" are spelled alike, so אמר shown as אָמַר stays two
  entries.
- **An inflected form spelled and vowelled like another word's headword.**
  תְּנַן "we learnt" has the letters and vowels of Jastrow's תְּנַן "to smoke",
  and תֵּימָא "you might say" those of תֵּימָא, a bird. The vowels choose the
  wrong word. Sefaria picked an entry for both, which catches them, but the same
  can happen unseen in spellings with no pick.
- **Spellings with no vowelled form in the list**, such as ליה, נמי, משום: the
  vowels match nothing. Sefaria picked an entry for ליה and נמי.

Where Sefaria also picked an entry, the vowels choose the same one 84% of the
time. In the commonest cases where they differ, each is right in places: the
vowels for כְּרַבִּי "like Rabbi" (the pick is כְּרַב "to plough") and for סָבַר
"to think" (the pick is סְבַר "to show a bright face"), the pick for תנן and
תימא. So the pick stays first, and the vowels decide only what the pick and
Decisions 3 and 5 leave open.

Costs: the search reads a text without vowels, so the file needs a second
table, keyed by the vowelled form: 7,740 forms, about 46 KB compressed, beside
the 0.4 MB of the first.

- **9a. Not now.**
- **9b. Use the map's vowels after Decisions 3 to 5.** As above.

**Decided: 9b,** on 2026-11-25, with Decision 10 asked in the same answer.

### Decision 10. Have a language model choose the entry at each occurrence?

Decisions 3, 5 and 9 are three rules, each over noisy data, and each settles a
slice. A model reading the passage can weigh all of it at once: the vowels, the
words around it, the part of speech, what Sefaria picked. The rules then stop
being rules and become what the model is shown.

**How it would run.** A script sends the model a passage of a few segments,
vowelled as the map shows it, with the segments either side for context. For
each word in it that has more than one entry, it lists the entries from
Sefaria's list with the first words of Jastrow's definition, and marks
Sefaria's pick where there is one. The model answers, for each word, one entry
or "none of these". The answers go in a file keyed by occurrence, not by
spelling, so the same spelling can be different words in different places.

**Size and cost.** These are estimates, not measurements: I have not counted
tokens for vowelled Hebrew.

- About 82,000 segments, sent five at a time: about 16,000 requests.
- About 1 million occurrences have more than one entry. With their candidate
  lists and the context, about 60 to 75 million tokens in and 10 to 15
  million out.
- Claude Haiku 5.5 ($0.10 per million in, $0.50 out): **about $15**, half that
  through the Batch API, which returns within a day. Sonnet 5.5 is twenty
  times the price (about $300), Opus 5.5 forty times (about $600).
- The answers file: perhaps 2 MB compressed, beside the text's 4.1 MB, against
  0.4 MB for a table keyed by spelling. This is a guess.

The money is small. What it would take is mostly the checking:

1. **A test set we already have.** Where Jastrow quotes a passage under one
   entry, it says which entry is meant there (Decision 5): about 23,000
   occurrences. The model's answers can be scored against those, by spelling,
   before anyone reads anything.
2. **A pilot.** 200 segments through Haiku and through Opus, scored against
   Jastrow's quotations and against each other. Where the two models agree is
   no proof (they can share a mistake), but where they disagree shows where
   Haiku is weak.
3. **A reader of the Talmud** judging about 100 occurrences drawn at random.
   Neither the models nor I can stand in for that.

What it does not change:

- **The candidates still come from Sefaria's list,** so the result waits on
  Sefaria's answer like everything else here.
- **It cannot find an entry the list lacks.** For the 22% the list misses
  (Decision 8), the model could choose among entries proposed by taking letters
  off, which is Decision 8c with a reader in place of the rule. That is a
  second step, scored the same way.

**Without the word list.** The model can also work from Jastrow alone. It reads
the passage and names, for each word, its dictionary form with vowels and a
gloss (אוֹמֵר → אָמַר "to say"). A script looks that form up among Jastrow's
headwords, which are in Sefaria's download apart from the word list; where
several headwords share it, the model chooses among them with their
definitions, as above. This differs from the version above in three ways:

- It needs nothing from the word list, so the program-made links (the first
  kind, the ones that are often wrong) never enter. The hand-picked entries
  could still be shown to it as a hint, or left out.
- It reaches the 22% the list misses (Decision 8) in the same run, since the
  model names the dictionary form whether or not the list has the spelling.
- It can fail in a way the list cannot: a dictionary form spelled or vowelled
  differently from Jastrow's headword finds nothing, and a model can name a
  word that is not there. How often is what a pilot measures.

The test set from Jastrow's quotations serves both versions.

Choices:

- **10a. Keep the rules** (Decisions 3 to 5 and 9b) and stop there.
- **10b. Run the pilot first,** then decide on the whole run from its scores.
- **10c. Rules first, model for what they leave open.** The rules settle 73%
  of occurrences cheaply; the model reads only the rest, about 400,000.

**Decided: 10b,** on 2026-11-25, through Claude Code's own Haiku agents, which
suit 200 segments but not 16,000 requests. Both versions ran on the same 200
segments, and the version without the word list was not shown Sefaria's picks.

### What the pilot found

`scripts/talmud/model-pilot.ts` drew 200 segments at random from the 7,402
where Jastrow quotes at least one occurrence that the list gives several
entries for. They hold 6,248 words of two letters or more. Haiku agents
answered them in batches of 20 segments. The version without the list ran in
two rounds: first naming each word's dictionary form, then, where several of
Jastrow's entries share that form, choosing among them.

The test is the 418 occurrences in these segments that Jastrow quotes under one
entry. For 324 of them the list gives several entries, so something has to
choose:

| On the 324 | right | wrong: an entry with the same letters as the right one | wrong: another entry | no entry given |
|---|---|---|---|---|
| Rules (Sefaria's pick, else the vowels) | 42.6% | 6.5% | 2.2% | 48.8% left undecided |
| Model, with the word list | 78.1% | 17.6% | 4.0% | 0.3% |
| Model, without the word list | 71.3% | 16.0% | 10.8% | 1.8% |

What this says:

- **The model decides everything, about as well as the rules decide half.**
  Where the rules decide, they are right 83% of the time; but they leave half
  undecided. The model with the list is right 78% of the time on all of them.
- **The word list adds seven points.** Both versions make the same kind of
  mistake about as often; the version without the list makes nearly three times
  as many of the other kind (below).
- **Most mistakes pick a twin of the right entry,** one spelled with the same
  letters: Jastrow's numbered entries (חָמֵץ I or II, חוּץ I or II), or the
  Hebrew and Aramaic entries of one word (אָמַר I for אֲמַר, לָא I for לֹא).
  Counted as right, that would give 95.7% with the list and 87.3% without. But
  not every pair of twins is one word: שְׁמַע I is "to hear", שְׁמַע II is "the
  Shema". This is Decision 7b's question,
  which entries belong together, met from the other side.
- **Without the list, the model often names a neighbour of Jastrow's entry:**
  the Hebrew word where Jastrow has a separate Aramaic one (הֲלָכָה for
  הִלְכְתָא, אוֹנֶס for אוּנְסָא), or the root where Jastrow has the noun (צָנַן
  for צוֹנָן). Of the forms it named that are no headword at all, the commonest
  are לֵיהּ (40 times; Jastrow files it under לְ־), causative verbs given as
  they stand (הֵבִיא, הוֹדִיעַ; Jastrow files them under the root) and words with
  a prefix left on (מִשּׁוּם).
- **The two versions agree on 70.3%** of the 5,193 words the list has.
- **Without the list, the model reaches words the list lacks.** In these
  segments the list lacks 1,055 of the 6,248 words (16.9%); the version
  without it names an entry for 88% of them. Nothing checks those answers:
  Jastrow quotes under an entry only words the list has.

How far to trust this:

- The test is small, and some words repeat in it: חָמֵץ in Pesachim 28b:3
  counts four times. A few words move these figures by points.
- The segments were picked because Jastrow quotes them, and his quotations lean
  to rarer, harder words. The Talmud as a whole has more easy words.
- The test is sometimes wrong itself: מֶלֶךְ "king" in Megillah 11a:7 is filed
  under the verb מָלַךְ, and הֵם "they" under הוּא. In Berakhot 2a:8, קְרִיאַת שְׁמַע "the
  reading of the Shema", it files שְׁמַע under I, "to hear"; both versions chose
  II.
- Only Haiku ran. Opus, which the plan above meant to run alongside it, did
  not.
- **The cost estimate above is probably low.** The agents used about 1.6
  million tokens for the 3,633 words the version with the list chose among,
  about 430 a word, against the 70 to 90 assumed above. Those counts include
  each agent's own instructions, so they overstate what the API would charge,
  but probably not by five times. On Haiku the whole run would still cost tens
  of dollars, not hundreds; a count through the API's token counter would
  settle it.

### Decision 11. What next?

- **11a. Run the version with the word list over the whole Talmud.** The most
  accurate. Like everything built on the list, it waits on Sefaria's answer.
- **11b. Run the version without the word list.** Seven points less accurate
  on the hard words, but it reaches the 17% the list lacks, and it uses only
  Jastrow, which is out of copyright, so it need not wait on Sefaria's answer
  about the list. (Whether Sefaria's digital copy of Jastrow carries terms of
  its own is not checked.)
- **11c. Settle which twins are one word first** (Decision 7b), then run
  whichever version. Most of the model's mistakes are between twins, so this
  decides how much of what is left matters to a reader.
- **11d. Have a reader of the Talmud judge 100 occurrences first,** as step 3
  above planned, before anything runs at scale. The test here only covers
  words Jastrow quotes.

My recommendation: 11d, then 11b. A reader's judgement is what the test set
cannot give, and 11b both reaches more words and does not wait on Sefaria.

## The plan

1. When Sefaria answers: a script builds, from the download, one file that
   links each of the text's spellings to entry numbers (36,773 spellings, about
   0.4 MB compressed; the text itself is 4.1 MB compressed), and a list of
   entries. With 9b, the file also links vowelled forms to entries.
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
- With 9b, how often the vowels choose wrong.
- Whether an entry with no language note in Jastrow is Hebrew.
