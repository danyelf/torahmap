// Driving the search overlay's controls the way a reader would.
import type { OverlayHost } from './overlayHost';

export function renderSearchControls(host: OverlayHost<unknown>): HTMLDivElement {
  return host.renderControls(document.createElement('div')) as HTMLDivElement;
}

export function typeIntoInput(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Types into a term row's input, the first/open one by default.
export function typeInSearch(
  container: HTMLElement,
  text: string,
  selector: string = '.term-input',
): void {
  typeIntoInput(container.querySelector<HTMLInputElement>(selector)!, text);
}
