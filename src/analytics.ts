// Thin wrapper around GA4 gtag() for type-safe event tracking

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function track(eventName: string, params: Record<string, string | number | boolean>): void {
  window.gtag?.('event', eventName, params);
}

export function trackOverlaySwitch(overlayName: string, previousOverlay: string): void {
  track('overlay_switch', { overlay_name: overlayName, previous_overlay: previousOverlay });
}

export function trackSearchExecute(
  term: string,
  language: 'he' | 'en',
  mode: string,
  resultCount: number,
): void {
  track('search_execute', {
    term: term.slice(0, 40),
    language,
    mode,
    result_count: resultCount,
  });
}

export function trackKeyboardToggle(visible: boolean): void {
  track('keyboard_toggle', { visible });
}

export function trackVerseClick(book: string, chapter: number, verse: number): void {
  track('verse_click', { book, chapter, verse });
}

export function trackZoomLevel(zoom: number): void {
  // Bucket: close (>3), medium (1-3), far (<1)
  const level = zoom > 3 ? 'close' : zoom >= 1 ? 'medium' : 'far';
  track('zoom_level', { level, zoom: Math.round(zoom * 100) / 100 });
}
