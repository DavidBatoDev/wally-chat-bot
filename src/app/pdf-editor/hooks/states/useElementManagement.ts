// NOTE: All element mutations (add, update, delete, move, etc.) should be wrapped in Command objects and pushed to the undo/redo history using useHistory.
// See useHistory.ts and commands.ts for details.
import { useState, useCallback, useMemo } from "react";
import {
  ElementCollections,
  LayerState,
  TextField,
  Shape,
  Image,
  DeletionRectangle,
  UntranslatedText,
  SortedElement,
  ViewMode,
} from "../../types/pdf-editor.types";
import { generateUUID, measureText } from "../../utils/measurements";

export const useElementManagement = () => {
  // Element collections state
  const [elementCollections, setElementCollections] =
    useState<ElementCollections>({
      originalTextBoxes: [],
      originalShapes: [],
      originalDeletionRectangles: [],
      originalImages: [],
      translatedTextBoxes: [],
      translatedShapes: [],
      translatedDeletionRectangles: [],
      translatedImages: [],
      untranslatedTexts: [],
    });

  // Layer order state
  const [layerState, setLayerState] = useState<LayerState>({
    originalLayerOrder: [],
    translatedLayerOrder: [],
  });

  // Helper functions to get current arrays based on view
  const getCurrentTextBoxes = useCallback(
    (currentView: ViewMode) => {
      return currentView === "original"
        ? elementCollections.originalTextBoxes
        : elementCollections.translatedTextBoxes;
    },
    [elementCollections]
  );

  const getCurrentShapes = useCallback(
    (currentView: ViewMode) => {
      return currentView === "original"
        ? elementCollections.originalShapes
        : elementCollections.translatedShapes;
    },
    [elementCollections]
  );

  const getCurrentImages = useCallback(
    (currentView: ViewMode) => {
      return currentView === "original"
        ? elementCollections.originalImages
        : elementCollections.translatedImages;
    },
    [elementCollections]
  );

  const getCurrentDeletionRectangles = useCallback(
    (currentView: ViewMode) => {
      return currentView === "original"
        ? elementCollections.originalDeletionRectangles
        : elementCollections.translatedDeletionRectangles;
    },
    [elementCollections]
  );

  const getCurrentLayerOrder = useCallback(
    (currentView: ViewMode) => {
      return currentView === "original"
        ? layerState.originalLayerOrder
        : layerState.translatedLayerOrder;
    },
    [layerState]
  );

  // Layer management functions
  const addToLayerOrder = useCallback(
    (elementId: string, currentView: ViewMode) => {
      setLayerState((prev) => {
        if (currentView === "original") {
          return {
            ...prev,
            originalLayerOrder: [...prev.originalLayerOrder, elementId],
          };
        } else {
          return {
            ...prev,
            translatedLayerOrder: [...prev.translatedLayerOrder, elementId],
          };
        }
      });
    },
    []
  );

  const removeFromLayerOrder = useCallback(
    (elementId: string, currentView: ViewMode) => {
      setLayerState((prev) => {
        if (currentView === "original") {
          return {
            ...prev,
            originalLayerOrder: prev.originalLayerOrder.filter(
              (id) => id !== elementId
            ),
          };
        } else {
          return {
            ...prev,
            translatedLayerOrder: prev.translatedLayerOrder.filter(
              (id) => id !== elementId
            ),
          };
        }
      });
    },
    []
  );

  const moveToFront = useCallback(
    (elementId: string, currentView: ViewMode) => {
      setLayerState((prev) => {
        const layerOrder =
          currentView === "original"
            ? prev.originalLayerOrder
            : prev.translatedLayerOrder;

        const filtered = layerOrder.filter((id) => id !== elementId);
        const newOrder = [...filtered, elementId];

        if (currentView === "original") {
          return { ...prev, originalLayerOrder: newOrder };
        } else {
          return { ...prev, translatedLayerOrder: newOrder };
        }
      });
    },
    []
  );

  const moveToBack = useCallback((elementId: string, currentView: ViewMode) => {
    setLayerState((prev) => {
      const layerOrder =
        currentView === "original"
          ? prev.originalLayerOrder
          : prev.translatedLayerOrder;

      const filtered = layerOrder.filter((id) => id !== elementId);
      const newOrder = [elementId, ...filtered];

      if (currentView === "original") {
        return { ...prev, originalLayerOrder: newOrder };
      } else {
        return { ...prev, translatedLayerOrder: newOrder };
      }
    });
  }, []);

  const moveForward = useCallback(
    (elementId: string, currentView: ViewMode) => {
      setLayerState((prev) => {
        const layerOrder =
          currentView === "original"
            ? prev.originalLayerOrder
            : prev.translatedLayerOrder;

        const index = layerOrder.indexOf(elementId);
        if (index === -1 || index === layerOrder.length - 1) return prev;

        const newOrder = [...layerOrder];
        [newOrder[index], newOrder[index + 1]] = [
          newOrder[index + 1],
          newOrder[index],
        ];

        if (currentView === "original") {
          return { ...prev, originalLayerOrder: newOrder };
        } else {
          return { ...prev, translatedLayerOrder: newOrder };
        }
      });
    },
    []
  );

  const moveBackward = useCallback(
    (elementId: string, currentView: ViewMode) => {
      setLayerState((prev) => {
        const layerOrder =
          currentView === "original"
            ? prev.originalLayerOrder
            : prev.translatedLayerOrder;

        const index = layerOrder.indexOf(elementId);
        if (index <= 0) return prev;

        const newOrder = [...layerOrder];
        [newOrder[index], newOrder[index - 1]] = [
          newOrder[index - 1],
          newOrder[index],
        ];

        if (currentView === "original") {
          return { ...prev, originalLayerOrder: newOrder };
        } else {
          return { ...prev, translatedLayerOrder: newOrder };
        }
      });
    },
    []
  );

  // Element creation functions
  const addTextBox = useCallback(
    (
      x: number,
      y: number,
      currentPage: number,
      currentView: ViewMode,
      targetView?: "original" | "translated",
      initialProperties?: Partial<TextField>
    ) => {
      const value = initialProperties?.value || "New Text Field";
      const fontSize = initialProperties?.fontSize || 8;
      const fontFamily = initialProperties?.fontFamily || "Arial, sans-serif";
      // Use provided ID if available, otherwise generate new one
      const fieldId = initialProperties?.id || generateUUID();
      console.log(
        "Adding textbox with ID:",
        fieldId,
        "provided:",
        !!initialProperties?.id
      );

      // Check if ID already exists to prevent duplicates
      const existingTextBoxes = [
        ...elementCollections.originalTextBoxes,
        ...elementCollections.translatedTextBoxes,
      ];
      const existingTextBox = existingTextBoxes.find((tb) => tb.id === fieldId);
      if (existingTextBox) {
        console.warn(
          "Duplicate textbox ID detected:",
          fieldId,
          "existing:",
          existingTextBox
        );
        return fieldId; // Return existing ID to prevent adding duplicate
      }

      const { width, height } = measureText(value, fontSize, fontFamily);

      const newTextBox: TextField = {
        id: fieldId,
        x,
        y,
        width: initialProperties?.width || width,
        height: initialProperties?.height || height,
        value,
        fontSize,
        fontFamily,
        page: currentPage,
        color: initialProperties?.color || "#000000",
        bold: initialProperties?.bold || false,
        italic: initialProperties?.italic || false,
        underline: initialProperties?.underline || false,
        textAlign: initialProperties?.textAlign || "left",
        listType: initialProperties?.listType || "none",
        letterSpacing: initialProperties?.letterSpacing || 0,
        lineHeight: initialProperties?.lineHeight || 1.1,
        rotation: initialProperties?.rotation || 0,
        borderRadius: initialProperties?.borderRadius || 0,
        borderTopLeftRadius: initialProperties?.borderTopLeftRadius || 0,
        borderTopRightRadius: initialProperties?.borderTopRightRadius || 0,
        borderWidth: initialProperties?.borderWidth || 0,
        borderBottomLeftRadius: initialProperties?.borderBottomLeftRadius || 0,
        borderBottomRightRadius:
          initialProperties?.borderBottomRightRadius || 0,
        borderColor: initialProperties?.borderColor || "#000000",
        hasBeenManuallyResized: false, // Initialize as not manually resized
        backgroundColor: initialProperties?.backgroundColor || "transparent",
        backgroundOpacity:
          initialProperties?.backgroundOpacity !== undefined
            ? initialProperties.backgroundOpacity
            : 1,
        paddingTop: initialProperties?.paddingTop || 0,
        paddingRight: initialProperties?.paddingRight || 0,
        paddingBottom: initialProperties?.paddingBottom || 0,
        paddingLeft: initialProperties?.paddingLeft || 0,
      };

      // Determine which document to add to
      const shouldAddToTranslated =
        currentView === "split"
          ? targetView === "translated"
          : currentView === "translated";

      setElementCollections((prev) => {
        if (shouldAddToTranslated) {
          return {
            ...prev,
            translatedTextBoxes: [...prev.translatedTextBoxes, newTextBox],
          };
        } else {
          return {
            ...prev,
            originalTextBoxes: [...prev.originalTextBoxes, newTextBox],
          };
        }
      });

      addToLayerOrder(
        fieldId,
        shouldAddToTranslated ? "translated" : "original"
      );

      return fieldId;
    },
    [addToLayerOrder]
  );

  const duplicateTextBox = useCallback(
    (originalId: string, currentView: ViewMode) => {
      // Find the original textbox from both collections
      const allTextBoxes = [
        ...elementCollections.originalTextBoxes,
        ...elementCollections.translatedTextBoxes,
      ];
      
      const originalTextBox = allTextBoxes.find((tb) => tb.id === originalId);
      if (!originalTextBox) {
        console.warn("Original textbox not found for duplication:", originalId);
        return null;
      }

      // Generate new ID for the duplicate
      const duplicateId = generateUUID();
      
      // Create duplicate with offset position
      const offset = 20; // 20px offset
      const duplicateTextBox: TextField = {
        ...originalTextBox,
        id: duplicateId,
        x: originalTextBox.x + offset,
        y: originalTextBox.y + offset,
      };

      // Determine which view the original textbox belongs to and add duplicate to the same view
      const isOriginalInOriginalView = elementCollections.originalTextBoxes.some(
        (tb) => tb.id === originalId
      );
      
      const targetView = isOriginalInOriginalView ? "original" : "translated";

      setElementCollections((prev) => {
        if (targetView === "original") {
          return {
            ...prev,
            originalTextBoxes: [...prev.originalTextBoxes, duplicateTextBox],
          };
        } else {
          return {
            ...prev,
            translatedTextBoxes: [...prev.translatedTextBoxes, duplicateTextBox],
          };
        }
      });

      addToLayerOrder(duplicateId, targetView);

      return duplicateId;
    },
    [elementCollections, addToLayerOrder]
  );

  const addShape = useCallback(
    (
      type: "circle" | "rectangle",
      x: number,
      y: number,
      width: number,
      height: number,
      currentPage: number,
      currentView: ViewMode,
      targetView?: "original" | "translated"
    ) => {
      const newShape: Shape = {
        id: generateUUID(),
        type,
        x,
        y,
        width,
        height,
        page: currentPage,
        borderColor: "#000000",
        borderWidth: 2,
        fillColor: "#ffffff",
        fillOpacity: 0.5,
        rotation: 0,
        borderRadius: type === "rectangle" ? 0 : undefined,
      };

      const shouldAddToTranslated =
        currentView === "split"
          ? targetView === "translated"
          : currentView === "translated";

      setElementCollections((prev) => {
        if (shouldAddToTranslated) {
          return {
            ...prev,
            translatedShapes: [...prev.translatedShapes, newShape],
          };
        } else {
          return {
            ...prev,
            originalShapes: [...prev.originalShapes, newShape],
          };
        }
      });

      addToLayerOrder(
        newShape.id,
        shouldAddToTranslated ? "translated" : "original"
      );

      return newShape.id;
    },
    [addToLayerOrder]
  );

  const addImage = useCallback(
    (
      src: string,
      x: number,
      y: number,
      width: number,
      height: number,
      currentPage: number,
      currentView: ViewMode
    ) => {
      const newImage: Image = {
        id: generateUUID(),
        x,
        y,
        width,
        height,
        page: currentPage,
        src,
        rotation: 0,
        opacity: 1,
        borderColor: "#000000",
        borderWidth: 0,
        borderRadius: 0,
      };

      setElementCollections((prev) => {
        if (currentView === "translated") {
          return {
            ...prev,
            translatedImages: [...prev.translatedImages, newImage],
          };
        } else {
          return {
            ...prev,
            originalImages: [...prev.originalImages, newImage],
          };
        }
      });

      addToLayerOrder(
        newImage.id,
        currentView === "translated" ? "translated" : "original"
      );

      return newImage.id;
    },
    [addToLayerOrder]
  );

  const addDeletionRectangle = useCallback(
    (
      x: number,
      y: number,
      width: number,
      height: number,
      currentPage: number,
      currentView: ViewMode,
      background: string,
      opacity?: number
    ) => {
      const newRectangle: DeletionRectangle = {
        id: generateUUID(),
        x,
        y,
        width,
        height,
        page: currentPage,
        background,
        ...(opacity !== undefined ? { opacity } : {}),
      };

      setElementCollections((prev) => {
        if (currentView === "translated") {
          return {
            ...prev,
            translatedDeletionRectangles: [
              ...prev.translatedDeletionRectangles,
              newRectangle,
            ],
          };
        } else {
          return {
            ...prev,
            originalDeletionRectangles: [
              ...prev.originalDeletionRectangles,
              newRectangle,
            ],
          };
        }
      });

      return newRectangle.id;
    },
    []
  );

  // Element update functions
  const updateTextBox = useCallback(
    (id: string, updates: Partial<TextField>) => {
      setElementCollections((prev) => ({
        ...prev,
        originalTextBoxes: prev.originalTextBoxes.map((box) =>
          box.id === id ? { ...box, ...updates } : box
        ),
        translatedTextBoxes: prev.translatedTextBoxes.map((box) =>
          box.id === id ? { ...box, ...updates } : box
        ),
      }));
    },
    []
  );

  const updateShape = useCallback((id: string, updates: Partial<Shape>) => {
    setElementCollections((prev) => ({
      ...prev,
      originalShapes: prev.originalShapes.map((shape) =>
        shape.id === id ? { ...shape, ...updates } : shape
      ),
      translatedShapes: prev.translatedShapes.map((shape) =>
        shape.id === id ? { ...shape, ...updates } : shape
      ),
    }));
  }, []);

  const updateImage = useCallback((id: string, updates: Partial<Image>) => {
    setElementCollections((prev) => ({
      ...prev,
      originalImages: prev.originalImages.map((image) =>
        image.id === id ? { ...image, ...updates } : image
      ),
      translatedImages: prev.translatedImages.map((image) =>
        image.id === id ? { ...image, ...updates } : image
      ),
    }));
  }, []);

  // Element deletion functions
  const deleteTextBox = useCallback(
    (id: string, currentView: ViewMode) => {
      setElementCollections((prev) => {
        if (currentView === "translated") {
          return {
            ...prev,
            translatedTextBoxes: prev.translatedTextBoxes.filter(
              (box) => box.id !== id
            ),
          };
        } else {
          return {
            ...prev,
            originalTextBoxes: prev.originalTextBoxes.filter(
              (box) => box.id !== id
            ),
          };
        }
      });
      removeFromLayerOrder(id, currentView);
    },
    [removeFromLayerOrder]
  );

  const deleteShape = useCallback(
    (id: string, currentView: ViewMode) => {
      setElementCollections((prev) => {
        if (currentView === "translated") {
          return {
            ...prev,
            translatedShapes: prev.translatedShapes.filter(
              (shape) => shape.id !== id
            ),
          };
        } else {
          return {
            ...prev,
            originalShapes: prev.originalShapes.filter(
              (shape) => shape.id !== id
            ),
          };
        }
      });
      removeFromLayerOrder(id, currentView);
    },
    [removeFromLayerOrder]
  );

  const deleteImage = useCallback(
    (id: string, currentView: ViewMode) => {
      setElementCollections((prev) => {
        if (currentView === "translated") {
          return {
            ...prev,
            translatedImages: prev.translatedImages.filter(
              (image) => image.id !== id
            ),
          };
        } else {
          return {
            ...prev,
            originalImages: prev.originalImages.filter(
              (image) => image.id !== id
            ),
          };
        }
      });
      removeFromLayerOrder(id, currentView);
    },
    [removeFromLayerOrder]
  );

  const deleteDeletionRectangle = useCallback(
    (id: string, currentView: ViewMode) => {
      setElementCollections((prev) => {
        if (currentView === "translated") {
          return {
            ...prev,
            translatedDeletionRectangles:
              prev.translatedDeletionRectangles.filter(
                (rect) => rect.id !== id
              ),
          };
        } else {
          return {
            ...prev,
            originalDeletionRectangles: prev.originalDeletionRectangles.filter(
              (rect) => rect.id !== id
            ),
          };
        }
      });
    },
    []
  );

  // Get sorted elements based on layer order
  const getSortedElements = useCallback(
    (currentView: ViewMode, currentPage: number): SortedElement[] => {
      const layerOrder = getCurrentLayerOrder(currentView);
      const textBoxes = getCurrentTextBoxes(currentView).filter(
        (box) => box.page === currentPage
      );
      const shapes = getCurrentShapes(currentView).filter(
        (shape) => shape.page === currentPage
      );
      const images = getCurrentImages(currentView).filter(
        (image) => image.page === currentPage
      );

      // Create a map of all elements
      const elementMap = new Map<string, SortedElement>();
      textBoxes.forEach((box) =>
        elementMap.set(box.id, { type: "textbox", element: box })
      );
      shapes.forEach((shape) =>
        elementMap.set(shape.id, { type: "shape", element: shape })
      );
      images.forEach((image) =>
        elementMap.set(image.id, { type: "image", element: image })
      );

      // Sort elements based on layer order
      const sortedElements: SortedElement[] = [];

      // Add elements in layer order
      layerOrder.forEach((id) => {
        const element = elementMap.get(id);
        if (element) {
          sortedElements.push(element);
          elementMap.delete(id);
        }
      });

      // Add any remaining elements (newly created ones not in layer order yet)
      elementMap.forEach((element) => {
        sortedElements.push(element);
      });

      return sortedElements;
    },
    [
      getCurrentLayerOrder,
      getCurrentTextBoxes,
      getCurrentShapes,
      getCurrentImages,
    ]
  );

  // Get sorted elements for original side (for split view)
  const getOriginalSortedElements = useCallback(
    (currentPage: number): SortedElement[] => {
      const layerOrder = layerState.originalLayerOrder;
      const textBoxes = elementCollections.originalTextBoxes.filter(
        (box) => box.page === currentPage
      );
      const shapes = elementCollections.originalShapes.filter(
        (shape) => shape.page === currentPage
      );
      const images = elementCollections.originalImages.filter(
        (image) => image.page === currentPage
      );

      // Create a map of all elements
      const elementMap = new Map<string, SortedElement>();
      textBoxes.forEach((box) =>
        elementMap.set(box.id, { type: "textbox", element: box })
      );
      shapes.forEach((shape) =>
        elementMap.set(shape.id, { type: "shape", element: shape })
      );
      images.forEach((image) =>
        elementMap.set(image.id, { type: "image", element: image })
      );

      // Sort elements based on layer order
      const sortedElements: SortedElement[] = [];

      // Add elements in layer order
      layerOrder.forEach((id) => {
        const element = elementMap.get(id);
        if (element) {
          sortedElements.push(element);
          elementMap.delete(id);
        }
      });

      // Add any remaining elements (newly created ones not in layer order yet)
      elementMap.forEach((element) => {
        sortedElements.push(element);
      });

      return sortedElements;
    },
    [layerState.originalLayerOrder, elementCollections]
  );

  // Get sorted elements for translated side (for split view)
  const getTranslatedSortedElements = useCallback(
    (currentPage: number): SortedElement[] => {
      const layerOrder = layerState.translatedLayerOrder;
      const textBoxes = elementCollections.translatedTextBoxes.filter(
        (box) => box.page === currentPage
      );
      const shapes = elementCollections.translatedShapes.filter(
        (shape) => shape.page === currentPage
      );
      const images = elementCollections.translatedImages.filter(
        (image) => image.page === currentPage
      );

      // Create a map of all elements
      const elementMap = new Map<string, SortedElement>();
      textBoxes.forEach((box) =>
        elementMap.set(box.id, { type: "textbox", element: box })
      );
      shapes.forEach((shape) =>
        elementMap.set(shape.id, { type: "shape", element: shape })
      );
      images.forEach((image) =>
        elementMap.set(image.id, { type: "image", element: image })
      );

      // Sort elements based on layer order
      const sortedElements: SortedElement[] = [];

      // Add elements in layer order
      layerOrder.forEach((id) => {
        const element = elementMap.get(id);
        if (element) {
          sortedElements.push(element);
          elementMap.delete(id);
        }
      });

      // Add any remaining elements (newly created ones not in layer order yet)
      elementMap.forEach((element) => {
        sortedElements.push(element);
      });

      return sortedElements;
    },
    [layerState.translatedLayerOrder, elementCollections]
  );

  // Helper functions for layer position checks
  const isElementAtFront = useCallback(
    (elementId: string, currentView: ViewMode) => {
      const layerOrder = getCurrentLayerOrder(currentView);
      return (
        layerOrder.length > 0 && layerOrder[layerOrder.length - 1] === elementId
      );
    },
    [getCurrentLayerOrder]
  );

  const isElementAtBack = useCallback(
    (elementId: string, currentView: ViewMode) => {
      const layerOrder = getCurrentLayerOrder(currentView);
      return layerOrder.length > 0 && layerOrder[0] === elementId;
    },
    [getCurrentLayerOrder]
  );

  // Untranslated texts management
  const addUntranslatedText = useCallback(
    (untranslatedText: UntranslatedText) => {
      setElementCollections((prev) => ({
        ...prev,
        untranslatedTexts: [...prev.untranslatedTexts, untranslatedText],
      }));
    },
    []
  );

  const updateUntranslatedText = useCallback(
    (id: string, updates: Partial<UntranslatedText>) => {
      setElementCollections((prev) => ({
        ...prev,
        untranslatedTexts: prev.untranslatedTexts.map((text) =>
          text.id === id ? { ...text, ...updates } : text
        ),
      }));
    },
    []
  );

  const deleteUntranslatedText = useCallback((id: string) => {
    setElementCollections((prev) => ({
      ...prev,
      untranslatedTexts: prev.untranslatedTexts.filter((text) => text.id !== id),
    }));
  }, []);

  const getUntranslatedTextByTranslatedId = useCallback(
    (translatedTextboxId: string) => {
      return elementCollections.untranslatedTexts.find(
        (text) => text.translatedTextboxId === translatedTextboxId
      );
    },
    [elementCollections.untranslatedTexts]
  );

  return {
    elementCollections,
    setElementCollections,
    layerState,
    setLayerState,
    // Helper functions
    getCurrentTextBoxes,
    getCurrentShapes,
    getCurrentImages,
    getCurrentDeletionRectangles,
    getCurrentLayerOrder,
    getSortedElements,
    getOriginalSortedElements,
    getTranslatedSortedElements,
    // Layer management
    addToLayerOrder,
    removeFromLayerOrder,
    moveToFront,
    moveToBack,
    moveForward,
    moveBackward,
    isElementAtFront,
    isElementAtBack,
    // Element creation
    addTextBox,
    duplicateTextBox,
    addShape,
    addImage,
    addDeletionRectangle,
    // Element updates
    updateTextBox,
    updateShape,
    updateImage,
    // Element deletion
    deleteTextBox,
    deleteShape,
    deleteImage,
    deleteDeletionRectangle,
    // Untranslated texts management
    addUntranslatedText,
    updateUntranslatedText,
    deleteUntranslatedText,
    getUntranslatedTextByTranslatedId,
  };
};
