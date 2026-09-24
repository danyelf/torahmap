// What the panel shows. A story is a mode with no tools, only its menu.
// Outside it one panel is open — on a phone possibly none, leaving the map and
// the folded lines — and a phone's sheet can be dragged to full height.

export type Panel = 'overlay' | 'stories' | 'about' | 'menu';

export interface Frame {
  mode: 'story' | 'explore';
  /** The open panel, while exploring. Null on a phone at rest, never on a desktop. */
  open: Panel | null;
  /** The menu has dropped over the story. */
  menu: boolean;
  /** A phone's open panel, dragged to full height. */
  full: boolean;
}

export type FrameEvent =
  | { type: 'menu' }
  | { type: 'choose'; panel: Panel }
  | { type: 'story' }
  | { type: 'map-touched' }
  | { type: 'drag'; dy: number }
  | { type: 'typing' }
  | { type: 'layout-changed' };

export const STORY: Frame = { mode: 'story', open: null, menu: false, full: false };

/** How far a finger must travel to count as a drag rather than a tap. */
export const DRAG_PX = 10;

const explore = (open: Panel | null): Frame => ({
  mode: 'explore',
  open,
  menu: false,
  full: false,
});

/** Where leaving the story, or a link into the explore view, lands. */
export function exploreFrame(phone: boolean): Frame {
  return explore(phone ? null : 'overlay');
}

export function nextFrame(frame: Frame, event: FrameEvent, phone: boolean): Frame {
  return fit(step(frame, event, phone), phone);
}

/** A desktop always has a panel open and has no full height. */
function fit(frame: Frame, phone: boolean): Frame {
  if (phone || frame.mode === 'story') return frame;
  return { ...frame, open: frame.open ?? 'overlay', full: false };
}

function step(frame: Frame, event: FrameEvent, phone: boolean): Frame {
  switch (event.type) {
    case 'menu':
      if (frame.mode === 'story') return { ...frame, menu: !frame.menu };
      return explore(frame.open === 'menu' ? null : 'menu');
    case 'choose': {
      const again = phone && frame.mode === 'explore' && frame.open === event.panel;
      return explore(again ? null : event.panel);
    }
    case 'story':
      return STORY;
    case 'map-touched':
      if (frame.mode === 'story') return { ...frame, menu: false };
      return phone ? explore(null) : frame;
    case 'drag':
      if (!phone || frame.mode === 'story' || frame.open === null) return frame;
      if (Math.abs(event.dy) < DRAG_PX) return frame;
      if (event.dy < 0) return { ...frame, full: true };
      return frame.full ? { ...frame, full: false } : explore(null);
    case 'typing':
      return phone && frame.mode === 'explore' ? { ...frame, full: true } : frame;
    case 'layout-changed':
      return frame;
  }
}
