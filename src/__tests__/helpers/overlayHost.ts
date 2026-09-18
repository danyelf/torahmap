// Playing the app's part for one overlay: holding its settings in the same
// store main.ts uses, handing them to every member that takes them, and
// drawing the controls again after each change, into the container they were
// last drawn in.
import type { Overlay } from '../../overlays/types';
import type { TanakhIdentity, TextLanguage } from '../../types';
import { createOverlaySettings, settingsFromParams } from '../../overlays/settings';
import { validateOverlayParams } from '../../urlState';

type RawParams = URLSearchParams | Readonly<Record<string, string | undefined>>;

export interface OverlayHost<S> {
  readonly overlay: Overlay<TanakhIdentity, S>;
  /** The settings the app holds for this overlay. */
  readonly settings: S;
  /** Draw the controls from scratch, into `container` or a new element, as switching to the overlay does. */
  renderControls(container?: HTMLElement): HTMLElement;
  /** Replace the settings with a link's, as restoring a link does, and redraw the controls. */
  restore(raw: RawParams): void;
  /** The settings a link describes, without holding them. */
  fromUrl(raw: RawParams): S;
  /** Take new settings, as the controls' onChange does. */
  change(next: S): void;
  /** Called after every change the controls or `change` make. Restoring is not a change. */
  onChange(listener: () => void): void;
  toUrl(): Record<string, string>;
  getVerseColor(verse: TanakhIdentity): ReturnType<Overlay['getVerseColor']>;
  getHoverInfo(verse: TanakhIdentity): string | null;
  highlightVerseText(text: string, language: TextLanguage): DocumentFragment;
  renderLegend(container: HTMLElement): void;
  destroy(): void;
}

export function hostOverlay<S>(overlay: Overlay<TanakhIdentity, S>): OverlayHost<S> {
  const store = createOverlaySettings();
  let container: HTMLElement | null = null;
  const listeners: (() => void)[] = [];

  function draw(): void {
    if (!container) return;
    overlay.renderControls?.(container, store.get(overlay), host.change);
  }

  const host: OverlayHost<S> = {
    overlay,
    get settings() {
      return store.get(overlay);
    },
    renderControls(into = document.createElement('div')) {
      container = into;
      container.innerHTML = '';
      draw();
      return into;
    },
    restore(raw) {
      store.restore(overlay, raw);
      if (container) host.renderControls(container);
    },
    fromUrl(raw) {
      return settingsFromParams(overlay, validateOverlayParams(overlay.urlParams, raw)) as S;
    },
    change(next) {
      store.set(overlay, next);
      draw();
      listeners.forEach((listener) => listener());
    },
    onChange(listener) {
      listeners.push(listener);
    },
    toUrl() {
      return store.toUrl(overlay);
    },
    getVerseColor(verse) {
      return overlay.getVerseColor(verse, store.get(overlay));
    },
    getHoverInfo(verse) {
      return overlay.getHoverInfo?.(verse, store.get(overlay)) ?? null;
    },
    highlightVerseText(text, language) {
      if (!overlay.highlightVerseText) throw new Error(`${overlay.id} does not mark verse text`);
      return overlay.highlightVerseText(text, language, store.get(overlay));
    },
    renderLegend(into) {
      overlay.renderLegend?.(into, store.get(overlay));
    },
    destroy() {
      overlay.destroy?.();
      container = null;
    },
  };
  return host;
}
