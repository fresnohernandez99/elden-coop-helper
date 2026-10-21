const SCREEN_MARGIN = 48;

/** Popup width that fits on narrow phone screens. */
export function popupSize(preferredMax: number, preferredMin: number) {
  const available = window.innerWidth - SCREEN_MARGIN;
  return {
    maxWidth: Math.min(preferredMax, available),
    minWidth: Math.min(preferredMin, available),
    // Keep the popup clear of the menu button and the zoom control when it pans into view.
    autoPanPaddingTopLeft: [16, 72] as [number, number],
    autoPanPaddingBottomRight: [64, 24] as [number, number],
  };
}
