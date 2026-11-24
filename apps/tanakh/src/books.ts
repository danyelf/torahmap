// Book ordering and section classification
// Populated at runtime from tanakh-structure.json via initBookData()

import type { TorahData } from './types.ts';

const sectionMap = new Map<string, 'torah' | 'neviim' | 'ketuvim'>();
let minorProphets = new Set<string>();
let initialized = false;

/**
 * Initialize book metadata from loaded structure data.
 * Must be called after loading TorahData, before any lookups.
 */
export function initBookData(data: TorahData): void {
  sectionMap.clear();
  for (const b of data.books) {
    sectionMap.set(b.name, b.section);
  }
  minorProphets = new Set(data.layout.minorProphetStacks.flat());
  initialized = true;
}

function assertInitialized(): void {
  if (!initialized) {
    throw new Error('initBookData() must be called before using book lookups');
  }
}

export function getBookSection(bookName: string): 'torah' | 'neviim' | 'ketuvim' {
  assertInitialized();
  return sectionMap.get(bookName) ?? 'neviim';
}

export function isMinorProphet(bookName: string): boolean {
  assertInitialized();
  return minorProphets.has(bookName);
}
