// Test environment setup, run before every test file.
//
// simple-keyboard (pulled in by the search overlay) bundles core-js, which
// installs its DOM-collection polyfills on import. One of them replaces
// NodeList.prototype.forEach with Array.prototype.forEach. That is fine in a
// browser, where a NodeList really is index-addressable, but happy-dom keeps
// its nodes behind an internal symbol and exposes indices through a Proxy, so
// the Array version reads nothing and quietly visits zero elements — while
// .length still reports the right number. Any test that walks a NodeList with
// forEach then passes or fails depending on whether something upstream of it
// happened to import the search overlay.
//
// Pin the environment's own implementations behind an accessor that ignores
// writes. core-js tries Object.defineProperty first, which throws on a
// non-configurable property, then falls back to plain assignment, which lands
// on the no-op setter instead of throwing.
function pinForEach(collection: { prototype: object } | undefined): void {
  if (!collection?.prototype) return;

  const descriptor = Object.getOwnPropertyDescriptor(
    collection.prototype,
    'forEach',
  );
  const original = descriptor?.value;
  if (typeof original !== 'function') return;

  Object.defineProperty(collection.prototype, 'forEach', {
    configurable: false,
    enumerable: false,
    get: () => original,
    set: () => {
      // Ignore polyfills; the environment's own implementation is correct here.
    },
  });
}

pinForEach(globalThis.NodeList);
pinForEach(globalThis.HTMLCollection);
