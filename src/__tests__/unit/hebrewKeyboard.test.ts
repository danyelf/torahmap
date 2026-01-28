import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHebrewKeyboard, closeHebrewKeyboard, isKeyboardOpen } from '../../hebrewKeyboard';

describe('hebrewKeyboard', () => {
  let input: HTMLInputElement;
  let container: HTMLElement;

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
    // Remove keyboard container if it exists
    const keyboardContainer = document.getElementById('hebrew-keyboard-container');
    if (keyboardContainer && keyboardContainer.parentNode) {
      keyboardContainer.parentNode.removeChild(keyboardContainer);
    }
  });

  describe('createHebrewKeyboard', () => {
    it('creates keyboard container', () => {
      createHebrewKeyboard(input);
      const container = document.getElementById('hebrew-keyboard-container');
      expect(container).toBeTruthy();
      expect(container?.style.display).toBe('block');
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
    it('hides keyboard container', () => {
      createHebrewKeyboard(input);
      closeHebrewKeyboard();

      const container = document.getElementById('hebrew-keyboard-container');
      expect(container?.style.display).toBe('none');
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

    it('does not intercept unmapped keys', () => {
      input.value = '';

      // Try typing a number (not in transliteration map)
      const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      input.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
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
