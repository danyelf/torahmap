---
id: tm-7ca
status: open
priority: 4
type: bug
created: 2026-01-26
---

# Fix race condition in async overlay initialization

Multiple overlays call async init() functions in parallel without ensuring they complete before use. configureTrop() at line 157 happens synchronously but depends on data from verseTexts loaded asynchronously at line 128.

File: src/main.ts lines 126-129, 160
Impact: Overlays may initialize with incomplete data, causing null reference errors
Fix: Ensure proper initialization ordering and wait for dependencies
