// Entry point for the Talmud Map (talmud.html).
//
// Parallel to src/main.ts but for the Talmud corpus. Shares the spatial
// rendering modules (camera, geometry, rendering, hitDetection) via their
// generic <T> signatures.

declare const __GIT_BRANCH__: string;

import type { SpatialItem, TalmudIdentity } from "./types.ts";
import { loadTalmudStructure, isSegmentMishnah } from "./talmud/data.ts";
import { computeTalmudLayout, type TalmudLayoutItem } from "./talmud/layout.ts";
import {
  createRenderContext,
  createRenderState,
  rebuildGeometry,
  render as renderFrame,
} from "./rendering.ts";
import { computeItemStates, applyItemColors } from "./itemColoring.ts";
import { findItemAtPoint } from "./hitDetection.ts";
import { createCamera, clampZoom, panForZoom } from "./camera.ts";
import { createMouseState, startDrag, stopDrag } from "./mouseState.ts";
import type { Overlay } from "./overlays/types.ts";
import { segmentLengthOverlay, ingestTractateLengths } from "./talmud/overlays/segment-length.ts";
import {
  startBackgroundPrefetch,
  promoteTractateToFront,
} from "./talmud/prefetch.ts";
import { createTalmudLabels, updateTalmudLabelPositions, type DafRowAnchor } from "./talmud/talmudLabels.ts";
import { getTalmudSidebarElements, updateTalmudSidebar } from "./talmud/sidebar.ts";
import { parseTalmudUrlState, updateTalmudUrl } from "./talmud/urlState.ts";
import {
  MISHNAH_BASE_COLOR,
  GEMARA_BASE_COLOR,
  BRIGHTNESS_JITTER,
} from "./talmud/constants.ts";
import { seededRandom } from "./utils/random.ts";
import { ZOOM_OUT_FACTOR, ZOOM_IN_FACTOR, URL_UPDATE_DEBOUNCE_MS } from "./constants/app.ts";

// Debounce helper (local, to avoid importing the Tanakh urlState one)
function debounce<F extends (...args: unknown[]) => void>(fn: F, ms: number): F {
  let t: number | null = null;
  return ((...args: unknown[]) => {
    if (t !== null) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  }) as F;
}

function talmudSegmentsEqual(
  a: TalmudIdentity | null,
  b: TalmudIdentity | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.tractate === b.tractate &&
    a.daf === b.daf &&
    a.amud === b.amud &&
    a.segment === b.segment
  );
}

async function main(): Promise<void> {
  document.title = `Bavli Map [${__GIT_BRANCH__}]`;

  // --- Load data and compute layout ---
  const structure = await loadTalmudStructure();
  const { items, tractateBlocks, sederBlocks, perekAnchors, bounds } = computeTalmudLayout(structure);
  console.log(
    `Loaded ${structure.tractates.length} tractates, ${items.length} segments, bounds: ${bounds.width}x${bounds.height}`,
  );

  // --- Canvas setup (mirrors main.ts) ---
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  if (!canvas) throw new Error("Canvas not found");
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas(): void {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }
  resizeCanvas();

  // --- WebGL ---
  const renderContext = createRenderContext(canvas);
  const renderState = createRenderState(renderContext.gl, items, dpr);

  // --- Camera ---
  // Start zoomed out to fit the whole bookshelf with a small margin.
  // The Bavli total bounds are wide (4 tall shelves of tractates) so the
  // default 1.0 zoom from createCamera is almost always too zoomed in.
  const camera = createCamera(window.innerWidth, window.innerHeight, bounds);
  const fitZoomX = (window.innerWidth - 80) / bounds.width;
  const fitZoomY = (window.innerHeight - 80) / bounds.height;
  const fitZoom = Math.min(fitZoomX, fitZoomY, 1.0);
  if (fitZoom < 1.0 && fitZoom > 0) {
    camera.zoom = fitZoom;
    // Center the bounds in the viewport
    camera.x = (window.innerWidth / fitZoom - bounds.width) / 2;
    camera.y = (window.innerHeight / fitZoom - bounds.height) / 2;
  }

  // --- State ---
  const mouseState = createMouseState();
  let lastMouseX = 0;
  let lastMouseY = 0;
  let hoveredItem: TalmudLayoutItem | null = null;
  let pinnedItem: TalmudLayoutItem | null = null;
  let currentOverlay: Overlay<TalmudIdentity> | null = null;

  // --- Registry ---
  const overlaysById = new Map<string, Overlay<TalmudIdentity>>();
  overlaysById.set(segmentLengthOverlay.id, segmentLengthOverlay);

  // --- Structural base colors: always-on M/G paint ---
  // The overlay system returns null for segments where it has no data;
  // for those, we paint the structural M/G color. We also fold in a
  // deterministic per-segment brightness jitter so squares read as
  // living rainfall instead of flat tiles (matches Torah behavior, where
  // getDefaultColor adds the same kind of variation).
  function segmentJitter(id: TalmudIdentity): number {
    // Hash (tractate, daf, amud, segment) into a stable integer seed.
    let h = 0;
    for (let i = 0; i < id.tractate.length; i++) {
      h = (h * 31 + id.tractate.charCodeAt(i)) | 0;
    }
    h = (h * 31 + id.daf) | 0;
    h = (h * 31 + (id.amud === "b" ? 1 : 0)) | 0;
    h = (h * 31 + id.segment) | 0;
    // seededRandom returns [0,1); recenter to [-1,1] then scale.
    return (seededRandom(h) - 0.5) * 2 * BRIGHTNESS_JITTER;
  }
  function jitteredColor(
    base: readonly [number, number, number],
    id: TalmudIdentity,
  ): [number, number, number] {
    const j = segmentJitter(id);
    // Multiplicative jitter preserves hue; clamp to [0,1].
    const f = 1 + j;
    return [
      Math.max(0, Math.min(1, base[0] * f)),
      Math.max(0, Math.min(1, base[1] * f)),
      Math.max(0, Math.min(1, base[2] * f)),
    ];
  }
  const mgBaseOverlay: Overlay<TalmudIdentity> = {
    id: "_mg-base",
    name: "__internal",
    getVerseColor(id: TalmudIdentity) {
      const mishnah = isSegmentMishnah(
        structure,
        id.tractate,
        id.daf,
        id.amud,
        id.segment,
      );
      return jitteredColor(
        mishnah ? MISHNAH_BASE_COLOR : GEMARA_BASE_COLOR,
        id,
      );
    },
  };

  // Compose base + user overlay: user overlay takes precedence when it has data.
  function composedOverlay(): Overlay<TalmudIdentity> {
    return {
      id: "composed",
      name: "composed",
      getVerseColor(id: TalmudIdentity) {
        if (currentOverlay) {
          const c = currentOverlay.getVerseColor(id);
          if (c !== null) return c;
        }
        return mgBaseOverlay.getVerseColor(id);
      },
    };
  }

  function applyOverlay(): void {
    const states = computeItemStates<TalmudIdentity>(
      items,
      composedOverlay(),
      hoveredItem,
      pinnedItem,
      talmudSegmentsEqual,
    );
    const colors = applyItemColors(states);
    rebuildGeometry(renderContext.gl, renderState, colors);
  }

  function doRender(): void {
    renderFrame<TalmudIdentity>(
      renderContext,
      renderState,
      camera,
      hoveredItem,
      pinnedItem,
      talmudSegmentsEqual,
    );
  }

  // --- Labels (tractate + daf) ---
  // Build daf-row anchors from the layout items.
  const rowAnchors = new Map<string, DafRowAnchor>();
  for (const item of items) {
    const key = `${item.tractate}:${item.daf}${item.amud}`;
    if (!rowAnchors.has(key)) {
      rowAnchors.set(key, {
        tractate: item.tractate,
        daf: item.daf,
        amud: item.amud,
        rightX: item.x + item.size,
        topY: item.y,
      });
    } else {
      const row = rowAnchors.get(key)!;
      if (item.x + item.size > row.rightX) row.rightX = item.x + item.size;
    }
  }
  const labels = createTalmudLabels(
    tractateBlocks,
    sederBlocks,
    perekAnchors,
    Array.from(rowAnchors.values()),
    document.body,
  );
  updateTalmudLabelPositions(labels, { x: camera.x, y: camera.y }, camera.zoom);

  // --- Initial paint ---
  applyOverlay();
  doRender();

  // --- Kick off background prefetch ---
  // Ingest order = completion order (the prefetch queue may be reordered
  // by `promoteTractateToFront` when the user clicks an unloaded tractate;
  // we want the segment-length overlay to see those lengths first too).
  const tractateNames = structure.tractates.map((t) => t.name);
  startBackgroundPrefetch(tractateNames, {
    onLoaded: (_name, text) => ingestTractateLengths(structure, text),
  });

  // --- Sidebar elements ---
  const sidebarElements = getTalmudSidebarElements();
  const sidebarClose = sidebarElements.sidebar.querySelector(".close-btn") as HTMLElement | null;
  sidebarClose?.addEventListener("click", () => {
    pinnedItem = null;
    updateTalmudSidebar(null, structure, sidebarElements);
    applyOverlay();
    doRender();
    saveUrlStateDebounced();
  });

  function saveUrlState(): void {
    updateTalmudUrl({
      segment: pinnedItem
        ? {
            tractate: pinnedItem.tractate,
            daf: pinnedItem.daf,
            amud: pinnedItem.amud,
            segment: pinnedItem.segment,
          }
        : null,
      overlay: currentOverlay?.id ?? null,
    });
  }
  const saveUrlStateDebounced = debounce(saveUrlState, URL_UPDATE_DEBOUNCE_MS);

  // --- Wheel zoom ---
  canvas.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
      const newZoom = clampZoom(camera.zoom * zoomFactor);
      const newPan = panForZoom(
        { x: camera.x, y: camera.y },
        camera.zoom,
        newZoom,
        e.clientX,
        e.clientY,
      );
      camera.x = newPan.x;
      camera.y = newPan.y;
      camera.zoom = newZoom;
      doRender();
      updateTalmudLabelPositions(labels, { x: camera.x, y: camera.y }, camera.zoom);
    },
    { passive: false },
  );

  // --- Mouse move: hover + drag-pan ---
  canvas.addEventListener("mousemove", (e: MouseEvent) => {
    if (mouseState.isDragging) {
      camera.x += (e.clientX - lastMouseX) / camera.zoom;
      camera.y += (e.clientY - lastMouseY) / camera.zoom;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      doRender();
      updateTalmudLabelPositions(labels, { x: camera.x, y: camera.y }, camera.zoom);
      return;
    }
    // Hover detection
    const hit = findItemAtPoint<TalmudIdentity>(
      items as SpatialItem<TalmudIdentity>[],
      camera,
      e.clientX,
      e.clientY,
    );
    if (hit !== hoveredItem) {
      hoveredItem = hit as TalmudLayoutItem | null;
      applyOverlay();
      doRender();
    }
  });

  canvas.addEventListener("mousedown", (e: MouseEvent) => {
    startDrag(mouseState, e.clientX, e.clientY);
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener("mouseup", (e: MouseEvent) => {
    const wasDragging = mouseState.isDragging;
    const startX = mouseState.dragStart.x;
    const startY = mouseState.dragStart.y;
    stopDrag(mouseState);
    if (wasDragging) {
      const moved = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
      if (moved > 3) return; // treated as drag, not click
    }
    // Click handling
    const hit = findItemAtPoint<TalmudIdentity>(
      items as SpatialItem<TalmudIdentity>[],
      camera,
      e.clientX,
      e.clientY,
    );
    if (hit) {
      if (pinnedItem && talmudSegmentsEqual(pinnedItem, hit)) {
        // Clicking pinned = unpin
        pinnedItem = null;
        updateTalmudSidebar(null, structure, sidebarElements);
      } else {
        pinnedItem = hit as TalmudLayoutItem;
        promoteTractateToFront(pinnedItem.tractate);
        updateTalmudSidebar(pinnedItem, structure, sidebarElements);
      }
      applyOverlay();
      doRender();
      saveUrlState();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    stopDrag(mouseState);
    if (hoveredItem !== null) {
      hoveredItem = null;
      applyOverlay();
      doRender();
    }
  });

  // --- Overlay picker ---
  const select = document.getElementById("overlay-select") as HTMLSelectElement;
  select?.addEventListener("change", () => {
    const id = select.value;
    currentOverlay = id === "none" ? null : overlaysById.get(id) ?? null;
    applyOverlay();
    doRender();
    saveUrlState();
  });

  // --- Window resize ---
  window.addEventListener("resize", () => {
    resizeCanvas();
    doRender();
    updateTalmudLabelPositions(labels, { x: camera.x, y: camera.y }, camera.zoom);
  });

  // --- URL state: restore pinned segment if present ---
  // NOTE: this runs AFTER all listeners are wired so that a cold load with
  // ?segment=... for an uncached tractate doesn't leave the canvas
  // unresponsive while the network fetch resolves. Fire-and-forget so main()
  // returns promptly and the initial paint isn't blocked.
  const initialUrl = parseTalmudUrlState();
  if (initialUrl.overlay) {
    const o = overlaysById.get(initialUrl.overlay);
    if (o) {
      currentOverlay = o;
      const sel = document.getElementById("overlay-select") as HTMLSelectElement;
      if (sel) sel.value = initialUrl.overlay;
    }
  }
  if (initialUrl.segment) {
    const match = items.find(
      (i) =>
        i.tractate === initialUrl.segment!.tractate &&
        i.daf === initialUrl.segment!.daf &&
        i.amud === initialUrl.segment!.amud &&
        i.segment === initialUrl.segment!.segment,
    );
    if (match) {
      pinnedItem = match;
      void updateTalmudSidebar(match, structure, sidebarElements).then(() => {
        if (pinnedItem === match) {
          applyOverlay();
          doRender();
        }
      });
    }
  }

  // Expose a debug/test hook so screenshot scripts can drive the camera
  // without having to simulate wheel events over moving content.
  (window as unknown as { talmudMap: unknown }).talmudMap = {
    camera,
    items,
    tractateBlocks,
    setCameraForBounds(minX: number, minY: number, maxX: number, maxY: number, margin = 40): void {
      const w = maxX - minX;
      const h = maxY - minY;
      const z = Math.min(
        (window.innerWidth - margin * 2) / w,
        (window.innerHeight - margin * 2) / h,
      );
      camera.zoom = Math.max(0.1, Math.min(10, z));
      camera.x = (window.innerWidth / camera.zoom - w) / 2 - minX;
      camera.y = (window.innerHeight / camera.zoom - h) / 2 - minY;
      applyOverlay();
      doRender();
      updateTalmudLabelPositions(labels, { x: camera.x, y: camera.y }, camera.zoom);
    },
    pin(id: TalmudIdentity): void {
      const match = items.find(
        (i) =>
          i.tractate === id.tractate &&
          i.daf === id.daf &&
          i.amud === id.amud &&
          i.segment === id.segment,
      );
      if (match) {
        pinnedItem = match as TalmudLayoutItem;
        updateTalmudSidebar(pinnedItem, structure, sidebarElements);
        applyOverlay();
        doRender();
      }
    },
  };

  // Final paint after everything is wired
  applyOverlay();
  doRender();
}

main().catch((err) => {
  console.error("[main-talmud] failed:", err);
});
