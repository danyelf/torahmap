// Hebrew virtual keyboard using simple-keyboard
import Keyboard from 'simple-keyboard';
import 'simple-keyboard/build/css/index.css';
import './styles/hebrewKeyboard.css';
import { TRANSLITERATION_MAP } from './hebrewTransliteration.ts';

let keyboardInstance: Keyboard | null = null;
let currentInput: HTMLInputElement | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

// Hebrew keyboard layout (without punctuation marks)
const hebrewLayout = {
  default: [
    "\u05e7 \u05e8 \u05d0 \u05d8 \u05d5 \u05df \u05dd \u05e4 {bksp}",
    "\u05e9 \u05d3 \u05d2 \u05db \u05e2 \u05d9 \u05d7 \u05dc \u05da \u05e3",
    "\u05d6 \u05e1 \u05d1 \u05d4 \u05e0 \u05de \u05e6",
    "{space}"
  ]
};

/**
 * Setup transliteration keydown handler for physical keyboard input
 * Intercepts mapped keys and inserts Hebrew characters at cursor position
 */
function setupTransliterationHandler(inputElement: HTMLInputElement): void {
  // Remove existing handler if any
  if (keydownHandler) {
    inputElement.removeEventListener('keydown', keydownHandler);
  }

  keydownHandler = (e: KeyboardEvent) => {
    // Only handle printable keys in the transliteration map
    const key = e.key.toLowerCase();

    // Check if this key is in the transliteration map
    if (key.length === 1 && TRANSLITERATION_MAP[key]) {
      // Prevent default behavior (don't insert the English letter)
      e.preventDefault();

      const hebrewChar = TRANSLITERATION_MAP[key];
      const start = inputElement.selectionStart ?? 0;
      const end = inputElement.selectionEnd ?? 0;
      const currentValue = inputElement.value;

      // Insert Hebrew character at cursor position
      const newValue = currentValue.slice(0, start) + hebrewChar + currentValue.slice(end);
      inputElement.value = newValue;

      // Set cursor position after inserted character
      const newCursorPos = start + hebrewChar.length;
      inputElement.setSelectionRange(newCursorPos, newCursorPos);

      // Update virtual keyboard display to match
      if (keyboardInstance) {
        keyboardInstance.setInput(newValue);
      }

      // Trigger input event so search updates
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  inputElement.addEventListener('keydown', keydownHandler);
}

export function createHebrewKeyboard(inputElement: HTMLInputElement): void {
  currentInput = inputElement;

  // Create keyboard container if it doesn't exist
  let container = document.getElementById('hebrew-keyboard-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hebrew-keyboard-container';
    container.className = 'hebrew-keyboard-container';

    // Append to body as a full popup overlay
    document.body.appendChild(container);
  }

  // Create or update keyboard instance
  if (!keyboardInstance) {
    keyboardInstance = new Keyboard(container, {
      layout: hebrewLayout,
      theme: 'hg-theme-default hebrew-keyboard-theme',
      display: {
        '{bksp}': '⌫',
        '{space}': ' ',
        // Display English letters above Hebrew letters (keycap labels)
        '\u05e7': 'e\n\u05e7', // ק (qof)
        '\u05e8': 'r\n\u05e8', // ר (resh)
        '\u05d0': 't\n\u05d0', // א (aleph)
        '\u05d8': 'y\n\u05d8', // ט (tet)
        '\u05d5': 'u\n\u05d5', // ו (vav)
        '\u05df': 'i\n\u05df', // ן (final nun)
        '\u05dd': 'o\n\u05dd', // ם (final mem)
        '\u05e4': 'p\n\u05e4', // פ (pe)
        '\u05e9': 'a\n\u05e9', // ש (shin)
        '\u05d3': 's\n\u05d3', // ד (dalet)
        '\u05d2': 'd\n\u05d2', // ג (gimel)
        '\u05db': 'f\n\u05db', // כ (kaf)
        '\u05e2': 'g\n\u05e2', // ע (ayin)
        '\u05d9': 'h\n\u05d9', // י (yod)
        '\u05d7': 'j\n\u05d7', // ח (chet)
        '\u05dc': 'k\n\u05dc', // ל (lamed)
        '\u05da': 'l\n\u05da', // ך (final kaf)
        '\u05e3': ';\n\u05e3', // ף (final pe)
        '\u05d6': 'z\n\u05d6', // ז (zayin)
        '\u05e1': 'x\n\u05e1', // ס (samech)
        '\u05d1': 'c\n\u05d1', // ב (bet)
        '\u05d4': 'v\n\u05d4', // ה (he)
        '\u05e0': 'b\n\u05e0', // נ (nun)
        '\u05de': 'n\n\u05de', // מ (mem)
        '\u05e6': 'm\n\u05e6'  // צ (tsadi)
      },
      onChange: (input: string) => {
        if (currentInput) {
          currentInput.value = input;
          // Trigger input event so search updates
          currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      onKeyPress: (button: string) => {
        if (button === '{bksp}') {
          handleBackspace();
        }
      }
    });
  } else {
    // Keyboard exists, just update the input reference
    currentInput = inputElement;
  }

  // Setup transliteration handler for physical keyboard
  setupTransliterationHandler(inputElement);

  // Sync keyboard with input value
  keyboardInstance.setInput(inputElement.value);

  // Post-process button labels to add styled markup for English/Hebrew keycaps
  styleKeycapLabels();

  // Position keyboard next to the controls panel
  positionKeyboard(inputElement, container);

  // Show keyboard
  container.style.display = 'block';
}

/**
 * Post-process keyboard buttons to wrap keycap labels in styled spans
 * Converts "e\nק" text into <span class="english">e</span><span class="hebrew">ק</span>
 */
function styleKeycapLabels(): void {
  const buttons = document.querySelectorAll('.hebrew-keyboard-theme .hg-button');
  buttons.forEach((button) => {
    const span = button.querySelector('span');
    if (!span) return;

    const text = span.textContent || '';
    // Check if this is a keycap label with newline (skip special keys)
    if (text.includes('\n') && !text.includes('{')) {
      const [english, hebrew] = text.split('\n');
      // Replace with styled spans
      span.innerHTML = `<span class="keycap-english">${english}</span><span class="keycap-hebrew">${hebrew}</span>`;
    }
  });
}

function positionKeyboard(_inputElement: HTMLInputElement, container: HTMLElement): void {
  // Get the controls panel position
  const controlsPanel = document.getElementById('controls');
  if (!controlsPanel) return;

  const controlsRect = controlsPanel.getBoundingClientRect();

  // Position keyboard to the right of controls panel with some gap
  container.style.left = `${controlsRect.right + 16}px`;
  container.style.top = `${controlsRect.top}px`;
}

function handleBackspace(): void {
  if (currentInput && keyboardInstance) {
    const currentValue = currentInput.value;
    const newValue = currentValue.slice(0, -1);
    currentInput.value = newValue;
    keyboardInstance.setInput(newValue);
    currentInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

export function closeHebrewKeyboard(): void {
  const container = document.getElementById('hebrew-keyboard-container');
  if (container) {
    container.style.display = 'none';
  }

  // Remove transliteration handler when keyboard closes
  if (currentInput && keydownHandler) {
    currentInput.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }

  // Don't null out currentInput - keep the reference for when keyboard reopens
}

export function isKeyboardOpen(): boolean {
  const container = document.getElementById('hebrew-keyboard-container');
  return container ? container.style.display === 'block' : false;
}
