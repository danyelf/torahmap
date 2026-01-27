# Hebrew Virtual Keyboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add GreyWyvern virtual keyboard to enable Hebrew text input in search

**Architecture:** Integrate vanilla JS keyboard library from Sefaria with focus-triggered icon, custom styling to match Torah Map aesthetic, and minimal configuration (Hebrew-only, no extras)

**Tech Stack:** GreyWyvern Virtual Keyboard (BSD), TypeScript, Vanilla CSS

---

## Task 1: Download Keyboard Library Files

**Files:**
- Create: `public/lib/keyboard.js`
- Create: `public/lib/keyboard.css`

**Step 1: Create lib directory**

```bash
mkdir -p public/lib
```

**Step 2: Download keyboard.js from Sefaria**

```bash
curl -o public/lib/keyboard.js https://raw.githubusercontent.com/Sefaria/Sefaria-Project/master/static/js/lib/keyboard.js
```

Expected: File downloaded successfully (~1400 lines)

**Step 3: Download keyboard.css from Sefaria**

```bash
curl -o public/lib/keyboard.css https://raw.githubusercontent.com/Sefaria/Sefaria-Project/master/static/css/keyboard.css
```

Expected: File downloaded successfully

**Step 4: Verify files**

```bash
ls -lh public/lib/
wc -l public/lib/keyboard.js
```

Expected: Both files present, keyboard.js ~1400 lines

**Step 5: Commit**

```bash
git add public/lib/
git commit -m "Add GreyWyvern virtual keyboard library from Sefaria

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Keyboard Icon

**Files:**
- Create: `public/images/keyboard-icon.svg`

**Step 1: Create images directory**

```bash
mkdir -p public/images
```

**Step 2: Create keyboard icon SVG**

Create `public/images/keyboard-icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="6" width="20" height="12" rx="2"/>
  <line x1="6" y1="10" x2="6.01" y2="10"/>
  <line x1="10" y1="10" x2="10.01" y2="10"/>
  <line x1="14" y1="10" x2="14.01" y2="10"/>
  <line x1="18" y1="10" x2="18.01" y2="10"/>
  <line x1="6" y1="14" x2="6.01" y2="14"/>
  <line x1="10" y1="14" x2="10.01" y2="14"/>
  <line x1="14" y1="14" x2="14.01" y2="14"/>
  <line x1="18" y1="14" x2="18.01" y2="14"/>
</svg>
```

**Step 3: Verify icon**

```bash
cat public/images/keyboard-icon.svg
```

Expected: SVG content visible

**Step 4: Commit**

```bash
git add public/images/keyboard-icon.svg
git commit -m "Add keyboard icon SVG

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add TypeScript Type Definitions

**Files:**
- Create: `src/types/keyboard.d.ts`

**Step 1: Create types directory if needed**

```bash
mkdir -p src/types
```

**Step 2: Create type definitions**

Create `src/types/keyboard.d.ts`:

```typescript
// Type definitions for GreyWyvern Virtual Keyboard Interface

interface VKI_Config {
  kt: string;           // Default keyboard layout
  deadkeysOn: boolean;  // Enable dead keys
  numberPadOn: boolean; // Show number pad
  sizeAdj: boolean;     // Allow size adjustment
  langAdapt: boolean;   // Auto-adapt to input lang attribute
  imageURI: string;     // Path to keyboard images
  clickless: number;    // Clickless mode setting
  clearPasswords: boolean; // Clear password fields
}

interface Window {
  VKI?: VKI_Config;
  VKI_attach?: (element: HTMLElement) => void;
  VKI_close?: () => void;
}

interface HTMLInputElement {
  VKI_attached?: boolean;
}
```

**Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: No type errors

**Step 4: Commit**

```bash
git add src/types/keyboard.d.ts
git commit -m "Add TypeScript definitions for GreyWyvern keyboard

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create Custom Keyboard Styling

**Files:**
- Create: `src/styles/keyboard-overrides.css`

**Step 1: Create keyboard overrides CSS**

Create `src/styles/keyboard-overrides.css`:

```css
/* Custom styling for GreyWyvern keyboard to match Torah Map */

/* Keyboard container - match controls panel styling */
#keyboardInputMaster {
  background: #f8f8f8 !important;
  border: 1px solid #ccc !important;
  border-radius: 4px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

/* Keyboard title bar */
#keyboardInputMaster thead {
  background: #e8e8e8 !important;
  border-bottom: 1px solid #ccc !important;
}

#keyboardInputMaster thead td {
  background: #e8e8e8 !important;
  color: #333 !important;
  font-weight: 500 !important;
}

/* Individual keys */
#keyboardInputMaster tbody td {
  background: #fff !important;
  border: 1px solid #d0d0d0 !important;
  color: #333 !important;
  font-size: 14px !important;
  transition: background 0.1s, border-color 0.1s !important;
}

/* Key hover state */
#keyboardInputMaster tbody td:hover {
  background: #e8f4ff !important;
  border-color: #0066cc !important;
}

/* Key active/pressed state */
#keyboardInputMaster tbody td:active {
  background: #d0e8ff !important;
}

/* Special keys (shift, space, etc.) */
#keyboardInputMaster tbody .sf {
  background: #f0f0f0 !important;
  font-weight: 500 !important;
}

#keyboardInputMaster tbody .sf:hover {
  background: #e0e0e0 !important;
}

/* Keyboard icon trigger */
.keyboard-trigger {
  width: 20px;
  height: 20px;
  margin-left: 6px;
  cursor: pointer;
  opacity: 0.5;
  vertical-align: middle;
  transition: opacity 0.2s;
  color: #666;
}

.keyboard-trigger:hover {
  opacity: 1;
  color: #333;
}
```

**Step 2: Verify CSS syntax**

```bash
cat src/styles/keyboard-overrides.css
```

Expected: Valid CSS

**Step 3: Commit**

```bash
git add src/styles/keyboard-overrides.css
git commit -m "Add custom keyboard styling to match Torah Map theme

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Include Keyboard Files in HTML

**Files:**
- Modify: `index.html`

**Step 1: Read current index.html**

```bash
cat index.html
```

**Step 2: Add keyboard CSS and JS includes**

In `index.html`, add these lines in the `<head>` section after existing stylesheets:

```html
  <link rel="stylesheet" href="/src/styles/main.css">
  <link rel="stylesheet" href="/lib/keyboard.css">
  <link rel="stylesheet" href="/src/styles/keyboard-overrides.css">
```

And add the keyboard script before the main.ts script at the end of `<body>`:

```html
  <script src="/lib/keyboard.js" charset="UTF-8"></script>
  <script type="module" src="/src/main.ts"></script>
```

**Step 3: Verify changes**

```bash
grep -n "keyboard" index.html
```

Expected: Lines showing keyboard.css, keyboard-overrides.css, and keyboard.js

**Step 4: Test dev server starts**

```bash
npm run dev &
sleep 3
curl -s http://localhost:5173 | grep keyboard
pkill -f "vite"
```

Expected: HTML contains keyboard references

**Step 5: Commit**

```bash
git add index.html
git commit -m "Include GreyWyvern keyboard library in HTML

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Initialize Keyboard Configuration

**Files:**
- Modify: `src/main.ts`

**Step 1: Find keyboard initialization point**

Look for where the app is fully loaded (after DOM ready):

```bash
grep -n "DOMContentLoaded\|window.onload" src/main.ts || grep -n "async function main" src/main.ts | head -5
```

**Step 2: Add keyboard configuration**

Add this code after the DOM is ready and keyboard.js has loaded (typically near the end of main initialization):

```typescript
// Configure GreyWyvern virtual keyboard for Hebrew input
function initializeKeyboard(): void {
  if (window.VKI) {
    window.VKI.kt = 'עברית';           // Hebrew layout only
    window.VKI.deadkeysOn = false;     // No diacriticals
    window.VKI.numberPadOn = false;    // No number pad
    window.VKI.sizeAdj = false;        // No size adjustment
    window.VKI.langAdapt = false;      // Don't auto-switch layouts
  }
}

// Call after a short delay to ensure keyboard.js is loaded
setTimeout(initializeKeyboard, 100);
```

**Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: No errors, build succeeds

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "Initialize GreyWyvern keyboard with Hebrew-only config

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Keyboard Icon to Search Input

**Files:**
- Modify: `src/overlays/search.ts`

**Step 1: Update renderControls HTML**

In `src/overlays/search.ts`, find the `renderControls` method and update the search container HTML:

Change from:
```typescript
container.innerHTML = `
  <div id="search-container">
    <input type="text" id="search-input" placeholder="Search Hebrew or English...">
    <button id="search-clear">&times;</button>
  </div>
```

To:
```typescript
container.innerHTML = `
  <div id="search-container">
    <input type="text" id="search-input" class="keyboardInput" placeholder="Search Hebrew or English...">
    <img src="/images/keyboard-icon.svg" id="keyboard-icon" class="keyboard-trigger" style="display: none;" alt="Hebrew keyboard">
    <button id="search-clear">&times;</button>
  </div>
```

**Step 2: Verify changes**

```bash
grep -A3 "search-container" src/overlays/search.ts
```

Expected: Shows updated HTML with keyboard icon

**Step 3: Commit**

```bash
git add src/overlays/search.ts
git commit -m "Add keyboard icon to search input with keyboardInput class

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Keyboard Icon Show/Hide Logic

**Files:**
- Modify: `src/overlays/search.ts`

**Step 1: Add DOM reference for keyboard icon**

In the "DOM references" section at top of file (around line 24-29), add:

```typescript
let keyboardIcon: HTMLImageElement | null = null;
```

**Step 2: Capture keyboard icon reference**

In `renderControls`, after getting other DOM references (around line 353-356), add:

```typescript
searchInput = container.querySelector('#search-input');
searchClear = container.querySelector('#search-clear');
searchResults = container.querySelector('#search-results');
wholeWordCheckbox = container.querySelector('#whole-word-checkbox');
keyboardIcon = container.querySelector('#keyboard-icon');
```

**Step 3: Add focus event handler**

After the existing searchInput event listeners (around line 460-464), add:

```typescript
// Show keyboard icon when search input is focused
searchInput?.addEventListener('focus', () => {
  if (keyboardIcon) {
    keyboardIcon.style.display = 'inline';
  }
});

// Hide keyboard icon when search input loses focus
searchInput?.addEventListener('blur', () => {
  // Small delay to allow clicking the icon
  setTimeout(() => {
    if (keyboardIcon) {
      keyboardIcon.style.display = 'none';
    }
  }, 200);
});
```

**Step 4: Clear keyboard icon reference in destroy**

In the `destroy` method (around line 534-544), add:

```typescript
searchInput = null;
searchClear = null;
searchResults = null;
wholeWordCheckbox = null;
keyboardIcon = null;
```

**Step 5: Verify TypeScript compiles**

```bash
npm run build
```

Expected: No errors

**Step 6: Commit**

```bash
git add src/overlays/search.ts
git commit -m "Add keyboard icon show/hide on search input focus/blur

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Manual Testing

**Files:**
- None (manual testing only)

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Open browser and test**

Navigate to `http://localhost:5173`

**Test checklist:**
1. ✓ Click search overlay selector
2. ✓ Click in search input - keyboard icon should appear
3. ✓ Click keyboard icon - virtual keyboard should open
4. ✓ Click Hebrew letters on keyboard - they should appear in search input
5. ✓ Type enough letters to trigger search - results should appear
6. ✓ Verify RTL direction auto-switches for Hebrew
7. ✓ Click outside keyboard - it should close
8. ✓ Click outside search input - keyboard icon should disappear after 200ms
9. ✓ Verify no console errors

**Step 3: Document test results**

Create `docs/manual-test-results.md` with findings

**Step 4: Stop dev server**

```bash
# Press Ctrl+C in terminal
```

---

## Task 10: Fix Any Issues Found in Testing

**Files:**
- TBD based on test results

**Step 1: Review test results**

```bash
cat docs/manual-test-results.md
```

**Step 2: Fix issues if any**

Address each issue found:
- CSS styling problems
- JavaScript errors
- UX issues
- Missing functionality

**Step 3: Re-test**

Repeat Task 9 to verify fixes

**Step 4: Commit fixes**

```bash
git add <modified-files>
git commit -m "Fix: [describe issue fixed]

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Run Automated Tests

**Files:**
- None (running existing tests)

**Step 1: Run all tests**

```bash
npm test
```

Expected: All 1204 tests pass (no new test failures)

**Step 2: If tests fail, investigate**

```bash
npm test -- --reporter=verbose
```

**Step 3: Fix any broken tests**

If integration broke existing tests, fix them

**Step 4: Commit any test fixes**

```bash
git add <fixed-test-files>
git commit -m "Fix tests broken by keyboard integration

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Final Verification and Cleanup

**Files:**
- None

**Step 1: Verify all files committed**

```bash
git status
```

Expected: "working tree clean"

**Step 2: Review commit history**

```bash
git log --oneline | head -15
```

Expected: ~10-12 commits for this feature

**Step 3: Test in production build**

```bash
npm run build
npm run preview
```

Open browser to preview URL and verify keyboard works in production build

**Step 4: Document completion**

Ready for final review and merge
