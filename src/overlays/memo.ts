/**
 * `derive`, worked out once per settings value and kept. An overlay's colours
 * are asked for once per verse, 23,000 times a paint, all with one value.
 *
 * Settings are never edited in place — every change makes a new value — so a
 * value's identity is a sound key, and a value no longer held is let go. The
 * last value asked about is checked first, because a paint asks about the same
 * one every time.
 */
export function memoBySettings<S extends object, V>(
  derive: (settings: S) => V,
): (settings: S) => V {
  const values = new WeakMap<S, V>();
  let last: { of: S; value: V } | null = null;

  return (settings) => {
    if (last?.of === settings) return last.value;
    const value = values.has(settings) ? (values.get(settings) as V) : derive(settings);
    values.set(settings, value);
    last = { of: settings, value };
    return value;
  };
}
