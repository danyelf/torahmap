export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Box extends Rect {
  name: string;
}

/** Fractional CSS lengths round differently at each edge; this much is not a defect. */
const SLACK = 0.5;

const px = (n: number): string => `${Math.round(n)}`;

function overlap(a: Rect, b: Rect): { w: number; h: number } | null {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > SLACK && h > SLACK ? { w, h } : null;
}

const describeOverlap = (a: Box, b: Box, o: { w: number; h: number }): string =>
  `${a.name} overlaps ${b.name} by ${px(o.w)}×${px(o.h)}px`;

export function overlapping(boxes: Box[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const o = overlap(boxes[i], boxes[j]);
      if (o) out.push(describeOverlap(boxes[i], boxes[j], o));
    }
  }
  return out;
}

export function apart(a: Box[], b: Box[]): string[] {
  return a.flatMap((x) =>
    b.flatMap((y) => {
      const o = overlap(x, y);
      return o ? [describeOverlap(x, y, o)] : [];
    }),
  );
}

export function outsideOf(boxes: Box[], frame: Rect): string[] {
  return boxes.flatMap((b) => {
    const sides = [
      b.x < frame.x - SLACK && 'left',
      b.y < frame.y - SLACK && 'top',
      b.x + b.width > frame.x + frame.width + SLACK && 'right',
      b.y + b.height > frame.y + frame.height + SLACK && 'bottom',
    ].filter(Boolean);
    return sides.length ? [`${b.name} crosses the ${sides.join(', ')} edge`] : [];
  });
}

export function tooSmallToTouch(boxes: Box[], min: number): string[] {
  return boxes
    .filter((b) => b.width < min - SLACK || b.height < min - SLACK)
    .map((b) => `${b.name} is ${px(b.width)}×${px(b.height)}px, under ${min}`);
}

/** An element's full box, and the part of it not hidden or clipped away (null: none). */
export interface Shown {
  full: Box;
  visible: Rect | null;
}

/** What keeps the elements `selector` matched from showing in full, if anything. */
export function notShownInFull(selector: string, found: Shown[]): string[] {
  if (found.length === 0) return [`${selector} matches nothing`];
  return found.flatMap(({ full, visible }) => {
    if (!visible) return [`${full.name} is hidden`];
    const sides = [
      visible.x > full.x + SLACK && 'left',
      visible.y > full.y + SLACK && 'top',
      visible.x + visible.width < full.x + full.width - SLACK && 'right',
      visible.y + visible.height < full.y + full.height - SLACK && 'bottom',
    ].filter(Boolean);
    return sides.length ? [`${full.name} is cut off at the ${sides.join(', ')} edge`] : [];
  });
}
