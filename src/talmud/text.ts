// The Babylonian Talmud as a text for the app shell.

import type { MapText } from '../app/text.ts';
import type { Story } from '@torahmap/stories';
import { cameraToFit } from '../camera.ts';
import { sefariaUrl } from '../sefaria.ts';
import { computeTalmudLayout, type TalmudLayoutItem, type TalmudLayoutResult } from './layout.ts';
import {
  createTalmudLabels,
  updateTalmudLabelPositions,
  type DafRowAnchor,
} from './talmudLabels.ts';
import { mishnahOrGemaraColor } from './baseColor.ts';
import type { TalmudStructure, TalmudTractateText } from './data.ts';

const STRUCTURE = 'talmud/structure.json';
const textsFile = (tractate: string): string => `talmud/texts/${tractate}.json`;

// Set by layout(); the labels, base colour, popup and telemetry read them.
let structure: TalmudStructure;
let laid: TalmudLayoutResult;

const ref = (s: TalmudLayoutItem): string => `${s.tractate} ${s.daf}${s.amud}:${s.segment}`;

/** A segment's text in its tractate's file, which holds one list of segments per amud. */
function segmentText(s: TalmudLayoutItem, file: TalmudTractateText): string {
  const tractate = structure.tractates.find((t) => t.name === s.tractate)!;
  const amud = (s.daf - tractate.firstDaf) * 2 + (s.amud === 'b' ? 1 : 0);
  return file.amudim[amud]?.[s.segment - 1] ?? '';
}

// Shortcut: the shell cannot run without a story, so the Talmud has one, with
// one stop that shows the whole map.
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

export const talmudText: MapText<TalmudLayoutItem> = {
  firstFiles: [STRUCTURE],

  layout(loaded) {
    structure = loaded.get(STRUCTURE) as TalmudStructure;
    laid = computeTalmudLayout(structure);
    return { items: laid.items, bounds: laid.bounds };
  },

  startCamera: (viewport, bounds) =>
    cameraToFit(
      { minX: 0, minY: 0, maxX: bounds.width, maxY: bounds.height },
      viewport.width,
      viewport.height,
    ),

  baseColor: (item) => mishnahOrGemaraColor(structure, item),

  labels(items, _loaded, container) {
    // Each amud's row: where its right edge and top are, for its daf label.
    const rows = new Map<string, DafRowAnchor>();
    for (const item of items) {
      const key = `${item.tractate}:${item.daf}${item.amud}`;
      const row = rows.get(key);
      if (!row) {
        rows.set(key, {
          tractate: item.tractate,
          daf: item.daf,
          amud: item.amud,
          rightX: item.x + item.size,
          topY: item.y,
        });
      } else {
        row.rightX = Math.max(row.rightX, item.x + item.size);
        row.topY = Math.min(row.topY, item.y);
      }
    }
    const labels = createTalmudLabels(
      laid.tractateBlocks,
      laid.sederBlocks,
      laid.perekAnchors,
      [...rows.values()],
      container,
    );
    return (offset, zoom) => updateTalmudLabelPositions(labels, offset, zoom);
  },

  popupFile: (item) => textsFile(item.tractate),

  // Shortcut: the Talmud's popup is plain: reference, text and link, without the
  // overlay's line or any marks.
  drawPopup(elements, item, view) {
    const { sidebar, ref: refText, overlayInfo, hebrew, notice, english, link } = elements;
    if (!sidebar) return;
    sidebar.classList.toggle('visible', item !== null);
    sidebar.classList.toggle('pinned', item !== null && view.pinned);
    if (!item) return;
    const file = view.loaded.get(textsFile(item.tractate)) as TalmudTractateText | undefined;
    if (refText) refText.textContent = ref(item);
    overlayInfo?.replaceChildren();
    if (hebrew) hebrew.textContent = file ? segmentText(item, file) : '';
    notice?.replaceChildren(...(view.notice ? [view.notice] : []));
    if (english) english.textContent = '';
    if (link) link.href = sefariaUrl(item.tractate, [`${item.daf}${item.amud}`, item.segment]);
  },

  overlays: [],

  stories: {
    list: [WHOLE_MAP],
    resolve: (stops, camera) => stops.map((stop) => ({ ...stop, camera: { ...camera } })),
  },

  // Shortcut: the verse events name the tractate as the book.
  track: {
    verse: (s) => ({ book: s.tractate, chapter: s.daf, verse: s.segment }),
    area: (s) => ({
      area: s.tractate,
      section: structure.tractates.find((t) => t.name === s.tractate)?.seder ?? '',
    }),
  },
};
