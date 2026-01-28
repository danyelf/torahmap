// Hebrew virtual keyboard using simple-keyboard
import Keyboard from 'simple-keyboard';
import 'simple-keyboard/build/css/index.css';
import './styles/hebrewKeyboard.css';
import { TRANSLITERATION_MAP } from './hebrewTransliteration.ts';

let keyboardInstance: Keyboard | null = null;
let currentInput: HTMLInputElement | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

// Hebrew keyboard layout using phonetic transliteration
// Rows correspond to QWERTY physical layout: qwertyp / asdfghjkl / zxcvbnm
// (u i o skipped - vowels, not in transliteration map)
const hebrewLayout = {
  default: [
    "\u05e7 \u05d5 \u05e2 \u05e8 \u05ea \u05d9 \u05e4 {bksp}",  // q w e r t y p
    "\u05d0 \u05e1 \u05d3 \u05e4 \u05d2 \u05d4 \u05d7 \u05db \u05dc",  // a s d f g h j k l
    "\u05d6 \u05e9 \u05e6 \u05d5 \u05d1 \u05e0 \u05de",  // z x c v b n m
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

      // Sync virtual keyboard
      if (keyboardInstance) {
        keyboardInstance.setInput(newValue);
      }

      // Trigger input event to update search
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
        '{space}': ' '
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

    // Style the keycap labels after keyboard is initialized
    styleKeycapLabels();
  } else {
    // Keyboard exists, just update the input reference
    currentInput = inputElement;
  }

  // Sync keyboard with input value
  keyboardInstance.setInput(inputElement.value);

  // Position keyboard next to the controls panel
  positionKeyboard(inputElement, container);

  // Show keyboard
  container.style.display = 'block';

  // Setup transliteration handler for physical keyboard
  setupTransliterationHandler(inputElement);
}

/**
 * Post-process keyboard buttons to add styled keycap labels
 * Converts "e\nק" text format into styled HTML spans
 */
function styleKeycapLabels(): void {
  if (!keyboardInstance) return;

  // Get all keyboard buttons
  const buttons = document.querySelectorAll<HTMLElement>('.hebrew-keyboard-theme .hg-button');

  buttons.forEach(button => {
    const text = button.textContent;
    if (!text || text.includes('{') || !text.includes('\n')) return;

    const [english, hebrew] = text.split('\n');
    button.innerHTML = `
      <span>
        <span class="keycap-english">${english}</span>
        <span class="keycap-hebrew">${hebrew}</span>
      </span>
    `;
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
    const start = currentInput.selectionStart ?? 0;
    const end = currentInput.selectionEnd ?? 0;
    const currentValue = currentInput.value;

    let newValue: string;
    let newCursorPos: number;

    if (start !== end) {
      // There's a selection - delete the selected text
      newValue = currentValue.slice(0, start) + currentValue.slice(end);
      newCursorPos = start;
    } else if (start > 0) {
      // No selection - delete the character before cursor
      newValue = currentValue.slice(0, start - 1) + currentValue.slice(start);
      newCursorPos = start - 1;
    } else {
      // Cursor is at the beginning - do nothing
      return;
    }

    currentInput.value = newValue;
    keyboardInstance.setInput(newValue);
    currentInput.setSelectionRange(newCursorPos, newCursorPos);
    currentInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

export function closeHebrewKeyboard(): void {
  const container = document.getElementById('hebrew-keyboard-container');
  if (container) {
    container.style.display = 'none';
  }

  // Remove transliteration handler
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
