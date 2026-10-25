# Finding a rabbi on the Talmud map

**Status:** Approved by Danyel, 2026-10-24. Issue #29. Builds on the dating overlay (#25, PR #455).

A Talmud overlay that lights up every passage naming the rabbis you pick, each in his own color,
so that, say, Rabbi Yochanan and Reish Lakish's shared passages stand out.

## Why

Text search can't find a person. Reish Lakish is written ריש לקיש, ר"ש בן לקיש, ר' שמעון בן לקיש
and more, and Sefaria's own English name for him is "Rabbi Shimon b. Lakish". Sefaria's person tags,
which the dating overlay already ships, find him in 1,273 passages whatever the spelling.

## Decided (Danyel)

- **An overlay of its own,** "Rabbis", on the Talmud's overlay menu beside Dating. Not a search
  mode: search stays a search of the text.
- **Two ways in:**
  - in the overlay's side panel, a name box with generous type-ahead, which suggests people as
    you type from every name Sefaria records for them, plus quick picks for the most-named
    rabbis. A full list of all 228 is too long to be useful;
  - the rabbis named under a pinned passage are clickable, and a click opens the Rabbis overlay
    with that rabbi picked.
- **Picking a rabbi lights every passage naming him, just as a search lights its hits.**
- **Several rabbis at once, each his own color.** A passage naming two picked rabbis shows both
  colors, split corner to corner, the way the map already draws a passage matching two search
  terms.
- **Nothing picked, nothing lit:** the plain map, like a search with no terms.
- **Unsure names are shown, faded.** When Sefaria can't tell who a name means, it tags an
  "ambiguous" name listing the candidates. Picking a rabbi lights his certain passages solid and
  the passages where he is one of the candidates faded. Hillel the Elder lights 21 passages solid
  and the 91 tagged "Hillel (ambiguous)", Shabbat 17a:5 among them, faded. Their names show "?" in
  the pinned passage, as in Dating.
- **A name shared by several people asks which.** Typing "Gamliel" offers Rabban Gamliel haZaken,
  Rabban Gamliel of Yavneh and Rabban Gamliel b. Rabbi, each with his generation, and you pick one.
- **Working out who an unsure name means from its context is for later** (#457). Sefaria rarely
  settles these names itself. It tags "Rabbi Elazar" as unsure 1,386 times and as one particular
  Rabbi Elazar only 25 times, so his passages start out mostly faded.
- **Colors come from each rabbi's era:** a Zug a purple, a Tanna an orange, an Amora a blue, so
  the picks reinforce Dating's colors. Two picked rabbis of one era take that era's shades
  furthest apart, dark and light, leaning slightly in hue if that is what keeps them apart, since
  they must still look different. Judge it on screenshots with Rabbi Yochanan and Reish Lakish,
  both 2nd-generation Amoraim, including a passage naming both (two blues split corner to
  corner, the hardest case).

## Claude's calls (check these)

- A square shows at most four colors (the renderer's limit).
- **Unlit passages** look as they do under a search: dimmed base color.
- **The finder:**
  - suggestions show each person's English and Hebrew name, generation and number of passages;
  - the quick picks are the 28 most-named rabbis, cut after Rav Sheshet (618 passages) where the
    counts drop to a long flat tail; they hold 74% of all rabbi tags;
  - a quick pick that is a shared name (Rabbi Elazar, Rabban Shimon b. Gamliel, Rav Kahana) asks
    which person, as typing does;
  - picked rabbis show their color and can be unpicked there.
- **His name is marked inside the pinned passage** in his color, using the name positions the
  dating overlay already ships.
- **Which rabbis:** the people the dating data holds (its `people` also holds the ambiguous names
  themselves, which are not people to pick). An unsure name that Sefaria gives only one candidate
  for counts as that person, certain: Rav Yosef, tagged unsure 1,276 times, is simply Rav Yosef.
- **Left out:** people Sefaria tags with no generation (about 6% of tags), which the dating file
  doesn't hold. They can come later.
- **The link** carries the picked rabbis (`?overlay=rabbis&…`), so a view can be shared.
- **Data:** the dating overlay's file, plus each person's other names for the filter. Whether that
  goes in the same file or a small second one is the builder's call. Nothing new loads until the
  overlay is chosen.

## Settled after review

A reader checked whether this could be built without asking. All answers are Claude's:

- **Other names** come from the Sefaria dump already on disk, the same one the dating overlay's
  generator reads. `topics.titles` lists every title Sefaria records for a person. Rabbi Shimon
  b. Lakish has 19, among them Reish Lakish, Resh Lakish, ריש לקיש and רבי שמעון בן לקיש.
  The dating generator is extended to write them, and regenerating shows the existing data
  unchanged.
- **Base:** main, once PR #455 merges (it is ready). Pieces both overlays need are shared, not
  copied: the data loader, the name positions and the era grouping.
- **A rabbi's id** in the data and in the link is his Sefaria slug (`rabbi-shimon-b-lakish`), not
  his position in a list, which shifts on every regeneration.
- **Several colors in one square** already work for overlays: an overlay's color per square may
  be a list of colors (`ItemColor`), which the renderer splits as it does for search.
- **A passage** is one segment, one square on the map.
- **Clicking a name** in a pinned passage adds that rabbi to the current picks. If he is already
  picked, nothing changes. If another overlay is showing, it switches to Rabbis with him as the
  only pick.

## Not in this work

- Searching for a rabbi from the search panel.
- Ambiguous names, rabbis with no generation, and fixing Sefaria's tagging mistakes (for example,
  Berakhot 5a:2 tags "Levi bar Hama" as Rabbi Levi).
- Telling apart passages where a rabbi speaks from passages that only mention him.

## Left to the builder

- How the list is laid out within the era grouping, and whether long generations collapse.
- The exact link keys.
- How a click on a name in the pinned passage switches overlay (the shell may need a small,
  text-free hook for an overlay to be opened with settings).
- Tests:
  - picking lights exactly the passages tagged with that person;
  - two picks split a shared passage;
  - the filter matches other names;
  - the link round-trips.
