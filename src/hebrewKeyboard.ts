// Hebrew virtual keyboard using simple-keyboard
import Keyboard from 'simple-keyboard';
import 'simple-keyboard/build/css/index.css';
import './styles/hebrewKeyboard.css';
import { TRANSLITERATION_MAP } from './hebrewTransliteration.ts';

let keyboardInstance: Keyboard | null = null;
let currentInput: HTMLInputElement | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let pasteHandler: ((e: ClipboardEvent) => void) | null = null;

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
 * Listens at document level so typing works even when virtual keyboard has focus
 */
function setupTransliterationHandler(): void {
  // Remove existing handler if any
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
  }

  keydownHandler = (e: KeyboardEvent) => {
    // Only process if keyboard is open and we have a current input
    if (!isKeyboardOpen() || !currentInput) {
      return;
    }

    // Don't intercept keyboard shortcuts (Cmd+V paste, Cmd+C copy, Cmd+A select all, etc.)
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    // Skip if focus is on a different text input (not our target input)
    const target = e.target as HTMLElement;
    if (
      target !== currentInput &&
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    const key = e.key.toLowerCase();

    // Special keys and non-alphabetic characters: handle only if input is focused
    if (key.length !== 1 || !/^[a-z]$/.test(key)) {
      // If the input itself is focused, let these keys work normally
      if (target === currentInput) {
        return;
      }
      // If keyboard is focused but user pressed a special key, redirect to input
      // For comma, space, etc., we need to manually insert them
      if (key === ',' || key === ' ') {
        e.preventDefault();
        const start = currentInput.selectionStart ?? 0;
        const end = currentInput.selectionEnd ?? 0;
        const currentValue = currentInput.value;
        const newValue = currentValue.slice(0, start) + key + currentValue.slice(end);
        currentInput.value = newValue;
        const newCursorPos = start + 1;
        currentInput.setSelectionRange(newCursorPos, newCursorPos);
        if (keyboardInstance) {
          keyboardInstance.setInput(newValue);
        }
        currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      // Backspace: delegate to existing handler
      if (key === 'backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }
      // Forward delete
      if (key === 'delete') {
        e.preventDefault();
        const start = currentInput.selectionStart ?? 0;
        const end = currentInput.selectionEnd ?? 0;
        const val = currentInput.value;
        let newValue: string;
        let newCursor: number;
        if (start !== end) {
          newValue = val.slice(0, start) + val.slice(end);
          newCursor = start;
        } else if (start < val.length) {
          newValue = val.slice(0, start) + val.slice(start + 1);
          newCursor = start;
        } else {
          return;
        }
        currentInput.value = newValue;
        if (keyboardInstance) keyboardInstance.setInput(newValue);
        currentInput.setSelectionRange(newCursor, newCursor);
        currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      // For other special keys (arrows, etc.), just ignore when keyboard focused
      return;
    }

    // Single alphabetic character - apply transliteration
    if (TRANSLITERATION_MAP[key]) {
      // Prevent default behavior (don't insert the English letter)
      e.preventDefault();

      const hebrewChar = TRANSLITERATION_MAP[key];
      const start = currentInput.selectionStart ?? 0;
      const end = currentInput.selectionEnd ?? 0;
      const currentValue = currentInput.value;

      // Insert Hebrew character at cursor position
      const newValue = currentValue.slice(0, start) + hebrewChar + currentValue.slice(end);
      currentInput.value = newValue;

      // Set cursor position after inserted character
      const newCursorPos = start + hebrewChar.length;
      currentInput.setSelectionRange(newCursorPos, newCursorPos);

      // Sync virtual keyboard
      if (keyboardInstance) {
        keyboardInstance.setInput(newValue);
      }

      // Trigger input event to update search
      currentInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Key is a letter but not in the map (e.g., 'i', 'o', 'u') - ignore it
      e.preventDefault();
    }
  };

  // Listen at document level so it works even when keyboard has focus
  document.addEventListener('keydown', keydownHandler);

  // Paste handler: redirect paste to input when keyboard is open
  if (pasteHandler) {
    document.removeEventListener('paste', pasteHandler);
  }

  pasteHandler = (e: ClipboardEvent) => {
    if (!isKeyboardOpen() || !currentInput) return;

    const target = e.target as HTMLElement;
    // If input itself has focus, let its own paste handler work
    if (target === currentInput) return;
    // Skip if focus is on another text input
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;

    e.preventDefault();

    const start = currentInput.selectionStart ?? 0;
    const end = currentInput.selectionEnd ?? 0;
    const currentValue = currentInput.value;
    currentInput.value = currentValue.slice(0, start) + text + currentValue.slice(end);
    const newCursorPos = start + text.length;
    currentInput.setSelectionRange(newCursorPos, newCursorPos);

    if (keyboardInstance) {
      keyboardInstance.setInput(currentInput.value);
    }

    // Dispatch input event — the search overlay's input handler strips nikkud
    currentInput.dispatchEvent(new Event('input', { bubbles: true }));
  };

  document.addEventListener('paste', pasteHandler);
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
        // Top row (q w e r t y p)
        '\u05e7': 'q\n\u05e7', // ק qof
        '\u05d5': 'w/v\n\u05d5', // ו vav (w and v both map here)
        '\u05e2': 'e\n\u05e2', // ע ayin
        '\u05e8': 'r\n\u05e8', // ר resh
        '\u05ea': 't\n\u05ea', // ת tav
        '\u05d9': 'y\n\u05d9', // י yod
        '\u05e4': 'p/f\n\u05e4', // פ pe (p and f both map here)
        // Middle row (a s d g h j k l) - f merged with p above
        '\u05d0': 'a\n\u05d0', // א aleph
        '\u05e1': 's\n\u05e1', // ס samech
        '\u05d3': 'd\n\u05d3', // ד dalet
        '\u05d2': 'g\n\u05d2', // ג gimel
        '\u05d4': 'h\n\u05d4', // ה he
        '\u05d7': 'j\n\u05d7', // ח chet
        '\u05db': 'k\n\u05db', // כ kaf
        '\u05dc': 'l\n\u05dc', // ל lamed
        // Bottom row (z x c b n m) - v merged with w above
        '\u05d6': 'z\n\u05d6', // ז zayin
        '\u05e9': 'x\n\u05e9', // ש shin
        '\u05e6': 'c\n\u05e6', // צ tsadi
        '\u05d1': 'b\n\u05d1', // ב bet
        '\u05e0': 'n\n\u05e0', // נ nun
        '\u05de': 'm\n\u05de'  // מ mem
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
  setupTransliterationHandler();
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

  // Remove document-level handlers
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  if (pasteHandler) {
    document.removeEventListener('paste', pasteHandler);
    pasteHandler = null;
  }

  // Don't null out currentInput - keep the reference for when keyboard reopens
}

export function isKeyboardOpen(): boolean {
  const container = document.getElementById('hebrew-keyboard-container');
  return container ? container.style.display === 'block' : false;
}
