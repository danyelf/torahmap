// The IEEE VIS 2026 program as a text for the app shell.

import { cameraToFit, centreForFocus } from '@torahmap/engine';
import { TERM_SEARCH_PARAMS, type LinkKeys } from '@torahmap/link';
import type { TermSettings } from '@torahmap/search';
import type { MapText } from '@torahmap/shell/app/text.ts';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { coverElement, placeCover } from './covers.ts';
import { createMapLabels, SECTION_LABEL_LINE_EM } from '@torahmap/shell/mapLabels.ts';
import type { Story } from '@torahmap/stories';
import { baseColor, isPlaceholder, PLACEHOLDER_RING } from './baseColor.ts';
import { REFERENCES_SECTION, TEXTS_FILE, structureFrom, type PaperTexts } from './data.ts';
import { ieeevisFiles } from './files.ts';
import { pieceStrip } from './pieceStrip.ts';
import { referenceLines } from './references.ts';
import { defaultExcerpt, hitExcerpt } from './excerpts.ts';
import {
  computeLayout,
  creditCorner,
  DAY_LABEL_SIZE,
  programBox,
  TIME_STRIP,
  type PieceItem,
} from './layout.ts';
import { KINDS_ID } from './overlays/kinds.ts';
import { VIS_OVERLAYS, visOverlayParams } from './overlays/index.ts';
import { configureSearch, squareBody, visSearch } from './search.ts';
import { createMapCredit } from './mapCredit.ts';
import { createMapTitle } from './mapTitle.ts';
import { SECTIONS } from './overlays/sections.ts';
import { PALETTE } from '@torahmap/shell/overlays/palette.ts';
import { picksToUrl } from '@torahmap/shell/overlays/picks.ts';
import { colorToCss, type Color } from '@torahmap/utils';
import { WORDS_PER_SQUARE } from './page.ts';
import './ieeevis.css';
import { ieeevisSite } from './site.ts';

const PANEL_TINT = [150, 170, 220] as const;
const PANEL_OPACITY = 0.07;
const PANEL_EDGE_OPACITY = 0.3;
const SESSION_TAB = { fontSize: 12, above: 20, inset: 0, minPx: 3.5, wrap: true };
// A slot's time keeps a size a reader can make out however far the map is zoomed out.
const TIME_LABEL = { fontSize: DAY_LABEL_SIZE.fontSize, minPx: 9, gap: 4 };
// Screen pixels clear above the program as it opens: the legend reaches 58 down on a wide screen.
const LEGEND_CLEARANCE = 70;
const NO_TEXT = 'No text yet.';
const MAP_TITLE = 'IEEE VIS 2026';

const swatch = (color: Color, outlined = false): string =>
  `<span class="story-swatch${outlined ? ' outlined' : ''}" style="background:${colorToCss(color)}"></span>`;
// The story picks and searches these in order, so each takes the palette's colour at its place.
const STORY_KEYWORDS = ['Large Language Models', 'Uncertainty visualization'];
// Mode w: a whole word.
const STORY_SEARCH = [
  { term: 'AI', mode: 'w' },
  { term: 'LLM', mode: 'w' },
  { term: 'parrot', mode: '' },
];
const searched = (term: string): string =>
  `${swatch(PALETTE[STORY_SEARCH.findIndex((t) => t.term === term)])} ${term}`;
const STORY_CITED = ['Danyel Fisher'];

const WHOLE_MAP: Story = {
  id: 'ieeevis',
  data: {
    title: 'Introduction to the IEEE VIS Map',
    description: '',
    draft: false,
    stops: [
      {
        id: 'start',
        text: `The IEEE VIS 2026 program. Each day is a column, and each session is a box. Each square is about ${WORDS_PER_SQUARE} words of a paper, so a taller paper is a longer one.`,
        camera: 'initial',
        overlay: KINDS_ID,
      },
      {
        id: 'paper',
        text: `A paper reads front to back: the ${swatch(SECTIONS.a.color)} abstract and ${swatch(SECTIONS.i.color)} introduction first, the ${swatch(SECTIONS.f.color, true)} references last. Click a square to read an excerpt of its text.\n\nClick the legend box at the top to jump to the overlay. The ☰ menu can bring you back to the tour.`,
        camera: 'initial',
        overlay: 'sections',
        // Playing the Archive: Audiovisual Latent Space Exploration with The Ocular Harpsichord 2.0
        pin: '350.0',
        zoom: 2.66,
      },
      {
        id: 'search',
        text: `Search for a word, name, or string. This search finds the papers that use the term ${searched('LLM')} and those that use the word ${searched('AI')}.`,
        camera: 'initial',
        overlay: null,
        // AgentPulse: Visual Analytics of Communication and Activity in LLM-Based Multi-Agent Systems
        pin: '29.0',
        zoom: 1.15,
        searchParams: {
          search: STORY_SEARCH.map((t) => t.term).join(', '),
          mode: STORY_SEARCH.map((t) => t.mode).join(','),
        },
      },
      {
        id: 'keywords',
        text: `The Keywords overlay shows where topics turn up across the week: ${STORY_KEYWORDS.map((keyword, i) => `${swatch(PALETTE[i])} ${keyword}`).join(' and ')}.`,
        camera: 'initial',
        overlay: 'keywords',
        overlayParams: { keywords: picksToUrl(STORY_KEYWORDS) },
      },
      {
        id: 'citations',
        text: `The Citations overlay shows which papers cite papers by an author, such as ${swatch(PALETTE[0])} ${STORY_CITED[0]}.`,
        camera: 'initial',
        overlay: 'citations',
        overlayParams: { cite: 'people', people: picksToUrl(STORY_CITED) },
      },
      {
        id: 'yours',
        text: 'Search for your own name, or open the menu for more ways to color the map.',
        camera: 'initial',
        overlay: KINDS_ID,
      },
    ],
  },
};

const LINK_KEYS: LinkKeys = {
  square: 'at',
  search: TERM_SEARCH_PARAMS,
  overlayParams: visOverlayParams,
  zoom: { min: 0.08, max: 12, start: 1 },
};

/** What a piece shows when nothing is searched in it: its opening in a reference list, else the keywords' passage. */
const defaultOf = ({ paper, section }: PieceItem, text: string): string =>
  defaultExcerpt(text, section === REFERENCES_SECTION ? [] : (paper.keywords ?? []));

export const ieeevisText: MapText<PieceItem, TermSettings> = {
  site: ieeevisSite,
  link: LINK_KEYS,
  languages: [ENGLISH],
  files: ieeevisFiles,

  open(loaded) {
    const laid = computeLayout(structureFrom(loaded));

    return {
      items: laid.items,

      startCamera(viewport) {
        return cameraToFit(programBox(laid), viewport.width, viewport.height, LINK_KEYS.zoom, {
          top: LEGEND_CLEARANCE,
        });
      },

      baseColor,
      baseRing: (item) => (isPlaceholder(item) ? PLACEHOLDER_RING : null),

      labels(container) {
        const panels = laid.panels.map((box) => {
          const el = coverElement(PANEL_TINT, PANEL_OPACITY, PANEL_EDGE_OPACITY);
          const time = document.createElement('div');
          time.textContent = box.time;
          time.style.cssText =
            'position:absolute;top:0;color:#eee;font:700 1em var(--heading-font);' +
            `white-space:nowrap;line-height:${SECTION_LABEL_LINE_EM}em;` +
            'text-shadow:0 1px 3px rgba(0,0,0,0.8);' +
            'transform-origin:0 0;transform:rotate(-90deg) translateX(-100%);';
          el.append(time);
          return { el, time, box, lengthEm: 0 };
        });
        const panelLayer = document.createElement('div');
        panelLayer.append(...panels.map((p) => p.el));
        container.appendChild(panelLayer);
        // A time measured in the fallback face is the wrong length once the heading font arrives.
        document.fonts.addEventListener('loadingdone', () =>
          panels.forEach((panel) => (panel.lengthEm = 0)),
        );
        const moveTitle = createMapTitle(MAP_TITLE, container);
        const moveCredit = createMapCredit(creditCorner(laid), container);
        const moveLabels = createMapLabels(laid.books, container, {
          sectionNames: Object.fromEntries(
            laid.books.map((b) => [b.section, { he: '', en: b.section }]),
          ),
          sectionSize: DAY_LABEL_SIZE,
          tab: SESSION_TAB,
          direction: 'ltr',
          sectionSide: 'top',
        });
        return (pan, zoom) => {
          panelLayer.style.transform = `translate(${pan.x * zoom}px, ${pan.y * zoom}px)`;
          for (const panel of panels) {
            const { el, time, box } = panel;
            placeCover(el, box, zoom);
            const fontPx = Math.max(TIME_LABEL.minPx, TIME_LABEL.fontSize * zoom);
            const reach = TIME_LABEL.gap * zoom + fontPx * SECTION_LABEL_LINE_EM;
            time.style.left = `${-reach}px`;
            time.style.fontSize = `${fontPx}px`;
            panel.lengthEm ||= time.offsetWidth / fontPx;
            // Wider than its strip it runs into the day beside it; longer than its panel, into the
            // next slot's time.
            const fits =
              reach <= TIME_STRIP * zoom && panel.lengthEm * fontPx <= (box.maxY - box.minY) * zoom;
            time.style.opacity = fits ? '' : '0';
          }
          moveLabels(pan, zoom);
          moveTitle(pan, zoom);
          moveCredit(pan, zoom);
        };
      },

      popupText(item, loadedFiles, overlay, search) {
        const texts = loadedFiles.get(TEXTS_FILE) as PaperTexts | undefined;
        const { title, pieces } = item.paper;
        const text = isPlaceholder(item) ? NO_TEXT : texts?.[item.id];
        const shown = text && item.section === REFERENCES_SECTION ? referenceLines(text) : text;
        // Hits are found in `shown`, which has no authors line; a hit only there gives the default.
        const hits = search?.tool.textMatches?.(
          item,
          shown ?? '',
          ENGLISH,
          search.settings,
          search.data,
        );
        // What the overlay points at, such as a cited reference, is shown whole.
        const marked = overlay?.tool.textMatches?.(
          item,
          shown ?? '',
          ENGLISH,
          overlay.settings,
          overlay.data,
        );
        const excerpt = isPlaceholder(item)
          ? shown
          : (hitExcerpt(shown ?? '', [
              ...(hits ?? []),
              ...(marked ?? []).map((range) => ({ ...range, whole: true })),
            ]) ?? defaultOf(item, shown ?? ''));
        return {
          ref: title,
          refDetail: pieceStrip(pieces, item.piece),
          hebrew: '',
          english: squareBody(item, excerpt),
          link: item.paper.page,
        };
      },

      overlays: VIS_OVERLAYS,

      search: visSearch,

      start(shell) {
        configureSearch(laid.items, shell.pinAndGlide);
      },

      stories: {
        list: [WHOLE_MAP],
        // A stop that pins a piece centres on it; every other stop shows the whole program.
        resolve: (stops, camera, _items, squares, focus, viewport) =>
          stops.map((stop) => {
            const pinned = stop.pin ? squares.find(stop.pin) : undefined;
            const zoom = stop.zoom ?? camera.zoom;
            return {
              ...stop,
              camera: pinned
                ? { ...centreForFocus(pinned, zoom, focus, viewport), zoom }
                : { ...camera },
            };
          }),
      },

      goTo: { examples: [], read: () => null, complete: () => [], languageOf: () => ENGLISH },

      area: (item) => ({ area: item.session, section: item.day }),
    };
  },
};
