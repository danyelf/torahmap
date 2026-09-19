// The reader's choice to hide the Hebrew in the verse popup and the map labels.
// Search still takes Hebrew; only what is displayed changes.

const STORAGE_KEY = 'torahmap-english-only';
const CLASS = 'english-only';

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function save(englishOnly: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, englishOnly ? '1' : '0');
  } catch {
    // Private windows can refuse storage; the choice then lasts the visit.
  }
}

export function initHebrewToggle(footer: HTMLElement): void {
  const button = document.createElement('button');
  button.id = 'hebrew-toggle';
  button.type = 'button';
  button.className = 'footer-link';

  const apply = (englishOnly: boolean): void => {
    document.body.classList.toggle(CLASS, englishOnly);
    button.textContent = englishOnly ? 'Show Hebrew' : 'Hide Hebrew';
  };

  apply(load());
  button.addEventListener('click', () => {
    const englishOnly = !document.body.classList.contains(CLASS);
    apply(englishOnly);
    save(englishOnly);
  });
  footer.appendChild(button);
}
