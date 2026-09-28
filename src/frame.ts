// What the panel shows. A story is a mode with no tools, only its menu.
// Outside it one panel is open, or none, leaving only the map; a phone's sheet
// can be dragged to full height.

const PANELS = ['search', 'overlay', 'stories', 'about'] as const;
export type Panel = (typeof PANELS)[number];

/** What each panel is called, in the column's header and at the top of the panel. */
export const PANEL_TITLES: Record<Panel, string> = {
  search: 'Search',
  overlay: 'Overlay',
  stories: 'Stories',
  about: 'About & settings',
};

export function isPanel(name: string | undefined): name is Panel {
  return PANELS.some((panel) => panel === name);
}

/** Search or the overlay, whichever's panel opened most recently. */
export type FrontTool = 'search' | 'overlay';

/**
 * Which tool leads after a panel opens. Only Search and Overlay count:
 * Stories, About and a closed sheet leave the current one in front.
 */
export function frontToolAfter(current: FrontTool, opened: Panel | null): FrontTool {
  return opened === 'search' || opened === 'overlay' ? opened : current;
}

export interface Frame {
  mode: 'story' | 'explore';
  /** The open panel, while exploring; null when closed. */
  open: Panel | null;
  /** The ☰ menu has dropped: over the column on a desktop, from the corner on a phone. */
  menu: boolean;
  /** A phone's open panel, dragged to full height. */
  full: boolean;
}

export type FrameEvent =
  | { type: 'menu' }
  | { type: 'choose'; panel: Panel }
  | { type: 'close' }
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
export function exploreFrame(phone: boolean, open: Panel = 'overlay'): Frame {
  return explore(phone ? null : open);
}

export function nextFrame(frame: Frame, event: FrameEvent, phone: boolean): Frame {
  return fit(step(frame, event, phone), phone);
}

/** A desktop has no full height. */
function fit(frame: Frame, phone: boolean): Frame {
  return phone ? frame : { ...frame, full: false };
}

function step(frame: Frame, event: FrameEvent, phone: boolean): Frame {
  switch (event.type) {
    case 'menu':
      return { ...frame, menu: !frame.menu };
    case 'choose': {
      // Tapping the legend for the open panel folds a phone's sheet; while the
      // menu is down, choosing that panel keeps it open.
      const again = phone && frame.mode === 'explore' && !frame.menu && frame.open === event.panel;
      return explore(again ? null : event.panel);
    }
    case 'close':
      // A phone's story has no header, so nothing there closes it.
      return phone && frame.mode === 'story' ? frame : explore(null);
    case 'story':
      return STORY;
    case 'map-touched':
      return phone && frame.mode === 'explore' ? explore(null) : { ...frame, menu: false };
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
