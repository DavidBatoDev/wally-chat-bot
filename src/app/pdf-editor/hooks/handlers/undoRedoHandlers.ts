import { useCallback } from "react";
import {
  TextField,
  ViewMode,
  Shape as ShapeType,
  Image as ImageType,
  DeletionRectangle,
} from "../../types/pdf-editor.types";
import {
  AddTextBoxCommand,
  UpdateTextBoxCommand,
  DeleteTextBoxCommand,
  AddShapeCommand,
  UpdateShapeCommand,
  DeleteShapeCommand,
  AddImageCommand,
  UpdateImageCommand,
  DeleteImageCommand,
  AddDeletionRectangleCommand,
  DeleteDeletionRectangleCommand,
  MultiDeleteCommand,
  MultiMoveCommand,
} from "./commands";

// Handler for adding a text box with undo support
export function useHandleAddTextBoxWithUndo(
  addTextBox: (
    x: number,
    y: number,
    page: number,
    view: ViewMode,
    targetView?: "original" | "translated" | "final-layout",
    initialProperties?: Partial<TextField>
  ) => string,
  deleteTextBox: (id: string, view: ViewMode) => void,
  history: any,
  elementCollections: any
) {
  return useCallback(
    (
      x: number,
      y: number,
      page: number,
      view: ViewMode,
      targetView?: "original" | "translated" | "final-layout",
      initialProperties?: Partial<TextField>
    ) => {
      // Create text box data
      const textBoxData: TextField = {
        id: "", // Will be assigned by addTextBox
        x,
        y,
        page,
        width: initialProperties?.width || 100,
        height: initialProperties?.height || 30,
        value: initialProperties?.value || "New Text Field",
        fontSize: initialProperties?.fontSize || 8,
        fontFamily: initialProperties?.fontFamily || "Arial, sans-serif",
        color: initialProperties?.color || "#000000",
        backgroundColor: initialProperties?.backgroundColor || "#ffffff",
        bold: initialProperties?.bold || false,
        italic: initialProperties?.italic || false,
        underline: initialProperties?.underline || false,
        textAlign: initialProperties?.textAlign || "left",
        letterSpacing: initialProperties?.letterSpacing || 0,
        lineHeight: initialProperties?.lineHeight || 1.1,
        ...initialProperties,
      };

      // Create functions for command
      const addFunc = (tb: TextField) => {
        const id = addTextBox(tb.x, tb.y, tb.page, view, targetView, tb);
        tb.id = id;
        return id;
      };

      const deleteFunc = (id: string) => {
        deleteTextBox(id, targetView || view);
      };

      const command = new AddTextBoxCommand(addFunc, deleteFunc, textBoxData);
      history.executeCommand(command);

      return textBoxData.id;
    },
    [addTextBox, deleteTextBox, history]
  );
}

// Handler for duplicating a text box with undo support
export function useHandleDuplicateTextBoxWithUndo(
  duplicateTextBox: (
    originalId: string,
    currentView: ViewMode
  ) => string | null,
  deleteTextBox: (id: string, view: ViewMode) => void,
  history: any,
  elementCollections: any
) {
  return useCallback(
    (originalId: string, currentView: ViewMode, page: number) => {
      // Find original text box
      const allTextBoxes = [
        ...elementCollections.originalTextBoxes,
        ...elementCollections.translatedTextBoxes,
        ...elementCollections.finalLayoutTextboxes,
      ];
      const originalTextBox = allTextBoxes.find(
        (tb: any) => tb.id === originalId
      );

      if (!originalTextBox) return null;

      // Create duplicate data with offset
      const duplicateData: TextField = {
        ...originalTextBox,
        id: "", // Will be assigned
        x: originalTextBox.x + 20,
        y: originalTextBox.y + 20,
      };

      const addFunc = (tb: TextField) => {
        const id = duplicateTextBox(originalId, currentView);
        if (id) tb.id = id;
        return id || "";
      };

      const deleteFunc = (id: string) => {
        deleteTextBox(id, currentView);
      };

      const command = new AddTextBoxCommand(addFunc, deleteFunc, duplicateData);
      history.executeCommand(command);

      return duplicateData.id;
    },
    [duplicateTextBox, deleteTextBox, history, elementCollections]
  );
}

// Handler for updating a text box with undo support
export function useHandleUpdateTextBoxWithUndo(
  updateTextBox: (id: string, updates: Partial<TextField>) => void,
  history: any
) {
  return useCallback(
    (
      id: string,
      before: Partial<TextField>,
      after: Partial<TextField>,
      isOngoingOperation = false
    ) => {
      const command = new UpdateTextBoxCommand(
        updateTextBox,
        id,
        before,
        after
      );

      if (isOngoingOperation && !history.isBatching()) {
        // Start batch for ongoing operations if not already batching
        history.startBatch("Update text box");
      }

      // Always use executeCommand which handles both execution and history
      history.executeCommand(command);

      if (!isOngoingOperation && history.isBatching()) {
        // End batch when operation completes
        history.endBatch();
      }
    },
    [updateTextBox, history]
  );
}

// Generic update text box wrapper
export function useUpdateTextBoxWithUndo(
  updateTextBox: any,
  handleUpdateTextBoxWithUndo: any,
  getCurrentTextBoxState: any,
  documentState: any,
  viewState: any,
  history: any
) {
  return useCallback(
    (id: string, updates: Partial<TextField>, isOngoingOperation = false) => {
      const currentState = getCurrentTextBoxState(id);

      if (currentState) {
        const before: Partial<TextField> = {};
        const after: Partial<TextField> = {};

        Object.keys(updates).forEach((key) => {
          const k = key as keyof TextField;
          if (currentState[k] !== updates[k]) {
            before[k] = currentState[k] as any;
            after[k] = updates[k] as any;
          }
        });

        if (Object.keys(after).length > 0) {
          // Handle batching for ongoing operations
          if (isOngoingOperation && !history.isBatching()) {
            history.startBatch("Move elements");
          } else if (!isOngoingOperation && history.isBatching()) {
            history.endBatch();
          }

          handleUpdateTextBoxWithUndo(id, before, after, isOngoingOperation);
        }
      }
    },
    [
      getCurrentTextBoxState,
      handleUpdateTextBoxWithUndo,
      documentState,
      viewState,
      history,
    ]
  );
}

// View-specific update handlers
export function useUpdateOriginalTextBoxWithUndo(
  updateTextBox: any,
  handleUpdateTextBoxWithUndo: any,
  getCurrentTextBoxState: any,
  documentState: any,
  history: any
) {
  return useCallback(
    (id: string, updates: Partial<TextField>, isOngoingOperation = false) => {
      const currentState = getCurrentTextBoxState(id);
      if (currentState) {
        const before: Partial<TextField> = {};
        const after: Partial<TextField> = {};

        Object.keys(updates).forEach((key) => {
          const k = key as keyof TextField;
          if (currentState[k] !== updates[k]) {
            before[k] = currentState[k] as any;
            after[k] = updates[k] as any;
          }
        });

        if (Object.keys(after).length > 0) {
          if (isOngoingOperation && !history.isBatching()) {
            history.startBatch("Move elements");
          } else if (!isOngoingOperation && history.isBatching()) {
            history.endBatch();
          }

          handleUpdateTextBoxWithUndo(id, before, after, isOngoingOperation);
        }
      }
    },
    [
      getCurrentTextBoxState,
      handleUpdateTextBoxWithUndo,
      documentState,
      history,
    ]
  );
}

export function useUpdateTranslatedTextBoxWithUndo(
  updateTextBox: any,
  handleUpdateTextBoxWithUndo: any,
  getCurrentTextBoxState: any,
  documentState: any,
  history: any
) {
  return useCallback(
    (id: string, updates: Partial<TextField>, isOngoingOperation = false) => {
      const currentState = getCurrentTextBoxState(id);
      if (currentState) {
        const before: Partial<TextField> = {};
        const after: Partial<TextField> = {};

        Object.keys(updates).forEach((key) => {
          const k = key as keyof TextField;
          if (currentState[k] !== updates[k]) {
            before[k] = currentState[k] as any;
            after[k] = updates[k] as any;
          }
        });

        if (Object.keys(after).length > 0) {
          if (isOngoingOperation && !history.isBatching()) {
            history.startBatch("Move elements");
          } else if (!isOngoingOperation && history.isBatching()) {
            history.endBatch();
          }

          handleUpdateTextBoxWithUndo(id, before, after, isOngoingOperation);
        }
      }
    },
    [
      getCurrentTextBoxState,
      handleUpdateTextBoxWithUndo,
      documentState,
      history,
    ]
  );
}

export function useUpdateFinalLayoutTextBoxWithUndo(
  updateTextBox: any,
  handleUpdateTextBoxWithUndo: any,
  getCurrentTextBoxState: any,
  documentState: any,
  history: any
) {
  return useCallback(
    (id: string, updates: Partial<TextField>, isOngoingOperation = false) => {
      const currentState = getCurrentTextBoxState(id);
      if (currentState) {
        const before: Partial<TextField> = {};
        const after: Partial<TextField> = {};

        Object.keys(updates).forEach((key) => {
          const k = key as keyof TextField;
          if (currentState[k] !== updates[k]) {
            before[k] = currentState[k] as any;
            after[k] = updates[k] as any;
          }
        });

        if (Object.keys(after).length > 0) {
          if (isOngoingOperation && !history.isBatching()) {
            history.startBatch("Move elements");
          } else if (!isOngoingOperation && history.isBatching()) {
            history.endBatch();
          }

          handleUpdateTextBoxWithUndo(id, before, after, isOngoingOperation);
        }
      }
    },
    [
      getCurrentTextBoxState,
      handleUpdateTextBoxWithUndo,
      documentState,
      history,
    ]
  );
}

// Handler for adding a shape with undo support
export function useHandleAddShapeWithUndo(
  addShape: any,
  deleteShape: any,
  history: any
) {
  return useCallback(
    (
      type: "circle" | "rectangle" | "line",
      x: number,
      y: number,
      width: number,
      height: number,
      page: number,
      view: ViewMode,
      targetView?: ViewMode,
      x1?: number,
      y1?: number,
      x2?: number,
      y2?: number
    ) => {
      const shapeData: ShapeType = {
        id: "",
        type,
        x,
        y,
        width,
        height,
        page,
        borderColor: "#000000",
        borderWidth: 1,
        fillColor: "#ffffff",
        fillOpacity: type === "line" ? 0 : 0.5,
        rotation: 0,
        ...(type === "line" &&
        x1 !== undefined &&
        y1 !== undefined &&
        x2 !== undefined &&
        y2 !== undefined
          ? { x1, y1, x2, y2 }
          : {}),
      };

      const addFunc = (shape: ShapeType) => {
        const id = addShape(
          type,
          x,
          y,
          width,
          height,
          page,
          view,
          targetView,
          x1,
          y1,
          x2,
          y2
        );
        shape.id = id;
        return id;
      };

      const deleteFunc = (id: string) => {
        deleteShape(id, targetView || view);
      };

      const command = new AddShapeCommand(addFunc, deleteFunc, shapeData);
      history.executeCommand(command);

      return shapeData.id;
    },
    [addShape, deleteShape, history]
  );
}

// Handler for updating a shape with undo support
export function useHandleUpdateShapeWithUndo(updateShape: any, history: any) {
  return useCallback(
    (
      id: string,
      before: Partial<ShapeType>,
      after: Partial<ShapeType>,
      isOngoingOperation = false
    ) => {
      const command = new UpdateShapeCommand(updateShape, id, before, after);

      if (isOngoingOperation && !history.isBatching()) {
        history.startBatch("Update shape");
      }

      history.executeCommand(command);

      if (!isOngoingOperation && history.isBatching()) {
        history.endBatch();
      }
    },
    [updateShape, history]
  );
}

// Generic update shape wrapper
export function useUpdateShapeWithUndo(
  updateShape: any,
  handleUpdateShapeWithUndo: any,
  getCurrentShapeState: any,
  elementCollections: any,
  history: any
) {
  return useCallback(
    (id: string, updates: Partial<ShapeType>, isOngoingOperation = false) => {
      const currentState = getCurrentShapeState(id);

      if (currentState) {
        const before: Partial<ShapeType> = {};
        const after: Partial<ShapeType> = {};

        Object.keys(updates).forEach((key) => {
          const k = key as keyof ShapeType;
          if (currentState[k] !== updates[k]) {
            before[k] = currentState[k] as any;
            after[k] = updates[k] as any;
          }
        });

        if (Object.keys(after).length > 0) {
          if (isOngoingOperation && !history.isBatching()) {
            history.startBatch("Move shape");
          } else if (!isOngoingOperation && history.isBatching()) {
            history.endBatch();
          }

          const allShapes = [
            ...elementCollections.originalShapes,
            ...elementCollections.translatedShapes,
            ...elementCollections.finalLayoutShapes,
          ];
          const shape = allShapes.find((s: any) => s.id === id);

          if (shape) {
            handleUpdateShapeWithUndo(id, before, after, isOngoingOperation);
          }
        }
      }
    },
    [
      getCurrentShapeState,
      handleUpdateShapeWithUndo,
      elementCollections,
      history,
    ]
  );
}

// Handler for deleting a text box with undo support
export function useHandleDeleteTextBoxWithUndo(
  deleteTextBox: any,
  restoreTextBox: any,
  history: any,
  elementCollections: any,
  editorState: any,
  selectedElementId: any,
  clearSelectionState: any
) {
  return useCallback(
    (id: string, view: ViewMode) => {
      const allTextBoxes = [
        ...elementCollections.originalTextBoxes,
        ...elementCollections.translatedTextBoxes,
        ...elementCollections.finalLayoutTextboxes,
      ];
      const textBox = allTextBoxes.find((tb: any) => tb.id === id);

      if (!textBox) return;

      const textBoxView = elementCollections.originalTextBoxes.some(
        (tb: any) => tb.id === id
      )
        ? "original"
        : elementCollections.translatedTextBoxes.some((tb: any) => tb.id === id)
        ? "translated"
        : "final-layout";

      const deleteFunc = (id: string) => {
        console.log(
          "[DeleteTextBox] Deleting textbox",
          id,
          "from view",
          textBoxView
        );
        deleteTextBox(id, textBoxView);
      };

      const restoreFunc = (tb: TextField, view: ViewMode) => {
        console.log(
          "[DeleteTextBox] Restoring textbox",
          tb.id,
          "to view",
          view
        );
        restoreTextBox(tb, view);
      };

      const command = new DeleteTextBoxCommand(
        deleteFunc,
        restoreFunc,
        textBox,
        textBoxView as ViewMode
      );
      history.executeCommand(command);

      if (editorState.selectedFieldId === id || selectedElementId === id) {
        clearSelectionState();
      }
    },
    [
      deleteTextBox,
      restoreTextBox,
      history,
      elementCollections,
      editorState,
      selectedElementId,
      clearSelectionState,
    ]
  );
}

// Handler for deleting a shape with undo support
export function useHandleDeleteShapeWithUndo(
  deleteShape: any,
  restoreShape: any,
  history: any,
  elementCollections: any,
  editorState: any,
  selectedElementId: any,
  clearSelectionState: any
) {
  return useCallback(
    (id: string, view: ViewMode) => {
      const allShapes = [
        ...elementCollections.originalShapes,
        ...elementCollections.translatedShapes,
        ...elementCollections.finalLayoutShapes,
      ];
      const shape = allShapes.find((s: any) => s.id === id);

      if (!shape) return;

      const shapeView = elementCollections.originalShapes.some(
        (s: any) => s.id === id
      )
        ? "original"
        : elementCollections.translatedShapes.some((s: any) => s.id === id)
        ? "translated"
        : "final-layout";

      const deleteFunc = (id: string) => {
        console.log("[DeleteShape] Deleting shape", id, "from view", shapeView);
        deleteShape(id, shapeView);
      };

      const restoreFunc = (s: ShapeType, view: ViewMode) => {
        console.log("[DeleteShape] Restoring shape", s.id, "to view", view);
        restoreShape(s, view);
      };

      const command = new DeleteShapeCommand(
        deleteFunc,
        restoreFunc,
        shape,
        shapeView as ViewMode
      );
      history.executeCommand(command);

      if (editorState.selectedShapeId === id || selectedElementId === id) {
        clearSelectionState();
      }
    },
    [
      deleteShape,
      restoreShape,
      history,
      elementCollections,
      editorState,
      selectedElementId,
      clearSelectionState,
    ]
  );
}

// Handler for adding a deletion rectangle with undo support
export function useHandleAddDeletionRectangleWithUndo(
  addDeletionRectangle: any,
  deleteDeletionRectangle: any,
  history: any
) {
  return useCallback(
    (
      x: number,
      y: number,
      width: number,
      height: number,
      page: number,
      view: ViewMode,
      background: string,
      opacity: number
    ) => {
      const rectData: DeletionRectangle = {
        id: "",
        x,
        y,
        width,
        height,
        page,
        background,
        opacity,
      };

      const addFunc = (rect: DeletionRectangle) => {
        const id = addDeletionRectangle(
          x,
          y,
          width,
          height,
          page,
          view,
          background,
          opacity
        );
        rect.id = id;
        return id;
      };

      const deleteFunc = (id: string) => {
        deleteDeletionRectangle(id, view);
      };

      const command = new AddDeletionRectangleCommand(
        addFunc,
        deleteFunc,
        rectData
      );
      history.executeCommand(command);

      return rectData.id;
    },
    [addDeletionRectangle, deleteDeletionRectangle, history]
  );
}

// Handler for deleting a deletion rectangle with undo support
export function useHandleDeleteDeletionRectangleWithUndo(
  deleteDeletionRectangle: any,
  restoreDeletionRectangle: any,
  history: any,
  elementCollections: any
) {
  return useCallback(
    (id: string, view: ViewMode) => {
      const allRects = [
        ...elementCollections.originalDeletionRectangles,
        ...elementCollections.translatedDeletionRectangles,
        ...elementCollections.finalLayoutDeletionRectangles,
      ];
      const rect = allRects.find((r: any) => r.id === id);

      if (!rect) return;

      const rectView = elementCollections.originalDeletionRectangles.some(
        (r: any) => r.id === id
      )
        ? "original"
        : elementCollections.finalLayoutDeletionRectangles.some(
            (r: any) => r.id === id
          )
        ? "final-layout"
        : "translated";

      const deleteFunc = (id: string) => {
        console.log(
          "[DeleteDeletionRectangle] Deleting rect",
          id,
          "from view",
          rectView
        );
        deleteDeletionRectangle(id, rectView);
      };

      const restoreFunc = (r: DeletionRectangle, view: ViewMode) => {
        console.log(
          "[DeleteDeletionRectangle] Restoring rect",
          r.id,
          "to view",
          view
        );
        restoreDeletionRectangle(r, view);
      };

      const command = new DeleteDeletionRectangleCommand(
        deleteFunc,
        restoreFunc,
        rect,
        rectView as ViewMode
      );
      history.executeCommand(command);
    },
    [
      deleteDeletionRectangle,
      restoreDeletionRectangle,
      history,
      elementCollections,
    ]
  );
}

// Handler for adding an image with undo support
export function useHandleAddImageWithUndo(
  addImage: any,
  deleteImage: any,
  history: any
) {
  return useCallback(
    (
      src: string,
      x: number,
      y: number,
      width: number,
      height: number,
      page: number,
      view: ViewMode,
      supabaseMetadata?: {
        isSupabaseUrl?: boolean;
        filePath?: string;
        fileName?: string;
        fileObjectId?: string;
      }
    ) => {
      const imageData: ImageType = {
        id: "",
        src,
        x,
        y,
        width,
        height,
        page,
        rotation: 0,
        opacity: 1,
        borderColor: "#000000",
        borderWidth: 0,
        borderRadius: 0,
        ...supabaseMetadata,
      };

      const addFunc = (img: ImageType) => {
        const id = addImage(
          src,
          x,
          y,
          width,
          height,
          page,
          view,
          supabaseMetadata
        );
        img.id = id;
        return id;
      };

      const deleteFunc = (id: string) => {
        deleteImage(id, view);
      };

      const command = new AddImageCommand(addFunc, deleteFunc, imageData);
      history.executeCommand(command);

      return imageData.id;
    },
    [addImage, deleteImage, history]
  );
}

// Handler for deleting an image with undo support
export function useHandleDeleteImageWithUndo(
  deleteImage: any,
  restoreImage: any,
  history: any,
  elementCollections: any,
  selectedElementId: any,
  clearSelectionState: any
) {
  return useCallback(
    (id: string, view: ViewMode) => {
      const allImages = [
        ...elementCollections.originalImages,
        ...elementCollections.translatedImages,
        ...elementCollections.finalLayoutImages,
      ];
      const image = allImages.find((img: any) => img.id === id);

      if (!image) return;

      const imageView = elementCollections.originalImages.some(
        (img: any) => img.id === id
      )
        ? "original"
        : elementCollections.translatedImages.some((img: any) => img.id === id)
        ? "translated"
        : "final-layout";

      const deleteFunc = (id: string) => {
        console.log("[DeleteImage] Deleting image", id, "from view", imageView);
        deleteImage(id, imageView);
      };

      const restoreFunc = (img: ImageType, view: ViewMode) => {
        console.log("[DeleteImage] Restoring image", img.id, "to view", view);
        restoreImage(img, view);
      };

      const command = new DeleteImageCommand(
        deleteFunc,
        restoreFunc,
        image,
        imageView as ViewMode
      );
      history.executeCommand(command);

      if (selectedElementId === id) {
        clearSelectionState();
      }
    },
    [
      deleteImage,
      restoreImage,
      history,
      elementCollections,
      selectedElementId,
      clearSelectionState,
    ]
  );
}

// Handler for updating an image with undo support
export function useHandleUpdateImageWithUndo(updateImage: any, history: any) {
  return useCallback(
    (
      id: string,
      before: Partial<ImageType>,
      after: Partial<ImageType>,
      isOngoingOperation = false
    ) => {
      const command = new UpdateImageCommand(updateImage, id, before, after);

      if (isOngoingOperation && !history.isBatching()) {
        history.startBatch("Update image");
      }

      history.executeCommand(command);

      if (!isOngoingOperation && history.isBatching()) {
        history.endBatch();
      }
    },
    [updateImage, history]
  );
}

// Generic update image wrapper
export function useUpdateImageWithUndo(
  updateImage: any,
  handleUpdateImageWithUndo: any,
  getCurrentImageState: any,
  history: any
) {
  return useCallback(
    (id: string, updates: Partial<ImageType>, isOngoingOperation = false) => {
      const currentState = getCurrentImageState(id);

      if (currentState) {
        const before: Partial<ImageType> = {};
        const after: Partial<ImageType> = {};

        Object.keys(updates).forEach((key) => {
          const k = key as keyof ImageType;
          if (currentState[k] !== updates[k]) {
            before[k] = currentState[k] as any;
            after[k] = updates[k] as any;
          }
        });

        if (Object.keys(after).length > 0) {
          if (isOngoingOperation && !history.isBatching()) {
            history.startBatch("Move image");
          } else if (!isOngoingOperation && history.isBatching()) {
            history.endBatch();
          }

          handleUpdateImageWithUndo(id, before, after, isOngoingOperation);
        }
      }
    },
    [getCurrentImageState, handleUpdateImageWithUndo, history]
  );
}

// Handler for multi-element deletion
export function useHandleMultiDeleteWithUndo(
  deleteTextBox: any,
  deleteShape: any,
  deleteImage: any,
  restoreTextBox: any,
  restoreShape: any,
  restoreImage: any,
  history: any,
  elementCollections: any,
  multiSelection: any,
  clearSelectionState: any
) {
  return useCallback(() => {
    const selectedElements = multiSelection.selectedElements;

    if (!selectedElements || selectedElements.length === 0) return;

    console.log(
      "[MultiDelete] Starting multi-delete for",
      selectedElements.length,
      "elements"
    );

    // Collect elements to delete with their view information
    const elementsToDelete = {
      textBoxes: [] as TextField[],
      shapes: [] as ShapeType[],
      images: [] as ImageType[],
    };

    // Also track which view each element belongs to
    const elementViews = {
      textBoxes: new Map<string, ViewMode>(),
      shapes: new Map<string, ViewMode>(),
      images: new Map<string, ViewMode>(),
    };

    selectedElements.forEach((el: any) => {
      if (el.type === "textbox") {
        const tb = [
          ...elementCollections.originalTextBoxes,
          ...elementCollections.translatedTextBoxes,
          ...elementCollections.finalLayoutTextboxes,
        ].find((t: any) => t.id === el.id);
        if (tb) {
          elementsToDelete.textBoxes.push(tb);
          // Determine view
          const view = elementCollections.originalTextBoxes.some(
            (t: any) => t.id === el.id
          )
            ? ("original" as ViewMode)
            : elementCollections.translatedTextBoxes.some(
                (t: any) => t.id === el.id
              )
            ? ("translated" as ViewMode)
            : ("final-layout" as ViewMode);
          elementViews.textBoxes.set(tb.id, view);
        }
      } else if (el.type === "shape") {
        const shape = [
          ...elementCollections.originalShapes,
          ...elementCollections.translatedShapes,
          ...elementCollections.finalLayoutShapes,
        ].find((s: any) => s.id === el.id);
        if (shape) {
          elementsToDelete.shapes.push(shape);
          // Determine view
          const view = elementCollections.originalShapes.some(
            (s: any) => s.id === el.id
          )
            ? ("original" as ViewMode)
            : elementCollections.translatedShapes.some(
                (s: any) => s.id === el.id
              )
            ? ("translated" as ViewMode)
            : ("final-layout" as ViewMode);
          elementViews.shapes.set(shape.id, view);
        }
      } else if (el.type === "image") {
        const img = [
          ...elementCollections.originalImages,
          ...elementCollections.translatedImages,
          ...elementCollections.finalLayoutImages,
        ].find((i: any) => i.id === el.id);
        if (img) {
          elementsToDelete.images.push(img);
          // Determine view
          const view = elementCollections.originalImages.some(
            (i: any) => i.id === el.id
          )
            ? ("original" as ViewMode)
            : elementCollections.translatedImages.some(
                (i: any) => i.id === el.id
              )
            ? ("translated" as ViewMode)
            : ("final-layout" as ViewMode);
          elementViews.images.set(img.id, view);
        }
      }
    });

    // Create delete functions that track views
    const deleteTextBoxFunc = (id: string) => {
      const view = elementViews.textBoxes.get(id) || "original";
      console.log("[MultiDelete] Deleting textbox", id, "from view", view);
      deleteTextBox(id, view);
    };

    const deleteShapeFunc = (id: string) => {
      const view = elementViews.shapes.get(id) || "original";
      console.log("[MultiDelete] Deleting shape", id, "from view", view);
      deleteShape(id, view);
    };

    const deleteImageFunc = (id: string) => {
      const view = elementViews.images.get(id) || "original";
      console.log("[MultiDelete] Deleting image", id, "from view", view);
      deleteImage(id, view);
    };

    // Create restore functions that preserve view
    const restoreTextBoxFunc = (tb: TextField) => {
      const view = elementViews.textBoxes.get(tb.id) || "original";
      console.log("[MultiDelete] Restoring textbox", tb.id, "to view", view);
      restoreTextBox(tb, view);
    };

    const restoreShapeFunc = (s: ShapeType) => {
      const view = elementViews.shapes.get(s.id) || "original";
      console.log("[MultiDelete] Restoring shape", s.id, "to view", view);
      restoreShape(s, view);
    };

    const restoreImageFunc = (img: ImageType) => {
      const view = elementViews.images.get(img.id) || "original";
      console.log("[MultiDelete] Restoring image", img.id, "to view", view);
      restoreImage(img, view);
    };

    const command = new MultiDeleteCommand(
      deleteTextBoxFunc,
      deleteShapeFunc,
      deleteImageFunc,
      restoreTextBoxFunc,
      restoreShapeFunc,
      restoreImageFunc,
      elementsToDelete
    );

    // Use executeCommand for proper history tracking
    history.executeCommand(command);
    clearSelectionState();
  }, [
    deleteTextBox,
    deleteShape,
    deleteImage,
    restoreTextBox,
    restoreShape,
    restoreImage,
    history,
    elementCollections,
    multiSelection,
    clearSelectionState,
  ]);
}
