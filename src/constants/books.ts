// Book ordering and section classification
// Populated at runtime from tanakh-structure.json via initBookData()

import type { TorahData } from "../types.ts";

let bookOrder: string[] = [];
const sectionMap = new Map<string, "torah" | "neviim" | "ketuvim">();
let initialized = false;

/**
 * Initialize book metadata from loaded structure data.
 * Must be called after loading TorahData, before any lookups.
 */
export function initBookData(data: TorahData): void {
  bookOrder = data.books.map((b) => b.name);
  sectionMap.clear();
  for (const b of data.books) {
    sectionMap.set(b.name, b.section);
  }
  initialized = true;
}

function assertInitialized(): void {
  if (!initialized) {
    throw new Error("initBookData() must be called before using book lookups");
  }
}

export function getBookOrder(): readonly string[] {
  assertInitialized();
  return bookOrder;
}

export function getBookSection(
  bookName: string,
): "torah" | "neviim" | "ketuvim" {
  assertInitialized();
  return sectionMap.get(bookName) ?? "neviim";
}
