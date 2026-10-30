// The IEEE VIS 2026 program as a text for the app shell.

import { cameraToFit } from '@torahmap/engine';
import { TERM_SEARCH_PARAMS, type LinkKeys } from '@torahmap/link';
import type { TermSettings } from '@torahmap/search';
import type { MapText } from '@torahmap/shell/app/text.ts';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { coverElement, placeCover } from './covers.ts';
import {
  createMapLabels,
  SECTION_LABEL_LINE_EM,
  sectionLabelReach,
} from '@torahmap/shell/mapLabels.ts';
import type { Story } from '@torahmap/stories';
import type { ToolOnMap } from '@torahmap/shell/overlays/types.ts';
import type { TextRange } from '@torahmap/utils';
import { baseColor, isPlaceholder, PLACEHOLDER_RING } from './baseColor.ts';
import { TEXTS_FILE, structureFrom, type PaperTexts } from './data.ts';
import { ieeevisFiles } from './files.ts';
import { referenceLines } from './references.ts';
import {
  DEFAULT_METHODS,
  defaultExcerpt,
  hitExcerpt,
  rarityOf,
  type DefaultMethod,
} from './excerpts.ts';
import { computeLayout, PANEL_PAD, TIME_STRIP, type PieceItem } from './layout.ts';
import { KINDS_ID } from './overlays/kinds.ts';
import { VIS_OVERLAYS, visOverlayParams } from './overlays/index.ts';
import { configureSearch, squareBody, visSearch } from './search.ts';
import { IEEEVIS_PAGE } from './page.ts';
import { ieeevisSite } from './site.ts';

const DAY_LABEL_SIZE = { fontSize: 14, gapEm: 0.5 };
const PANEL_TINT = [150, 170, 220] as const;
const PANEL_OPACITY = 0.07;
const PANEL_EDGE_OPACITY = 0.3;
const SESSION_TAB = { fontSize: 12, above: 20, inset: 4, minPx: 3.5, wrap: true };
// A slot's time keeps a size a reader can make out however far the map is zoomed out.
const TIME_LABEL = { fontSize: DAY_LABEL_SIZE.fontSize, minPx: 9, gap: 4 };
const NO_TEXT = 'No text yet.';

const WHOLE_MAP: Story = {
  id: 'ieeevis',
  data: {
    title: 'IEEE VIS 2026',
    description: '',
    draft: false,
    stops: [
      {
        id: 'start',
        text: 'The IEEE VIS 2026 program, one square per quarter page of a paper.',
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


/** The words search marks in `body`. */
function hitRanges(
  item: PieceItem,
  body: string,
  { tool, settings, data }: ToolOnMap<PieceItem>,
): TextRange[] {
  const marked = tool.highlightItemText?.(item, body, ENGLISH, settings, data);
  const ranges: TextRange[] = [];
  let at = 0;
  for (const node of marked?.childNodes ?? []) {
    const length = node.textContent?.length ?? 0;
    if (node.nodeName === 'MARK') ranges.push({ start: at, end: at + length });
    at += length;
  }
  return ranges;
}

/** Which default excerpt to try, chosen in the address as ?excerpt=first, rare or keywords. */
const chosenMethod = (): DefaultMethod =>
  DEFAULT_METHODS.find((m) => m === new URLSearchParams(location.search).get('excerpt')) ?? 'first';

/** What a piece shows when nothing is searched in it: a paper's first piece begins with its authors. */
function defaultBody(item: PieceItem, text = '', texts?: PaperTexts): string {
  const { paper, piece, section } = item;
  const method = section === 'f' || !texts ? 'first' : chosenMethod();
  const excerpt = defaultExcerpt(text, {
    method,
    rarity: texts ? rarityOf(texts) : () => 0,
    keywords: paper.keywords ?? [],
  });
  return squareBody({ paper, piece }, excerpt);
}

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
        const box = {
          minX: -PANEL_PAD - TIME_STRIP,
          minY: -sectionLabelReach(DAY_LABEL_SIZE),
          maxX: laid.bounds.width + PANEL_PAD,
          maxY: laid.bounds.height + PANEL_PAD,
        };
        return cameraToFit(box, viewport.width, viewport.height, LINK_KEYS.zoom);
      },

      baseColor,
      baseRing: (item) => (isPlaceholder(item) ? PLACEHOLDER_RING : null),

      labels(container) {
        const panels = laid.panels.map((box) => {
          const el = coverElement(PANEL_TINT, PANEL_OPACITY, PANEL_EDGE_OPACITY);
          const time = document.createElement('div');
          time.textContent = box.time;
          time.style.cssText =
            'position:absolute;top:0;color:#eee;font:700 1em system-ui,sans-serif;' +
            `white-space:nowrap;line-height:${SECTION_LABEL_LINE_EM}em;` +
            'text-shadow:0 1px 3px rgba(0,0,0,0.8);' +
            'transform-origin:0 0;transform:rotate(-90deg) translateX(-100%);';
          el.append(time);
          return { el, time, box, lengthEm: 0 };
        });
        const panelLayer = document.createElement('div');
        panelLayer.append(...panels.map((p) => p.el));
        container.appendChild(panelLayer);
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
        };
      },

      popupText(item, loadedFiles, _overlay, search) {
        const texts = loadedFiles.get(TEXTS_FILE) as PaperTexts | undefined;
        const { title, pieces } = item.paper;
        const text = isPlaceholder(item) ? NO_TEXT : texts?.[item.id];
        const shown = text && item.section === 'f' ? referenceLines(text) : text;
        const body = squareBody(item, shown);
        // A paper's first piece always keeps its authors, which come before the text in `body`.
        const authorsLength = body.length - (shown?.length ?? 0);
        const hits = (search ? hitRanges(item, body, search) : [])
          .filter((h) => h.start >= authorsLength)
          .map((h) => ({ start: h.start - authorsLength, end: h.end - authorsLength }));
        const hit = shown && !isPlaceholder(item) ? hitExcerpt(shown, hits) : null;
        const excerpt = isPlaceholder(item)
          ? body
          : hit !== null
            ? squareBody(item, hit)
            : defaultBody(item, shown, texts);
        return {
          ref: `${title}, piece\u00a0${item.piece + 1}\u00a0of\u00a0${pieces.length}`,
          hebrew: '',
          english: excerpt,
          link: IEEEVIS_PAGE.textUrl,
        };
      },

      overlays: VIS_OVERLAYS,

      search: visSearch,

      start(shell) {
        configureSearch(laid.items, shell.pinAndGlide);
      },

      stories: {
        list: [WHOLE_MAP],
        resolve: (stops, camera) => stops.map((stop) => ({ ...stop, camera: { ...camera } })),
      },

      goTo: { examples: [], read: () => null, complete: () => [], languageOf: () => ENGLISH },

      area: (item) => ({ area: item.session, section: item.day }),
    };
  },
};
