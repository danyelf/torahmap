---
id: tm-uw93
status: open
priority: 2
type: task
created: 2026-01-29
---

# Hebrew keyboard: physical typing works when virtual keyboard has focus

Enable seamless physical keyboard typing even when the virtual Hebrew keyboard has focus.

**Problem:**
When users click on the virtual keyboard, focus moves away from the input field and physical keyboard typing stops working.

**Solution:**
Listen for keyboard events at the document level instead of just on the input element. When the keyboard is open and an event comes from the input or keyboard container:
- Mapped letters (a-z) → insert Hebrew characters
- Unmapped letters (i, o, u) → ignore completely  
- Special keys (comma, space) → manually insert into input
- Other keys (delete, arrows) → handled appropriately

**Result:**
- Click anywhere on virtual keyboard
- Keep typing with physical keyboard - Hebrew letters still appear
- Comma, space, and other special keys work seamlessly
- No interruption to typing flow

**In addition:**
- Pasting Hebrew into the box should still work when the Hebrew keyboard is open

**Implementation:**
- Handler moved from input-level to document-level event listener
- Checks that keyboard is open and target is input or keyboard container
- Special handling for comma/space when keyboard has focus
- Automatically deactivates when keyboard closes
