// Small pieces of legend markup shared by overlays that build their own HTML.

/**
 * A `.legend-row` holding a color swatch and a label, as trop and text-dating
 * both build it. `labelClass`, when given, is set on the label span (text-dating
 * uses `label` for its line-height).
 */
export function legendRow(swatchBackground: string, label: string, labelClass?: string): string {
  const labelAttr = labelClass ? ` class="${labelClass}"` : '';
  return `<div class="legend-row"><span class="swatch" style="background: ${swatchBackground}"></span><span${labelAttr}>${label}</span></div>`;
}

/** A grey 10px caption line under a legend, as haftarah and verse-length both build it. */
export function legendCaption(
  text: string,
  options?: { marginTop?: number; marginLeft?: number; color?: string; lineHeight?: number },
): string {
  const marginTop = options?.marginTop ?? 4;
  const color = options?.color ?? '#888';
  const lineHeight = options?.lineHeight ?? 1.3;
  const marginLeft =
    options?.marginLeft !== undefined ? ` margin-left: ${options.marginLeft}px;` : '';
  return `<div style="color: ${color}; font-size: 10px; margin-top: ${marginTop}px;${marginLeft} line-height: ${lineHeight};">${text}</div>`;
}
