// The IEEE VIS 2026 program as a text for the app shell.

import { cameraToFit } from '@torahmap/engine';
import { TERM_SEARCH_PARAMS, type LinkKeys } from '@torahmap/link';
import type { TermSettings } from '@torahmap/search';
import type { MapText } from '@torahmap/shell/app/text.ts';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { coverElement, placeCover } from './covers.ts';
import { createMapLabels, sectionLabelReach } from '@torahmap/shell/mapLabels.ts';
import type { Story } from '@torahmap/stories';
import { baseColor, isPlaceholder, PLACEHOLDER_RING } from './baseColor.ts';
import { TEXTS_FILE, structureFrom, type PaperTexts } from './data.ts';
import { ieeevisFiles } from './files.ts';
import { referenceLines } from './references.ts';
import { computeLayout, type PieceItem } from './layout.ts';
import { VIS_OVERLAYS, visOverlayParams } from './overlays/index.ts';
import { configureSearch, squareBody, visSearch } from './search.ts';
import { ieeevisSite } from './site.ts';

const DAY_LABEL_SIZE = { fontSize: 14, gapEm: 0.5 };
// A time slot's panel reaches this far past its squares; the day label stands beyond it.
const PANEL_PAD = 8;
const PANEL_TINT = [150, 170, 220] as const;
const PANEL_OPACITY = 0.07;
const PANEL_EDGE_OPACITY = 0.3;
const SESSION_TAB = { fontSize: 12, above: 28, inset: 4, minPx: 7, wrap: true };
/** The popup's heading fits one line at this length, beside "(30/57)" and the link out. */
const POPUP_TITLE_LENGTH = 32;

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
        overlay: 'kinds',
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

const short = (name: string, length: number) =>
  name.length > length ? `${name.slice(0, length - 1).trimEnd()}…` : name;

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
        const reach = sectionLabelReach(DAY_LABEL_SIZE) + PANEL_PAD;
        const box = {
          minX: -reach,
          minY: -PANEL_PAD,
          maxX: laid.bounds.width + PANEL_PAD,
          maxY: laid.bounds.height + PANEL_PAD,
        };
        return cameraToFit(box, viewport.width, viewport.height, LINK_KEYS.zoom);
      },

      baseColor,
      baseRing: (item) => (isPlaceholder(item) ? PLACEHOLDER_RING : null),

      labels(container) {
        const panels = laid.panels.map((panel) => ({
          el: coverElement(PANEL_TINT, PANEL_OPACITY, PANEL_EDGE_OPACITY),
          box: {
            minX: panel.minX - PANEL_PAD,
            minY: panel.minY,
            maxX: panel.maxX + PANEL_PAD,
            maxY: panel.maxY + PANEL_PAD,
          },
        }));
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
          sectionSide: 'left',
          sectionClear: PANEL_PAD,
        });
        return (pan, zoom) => {
          panelLayer.style.transform = `translate(${pan.x * zoom}px, ${pan.y * zoom}px)`;
          for (const { el, box } of panels) placeCover(el, box, zoom);
          moveLabels(pan, zoom);
        };
      },

      popupText(item, loadedFiles) {
        const texts = loadedFiles.get(TEXTS_FILE) as PaperTexts | undefined;
        const { title, pieces } = item.paper;
        const text = texts?.[item.id];
        const shown = text && item.section === 'f' ? referenceLines(text) : text;
        return {
          ref: `${short(title, POPUP_TITLE_LENGTH)} (${item.piece + 1}/${pieces.length})`,
          hebrew: '',
          english: squareBody(item, shown),
          link: 'https://ieeevis.org/',
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
