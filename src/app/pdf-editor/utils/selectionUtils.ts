import {
  TextField,
  Shape,
  Image,
  SelectedElement,
} from "../types/pdf-editor.types";
import { applyTransform, clearTransform } from "./performance";

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const getElementBounds = (
  element: TextField | Shape | Image
): ElementBounds => {
  // Handle line shapes specially since they use x1,y1,x2,y2 coordinates
  if ("type" in element && element.type === "line") {
    const lineShape = element as Shape;
    if (
      lineShape.x1 !== undefined &&
      lineShape.y1 !== undefined &&
      lineShape.x2 !== undefined &&
      lineShape.y2 !== undefined
    ) {
      const minX = Math.min(lineShape.x1, lineShape.x2);
      const minY = Math.min(lineShape.y1, lineShape.y2);
      const maxX = Math.max(lineShape.x1, lineShape.x2);
      const maxY = Math.max(lineShape.y1, lineShape.y2);

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }
  }

  // For all other elements (textboxes, regular shapes, images), use standard bounds
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
};

export const calculateSelectionBounds = (
  elements: SelectedElement[],
  getElementById: (
    id: string,
    type: "textbox" | "shape" | "image"
  ) => TextField | Shape | Image | null
): ElementBounds | null => {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach((selectedElement) => {
    const element = getElementById(selectedElement.id, selectedElement.type);
    if (element) {
      const bounds = getElementBounds(element);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }
  });

  if (minX === Infinity || minY === Infinity) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

export const checkElementIntersection = (
  element: TextField | Shape | Image,
  selectionRect: { x: number; y: number; width: number; height: number }
): boolean => {
  const elementBounds = getElementBounds(element);

  // Check if rectangles intersect
  return !(
    elementBounds.x + elementBounds.width < selectionRect.x ||
    elementBounds.x > selectionRect.x + selectionRect.width ||
    elementBounds.y + elementBounds.height < selectionRect.y ||
    elementBounds.y > selectionRect.y + selectionRect.height
  );
};

export const findElementsInSelection = (
  selectionRect: { x: number; y: number; width: number; height: number },
  textBoxes: TextField[],
  shapes: Shape[],
  images: Image[]
): SelectedElement[] => {
  const selectedElements: SelectedElement[] = [];

  // Check textboxes
  textBoxes.forEach((textBox) => {
    if (checkElementIntersection(textBox, selectionRect)) {
      selectedElements.push({
        id: textBox.id,
        type: "textbox",
        originalPosition: { x: textBox.x, y: textBox.y },
      });
    }
  });

  // Check shapes
  shapes.forEach((shape) => {
    if (checkElementIntersection(shape, selectionRect)) {
      selectedElements.push({
        id: shape.id,
        type: "shape",
        originalPosition: { x: shape.x, y: shape.y },
      });
    }
  });

  // Check images
  images.forEach((image) => {
    if (checkElementIntersection(image, selectionRect)) {
      selectedElements.push({
        id: image.id,
        type: "image",
        originalPosition: { x: image.x, y: image.y },
      });
    }
  });

  return selectedElements;
};

export const moveSelectedElements = (
  selectedElements: SelectedElement[],
  deltaX: number,
  deltaY: number,
  updateTextBox: (id: string, updates: Partial<TextField>) => void,
  updateShape: (id: string, updates: Partial<Shape>) => void,
  updateImage: (id: string, updates: Partial<Image>) => void,
  getElementById: (
    id: string,
    type: "textbox" | "shape" | "image"
  ) => TextField | Shape | Image | null,
  pageWidth: number,
  pageHeight: number
) => {
  // console.log("moveSelectedElements called", {
  //   selectedElementsCount: selectedElements.length,
  //   deltaX,
  //   deltaY,
  //   pageWidth,
  //   pageHeight,
  // });

  selectedElements.forEach((selectedElement) => {

    const element = getElementById(selectedElement.id, selectedElement.type);
    if (element) {
      const newX = selectedElement.originalPosition.x + deltaX;
      const newY = selectedElement.originalPosition.y + deltaY;

      // Calculate boundary constraints
      let constrainedX = newX;
      let constrainedY = newY;

      // Check if this is a line shape for special boundary handling
      const isLineShape =
        selectedElement.type === "shape" &&
        "type" in element &&
        (element as Shape).type === "line";

      if (isLineShape) {
        const lineShape = element as Shape;
        if (
          lineShape.x1 !== undefined &&
          lineShape.y1 !== undefined &&
          lineShape.x2 !== undefined &&
          lineShape.y2 !== undefined
        ) {
          // For lines, calculate boundaries based on the entire line
          const moveDeltaX = newX - selectedElement.originalPosition.x;
          const moveDeltaY = newY - selectedElement.originalPosition.y;

          const newX1 = lineShape.x1 + moveDeltaX;
          const newY1 = lineShape.y1 + moveDeltaY;
          const newX2 = lineShape.x2 + moveDeltaX;
          const newY2 = lineShape.y2 + moveDeltaY;

          // Check if any part of the line would go outside boundaries
          const minX = Math.min(newX1, newX2);
          const maxX = Math.max(newX1, newX2);
          const minY = Math.min(newY1, newY2);
          const maxY = Math.max(newY1, newY2);

          // Constrain based on line bounds
          if (minX < 0) {
            constrainedX = newX - minX;
          } else if (maxX > pageWidth) {
            constrainedX = newX - (maxX - pageWidth);
          }

          if (minY < 0) {
            constrainedY = newY - minY;
          } else if (maxY > pageHeight) {
            constrainedY = newY - (maxY - pageHeight);
          }
        }
      } else {
        // Regular boundary constraints for non-line elements
        // Prevent element from going outside left boundary (x < 0)
        if (newX < 0) {
          constrainedX = 0;
        }

        // Prevent element from going outside top boundary (y < 0)
        if (newY < 0) {
          constrainedY = 0;
        }

        // Prevent element from going outside right boundary (x + width > pageWidth)
        if (newX + element.width > pageWidth) {
          constrainedX = pageWidth - element.width;
        }

        // Prevent element from going outside bottom boundary (y + height > pageHeight)
        if (newY + element.height > pageHeight) {
          constrainedY = pageHeight - element.height;
        }

        // Ensure element doesn't go outside boundaries (additional safety check)
        constrainedX = Math.max(
          0,
          Math.min(constrainedX, pageWidth - element.width)
        );
        constrainedY = Math.max(
          0,
          Math.min(constrainedY, pageHeight - element.height)
        );
      }

      // console.log("Moving element", {
      //   id: selectedElement.id,
      //   type: selectedElement.type,
      //   from: {
      //     x: selectedElement.originalPosition.x,
      //     y: selectedElement.originalPosition.y,
      //   },
      //   to: { x: constrainedX, y: constrainedY },
      //   originalDelta: { deltaX, deltaY },
      //   constrained: {
      //     deltaX: constrainedX - selectedElement.originalPosition.x,
      //     deltaY: constrainedY - selectedElement.originalPosition.y,
      //   },
      //   pageBounds: { width: pageWidth, height: pageHeight },
      // });

      switch (selectedElement.type) {
        case "textbox":
          updateTextBox(selectedElement.id, {
            x: constrainedX,
            y: constrainedY,
          });
          break;
        case "shape":
          // Handle line shapes specially - they need x1,y1,x2,y2 updates
          if ("type" in element && element.type === "line") {
            const lineShape = element as Shape;
            if (
              lineShape.x1 !== undefined &&
              lineShape.y1 !== undefined &&
              lineShape.x2 !== undefined &&
              lineShape.y2 !== undefined
            ) {
              // Calculate how much to move the line coordinates
              const moveDeltaX =
                constrainedX - selectedElement.originalPosition.x;
              const moveDeltaY =
                constrainedY - selectedElement.originalPosition.y;

              updateShape(selectedElement.id, {
                x1: lineShape.x1 + moveDeltaX,
                y1: lineShape.y1 + moveDeltaY,
                x2: lineShape.x2 + moveDeltaX,
                y2: lineShape.y2 + moveDeltaY,
              });
            } else {
              // Fallback for shapes without line coordinates
              updateShape(selectedElement.id, {
                x: constrainedX,
                y: constrainedY,
              });
            }
          } else {
            // Regular shapes (rectangles, circles)
            updateShape(selectedElement.id, {
              x: constrainedX,
              y: constrainedY,
            });
          }
          break;
        case "image":
          updateImage(selectedElement.id, { x: constrainedX, y: constrainedY });
          break;
      }
    } else {
      console.log("Element not found", selectedElement);
    }
  });
};

// Optimized version of moveSelectedElements that uses transforms for visual feedback
// and batches actual position updates for better performance
export const moveSelectedElementsOptimized = (
  selectedElements: SelectedElement[],
  deltaX: number,
  deltaY: number,
  getElementById: (
    id: string,
    type: "textbox" | "shape" | "image"
  ) => TextField | Shape | Image | null,
  pageWidth: number,
  pageHeight: number,
  useTransforms: boolean = true
): Array<{
  id: string;
  type: "textbox" | "shape" | "image";
  constrainedX: number;
  constrainedY: number;
  originalX: number;
  originalY: number;
}> => {
  const updates: Array<{
    id: string;
    type: "textbox" | "shape" | "image";
    constrainedX: number;
    constrainedY: number;
    originalX: number;
    originalY: number;
  }> = [];

  // Pre-calculate all constraint updates without applying them
  selectedElements.forEach((selectedElement) => {
    const element = getElementById(selectedElement.id, selectedElement.type);
    if (!element) return;

    const newX = selectedElement.originalPosition.x + deltaX;
    const newY = selectedElement.originalPosition.y + deltaY;

    let constrainedX = newX;
    let constrainedY = newY;

    // Check if this is a line shape for special boundary handling
    const isLineShape =
      selectedElement.type === "shape" &&
      "type" in element &&
      (element as Shape).type === "line";

    if (isLineShape) {
      const lineShape = element as Shape;
      if (
        lineShape.x1 !== undefined &&
        lineShape.y1 !== undefined &&
        lineShape.x2 !== undefined &&
        lineShape.y2 !== undefined
      ) {
        // For lines, calculate boundaries based on the entire line
        const moveDeltaX = newX - selectedElement.originalPosition.x;
        const moveDeltaY = newY - selectedElement.originalPosition.y;

        const newX1 = lineShape.x1 + moveDeltaX;
        const newY1 = lineShape.y1 + moveDeltaY;
        const newX2 = lineShape.x2 + moveDeltaX;
        const newY2 = lineShape.y2 + moveDeltaY;

        // Check if any part of the line would go outside boundaries
        const minX = Math.min(newX1, newX2);
        const maxX = Math.max(newX1, newX2);
        const minY = Math.min(newY1, newY2);
        const maxY = Math.max(newY1, newY2);

        // Constrain based on line bounds
        if (minX < 0) {
          constrainedX = newX - minX;
        } else if (maxX > pageWidth) {
          constrainedX = newX - (maxX - pageWidth);
        }

        if (minY < 0) {
          constrainedY = newY - minY;
        } else if (maxY > pageHeight) {
          constrainedY = newY - (maxY - pageHeight);
        }
      }
    } else {
      // Regular boundary constraints for non-line elements
      constrainedX = Math.max(
        0,
        Math.min(newX, pageWidth - element.width)
      );
      constrainedY = Math.max(
        0,
        Math.min(newY, pageHeight - element.height)
      );
    }

    updates.push({
      id: selectedElement.id,
      type: selectedElement.type,
      constrainedX,
      constrainedY,
      originalX: selectedElement.originalPosition.x,
      originalY: selectedElement.originalPosition.y,
    });

    // Apply visual transform if requested
    if (useTransforms) {
      const visualDeltaX = constrainedX - selectedElement.originalPosition.x;
      const visualDeltaY = constrainedY - selectedElement.originalPosition.y;
      applyTransform(selectedElement.id, visualDeltaX, visualDeltaY);
    }
  });

  return updates;
};

// Batch apply position updates for multiple elements
export const batchApplyElementUpdates = (
  updates: Array<{
    id: string;
    type: "textbox" | "shape" | "image";
    constrainedX: number;
    constrainedY: number;
    originalX: number;
    originalY: number;
  }>,
  updateTextBox: (id: string, updates: Partial<TextField>) => void,
  updateShape: (id: string, updates: Partial<Shape>) => void,
  updateImage: (id: string, updates: Partial<Image>) => void,
  getElementById: (
    id: string,
    type: "textbox" | "shape" | "image"
  ) => TextField | Shape | Image | null
) => {
  updates.forEach((update) => {
    // Clear visual transforms
    clearTransform(update.id);

    const element = getElementById(update.id, update.type);
    if (!element) return;

    switch (update.type) {
      case "textbox":
        updateTextBox(update.id, {
          x: update.constrainedX,
          y: update.constrainedY,
        });
        break;
      case "shape":
        // Handle line shapes specially - they need x1,y1,x2,y2 updates
        if ("type" in element && element.type === "line") {
          const lineShape = element as Shape;
          if (
            lineShape.x1 !== undefined &&
            lineShape.y1 !== undefined &&
            lineShape.x2 !== undefined &&
            lineShape.y2 !== undefined
          ) {
            // Calculate how much to move the line coordinates
            const moveDeltaX = update.constrainedX - update.originalX;
            const moveDeltaY = update.constrainedY - update.originalY;

            updateShape(update.id, {
              x1: lineShape.x1 + moveDeltaX,
              y1: lineShape.y1 + moveDeltaY,
              x2: lineShape.x2 + moveDeltaX,
              y2: lineShape.y2 + moveDeltaY,
            });
          } else {
            // Fallback for shapes without line coordinates
            updateShape(update.id, {
              x: update.constrainedX,
              y: update.constrainedY,
            });
          }
        } else {
          // Regular shapes (rectangles, circles)
          updateShape(update.id, {
            x: update.constrainedX,
            y: update.constrainedY,
          });
        }
        break;
      case "image":
        updateImage(update.id, {
          x: update.constrainedX,
          y: update.constrainedY,
        });
        break;
    }
  });
};
