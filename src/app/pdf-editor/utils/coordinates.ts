// Coordinate utility functions for split view and positioning

export interface CoordinateAdjustment {
  x: number;
  y: number;
}

// Helper function to adjust coordinates for split view
export const adjustSplitViewCoordinates = (
  x: number,
  y: number,
  targetView: "original" | "translated" | "final-layout" | null,
  currentView: "original" | "translated" | "split" | "final-layout",
  pageWidth: number
): CoordinateAdjustment => {
  if (currentView === "split" && targetView === "translated") {
    const singleDocWidth = pageWidth;
    const gap = 20; // Gap between documents
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
  currentView: "original" | "translated" | "split" | "final-layout",
  pageWidth: number,
  templateScaleFactor?: number
): number => {
  if (currentView === "split" && isTranslated) {
    // Apply template scaling factor to the preview position
    const effectiveScale =
      templateScaleFactor && templateScaleFactor !== 1
        ? 1 * templateScaleFactor
        : 1;
    return x * effectiveScale + pageWidth + 20;
  }
  return x;
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
  pageWidth: number
): "original" | "translated" | null => {
  const singleDocWidth = pageWidth;
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
  targetView: "original" | "translated" | "final-layout" | null,
  currentView: "original" | "translated" | "split" | "final-layout",
  pageWidth: number,
  templateScaleFactor?: number,
  pdfRenderScale?: number // Optional parameter for new CSS transform approach
): CoordinateAdjustment => {
  // If pdfRenderScale is provided, we're using the CSS transform approach
  // Otherwise, fall back to the old direct scaling approach
  if (pdfRenderScale && pdfRenderScale !== 1) {
    // New CSS transform approach
    const visualScale = 1 / pdfRenderScale;

    // Convert screen coordinates accounting for both PDF render 1 and visual transform
    let x = (clientX - rect.left) / (pdfRenderScale * visualScale);
    let y = (clientY - rect.top) / (pdfRenderScale * visualScale);

    // For split screen view, adjust coordinates based on which side was clicked
    if (currentView === "split" && targetView === "translated") {
      const singleDocWidth = pageWidth;
      const gap = 20 / (pdfRenderScale * visualScale);
      x = x - singleDocWidth - gap;

      // Apply template scaling factor to coordinates when template is 1d in split view
      if (templateScaleFactor && templateScaleFactor !== 1) {
        x = x / templateScaleFactor;
        y = y / templateScaleFactor;
      }
    }

    return { x, y };
  } else {
    // Old direct scaling approach (backward compatibility)
    let x = clientX - rect.left;
    let y = clientY - rect.top;

    // For split screen view, adjust coordinates based on which side was clicked
    if (currentView === "split" && targetView === "translated") {
      const singleDocWidth = pageWidth;
      const gap = 20;
      x = x - singleDocWidth - gap;

      // Apply template scaling factor to coordinates when template is 1d in split view
      if (templateScaleFactor && templateScaleFactor !== 1) {
        x = x / templateScaleFactor;
        y = y / templateScaleFactor;
      }
    }

    return { x, y };
  }
};
