// NOTE: All element mutations (add, update, delete, move, etc.) should be wrapped in Command objects and pushed to the undo/redo history using useHistory.
// See useHistory.ts and commands.ts for details.
import { useState, useCallback, useMemo, useEffect } from "react";
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
      finalLayoutTextboxes: [],
      finalLayoutShapes: [],
      finalLayoutDeletionRectangles: [],
      finalLayoutImages: [],
    });

  // Layer order state
  const [layerState, setLayerState] = useState<LayerState>({
    originalLayerOrder: [],
    translatedLayerOrder: [],
    finalLayoutLayerOrder: [],
  });

  // Helper functions to get current arrays based on view
  const getCurrentTextBoxes = useCallback(
    (currentView: ViewMode) => {
      return currentView === "original"
        ? elementCollections.originalTextBoxes
        : currentView === "translated"
        ? elementCollections.translatedTextBoxes
        : elementCollections.finalLayoutTextboxes;
    },
    [elementCollections]
  );

  const getCurrentShapes = useCallback(
    (currentView: ViewMode) => {
      return currentView === "original"
        ? elementCollections.originalShapes
        : currentView === "translated"
        ? elementCollections.translatedShapes
        : elementCollections.finalLayoutShapes;
    },
    [elementCollections]
  );

  const getCurrentImages = useCallback(
    (currentView: ViewMode) => {
      return currentView === "original"
        ? elementCollections.originalImages
        : currentView === "translated"
        ? elementCollections.translatedImages
        : elementCollections.finalLayoutImages;
    },
    [elementCollections]
  );

  const getCurrentDeletionRectangles = useCallback(
    (currentView: ViewMode) => {
      return currentView === "original"
        ? elementCollections.originalDeletionRectangles
        : currentView === "translated"
        ? elementCollections.translatedDeletionRectangles
        : elementCollections.finalLayoutDeletionRectangles;
    },
    [elementCollections]
  );

  const getCurrentLayerOrder = useCallback(
    (currentView: ViewMode) => {
      return currentView === "original"
        ? layerState.originalLayerOrder
        : currentView === "translated"
        ? layerState.translatedLayerOrder
        : layerState.finalLayoutLayerOrder;
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
        } else if (currentView === "translated") {
          return {
            ...prev,
            translatedLayerOrder: [...prev.translatedLayerOrder, elementId],
          };
        } else {
          // For final-layout view
          return {
            ...prev,
            finalLayoutLayerOrder: [...prev.finalLayoutLayerOrder, elementId],
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
        } else if (currentView === "translated") {
          return {
            ...prev,
            translatedLayerOrder: prev.translatedLayerOrder.filter(
              (id) => id !== elementId
            ),
          };
        } else {
          return {
            ...prev,
            finalLayoutLayerOrder: prev.finalLayoutLayerOrder.filter(
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
            : currentView === "translated"
            ? prev.translatedLayerOrder
            : prev.finalLayoutLayerOrder;

        const filtered = layerOrder.filter((id) => id !== elementId);
        const newOrder = [...filtered, elementId];

        if (currentView === "original") {
          return { ...prev, originalLayerOrder: newOrder };
        } else if (currentView === "translated") {
          return { ...prev, translatedLayerOrder: newOrder };
        } else {
          return { ...prev, finalLayoutLayerOrder: newOrder };
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
          : currentView === "translated"
          ? prev.translatedLayerOrder
          : prev.finalLayoutLayerOrder;

      const filtered = layerOrder.filter((id) => id !== elementId);
      const newOrder = [elementId, ...filtered];

      if (currentView === "original") {
        return { ...prev, originalLayerOrder: newOrder };
      } else if (currentView === "translated") {
        return { ...prev, translatedLayerOrder: newOrder };
      } else {
        return { ...prev, finalLayoutLayerOrder: newOrder };
      }
    });
  }, []);

  const moveForward = useCallback(
    (elementId: string, currentView: ViewMode) => {
      setLayerState((prev) => {
        const layerOrder =
          currentView === "original"
            ? prev.originalLayerOrder
            : currentView === "translated"
            ? prev.translatedLayerOrder
            : prev.finalLayoutLayerOrder;

        const index = layerOrder.indexOf(elementId);
        if (index === -1 || index === layerOrder.length - 1) return prev;

        const newOrder = [...layerOrder];
        [newOrder[index], newOrder[index + 1]] = [
          newOrder[index + 1],
          newOrder[index],
        ];

        if (currentView === "original") {
          return { ...prev, originalLayerOrder: newOrder };
        } else if (currentView === "translated") {
          return { ...prev, translatedLayerOrder: newOrder };
        } else {
          return { ...prev, finalLayoutLayerOrder: newOrder };
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
            : currentView === "translated"
            ? prev.translatedLayerOrder
            : prev.finalLayoutLayerOrder;

        const index = layerOrder.indexOf(elementId);
        if (index <= 0) return prev;

        const newOrder = [...layerOrder];
        [newOrder[index], newOrder[index - 1]] = [
          newOrder[index - 1],
          newOrder[index],
        ];

        if (currentView === "original") {
          return { ...prev, originalLayerOrder: newOrder };
        } else if (currentView === "translated") {
          return { ...prev, translatedLayerOrder: newOrder };
        } else {
          return { ...prev, finalLayoutLayerOrder: newOrder };
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
      targetView?: "original" | "translated" | "final-layout",
      initialProperties?: Partial<TextField>
    ) => {
      // For OCR-generated textboxes, empty string should remain empty to show placeholder
      // For manually added textboxes, use "New Text Field" as default
      const value =
        initialProperties?.value !== undefined
          ? initialProperties.value
          : "New Text Field";
      const fontSize = initialProperties?.fontSize || 8;
      const fontFamily = initialProperties?.fontFamily || "Arial, sans-serif";
      // Use provided ID if available, otherwise generate new one
      const fieldId = initialProperties?.id || generateUUID();

      // Check if ID already exists to prevent duplicates
      const existingTextBoxes = [
        ...elementCollections.originalTextBoxes,
        ...elementCollections.translatedTextBoxes,
        ...elementCollections.finalLayoutTextboxes, // Add final layout textboxes
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

      // Add buffer width to the textbox by including padding
      const bufferWidth = 10; // 20px buffer on each side
      const { width, height } = measureText(
        value,
        fontSize,
        fontFamily,
        0, // characterSpacing
        undefined, // maxWidth
        {
          left: bufferWidth,
          right: bufferWidth,
          top: 4,
          bottom: 4,
        }
      );

      const newTextBox: TextField = {
        id: fieldId,
        x,
        y,
        width: initialProperties?.width || width,
        height: initialProperties?.height || height,
        value,
        placeholder:
          initialProperties?.placeholder ||
          (value.trim() === "" ? "Enter Text..." : ""),
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

      const shouldAddToFinalLayout =
        currentView === "final-layout" || targetView === "final-layout";

      setElementCollections((prev) => {
        if (shouldAddToFinalLayout) {
          return {
            ...prev,
            finalLayoutTextboxes: [...prev.finalLayoutTextboxes, newTextBox],
          };
        } else if (shouldAddToTranslated) {
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
        shouldAddToFinalLayout
          ? "final-layout"
          : shouldAddToTranslated
          ? "translated"
          : "original"
      );

      return fieldId;
    },
    [addToLayerOrder]
  );

  const duplicateTextBox = useCallback(
    (originalId: string, currentView: ViewMode) => {
      // Find the original textbox from all collections
      const allTextBoxes = [
        ...elementCollections.originalTextBoxes,
        ...elementCollections.translatedTextBoxes,
        ...elementCollections.finalLayoutTextboxes, // Add final layout textboxes
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
      const isOriginalInOriginalView =
        elementCollections.originalTextBoxes.some((tb) => tb.id === originalId);

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
            translatedTextBoxes: [
              ...prev.translatedTextBoxes,
              duplicateTextBox,
            ],
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
      type: "circle" | "rectangle" | "line",
      x: number,
      y: number,
      width: number,
      height: number,
      currentPage: number,
      currentView: ViewMode,
      targetView?: "original" | "translated" | "final-layout",
      // Line-specific parameters
      x1?: number,
      y1?: number,
      x2?: number,
      y2?: number
    ) => {
      const newShape: Shape = {
        id: generateUUID(),
        type,
        x: type === "line" ? 0 : x, // For lines, bounding box position is calculated from coordinates
        y: type === "line" ? 0 : y,
        width: type === "line" ? 0 : width, // For lines, dimensions are calculated from coordinates
        height: type === "line" ? 0 : height,
        page: currentPage,
        borderColor: "#000000",
        borderWidth: 1, // Set to 1px for all shapes including lines
        fillColor: "#ffffff",
        fillOpacity: type === "line" ? 0 : 0.5, // Lines don't need fill
        rotation: 0,
        borderRadius: type === "rectangle" ? 0 : undefined,
        // Line-specific coordinates
        ...(type === "line" &&
        x1 !== undefined &&
        y1 !== undefined &&
        x2 !== undefined &&
        y2 !== undefined
          ? {
              x1,
              y1,
              x2,
              y2,
            }
          : {}),
      };

      const shouldAddToTranslated =
        currentView === "split"
          ? targetView === "translated"
          : currentView === "translated";

      const shouldAddToFinalLayout =
        currentView === "final-layout" || targetView === "final-layout";

      setElementCollections((prev) => {
        if (shouldAddToFinalLayout) {
          return {
            ...prev,
            finalLayoutShapes: [...prev.finalLayoutShapes, newShape],
          };
        } else if (shouldAddToTranslated) {
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
        shouldAddToFinalLayout
          ? "final-layout"
          : shouldAddToTranslated
          ? "translated"
          : "original"
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
      currentView: ViewMode,
      supabaseMetadata?: {
        isSupabaseUrl?: boolean;
        filePath?: string;
        fileName?: string;
        fileObjectId?: string;
      }
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
        // Add Supabase metadata if provided
        isSupabaseUrl: supabaseMetadata?.isSupabaseUrl,
        filePath: supabaseMetadata?.filePath,
        fileName: supabaseMetadata?.fileName,
        fileObjectId: supabaseMetadata?.fileObjectId,
      };

      setElementCollections((prev) => {
        if (currentView === "translated") {
          return {
            ...prev,
            translatedImages: [...prev.translatedImages, newImage],
          };
        } else if (currentView === "final-layout") {
          return {
            ...prev,
            finalLayoutImages: [...prev.finalLayoutImages, newImage],
          };
        } else {
          return {
            ...prev,
            originalImages: [...prev.originalImages, newImage],
          };
        }
      });

      addToLayerOrder(newImage.id, currentView);

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
        } else if (currentView === "final-layout") {
          return {
            ...prev,
            finalLayoutDeletionRectangles: [
              ...prev.finalLayoutDeletionRectangles,
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
        finalLayoutTextboxes: prev.finalLayoutTextboxes.map((box) =>
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
      finalLayoutShapes: prev.finalLayoutShapes.map((shape) =>
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
      finalLayoutImages: prev.finalLayoutImages.map((image) =>
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
        } else if (currentView === "final-layout") {
          return {
            ...prev,
            finalLayoutTextboxes: prev.finalLayoutTextboxes.filter(
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

  // Restore textbox with its original ID and properties
  const restoreTextBox = useCallback(
    (textBox: TextField, currentView: ViewMode) => {
      console.log(
        "[ElementManagement] Restoring textbox:",
        textBox,
        "to view:",
        currentView
      );

      setElementCollections((prev) => {
        // Check if textbox already exists in the current state
        const existingTextBoxes = [
          ...prev.originalTextBoxes,
          ...prev.translatedTextBoxes,
          ...prev.finalLayoutTextboxes,
        ];

        if (existingTextBoxes.some((tb) => tb.id === textBox.id)) {
          console.warn(
            "[ElementManagement] Textbox already exists:",
            textBox.id,
            "- skipping restore"
          );
          return prev; // Return unchanged state
        }

        console.log(
          "[ElementManagement] Actually restoring textbox:",
          textBox.id
        );

        if (currentView === "translated") {
          return {
            ...prev,
            translatedTextBoxes: [...prev.translatedTextBoxes, textBox],
          };
        } else if (currentView === "final-layout") {
          return {
            ...prev,
            finalLayoutTextboxes: [...prev.finalLayoutTextboxes, textBox],
          };
        } else {
          return {
            ...prev,
            originalTextBoxes: [...prev.originalTextBoxes, textBox],
          };
        }
      });

      addToLayerOrder(textBox.id, currentView);
    },
    [addToLayerOrder]
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
        } else if (currentView === "final-layout") {
          return {
            ...prev,
            finalLayoutShapes: prev.finalLayoutShapes.filter(
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

  // Restore shape with its original ID and properties
  const restoreShape = useCallback(
    (shape: Shape, currentView: ViewMode) => {
      console.log(
        "[ElementManagement] Restoring shape:",
        shape,
        "to view:",
        currentView
      );

      setElementCollections((prev) => {
        // Check if shape already exists in the current state
        const existingShapes = [
          ...prev.originalShapes,
          ...prev.translatedShapes,
          ...prev.finalLayoutShapes,
        ];

        if (existingShapes.some((s) => s.id === shape.id)) {
          console.warn(
            "[ElementManagement] Shape already exists:",
            shape.id,
            "- skipping restore"
          );
          return prev; // Return unchanged state
        }

        console.log("[ElementManagement] Actually restoring shape:", shape.id);

        if (currentView === "translated") {
          return {
            ...prev,
            translatedShapes: [...prev.translatedShapes, shape],
          };
        } else if (currentView === "final-layout") {
          return {
            ...prev,
            finalLayoutShapes: [...prev.finalLayoutShapes, shape],
          };
        } else {
          return {
            ...prev,
            originalShapes: [...prev.originalShapes, shape],
          };
        }
      });

      addToLayerOrder(shape.id, currentView);
    },
    [addToLayerOrder]
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
        } else if (currentView === "final-layout") {
          return {
            ...prev,
            finalLayoutImages: prev.finalLayoutImages.filter(
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

  // Restore image with its original ID and properties
  const restoreImage = useCallback(
    (image: Image, currentView: ViewMode) => {
      console.log(
        "[ElementManagement] Restoring image:",
        image,
        "to view:",
        currentView
      );

      setElementCollections((prev) => {
        // Check if image already exists in the current state
        const existingImages = [
          ...prev.originalImages,
          ...prev.translatedImages,
          ...prev.finalLayoutImages,
        ];

        if (existingImages.some((img) => img.id === image.id)) {
          console.warn(
            "[ElementManagement] Image already exists:",
            image.id,
            "- skipping restore"
          );
          return prev; // Return unchanged state
        }

        console.log("[ElementManagement] Actually restoring image:", image.id);

        if (currentView === "translated") {
          return {
            ...prev,
            translatedImages: [...prev.translatedImages, image],
          };
        } else if (currentView === "final-layout") {
          return {
            ...prev,
            finalLayoutImages: [...prev.finalLayoutImages, image],
          };
        } else {
          return {
            ...prev,
            originalImages: [...prev.originalImages, image],
          };
        }
      });

      addToLayerOrder(image.id, currentView);
    },
    [addToLayerOrder]
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
        } else if (currentView === "final-layout") {
          return {
            ...prev,
            finalLayoutDeletionRectangles:
              prev.finalLayoutDeletionRectangles.filter(
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

  // Restore deletion rectangle with its original ID and properties
  const restoreDeletionRectangle = useCallback(
    (rect: DeletionRectangle, currentView: ViewMode) => {
      console.log(
        "[ElementManagement] Restoring deletion rectangle:",
        rect,
        "to view:",
        currentView
      );

      setElementCollections((prev) => {
        // Check if rect already exists in the current state
        const existingRects = [
          ...prev.originalDeletionRectangles,
          ...prev.translatedDeletionRectangles,
          ...prev.finalLayoutDeletionRectangles,
        ];

        if (existingRects.some((r) => r.id === rect.id)) {
          console.warn(
            "[ElementManagement] Deletion rectangle already exists:",
            rect.id,
            "- skipping restore"
          );
          return prev; // Return unchanged state
        }

        console.log(
          "[ElementManagement] Actually restoring deletion rectangle:",
          rect.id
        );

        if (currentView === "translated") {
          return {
            ...prev,
            translatedDeletionRectangles: [
              ...prev.translatedDeletionRectangles,
              rect,
            ],
          };
        } else if (currentView === "final-layout") {
          return {
            ...prev,
            finalLayoutDeletionRectangles: [
              ...prev.finalLayoutDeletionRectangles,
              rect,
            ],
          };
        } else {
          return {
            ...prev,
            originalDeletionRectangles: [
              ...prev.originalDeletionRectangles,
              rect,
            ],
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

  // Get sorted elements for final layout
  const getFinalLayoutSortedElements = useCallback(
    (currentPage: number): SortedElement[] => {
      const layerOrder = layerState.finalLayoutLayerOrder;
      const textBoxes = elementCollections.finalLayoutTextboxes.filter(
        (box) => box.page === currentPage
      );
      const shapes = elementCollections.finalLayoutShapes.filter(
        (shape) => shape.page === currentPage
      );
      const images = elementCollections.finalLayoutImages.filter(
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
    [layerState.finalLayoutLayerOrder, elementCollections]
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
      console.log(`📝 [useElementManagement] Adding untranslated text:`, {
        id: untranslatedText.id,
        translatedTextboxId: untranslatedText.translatedTextboxId,
        originalText:
          untranslatedText.originalText?.substring(0, 50) +
          (untranslatedText.originalText?.length > 50 ? "..." : ""),
        page: untranslatedText.page,
        status: untranslatedText.status,
        isCustomTextbox: untranslatedText.isCustomTextbox,
        position: `(${untranslatedText.x}, ${untranslatedText.y})`,
        dimensions: `${untranslatedText.width}x${untranslatedText.height}`,
      });

      setElementCollections((prev) => {
        const newState = {
          ...prev,
          untranslatedTexts: [...prev.untranslatedTexts, untranslatedText],
        };

        console.log(
          `📊 [useElementManagement] untranslatedTexts collection updated:`,
          {
            previousCount: prev.untranslatedTexts.length,
            newCount: newState.untranslatedTexts.length,
            totalElements: newState.untranslatedTexts.length,
          }
        );

        return newState;
      });
    },
    []
  );

  const updateUntranslatedText = useCallback(
    (id: string, updates: Partial<UntranslatedText>) => {
      console.log(`📝 [useElementManagement] Updating untranslated text:`, {
        id,
        updates,
        updateKeys: Object.keys(updates),
      });

      setElementCollections((prev) => {
        const textIndex = prev.untranslatedTexts.findIndex(
          (text) => text.id === id
        );
        if (textIndex === -1) {
          console.warn(
            `⚠️ [useElementManagement] Untranslated text with id ${id} not found for update`
          );
          return prev;
        }

        const updatedText = {
          ...prev.untranslatedTexts[textIndex],
          ...updates,
        };
        const newState = {
          ...prev,
          untranslatedTexts: prev.untranslatedTexts.map((text) =>
            text.id === id ? updatedText : text
          ),
        };

        console.log(`📊 [useElementManagement] untranslatedText updated:`, {
          id,
          previousStatus: prev.untranslatedTexts[textIndex].status,
          newStatus: updatedText.status,
          previousText:
            prev.untranslatedTexts[textIndex].originalText?.substring(0, 30) +
            (prev.untranslatedTexts[textIndex].originalText?.length > 30
              ? "..."
              : ""),
          newText:
            updatedText.originalText?.substring(0, 30) +
            (updatedText.originalText?.length > 30 ? "..." : ""),
        });

        return newState;
      });
    },
    []
  );

  const deleteUntranslatedText = useCallback((id: string) => {
    console.log(`📝 [useElementManagement] Deleting untranslated text:`, {
      id,
    });

    setElementCollections((prev) => {
      const textToDelete = prev.untranslatedTexts.find(
        (text) => text.id === id
      );
      if (!textToDelete) {
        console.warn(
          `⚠️ [useElementManagement] Untranslated text with id ${id} not found for deletion`
        );
        return prev;
      }

      const newState = {
        ...prev,
        untranslatedTexts: prev.untranslatedTexts.filter(
          (text) => text.id !== id
        ),
      };

      console.log(`📊 [useElementManagement] untranslatedText deleted:`, {
        id,
        deletedText:
          textToDelete.originalText?.substring(0, 30) +
          (textToDelete.originalText?.length > 30 ? "..." : ""),
        previousCount: prev.untranslatedTexts.length,
        newCount: newState.untranslatedTexts.length,
      });

      return newState;
    });
  }, []);

  const getUntranslatedTextByTranslatedId = useCallback(
    (translatedTextboxId: string) => {
      const untranslatedText = elementCollections.untranslatedTexts.find(
        (text) => text.translatedTextboxId === translatedTextboxId
      );

      console.log(
        `🔍 [useElementManagement] Looking up untranslated text for translated textbox:`,
        {
          translatedTextboxId,
          found: !!untranslatedText,
          untranslatedTextId: untranslatedText?.id || "NOT_FOUND",
          originalText: untranslatedText?.originalText
            ? untranslatedText.originalText.substring(0, 30) +
              (untranslatedText.originalText.length > 30 ? "..." : "")
            : "NOT_FOUND",
          status: untranslatedText?.status || "NOT_FOUND",
        }
      );

      return untranslatedText;
    },
    [elementCollections.untranslatedTexts]
  );

  // Helper functions to get current state of elements
  const getCurrentTextBoxState = useCallback(
    (id: string): TextField | undefined => {
      return [
        ...elementCollections.originalTextBoxes,
        ...elementCollections.translatedTextBoxes,
        ...elementCollections.finalLayoutTextboxes,
      ].find((tb) => tb.id === id);
    },
    [elementCollections]
  );

  const getCurrentShapeState = useCallback(
    (id: string): Shape | undefined => {
      return [
        ...elementCollections.originalShapes,
        ...elementCollections.translatedShapes,
        ...elementCollections.finalLayoutShapes,
      ].find((shape) => shape.id === id);
    },
    [elementCollections]
  );

  const getCurrentImageState = useCallback(
    (id: string): Image | undefined => {
      return [
        ...elementCollections.originalImages,
        ...elementCollections.translatedImages,
        ...elementCollections.finalLayoutImages,
      ].find((img) => img.id === id);
    },
    [elementCollections]
  );

  // Log untranslatedTexts collection changes
  useEffect(() => {
    if (elementCollections.untranslatedTexts.length > 0) {
      console.log(
        `📊 [useElementManagement] untranslatedTexts collection summary:`,
        {
          totalCount: elementCollections.untranslatedTexts.length,
          byPage: elementCollections.untranslatedTexts.reduce((acc, text) => {
            acc[text.page] = (acc[text.page] || 0) + 1;
            return acc;
          }, {} as Record<number, number>),
          byStatus: elementCollections.untranslatedTexts.reduce((acc, text) => {
            acc[text.status] = (acc[text.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          customTextboxes: elementCollections.untranslatedTexts.filter(
            (text) => text.isCustomTextbox
          ).length,
          ocrDetected: elementCollections.untranslatedTexts.filter(
            (text) => !text.isCustomTextbox
          ).length,
        }
      );
    } else {
      console.log(
        `📊 [useElementManagement] untranslatedTexts collection is empty`
      );
    }
  }, [elementCollections.untranslatedTexts]);

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
    getFinalLayoutSortedElements,
    getCurrentTextBoxState,
    getCurrentShapeState,
    getCurrentImageState,
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
    // Element restoration (for undo)
    restoreTextBox,
    restoreShape,
    restoreImage,
    restoreDeletionRectangle,
    // Untranslated texts management
    addUntranslatedText,
    updateUntranslatedText,
    deleteUntranslatedText,
    getUntranslatedTextByTranslatedId,
  };
};
