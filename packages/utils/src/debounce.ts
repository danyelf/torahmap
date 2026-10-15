// Debounce: delay calling fn until ms have elapsed since the last invocation.
// `cancel` drops a call still waiting.

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): ((...args: Parameters<T>) => void) & { cancel(): void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const debounced = (...args: Parameters<T>) => {
    cancel();
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, delay);
  };
  return Object.assign(debounced, { cancel });
}
