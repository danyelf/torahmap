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
 * Lays a still of the picture before a scene over the whole page, to dissolve
 * from; `showOverlays` sets how much of it shows.
 */
export function holdStill(src: string): void {
  let still = document.getElementById('video-still') as HTMLImageElement | null;
  if (!still) {
    still = document.createElement('img');
    still.id = 'video-still';
    Object.assign(still.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '2147483646',
      pointerEvents: 'none',
    });
    document.body.append(still);
  }
  still.src = src;
}

/** The caption, and the still being dissolved from, as they stand this frame. */
export function showOverlays(o: {
  caption: string;
  captionAt: 'top' | 'bottom';
  captionOpacity: number;
  fade: number;
}): void {
  const still = document.getElementById('video-still');
  if (still) still.style.opacity = String(o.fade);

  let band = document.getElementById('video-caption');
  if (!band) {
    band = document.createElement('div');
    band.id = 'video-caption';
    Object.assign(band.style, {
      position: 'fixed',
      left: '0',
      right: '0',
      textAlign: 'center',
      zIndex: '2147483647',
      pointerEvents: 'none',
    });
    const text = document.createElement('span');
    Object.assign(text.style, {
      display: 'inline-block',
      maxWidth: '86%',
      padding: '0.4em 0.8em',
      borderRadius: '0.45em',
      background: 'rgba(0, 0, 0, 0.62)',
      color: '#fff',
      font: '600 4.4vmin/1.25 system-ui, sans-serif',
      letterSpacing: '0.01em',
    });
    band.append(text);
    document.body.append(band);
  }
  band.style.top = o.captionAt === 'top' ? '7vmin' : '';
  band.style.bottom = o.captionAt === 'bottom' ? '7vmin' : '';
  band.style.opacity = String(o.captionOpacity);
  band.firstElementChild!.textContent = o.caption;
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
