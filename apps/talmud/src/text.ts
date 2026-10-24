// The Babylonian Talmud as a text for the app shell.

import { FIT_MARGIN, MAP_BACKGROUND, cameraToFit } from '@torahmap/engine';
import { sefariaUrl } from '@torahmap/utils';
import type { MapText } from '@torahmap/shell/app/text.ts';
import { EXAMPLES, segmentReader } from './references.ts';
import type { Story } from '@torahmap/stories';
import { TERM_SEARCH_PARAMS, type LinkKeys } from '@torahmap/link';
import type { TermSettings } from '@torahmap/search';
import { commentaryLink } from '@torahmap/overlay-catalog';
import {
  amudName,
  computeTalmudLayout,
  talmudId,
  talmudRef,
  type TalmudLayoutItem,
} from './layout.ts';
import { talmudSite } from './site.ts';
import { talmudFiles } from './files.ts';
import { ENGLISH, HEBREW } from '@torahmap/shell/language.ts';
import { createTalmudLabels } from './talmudLabels.ts';
import { createMapLabels, sectionLabelReach } from '@torahmap/shell/mapLabels.ts';
import {
  HADRAN_RING_COLOR,
  SEARCH_KEEPS_BASE,
  SEDARIM,
  SEDER_LABEL_SIZE,
  TRACTATE_TAB,
} from './constants.ts';
import { mishnahOrGemaraColor } from './baseColor.ts';
import { datingOverlay, type RabbiLink } from './overlays/dating.ts';
import { addPick, RABBIS_ID, RABBIS_URL_PARAMS, rabbisOverlay } from './overlays/rabbis.ts';
import { englishText, searchedStretches } from './english.ts';
import { configureSearch, talmudSearch } from './search.ts';
import {
  amudIndex,
  englishFile,
  hadranLines,
  structureFrom,
  textsFile,
  type Citation,
  type TalmudTractateEnglish,
  type TalmudTractateText,
} from './data.ts';

// Shortcut: the Talmud's one story is a single stop showing the whole map, until
// its first real story is written.
const WHOLE_MAP: Story = {
  id: 'talmud',
  data: {
    title: 'The Talmud',
    description: '',
    draft: false,
    stops: [
      {
        id: 'start',
        text: 'The Babylonian Talmud, one square per segment.',
        camera: 'initial',
        overlay: null,
      },
    ],
  },
};

const TALMUD_LINK_KEYS: LinkKeys = {
  square: 'at',
  search: TERM_SEARCH_PARAMS,
  overlayParams: (id) => (id === RABBIS_ID ? RABBIS_URL_PARAMS : undefined),
  // Low enough for the whole Talmud to fit across a phone.
  zoom: { min: 0.05, max: 10, start: 1 },
};

// The commentary overlay's category for the Talmud, as public/data/overlays/commentary/ names it.
export const TALMUD_CATEGORY = 'Talmud';

const verseLink = (verse: string) => commentaryLink(verse, TALMUD_CATEGORY);

const linkTo = ({ start, end, verse }: Citation) => ({
  start,
  end,
  href: verseLink(verse),
});

export const talmudText: MapText<TalmudLayoutItem, TermSettings> = {
  site: talmudSite,
  link: TALMUD_LINK_KEYS,
  languages: [HEBREW, ENGLISH],
  files: talmudFiles,

  open(loaded) {
    const structure = structureFrom(loaded);
    const tractates = new Map(structure.tractates.map((t) => [t.name, t]));
    const laid = computeTalmudLayout(structure);
    const hadrans = new Set(
      structure.tractates.flatMap((t) =>
        hadranLines(t).map((line) => talmudId({ tractate: t.name, ...line })),
      ),
    );
    const baseColor = (item: TalmudLayoutItem) =>
      hadrans.has(item.id) ? MAP_BACKGROUND : mishnahOrGemaraColor(structure, item);
    const link: RabbiLink = {};
    const rabbis = rabbisOverlay(baseColor, link);
    const sederOf = (s: TalmudLayoutItem) => tractates.get(s.tractate)?.seder ?? '';

    /** Where a segment is in its tractate's files, which list segments by amud. */
    const placeOf = (s: TalmudLayoutItem) => {
      const first = tractates.get(s.tractate)?.amudim[0];
      return { ai: first ? amudIndex(s.daf, s.amud, first) : -1, si: s.segment - 1 };
    };

    return {
      items: laid.items,

      startCamera(viewport) {
        // The seder labels stand to the right of the map.
        const width = laid.bounds.width + sectionLabelReach(SEDER_LABEL_SIZE);
        const box = { minX: 0, minY: 0, maxX: width, maxY: laid.bounds.height };
        const camera = cameraToFit(box, viewport.width, viewport.height, TALMUD_LINK_KEYS.zoom);
        // Where the map is too wide to fit, its right edge stays on screen, as far in as a
        // fitted map's: every shelf starts there.
        const overhang = width / 2 - (viewport.width / 2 - FIT_MARGIN) / camera.zoom;
        return overhang > 0 ? { ...camera, x: camera.x + overhang } : camera;
      },

      baseColor,
      baseRing: (item) => (hadrans.has(item.id) ? HADRAN_RING_COLOR : null),
      searchKeepsBase: SEARCH_KEEPS_BASE,

      labels(container) {
        const moveMarks = createTalmudLabels(
          laid.tractateBlocks,
          laid.perekAnchors,
          laid.dafRows,
          container,
        );
        const moveNames = createMapLabels(laid.tractateBlocks, container, {
          sectionNames: Object.fromEntries(SEDARIM.map((s) => [s.en, s])),
          sectionSize: SEDER_LABEL_SIZE,
          tab: TRACTATE_TAB,
        });
        return (offset, zoom) => {
          moveMarks(offset, zoom);
          moveNames(offset, zoom);
        };
      },

      popupText(item, loaded) {
        const file = loaded.get(textsFile(item.tractate)) as TalmudTractateText | undefined;
        const translation = loaded.get(englishFile(item.tractate)) as
          TalmudTractateEnglish | undefined;
        const { ai, si } = placeOf(item);
        const english = englishText(translation?.[ai]?.[si] ?? '');
        const citations = file?.citations[ai]?.[si] ?? [];
        const cited = file?.englishCitations[ai]?.[si] ?? [];
        return {
          ref: talmudRef(item),
          hebrew: file?.amudim[ai]?.[si] ?? '',
          english: english.text,
          englishStyles: english.styles,
          englishSearched: searchedStretches(english.text, english.styles),
          englishLinks: cited.map(linkTo),
          link: sefariaUrl(item.tractate, [amudName(item), item.segment]),
          hebrewLinks: citations.filter((c) => c.reference === undefined).map(linkTo),
          hebrewReferences: citations.flatMap(({ start, verse, reference }) =>
            reference === undefined
              ? []
              : [{ at: start, href: verseLink(verse), label: reference }],
          ),
        };
      },

      overlays: [datingOverlay(baseColor, link), rabbis],

      search: talmudSearch,

      start(shell) {
        link.open = (id) => shell.openOverlay(rabbis, addPick(id));
        // Most hits are off screen, so a result travels to its segment as well as pinning it.
        configureSearch(laid.items, shell.pinAndGlide);
      },

      stories: {
        list: [WHOLE_MAP],
        resolve: (stops, camera) => stops.map((stop) => ({ ...stop, camera: { ...camera } })),
      },

      goTo: { examples: EXAMPLES, ...segmentReader(structure.tractates) },

      area: (s) => ({ area: s.tractate, section: sederOf(s) }),
    };
  },
};
