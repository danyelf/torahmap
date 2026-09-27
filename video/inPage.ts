// Functions run inside the app's page. Each is self-contained — no imports, no
// outer variables — because page.evaluate sends a function as its source text.

/**
 * The scroll position at which the story rests on each stop, by stop id: the
 * stop's middle at the middle of the story, as computeStopScrollCenters in
 * src/scrollytelling/controller.ts places it. Null when the stops sit side by
 * side, as on a phone, where the story pages rather than scrolls.
 */
export function restingScrollTops(doc: Document = document): Record<string, number> | null {
  const content = doc.getElementById('story-content');
  const view = doc.defaultView ?? window;
  if (!content || view.getComputedStyle(content).display === 'flex') return null;
  const max = content.scrollHeight - content.clientHeight;
  const tops: Record<string, number> = {};
  for (const el of content.querySelectorAll<HTMLElement>('.story-stop')) {
    const centre = el.offsetTop + el.offsetHeight / 2 - content.clientHeight / 2;
    tops[el.dataset.stopId ?? ''] = Math.max(0, Math.min(max, centre));
  }
  return tops;
}

/**
 * Sets every CSS animation and transition to the fake clock's time. They run
 * on the browser's real clock, and a frame takes a third of a second of real
 * time to capture, so a short transition would otherwise finish between two
 * frames.
 */
export function holdCssAnimations(): void {
  const now = performance.now();
  for (const animation of document.getAnimations()) {
    const held = animation as Animation & { videoStart?: number };
    if (held.videoStart === undefined) {
      held.videoStart = now - Number(animation.currentTime ?? 0);
      animation.pause();
    }
    animation.currentTime = now - held.videoStart;
  }
}
