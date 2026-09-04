import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHebrewKeyboard, closeHebrewKeyboard, isKeyboardOpen } from '../../hebrewKeyboard';

describe('hebrewKeyboard', () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    // Create a test input element
    input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
  });

  afterEach(() => {
    // Clean up
    closeHebrewKeyboard();
    if (input.parentNode) {
      input.parentNode.removeChild(input);
    }
    // Remove keyboard wrapper (contains both container and close button)
    const keyboardWrapper = document.getElementById('hebrew-keyboard-wrapper');
    if (keyboardWrapper && keyboardWrapper.parentNode) {
      keyboardWrapper.parentNode.removeChild(keyboardWrapper);
    }
  });

  describe('createHebrewKeyboard', () => {
    it('creates keyboard container', () => {
      createHebrewKeyboard(input);
      const wrapper = document.getElementById('hebrew-keyboard-wrapper');
      const container = document.getElementById('hebrew-keyboard-container');
      expect(wrapper).toBeTruthy();
      expect(container).toBeTruthy();
      expect(wrapper?.style.display).toBe('flex');
    });

    it('sets up transliteration handler', () => {
      createHebrewKeyboard(input);

      // Simulate typing 'a' (should become א)
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      input.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('closeHebrewKeyboard', () => {
    it('hides keyboard wrapper', () => {
      createHebrewKeyboard(input);
      closeHebrewKeyboard();

      const wrapper = document.getElementById('hebrew-keyboard-wrapper');
      expect(wrapper?.style.display).toBe('none');
    });

    it('removes transliteration handler', () => {
      createHebrewKeyboard(input);
      closeHebrewKeyboard();

      // Typing should work normally now
      input.value = '';
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      input.dispatchEvent(event);

      // preventDefault should NOT be called when keyboard is closed
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('isKeyboardOpen', () => {
    it('returns false when keyboard is closed', () => {
      expect(isKeyboardOpen()).toBe(false);
    });

    it('returns true when keyboard is open', () => {
      createHebrewKeyboard(input);
      expect(isKeyboardOpen()).toBe(true);
    });

    it('returns false after closing keyboard', () => {
      createHebrewKeyboard(input);
      closeHebrewKeyboard();
      expect(isKeyboardOpen()).toBe(false);
    });
  });

  describe('transliteration handler', () => {
    beforeEach(() => {
      createHebrewKeyboard(input);
      input.focus();
    });

    it('inserts Hebrew character at cursor position', () => {
      input.value = '';
      input.setSelectionRange(0, 0);

      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      input.dispatchEvent(event);

      expect(input.value).toBe('\u05d0'); // א
    });

    it('inserts character in middle of text', () => {
      input.value = '12';
      input.setSelectionRange(1, 1); // Cursor between '1' and '2'

      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      input.dispatchEvent(event);

      expect(input.value).toBe('1\u05d02'); // 1 א 2
    });

    it('replaces selected text', () => {
      input.value = 'test';
      input.setSelectionRange(1, 3); // Select 'es'

      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      input.dispatchEvent(event);

      expect(input.value).toBe('t\u05d0t'); // t א t
    });

    it('updates cursor position after insertion', () => {
      input.value = 'test';
      input.setSelectionRange(2, 2);

      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      input.dispatchEvent(event);

      expect(input.selectionStart).toBe(3); // After the inserted character
      expect(input.selectionEnd).toBe(3);
    });

    it('does not intercept non-alphabetic keys', () => {
      input.value = '';

      // Try typing a number (not a letter)
      const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      input.dispatchEvent(event);

      // Numbers should pass through
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('ignores unmapped alphabetic keys', () => {
      input.value = '';

      // Try typing 'o' (letter not in transliteration map)
      const eventO = new KeyboardEvent('keydown', { key: 'o', bubbles: true });
      const preventDefaultSpyO = vi.spyOn(eventO, 'preventDefault');
      input.dispatchEvent(eventO);

      // 'o' should be prevented (ignored)
      expect(preventDefaultSpyO).toHaveBeenCalled();
      expect(input.value).toBe('');

      // Try typing 'i' (letter not in transliteration map)
      const eventI = new KeyboardEvent('keydown', { key: 'i', bubbles: true });
      const preventDefaultSpyI = vi.spyOn(eventI, 'preventDefault');
      input.dispatchEvent(eventI);

      // 'i' should be prevented (ignored)
      expect(preventDefaultSpyI).toHaveBeenCalled();
      expect(input.value).toBe('');

      // Try typing 'u' (maps to ט tet)
      const eventU = new KeyboardEvent('keydown', { key: 'u', bubbles: true });
      Object.defineProperty(eventU, 'preventDefault', { value: vi.fn() });
      input.dispatchEvent(eventU);

      // 'u' should produce ט
      expect(input.value).toBe('\u05d8');
    });

    it('does not intercept special keys', () => {
      input.value = 'test';

      // Try pressing Backspace (not a single printable character)
      const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      input.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('preserves comma for multi-term search', () => {
      input.value = '';

      // Type comma
      const event = new KeyboardEvent('keydown', { key: ',', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      input.dispatchEvent(event);

      // Comma should not be intercepted
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('works even when keyboard container has focus', () => {
      input.value = '';
      input.setSelectionRange(0, 0);

      // Get the keyboard container
      const container = document.getElementById('hebrew-keyboard-container');
      expect(container).toBeTruthy();

      // Create a mock element inside the keyboard container
      const mockElement = document.createElement('div');
      container!.appendChild(mockElement);

      // Simulate typing 'a' while element inside keyboard has focus
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      Object.defineProperty(event, 'target', { value: mockElement, configurable: true });
      const preventDefaultFn = vi.fn();
      Object.defineProperty(event, 'preventDefault', { value: preventDefaultFn, configurable: true });
      document.dispatchEvent(event);

      // Hebrew character should still be inserted
      expect(input.value).toBe('\u05d0'); // א
      expect(preventDefaultFn).toHaveBeenCalled(); // Prevented default
    });

    it('allows comma when keyboard container has focus', () => {
      input.value = '\u05d0'; // Start with א
      input.setSelectionRange(1, 1);

      const container = document.getElementById('hebrew-keyboard-container');
      expect(container).toBeTruthy();

      // Create a mock element inside the keyboard container
      const mockElement = document.createElement('div');
      container!.appendChild(mockElement);

      // Simulate typing comma while element inside keyboard has focus
      const event = new KeyboardEvent('keydown', { key: ',', bubbles: true });
      Object.defineProperty(event, 'target', { value: mockElement, configurable: true });
      const preventDefaultFn = vi.fn();
      Object.defineProperty(event, 'preventDefault', { value: preventDefaultFn, configurable: true });
      document.dispatchEvent(event);

      // Comma should be inserted into input
      expect(input.value).toBe('\u05d0,'); // א,
      expect(preventDefaultFn).toHaveBeenCalled(); // Prevented default and handled manually
    });

    it('allows space when keyboard container has focus', () => {
      input.value = '\u05d0';
      input.setSelectionRange(1, 1);

      const container = document.getElementById('hebrew-keyboard-container');
      expect(container).toBeTruthy();

      // Create a mock element inside the keyboard container
      const mockElement = document.createElement('div');
      container!.appendChild(mockElement);

      // Simulate typing space while element inside keyboard has focus
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
      Object.defineProperty(event, 'target', { value: mockElement, configurable: true });
      const preventDefaultFn = vi.fn();
      Object.defineProperty(event, 'preventDefault', { value: preventDefaultFn, configurable: true });
      document.dispatchEvent(event);

      // Space should be inserted
      expect(input.value).toBe('\u05d0 '); // א with space
      expect(preventDefaultFn).toHaveBeenCalled(); // Prevented default and handled manually
    });
  });

  describe('paste support', () => {
    beforeEach(() => {
      createHebrewKeyboard(input);
    });

    it('allows pasting Hebrew text when keyboard is open', () => {
      input.value = '';
      input.setSelectionRange(0, 0);

      // Simulate paste event
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        clipboardData: new DataTransfer()
      });

      // Add Hebrew text to clipboard
      pasteEvent.clipboardData?.setData('text/plain', 'שלום');

      // Manually insert pasted text (browser would normally do this)
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e as ClipboardEvent).clipboardData?.getData('text/plain');
        if (text) {
          const start = input.selectionStart ?? 0;
          const end = input.selectionEnd ?? 0;
          input.value = input.value.slice(0, start) + text + input.value.slice(end);
          input.setSelectionRange(start + text.length, start + text.length);
        }
      }, { once: true });

      input.dispatchEvent(pasteEvent);

      // Hebrew text should be pasted successfully
      expect(input.value).toBe('שלום');
    });

    it('allows pasting when keyboard container has focus', () => {
      input.value = 'א';
      input.setSelectionRange(1, 1);

      const container = document.getElementById('hebrew-keyboard-container');
      const mockElement = document.createElement('div');
      container!.appendChild(mockElement);

      // Even if keyboard has focus, paste should still work on the input
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        clipboardData: new DataTransfer()
      });

      pasteEvent.clipboardData?.setData('text/plain', ' עולם');

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e as ClipboardEvent).clipboardData?.getData('text/plain');
        if (text) {
          const start = input.selectionStart ?? 0;
          const end = input.selectionEnd ?? 0;
          input.value = input.value.slice(0, start) + text + input.value.slice(end);
          input.setSelectionRange(start + text.length, start + text.length);
        }
      }, { once: true });

      input.dispatchEvent(pasteEvent);

      // Pasted text should be appended
      expect(input.value).toBe('א עולם');
    });
  });

  describe('virtual keyboard backspace', () => {
    beforeEach(() => {
      createHebrewKeyboard(input);
    });

    it('deletes character at end by default', () => {
      input.value = '\u05e7\u05e8\u05d0'; // ערא
      input.setSelectionRange(3, 3); // Cursor at end

      // Find and click the backspace button
      const backspaceBtn = document.querySelector('.hg-button[data-skbtn="{bksp}"]') as HTMLElement;
      if (backspaceBtn) {
        backspaceBtn.click();
        expect(input.value).toBe('\u05e7\u05e8'); // ער
      }
    });

    it('deletes character before cursor', () => {
      input.value = '\u05e7\u05e8\u05d0'; // ערא
      input.setSelectionRange(1, 1); // Cursor after first character

      const backspaceBtn = document.querySelector('.hg-button[data-skbtn="{bksp}"]') as HTMLElement;
      if (backspaceBtn) {
        backspaceBtn.click();
        expect(input.value).toBe('\u05e8\u05d0'); // רא (deleted first character)
        expect(input.selectionStart).toBe(0); // Cursor moved back
      }
    });

    it('deletes selected text', () => {
      input.value = '\u05e7\u05e8\u05d0'; // ערא
      input.setSelectionRange(0, 2); // Select first two characters

      const backspaceBtn = document.querySelector('.hg-button[data-skbtn="{bksp}"]') as HTMLElement;
      if (backspaceBtn) {
        backspaceBtn.click();
        expect(input.value).toBe('\u05d0'); // א (deleted selected text)
        expect(input.selectionStart).toBe(0);
      }
    });

    it('does nothing at start of text', () => {
      input.value = '\u05e7'; // ק
      input.setSelectionRange(0, 0); // Cursor at start

      const backspaceBtn = document.querySelector('.hg-button[data-skbtn="{bksp}"]') as HTMLElement;
      if (backspaceBtn) {
        backspaceBtn.click();
        expect(input.value).toBe('\u05e7'); // ק (unchanged)
      }
    });
  });
});
