// Sidebar population for the Talmud map.
//
// Shows: reference, M/G tag, Hebrew text (from lazy-loaded tractate file),
// Sefaria deep link. No English, no perek name (see design doc §3.9/Q16).

import type { TalmudIdentity } from "../types.ts";
import { talmudFormat } from "./format.ts";
import { getTractateText, type TalmudStructure, isSegmentMishnah } from "./data.ts";
import { promoteTractateToFront } from "./prefetch.ts";

export interface TalmudSidebarElements {
  sidebar: HTMLElement;
  refText: HTMLElement;
  overlayInfo: HTMLElement;
  hebrewText: HTMLElement;
  sefariaLink: HTMLAnchorElement;
}

export function getTalmudSidebarElements(): TalmudSidebarElements {
  const sidebar = document.getElementById("verse-sidebar")!;
  return {
    sidebar,
    refText: sidebar.querySelector(".ref-text") as HTMLElement,
    overlayInfo: sidebar.querySelector(".overlay-info") as HTMLElement,
    hebrewText: sidebar.querySelector(".verse-hebrew") as HTMLElement,
    sefariaLink: sidebar.querySelector(".sefaria-link") as HTMLAnchorElement,
  };
}

/**
 * Update the sidebar for a Talmud segment. null = hide.
 */
export async function updateTalmudSidebar(
  id: TalmudIdentity | null,
  structure: TalmudStructure,
  elements: TalmudSidebarElements,
): Promise<void> {
  if (!id) {
    elements.sidebar.classList.remove("visible");
    return;
  }

  elements.sidebar.classList.add("visible");

  // Reference
  elements.refText.textContent = talmudFormat.format(id);

  // Mishnah / Gemara tag
  const mishnah = isSegmentMishnah(
    structure,
    id.tractate,
    id.daf,
    id.amud,
    id.segment,
  );
  elements.overlayInfo.textContent = mishnah ? "Mishnah" : "Gemara";
  elements.overlayInfo.className = `overlay-info talmud-tag ${mishnah ? "mishnah" : "gemara"}`;

  // Sefaria link: https://www.sefaria.org/Berakhot.17b.11
  const linkRef = `${id.tractate.replace(/ /g, "_")}.${id.daf}${id.amud}.${id.segment}`;
  elements.sefariaLink.href = `https://www.sefaria.org/${linkRef}`;

  // Hebrew text — lazy load if not available
  elements.hebrewText.textContent = "Loading…";
  promoteTractateToFront(id.tractate);
  try {
    const text = await getTractateText(id.tractate);
    const tractate = structure.tractates.find((t) => t.name === id.tractate);
    if (!tractate) {
      elements.hebrewText.textContent = "";
      return;
    }
    const amudIdx = (id.daf - tractate.firstDaf) * 2 + (id.amud === "b" ? 1 : 0);
    const amud = text.amudim[amudIdx];
    const hebrew = amud?.[id.segment - 1] ?? "";
    elements.hebrewText.textContent = hebrew;
    elements.hebrewText.setAttribute("dir", "rtl");
  } catch (err) {
    console.error("[sidebar] failed to load Hebrew text:", err);
    elements.hebrewText.textContent = "(failed to load)";
  }
}
