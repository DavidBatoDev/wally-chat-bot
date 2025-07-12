// Coordinate utility functions for split view and positioning

export interface CoordinateAdjustment {
  x: number;
  y: number;
}

// Helper function to adjust coordinates for split view
export const adjustSplitViewCoordinates = (
  x: number,
  y: number,
  targetView: "original" | "translated" | null,
  currentView: "original" | "translated" | "split",
  pageWidth: number,
  scale: number
): CoordinateAdjustment => {
  if (currentView === "split" && targetView === "translated") {
    const singleDocWidth = pageWidth;
    const gap = 20 / scale; // Convert gap to document coordinates
    return {
      x: x - singleDocWidth - gap,
      y,
    };
  }
  return { x, y };
};

// Calculate preview position for drawing tools
export const getPreviewLeft = (
  x: number,
  isTranslated: boolean,
  currentView: "original" | "translated" | "split",
  pageWidth: number,
  scale: number
): number => {
  if (currentView === "split" && isTranslated) {
    return x * scale + pageWidth * scale + 20;
  }
  return x * scale;
};

// Calculate popup position for UI elements
export const calculatePopupPosition = (
  top: number,
  height: number
): { top: number; position: "above" | "below" } => {
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - top - height;
  const spaceAbove = top;

  // If there's more space below, position below
  if (spaceBelow > spaceAbove) {
    return { top: top + height + 5, position: "below" };
  } else {
    return { top: top - 5, position: "above" };
  }
};

// Determine which view was clicked in split mode
export const determineClickedView = (
  clickX: number,
  pageWidth: number,
  scale: number
): "original" | "translated" | null => {
  const singleDocWidth = pageWidth * scale;
  const gap = 20;

  if (clickX > singleDocWidth + gap) {
    return "translated";
  } else if (clickX <= singleDocWidth) {
    return "original";
  }
  return null;
};

// Convert screen coordinates to document coordinates
export const screenToDocumentCoordinates = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
  scale: number,
  targetView: "original" | "translated" | null,
  currentView: "original" | "translated" | "split",
  pageWidth: number
): CoordinateAdjustment => {
  let x = (clientX - rect.left) / scale;
  let y = (clientY - rect.top) / scale;

  // For split screen view, adjust coordinates based on which side was clicked
  if (currentView === "split" && targetView === "translated") {
    const singleDocWidth = pageWidth;
    const gap = 20 / scale;
    x = x - singleDocWidth - gap;
  }

  return { x, y };
};
