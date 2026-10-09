// The Babylonian Talmud as a text for the app shell.

import type { MapText } from '../app/text.ts';
import type { Story } from '@torahmap/stories';
import { cameraToFit } from '../camera.ts';
import { sefariaUrl } from '../sefaria.ts';
import { computeTalmudLayout, talmudRef, type TalmudLayoutItem } from './layout.ts';
import { talmudSite } from './site.ts';
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

export const talmudText: MapText<TalmudLayoutItem, TalmudSearchSettings> = {
  site: talmudSite,
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

      popupText(item, loaded) {
        const file = loaded.get(textsFile(item.tractate)) as TalmudTractateText | undefined;
        return {
          ref: talmudRef(item),
          hebrew: file ? segmentText(item, file) : '',
          english: '',
          link: sefariaUrl(item.tractate, [`${item.daf}${item.amud}`, item.segment]),
        };
      },

      overlays: [],

      search: talmudSearch,

      stories: {
        list: [WHOLE_MAP],
        resolve: (stops, camera) => stops.map((stop) => ({ ...stop, camera: { ...camera } })),
      },

      area: (s) => ({ area: s.tractate, section: tractates.get(s.tractate)?.seder ?? '' }),
    };
  },
};
