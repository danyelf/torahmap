/**
 * `derive`, worked out once per value and kept. An overlay's colours are asked
 * for once per verse, 23,000 times a paint, all with one settings value and
 * one data value.
 *
 * Settings and data are never edited in place — a change is a new value — so
 * a value's identity is a sound key, and a value no longer held is let go. The
 * last value asked about is checked first, because a paint asks about the same
 * one every time.
 */
export function memoByValue<K extends object, V>(derive: (key: K) => V): (key: K) => V {
  const values = new WeakMap<K, V>();
  let last: { of: K; value: V } | null = null;

  return (key) => {
    if (last?.of === key) return last.value;
    const value = values.has(key) ? (values.get(key) as V) : derive(key);
    values.set(key, value);
    last = { of: key, value };
    return value;
  };
}

/** `memoByValue` with a second key: `derive` runs once per value and key. */
export function memoByValueAndKey<K extends object, Q, V>(
  derive: (value: K, key: Q) => V,
): (value: K, key: Q) => V {
  const keyed = memoByValue((value: K) => {
    const byKey = new Map<Q, V>();
    return (key: Q): V => {
      if (!byKey.has(key)) byKey.set(key, derive(value, key));
      return byKey.get(key) as V;
    };
  });
  return (value, key) => keyed(value)(key);
}
