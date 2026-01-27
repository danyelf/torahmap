# Hebrew Virtual Keyboard Design

**Date:** 2026-01-27
**Bead:** tm-0ne
**Status:** Approved for implementation

## Overview

Integrate GreyWyvern virtual keyboard library (from Sefaria) to enable Hebrew text input for users without Hebrew keyboards.

## Architecture

### Technology Choice

**Library:** GreyWyvern HTML Virtual Keyboard Interface v1.49
- **Source:** Sefaria-Project repository
- **License:** BSD
- **Type:** Vanilla JavaScript, no dependencies
- **Size:** ~1400 lines

### Configuration

- **Layout:** Hebrew only (`עברית`)
- **Number pad:** Disabled
- **Size adjustment:** Disabled
- **Dead keys:** Disabled
- **Language adaptation:** Disabled

### User Experience

- Keyboard icon appears when search input is focused
- Icon disappears when input loses focus (200ms delay)
- Clicking icon opens draggable virtual keyboard popup
- Typing on virtual keyboard updates search input in real-time
- Keyboard auto-closes when clicking outside

## Implementation

### New Files

1. `public/lib/keyboard.js` - GreyWyvern library (from Sefaria)
2. `public/lib/keyboard.css` - Base keyboard styles (from Sefaria)
3. `src/styles/keyboard-overrides.css` - Custom Torah Map styling
4. `public/images/keyboard-icon.svg` - Keyboard trigger icon
5. `src/types/keyboard.d.ts` - TypeScript definitions

### Modified Files

1. `index.html` - Include keyboard scripts and styles
2. `src/overlays/search.ts` - Integrate keyboard icon and event handlers
3. `src/main.ts` - Initialize keyboard configuration

### Styling

Custom CSS overrides to match Torah Map aesthetic:
- Light gray background (#f8f8f8)
- White keys with subtle borders
- Blue hover state (#e8f4ff)
- Rounded corners and shadow for polish

### Code Changes

**Configuration (main.ts):**
```typescript
if (window.VKI) {
  window.VKI.kt = 'עברית';
  window.VKI.deadkeysOn = false;
  window.VKI.numberPadOn = false;
  window.VKI.sizeAdj = false;
  window.VKI.langAdapt = false;
}
```

**Integration (search.ts):**
- Add `keyboardInput` class to search input
- Add keyboard icon element
- Show icon on focus, hide on blur
- Handle icon click to trigger keyboard

## Testing

- Verify keyboard opens when icon clicked
- Verify typing on virtual keyboard updates search input
- Verify search results update in real-time
- Verify RTL direction still auto-detects
- Verify keyboard closes when clicking outside
- Verify no conflicts with existing search functionality

## Browser Compatibility

- Chrome, Firefox, Safari, Edge (all modern versions)
- No additional polyfills needed
