---
id: tm-32i
status: closed
priority: 2
type: task
created: 2026-01-27
closed: 2026-01-27
---

# Standardize overlay lifecycle and configuration

**Problem:** Overlays have inconsistent patterns for configuration and cleanup:
- Some export standalone configure() functions with different signatures
- Some have destroy(), some don't
- Configuration is split between init() and configure()

**Files:**
- src/overlays/commentary.ts:52-56,148
- src/overlays/trop.ts:169-176,246
- src/overlays/search.ts:29,423-440
- src/overlays/divine-names.ts (no destroy)
- src/overlays/text-dating.ts (no destroy)

**Solution:**
1. Add optional configure?(config: unknown): void to Overlay interface
2. Document when destroy() is needed (event listeners, cached state, etc.)
3. Ensure all overlays needing cleanup implement destroy()
4. Consider making destroy() required (even if empty) for consistency
