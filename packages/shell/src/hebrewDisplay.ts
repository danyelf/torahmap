// The reader's choice to hide the Hebrew in the popup and the map labels.
// Search still takes Hebrew; only what is displayed changes.

const STORAGE_KEY = 'torahMap.englishOnly';
const CLASS = 'english-only';

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function save(englishOnly: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(englishOnly));
  } catch {
    // Private windows can refuse storage; the choice then lasts the visit.
  }
}

/**
 * Applies the reader's stored choice, or English only for a text with no Hebrew, whatever was
 * chosen on another page of the site. Runs at startup, before any panel exists.
 */
export function applyHebrewChoice(hasHebrew: boolean): void {
  document.body.classList.toggle(CLASS, !hasHebrew || load());
}

/** Makes `button` show and flip the choice. The About panel draws it afresh each time it opens. */
export function bindHebrewToggle(button: HTMLButtonElement): void {
  const label = (): void => {
    button.textContent = document.body.classList.contains(CLASS) ? 'Show Hebrew' : 'Hide Hebrew';
  };
  label();
  button.addEventListener('click', () => {
    const englishOnly = !document.body.classList.contains(CLASS);
    document.body.classList.toggle(CLASS, englishOnly);
    save(englishOnly);
    label();
  });
}
