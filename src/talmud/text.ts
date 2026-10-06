// The Babylonian Talmud as a text for the app shell.

import type { MapText } from '../app/text.ts';
import type { Story } from '@torahmap/stories';
import { cameraToFit } from '../camera.ts';
import { sefariaUrl } from '../sefaria.ts';
import { computeTalmudLayout, type TalmudLayoutItem } from './layout.ts';
import { createTalmudLabels, updateTalmudLabelPositions } from './talmudLabels.ts';
import { mishnahOrGemaraColor } from './baseColor.ts';
import { talmudSearch, type TalmudSearchSettings } from './search.ts';
import {
  STRUCTURE_FILE,
  amudIndex,
  structureFrom,
  textsFile,
  type TalmudTractateText,
} from './data.ts';

const ref = (s: TalmudLayoutItem): string => `${s.tractate} ${s.daf}${s.amud}:${s.segment}`;

// The Talmud's one story: one stop that shows the whole map.
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

export const talmudText: MapText<TalmudLayoutItem, TalmudSearchSettings> = {
  firstFiles: [STRUCTURE_FILE],

  open(loaded) {
    const structure = structureFrom(loaded);
    const tractates = new Map(structure.tractates.map((t) => [t.name, t]));
    const laid = computeTalmudLayout(structure);

    /** A segment's text in its tractate's file, which holds one list of segments per amud. */
    const segmentText = (s: TalmudLayoutItem, file: TalmudTractateText): string => {
      const firstDaf = tractates.get(s.tractate)?.firstDaf ?? 0;
      return file.amudim[amudIndex(s.daf, s.amud, firstDaf)]?.[s.segment - 1] ?? '';
    };

    return {
      items: laid.items,

      startCamera: (viewport) =>
        cameraToFit(
          { minX: 0, minY: 0, maxX: laid.bounds.width, maxY: laid.bounds.height },
          viewport.width,
          viewport.height,
        ),

      baseColor: (item) => mishnahOrGemaraColor(structure, item),

      labels(container) {
        const labels = createTalmudLabels(
          laid.tractateBlocks,
          laid.sederBlocks,
          laid.perekAnchors,
          laid.dafRows,
          container,
        );
        return (offset, zoom) => updateTalmudLabelPositions(labels, offset, zoom);
      },

      popupFile: (item) => textsFile(item.tractate),

      // Reference, text and link, without the overlay's line or any marks.
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

      search: talmudSearch,

      stories: {
        list: [WHOLE_MAP],
        resolve: (stops, camera) => stops.map((stop) => ({ ...stop, camera: { ...camera } })),
      },

      // The tractate stands in for the book.
      track: {
        verse: (s) => ({ book: s.tractate, chapter: s.daf, verse: s.segment }),
        area: (s) => ({ area: s.tractate, section: tractates.get(s.tractate)?.seder ?? '' }),
      },
    };
  },
};
