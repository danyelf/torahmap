# EU AI Act Map

**Date:** 2026-10-13
**Status:** Exploration. Layout decided 2026-10-13; nothing built in the app.
Data and scripts: `experiments/eu-ai-act/`.

Can the Torah Map's model — every unit of a text in a fixed place, with
overlays on top — show a very different text? We tried it on the EU AI Act:
Regulation (EU) 2024/1689, as amended by Regulation (EU) 2026/1744.

## The text

The Act comes in three parts, in this order:

- **Recitals** — 180 numbered paragraphs explaining why each rule exists.
  Courts read them to interpret the articles, but they bind no one. They talk
  about the Act's ideas and almost never cite its articles by number: of 30
  that name an "Article", most mean the EU treaties or the GDPR.
- **Articles** — the rules: 13 chapters, some split into sections, then 119
  articles, numbered paragraphs, and lettered points.
- **Annexes** — 14 lists and procedures the articles reach into. Every annex is
  cited by at least one article; none cites back.

The consolidated text, where the amendment is folded in, leaves out the
recitals by convention, so they come from the 2024 Official Journal text. The
2026 amendment has recitals of its own, which explain the articles it inserted
(4a, 60a, 75a–d); we have not fetched them.

At about 1,500 squares, the whole Act is a fifteenth the size of the Tanakh.

## Decisions

**A square is the smallest piece**: a paragraph with no points, the lead-in
sentence of a list, or one point. That is 1,075 squares in the articles and
264 in the annexes. A paragraph groups its squares, as an article groups its
paragraphs.

**Inside an article**, plain paragraphs flow along a line and wrap. A paragraph
with a list starts a new line: its lead-in alone, then its points wrapped
densely beneath, indented. Giving each paragraph its own row turned runs of
plain paragraphs into tall poles of single squares (Article 2's paragraphs
2–12, Article 5's 3–8):

![Each paragraph a row: plain paragraphs stack into poles](images/2026-10-13-eu-ai-act-map/1-paragraph-rows.png)

Wrapping them fixes that:

![Plain paragraphs flow; lists wrap beneath their lead-in](images/2026-10-13-eu-ai-act-map/2-wrapped-lists.png)

**Articles stand in chapter columns, eight squares wide**, as the Tanakh's
books stand in columns of chapters. Chapter III, on high-risk systems, holds 44
of the 119 articles, which makes its column about four times the height of
most others:

![One column per chapter](images/2026-10-13-eu-ai-act-map/3-chapter-columns.png)

So **Chapters III and IX split into one column per section**, as Psalms splits
into columns:

![Chapters III and IX split by section](images/2026-10-13-eu-ai-act-map/4-split-chapters.png)

**The three parts are three layers**, recitals over articles over annexes, as
Torah, Prophets and Writings stack. A recital is a 2×1 tile, wider than a
square but no taller: it is a paragraph, and runs to about 154 words against a
square's 34. Annexes are blue, so nothing mistakes them for articles. Here the
articles are coloured by the 2026 amendment: orange inserted, yellow replaced.

![Recitals, articles, annexes](images/2026-10-13-eu-ai-act-map/5-three-layers.png)

**Rejected:** a floor plan shaped like the Act's pyramid of risk tiers. Only
four of the thirteen chapters are tiers, and by length the pyramid is the
wrong shape — the banned tier is one article, high-risk is 44, the bottom tier
is empty. Also tried and dropped: chapters flowing onto shelves, with sections
as rows; Chapter III ran too wide.

**Deferred:** marking that a split chapter's columns belong together; a mapping
from recitals to the articles they explain; placing each annex beside the
article that cites it most.

## What points here

The articles make 845 references to the Act's own articles and annexes, found
and resolved by `refs.py`: 351 to a paragraph, 32 to a point, 312 to a whole
article, 148 to an annex. Every one resolves to a unit that exists. A sample
read against the text was right, once references to other laws ("Article 4,
point (1), of Regulation (EU) 2016/679") were told apart.

Article 6, which decides what is high-risk, in dark; green is what it cites,
magenta what cites it:

![What Article 6 cites, and what cites it](images/2026-10-13-eu-ai-act-map/6-article-6-references.png)

## User tasks

Candidates, not yet tested with anyone. The readers we imagine: someone at a
company building or using AI who must comply; a journalist, researcher or
student trying to understand the Act; a policymaker comparing versions.

| Task | What answers it |
|---|---|
| Get the shape of the Act: what it is mostly about, and how big each part is | The map itself |
| Find what a rule depends on, and what depends on it | What points here |
| See what the 2026 amendment changed | Amendment overlay |
| Know what applies today, or on a given date | In-force overlay |
| Find what applies to my role: provider, deployer, importer, distributor | Actor search or overlay |
| See where a defined term ("deployer", "substantial modification") is used | Defined-term search |
| Understand why a rule exists | Recitals linked to articles |
| See where the Commission can still add or change detail | Unfinished-business overlay |
| Find what breaking a rule costs | Penalty overlay |

## Possible overlays

Each colours the squares by one fact about them. "Have" means the data is in
`experiments/eu-ai-act/` now; "from the text" means a script can derive it from
the wording; "research" means a person must decide it.

| Overlay | What it shows | Data |
|---|---|---|
| Amendment | Text inserted or replaced in 2026; later amendments add layers | Have |
| What points here | One unit's references out and in | Have (`refs.json`) |
| In force | What applies on a chosen date. Article 113 sets seven rules; as of 2026-10-13 the core high-risk rules (Chapter III, Sections 1–3) wait until 2 December 2027, or 2 August 2028 for products under Annex I | From the text, by hand |
| Most cited | Each unit's count of incoming references | Have |
| Actor | Whose duty a square sets out. Mentions in the articles: provider 318, market surveillance authority 123, AI Office 122, notified body 110, deployer 106, importer 20, distributor 16 | From the text, roughly; a square can name several actors and bind only one |
| Shall and may | Duty, permission or ban: "shall" appears 904 times, "may" 169, "shall not" 69 | From the text |
| Unfinished business | Where the Commission adopts delegated acts (27 mentions), implementing acts (31) or guidelines (11) to fill in detail later | From the text |
| Penalty | Which duties each fine tier in Article 99 enforces | Research: Article 99 names the duties by article, so it is short |
| Recitals | Recitals per article, and the reverse | Research: no official mapping exists. Wording similarity gives a draft to check |
| Defined terms | Where each of Article 3's 70 terms is used | From the text |

## Search

The Tanakh's search finds a word in every form it takes. Here the jobs are
different: a defined term found as a term, not a word; a role found with the
duties it carries; and what points here. Plain-word search is still useful,
and English needs far less handling than Hebrew.

## The app

`createApp(text)` already takes a text, so the Act would be a third text beside
the Tanakh and the Talmud, not a fork.
