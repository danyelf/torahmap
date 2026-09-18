// Playing the app's part for one overlay: holding its settings in the same
// store main.ts uses, handing them to every member that takes them, and
// drawing the controls again after each change, into the container they were
// last drawn in.
import type { Overlay, SettingsUpdate } from '../../overlays/types';
import type { TanakhIdentity, TextLanguage } from '../../types';
import { createOverlaySettings, settingsFromLink, type LinkParams } from '../../overlays/settings';

export interface OverlayHost<S> {
  readonly overlay: Overlay<TanakhIdentity, S>;
  /** The settings the app holds for this overlay. */
  readonly settings: S;
  /** Draw the controls from scratch, into `container` or a new element, as switching to the overlay does. */
  renderControls(container?: HTMLElement): HTMLElement;
  /** Replace the settings with a link's, as restoring a link does, and redraw the controls. */
  restore(raw: LinkParams): void;
  /** The settings a link describes, without holding them. */
  fromUrl(raw: LinkParams): S;
  /** Apply a change to the settings held, and redraw, as main.ts does for a control's onChange. */
  change(update: SettingsUpdate<S>): void;
  /** Called after every change the controls or `change` make. Restoring is not a change. */
  onChange(listener: () => void): void;
  toUrl(): Record<string, string>;
  getVerseColor(verse: TanakhIdentity): ReturnType<Overlay['getVerseColor']>;
  /** Returns false when the overlay declares no hoverChangesColors of its own. */
  hoverChangesColors(before: TanakhIdentity | null, after: TanakhIdentity | null): boolean;
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
      return settingsFromLink(overlay, raw) as S;
    },
    change(update) {
      store.set(overlay, update(store.get(overlay)));
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
    hoverChangesColors(before, after) {
      return overlay.hoverChangesColors?.(before, after, store.get(overlay)) ?? false;
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
