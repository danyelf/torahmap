// Hebrew virtual keyboard using simple-keyboard
import Keyboard from 'simple-keyboard';
import 'simple-keyboard/build/css/index.css';
import './styles/hebrewKeyboard.css';

let keyboardInstance: Keyboard | null = null;
let currentInput: HTMLInputElement | null = null;

// Hebrew keyboard layout (without punctuation marks)
const hebrewLayout = {
  default: [
    "\u05e7 \u05e8 \u05d0 \u05d8 \u05d5 \u05df \u05dd \u05e4 {bksp}",
    "\u05e9 \u05d3 \u05d2 \u05db \u05e2 \u05d9 \u05d7 \u05dc \u05da \u05e3",
    "\u05d6 \u05e1 \u05d1 \u05d4 \u05e0 \u05de \u05e6",
    "{space}"
  ]
};

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

  // Sync keyboard with input value
  keyboardInstance.setInput(inputElement.value);

  // Position keyboard next to the controls panel
  positionKeyboard(inputElement, container);

  // Show keyboard
  container.style.display = 'block';
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
  // Don't null out currentInput - keep the reference for when keyboard reopens
}

export function isKeyboardOpen(): boolean {
  const container = document.getElementById('hebrew-keyboard-container');
  return container ? container.style.display === 'block' : false;
}
