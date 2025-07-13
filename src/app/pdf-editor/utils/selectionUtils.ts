import {
  TextField,
  Shape,
  Image,
  SelectedElement,
} from "../types/pdf-editor.types";

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const getElementBounds = (
  element: TextField | Shape | Image
): ElementBounds => {
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
  console.log("moveSelectedElements called", {
    selectedElementsCount: selectedElements.length,
    deltaX,
    deltaY,
    pageWidth,
    pageHeight,
  });

  selectedElements.forEach((selectedElement) => {
    console.log("Processing element", selectedElement);

    const element = getElementById(selectedElement.id, selectedElement.type);
    if (element) {
      const newX = selectedElement.originalPosition.x + deltaX;
      const newY = selectedElement.originalPosition.y + deltaY;

      // Calculate boundary constraints
      let constrainedX = newX;
      let constrainedY = newY;

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

      console.log("Moving element", {
        id: selectedElement.id,
        type: selectedElement.type,
        from: {
          x: selectedElement.originalPosition.x,
          y: selectedElement.originalPosition.y,
        },
        to: { x: constrainedX, y: constrainedY },
        originalDelta: { deltaX, deltaY },
        constrained: {
          deltaX: constrainedX - selectedElement.originalPosition.x,
          deltaY: constrainedY - selectedElement.originalPosition.y,
        },
        pageBounds: { width: pageWidth, height: pageHeight },
      });

      switch (selectedElement.type) {
        case "textbox":
          updateTextBox(selectedElement.id, {
            x: constrainedX,
            y: constrainedY,
          });
          break;
        case "shape":
          updateShape(selectedElement.id, { x: constrainedX, y: constrainedY });
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
