// Playing the app's part for one overlay: holding its settings in the same
// store main.ts uses, handing them and its data to every member, and
// drawing the controls again after each change, into the container they were
// last drawn in.
import type { Overlay, OverlaySummary, SettingsUpdate } from '../../overlays/types';
import type { TanakhIdentity, TanakhLayout, TextLanguage } from '../../types';
import { createOverlaySettings, settingsFromLink, type LinkParams } from '../../overlays/settings';
import type { TanakhOverlay } from '../../overlays/index';

export interface OverlayHost<S, D> {
  readonly overlay: Overlay<TanakhIdentity, S, D>;
  /** The settings the app holds for this overlay. */
  readonly settings: S;
  /** The data the overlay is handed. */
  readonly data: D;
  /** Hand the overlay different data, and redraw the controls with it. */
  setData(next: D): void;
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
  getVerseColor(verse: TanakhLayout): ReturnType<TanakhOverlay['getVerseColor']>;
  /** Returns false when the overlay declares no hoverChangesColors of its own. */
  hoverChangesColors(before: TanakhLayout | null, after: TanakhLayout | null): boolean;
  getHoverInfo(verse: TanakhLayout): string | null;
  highlightVerseText(verse: TanakhLayout, text: string, language: TextLanguage): DocumentFragment;
  renderLegend(container: HTMLElement): void;
  summary(): OverlaySummary;
  renderSidebarInfo(verse: TanakhLayout, isPinned: boolean): HTMLElement | null;
  destroy(): void;
}

export function hostOverlay<S, D>(
  overlay: Overlay<TanakhIdentity, S, D>,
  data: D,
): OverlayHost<S, D> {
  let held = data;
  const store = createOverlaySettings();
  let container: HTMLElement | null = null;
  const listeners: (() => void)[] = [];

  function draw(): void {
    if (!container) return;
    overlay.renderControls?.(container, store.get(overlay), host.change, held);
  }

  const host: OverlayHost<S, D> = {
    overlay,
    get settings() {
      return store.get(overlay);
    },
    get data() {
      return held;
    },
    setData(next) {
      held = next;
      draw();
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
      return settingsFromLink(overlay, raw);
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
      return overlay.getVerseColor(verse, store.get(overlay), held);
    },
    hoverChangesColors(before, after) {
      return overlay.hoverChangesColors?.(before, after, store.get(overlay), held) ?? false;
    },
    getHoverInfo(verse) {
      return overlay.getHoverInfo?.(verse, store.get(overlay), held) ?? null;
    },
    highlightVerseText(verse, text, language) {
      if (!overlay.highlightVerseText) throw new Error(`${overlay.id} does not mark verse text`);
      return overlay.highlightVerseText(verse, text, language, store.get(overlay), held);
    },
    renderLegend(into) {
      overlay.renderLegend?.(into, store.get(overlay), held);
    },
    summary() {
      return overlay.summary?.(store.get(overlay), held) ?? {};
    },
    renderSidebarInfo(verse, isPinned) {
      return overlay.renderSidebarInfo?.(verse, isPinned, store.get(overlay), held) ?? null;
    },
    destroy() {
      overlay.destroy?.();
      container = null;
    },
  };
  return host;
}
