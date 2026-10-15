// Something open over the popup, such as a menu anchored to one of its words,
// holds it: while held, a file landing does not redraw the popup out from under
// it, and the popup catches up on its next redraw.

export interface PopupHold {
  /** Holds the popup; the function returned releases this hold. */
  hold(): () => void;
  held(): boolean;
}

export function createPopupHold(): PopupHold {
  let holds = 0;
  return {
    hold() {
      holds++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holds--;
      };
    },
    held: () => holds > 0,
  };
}
