// Background Hebrew text, a prototype behind ?bgtext=1. This is the only
// module the app imports; removing the feature means deleting this folder, the
// call in main.ts, and RenderState.transparentBackground.

import './backgroundText.css';
import type { Camera } from '../camera.ts';
import type { RenderState } from '../rendering.ts';
import type { TanakhLayout } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';
import { createBackgroundTextLayer } from './layer.ts';
import { createBackgroundTextPanel, loadSettings } from './panel.ts';

// The map's labels load David Libre bold; the text and the panel's font choice
// need these on top of it.
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=David+Libre:wght@400&family=Noto+Sans+Hebrew:wght@400&family=Frank+Ruhl+Libre&display=swap';

/**
 * Add the background text and its tuning panel when the URL asks for them.
 * Returns what to call after each frame is drawn, or null when off.
 */
export function installBackgroundText(options: {
  verses: TanakhLayout[];
  texts: VerseTexts;
  camera: Camera;
  renderState: RenderState;
  render: () => void;
}): (() => void) | null {
  if (new URLSearchParams(window.location.search).get('bgtext') !== '1') return null;

  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = FONTS_URL;
  document.head.appendChild(fonts);

  const { verses, texts, camera, renderState, render } = options;
  const settings = loadSettings();
  const layer = createBackgroundTextLayer({
    verses,
    texts,
    camera,
    settings,
    container: document.body,
  });
  renderState.transparentBackground = settings.layer === 'behind';
  document.body.appendChild(
    createBackgroundTextPanel(settings, (next) => {
      layer.setSettings(next);
      renderState.transparentBackground = next.layer === 'behind';
      render();
    }),
  );
  return () => layer.update();
}
