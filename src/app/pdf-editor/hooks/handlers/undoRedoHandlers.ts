import { useCallback } from "react";
import { TextField, ViewMode } from "../../types/pdf-editor.types";
import { Shape as ShapeType } from "../../types/pdf-editor.types";
import {
  AddTextBoxCommand,
  UpdateTextBoxCommand,
  AddDeletionRectangleCommand,
  DeleteDeletionRectangleCommand,
  AddImageCommand,
  DeleteImageCommand,
  DeleteTextBoxCommand,
  DeleteShapeCommand,
  AddShapeCommand,
  UpdateShapeCommand,
} from "./commands";
import {
  DeletionRectangle,
  Image as ImageType,
} from "../../types/pdf-editor.types";

// Refactored handler for adding a text box with undo support
export function useHandleAddTextBoxWithUndo(
  addTextBox: any,
  deleteTextBox: any,
  history: any
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
      let newId: string | null = null;
      const idRef = { current: null as string | null };
      const add = () => {
        newId = addTextBox(x, y, page, view, targetView, initialProperties);
        idRef.current = newId;
        if (!newId) throw new Error("Failed to add text box: newId is null");
        return newId;
      };
      const remove = (id: string) => {
        deleteTextBox(id, view);
      };
      const cmd = new AddTextBoxCommand(add, remove, idRef);
      cmd.execute();
      history.push(page, view, cmd);
      return idRef.current;
    },
    [addTextBox, deleteTextBox, history]
  );
}

// Refactored handler for duplicating a text box with undo support
export function useHandleDuplicateTextBoxWithUndo(
  duplicateTextBox: any,
  deleteTextBox: any,
  history: any
) {
  return useCallback(
    (originalId: string, currentView: ViewMode, page: number) => {
      let newId: string | null = null;
      const idRef = { current: null as string | null };
      const duplicate = () => {
        newId = duplicateTextBox(originalId, currentView);
        idRef.current = newId;
        if (!newId)
          throw new Error("Failed to duplicate text box: newId is null");
        return newId;
      };
      const remove = (id: string) => {
        deleteTextBox(id, currentView);
      };
      const cmd = new AddTextBoxCommand(duplicate, remove, idRef);
      cmd.execute();
      history.push(page, currentView, cmd);
      return idRef.current;
    },
    [duplicateTextBox, deleteTextBox, history]
  );
}

// Refactored handler for updating a text box with undo support
export function useHandleUpdateTextBoxWithUndo(
  updateTextBox: any,
  history: any
) {
  return useCallback(
    (
      id: string,
      before: Partial<TextField>,
      after: Partial<TextField>,
      page: number,
      view: ViewMode
    ) => {
      const cmd = new UpdateTextBoxCommand(updateTextBox, id, before, after);
      cmd.execute();
      history.push(page, view, cmd);
    },
    [updateTextBox, history]
  );
}

// General updateTextBoxWithUndo handler
export function useUpdateTextBoxWithUndo(
  updateTextBox: any,
  handleUpdateTextBoxWithUndo: any,
  getCurrentTextBoxState: any,
  documentState: any,
  viewState: any
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
          // For immediate operations, create undo command right away
          handleUpdateTextBoxWithUndo(
            id,
            before,
            after,
            documentState.currentPage,
            viewState.currentView
          );
        }
      }
    },
    [
      getCurrentTextBoxState,
      handleUpdateTextBoxWithUndo,
      documentState,
      viewState,
    ]
  );
}

// View-specific: original
export function useUpdateOriginalTextBoxWithUndo(
  updateTextBox: any,
  handleUpdateTextBoxWithUndo: any,
  getCurrentTextBoxState: any,
  documentState: any
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
          handleUpdateTextBoxWithUndo(
            id,
            before,
            after,
            documentState.currentPage,
            "original"
          );
        }
      }
    },
    [getCurrentTextBoxState, handleUpdateTextBoxWithUndo, documentState]
  );
}

// View-specific: translated
export function useUpdateTranslatedTextBoxWithUndo(
  updateTextBox: any,
  handleUpdateTextBoxWithUndo: any,
  getCurrentTextBoxState: any,
  documentState: any
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
          handleUpdateTextBoxWithUndo(
            id,
            before,
            after,
            documentState.currentPage,
            "translated"
          );
        }
      }
    },
    [getCurrentTextBoxState, handleUpdateTextBoxWithUndo, documentState]
  );
}

// View-specific: final-layout
export function useUpdateFinalLayoutTextBoxWithUndo(
  updateTextBox: any,
  handleUpdateTextBoxWithUndo: any,
  getCurrentTextBoxState: any,
  documentState: any
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
          handleUpdateTextBoxWithUndo(
            id,
            before,
            after,
            documentState.finalLayoutCurrentPage || 1,
            "final-layout"
          );
        }
      }
    },
    [getCurrentTextBoxState, handleUpdateTextBoxWithUndo, documentState]
  );
}

// Refactored handler for adding a shape with undo support
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
      targetView?: "original" | "translated" | "final-layout",
      // Line-specific parameters
      x1?: number,
      y1?: number,
      x2?: number,
      y2?: number
    ) => {
      let newId: string | null = null;
      const idRef = { current: null as string | null };
      const add = () => {
        if (
          type === "line" &&
          x1 !== undefined &&
          y1 !== undefined &&
          x2 !== undefined &&
          y2 !== undefined
        ) {
          newId = addShape(
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
        } else {
          newId = addShape(type, x, y, width, height, page, view, targetView);
        }
        idRef.current = newId;
        if (!newId) throw new Error("Failed to add shape: newId is null");
        return newId;
      };
      const remove = (id: string) => {
        deleteShape(id, view);
      };
      const cmd = new AddShapeCommand(add, remove, idRef);
      cmd.execute();
      history.push(page, view, cmd);
      return idRef.current;
    },
    [addShape, deleteShape, history]
  );
}

// Refactored handler for updating a shape with undo support
export function useHandleUpdateShapeWithUndo(updateShape: any, history: any) {
  return useCallback(
    (
      id: string,
      before: Partial<ShapeType>,
      after: Partial<ShapeType>,
      page: number,
      view: ViewMode
    ) => {
      const cmd = new UpdateShapeCommand(updateShape, id, before, after);
      cmd.execute();
      history.push(page, view, cmd);
    },
    [updateShape, history]
  );
}

// General updateShapeWithUndo handler
export function useUpdateShapeWithUndo(
  updateShape: any,
  handleUpdateShapeWithUndo: any,
  getCurrentShapeState: any,
  elementCollections: any,
  ongoingOperations: any
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
          // For immediate operations, create undo command right away
          const allShapes = [
            ...elementCollections.originalShapes,
            ...elementCollections.translatedShapes,
            ...elementCollections.finalLayoutShapes, // Add final layout shapes
          ];
          const shape = allShapes.find((s: any) => s.id === id);
          if (shape) {
            const view = elementCollections.originalShapes.some(
              (s: any) => s.id === id
            )
              ? "original"
              : elementCollections.translatedShapes.some(
                (s: any) => s.id === id
              )
              ? "translated"
              : "final-layout";
            handleUpdateShapeWithUndo(id, before, after, shape.page, view);
          }
        }
      }
    },
    [
      getCurrentShapeState,
      handleUpdateShapeWithUndo,
      elementCollections,
      ongoingOperations,
    ]
  );
}

// Refactored handler for deleting a text box with undo support
export function useHandleDeleteTextBoxWithUndo(
  deleteTextBox: any,
  addTextBox: any,
  history: any,
  handleAddTextBoxWithUndo: any,
  elementCollections: any,
  editorState: any,
  selectedElementId: any,
  clearSelectionState: any
) {
  return useCallback(
    (id: string, view: ViewMode) => {
      // Find the textbox to delete from all collections
      const allTextBoxes = [
        ...elementCollections.originalTextBoxes,
        ...elementCollections.translatedTextBoxes,
        ...elementCollections.finalLayoutTextboxes, // Add final layout textboxes
      ];
      const textBox = allTextBoxes.find((tb: any) => tb.id === id);
      if (!textBox) return;

      // Determine which view the textbox belongs to
      const textBoxView = elementCollections.originalTextBoxes.some(
        (tb: any) => tb.id === id
      )
        ? "original"
        : elementCollections.translatedTextBoxes.some(
          (tb: any) => tb.id === id
        )
        ? "translated"
        : "final-layout";

      const remove = (id: string) => {
        deleteTextBox(id, view);
      };
      const add = (textBox: TextField) => {
        handleAddTextBoxWithUndo(
          textBox.x,
          textBox.y,
          textBox.page,
          textBoxView,
          textBoxView,
          {
            value: textBox.value,
            fontSize: textBox.fontSize,
            fontFamily: textBox.fontFamily,
            color: textBox.color,
            bold: textBox.bold,
            italic: textBox.italic,
            underline: textBox.underline,
            textAlign: textBox.textAlign,
            letterSpacing: textBox.letterSpacing,
            lineHeight: textBox.lineHeight,
            width: textBox.width,
            height: textBox.height,
          }
        );
      };
      const cmd = new DeleteTextBoxCommand(remove, add, textBox);
      cmd.execute();
      history.push(textBox.page, textBoxView, cmd);

      // Clear selection state if the deleted textbox was selected
      if (editorState.selectedFieldId === id || selectedElementId === id) {
        clearSelectionState();
      }
    },
    [
      deleteTextBox,
      addTextBox,
      history,
      handleAddTextBoxWithUndo,
      elementCollections,
      editorState.selectedFieldId,
      selectedElementId,
      clearSelectionState,
    ]
  );
}

// Refactored handler for deleting a shape with undo support
export function useHandleDeleteShapeWithUndo(
  deleteShape: any,
  addShape: any,
  history: any,
  elementCollections: any,
  editorState: any,
  selectedElementId: any,
  clearSelectionState: any
) {
  return useCallback(
    (id: string, view: ViewMode) => {
      // Find the shape to delete from all collections
      const allShapes = [
        ...elementCollections.originalShapes,
        ...elementCollections.translatedShapes,
        ...elementCollections.finalLayoutShapes, // Add final layout shapes
      ];
      const shape = allShapes.find((s: any) => s.id === id);
      if (!shape) return;

      // Determine which view the shape belongs to
      const shapeView = elementCollections.originalShapes.some(
        (s: any) => s.id === id
      )
        ? "original"
        : elementCollections.translatedShapes.some(
          (s: any) => s.id === id
        )
        ? "translated"
        : "final-layout";

      const remove = (id: string) => {
        deleteShape(id, view);
      };
      const add = (shape: ShapeType) => {
        if (
          shape.type === "line" &&
          shape.x1 !== undefined &&
          shape.y1 !== undefined &&
          shape.x2 !== undefined &&
          shape.y2 !== undefined
        ) {
          addShape(
            shape.type,
            shape.x,
            shape.y,
            shape.width,
            shape.height,
            shape.page,
            shapeView,
            shapeView,
            shape.x1,
            shape.y1,
            shape.x2,
            shape.y2
          );
        } else {
          addShape(
            shape.type,
            shape.x,
            shape.y,
            shape.width,
            shape.height,
            shape.page,
            shapeView
          );
        }
      };
      const cmd = new DeleteShapeCommand(remove, add, shape);
      cmd.execute();
      history.push(shape.page, shapeView, cmd);

      // Clear selection state if the deleted shape was selected
      if (editorState.selectedShapeId === id || selectedElementId === id) {
        clearSelectionState();
      }
    },
    [
      deleteShape,
      addShape,
      history,
      elementCollections,
      editorState.selectedShapeId,
      selectedElementId,
      clearSelectionState,
    ]
  );
}

// Refactored handler for adding a deletion rectangle with undo support
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
      let newId: string | null = null;
      const idRef = { current: null as string | null };
      const add = () => {
        newId = addDeletionRectangle(
          x,
          y,
          width,
          height,
          page,
          view,
          background,
          opacity
        );
        idRef.current = newId;
        if (!newId)
          throw new Error("Failed to add deletion rectangle: newId is null");
        return newId;
      };
      const remove = (id: string) => {
        deleteDeletionRectangle(id, view);
      };
      const cmd = new AddDeletionRectangleCommand(add, remove, idRef);
      cmd.execute();
      history.push(page, view, cmd);
      return idRef.current;
    },
    [addDeletionRectangle, deleteDeletionRectangle, history]
  );
}

// Refactored handler for deleting a deletion rectangle with undo support
export function useHandleDeleteDeletionRectangleWithUndo(
  deleteDeletionRectangle: any,
  addDeletionRectangle: any,
  history: any,
  elementCollections: any
) {
  return useCallback(
    (id: string, view: ViewMode) => {
      // Find the deletion rectangle to delete
      const allRects = [
        ...elementCollections.originalDeletionRectangles,
        ...elementCollections.translatedDeletionRectangles,
        ...elementCollections.finalLayoutDeletionRectangles,
      ];
      const rect = allRects.find((r: any) => r.id === id);
      if (!rect) return;

      // Determine which view the rectangle belongs to
      const rectView = elementCollections.originalDeletionRectangles.some(
        (r: any) => r.id === id
      )
        ? "original"
        : elementCollections.finalLayoutDeletionRectangles.some(
            (r: any) => r.id === id
          )
        ? "final-layout"
        : "translated";

      const remove = (id: string) => {
        deleteDeletionRectangle(id, view);
      };
      const add = (rect: DeletionRectangle) => {
        addDeletionRectangle(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          rect.page,
          rectView,
          rect.background,
          rect.opacity
        );
      };
      const cmd = new DeleteDeletionRectangleCommand(remove, add, rect);
      cmd.execute();
      history.push(rect.page, rectView, cmd);
    },
    [deleteDeletionRectangle, addDeletionRectangle, history, elementCollections]
  );
}

// Refactored handler for adding an image with undo support
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
      let newId: string | null = null;
      const idRef = { current: null as string | null };
      const add = () => {
        newId = addImage(
          src,
          x,
          y,
          width,
          height,
          page,
          view,
          supabaseMetadata
        );
        idRef.current = newId;
        if (!newId) throw new Error("Failed to add image: newId is null");
        return newId;
      };
      const remove = (id: string) => {
        deleteImage(id, view);
      };
      const cmd = new AddImageCommand(add, remove, idRef);
      cmd.execute();
      history.push(page, view, cmd);
      return idRef.current;
    },
    [addImage, deleteImage, history]
  );
}

// Refactored handler for deleting an image with undo support
export function useHandleDeleteImageWithUndo(
  deleteImage: any,
  addImage: any,
  history: any,
  elementCollections: any,
  selectedElementId: any,
  clearSelectionState: any
) {
  return useCallback(
    (id: string, view: ViewMode) => {
      // Find the image to delete from all collections
      const allImages = [
        ...elementCollections.originalImages,
        ...elementCollections.translatedImages,
        ...elementCollections.finalLayoutImages, // Add final layout images
      ];
      const image = allImages.find((img: any) => img.id === id);
      if (!image) return;

      // Determine which view the image belongs to
      const imageView = elementCollections.originalImages.some(
        (img: any) => img.id === id
      )
        ? "original"
        : elementCollections.translatedImages.some(
          (img: any) => img.id === id
        )
        ? "translated"
        : "final-layout";

      const remove = (id: string) => {
        deleteImage(id, view);
      };
      const add = (image: ImageType) => {
        addImage(
          image.src,
          image.x,
          image.y,
          image.width,
          image.height,
          image.page,
          imageView
        );
      };
      const cmd = new DeleteImageCommand(remove, add, image);
      cmd.execute();
      history.push(image.page, imageView, cmd);

      // Clear selection state if the deleted image was selected
      if (selectedElementId === id) {
        clearSelectionState();
      }
    },
    [
      deleteImage,
      addImage,
      history,
      elementCollections,
      selectedElementId,
      clearSelectionState,
    ]
  );
}
