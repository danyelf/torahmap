// Hebrew virtual keyboard using simple-keyboard
import Keyboard from 'simple-keyboard';
import 'simple-keyboard/build/css/index.css';
import './styles/hebrewKeyboard.css';

let keyboardInstance: Keyboard | null = null;
let currentInput: HTMLInputElement | null = null;

// Hebrew keyboard layout
const hebrewLayout = {
  default: [
    "/ ' \u05e7 \u05e8 \u05d0 \u05d8 \u05d5 \u05df \u05dd \u05e4 {bksp}",
    "\u05e9 \u05d3 \u05d2 \u05db \u05e2 \u05d9 \u05d7 \u05dc \u05da \u05e3 ,",
    "\u05d6 \u05e1 \u05d1 \u05d4 \u05e0 \u05de \u05e6 \u05ea \u05e5 .",
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

function positionKeyboard(inputElement: HTMLInputElement, container: HTMLElement): void {
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
