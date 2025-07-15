import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";
import { useTextFormat } from "@/components/editor/ElementFormatContext";
import { ElementFormatDrawer } from "@/components/editor/ElementFormatDrawer";

// Import types
import {
  EditorState,
  ToolState,
  ErasureState,
  SelectionState,
  ViewState,
  PageState,
  ViewMode,
  TextField,
  Shape as ShapeType,
  Image as ImageType,
  DeletionRectangle,
  SortedElement,
} from "./types/pdf-editor.types";

// Import hooks
import { useDocumentState } from "./hooks/useDocumentState";
import { useElementManagement } from "./hooks/useElementManagement";
import { useTextSpanHandling } from "./hooks/useTextSpanHandling";
import { useHistory } from "./hooks/useHistory";
import {
  AddTextBoxCommand,
  UpdateTextBoxCommand,
  DeleteTextBoxCommand,
  AddShapeCommand,
  UpdateShapeCommand,
  DeleteShapeCommand,
  AddDeletionRectangleCommand,
  DeleteDeletionRectangleCommand,
  AddImageCommand,
  DeleteImageCommand,
} from "./hooks/commands";

// Import components
import { PDFEditorHeader } from "./components/layout/PDFEditorHeader";
import { PDFEditorSidebar } from "./components/layout/PDFEditorSidebar";
import { PDFEditorStatusBar } from "./components/layout/PDFEditorStatusBar";
import { FloatingToolbar } from "./components/layout/FloatingToolbar";
import { MemoizedTextBox } from "./components/elements/TextBox";
import { MemoizedShape } from "./components/elements/Shape";
import { MemoizedImage } from "./components/elements/ImageElement";
import { SelectionPreview } from "./components/elements/SelectionPreview";
import { SelectionRectangle } from "./components/elements/SelectionRectangle";

// Import utilities
import { isPdfFile } from "./utils/measurements";
import { colorToRgba, rgbStringToHex } from "./utils/colors";

// Utility functions for text measurement and transformation
const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const measureText = (
  text: string,
  fontSize: number,
  fontFamily: string,
  characterSpacing: number = 0,
  maxWidth?: number,
  padding?: { top?: number; right?: number; bottom?: number; left?: number }
): { width: number; height: number } => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return { width: 100, height: fontSize };

  context.font = `${fontSize}px ${fontFamily}`;
  const metrics = context.measureText(text);
  const textWidth =
    metrics.width + characterSpacing * Math.max(0, text.length - 1);
  const textHeight = fontSize * 1.1; // Reduced line height for more compact text

  // If maxWidth is provided, account for padding
  if (maxWidth && padding) {
    const paddingLeft = padding.left || 0;
    const paddingRight = padding.right || 0;
    const availableWidth = maxWidth - paddingLeft - paddingRight;

    // If text fits within available width, return the maxWidth
    if (textWidth <= availableWidth) {
      return { width: maxWidth, height: textHeight };
    }
  }

  return { width: textWidth, height: textHeight };
};
import {
  screenToDocumentCoordinates,
  determineClickedView,
  getPreviewLeft,
} from "./utils/coordinates";
import {
  createTextFieldFromSpan as createTextFieldFromSpanUtil,
  createDeletionRectangleForSpan,
} from "./utils/textSpanUtils";
import {
  findElementsInSelection,
  calculateSelectionBounds,
  moveSelectedElements,
} from "./utils/selectionUtils";

// Import styles
import "./styles/pdf-editor.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const PDFEditorContent: React.FC = () => {
  const {
    isDrawerOpen,
    setIsDrawerOpen,
    selectedElementId,
    setSelectedElementId,
    selectedElementType,
    setSelectedElementType,
    currentFormat,
    setCurrentFormat,
    onFormatChange,
    setOnFormatChange,
    showPaddingPopup,
    setLayerOrderFunctions,
    setLayerPositionHelpers,
  } = useTextFormat();

  // Use custom hooks
  const { documentState, setDocumentState, handlers, actions } =
    useDocumentState();
  const {
    elementCollections,
    layerState,
    getCurrentTextBoxes,
    getCurrentShapes,
    getCurrentImages,
    getCurrentDeletionRectangles,
    getSortedElements,
    getOriginalSortedElements,
    getTranslatedSortedElements,
    addTextBox,
    addShape,
    addImage,
    addDeletionRectangle,
    updateTextBox,
    updateShape,
    updateImage,
    deleteTextBox,
    deleteShape,
    deleteImage,
    deleteDeletionRectangle,
    moveToFront,
    moveToBack,
    moveForward,
    moveBackward,
    isElementAtFront,
    isElementAtBack,
  } = useElementManagement();

  // Undo/Redo history
  const history = useHistory();

  // Undo/Redo handlers for text boxes
  const handleAddTextBoxWithUndo = useCallback(
    (
      x: number,
      y: number,
      page: number,
      view: ViewMode,
      targetView?: "original" | "translated",
      initialProperties?: Partial<TextField>
    ) => {
      let newId: string | null = null;
      const idRef = { current: null as string | null };
      const add = () => {
        newId = addTextBox(x, y, page, view, targetView, initialProperties);
        idRef.current = newId;
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

  const handleUpdateTextBoxWithUndo = useCallback(
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

  // Helper to get current text box state
  const getCurrentTextBoxState = useCallback(
    (id: string): Partial<TextField> | null => {
      const allTextBoxes = [
        ...elementCollections.originalTextBoxes,
        ...elementCollections.translatedTextBoxes,
      ];
      const textBox = allTextBoxes.find((tb) => tb.id === id);
      return textBox ? { ...textBox } : null;
    },
    [elementCollections]
  );

  // Editor state
  const [editorState, setEditorState] = useState<EditorState>({
    selectedFieldId: null,
    selectedShapeId: null,
    isEditMode: true,
    isAddTextBoxMode: false,
    isTextSelectionMode: false,
    showDeletionRectangles: false,
    isImageUploadMode: false,
    // Text selection properties
    selectedTextBoxes: { textBoxIds: [] },
    isDrawingSelection: false,
    selectionStart: null,
    selectionEnd: null,
    selectionRect: null,
    // Multi-element selection properties
    multiSelection: {
      selectedElements: [],
      selectionBounds: null,
      isDrawingSelection: false,
      selectionStart: null,
      selectionEnd: null,
      isMovingSelection: false,
      moveStart: null,
      targetView: null,
    },
    isSelectionMode: false,
  });

  // Tool state
  const [toolState, setToolState] = useState<ToolState>({
    shapeDrawingMode: null,
    selectedShapeType: "rectangle",
    isDrawingShape: false,
    shapeDrawStart: null,
    shapeDrawEnd: null,
    isDrawingInProgress: false,
    shapeDrawTargetView: null,
  });

  // Erasure state
  const [erasureState, setErasureState] = useState<ErasureState>({
    isErasureMode: false,
    isDrawingErasure: false,
    erasureDrawStart: null,
    erasureDrawEnd: null,
    erasureDrawTargetView: null,
    erasureSettings: {
      width: 20,
      height: 20,
      background: "#ffffff",
      opacity: 1.0,
    },
  });

  // Selection state
  const [selectionState, setSelectionState] = useState<SelectionState>({
    selectedTextBoxes: { textBoxIds: [] },
    isDrawingSelection: false,
    selectionStart: null,
    selectionEnd: null,
  });

  // View state
  const [viewState, setViewState] = useState<ViewState>({
    currentView: "original",
    zoomMode: "page",
    containerWidth: 0,
    isCtrlPressed: false,
    transformOrigin: "center center",
    isSidebarCollapsed: false,
    activeSidebarTab: "pages",
  });

  // Page state
  const [pageState, setPageState] = useState<PageState>({
    deletedPages: new Set(),
    isPageTranslated: new Map(),
    isTransforming: false,
    showTransformButton: true,
  });

  // Performance optimization: Track ongoing operations to batch updates
  const [ongoingOperations, setOngoingOperations] = useState<{
    [elementId: string]: {
      type: "resize" | "drag" | "text" | "multi-drag";
      startState: any;
      lastUpdate: number;
    };
  }>({});

  // Use a ref to track ongoing operations for immediate access in timers
  const ongoingOperationsRef = useRef<{
    [elementId: string]: {
      type: "resize" | "drag" | "text" | "multi-drag";
      startState: any;
      lastUpdate: number;
    };
  }>({});

  // Debounce timer for batched updates
  const debounceTimersRef = useRef<{ [elementId: string]: NodeJS.Timeout }>({});

  // Helper functions for managing ongoing operations
  const startOngoingOperation = useCallback(
    (
      elementId: string,
      type: "resize" | "drag" | "text" | "multi-drag",
      startState: any
    ) => {
      setOngoingOperations((prev) => ({
        ...prev,
        [elementId]: {
          type,
          startState,
          lastUpdate: Date.now(),
        },
      }));
    },
    []
  );

  const endOngoingOperation = useCallback((elementId: string) => {
    // Clear the debounce timer
    if (debounceTimersRef.current[elementId]) {
      clearTimeout(debounceTimersRef.current[elementId]);
      delete debounceTimersRef.current[elementId];
    }

    // Clear the ongoing operation
    setOngoingOperations((prev) => {
      const newState = { ...prev };
      delete newState[elementId];
      return newState;
    });
  }, []);

  // Wrapper for updating text box with undo support
  const updateTextBoxWithUndo = useCallback(
    (id: string, updates: Partial<TextField>, isOngoingOperation = false) => {
      const currentState = getCurrentTextBoxState(id);
      if (currentState) {
        // Get the specific properties being updated
        const before: Partial<TextField> = {};
        const after: Partial<TextField> = {};

        // Only include properties that are actually being changed
        Object.keys(updates).forEach((key) => {
          const k = key as keyof TextField;
          if (currentState[k] !== updates[k]) {
            before[k] = currentState[k] as any;
            after[k] = updates[k] as any;
          }
        });

        // Only create command if there are actual changes
        if (Object.keys(after).length > 0) {
          if (isOngoingOperation) {
            console.log("TextBox ongoing operation:", { id, updates: after });
            // For ongoing operations, update the state but don't create undo commands yet
            updateTextBox(id, after);

            // Update ongoing operation state
            const newOperationState = {
              type: "text" as const,
              startState:
                ongoingOperationsRef.current[id]?.startState || before,
              lastUpdate: Date.now(),
            };

            setOngoingOperations((prev) => ({
              ...prev,
              [id]: newOperationState,
            }));

            // Also update the ref for immediate access
            ongoingOperationsRef.current[id] = newOperationState;

            // Clear existing debounce timer
            if (debounceTimersRef.current[id]) {
              clearTimeout(debounceTimersRef.current[id]);
            }

            // Set debounce timer to create undo command after operation completes
            debounceTimersRef.current[id] = setTimeout(() => {
              console.log("TextBox debounce timer fired for:", id);
              const operation = ongoingOperationsRef.current[id];
              if (operation) {
                console.log(
                  "Creating undo command for textbox:",
                  id,
                  operation.startState,
                  after
                );
                handleUpdateTextBoxWithUndo(
                  id,
                  operation.startState,
                  after,
                  documentState.currentPage,
                  viewState.currentView
                );

                // Clear ongoing operation
                setOngoingOperations((prev) => {
                  const newState = { ...prev };
                  delete newState[id];
                  return newState;
                });
                delete ongoingOperationsRef.current[id];
                delete debounceTimersRef.current[id];
              }
            }, 500); // 500ms debounce
          } else {
            // For immediate operations, create undo command right away
            console.log("TextBox immediate operation:", { id, before, after });
            handleUpdateTextBoxWithUndo(
              id,
              before,
              after,
              documentState.currentPage,
              viewState.currentView
            );
          }
        }
      }
    },
    [
      getCurrentTextBoxState,
      handleUpdateTextBoxWithUndo,
      documentState.currentPage,
      viewState.currentView,
      ongoingOperations,
      updateTextBox,
    ]
  );

  // Undo/Redo handlers for shapes
  const handleAddShapeWithUndo = useCallback(
    (
      type: "circle" | "rectangle",
      x: number,
      y: number,
      width: number,
      height: number,
      page: number,
      view: ViewMode,
      targetView?: "original" | "translated"
    ) => {
      let newId: string | null = null;
      const idRef = { current: null as string | null };
      const add = () => {
        newId = addShape(type, x, y, width, height, page, view, targetView);
        idRef.current = newId;
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

  const handleUpdateShapeWithUndo = useCallback(
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

  // Helper to get current shape state
  const getCurrentShapeState = useCallback(
    (id: string): Partial<ShapeType> | null => {
      const allShapes = [
        ...elementCollections.originalShapes,
        ...elementCollections.translatedShapes,
      ];
      const shape = allShapes.find((s) => s.id === id);
      return shape ? { ...shape } : null;
    },
    [elementCollections]
  );

  // Wrapper for updating shape with undo support
  const updateShapeWithUndo = useCallback(
    (id: string, updates: Partial<ShapeType>, isOngoingOperation = false) => {
      const currentState = getCurrentShapeState(id);
      if (currentState) {
        // Get the specific properties being updated
        const before: Partial<ShapeType> = {};
        const after: Partial<ShapeType> = {};

        // Only include properties that are actually being changed
        Object.keys(updates).forEach((key) => {
          const k = key as keyof ShapeType;
          if (currentState[k] !== updates[k]) {
            before[k] = currentState[k] as any;
            after[k] = updates[k] as any;
          }
        });

        // Only create command if there are actual changes
        if (Object.keys(after).length > 0) {
          if (isOngoingOperation) {
            console.log("Shape ongoing operation:", { id, updates: after });
            // For ongoing operations, update the state but don't create undo commands yet
            updateShape(id, after);

            // Update ongoing operation state
            const newOperationState = {
              type: "drag" as const,
              startState:
                ongoingOperationsRef.current[id]?.startState || before,
              lastUpdate: Date.now(),
            };

            setOngoingOperations((prev) => ({
              ...prev,
              [id]: newOperationState,
            }));

            // Also update the ref for immediate access
            ongoingOperationsRef.current[id] = newOperationState;

            // Clear existing debounce timer
            if (debounceTimersRef.current[id]) {
              clearTimeout(debounceTimersRef.current[id]);
            }

            // Set debounce timer to create undo command after operation completes
            debounceTimersRef.current[id] = setTimeout(() => {
              console.log("Shape debounce timer fired for:", id);
              const operation = ongoingOperationsRef.current[id];
              if (operation) {
                const allShapes = [
                  ...elementCollections.originalShapes,
                  ...elementCollections.translatedShapes,
                ];
                const shape = allShapes.find((s) => s.id === id);
                if (shape) {
                  const view = elementCollections.originalShapes.some(
                    (s) => s.id === id
                  )
                    ? "original"
                    : "translated";
                  console.log(
                    "Creating undo command for shape:",
                    id,
                    operation.startState,
                    after
                  );
                  handleUpdateShapeWithUndo(
                    id,
                    operation.startState,
                    after,
                    shape.page,
                    view
                  );
                }

                // Clear ongoing operation
                setOngoingOperations((prev) => {
                  const newState = { ...prev };
                  delete newState[id];
                  return newState;
                });
                delete ongoingOperationsRef.current[id];
                delete debounceTimersRef.current[id];
              }
            }, 300); // 300ms debounce for drag operations
          } else {
            // For immediate operations, create undo command right away
            console.log("Shape immediate operation:", { id, before, after });
            const allShapes = [
              ...elementCollections.originalShapes,
              ...elementCollections.translatedShapes,
            ];
            const shape = allShapes.find((s) => s.id === id);
            if (shape) {
              const view = elementCollections.originalShapes.some(
                (s) => s.id === id
              )
                ? "original"
                : "translated";
              handleUpdateShapeWithUndo(id, before, after, shape.page, view);
            }
          }
        }
      }
    },
    [
      getCurrentShapeState,
      handleUpdateShapeWithUndo,
      elementCollections,
      ongoingOperations,
      updateShape,
    ]
  );

  // Helper function to clear selection state
  const clearSelectionState = useCallback(() => {
    setEditorState((prev) => ({
      ...prev,
      selectedFieldId: null,
      selectedShapeId: null,
      multiSelection: {
        ...prev.multiSelection,
        selectedElements: [],
        selectionBounds: null,
        isDrawingSelection: false,
        selectionStart: null,
        selectionEnd: null,
        isMovingSelection: false,
        moveStart: null,
      },
    }));
    setSelectedElementId(null);
    setSelectedElementType(null);
    setCurrentFormat(null);
    setIsDrawerOpen(false);
  }, [
    setSelectedElementId,
    setSelectedElementType,
    setCurrentFormat,
    setIsDrawerOpen,
  ]);

  // Wrapper for deleting textbox with undo support
  const handleDeleteTextBoxWithUndo = useCallback(
    (id: string, view: ViewMode) => {
      // Find the textbox to delete
      const allTextBoxes = [
        ...elementCollections.originalTextBoxes,
        ...elementCollections.translatedTextBoxes,
      ];
      const textBox = allTextBoxes.find((tb) => tb.id === id);
      if (!textBox) return;

      // Determine which view the textbox belongs to
      const textBoxView = elementCollections.originalTextBoxes.some(
        (tb) => tb.id === id
      )
        ? "original"
        : "translated";

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
      elementCollections,
      deleteTextBox,
      addTextBox,
      history,
      editorState.selectedFieldId,
      selectedElementId,
    ]
  );

  // Wrapper for deleting shape with undo support
  const handleDeleteShapeWithUndo = useCallback(
    (id: string, view: ViewMode) => {
      // Find the shape to delete
      const allShapes = [
        ...elementCollections.originalShapes,
        ...elementCollections.translatedShapes,
      ];
      const shape = allShapes.find((s) => s.id === id);
      if (!shape) return;

      // Determine which view the shape belongs to
      const shapeView = elementCollections.originalShapes.some(
        (s) => s.id === id
      )
        ? "original"
        : "translated";

      const remove = (id: string) => {
        deleteShape(id, view);
      };
      const add = (shape: ShapeType) => {
        addShape(
          shape.type,
          shape.x,
          shape.y,
          shape.width,
          shape.height,
          shape.page,
          shapeView,
          shapeView
        );
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
      elementCollections,
      deleteShape,
      addShape,
      history,
      editorState.selectedShapeId,
      selectedElementId,
    ]
  );

  // Undo/Redo handlers for deletion rectangles
  const handleAddDeletionRectangleWithUndo = useCallback(
    (
      x: number,
      y: number,
      width: number,
      height: number,
      page: number,
      view: ViewMode,
      background: string,
      opacity: number,
      targetView?: "original" | "translated"
    ) => {
      console.log("Adding deletion rectangle with undo:", {
        x,
        y,
        width,
        height,
        page,
        view,
        background,
        opacity,
      });
      let newId: string | null = null;
      const idRef = { current: null as string | null };
      const add = () => {
        // Use the direct function from element management to avoid recursion
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
        console.log("Deletion rectangle added with ID:", newId);
        return newId;
      };
      const remove = (id: string) => {
        console.log("Removing deletion rectangle with ID:", id);
        deleteDeletionRectangle(id, view);
      };
      const cmd = new AddDeletionRectangleCommand(add, remove, idRef);
      cmd.execute();
      history.push(page, view, cmd);
      console.log("Command pushed to history for page:", page, "view:", view);
      return idRef.current;
    },
    [addDeletionRectangle, deleteDeletionRectangle, history]
  );

  const handleDeleteDeletionRectangleWithUndo = useCallback(
    (id: string, view: ViewMode) => {
      console.log("Deleting deletion rectangle with undo:", { id, view });
      // Find the deletion rectangle to delete
      const allDeletionRectangles = [
        ...elementCollections.originalDeletionRectangles,
        ...elementCollections.translatedDeletionRectangles,
      ];
      const rect = allDeletionRectangles.find((r) => r.id === id);
      if (!rect) {
        console.log("Deletion rectangle not found:", id);
        return;
      }

      // Determine which view the deletion rectangle belongs to
      const rectView = elementCollections.originalDeletionRectangles.some(
        (r) => r.id === id
      )
        ? "original"
        : "translated";

      console.log("Deletion rectangle found:", rect, "view:", rectView);

      const remove = (id: string) => {
        console.log("Executing remove for deletion rectangle:", id);
        deleteDeletionRectangle(id, view);
      };
      const add = (rect: DeletionRectangle) => {
        console.log("Executing add for deletion rectangle:", rect);
        addDeletionRectangle(
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          rect.page,
          rectView,
          rect.background || "",
          rect.opacity
        );
      };
      const cmd = new DeleteDeletionRectangleCommand(remove, add, rect);
      cmd.execute();
      history.push(rect.page, rectView, cmd);
      console.log(
        "Delete command pushed to history for page:",
        rect.page,
        "view:",
        rectView
      );
    },
    [elementCollections, deleteDeletionRectangle, addDeletionRectangle, history]
  );

  // Undo/Redo handlers for images
  const handleAddImageWithUndo = useCallback(
    (
      src: string,
      x: number,
      y: number,
      width: number,
      height: number,
      page: number,
      view: ViewMode,
      targetView?: "original" | "translated"
    ) => {
      console.log("Adding image with undo:", {
        src,
        x,
        y,
        width,
        height,
        page,
        view,
        targetView,
      });
      let newId: string | null = null;
      const idRef = { current: null as string | null };
      const add = () => {
        // Determine the correct view to use based on targetView and current view
        const finalView = view === "split" && targetView ? targetView : view;
        // Use the direct function from element management to avoid recursion
        newId = addImage(src, x, y, width, height, page, finalView);
        idRef.current = newId;
        console.log("Image added with ID:", newId, "to view:", finalView);
        return newId;
      };
      const remove = (id: string) => {
        console.log("Removing image with ID:", id);
        deleteImage(id, view);
      };
      const cmd = new AddImageCommand(add, remove, idRef);
      cmd.execute();
      history.push(page, view, cmd);
      console.log(
        "Image command pushed to history for page:",
        page,
        "view:",
        view
      );
      return idRef.current;
    },
    [addImage, deleteImage, history]
  );

  const handleDeleteImageWithUndo = useCallback(
    (id: string, view: ViewMode) => {
      console.log("Deleting image with undo:", { id, view });
      // Find the image to delete
      const allImages = [
        ...elementCollections.originalImages,
        ...elementCollections.translatedImages,
      ];
      const image = allImages.find((img) => img.id === id);
      if (!image) {
        console.log("Image not found:", id);
        return;
      }

      // Determine which view the image belongs to
      const imageView = elementCollections.originalImages.some(
        (img) => img.id === id
      )
        ? "original"
        : "translated";

      console.log("Image found:", image, "view:", imageView);

      const remove = (id: string) => {
        console.log("Executing remove for image:", id);
        deleteImage(id, view);
      };
      const add = (image: ImageType) => {
        console.log("Executing add for image:", image);
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
      console.log(
        "Delete image command pushed to history for page:",
        image.page,
        "view:",
        imageView
      );

      // Clear selection state if the deleted image was selected
      if (selectedElementId === id) {
        clearSelectionState();
      }
    },
    [elementCollections, deleteImage, addImage, history, selectedElementId]
  );

  // Auto-focus state
  const [autoFocusTextBoxId, setAutoFocusTextBoxId] = useState<string | null>(
    null
  );

  // Undo/Redo debouncing state
  const [lastUndoTime, setLastUndoTime] = useState<number>(0);
  const [lastRedoTime, setLastRedoTime] = useState<number>(0);
  const UNDO_REDO_DEBOUNCE_MS = 300; // 300ms debounce for undo/redo

  // Callback to clear auto-focus ID after focusing
  const handleAutoFocusComplete = useCallback((id: string) => {
    setAutoFocusTextBoxId(null);
  }, []);

  // Helper function to get element by ID and type
  const getElementById = useCallback(
    (id: string, type: "textbox" | "shape" | "image") => {
      // Search in both views
      const originalTextBoxes = getCurrentTextBoxes("original");
      const originalShapes = getCurrentShapes("original");
      const originalImages = getCurrentImages("original");
      const translatedTextBoxes = getCurrentTextBoxes("translated");
      const translatedShapes = getCurrentShapes("translated");
      const translatedImages = getCurrentImages("translated");

      switch (type) {
        case "textbox":
          return (
            originalTextBoxes.find((tb) => tb.id === id) ||
            translatedTextBoxes.find((tb) => tb.id === id) ||
            null
          );
        case "shape":
          return (
            originalShapes.find((s) => s.id === id) ||
            translatedShapes.find((s) => s.id === id) ||
            null
          );
        case "image":
          return (
            originalImages.find((img) => img.id === id) ||
            translatedImages.find((img) => img.id === id) ||
            null
          );
        default:
          return null;
      }
    },
    [getCurrentTextBoxes, getCurrentShapes, getCurrentImages]
  );

  // Helper function to get elements that would be captured in the current selection preview
  const getElementsInSelectionPreview = useCallback(() => {
    if (
      !editorState.isSelectionMode ||
      !editorState.multiSelection.isDrawingSelection ||
      !editorState.multiSelection.selectionStart ||
      !editorState.multiSelection.selectionEnd
    ) {
      return new Set<string>();
    }

    const start = editorState.multiSelection.selectionStart;
    const end = editorState.multiSelection.selectionEnd;

    // Calculate selection rectangle
    const selectionRect = {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };

    // Only process if selection is large enough
    if (selectionRect.width <= 5 || selectionRect.height <= 5) {
      return new Set<string>();
    }

    // Get all elements from both views
    const originalTextBoxes = getCurrentTextBoxes("original");
    const originalShapes = getCurrentShapes("original");
    const originalImages = getCurrentImages("original");
    const translatedTextBoxes = getCurrentTextBoxes("translated");
    const translatedShapes = getCurrentShapes("translated");
    const translatedImages = getCurrentImages("translated");

    // Combine elements from both views
    const allTextBoxes = [...originalTextBoxes, ...translatedTextBoxes];
    const allShapes = [...originalShapes, ...translatedShapes];
    const allImages = [...originalImages, ...translatedImages];

    // Find elements in selection
    const selectedElements = findElementsInSelection(
      selectionRect,
      allTextBoxes,
      allShapes,
      allImages
    );

    // Return a Set of element IDs for efficient lookup
    return new Set(selectedElements.map((el) => el.id));
  }, [
    editorState.isSelectionMode,
    editorState.multiSelection.isDrawingSelection,
    editorState.multiSelection.selectionStart,
    editorState.multiSelection.selectionEnd,
    getCurrentTextBoxes,
    getCurrentShapes,
    getCurrentImages,
  ]);

  // Handle multi-selection move events
  const handleMultiSelectionMove = useCallback(
    (event: CustomEvent) => {
      console.log("Multi-selection move event received:", event.detail);
      const { deltaX, deltaY } = event.detail;

      // Move all selected elements
      moveSelectedElements(
        editorState.multiSelection.selectedElements,
        deltaX,
        deltaY,
        (id, updates) => updateTextBoxWithUndo(id, updates, true), // Mark as ongoing operation
        (id, updates) => updateShapeWithUndo(id, updates, true), // Mark as ongoing operation
        updateImage,
        getElementById,
        documentState.pageWidth,
        documentState.pageHeight
      );

      // Update original positions for next move
      setEditorState((prev) => {
        const updatedElements = prev.multiSelection.selectedElements.map(
          (el) => ({
            ...el,
            originalPosition: {
              x: el.originalPosition.x + deltaX,
              y: el.originalPosition.y + deltaY,
            },
          })
        );

        // Recalculate selection bounds after moving elements
        const newBounds = calculateSelectionBounds(
          updatedElements,
          getElementById
        );

        return {
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            selectedElements: updatedElements,
            selectionBounds: newBounds,
          },
        };
      });
    },
    [
      editorState.multiSelection.selectedElements,
      updateTextBoxWithUndo,
      updateShape,
      updateImage,
      getElementById,
    ]
  );

  const handleMultiSelectionMoveEnd = useCallback(() => {
    console.log("Multi-selection move end event received");
    setEditorState((prev) => ({
      ...prev,
      multiSelection: {
        ...prev.multiSelection,
        isMovingSelection: false,
        moveStart: null,
      },
    }));
  }, []);

  // Multi-selection drag handlers for individual Rnd components
  const initialPositionsRef = useRef<Record<string, { x: number; y: number }>>(
    {}
  );

  const handleMultiSelectDragStart = useCallback(
    (id: string) => {
      console.log("Multi-select drag start for element:", id);
      const selectedElements = editorState.multiSelection.selectedElements;
      if (selectedElements.length > 1) {
        // Store initial positions of all selected elements
        const initial: Record<string, { x: number; y: number }> = {};
        selectedElements.forEach((el) => {
          const element = getElementById(el.id, el.type);
          if (element) {
            initial[el.id] = { x: element.x, y: element.y };
          }
        });
        initialPositionsRef.current = initial;
      }
    },
    [editorState.multiSelection.selectedElements, getElementById]
  );

  const handleMultiSelectDrag = useCallback(
    (id: string, deltaX: number, deltaY: number) => {
      console.log("Multi-select drag for element:", id, "delta:", {
        deltaX,
        deltaY,
      });
      const selectedElements = editorState.multiSelection.selectedElements;
      if (selectedElements.length > 1) {
        // Move all selected elements by the same delta with boundary constraints
        selectedElements.forEach((el) => {
          if (el.id !== id) {
            // Skip the actively dragged element (react-rnd handles it)
            const initialPos = initialPositionsRef.current[el.id];
            if (initialPos) {
              const element = getElementById(el.id, el.type);
              if (element) {
                const newX = initialPos.x + deltaX;
                const newY = initialPos.y + deltaY;

                // Apply boundary constraints
                const constrainedX = Math.max(
                  0,
                  Math.min(newX, documentState.pageWidth - element.width)
                );
                const constrainedY = Math.max(
                  0,
                  Math.min(newY, documentState.pageHeight - element.height)
                );

                switch (el.type) {
                  case "textbox":
                    updateTextBoxWithUndo(
                      el.id,
                      {
                        x: constrainedX,
                        y: constrainedY,
                      },
                      true
                    ); // Mark as ongoing operation
                    break;
                  case "shape":
                    updateShapeWithUndo(
                      el.id,
                      {
                        x: constrainedX,
                        y: constrainedY,
                      },
                      true
                    ); // Mark as ongoing operation
                    break;
                  case "image":
                    updateImage(el.id, { x: constrainedX, y: constrainedY });
                    break;
                }
              }
            }
          }
        });
      }
    },
    [
      editorState.multiSelection.selectedElements,
      updateTextBoxWithUndo,
      updateShapeWithUndo,
      updateImage,
      getElementById,
      documentState.pageWidth,
      documentState.pageHeight,
    ]
  );

  const handleMultiSelectDragStop = useCallback(
    (id: string, deltaX: number, deltaY: number) => {
      console.log("Multi-select drag stop for element:", id, "delta:", {
        deltaX,
        deltaY,
      });
      const selectedElements = editorState.multiSelection.selectedElements;
      if (selectedElements.length > 1) {
        // Update original positions for next drag
        setEditorState((prev) => ({
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            selectedElements: prev.multiSelection.selectedElements.map(
              (el) => ({
                ...el,
                originalPosition: {
                  x: el.originalPosition.x + deltaX,
                  y: el.originalPosition.y + deltaY,
                },
              })
            ),
          },
        }));
      }
      // Clear initial positions
      initialPositionsRef.current = {};
    },
    [editorState.multiSelection.selectedElements]
  );

  // Refs
  const documentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);

  // Text span handling hook
  const { isZooming: isTextSpanZooming } = useTextSpanHandling({
    isAddTextBoxMode: editorState.isAddTextBoxMode,
    scale: documentState.scale,
    currentPage: documentState.currentPage,
    pdfBackgroundColor: documentState.pdfBackgroundColor,
    erasureSettings: erasureState.erasureSettings,
    createDeletionRectangleForSpan: (span: HTMLElement) => {
      const targetView =
        viewState.currentView === "split" ? "original" : viewState.currentView;
      const pdfPageEl = documentRef.current?.querySelector(
        ".react-pdf__Page"
      ) as HTMLElement;
      return createDeletionRectangleForSpan(
        span,
        pdfPageEl,
        documentState.currentPage,
        targetView,
        documentState.scale,
        (x, y, width, height, page, view, background, opacity) => {
          const result = handleAddDeletionRectangleWithUndo(
            x,
            y,
            width,
            height,
            page,
            view,
            background || "",
            opacity || 1.0
          );
          return result || "";
        },
        documentState.pdfBackgroundColor,
        erasureState.erasureSettings.opacity
      );
    },
    createTextFieldFromSpan: (span: HTMLElement) => {
      const targetView =
        viewState.currentView === "split" ? "original" : viewState.currentView;
      const pdfPageEl = documentRef.current?.querySelector(
        ".react-pdf__Page"
      ) as HTMLElement;
      return createTextFieldFromSpanUtil(
        span,
        pdfPageEl,
        documentState.currentPage,
        targetView,
        documentState.scale,
        (x, y, page, view, targetView, initialProperties) => {
          const result = handleAddTextBoxWithUndo(
            x,
            y,
            page,
            view,
            targetView,
            initialProperties
          );
          return result || "";
        },
        (x, y, width, height, page, view, background, opacity) => {
          const result = handleAddDeletionRectangleWithUndo(
            x,
            y,
            width,
            height,
            page,
            view,
            background || "",
            opacity || 1.0
          );
          return result || "";
        },
        documentState.pdfBackgroundColor,
        erasureState.erasureSettings.opacity
      );
    },
    addDeletionRectangle: (x, y, width, height, page, background, opacity) => {
      const targetView =
        viewState.currentView === "split" ? "original" : viewState.currentView;
      const result = handleAddDeletionRectangleWithUndo(
        x,
        y,
        width,
        height,
        page,
        targetView,
        background || "",
        opacity || 1.0
      );
      return result || "";
    },
    updateTextBox: (id: string, updates: any) => {
      updateTextBoxWithUndo(id, updates, false); // Don't mark as ongoing operation for text span updates
    },
    setAutoFocusTextBoxId,
  });

  // Zoom functionality
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      console.log("Wheel event detected:", {
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        deltaY: e.deltaY,
      });

      if (e.ctrlKey || e.metaKey) {
        console.log("Ctrl+wheel detected - preventing default and zooming");
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Always zoom to center
        setViewState((prev) => ({ ...prev, transformOrigin: "center center" }));

        const zoomFactor = 0.1;
        const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;

        actions.updateScale(documentState.scale + delta);
        setViewState((prev) => ({ ...prev, zoomMode: "page" }));

        actions.resetScaleChanging();
        return false;
      }
    };

    // Add the event listener with aggressive options
    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    // Also try adding to document as backup
    const documentHandler = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && container.contains(e.target as Node)) {
        console.log("Document-level wheel handler triggered");
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleWheel(e);
      }
    };

    document.addEventListener("wheel", documentHandler, {
      passive: false,
      capture: true,
    });

    return () => {
      container.removeEventListener("wheel", handleWheel, { capture: true });
      document.removeEventListener("wheel", documentHandler, { capture: true });
    };
  }, [documentState.scale, actions]);

  // Track Ctrl key state for zoom indicator and handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setViewState((prev) => ({ ...prev, isCtrlPressed: true }));

        // Ctrl+0 to reset zoom
        if (e.key === "0") {
          e.preventDefault();
          actions.updateScale(1.0);
          setViewState((prev) => ({
            ...prev,
            zoomMode: "page",
            transformOrigin: "center center",
          }));
          actions.resetScaleChanging();
          toast.success("Zoom reset to 100%");
        }

        // Ctrl+= or Ctrl++ to zoom in
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setViewState((prev) => ({
            ...prev,
            transformOrigin: "center center",
            zoomMode: "page",
          }));
          actions.updateScale(Math.min(5.0, documentState.scale + 0.1));
          actions.resetScaleChanging();
        }

        // Ctrl+- to zoom out
        if (e.key === "-") {
          e.preventDefault();
          setViewState((prev) => ({
            ...prev,
            transformOrigin: "center center",
            zoomMode: "page",
          }));
          actions.updateScale(Math.max(0.1, documentState.scale - 0.1));
          actions.resetScaleChanging();
        }

        // Ctrl+D to create deletion rectangle from selected text boxes
        if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          const selectedIds = editorState.selectedTextBoxes.textBoxIds;
          if (selectedIds.length > 0) {
            // For each selected textbox, create a deletion rectangle and delete the textbox
            selectedIds.forEach((textBoxId) => {
              const textBox = currentPageTextBoxes.find(
                (tb) => tb.id === textBoxId
              );
              if (textBox) {
                // First, create the deletion rectangle with undo
                handleAddDeletionRectangleWithUndo(
                  textBox.x,
                  textBox.y,
                  textBox.width,
                  textBox.height,
                  documentState.currentPage,
                  viewState.currentView,
                  documentState.pdfBackgroundColor,
                  erasureState.erasureSettings.opacity
                );

                // Then delete the textbox with undo
                // We need to create a proper delete command for textboxes
                const deleteTextBoxCmd = {
                  execute: () =>
                    deleteTextBox(textBox.id, viewState.currentView),
                  undo: () =>
                    handleAddTextBoxWithUndo(
                      textBox.x,
                      textBox.y,
                      documentState.currentPage,
                      viewState.currentView,
                      undefined,
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
                    ),
                };
                deleteTextBoxCmd.execute();
                history.push(
                  documentState.currentPage,
                  viewState.currentView,
                  deleteTextBoxCmd
                );
              }
            });
            toast.success(
              `Replaced ${selectedIds.length} text boxes with deletion rectangles`
            );
          }
        }

        // Ctrl+Z to undo
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          const now = Date.now();
          if (now - lastUndoTime < UNDO_REDO_DEBOUNCE_MS) {
            console.log("Undo debounced - too soon since last undo");
            return;
          }
          console.log(
            "Ctrl+Z pressed, canUndo:",
            history.canUndo(documentState.currentPage, viewState.currentView)
          );
          if (
            history.canUndo(documentState.currentPage, viewState.currentView)
          ) {
            history.undo(documentState.currentPage, viewState.currentView);
            setLastUndoTime(now);
            toast.success("Undo");
          }
        }

        // Ctrl+Y or Ctrl+Shift+Z to redo
        if (
          e.key === "y" ||
          e.key === "Y" ||
          (e.shiftKey && (e.key === "z" || e.key === "Z"))
        ) {
          e.preventDefault();
          const now = Date.now();
          if (now - lastRedoTime < UNDO_REDO_DEBOUNCE_MS) {
            console.log("Redo debounced - too soon since last redo");
            return;
          }
          console.log(
            "Ctrl+Y/Ctrl+Shift+Z pressed, canRedo:",
            history.canRedo(documentState.currentPage, viewState.currentView)
          );
          if (
            history.canRedo(documentState.currentPage, viewState.currentView)
          ) {
            history.redo(documentState.currentPage, viewState.currentView);
            setLastRedoTime(now);
            toast.success("Redo");
          }
        }
      }

      // Escape key to clear multi-selection
      if (e.key === "Escape") {
        e.preventDefault();
        setEditorState((prev) => ({
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            selectedElements: [],
            selectionBounds: null,
            isMovingSelection: false,
            moveStart: null,
          },
        }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setViewState((prev) => ({ ...prev, isCtrlPressed: false }));
      }
    };

    const handleBlur = () => {
      setViewState((prev) => ({ ...prev, isCtrlPressed: false }));
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    // Add multi-selection move event listeners
    document.addEventListener(
      "multiSelectionMove",
      handleMultiSelectionMove as EventListener
    );
    document.addEventListener(
      "multiSelectionMoveEnd",
      handleMultiSelectionMoveEnd as EventListener
    );

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);

      // Remove multi-selection move event listeners
      document.removeEventListener(
        "multiSelectionMove",
        handleMultiSelectionMove as EventListener
      );
      document.removeEventListener(
        "multiSelectionMoveEnd",
        handleMultiSelectionMoveEnd as EventListener
      );
    };
  }, [
    documentState.scale,
    actions,
    editorState.selectedTextBoxes.textBoxIds,
    editorState.multiSelection,
    addDeletionRectangle,
    documentState.currentPage,
    viewState.currentView,
    documentState.pdfBackgroundColor,
    erasureState.erasureSettings.opacity,
    setEditorState,
    handleMultiSelectionMove,
    handleMultiSelectionMoveEnd,
    history,
    lastUndoTime,
    lastRedoTime,
    UNDO_REDO_DEBOUNCE_MS,
  ]);

  // Format change handler for ElementFormatDrawer
  const handleFormatChange = useCallback(
    (format: any) => {
      console.log("handleFormatChange called with:", format, {
        selectedElementId,
        selectedElementType,
        multiSelectionCount: editorState.multiSelection.selectedElements.length,
      });

      // Check if we're in multi-selection mode
      const isMultiSelection =
        currentFormat &&
        "isMultiSelection" in currentFormat &&
        currentFormat.isMultiSelection;

      if (
        isMultiSelection &&
        editorState.multiSelection.selectedElements.length > 0
      ) {
        // Handle multi-selection format changes
        const { selectedElements } = editorState.multiSelection;

        if (selectedElementType === "textbox") {
          // Apply text format changes to all selected textboxes
          selectedElements.forEach((element) => {
            if (element.type === "textbox") {
              updateTextBoxWithUndo(element.id, format);
            }
          });
        } else if (selectedElementType === "shape") {
          // Apply shape format changes to all selected shapes
          const updates: Partial<ShapeType> = {};

          // Map shape-specific format changes
          if ("type" in format) updates.type = format.type;
          if ("fillColor" in format) updates.fillColor = format.fillColor;
          if ("fillOpacity" in format) updates.fillOpacity = format.fillOpacity;
          if ("borderColor" in format) updates.borderColor = format.borderColor;
          if ("borderWidth" in format) updates.borderWidth = format.borderWidth;
          if ("rotation" in format) updates.rotation = format.rotation;
          if ("borderRadius" in format)
            updates.borderRadius = format.borderRadius;

          selectedElements.forEach((element) => {
            if (element.type === "shape") {
              updateShapeWithUndo(element.id, updates);
            }
          });
        }
      } else if (selectedElementType === "textbox" && selectedElementId) {
        // Handle single text field format changes
        updateTextBoxWithUndo(selectedElementId, format);
      } else if (selectedElementType === "shape" && selectedElementId) {
        // Handle single shape format changes
        const updates: Partial<ShapeType> = {};

        // Map shape-specific format changes
        if ("type" in format) updates.type = format.type;
        if ("fillColor" in format) updates.fillColor = format.fillColor;
        if ("fillOpacity" in format) updates.fillOpacity = format.fillOpacity;
        if ("borderColor" in format) updates.borderColor = format.borderColor;
        if ("borderWidth" in format) updates.borderWidth = format.borderWidth;
        if ("rotation" in format) updates.rotation = format.rotation;
        if ("borderRadius" in format)
          updates.borderRadius = format.borderRadius;

        console.log("Updating shape with:", updates);
        updateShapeWithUndo(selectedElementId, updates);
      } else if (selectedElementType === "image" && selectedElementId) {
        // Handle image format changes
        const updates: Partial<ImageType> = {};

        // Check for special resetAspectRatio command
        if ("resetAspectRatio" in format && format.resetAspectRatio) {
          // Find the current image
          const currentImage = getCurrentImages(viewState.currentView).find(
            (img) => img.id === selectedElementId
          );
          if (currentImage) {
            // Create a temporary image element to get natural dimensions
            const img = new Image();
            img.onload = () => {
              const originalAspectRatio = img.naturalWidth / img.naturalHeight;
              const newHeight = currentImage.width / originalAspectRatio;

              const aspectRatioUpdates: Partial<ImageType> = {
                height: newHeight,
              };

              // Update the image with new height to maintain aspect ratio
              updateImage(selectedElementId, aspectRatioUpdates);

              // Update the current format to keep drawer in sync
              if (currentFormat && "src" in currentFormat) {
                setCurrentFormat({
                  ...currentFormat,
                  ...aspectRatioUpdates,
                } as ImageType);
              }
            };
            img.src = currentImage.src;
            return; // Exit early since we're handling this specially
          }
        }

        // Map image-specific format changes
        if ("opacity" in format) updates.opacity = format.opacity;
        if ("borderColor" in format) updates.borderColor = format.borderColor;
        if ("borderWidth" in format) updates.borderWidth = format.borderWidth;
        if ("borderRadius" in format)
          updates.borderRadius = format.borderRadius;
        if ("rotation" in format) updates.rotation = format.rotation;

        console.log("Updating image with:", updates);
        updateImage(selectedElementId, updates);

        // Update the current format to keep drawer in sync
        if (currentFormat && "src" in currentFormat) {
          setCurrentFormat({ ...currentFormat, ...updates } as ImageType);
        }
      }
    },
    [
      selectedElementId,
      selectedElementType,
      editorState.multiSelection.selectedElements,
      currentFormat,
      updateTextBoxWithUndo,
      updateShape,
      updateImage,
      getCurrentImages,
      viewState.currentView,
      setCurrentFormat,
    ]
  );

  // Effect to handle element selection and ElementFormatDrawer updates
  useEffect(() => {
    // Use setTimeout to ensure state updates happen after render
    const timeoutId = setTimeout(() => {
      const { selectedElements } = editorState.multiSelection;

      // Handle multi-selection format drawer
      if (selectedElements.length > 1) {
        const elementTypes = new Set(selectedElements.map((el) => el.type));

        // Only show format drawer if all elements are the same type
        if (elementTypes.size === 1) {
          const elementType = Array.from(elementTypes)[0];

          if (elementType === "textbox") {
            // For textboxes, create a composite format from all selected textboxes
            const allTextBoxes = [
              ...elementCollections.originalTextBoxes,
              ...elementCollections.translatedTextBoxes,
            ];

            const selectedTextBoxes = selectedElements
              .map((el) => allTextBoxes.find((tb) => tb.id === el.id))
              .filter((tb): tb is TextField => tb !== undefined);

            if (selectedTextBoxes.length > 0) {
              // Check which properties are consistent across all selected textboxes
              const firstTextBox = selectedTextBoxes[0];
              const consistentProperties: Record<string, boolean> = {};

              // Check font size consistency
              const fontSizes = selectedTextBoxes.map(
                (tb) => tb.fontSize || 12
              );
              consistentProperties.fontSize = fontSizes.every(
                (size) => size === fontSizes[0]
              );

              // Check font family consistency
              const fontFamilies = selectedTextBoxes.map(
                (tb) => tb.fontFamily || "Arial"
              );
              consistentProperties.fontFamily = fontFamilies.every(
                (font) => font === fontFamilies[0]
              );

              // Check color consistency
              const colors = selectedTextBoxes.map(
                (tb) => tb.color || "#000000"
              );
              consistentProperties.color = colors.every(
                (color) => color === colors[0]
              );

              // Check bold consistency
              const boldValues = selectedTextBoxes.map(
                (tb) => tb.bold || false
              );
              consistentProperties.bold = boldValues.every(
                (bold) => bold === boldValues[0]
              );

              // Check italic consistency
              const italicValues = selectedTextBoxes.map(
                (tb) => tb.italic || false
              );
              consistentProperties.italic = italicValues.every(
                (italic) => italic === italicValues[0]
              );

              // Check underline consistency
              const underlineValues = selectedTextBoxes.map(
                (tb) => tb.underline || false
              );
              consistentProperties.underline = underlineValues.every(
                (underline) => underline === underlineValues[0]
              );

              // Check text alignment consistency
              const textAligns = selectedTextBoxes.map(
                (tb) => tb.textAlign || "left"
              );
              consistentProperties.textAlign = textAligns.every(
                (align) => align === textAligns[0]
              );

              // Check border color consistency
              const borderColors = selectedTextBoxes.map(
                (tb) => tb.borderColor || "#000000"
              );
              consistentProperties.borderColor = borderColors.every(
                (color) => color === borderColors[0]
              );

              // Check border width consistency
              const borderWidths = selectedTextBoxes.map(
                (tb) => tb.borderWidth || 0
              );
              consistentProperties.borderWidth = borderWidths.every(
                (width) => width === borderWidths[0]
              );

              // Check line height consistency
              const lineHeights = selectedTextBoxes.map(
                (tb) => tb.lineHeight || 1.2
              );
              consistentProperties.lineHeight = lineHeights.every(
                (height) => height === lineHeights[0]
              );

              // Check letter spacing consistency
              const letterSpacings = selectedTextBoxes.map(
                (tb) => tb.letterSpacing || 0
              );
              consistentProperties.letterSpacing = letterSpacings.every(
                (spacing) => spacing === letterSpacings[0]
              );

              // Check border radius consistency
              const borderRadii = selectedTextBoxes.map(
                (tb) => tb.borderRadius || 0
              );
              consistentProperties.borderRadius = borderRadii.every(
                (radius) => radius === borderRadii[0]
              );

              // Check individual corner radius consistency
              const borderTopLeftRadii = selectedTextBoxes.map(
                (tb) => tb.borderTopLeftRadius || 0
              );
              consistentProperties.borderTopLeftRadius =
                borderTopLeftRadii.every(
                  (radius) => radius === borderTopLeftRadii[0]
                );

              const borderTopRightRadii = selectedTextBoxes.map(
                (tb) => tb.borderTopRightRadius || 0
              );
              consistentProperties.borderTopRightRadius =
                borderTopRightRadii.every(
                  (radius) => radius === borderTopRightRadii[0]
                );

              const borderBottomLeftRadii = selectedTextBoxes.map(
                (tb) => tb.borderBottomLeftRadius || 0
              );
              consistentProperties.borderBottomLeftRadius =
                borderBottomLeftRadii.every(
                  (radius) => radius === borderBottomLeftRadii[0]
                );

              const borderBottomRightRadii = selectedTextBoxes.map(
                (tb) => tb.borderBottomRightRadius || 0
              );
              consistentProperties.borderBottomRightRadius =
                borderBottomRightRadii.every(
                  (radius) => radius === borderBottomRightRadii[0]
                );

              // Create a composite format that represents common properties
              const compositeFormat = {
                ...firstTextBox,
                isMultiSelection: true,
                selectedCount: selectedTextBoxes.length,
                consistentProperties,
              } as TextField & {
                isMultiSelection: boolean;
                selectedCount: number;
                consistentProperties: Record<string, boolean>;
              };

              setCurrentFormat(compositeFormat);
              setSelectedElementType("textbox");
              setSelectedElementId(null); // Clear single selection
              setIsDrawerOpen(true);
              return;
            }
          } else if (elementType === "shape") {
            // For shapes, create a composite format from all selected shapes
            const allShapes = [
              ...elementCollections.originalShapes,
              ...elementCollections.translatedShapes,
            ];

            const selectedShapes = selectedElements
              .map((el) => allShapes.find((shape) => shape.id === el.id))
              .filter(Boolean);

            if (selectedShapes.length > 0) {
              // Create a composite format that represents common properties
              const compositeFormat = {
                ...selectedShapes[0],
                isMultiSelection: true,
                selectedCount: selectedShapes.length,
              } as ShapeType & {
                isMultiSelection: boolean;
                selectedCount: number;
              };

              setCurrentFormat(compositeFormat);
              setSelectedElementType("shape");
              setSelectedElementId(null); // Clear single selection
              setIsDrawerOpen(true);
              return;
            }
          }
        } else {
          // Mixed element types - close drawer
          setIsDrawerOpen(false);
          setSelectedElementType(null);
          setCurrentFormat(null);
          return;
        }
      }

      // Handle single element selection if we don't have multi-selection
      if (
        selectedElementId &&
        selectedElementType &&
        selectedElements.length === 0
      ) {
        if (selectedElementType === "textbox") {
          // Find the selected text box from all text boxes
          const allTextBoxes = [
            ...elementCollections.originalTextBoxes,
            ...elementCollections.translatedTextBoxes,
          ];
          const selectedTextBox = allTextBoxes.find(
            (box) => box.id === selectedElementId
          );

          if (selectedTextBox) {
            console.log("Selected text box:", selectedTextBox);

            // Ensure all required properties exist with safe defaults
            const safeTextBox = {
              id: selectedTextBox.id || "",
              x: selectedTextBox.x || 0,
              y: selectedTextBox.y || 0,
              width: selectedTextBox.width || 100,
              height: selectedTextBox.height || 20,
              value: selectedTextBox.value || "", // Ensure value is never undefined
              fontSize: selectedTextBox.fontSize || 12,
              fontFamily: selectedTextBox.fontFamily || "Arial",
              page: selectedTextBox.page || 1,
              rotation: selectedTextBox.rotation || 0,
              // Text formatting properties
              bold: selectedTextBox.bold || false,
              italic: selectedTextBox.italic || false,
              underline: selectedTextBox.underline || false,
              color: selectedTextBox.color || "#000000",
              textAlign: selectedTextBox.textAlign || "left",
              listType: selectedTextBox.listType || "none",
              // Spacing and layout
              lineHeight: selectedTextBox.lineHeight || 1.2,
              letterSpacing: selectedTextBox.letterSpacing || 0,
              // Border and background
              borderColor: selectedTextBox.borderColor || "#000000",
              borderWidth: selectedTextBox.borderWidth || 0,
              backgroundColor: selectedTextBox.backgroundColor || "transparent",
              borderRadius: selectedTextBox.borderRadius || 0,
              borderTopLeftRadius: selectedTextBox.borderTopLeftRadius || 0,
              borderTopRightRadius: selectedTextBox.borderTopRightRadius || 0,
              borderBottomLeftRadius:
                selectedTextBox.borderBottomLeftRadius || 0,
              borderBottomRightRadius:
                selectedTextBox.borderBottomRightRadius || 0,
              // Padding
              paddingTop: selectedTextBox.paddingTop || 0,
              paddingRight: selectedTextBox.paddingRight || 0,
              paddingBottom: selectedTextBox.paddingBottom || 0,
              paddingLeft: selectedTextBox.paddingLeft || 0,
              // State
              isEditing: selectedTextBox.isEditing || false,
            };

            console.log("Setting safeTextBox format:", safeTextBox);

            // Update the format drawer state
            setCurrentFormat(safeTextBox);
            setIsDrawerOpen(true);
          } else {
            console.warn("Selected text box not found:", selectedElementId);
            // Close drawer if selected text box is not found
            setIsDrawerOpen(false);
            setSelectedElementId(null);
            setCurrentFormat(null);
          }
        } else if (selectedElementType === "shape") {
          // Find the selected shape from all shapes
          const allShapes = [
            ...elementCollections.originalShapes,
            ...elementCollections.translatedShapes,
          ];
          const selectedShape = allShapes.find(
            (shape) => shape.id === selectedElementId
          );

          if (selectedShape) {
            console.log("Selected shape:", selectedShape);

            const shapeFormat = {
              id: selectedShape.id,
              type: selectedShape.type,
              x: selectedShape.x,
              y: selectedShape.y,
              width: selectedShape.width,
              height: selectedShape.height,
              page: selectedShape.page,
              fillColor: selectedShape.fillColor || "#ffffff",
              fillOpacity: selectedShape.fillOpacity || 0.5,
              borderColor: selectedShape.borderColor || "#000000",
              borderWidth: selectedShape.borderWidth || 1,
              rotation: selectedShape.rotation || 0,
              borderRadius: selectedShape.borderRadius || 0,
            };

            console.log("Setting shape format:", shapeFormat);
            setCurrentFormat(shapeFormat);
            setIsDrawerOpen(true);
          } else {
            console.warn("Selected shape not found:", selectedElementId);
            setIsDrawerOpen(false);
            setSelectedElementId(null);
            setCurrentFormat(null);
          }
        } else if (selectedElementType === "image") {
          // Find the selected image from all images
          const allImages = [
            ...elementCollections.originalImages,
            ...elementCollections.translatedImages,
          ];
          const selectedImage = allImages.find(
            (image) => image.id === selectedElementId
          );

          if (selectedImage) {
            console.log("Selected image:", selectedImage);
            setCurrentFormat(selectedImage);
            setIsDrawerOpen(true);
          } else {
            console.warn("Selected image not found:", selectedElementId);
            setIsDrawerOpen(false);
            setSelectedElementId(null);
            setCurrentFormat(null);
          }
        }
      } else {
        // Close drawer when no element is selected
        setIsDrawerOpen(false);
        setSelectedElementId(null);
        setCurrentFormat(null);
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [
    selectedElementId,
    selectedElementType,
    editorState.multiSelection.selectedElements,
    elementCollections,
    setIsDrawerOpen,
    setSelectedElementId,
    setCurrentFormat,
  ]);

  // Set the format change handler when it changes
  useEffect(() => {
    console.log("Setting onFormatChange handler:", handleFormatChange);
    if (typeof handleFormatChange === "function") {
      setOnFormatChange(handleFormatChange);
    } else {
      console.error(
        "handleFormatChange is not a function:",
        handleFormatChange
      );
    }
  }, [handleFormatChange, setOnFormatChange]);

  // Memoized values
  const currentPageTextBoxes = useMemo(
    () =>
      getCurrentTextBoxes(viewState.currentView).filter(
        (box) => box.page === documentState.currentPage
      ),
    [getCurrentTextBoxes, viewState.currentView, documentState.currentPage]
  );

  const currentPageShapes = useMemo(
    () =>
      getCurrentShapes(viewState.currentView).filter(
        (shape) => shape.page === documentState.currentPage
      ),
    [getCurrentShapes, viewState.currentView, documentState.currentPage]
  );

  const currentPageImages = useMemo(
    () =>
      getCurrentImages(viewState.currentView).filter(
        (image) => image.page === documentState.currentPage
      ),
    [getCurrentImages, viewState.currentView, documentState.currentPage]
  );

  const currentPageDeletionRectangles = useMemo(
    () =>
      getCurrentDeletionRectangles(viewState.currentView).filter(
        (rect) => rect.page === documentState.currentPage
      ),
    [
      getCurrentDeletionRectangles,
      viewState.currentView,
      documentState.currentPage,
    ]
  );

  const currentPageSortedElements = useMemo(
    () => getSortedElements(viewState.currentView, documentState.currentPage),
    [getSortedElements, viewState.currentView, documentState.currentPage]
  );

  // Debug: Log selection state
  useEffect(() => {
    console.log("Selection state:", {
      isSelectionMode: editorState.isSelectionMode,
      multiSelection: editorState.multiSelection,
    });
  }, [editorState.isSelectionMode, editorState.multiSelection]);

  // Tool handlers
  const handleToolChange = useCallback((tool: string, enabled: boolean) => {
    // Reset all tool states
    setEditorState((prev) => ({
      ...prev,
      isTextSelectionMode: false,
      isAddTextBoxMode: false,
      isSelectionMode: false,
    }));
    setToolState((prev) => ({
      ...prev,
      shapeDrawingMode: null,
      isDrawingInProgress: false,
      shapeDrawStart: null,
      shapeDrawEnd: null,
      shapeDrawTargetView: null,
    }));
    setErasureState((prev) => ({
      ...prev,
      isErasureMode: false,
    }));

    // Enable the selected tool
    switch (tool) {
      case "selection":
        if (enabled) {
          console.log("Enabling selection mode");
          setEditorState((prev) => ({ ...prev, isSelectionMode: true }));
        }
        break;
      case "textSelection":
        if (enabled) {
          setEditorState((prev) => ({ ...prev, isTextSelectionMode: true }));
        }
        break;
      case "addTextBox":
        if (enabled) {
          setEditorState((prev) => ({ ...prev, isAddTextBoxMode: true }));
        }
        break;
      case "rectangle":
        if (enabled) {
          setToolState((prev) => ({ ...prev, shapeDrawingMode: "rectangle" }));
        }
        break;
      case "circle":
        if (enabled) {
          setToolState((prev) => ({ ...prev, shapeDrawingMode: "circle" }));
        }
        break;
      case "erasure":
        if (enabled) {
          setErasureState((prev) => ({ ...prev, isErasureMode: true }));
        }
        break;
    }
  }, []);

  // Element selection handlers
  const handleTextBoxSelect = useCallback(
    (id: string) => {
      // Turn off all modes when an element is selected
      setEditorState((prev) => ({
        ...prev,
        selectedFieldId: id,
        selectedShapeId: null,
        isTextSelectionMode: false,
        isAddTextBoxMode: false,
        isSelectionMode: false, // Turn off multi-selection mode
        // Clear multi-selection when individual element is selected
        multiSelection: {
          ...prev.multiSelection,
          selectedElements: [],
          selectionBounds: null,
          isDrawingSelection: false,
          selectionStart: null,
          selectionEnd: null,
          isMovingSelection: false,
          moveStart: null,
        },
      }));
      setToolState((prev) => ({
        ...prev,
        shapeDrawingMode: null,
        isDrawingInProgress: false,
        shapeDrawStart: null,
        shapeDrawEnd: null,
        shapeDrawTargetView: null,
      }));
      setErasureState((prev) => ({
        ...prev,
        isErasureMode: false,
      }));

      setSelectedElementId(id);
      setSelectedElementType("textbox");

      // The format will be set by the effect that monitors selectedElementId
      setIsDrawerOpen(true);
    },
    [setSelectedElementId, setSelectedElementType, setIsDrawerOpen]
  );

  const handleShapeSelect = useCallback(
    (id: string) => {
      // Turn off all modes when an element is selected
      setEditorState((prev) => ({
        ...prev,
        selectedFieldId: null,
        selectedShapeId: id,
        isTextSelectionMode: false,
        isAddTextBoxMode: false,
        isSelectionMode: false, // Turn off multi-selection mode
        // Clear multi-selection when individual element is selected
        multiSelection: {
          ...prev.multiSelection,
          selectedElements: [],
          selectionBounds: null,
          isDrawingSelection: false,
          selectionStart: null,
          selectionEnd: null,
          isMovingSelection: false,
          moveStart: null,
        },
      }));
      setToolState((prev) => ({
        ...prev,
        shapeDrawingMode: null,
        isDrawingInProgress: false,
        shapeDrawStart: null,
        shapeDrawEnd: null,
        shapeDrawTargetView: null,
      }));
      setErasureState((prev) => ({
        ...prev,
        isErasureMode: false,
      }));

      setSelectedElementId(id);
      setSelectedElementType("shape");

      // The format will be set by the effect that monitors selectedElementId
      setIsDrawerOpen(true);
    },
    [setSelectedElementId, setSelectedElementType, setIsDrawerOpen]
  );

  const handleImageSelect = useCallback(
    (id: string) => {
      // Turn off all modes when an element is selected
      setEditorState((prev) => ({
        ...prev,
        selectedFieldId: null,
        selectedShapeId: null,
        isTextSelectionMode: false,
        isAddTextBoxMode: false,
        isSelectionMode: false, // Turn off multi-selection mode
        // Clear multi-selection when individual element is selected
        multiSelection: {
          ...prev.multiSelection,
          selectedElements: [],
          selectionBounds: null,
          isDrawingSelection: false,
          selectionStart: null,
          selectionEnd: null,
          isMovingSelection: false,
          moveStart: null,
        },
      }));
      setToolState((prev) => ({
        ...prev,
        shapeDrawingMode: null,
        isDrawingInProgress: false,
        shapeDrawStart: null,
        shapeDrawEnd: null,
        shapeDrawTargetView: null,
      }));
      setErasureState((prev) => ({
        ...prev,
        isErasureMode: false,
      }));

      setSelectedElementId(id);
      setSelectedElementType("image");

      // The format will be set by the effect that monitors selectedElementId
      setIsDrawerOpen(true);
    },
    [setSelectedElementId, setSelectedElementType, setIsDrawerOpen]
  );

  // Shape drawing handlers
  const handleShapeDrawStart = useCallback(
    (e: React.MouseEvent) => {
      if (!toolState.shapeDrawingMode) return;

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      let x = (e.clientX - rect.left) / documentState.scale;
      let y = (e.clientY - rect.top) / documentState.scale;
      let targetView: "original" | "translated" | null = null;

      // Determine target view in split mode
      if (viewState.currentView === "split") {
        const clickX = e.clientX - rect.left;
        const singleDocWidth = documentState.pageWidth * documentState.scale;
        const gap = 20;

        if (clickX > singleDocWidth + gap) {
          x = (clickX - singleDocWidth - gap) / documentState.scale;
          targetView = "translated";
        } else if (clickX <= singleDocWidth) {
          targetView = "original";
        } else {
          return; // Click in gap - ignore
        }
      }

      setToolState((prev) => ({
        ...prev,
        shapeDrawStart: { x, y },
        shapeDrawTargetView: targetView,
        isDrawingInProgress: true,
      }));
    },
    [
      toolState.shapeDrawingMode,
      documentState.scale,
      documentState.pageWidth,
      viewState.currentView,
    ]
  );

  const handleShapeDrawMove = useCallback(
    (e: React.MouseEvent) => {
      if (!toolState.isDrawingInProgress || !toolState.shapeDrawStart) return;

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Calculate base coordinates
      let x = clickX / documentState.scale;
      let y = clickY / documentState.scale;

      // Adjust coordinates for split view
      if (viewState.currentView === "split") {
        const singleDocWidth = documentState.pageWidth;
        const gap = 20 / documentState.scale;

        // Check if we're drawing on the translated side
        if (toolState.shapeDrawTargetView === "translated") {
          x =
            (clickX - documentState.pageWidth * documentState.scale - 20) /
            documentState.scale;
        }
      }

      setToolState((prev) => ({
        ...prev,
        shapeDrawEnd: { x, y },
      }));
    },
    [
      toolState.isDrawingInProgress,
      toolState.shapeDrawStart,
      toolState.shapeDrawTargetView,
      documentState.scale,
      documentState.pageWidth,
      viewState.currentView,
    ]
  );

  const handleShapeDrawEnd = useCallback(() => {
    if (
      !toolState.isDrawingInProgress ||
      !toolState.shapeDrawStart ||
      !toolState.shapeDrawEnd
    )
      return;

    const width = Math.abs(
      toolState.shapeDrawEnd.x - toolState.shapeDrawStart.x
    );
    const height = Math.abs(
      toolState.shapeDrawEnd.y - toolState.shapeDrawStart.y
    );

    if (width > 10 && height > 10) {
      const x = Math.min(toolState.shapeDrawStart.x, toolState.shapeDrawEnd.x);
      const y = Math.min(toolState.shapeDrawStart.y, toolState.shapeDrawEnd.y);

      if (toolState.shapeDrawingMode) {
        handleAddShapeWithUndo(
          toolState.shapeDrawingMode,
          x,
          y,
          width,
          height,
          documentState.currentPage,
          viewState.currentView,
          toolState.shapeDrawTargetView || undefined
        );
      }
    }

    setToolState((prev) => ({
      ...prev,
      shapeDrawStart: null,
      shapeDrawEnd: null,
      shapeDrawTargetView: null,
      isDrawingInProgress: false,
      shapeDrawingMode: null,
    }));
    setEditorState((prev) => ({
      ...prev,
      isAddTextBoxMode: false,
      isTextSelectionMode: false,
    }));
    setErasureState((prev) => ({
      ...prev,
      isErasureMode: false,
    }));
  }, [
    toolState,
    addShape,
    documentState.currentPage,
    viewState.currentView,
    setEditorState,
    setErasureState,
  ]);

  // Document mouse handlers for text selection and erasure
  const handleDocumentMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (editorState.isTextSelectionMode) {
        // Handle drag-to-select for textboxes
        if (e.button !== 0) return; // Only left click

        const rect = documentRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX;
        const y = e.clientY;

        setEditorState((prev) => ({
          ...prev,
          isDrawingSelection: true,
          selectionStart: { x, y },
          selectionEnd: { x, y },
        }));

        // Clear previous selections unless holding Ctrl/Cmd
        if (!e.ctrlKey && !e.metaKey) {
          setEditorState((prev) => ({
            ...prev,
            selectedTextBoxes: { textBoxIds: [], bounds: undefined },
          }));
        }

        e.preventDefault();
      } else if (erasureState.isErasureMode) {
        // Handle erasure drawing start
        if (e.button !== 0) return; // Only left click

        const rect = documentRef.current?.getBoundingClientRect();
        if (!rect) return;

        let x = (e.clientX - rect.left) / documentState.scale;
        let y = (e.clientY - rect.top) / documentState.scale;
        let targetView: "original" | "translated" | undefined = undefined;

        // Set targetView based on currentView and click position
        if (viewState.currentView === "split") {
          const clickX = e.clientX - rect.left;
          const singleDocWidth = documentState.pageWidth * documentState.scale;
          const gap = 20; // Gap between documents

          if (clickX > singleDocWidth + gap) {
            x = (clickX - singleDocWidth - gap) / documentState.scale;
            targetView = "translated";
          } else if (clickX <= singleDocWidth) {
            targetView = "original";
          } else {
            return; // Click in gap - ignore
          }
        } else {
          targetView =
            viewState.currentView === "translated" ? "translated" : "original";
        }

        setErasureState((prev) => ({
          ...prev,
          erasureDrawStart: { x, y },
          erasureDrawTargetView: targetView,
          isDrawingErasure: true,
        }));

        e.preventDefault();
      }
    },
    [
      editorState.isTextSelectionMode,
      erasureState.isErasureMode,
      documentState.scale,
      documentState.pageWidth,
      viewState.currentView,
    ]
  );

  const handleDocumentMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (
        editorState.isTextSelectionMode &&
        editorState.isDrawingSelection &&
        editorState.selectionStart
      ) {
        const x = e.clientX;
        const y = e.clientY;

        setEditorState((prev) => ({
          ...prev,
          selectionEnd: { x, y },
        }));
        e.preventDefault();
      }
    },
    [
      editorState.isTextSelectionMode,
      editorState.isDrawingSelection,
      editorState.selectionStart,
    ]
  );

  const handleDocumentMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (editorState.isTextSelectionMode && editorState.isDrawingSelection) {
        // Find textboxes within the selection rectangle
        if (
          editorState.selectionRect &&
          editorState.selectionRect.width > 5 &&
          editorState.selectionRect.height > 5
        ) {
          const rect = documentRef.current?.getBoundingClientRect();
          if (rect) {
            const currentTextBoxes = currentPageTextBoxes;
            const selectedIds: string[] = [];

            currentTextBoxes.forEach((textBox: TextField) => {
              // Convert textbox coordinates to screen coordinates
              const textBoxLeft = rect.left + textBox.x * documentState.scale;
              const textBoxTop = rect.top + textBox.y * documentState.scale;
              const textBoxRight =
                textBoxLeft + textBox.width * documentState.scale;
              const textBoxBottom =
                textBoxTop + textBox.height * documentState.scale;

              // Check if textbox intersects with selection rectangle
              const intersects = !(
                textBoxRight < editorState.selectionRect!.left ||
                textBoxLeft >
                  editorState.selectionRect!.left +
                    editorState.selectionRect!.width ||
                textBoxBottom < editorState.selectionRect!.top ||
                textBoxTop >
                  editorState.selectionRect!.top +
                    editorState.selectionRect!.height
              );

              if (intersects) {
                selectedIds.push(textBox.id);
              }
            });

            // Update selection (merge with existing if Ctrl/Cmd held)
            if (e.ctrlKey || e.metaKey) {
              setEditorState((prev) => {
                const newIds = [
                  ...new Set([
                    ...prev.selectedTextBoxes.textBoxIds,
                    ...selectedIds,
                  ]),
                ];
                return {
                  ...prev,
                  selectedTextBoxes: {
                    textBoxIds: newIds,
                    bounds: undefined, // Simplified for now
                  },
                };
              });
            } else {
              setEditorState((prev) => ({
                ...prev,
                selectedTextBoxes: {
                  textBoxIds: selectedIds,
                  bounds: undefined, // Simplified for now
                },
              }));
            }

            // Create deletion rectangle from selection if right-click
            if (e.button === 2) {
              // Right click
              const selectionRect = editorState.selectionRect;
              if (selectionRect) {
                // Convert screen coordinates back to document coordinates
                const x =
                  (selectionRect.left - rect.left) / documentState.scale;
                const y = (selectionRect.top - rect.top) / documentState.scale;
                const width = selectionRect.width / documentState.scale;
                const height = selectionRect.height / documentState.scale;

                // Create deletion rectangle with undo
                handleAddDeletionRectangleWithUndo(
                  x,
                  y,
                  width,
                  height,
                  documentState.currentPage,
                  viewState.currentView,
                  documentState.pdfBackgroundColor,
                  erasureState.erasureSettings.opacity
                );

                toast.success("Deletion rectangle created from selection");
              }
            }
          }
        }

        // Reset selection state
        setEditorState((prev) => ({
          ...prev,
          isDrawingSelection: false,
          selectionStart: null,
          selectionEnd: null,
        }));
      }
    },
    [
      editorState.isTextSelectionMode,
      editorState.isDrawingSelection,
      editorState.selectionRect,
      documentState.scale,
      currentPageTextBoxes,
      addDeletionRectangle,
      documentState.currentPage,
      viewState.currentView,
    ]
  );

  // Erasure drawing handlers
  const handleErasureDrawMove = useCallback(
    (e: React.MouseEvent) => {
      if (!erasureState.isDrawingErasure || !erasureState.erasureDrawStart)
        return;

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Calculate base coordinates
      let x = clickX / documentState.scale;
      let y = clickY / documentState.scale;

      // Adjust coordinates for split view
      if (viewState.currentView === "split") {
        const singleDocWidth = documentState.pageWidth;
        const gap = 20 / documentState.scale;

        // Check if we're drawing on the translated side
        if (erasureState.erasureDrawTargetView === "translated") {
          x =
            (clickX - documentState.pageWidth * documentState.scale - 20) /
            documentState.scale;
        }
      }

      setErasureState((prev) => ({
        ...prev,
        erasureDrawEnd: { x, y },
      }));
    },
    [
      erasureState.isDrawingErasure,
      erasureState.erasureDrawStart,
      erasureState.erasureDrawTargetView,
      documentState.scale,
      documentState.pageWidth,
      viewState.currentView,
    ]
  );

  const handleErasureDrawEnd = useCallback(() => {
    console.log("handleErasureDrawEnd called", {
      isDrawingErasure: erasureState.isDrawingErasure,
      erasureDrawStart: erasureState.erasureDrawStart,
      erasureDrawEnd: erasureState.erasureDrawEnd,
    });

    // Always reset the drawing state, regardless of conditions
    const wasDrawing = erasureState.isDrawingErasure;
    const hadStart = erasureState.erasureDrawStart;
    const hadEnd = erasureState.erasureDrawEnd;
    const targetView = erasureState.erasureDrawTargetView;

    // Reset state immediately to prevent any lingering preview
    setErasureState((prev) => ({
      ...prev,
      erasureDrawStart: null,
      erasureDrawEnd: null,
      erasureDrawTargetView: null,
      isDrawingErasure: false,
    }));

    // Only process if we were actually drawing
    if (!wasDrawing || !hadStart || !hadEnd) {
      console.log("Early return - not drawing or no start/end point");
      return;
    }

    const width = Math.abs(hadEnd.x - hadStart.x);
    const height = Math.abs(hadEnd.y - hadStart.y);

    console.log("Drawing dimensions", { width, height });

    if (width > 5 && height > 5) {
      const x = Math.min(hadStart.x, hadEnd.x);
      const y = Math.min(hadStart.y, hadEnd.y);

      // Create deletion rectangle with PDF background color and erasure opacity
      const deletionRect: DeletionRectangle = {
        id: crypto.randomUUID(),
        x,
        y,
        width,
        height,
        page: documentState.currentPage,
        background: documentState.pdfBackgroundColor,
        opacity: erasureState.erasureSettings.opacity,
      };

      console.log(
        "Creating deletion rectangle",
        deletionRect,
        "for view:",
        targetView
      );

      // Use the undo-enabled addDeletionRectangle function
      // In split view, use the target view; otherwise use current view
      const targetViewForDeletion =
        viewState.currentView === "split" ? targetView : viewState.currentView;

      handleAddDeletionRectangleWithUndo(
        x,
        y,
        width,
        height,
        documentState.currentPage,
        targetViewForDeletion || "original",
        documentState.pdfBackgroundColor,
        erasureState.erasureSettings.opacity
      );
    }

    console.log("Erasure drawing completed and state reset");
  }, [
    erasureState,
    documentState.currentPage,
    documentState.pdfBackgroundColor,
    erasureState.erasureSettings.opacity,
    viewState.currentView,
    handleAddDeletionRectangleWithUndo,
  ]);

  // Create deletion rectangle from selected text
  const createDeletionFromSelection = useCallback(
    (selection: {
      text: string;
      pagePosition: { x: number; y: number };
      pageSize: { width: number; height: number };
    }) => {
      handleAddDeletionRectangleWithUndo(
        selection.pagePosition.x,
        selection.pagePosition.y,
        selection.pageSize.width + 1, // Add 1px for better coverage
        selection.pageSize.height + 1, // Add 1px for better coverage
        documentState.currentPage,
        viewState.currentView,
        documentState.pdfBackgroundColor,
        erasureState.erasureSettings.opacity
      );
    },
    [
      handleAddDeletionRectangleWithUndo,
      documentState.currentPage,
      viewState.currentView,
    ]
  );

  // Multi-element selection handlers
  const handleMultiSelectionMouseDown = useCallback(
    (e: React.MouseEvent) => {
      console.log("Multi-selection mouse down", {
        isSelectionMode: editorState.isSelectionMode,
        button: e.button,
      });

      if (!editorState.isSelectionMode) return;
      if (e.button !== 0) return; // Only left click

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Determine which view was clicked in split mode
      let clickedView: "original" | "translated" = "original";
      if (viewState.currentView === "split") {
        const clickX = e.clientX - rect.left;
        const singleDocWidth = documentState.pageWidth * documentState.scale;
        const gap = 20; // Gap between documents

        if (clickX > singleDocWidth + gap) {
          clickedView = "translated";
        } else if (clickX <= singleDocWidth) {
          clickedView = "original";
        } else {
          return; // Click in gap - ignore
        }
      } else {
        clickedView =
          viewState.currentView === "translated" ? "translated" : "original";
      }

      // Convert screen coordinates to document coordinates
      const { x, y } = screenToDocumentCoordinates(
        e.clientX,
        e.clientY,
        rect,
        documentState.scale,
        clickedView,
        viewState.currentView,
        documentState.pageWidth
      );

      console.log("Selection start coordinates", { x, y, clickedView });

      setEditorState((prev) => ({
        ...prev,
        multiSelection: {
          ...prev.multiSelection,
          isDrawingSelection: true,
          selectionStart: { x, y },
          selectionEnd: { x, y },
        },
      }));

      // Clear previous selections unless holding Ctrl/Cmd
      if (!e.ctrlKey && !e.metaKey) {
        setEditorState((prev) => ({
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            selectedElements: [],
            selectionBounds: null,
            targetView: clickedView,
          },
        }));
      } else {
        // Update targetView even when adding to existing selection
        setEditorState((prev) => ({
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            targetView: clickedView,
          },
        }));
      }

      e.preventDefault();
    },
    [
      editorState.isSelectionMode,
      documentState.scale,
      viewState.currentView,
      documentState.pageWidth,
    ]
  );

  const handleMultiSelectionMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (
        !editorState.isSelectionMode ||
        !editorState.multiSelection.isDrawingSelection ||
        !editorState.multiSelection.selectionStart
      )
        return;

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Convert screen coordinates to document coordinates
      // Use the targetView from the current selection to ensure proper coordinate adjustment
      const { x, y } = screenToDocumentCoordinates(
        e.clientX,
        e.clientY,
        rect,
        documentState.scale,
        editorState.multiSelection.targetView,
        viewState.currentView,
        documentState.pageWidth
      );

      console.log("Selection move coordinates", {
        x,
        y,
        targetView: editorState.multiSelection.targetView,
      });

      setEditorState((prev) => ({
        ...prev,
        multiSelection: {
          ...prev.multiSelection,
          selectionEnd: { x, y },
        },
      }));

      e.preventDefault();
    },
    [
      editorState.isSelectionMode,
      editorState.multiSelection.isDrawingSelection,
      editorState.multiSelection.selectionStart,
      editorState.multiSelection.targetView,
      documentState.scale,
      viewState.currentView,
      documentState.pageWidth,
    ]
  );

  const handleMultiSelectionMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (
        !editorState.isSelectionMode ||
        !editorState.multiSelection.isDrawingSelection ||
        !editorState.multiSelection.selectionStart ||
        !editorState.multiSelection.selectionEnd
      )
        return;

      const start = editorState.multiSelection.selectionStart;
      const end = editorState.multiSelection.selectionEnd;

      // Calculate selection rectangle
      const selectionRect = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      };

      // Only process if selection is large enough
      if (selectionRect.width > 5 && selectionRect.height > 5) {
        // Check elements in both views for now
        const originalTextBoxes = getCurrentTextBoxes("original");
        const originalShapes = getCurrentShapes("original");
        const originalImages = getCurrentImages("original");
        const translatedTextBoxes = getCurrentTextBoxes("translated");
        const translatedShapes = getCurrentShapes("translated");
        const translatedImages = getCurrentImages("translated");

        console.log("Finding elements in selection", {
          selectionRect,
          originalTextBoxesCount: originalTextBoxes.length,
          originalShapesCount: originalShapes.length,
          originalImagesCount: originalImages.length,
          translatedTextBoxesCount: translatedTextBoxes.length,
          translatedShapesCount: translatedShapes.length,
          translatedImagesCount: translatedImages.length,
        });

        // Combine elements from both views
        const allTextBoxes = [...originalTextBoxes, ...translatedTextBoxes];
        const allShapes = [...originalShapes, ...translatedShapes];
        const allImages = [...originalImages, ...translatedImages];

        const selectedElements = findElementsInSelection(
          selectionRect,
          allTextBoxes,
          allShapes,
          allImages
        );

        console.log("Selected elements", selectedElements);

        // Update selection (merge with existing if Ctrl/Cmd held)
        if (e.ctrlKey || e.metaKey) {
          setEditorState((prev) => {
            const existingIds = new Set(
              prev.multiSelection.selectedElements.map((el) => el.id)
            );
            const newElements = selectedElements.filter(
              (el) => !existingIds.has(el.id)
            );
            const allElements = [
              ...prev.multiSelection.selectedElements,
              ...newElements,
            ];

            return {
              ...prev,
              multiSelection: {
                ...prev.multiSelection,
                selectedElements: allElements,
                selectionBounds: calculateSelectionBounds(
                  allElements,
                  getElementById
                ),
              },
            };
          });
        } else {
          setEditorState((prev) => ({
            ...prev,
            multiSelection: {
              ...prev.multiSelection,
              selectedElements,
              selectionBounds: calculateSelectionBounds(
                selectedElements,
                getElementById
              ),
            },
          }));
        }
      }

      // Reset drawing state
      setEditorState((prev) => ({
        ...prev,
        multiSelection: {
          ...prev.multiSelection,
          isDrawingSelection: false,
          selectionStart: null,
          selectionEnd: null,
        },
      }));

      e.preventDefault();
    },
    [
      editorState.isSelectionMode,
      editorState.multiSelection.isDrawingSelection,
      editorState.multiSelection.selectionStart,
      editorState.multiSelection.selectionEnd,
      getCurrentTextBoxes,
      getCurrentShapes,
      getCurrentImages,
    ]
  );

  // Move selected elements - start moving mode
  const handleMoveSelection = useCallback(() => {
    console.log("=== handleMoveSelection called - starting move mode ===");
    console.log("Current state:", {
      isSelectionMode: editorState.isSelectionMode,
      selectedElementsCount: editorState.multiSelection.selectedElements.length,
      isMovingSelection: editorState.multiSelection.isMovingSelection,
    });

    setEditorState((prev) => {
      console.log("Setting isMovingSelection to true");
      return {
        ...prev,
        multiSelection: {
          ...prev.multiSelection,
          isMovingSelection: true,
          moveStart: null,
        },
      };
    });
  }, [
    editorState.isSelectionMode,
    editorState.multiSelection.selectedElements.length,
    editorState.multiSelection.isMovingSelection,
  ]);

  // Delete selected elements
  const handleDeleteSelection = useCallback(() => {
    const { selectedElements } = editorState.multiSelection;

    selectedElements.forEach((selectedElement) => {
      switch (selectedElement.type) {
        case "textbox":
          handleDeleteTextBoxWithUndo(
            selectedElement.id,
            viewState.currentView
          );
          break;
        case "shape":
          handleDeleteShapeWithUndo(selectedElement.id, viewState.currentView);
          break;
        case "image":
          handleDeleteImageWithUndo(selectedElement.id, viewState.currentView);
          break;
      }
    });

    // Clear selection
    setEditorState((prev) => ({
      ...prev,
      multiSelection: {
        ...prev.multiSelection,
        selectedElements: [],
        selectionBounds: null,
      },
    }));

    // Also clear single element selection state
    setSelectedElementId(null);
    setSelectedElementType(null);
    setCurrentFormat(null);
    setIsDrawerOpen(false);
  }, [
    editorState.multiSelection.selectedElements,
    handleDeleteTextBoxWithUndo,
    handleDeleteShapeWithUndo,
    handleDeleteImageWithUndo,
    viewState.currentView,
    setSelectedElementId,
    setSelectedElementType,
    setCurrentFormat,
    setIsDrawerOpen,
  ]);

  // Handle drag stop for selection rectangle
  const handleDragStopSelection = useCallback(
    (deltaX: number, deltaY: number) => {
      console.log("=== handleDragStopSelection called ===", { deltaX, deltaY });

      // Move all selected elements by the final delta
      moveSelectedElements(
        editorState.multiSelection.selectedElements,
        deltaX,
        deltaY,
        (id, updates) => updateTextBoxWithUndo(id, updates, true), // Mark as ongoing operation
        (id, updates) => updateShapeWithUndo(id, updates, true), // Mark as ongoing operation
        updateImage,
        getElementById,
        documentState.pageWidth,
        documentState.pageHeight
      );

      // Update original positions and recalculate selection bounds
      setEditorState((prev) => {
        const updatedElements = prev.multiSelection.selectedElements.map(
          (el) => ({
            ...el,
            originalPosition: {
              x: el.originalPosition.x + deltaX,
              y: el.originalPosition.y + deltaY,
            },
          })
        );

        const newBounds = calculateSelectionBounds(
          updatedElements,
          getElementById
        );

        return {
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            selectedElements: updatedElements,
            selectionBounds: newBounds,
            isMovingSelection: false,
            moveStart: null,
          },
        };
      });
    },
    [
      editorState.multiSelection.selectedElements,
      updateTextBoxWithUndo,
      updateShape,
      updateImage,
      getElementById,
    ]
  );

  // Move selection mouse handlers
  const handleMoveSelectionMouseDown = useCallback(
    (e: React.MouseEvent) => {
      console.log("handleMoveSelectionMouseDown called", {
        isMovingSelection: editorState.multiSelection.isMovingSelection,
        button: e.button,
      });

      if (!editorState.multiSelection.isMovingSelection) {
        console.log("Not in moving selection mode, returning");
        return;
      }
      if (e.button !== 0) {
        console.log("Not left click, returning");
        return; // Only left click
      }

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) {
        console.log("No document rect, returning");
        return;
      }

      const { x, y } = screenToDocumentCoordinates(
        e.clientX,
        e.clientY,
        rect,
        documentState.scale,
        editorState.multiSelection.targetView,
        viewState.currentView,
        documentState.pageWidth
      );

      console.log("Move selection mouse down", {
        x,
        y,
        targetView: editorState.multiSelection.targetView,
      });

      setEditorState((prev) => ({
        ...prev,
        multiSelection: {
          ...prev.multiSelection,
          moveStart: { x, y },
        },
      }));

      e.preventDefault();
    },
    [
      editorState.multiSelection.isMovingSelection,
      editorState.multiSelection.targetView,
      documentState.scale,
      viewState.currentView,
      documentState.pageWidth,
    ]
  );

  const handleMoveSelectionMouseMove = useCallback(
    (e: React.MouseEvent) => {
      console.log("handleMoveSelectionMouseMove called", {
        isMovingSelection: editorState.multiSelection.isMovingSelection,
        hasMoveStart: !!editorState.multiSelection.moveStart,
      });

      if (
        !editorState.multiSelection.isMovingSelection ||
        !editorState.multiSelection.moveStart
      ) {
        console.log("Not in moving mode or no move start, returning");
        return;
      }

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      const { x, y } = screenToDocumentCoordinates(
        e.clientX,
        e.clientY,
        rect,
        documentState.scale,
        editorState.multiSelection.targetView,
        viewState.currentView,
        documentState.pageWidth
      );

      const deltaX = x - editorState.multiSelection.moveStart.x;
      const deltaY = y - editorState.multiSelection.moveStart.y;

      console.log("Move selection mouse move", {
        x,
        y,
        deltaX,
        deltaY,
        targetView: editorState.multiSelection.targetView,
      });

      // Move all selected elements
      console.log("Calling moveSelectedElements with", {
        selectedElementsCount:
          editorState.multiSelection.selectedElements.length,
        deltaX,
        deltaY,
      });

      moveSelectedElements(
        editorState.multiSelection.selectedElements,
        deltaX,
        deltaY,
        (id, updates) => updateTextBoxWithUndo(id, updates, true), // Mark as ongoing operation
        (id, updates) => updateShapeWithUndo(id, updates, true), // Mark as ongoing operation
        updateImage,
        getElementById,
        documentState.pageWidth,
        documentState.pageHeight
      );

      // Update original positions for next move
      setEditorState((prev) => ({
        ...prev,
        multiSelection: {
          ...prev.multiSelection,
          selectedElements: prev.multiSelection.selectedElements.map((el) => ({
            ...el,
            originalPosition: {
              x: el.originalPosition.x + deltaX,
              y: el.originalPosition.y + deltaY,
            },
          })),
          moveStart: { x, y },
        },
      }));

      e.preventDefault();
    },
    [
      editorState.multiSelection.isMovingSelection,
      editorState.multiSelection.moveStart,
      editorState.multiSelection.selectedElements,
      editorState.multiSelection.targetView,
      documentState.scale,
      viewState.currentView,
      documentState.pageWidth,
      updateTextBox,
      updateShape,
      updateImage,
      getElementById,
    ]
  );

  const handleMoveSelectionMouseUp = useCallback(() => {
    if (!editorState.multiSelection.isMovingSelection) return;

    console.log("Move selection mouse up");

    setEditorState((prev) => ({
      ...prev,
      multiSelection: {
        ...prev.multiSelection,
        isMovingSelection: false,
        moveStart: null,
      },
    }));
  }, [editorState.multiSelection.isMovingSelection]);

  // Document click handler
  const handleDocumentContainerClick = useCallback(
    (e: React.MouseEvent) => {
      console.log("Document click handler called");
      if (!documentRef.current) return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.closest(".rnd") ||
        target.closest(".selection-rectangle-rnd") ||
        target.closest(".text-format-drawer") ||
        target.closest(".element-format-drawer")
      ) {
        return;
      }

      const rect = documentRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Determine which view was clicked in split mode
      const targetView =
        viewState.currentView === "split"
          ? determineClickedView(
              clickX,
              documentState.pageWidth,
              documentState.scale
            )
          : null;

      // Convert to document coordinates
      const { x, y } = screenToDocumentCoordinates(
        e.clientX,
        e.clientY,
        rect,
        documentState.scale,
        targetView,
        viewState.currentView,
        documentState.pageWidth
      );

      if (editorState.isAddTextBoxMode) {
        const fieldId = handleAddTextBoxWithUndo(
          x,
          y,
          documentState.currentPage,
          viewState.currentView,
          targetView || undefined,
          undefined // Use default properties for new text fields
        );

        setEditorState((prev) => ({
          ...prev,
          selectedFieldId: fieldId,
          isAddTextBoxMode: false,
          isSelectionMode: false, // Turn off multi-selection mode
          // Clear multi-selection when creating a new textbox
          multiSelection: {
            ...prev.multiSelection,
            selectedElements: [],
            selectionBounds: null,
            isDrawingSelection: false,
            selectionStart: null,
            selectionEnd: null,
            isMovingSelection: false,
            moveStart: null,
          },
        }));
        setSelectedElementId(fieldId);
        setSelectedElementType("textbox");
        setIsDrawerOpen(true);
        setAutoFocusTextBoxId(fieldId);
      } else if (toolState.shapeDrawingMode) {
        if (!toolState.isDrawingInProgress) {
          const targetView =
            viewState.currentView === "split"
              ? determineClickedView(
                  e.clientX - rect.left,
                  documentState.pageWidth,
                  documentState.scale
                )
              : null;

          setToolState((prev) => ({
            ...prev,
            shapeDrawStart: { x, y },
            shapeDrawTargetView: targetView,
            isDrawingInProgress: true,
          }));
        }
      } else {
        // Don't clear selection if we're in multi-selection mode and have selected elements
        if (
          !target.closest(".rnd") &&
          !target.closest(".selection-rectangle-rnd") &&
          !(
            editorState.isSelectionMode &&
            editorState.multiSelection.selectedElements.length > 0
          )
        ) {
          setEditorState((prev) => ({
            ...prev,
            selectedFieldId: null,
            selectedShapeId: null,
            isSelectionMode: false, // Turn off multi-selection mode
            // Clear multi-selection when clicking outside elements
            multiSelection: {
              ...prev.multiSelection,
              selectedElements: [],
              selectionBounds: null,
              isDrawingSelection: false,
              selectionStart: null,
              selectionEnd: null,
              isMovingSelection: false,
              moveStart: null,
            },
          }));
          setSelectedElementId(null);
          setSelectedElementType(null);
          setCurrentFormat(null);
          setIsDrawerOpen(false);
        }
      }
    },
    [
      documentState,
      viewState.currentView,
      editorState.isAddTextBoxMode,
      editorState.isSelectionMode,
      editorState.multiSelection.selectedElements,
      toolState,
      addTextBox,
      setSelectedElementId,
      setSelectedElementType,
      setCurrentFormat,
      setIsDrawerOpen,
    ]
  );

  // Helper function to get file type
  const getFileType = useCallback((filename: string): "pdf" | "image" => {
    const extension = filename.split(".").pop()?.toLowerCase();
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
    return imageExtensions.includes(extension || "") ? "image" : "pdf";
  }, []);

  // Function to create a blank PDF and add an image as an interactive element
  const createBlankPdfAndAddImage = useCallback(
    async (imageFile: File) => {
      try {
        // Import pdf-lib dynamically to avoid SSR issues
        const { PDFDocument, rgb } = await import("pdf-lib");

        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();

        // Add a blank page (A4 size: 595.28 x 841.89 points)
        const page = pdfDoc.addPage([595.28, 841.89]);

        // Convert the PDF to bytes
        const pdfBytes = await pdfDoc.save();

        // Create a blob URL for the blank PDF
        const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

        // Convert Blob to File object
        const pdfFile = new File([pdfBlob], "blank-document.pdf", {
          type: "application/pdf",
        });

        // Load the blank PDF as the document
        actions.loadDocument(pdfFile);
        setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));

        // Create image URL and add as interactive element
        const imageUrl = URL.createObjectURL(imageFile);

        // Create a new image element
        const imageId = handleAddImageWithUndo(
          imageUrl,
          50, // Center the image on the page
          50,
          300, // Default size
          200,
          1, // Page 1
          "original" // Add to original view
        );

        // Select the image and open format drawer
        if (imageId) {
          handleImageSelect(imageId);
        }

        toast.success("Image uploaded as interactive element on blank PDF");
      } catch (error) {
        console.error("Error creating blank PDF:", error);
        toast.error("Failed to create blank PDF");
      }
    },
    [actions, handleAddImageWithUndo, handleImageSelect]
  );

  // Helper function to append an image as a new page
  const appendImageAsNewPage = useCallback(
    async (imageFile: File) => {
      try {
        // Import pdf-lib dynamically to avoid SSR issues
        const { PDFDocument } = await import("pdf-lib");

        // Load the current document
        const currentResponse = await fetch(documentState.url);
        const currentArrayBuffer = await currentResponse.arrayBuffer();
        const currentPdfDoc = await PDFDocument.load(currentArrayBuffer);

        // Add a new blank page (A4 size: 595.28 x 841.89 points)
        const newPage = currentPdfDoc.addPage([595.28, 841.89]);

        // Save the updated PDF as a new blob
        const updatedPdfBytes = await currentPdfDoc.save();
        const updatedBlob = new Blob([updatedPdfBytes], {
          type: "application/pdf",
        });

        // Convert Blob to File object
        const updatedFile = new File([updatedBlob], "updated-document.pdf", {
          type: "application/pdf",
        });

        // Load the updated PDF
        actions.loadDocument(updatedFile);

        // Create image URL and add as interactive element on the new page
        const imageUrl = URL.createObjectURL(imageFile);
        const newPageNumber = currentPdfDoc.getPageCount(); // The page we just added

        // Create a new image element
        const imageId = handleAddImageWithUndo(
          imageUrl,
          50, // Center the image on the page
          50,
          300, // Default size
          200,
          newPageNumber,
          "original" // Add to original view
        );

        // Select the image and open format drawer
        if (imageId) {
          handleImageSelect(imageId);
        }

        toast.success("Image appended as new page successfully!");
      } catch (error) {
        console.error("Error appending image:", error);
        toast.error("Failed to append image");
      }
    },
    [documentState.url, actions, handleAddImageWithUndo, handleImageSelect]
  );

  // Helper function to append a PDF document
  const appendPdfDocument = useCallback(
    async (pdfFile: File) => {
      try {
        // Import pdf-lib dynamically to avoid SSR issues
        const { PDFDocument } = await import("pdf-lib");

        // Load the current document
        const currentResponse = await fetch(documentState.url);
        const currentArrayBuffer = await currentResponse.arrayBuffer();
        const currentPdfDoc = await PDFDocument.load(currentArrayBuffer);

        // Load the new document to append
        const newArrayBuffer = await pdfFile.arrayBuffer();
        const newPdfDoc = await PDFDocument.load(newArrayBuffer);

        // Copy all pages from the new document to the current document
        const newPages = await currentPdfDoc.copyPages(
          newPdfDoc,
          newPdfDoc.getPageIndices()
        );
        newPages.forEach((page) => currentPdfDoc.addPage(page));

        // Save the merged PDF as a new blob
        const mergedPdfBytes = await currentPdfDoc.save();
        const mergedBlob = new Blob([mergedPdfBytes], {
          type: "application/pdf",
        });

        // Convert Blob to File object
        const mergedFile = new File([mergedBlob], "merged-document.pdf", {
          type: "application/pdf",
        });

        // Load the merged PDF
        actions.loadDocument(mergedFile);

        toast.success("PDF document appended successfully!");
      } catch (error) {
        console.error("Error appending PDF:", error);
        toast.error("Failed to append PDF document");
      }
    },
    [documentState.url, actions]
  );

  // File handlers
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const fileType = getFileType(file.name);

        if (fileType === "image") {
          // For images, create a blank PDF and add the image as an interactive element
          createBlankPdfAndAddImage(file);
        } else {
          // For PDFs, load normally
          actions.loadDocument(file);
          setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));
        }
      }
    },
    [getFileType, createBlankPdfAndAddImage, actions]
  );

  const handleImageFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);

        const imageId = handleAddImageWithUndo(
          url,
          100,
          100,
          200,
          150,
          documentState.currentPage,
          viewState.currentView
        );

        if (imageId) {
          handleImageSelect(imageId);
        }

        if (imageInputRef.current) {
          imageInputRef.current.value = "";
        }

        toast.success("Image added to document");
      }
    },
    [
      handleAddImageWithUndo,
      documentState.currentPage,
      viewState.currentView,
      handleImageSelect,
    ]
  );

  // Handler for appending documents to existing document
  const handleAppendDocument = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const fileType = getFileType(file.name);

      if (!documentState.url) {
        toast.error("Please upload a document first before appending.");
        return;
      }

      try {
        if (fileType === "image") {
          // For images, add a new page with the image as an interactive element
          await appendImageAsNewPage(file);
        } else {
          // For PDFs, merge the documents
          await appendPdfDocument(file);
        }

        // Switch to pages tab
        setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));
      } catch (error) {
        console.error("Error appending document:", error);
        toast.error("Failed to append document. Please try again.");
      } finally {
        // Reset file input
        if (appendFileInputRef.current) {
          appendFileInputRef.current.value = "";
        }
      }
    },
    [getFileType, documentState.url, appendImageAsNewPage, appendPdfDocument]
  );

  // Page handlers
  const handlePageChange = useCallback(
    (page: number) => {
      actions.changePage(page);
    },
    [actions]
  );

  const handlePageDelete = useCallback(
    (pageNumber: number) => {
      const remainingPages =
        documentState.numPages - pageState.deletedPages.size;

      if (remainingPages <= 1) {
        toast.error("Cannot delete the last remaining page");
        return;
      }

      setPageState((prev) => ({
        ...prev,
        deletedPages: new Set([...prev.deletedPages, pageNumber]),
      }));

      toast.success(`Page ${pageNumber} deleted`);
    },
    [documentState.numPages, pageState.deletedPages]
  );

  // Transform page to textbox functionality
  const handleTransformPageToTextbox = useCallback(
    async (pageNumber: number) => {
      const previousView = viewState.currentView; // Store current view

      try {
        console.log("Starting transform for page:", pageNumber);

        // Set transforming state
        setPageState((prev) => ({
          ...prev,
          isTransforming: true,
        }));

        // Switch to original view
        setViewState((prev) => ({ ...prev, currentView: "original" }));

        // Wait for the view change to apply and document to render
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Get the document element after view change
        const documentElement = documentRef.current;
        if (!documentElement) {
          throw new Error("Document element not found");
        }

        // Get the PDF page element
        const pdfPage = documentElement.querySelector(
          ".react-pdf__Page"
        ) as HTMLElement;
        if (!pdfPage) {
          throw new Error("PDF page element not found");
        }

        // --- BEGIN: Calculate PDF offset in container ---
        if (!containerRef.current) {
          throw new Error("Container element not found");
        }
        const containerRect = containerRef.current.getBoundingClientRect();
        const pdfRect = pdfPage.getBoundingClientRect();
        const offsetLeft = pdfRect.left - containerRect.left;
        const centerOffsetX = (containerRect.width - pdfRect.width) / 2 + 30; // +30 moves it 30 points to the right
        const offsetTop = pdfRect.top - containerRect.top + 20;
        // --- END: Calculate PDF offset in container ---

        // Temporarily set scale to 500% for better OCR
        const originalScale = documentState.scale;
        const captureScale = 5;

        // Save original state
        const wasAddTextBoxMode = editorState.isAddTextBoxMode;
        setEditorState((prev) => ({ ...prev, isAddTextBoxMode: false }));

        // Set the scale
        actions.updateScale(captureScale);

        // Wait for the scale change to apply
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Import html2canvas dynamically
        const html2canvasModule = await import("html2canvas");
        const html2canvas = html2canvasModule.default;

        // Capture the PDF page as an image
        const containerEl = documentRef.current;
        if (!containerEl) throw new Error("Document container not found");
        const canvas = await html2canvas(containerEl, {
          scale: 1,
          logging: false,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          ignoreElements: (element) => {
            // Optionally ignore toolbars, sidebars, etc.
            return (
              element.classList.contains("text-format-drawer") ||
              element.classList.contains("element-format-drawer")
            );
          },
        });

        // Reset scale
        actions.updateScale(originalScale);
        setEditorState((prev) => ({
          ...prev,
          isAddTextBoxMode: wasAddTextBoxMode,
        }));

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
          }, "image/png");
        });

        // Create FormData and send to API
        const formData = new FormData();
        formData.append("file", blob, `page-${pageNumber}.png`);
        formData.append("page_number", "1");

        // Send frontend document dimensions to backend for accurate coordinate calculations
        formData.append(
          "frontend_page_width",
          documentState.pageWidth.toString()
        );
        formData.append(
          "frontend_page_height",
          documentState.pageHeight.toString()
        );
        formData.append("frontend_scale", documentState.scale.toString());

        console.log("Sending frontend dimensions to backend:", {
          pageWidth: documentState.pageWidth,
          pageHeight: documentState.pageHeight,
          scale: documentState.scale,
        });

        // Call the OCR API using our centralized API
        const { processFile } = await import("@/lib/api");

        console.log("=== OCR API REQUEST DEBUG ===");
        console.log("FormData details:", {
          fileSize: blob.size,
          fileName: `page-${pageNumber}.png`,
          formDataEntries: Array.from(formData.entries()).map(
            ([key, value]) => ({
              key,
              valueType: typeof value,
              valueSize: value instanceof Blob ? value.size : "N/A",
            })
          ),
        });
        console.log("Blob details:", {
          size: blob.size,
          type: blob.type,
        });

        let data;
        try {
          console.log("Calling processFile API...");
          data = await processFile(formData);
          console.log("=== OCR API SUCCESS ===");
          console.log("OCR API response:", data);
          console.log("Response keys:", Object.keys(data));

          // --- BEGIN: DETAILED RESPONSE DEBUG ---
          console.log("=== DETAILED RESPONSE DEBUG ===");
          if (data.styled_layout) {
            console.log("Styled layout structure:", {
              hasDocumentInfo: !!data.styled_layout.document_info,
              hasPages: !!data.styled_layout.pages,
              pagesCount: data.styled_layout.pages?.length || 0,
            });

            if (
              data.styled_layout.pages &&
              data.styled_layout.pages.length > 0
            ) {
              const firstPage = data.styled_layout.pages[0];
              console.log("First page structure:", {
                hasEntities: !!firstPage.entities,
                entitiesCount: firstPage.entities?.length || 0,
              });

              if (firstPage.entities && firstPage.entities.length > 0) {
                console.log("Sample entity structure:", firstPage.entities[0]);
                console.log(
                  "All entities:",
                  firstPage.entities.map((entity: any, index: number) => ({
                    index,
                    type: entity.type,
                    text: entity.text?.substring(0, 50) + "...",
                    hasStyling: !!entity.styling,
                    hasDimensions: !!entity.dimensions,
                    colors: entity.styling?.colors || "No colors",
                  }))
                );
              }
            }
          }
          console.log("=== END DETAILED RESPONSE DEBUG ===");
          // --- END: DETAILED RESPONSE DEBUG ---

          // --- BEGIN: PAGE DIMENSIONS DEBUG ---
          console.log("=== FRONTEND PAGE DIMENSIONS DEBUG ===");
          console.log("Frontend documentState dimensions:", {
            pageWidth: documentState.pageWidth,
            pageHeight: documentState.pageHeight,
            scale: documentState.scale,
          });

          if (data.styled_layout) {
            console.log("Styled layout keys:", Object.keys(data.styled_layout));
            if (data.styled_layout.document_info) {
              console.log(
                "Backend returned document_info:",
                data.styled_layout.document_info
              );
              console.log("Backend page dimensions:", {
                width: data.styled_layout.document_info.page_width,
                height: data.styled_layout.document_info.page_height,
              });
            }
            if (data.styled_layout.pages) {
              console.log("Pages count:", data.styled_layout.pages.length);
            }
          }

          if (data.layout) {
            console.log("Layout keys:", Object.keys(data.layout));
            if (data.layout.document_info) {
              console.log(
                "Backend layout document_info:",
                data.layout.document_info
              );
            }
            if (data.layout.pages) {
              console.log("Layout pages count:", data.layout.pages.length);
            }
          }
          console.log("=== END FRONTEND PAGE DIMENSIONS DEBUG ===");
          // --- END: PAGE DIMENSIONS DEBUG ---
        } catch (error: any) {
          console.error("=== OCR API ERROR ===");
          console.error("Error object:", error);
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);

          if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response statusText:", error.response.statusText);
            console.error("Response headers:", error.response.headers);
            console.error("Response data:", error.response.data);

            // For axios errors, the response data is already parsed
            if (error.response.data) {
              console.error("Response data:", error.response.data);
              if (error.response.data.detail) {
                console.error("Error detail:", error.response.data.detail);
              }
            }
          }

          if (error.request) {
            console.error("Request details:", error.request);
          }

          throw error;
        }

        // Extract entities from the response (handle both old and new API formats)
        let entities: any[] = [];

        if (
          data.styled_layout &&
          data.styled_layout.pages &&
          data.styled_layout.pages.length > 0
        ) {
          // New API format
          entities = data.styled_layout.pages[0].entities || [];
        } else if (
          data.layout &&
          data.layout.pages &&
          data.layout.pages.length > 0
        ) {
          // Old API format
          entities = data.layout.pages[0].entities || [];
        }

        if (entities.length > 0) {
          console.log(`Processing ${entities.length} entities`);
          // Convert entities to textboxes
          const newTextBoxes: TextField[] = [];

          entities.forEach((entity: any) => {
            if (
              !entity.bounding_poly ||
              !entity.bounding_poly.vertices ||
              entity.bounding_poly.vertices.length < 4
            ) {
              return;
            }

            // Use the styled entity dimensions if available, otherwise calculate from vertices
            let x, y, width, height;

            // Use pre-calculated dimensions from styled entity
            // The backend now provides coordinates in frontend coordinate system (top-left origin)
            // No additional Y-flip needed since backend already converted from PDF to frontend system
            const pdfPageHeight = documentState.pageHeight;
            const pdfPageWidth = documentState.pageWidth;

            x = entity.dimensions.box_x;
            width = entity.dimensions.box_width;
            height = entity.dimensions.box_height;
            // Use the Y coordinate directly from backend (already in frontend coordinate system)
            y = entity.dimensions.box_y;

            console.log(
              `Using dimensions object: x=${x}, y=${y}, w=${width}, h=${height}`
            );
            console.log(
              `Backend provided coordinates: box_x=${entity.dimensions.box_x}, box_y=${entity.dimensions.box_y}`
            );
            console.log(
              `Document dimensions: pageWidth=${pdfPageWidth}, pageHeight=${pdfPageHeight}`
            );

            // --- BEGIN: COORDINATE CONVERSION DEBUG ---
            console.log("=== COORDINATE CONVERSION DEBUG ===");
            console.log("Backend entity.dimensions:", {
              box_x: entity.dimensions.box_x,
              box_y: entity.dimensions.box_y,
              box_width: entity.dimensions.box_width,
              box_height: entity.dimensions.box_height,
            });
            console.log("PDF page dimensions:", {
              width: pdfPageWidth,
              height: pdfPageHeight,
            });
            console.log(
              "Using backend coordinates directly (no Y-flip needed):",
              {
                x: entity.dimensions.box_x,
                y: entity.dimensions.box_y,
                width: entity.dimensions.box_width,
                height: entity.dimensions.box_height,
              }
            );
            console.log("Final coordinates:", { x, y, width, height });
            console.log("=== END COORDINATE CONVERSION DEBUG ===");
            // --- END: COORDINATE CONVERSION DEBUG ---

            // Extract styling information from styled entity (handle both old and new formats)
            const styling = entity.styling || entity.style || {};
            const colors = styling.colors || {};

            // --- BEGIN: COLOR PROCESSING DEBUG ---
            console.log(
              `=== COLOR PROCESSING DEBUG for entity "${entity.type}" ===`
            );
            console.log("Raw styling object:", styling);
            console.log("Raw colors object:", colors);
            console.log("Entity text:", entity.text?.substring(0, 50) + "...");
            // --- END: COLOR PROCESSING DEBUG ---

            // Handle both old format (style) and new format (styling)
            const getStyleValue = (key: string, fallback: any = null) => {
              return styling[key] !== undefined ? styling[key] : fallback;
            };

            // Convert RGB/RGBA colors to hex (handles both object and array formats)
            const rgbToHex = (
              rgb:
                | {
                    r: number;
                    g: number;
                    b: number;
                    a?: number;
                  }
                | number[]
            ): string => {
              if (!rgb) return "#000000";

              let r: number,
                g: number,
                b: number,
                a: number = 1;

              if (Array.isArray(rgb)) {
                // Handle array format [r, g, b, a?] (0-1 range)
                r = Math.round(rgb[0] * 255);
                g = Math.round(rgb[1] * 255);
                b = Math.round(rgb[2] * 255);
                a = rgb[3] !== undefined ? rgb[3] : 1;
              } else {
                // Handle object format {r, g, b, a?} (0-1 range)
                r = Math.round(rgb.r * 255);
                g = Math.round(rgb.g * 255);
                b = Math.round(rgb.b * 255);
                a = rgb.a !== undefined ? rgb.a : 1;
              }

              // If alpha is less than 1, return transparent
              if (a < 1) {
                return "transparent";
              }

              return `#${r.toString(16).padStart(2, "0")}${g
                .toString(16)
                .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
            };

            // Handle both old and new color property names
            // For background colors, handle RGBA properly
            const backgroundColor = colors.background_color
              ? (() => {
                  const color = colors.background_color;
                  if (!color) return "transparent";

                  // Handle RGBA object format {r, g, b, a}
                  if (typeof color === "object" && "r" in color) {
                    const { r, g, b, a = 1 } = color;
                    // If alpha is less than 1, return transparent
                    if (a < 1) return "transparent";
                    return `#${Math.round(r * 255)
                      .toString(16)
                      .padStart(2, "0")}${Math.round(g * 255)
                      .toString(16)
                      .padStart(2, "0")}${Math.round(b * 255)
                      .toString(16)
                      .padStart(2, "0")}`;
                  }

                  // Handle array format [r, g, b, a]
                  if (Array.isArray(color)) {
                    const [r, g, b, a = 1] = color;
                    if (a < 1) return "transparent";
                    return `#${Math.round(r * 255)
                      .toString(16)
                      .padStart(2, "0")}${Math.round(g * 255)
                      .toString(16)
                      .padStart(2, "0")}${Math.round(b * 255)
                      .toString(16)
                      .padStart(2, "0")}`;
                  }

                  return "transparent";
                })()
              : "transparent";

            // --- BEGIN: COLOR CONVERSION RESULTS DEBUG ---
            console.log("Color conversion results:", {
              backgroundColor,
              background_color_input: colors.background_color,
              textColor_input: colors.fill_color || colors.text_color,
            });
            // --- END: COLOR CONVERSION RESULTS DEBUG ---

            const textColor =
              colors.fill_color || colors.text_color
                ? rgbToHex(colors.fill_color || colors.text_color)
                : "#000000";
            const borderColor = colors.border_color
              ? rgbToHex(colors.border_color)
              : "#000000";
            const borderWidth = colors.border_color ? 1 : 0;
            const borderRadius =
              styling.background?.border_radius ||
              getStyleValue("border_radius", 0);
            const padding = getStyleValue(
              "text_padding",
              getStyleValue("padding", 0)
            );
            const fontWeight =
              getStyleValue("font_family", "") === "Helvetica-Bold" ||
              getStyleValue("font_weight") === "bold";
            const textAlign = getStyleValue(
              "text_alignment",
              getStyleValue("alignment", "left")
            );

            // Use styled entity information for text dimensions and font size
            const lineHeight = getStyleValue("line_spacing", 1.2);
            const textPadding = getStyleValue("text_padding", 5);
            const estimatedFontSize = getStyleValue("font_size", 12);
            const textLines = getStyleValue(
              "text_lines",
              (entity.text || "").split("\n")
            );
            const numberOfLines = getStyleValue("line_count", textLines.length);

            // Find the longest line
            let longestLine = "";
            for (const line of textLines) {
              if (line.length > longestLine.length) {
                longestLine = line;
              }
            }

            // Calculate text dimensions using our measureText function
            const { width: textWidth, height: textHeight } = measureText(
              longestLine,
              estimatedFontSize,
              styling.font_family || "Arial, sans-serif",
              0, // characterSpacing
              undefined, // maxWidth
              { top: 0, right: 0, bottom: 0, left: 0 } // padding
            );

            // Use styled entity dimensions if available, otherwise calculate from vertices
            if (!entity.dimensions) {
              // Fallback: calculate from bounding_poly vertices
              const vertices = entity.bounding_poly.vertices;

              // Calculate from vertices (these are normalized 0-1 coordinates)
              const minX =
                Math.min(...vertices.map((v: any) => v.x)) * pdfPageWidth;
              const maxX =
                Math.max(...vertices.map((v: any) => v.x)) * pdfPageWidth;
              const minY =
                Math.min(...vertices.map((v: any) => v.y)) * pdfPageHeight;
              const maxY =
                Math.max(...vertices.map((v: any) => v.y)) * pdfPageHeight;

              x = minX;
              // Convert Y coordinate from PDF system to frontend system
              // Backend should handle this, but for fallback we do it here
              y = pdfPageHeight - maxY;
              width = maxX - minX;
              height = maxY - minY;

              console.log(
                `Fallback calculation from vertices: x=${x}, y=${y}, w=${width}, h=${height}`
              );

              console.log(
                `Fallback calculation from vertices: x=${x}, y=${y}, w=${width}, h=${height}`
              );
            } else {
              // Use the dimensions we calculated above
              console.log(
                `Using entity.dimensions: x=${x}, y=${y}, w=${width}, h=${height}`
              );
            }

            // Add border space if present
            if (borderWidth > 0) {
              width += borderWidth * 2;
              height += borderWidth * 2;
            }

            const newTextBox: TextField = {
              id: generateUUID(),
              x: x,
              y: y, // Use coordinates directly without Y-flip
              width: width,
              height: height,
              value: entity.text || "",
              fontSize: getStyleValue("font_size", 12),
              fontFamily: getStyleValue("font_family", "Arial, sans-serif"),
              page: pageNumber,
              color: textColor || "#000000",
              bold: !!(getStyleValue("bold", false) || fontWeight),
              italic: !!getStyleValue("italic", false),
              underline: !!getStyleValue("underline", false),
              textAlign: textAlign as "left" | "center" | "right" | "justify",
              listType: "none",
              letterSpacing: getStyleValue("letter_spacing", 0),
              lineHeight: getStyleValue("line_spacing", 1.2),
              rotation: 0,
              backgroundColor: backgroundColor || "transparent",
              borderColor: borderColor || "#000000",
              borderWidth: borderWidth || 0,
              borderRadius: borderRadius || 0,
              borderTopLeftRadius: getStyleValue(
                "border_top_left_radius",
                borderRadius || 0
              ),
              borderTopRightRadius: getStyleValue(
                "border_top_right_radius",
                borderRadius || 0
              ),
              borderBottomLeftRadius: getStyleValue(
                "border_bottom_left_radius",
                borderRadius || 0
              ),
              borderBottomRightRadius: getStyleValue(
                "border_bottom_right_radius",
                borderRadius || 0
              ),
              paddingTop: padding || 0,
              paddingRight: padding || 0,
              paddingBottom: padding || 0,
              paddingLeft: padding || 0,
              isEditing: false,
            };

            // --- BEGIN: TEXTBOX CREATION DEBUG ---
            console.log("Created textbox:", {
              id: newTextBox.id,
              type: entity.type,
              text: newTextBox.value.substring(0, 50) + "...",
              position: { x: newTextBox.x, y: newTextBox.y },
              size: { width: newTextBox.width, height: newTextBox.height },
              colors: {
                text: newTextBox.color,
                background: newTextBox.backgroundColor,
                border: newTextBox.borderColor,
              },
              styling: {
                fontSize: newTextBox.fontSize,
                fontFamily: newTextBox.fontFamily,
                bold: newTextBox.bold,
                textAlign: newTextBox.textAlign,
              },
            });
            console.log("=== END COLOR PROCESSING DEBUG ===");
            // --- END: TEXTBOX CREATION DEBUG ---

            newTextBoxes.push(newTextBox);
          });

          // Add all textboxes to the translated view using our undo system
          newTextBoxes.forEach((textbox) => {
            handleAddTextBoxWithUndo(
              textbox.x,
              textbox.y,
              textbox.page,
              "translated",
              "translated",
              {
                value: textbox.value,
                fontSize: textbox.fontSize,
                fontFamily: textbox.fontFamily,
                color: textbox.color,
                bold: textbox.bold,
                italic: textbox.italic,
                underline: textbox.underline,
                textAlign: textbox.textAlign,
                letterSpacing: textbox.letterSpacing,
                lineHeight: textbox.lineHeight,
                width: textbox.width,
                height: textbox.height,
                borderColor: textbox.borderColor,
                borderWidth: textbox.borderWidth,
                backgroundColor: textbox.backgroundColor,
                borderRadius: textbox.borderRadius,
                borderTopLeftRadius: textbox.borderTopLeftRadius,
                borderTopRightRadius: textbox.borderTopRightRadius,
                borderBottomLeftRadius: textbox.borderBottomLeftRadius,
                borderBottomRightRadius: textbox.borderBottomRightRadius,
                paddingTop: textbox.paddingTop,
                paddingRight: textbox.paddingRight,
                paddingBottom: textbox.paddingBottom,
                paddingLeft: textbox.paddingLeft,
              }
            );
          });

          // Mark the page as translated
          setPageState((prev) => ({
            ...prev,
            isPageTranslated: new Map(
              prev.isPageTranslated.set(pageNumber, true)
            ),
            isTransforming: false,
          }));

          console.log(
            `Transformed ${newTextBoxes.length} entities into textboxes`
          );
          toast.success(
            `Transformed ${newTextBoxes.length} entities into textboxes`
          );

          // Switch back to the previous view
          setViewState((prev) => ({ ...prev, currentView: previousView }));
        } else {
          console.warn("No entities found in API response");
          toast.error("No text entities found in the document");
        }
      } catch (error) {
        console.error("Error transforming page to textboxes:", error);
        toast.error("Failed to transform page to textboxes");

        // Reset transforming state on error
        setPageState((prev) => ({
          ...prev,
          isTransforming: false,
        }));

        // Reset view if error occurred
        setViewState((prev) => ({ ...prev, currentView: previousView }));
      }
    },
    [
      handleAddTextBoxWithUndo,
      documentState.scale,
      documentState.pageWidth,
      documentState.pageHeight,
      viewState.currentView,
      editorState.isAddTextBoxMode,
      actions,
    ]
  );

  // Reset translation state for a specific page
  const handleResetPageTranslation = useCallback(
    (pageNumber: number) => {
      // Remove all translated elements for this page
      const translatedTextBoxes = getCurrentTextBoxes("translated").filter(
        (tb) => tb.page === pageNumber
      );
      const translatedShapes = getCurrentShapes("translated").filter(
        (s) => s.page === pageNumber
      );
      const translatedImages = getCurrentImages("translated").filter(
        (img) => img.page === pageNumber
      );

      // Delete all translated elements for this page
      translatedTextBoxes.forEach((tb) => {
        deleteTextBox(tb.id, "translated");
      });
      translatedShapes.forEach((s) => {
        deleteShape(s.id, "translated");
      });
      translatedImages.forEach((img) => {
        deleteImage(img.id, "translated");
      });

      // Mark the page as not translated
      setPageState((prev) => ({
        ...prev,
        isPageTranslated: new Map(prev.isPageTranslated.set(pageNumber, false)),
      }));

      toast.success(`Page ${pageNumber} translation reset`);
    },
    [
      getCurrentTextBoxes,
      getCurrentShapes,
      getCurrentImages,
      deleteTextBox,
      deleteShape,
      deleteImage,
    ]
  );

  // Clear all translations
  const handleClearAllTranslations = useCallback(() => {
    // Remove all translated elements
    const allTranslatedTextBoxes = getCurrentTextBoxes("translated");
    const allTranslatedShapes = getCurrentShapes("translated");
    const allTranslatedImages = getCurrentImages("translated");

    // Delete all translated elements
    allTranslatedTextBoxes.forEach((tb) => {
      deleteTextBox(tb.id, "translated");
    });
    allTranslatedShapes.forEach((s) => {
      deleteShape(s.id, "translated");
    });
    allTranslatedImages.forEach((img) => {
      deleteImage(img.id, "translated");
    });

    // Reset all page translation states
    setPageState((prev) => ({
      ...prev,
      isPageTranslated: new Map(),
    }));

    toast.success("All translations cleared");
  }, [
    getCurrentTextBoxes,
    getCurrentShapes,
    getCurrentImages,
    deleteTextBox,
    deleteShape,
    deleteImage,
  ]);

  // Project management
  const saveProject = useCallback(() => {
    localStorage.setItem(
      "pdf-editor-project",
      JSON.stringify({
        elementCollections,
        layerState,
        documentUrl: documentState.url,
        currentPage: documentState.currentPage,
      })
    );
    toast.success("Project saved!");
  }, [elementCollections, layerState, documentState]);

  const exportData = useCallback(() => {
    const data = {
      ...elementCollections,
      documentInfo: {
        url: documentState.url,
        currentPage: documentState.currentPage,
        numPages: documentState.numPages,
        scale: documentState.scale,
        pageWidth: documentState.pageWidth,
        pageHeight: documentState.pageHeight,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pdf-editor-data.json";
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Data exported successfully!");
  }, [elementCollections, documentState]);

  // Effects
  useEffect(() => {
    setLayerOrderFunctions({
      moveToFront: (id) => moveToFront(id, viewState.currentView),
      moveToBack: (id) => moveToBack(id, viewState.currentView),
      moveForward: (id) => moveForward(id, viewState.currentView),
      moveBackward: (id) => moveBackward(id, viewState.currentView),
    });
  }, [
    moveToFront,
    moveToBack,
    moveForward,
    moveBackward,
    viewState.currentView,
    setLayerOrderFunctions,
  ]);

  useEffect(() => {
    setLayerPositionHelpers({
      isElementAtFront: (id) => isElementAtFront(id, viewState.currentView),
      isElementAtBack: (id) => isElementAtBack(id, viewState.currentView),
    });
  }, [
    isElementAtFront,
    isElementAtBack,
    viewState.currentView,
    setLayerPositionHelpers,
  ]);

  // Add effect to monitor drawer state for debugging
  useEffect(() => {
    console.log("Drawer state changed:", {
      isDrawerOpen,
      selectedElementType,
      currentFormat,
      selectedElementId,
    });
  }, [isDrawerOpen, selectedElementType, currentFormat, selectedElementId]);

  // Add effect to monitor multi-selection state for debugging
  useEffect(() => {
    console.log("Multi-selection state changed:", {
      selectedElementsCount: editorState.multiSelection.selectedElements.length,
      isDrawingSelection: editorState.multiSelection.isDrawingSelection,
      isMovingSelection: editorState.multiSelection.isMovingSelection,
      selectionBounds: editorState.multiSelection.selectionBounds,
    });
  }, [editorState.multiSelection]);

  // Add effect to monitor page translation state for debugging
  useEffect(() => {
    console.log("Page translation state changed:", {
      currentPage: documentState.currentPage,
      isPageTranslated: pageState.isPageTranslated.get(
        documentState.currentPage
      ),
      allTranslatedPages: Array.from(pageState.isPageTranslated.entries()),
      isTransforming: pageState.isTransforming,
    });
  }, [
    pageState.isPageTranslated,
    pageState.isTransforming,
    documentState.currentPage,
  ]);

  // Cleanup effect to clear any remaining debounce timers
  useEffect(() => {
    return () => {
      // Clear all debounce timers on unmount
      Object.values(debounceTimersRef.current).forEach((timer) => {
        clearTimeout(timer);
      });
      debounceTimersRef.current = {};
      ongoingOperationsRef.current = {};
    };
  }, []);

  // Render elements
  const renderElement = (element: SortedElement) => {
    // Get elements that would be captured in the current selection preview
    const elementsInSelectionPreview = getElementsInSelectionPreview();

    if (element.type === "textbox") {
      const textBox = element.element as TextField;
      const isMultiSelected = editorState.multiSelection.selectedElements.some(
        (el) => el.id === textBox.id
      );
      const selectedElementIds =
        editorState.multiSelection.selectedElements.map((el) => el.id);
      const isInSelectionPreview = elementsInSelectionPreview.has(textBox.id);

      return (
        <MemoizedTextBox
          key={textBox.id}
          textBox={textBox}
          isSelected={editorState.selectedFieldId === textBox.id}
          isEditMode={editorState.isEditMode}
          scale={documentState.scale}
          showPaddingIndicator={showPaddingPopup}
          onSelect={handleTextBoxSelect}
          onUpdate={updateTextBoxWithUndo}
          onDelete={(id) =>
            handleDeleteTextBoxWithUndo(id, viewState.currentView)
          }
          isTextSelectionMode={editorState.isTextSelectionMode}
          isSelectedInTextMode={selectionState.selectedTextBoxes.textBoxIds.includes(
            textBox.id
          )}
          autoFocusId={autoFocusTextBoxId}
          onAutoFocusComplete={handleAutoFocusComplete}
          // Multi-selection props
          isMultiSelected={isMultiSelected}
          selectedElementIds={selectedElementIds}
          onMultiSelectDragStart={handleMultiSelectDragStart}
          onMultiSelectDrag={handleMultiSelectDrag}
          onMultiSelectDragStop={handleMultiSelectDragStop}
          // Selection preview prop
          isInSelectionPreview={isInSelectionPreview}
        />
      );
    } else if (element.type === "shape") {
      const shape = element.element as ShapeType;
      const isInSelectionPreview = elementsInSelectionPreview.has(shape.id);

      return (
        <MemoizedShape
          key={shape.id}
          shape={shape}
          isSelected={editorState.selectedShapeId === shape.id}
          isEditMode={editorState.isEditMode}
          scale={documentState.scale}
          onSelect={handleShapeSelect}
          onUpdate={updateShapeWithUndo}
          onDelete={(id) =>
            handleDeleteShapeWithUndo(id, viewState.currentView)
          }
          // Selection preview prop
          isInSelectionPreview={isInSelectionPreview}
        />
      );
    } else if (element.type === "image") {
      const image = element.element as ImageType;
      const isInSelectionPreview = elementsInSelectionPreview.has(image.id);

      return (
        <MemoizedImage
          key={image.id}
          image={image}
          isSelected={selectedElementId === image.id}
          isEditMode={editorState.isEditMode}
          scale={documentState.scale}
          onSelect={handleImageSelect}
          onUpdate={updateImage}
          onDelete={(id) =>
            handleDeleteImageWithUndo(id, viewState.currentView)
          }
          // Selection preview prop
          isInSelectionPreview={isInSelectionPreview}
        />
      );
    }
    return null;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <PDFEditorHeader
        isSidebarCollapsed={viewState.isSidebarCollapsed}
        onSidebarToggle={() =>
          setViewState((prev) => ({
            ...prev,
            isSidebarCollapsed: !prev.isSidebarCollapsed,
          }))
        }
        onFileUpload={() => fileInputRef.current?.click()}
        onSaveProject={saveProject}
        onExportData={exportData}
        onUndo={() => {
          const now = Date.now();
          if (now - lastUndoTime < UNDO_REDO_DEBOUNCE_MS) {
            console.log("Undo button debounced - too soon since last undo");
            return;
          }
          console.log(
            "Undo button clicked, canUndo:",
            history.canUndo(documentState.currentPage, viewState.currentView)
          );
          if (
            history.canUndo(documentState.currentPage, viewState.currentView)
          ) {
            history.undo(documentState.currentPage, viewState.currentView);
            setLastUndoTime(now);
            toast.success("Undo");
          }
        }}
        onRedo={() => {
          const now = Date.now();
          if (now - lastRedoTime < UNDO_REDO_DEBOUNCE_MS) {
            console.log("Redo button debounced - too soon since last redo");
            return;
          }
          console.log(
            "Redo button clicked, canRedo:",
            history.canRedo(documentState.currentPage, viewState.currentView)
          );
          if (
            history.canRedo(documentState.currentPage, viewState.currentView)
          ) {
            history.redo(documentState.currentPage, viewState.currentView);
            setLastRedoTime(now);
            toast.success("Redo");
          }
        }}
        canUndo={history.canUndo(
          documentState.currentPage,
          viewState.currentView
        )}
        canRedo={history.canRedo(
          documentState.currentPage,
          viewState.currentView
        )}
        onClearAllTranslations={handleClearAllTranslations}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Hidden file inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
          className="hidden"
        />
        <input
          type="file"
          ref={imageInputRef}
          onChange={handleImageFileUpload}
          accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
          className="hidden"
        />
        <input
          type="file"
          ref={appendFileInputRef}
          onChange={handleAppendDocument}
          accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
          className="hidden"
        />

        {/* Sidebar */}
        <PDFEditorSidebar
          viewState={viewState}
          documentState={documentState}
          pageState={pageState}
          elementCollections={elementCollections}
          onPageChange={handlePageChange}
          onPageDelete={handlePageDelete}
          onFileUpload={() => fileInputRef.current?.click()}
          onAppendDocument={() => appendFileInputRef.current?.click()}
          onSidebarToggle={() =>
            setViewState((prev) => ({
              ...prev,
              isSidebarCollapsed: !prev.isSidebarCollapsed,
            }))
          }
          onTabChange={(tab) =>
            setViewState((prev) => ({ ...prev, activeSidebarTab: tab }))
          }
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* ElementFormatDrawer */}
          <div className="relative z-40 transition-all duration-300">
            <ElementFormatDrawer />
          </div>

          {/* Floating Toolbars - Only show when PDF is loaded */}
          {documentState.url && !documentState.error && (
            <FloatingToolbar
              editorState={editorState}
              toolState={toolState}
              erasureState={erasureState}
              currentView={viewState.currentView}
              showDeletionRectangles={editorState.showDeletionRectangles}
              isSidebarCollapsed={viewState.isSidebarCollapsed}
              onToolChange={handleToolChange}
              onViewChange={(view) =>
                setViewState((prev) => ({ ...prev, currentView: view }))
              }
              onEditModeToggle={() =>
                setEditorState((prev) => ({
                  ...prev,
                  isEditMode: !prev.isEditMode,
                }))
              }
              onDeletionToggle={() =>
                setEditorState((prev) => ({
                  ...prev,
                  showDeletionRectangles: !prev.showDeletionRectangles,
                }))
              }
              onImageUpload={() => imageInputRef.current?.click()}
            />
          )}

          {/* Erasure Settings Popup - Only show when PDF is loaded */}
          {erasureState.isErasureMode &&
            documentState.url &&
            !documentState.error && (
              <div
                className="absolute z-50 bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200 p-4 rounded-lg transition-all duration-300"
                style={{
                  top: "340px", // Below the floating toolbar (80px + ~200px for toolbar height)
                  left: "16px", // Same left position as floating toolbar
                  minWidth: "280px",
                }}
              >
                <div className="space-y-3">
                  {/* Opacity */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-20">
                      Opacity:
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={erasureState.erasureSettings.opacity}
                      onChange={(e) =>
                        setErasureState((prev) => ({
                          ...prev,
                          erasureSettings: {
                            ...prev.erasureSettings,
                            opacity: parseFloat(e.target.value),
                          },
                        }))
                      }
                      className="flex-1 w-5"
                    />
                    <span className="text-xs text-gray-500 w-10">
                      {Math.round(erasureState.erasureSettings.opacity * 100)}%
                    </span>
                  </div>
                  {/* Page Background Color Picker */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-20">
                      Page BG:
                    </label>
                    <input
                      type="color"
                      value={
                        documentState.pdfBackgroundColor.startsWith("#")
                          ? documentState.pdfBackgroundColor
                          : rgbStringToHex(documentState.pdfBackgroundColor)
                      }
                      onChange={(e) => {
                        const newColor = e.target.value;
                        actions.updatePdfBackgroundColor(newColor);
                      }}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                    />
                    <span className="text-xs text-gray-500">
                      {documentState.pdfBackgroundColor}
                    </span>
                  </div>
                </div>
              </div>
            )}

          {/* Document Viewer */}
          <div
            className="flex-1 document-viewer document-container"
            ref={containerRef}
            style={{
              scrollBehavior: "smooth",
              overflow: "auto",
              paddingTop: "20px",
            }}
          >
            {documentState.error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-red-500 text-lg mb-2">Error</div>
                  <div className="text-gray-600">{documentState.error}</div>
                </div>
              </div>
            )}

            {!documentState.url && !documentState.error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-gray-500 text-lg mb-2">
                    No document loaded
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Upload Document
                  </button>
                </div>
              </div>
            )}

            {documentState.url && !documentState.error && (
              <div
                className="document-wrapper"
                style={{
                  minHeight: `${Math.max(
                    100,
                    documentState.pageHeight * documentState.scale + 80
                  )}px`,
                  height: `${Math.max(
                    100,
                    documentState.pageHeight * documentState.scale + 80
                  )}px`,
                  width: `${Math.max(
                    100,
                    viewState.currentView === "split"
                      ? documentState.pageWidth * documentState.scale * 2 + 100 // Double width for split view plus gap and padding
                      : documentState.pageWidth * documentState.scale + 80
                  )}px`,
                  minWidth: `${Math.max(
                    100,
                    viewState.currentView === "split"
                      ? documentState.pageWidth * documentState.scale * 2 + 100
                      : documentState.pageWidth * documentState.scale + 80
                  )}px`,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  paddingTop: "40px",
                  paddingBottom: "40px",
                  paddingLeft: "40px",
                  paddingRight: "40px",
                  margin: "0 auto",
                }}
              >
                <div
                  ref={documentRef}
                  className={`relative bg-white document-page ${
                    documentState.isScaleChanging ? "" : "zoom-transition"
                  } ${
                    editorState.isAddTextBoxMode ? "add-text-box-mode" : ""
                  } ${
                    editorState.isTextSelectionMode ? "text-selection-mode" : ""
                  } ${editorState.isSelectionMode ? "selection-mode" : ""} ${
                    editorState.isAddTextBoxMode ? "cursor-crosshair" : ""
                  } ${toolState.shapeDrawingMode ? "cursor-crosshair" : ""} ${
                    erasureState.isErasureMode ? "cursor-crosshair" : ""
                  } ${viewState.isCtrlPressed ? "cursor-zoom-in" : ""}`}
                  onClick={handleDocumentContainerClick}
                  onMouseDown={(e) => {
                    console.log("Document mouse down event", {
                      isTextSelectionMode: editorState.isTextSelectionMode,
                      isErasureMode: erasureState.isErasureMode,
                      isSelectionMode: editorState.isSelectionMode,
                      isMovingSelection:
                        editorState.multiSelection.isMovingSelection,
                    });

                    if (
                      editorState.isTextSelectionMode ||
                      erasureState.isErasureMode ||
                      editorState.isSelectionMode ||
                      editorState.multiSelection.isMovingSelection
                    ) {
                      if (editorState.multiSelection.isMovingSelection) {
                        handleMoveSelectionMouseDown(e);
                      } else if (editorState.isSelectionMode) {
                        handleMultiSelectionMouseDown(e);
                      } else {
                        handleDocumentMouseDown(e);
                      }
                    }
                  }}
                  onMouseMove={(e) => {
                    if (toolState.shapeDrawingMode) {
                      handleShapeDrawMove(e);
                    } else if (editorState.multiSelection.isMovingSelection) {
                      handleMoveSelectionMouseMove(e);
                    } else if (editorState.isTextSelectionMode) {
                      handleDocumentMouseMove(e);
                    } else if (editorState.isSelectionMode) {
                      handleMultiSelectionMouseMove(e);
                    } else if (erasureState.isErasureMode) {
                      handleErasureDrawMove(e);
                    }
                  }}
                  onMouseUp={(e) => {
                    if (toolState.shapeDrawingMode) {
                      handleShapeDrawEnd();
                    } else if (editorState.multiSelection.isMovingSelection) {
                      handleMoveSelectionMouseUp();
                    } else if (editorState.isTextSelectionMode) {
                      handleDocumentMouseUp(e);
                    } else if (editorState.isSelectionMode) {
                      handleMultiSelectionMouseUp(e);
                    } else if (erasureState.isErasureMode) {
                      handleErasureDrawEnd();
                    }
                  }}
                  style={{
                    width:
                      viewState.currentView === "split"
                        ? documentState.pageWidth * documentState.scale * 2 + 20 // Double width plus gap for split view
                        : documentState.pageWidth * documentState.scale,
                    height: documentState.pageHeight * documentState.scale,
                    minWidth:
                      viewState.currentView === "split"
                        ? documentState.pageWidth * documentState.scale * 2 + 20
                        : documentState.pageWidth * documentState.scale,
                    minHeight: documentState.pageHeight * documentState.scale,
                    display: "block",
                  }}
                >
                  {/* Document Rendering - Show different content based on view */}
                  {viewState.currentView === "original" && (
                    <>
                      {isPdfFile(documentState.url) ? (
                        <div className="relative">
                          <Document
                            file={documentState.url}
                            onLoadSuccess={handlers.handleDocumentLoadSuccess}
                            onLoadError={handlers.handleDocumentLoadError}
                            loading={null}
                          >
                            <Page
                              pageNumber={documentState.currentPage}
                              onLoadSuccess={handlers.handlePageLoadSuccess}
                              onLoadError={handlers.handlePageLoadError}
                              onRenderSuccess={() => {
                                setDocumentState((prev) => ({
                                  ...prev,
                                  isPageLoading: false,
                                }));
                                actions.capturePdfBackgroundColor();
                              }}
                              onRenderError={handlers.handlePageLoadError}
                              renderTextLayer={
                                editorState.isAddTextBoxMode &&
                                !isTextSpanZooming
                              }
                              renderAnnotationLayer={false}
                              loading={
                                <div
                                  className="flex items-center justify-center bg-gray-50"
                                  style={{
                                    width:
                                      documentState.pageWidth *
                                      documentState.scale,
                                    height:
                                      documentState.pageHeight *
                                      documentState.scale,
                                  }}
                                >
                                  <div className="text-center">
                                    <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    <div className="text-gray-500 text-sm">
                                      Rendering page...
                                    </div>
                                  </div>
                                </div>
                              }
                              width={
                                documentState.pageWidth * documentState.scale
                              }
                            />
                          </Document>

                          {/* Loading overlay during scale changes */}
                          {documentState.isScaleChanging && (
                            <div
                              className="absolute inset-0 bg-gray-50 bg-opacity-50 flex items-center justify-center z-50"
                              style={{
                                width:
                                  documentState.pageWidth * documentState.scale,
                                height:
                                  documentState.pageHeight *
                                  documentState.scale,
                              }}
                            >
                              <div className="bg-white rounded-lg shadow-md p-3 flex items-center space-x-2">
                                <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm text-gray-600">
                                  Adjusting zoom...
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <img
                          src={documentState.url}
                          alt="Document"
                          onLoad={handlers.handleImageLoadSuccess}
                          onError={handlers.handleImageLoadError}
                          style={{
                            width:
                              documentState.pageWidth * documentState.scale,
                            height:
                              documentState.pageHeight * documentState.scale,
                            maxWidth: "none",
                            display: "block",
                          }}
                          className="select-none"
                        />
                      )}
                    </>
                  )}

                  {/* Translated Document View */}
                  {viewState.currentView === "translated" && (
                    <>
                      {/* Blank translated document background */}
                      <div className="w-full h-full bg-white">
                        {/* Page number indicator */}
                        <div className="absolute bottom-4 right-4 bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                          Page {documentState.currentPage} of{" "}
                          {documentState.numPages}
                        </div>

                        {/* Transform JSON Button - centered overlay if not translated */}
                        {!pageState.isPageTranslated.get(
                          documentState.currentPage
                        ) && (
                          <div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ zIndex: 20000 }}
                          >
                            <button
                              onClick={() =>
                                handleTransformPageToTextbox(
                                  documentState.currentPage
                                )
                              }
                              disabled={pageState.isTransforming}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100 flex items-center space-x-2"
                              title="Transform current page to textboxes using OCR"
                            >
                              {pageState.isTransforming ? (
                                <>
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Transforming...</span>
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                                    />
                                  </svg>
                                  <span>Transform JSON to Textbox</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Translated Document Elements - Wrapped for proper z-index */}
                      <div
                        className="absolute inset-0"
                        style={{ zIndex: 10000 }}
                      >
                        {/* Deletion Rectangles */}
                        {elementCollections.translatedDeletionRectangles
                          .filter(
                            (rect) => rect.page === documentState.currentPage
                          )
                          .map((rect) => (
                            <div
                              key={`trans-del-${rect.id}`}
                              className={`absolute ${
                                editorState.showDeletionRectangles
                                  ? "border border-red-400"
                                  : ""
                              }`}
                              style={{
                                left: rect.x * documentState.scale,
                                top: rect.y * documentState.scale,
                                width: rect.width * documentState.scale,
                                height: rect.height * documentState.scale,
                                zIndex: editorState.showDeletionRectangles
                                  ? -10
                                  : -20,
                                backgroundColor: rect.background
                                  ? colorToRgba(
                                      rect.background,
                                      rect.opacity || 1.0
                                    )
                                  : "white",
                              }}
                            >
                              {editorState.showDeletionRectangles && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDeletionRectangleWithUndo(
                                      rect.id,
                                      "translated"
                                    );
                                  }}
                                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 text-xs shadow-md"
                                  title="Delete area"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}

                        {/* Translated Elements in Layer Order */}
                        {getTranslatedSortedElements(
                          documentState.currentPage
                        ).map(({ type, element }) => {
                          // Get elements that would be captured in the current selection preview
                          const elementsInSelectionPreview =
                            getElementsInSelectionPreview();

                          if (type === "textbox") {
                            const textBox = element as TextField;
                            const isInSelectionPreview =
                              elementsInSelectionPreview.has(textBox.id);
                            return (
                              <MemoizedTextBox
                                key={`trans-text-${textBox.id}`}
                                textBox={textBox}
                                isSelected={
                                  editorState.selectedFieldId === textBox.id
                                }
                                isEditMode={editorState.isEditMode}
                                scale={documentState.scale}
                                showPaddingIndicator={showPaddingPopup}
                                onSelect={handleTextBoxSelect}
                                onUpdate={updateTextBoxWithUndo}
                                onDelete={(id) =>
                                  handleDeleteTextBoxWithUndo(
                                    id,
                                    viewState.currentView
                                  )
                                }
                                isTextSelectionMode={
                                  editorState.isTextSelectionMode
                                }
                                isSelectedInTextMode={selectionState.selectedTextBoxes.textBoxIds.includes(
                                  textBox.id
                                )}
                                autoFocusId={autoFocusTextBoxId}
                                onAutoFocusComplete={handleAutoFocusComplete}
                                // Selection preview prop
                                isInSelectionPreview={isInSelectionPreview}
                              />
                            );
                          } else if (type === "shape") {
                            const shape = element as ShapeType;
                            const isInSelectionPreview =
                              elementsInSelectionPreview.has(shape.id);
                            return (
                              <MemoizedShape
                                key={`trans-shape-${shape.id}`}
                                shape={shape}
                                isSelected={
                                  editorState.selectedShapeId === shape.id
                                }
                                isEditMode={editorState.isEditMode}
                                scale={documentState.scale}
                                onSelect={handleShapeSelect}
                                onUpdate={updateShapeWithUndo}
                                onDelete={(id) =>
                                  handleDeleteShapeWithUndo(
                                    id,
                                    viewState.currentView
                                  )
                                }
                                // Selection preview prop
                                isInSelectionPreview={isInSelectionPreview}
                              />
                            );
                          } else if (type === "image") {
                            const image = element as ImageType;
                            const isInSelectionPreview =
                              elementsInSelectionPreview.has(image.id);
                            return (
                              <MemoizedImage
                                key={`trans-image-${image.id}`}
                                image={image}
                                isSelected={selectedElementId === image.id}
                                isEditMode={editorState.isEditMode}
                                scale={documentState.scale}
                                onSelect={handleImageSelect}
                                onUpdate={updateImage}
                                onDelete={(id) =>
                                  handleDeleteImageWithUndo(
                                    id,
                                    viewState.currentView
                                  )
                                }
                                // Selection preview prop
                                isInSelectionPreview={isInSelectionPreview}
                              />
                            );
                          }
                          return null;
                        })}
                      </div>
                    </>
                  )}

                  {/* Split Screen View */}
                  {viewState.currentView === "split" && (
                    <div
                      className="flex"
                      style={{
                        width:
                          documentState.pageWidth * documentState.scale * 2 +
                          20, // Double width plus gap
                        height: documentState.pageHeight * documentState.scale,
                      }}
                    >
                      {/* Original Document Side */}
                      <div
                        className="relative bg-white border border-gray-200 shadow-sm"
                        style={{
                          width: documentState.pageWidth * documentState.scale,
                          height:
                            documentState.pageHeight * documentState.scale,
                        }}
                      >
                        {/* Original Document Header */}
                        <div className="absolute -top-8 left-0 right-0 flex items-center justify-center">
                          <div className="bg-blue-500 text-white px-3 py-1 rounded-t-lg text-sm font-medium">
                            Original Document
                          </div>
                        </div>

                        {/* Original Document Content */}
                        {isPdfFile(documentState.url) ? (
                          <div className="relative w-full h-full">
                            <Document
                              file={documentState.url}
                              onLoadSuccess={handlers.handleDocumentLoadSuccess}
                              onLoadError={handlers.handleDocumentLoadError}
                              loading={null}
                            >
                              <Page
                                pageNumber={documentState.currentPage}
                                onLoadSuccess={handlers.handlePageLoadSuccess}
                                onLoadError={handlers.handlePageLoadError}
                                onRenderSuccess={() => {
                                  setDocumentState((prev) => ({
                                    ...prev,
                                    isPageLoading: false,
                                  }));
                                  actions.capturePdfBackgroundColor();
                                }}
                                onRenderError={handlers.handlePageLoadError}
                                renderTextLayer={
                                  editorState.isAddTextBoxMode &&
                                  !isTextSpanZooming
                                }
                                renderAnnotationLayer={false}
                                loading={null}
                                width={
                                  documentState.pageWidth * documentState.scale
                                }
                              />
                            </Document>
                          </div>
                        ) : (
                          <img
                            src={documentState.url}
                            alt="Original Document"
                            style={{
                              width:
                                documentState.pageWidth * documentState.scale,
                              height:
                                documentState.pageHeight * documentState.scale,
                              maxWidth: "none",
                              display: "block",
                            }}
                            className="select-none"
                          />
                        )}

                        {/* Original Document Elements - Wrapped for proper z-index */}
                        <div
                          className="absolute inset-0"
                          style={{ zIndex: 10000 }}
                        >
                          {/* Deletion Rectangles */}
                          {elementCollections.originalDeletionRectangles
                            .filter(
                              (rect) => rect.page === documentState.currentPage
                            )
                            .map((rect) => (
                              <div
                                key={`orig-del-${rect.id}`}
                                className={`absolute ${
                                  editorState.showDeletionRectangles
                                    ? "border border-red-400"
                                    : ""
                                }`}
                                style={{
                                  left: rect.x * documentState.scale,
                                  top: rect.y * documentState.scale,
                                  width: rect.width * documentState.scale,
                                  height: rect.height * documentState.scale,
                                  zIndex: editorState.showDeletionRectangles
                                    ? -10
                                    : -20,
                                  backgroundColor: rect.background
                                    ? colorToRgba(
                                        rect.background,
                                        rect.opacity || 1.0
                                      )
                                    : "white",
                                }}
                              >
                                {editorState.showDeletionRectangles && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteDeletionRectangleWithUndo(
                                        rect.id,
                                        "original"
                                      );
                                    }}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 text-xs shadow-md"
                                    title="Delete area"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}

                          {/* Original Elements in Layer Order */}
                          {getOriginalSortedElements(
                            documentState.currentPage
                          ).map(({ type, element }) => {
                            // Get elements that would be captured in the current selection preview
                            const elementsInSelectionPreview =
                              getElementsInSelectionPreview();

                            if (type === "textbox") {
                              const textBox = element as TextField;
                              const isInSelectionPreview =
                                elementsInSelectionPreview.has(textBox.id);
                              return (
                                <MemoizedTextBox
                                  key={`orig-text-${textBox.id}`}
                                  textBox={textBox}
                                  isSelected={
                                    editorState.selectedFieldId === textBox.id
                                  }
                                  isEditMode={editorState.isEditMode}
                                  scale={documentState.scale}
                                  showPaddingIndicator={showPaddingPopup}
                                  onSelect={handleTextBoxSelect}
                                  onUpdate={updateTextBoxWithUndo}
                                  onDelete={(id) =>
                                    handleDeleteTextBoxWithUndo(
                                      id,
                                      viewState.currentView
                                    )
                                  }
                                  isTextSelectionMode={
                                    editorState.isTextSelectionMode
                                  }
                                  isSelectedInTextMode={selectionState.selectedTextBoxes.textBoxIds.includes(
                                    textBox.id
                                  )}
                                  autoFocusId={autoFocusTextBoxId}
                                  onAutoFocusComplete={handleAutoFocusComplete}
                                  // Selection preview prop
                                  isInSelectionPreview={isInSelectionPreview}
                                />
                              );
                            } else if (type === "shape") {
                              const shape = element as ShapeType;
                              const isInSelectionPreview =
                                elementsInSelectionPreview.has(shape.id);
                              return (
                                <MemoizedShape
                                  key={`orig-shape-${shape.id}`}
                                  shape={shape}
                                  isSelected={
                                    editorState.selectedShapeId === shape.id
                                  }
                                  isEditMode={editorState.isEditMode}
                                  scale={documentState.scale}
                                  onSelect={handleShapeSelect}
                                  onUpdate={updateShapeWithUndo}
                                  onDelete={(id) =>
                                    handleDeleteShapeWithUndo(
                                      id,
                                      viewState.currentView
                                    )
                                  }
                                  // Selection preview prop
                                  isInSelectionPreview={isInSelectionPreview}
                                />
                              );
                            } else if (type === "image") {
                              const image = element as ImageType;
                              const isInSelectionPreview =
                                elementsInSelectionPreview.has(image.id);
                              return (
                                <MemoizedImage
                                  key={`orig-image-${image.id}`}
                                  image={image}
                                  isSelected={selectedElementId === image.id}
                                  isEditMode={editorState.isEditMode}
                                  scale={documentState.scale}
                                  onSelect={handleImageSelect}
                                  onUpdate={updateImage}
                                  onDelete={(id) =>
                                    handleDeleteImageWithUndo(
                                      id,
                                      viewState.currentView
                                    )
                                  }
                                  // Selection preview prop
                                  isInSelectionPreview={isInSelectionPreview}
                                />
                              );
                            }
                            return null;
                          })}

                          {/* Original View Selection Components */}
                          {editorState.isSelectionMode && (
                            <>
                              {/* Selection Preview for Original View */}
                              {editorState.multiSelection.isDrawingSelection &&
                                editorState.multiSelection.selectionStart &&
                                editorState.multiSelection.selectionEnd &&
                                editorState.multiSelection.targetView ===
                                  "original" && (
                                  <SelectionPreview
                                    start={
                                      editorState.multiSelection.selectionStart
                                    }
                                    end={
                                      editorState.multiSelection.selectionEnd
                                    }
                                    scale={documentState.scale}
                                  />
                                )}

                              {/* Selection Rectangle for Original View */}
                              {editorState.multiSelection.selectionBounds &&
                                editorState.multiSelection.selectedElements
                                  .length > 0 &&
                                viewState.currentView === "split" &&
                                editorState.multiSelection.targetView ===
                                  "original" && (
                                  <SelectionRectangle
                                    bounds={
                                      editorState.multiSelection.selectionBounds
                                    }
                                    scale={documentState.scale}
                                    onMove={handleMoveSelection}
                                    onDelete={handleDeleteSelection}
                                    isMoving={
                                      editorState.multiSelection
                                        .isMovingSelection
                                    }
                                    onDragSelection={(deltaX, deltaY) => {
                                      // Move all selected elements by delta (in real time)
                                      moveSelectedElements(
                                        editorState.multiSelection
                                          .selectedElements,
                                        deltaX,
                                        deltaY,
                                        updateTextBoxWithUndo,
                                        updateShape,
                                        updateImage,
                                        getElementById,
                                        documentState.pageWidth,
                                        documentState.pageHeight
                                      );
                                      // Update selection bounds in real time
                                      setEditorState((prev) => {
                                        const updatedElements =
                                          prev.multiSelection.selectedElements.map(
                                            (el) => ({
                                              ...el,
                                              originalPosition: {
                                                x:
                                                  el.originalPosition.x +
                                                  deltaX,
                                                y:
                                                  el.originalPosition.y +
                                                  deltaY,
                                              },
                                            })
                                          );
                                        const newBounds =
                                          calculateSelectionBounds(
                                            updatedElements,
                                            getElementById
                                          );
                                        return {
                                          ...prev,
                                          multiSelection: {
                                            ...prev.multiSelection,
                                            selectedElements: updatedElements,
                                            selectionBounds: newBounds,
                                          },
                                        };
                                      });
                                    }}
                                    onDragStopSelection={
                                      handleDragStopSelection
                                    }
                                  />
                                )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Gap between documents */}
                      <div className="w-5 flex items-center justify-center">
                        <div className="w-px h-full bg-gray-300"></div>
                      </div>

                      {/* Translated Document Side */}
                      <div
                        className="relative bg-white border border-gray-200 shadow-sm"
                        style={{
                          width: documentState.pageWidth * documentState.scale,
                          height:
                            documentState.pageHeight * documentState.scale,
                        }}
                      >
                        {/* Translated Document Header */}
                        <div className="absolute -top-8 left-0 right-0 flex items-center justify-center">
                          <div className="bg-green-500 text-white px-3 py-1 rounded-t-lg text-sm font-medium">
                            Translated Document
                          </div>
                        </div>

                        {/* Blank translated document background */}
                        <div className="w-full h-full bg-white">
                          {/* Page number indicator */}
                          <div className="absolute bottom-4 right-4 bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                            Page {documentState.currentPage} of{" "}
                            {documentState.numPages}
                          </div>

                          {/* Transform JSON Button - positioned in the middle */}
                          {!pageState.isPageTranslated.get(
                            documentState.currentPage
                          ) && (
                            <div
                              className="absolute inset-0 flex items-center justify-center"
                              style={{ zIndex: 20000 }}
                            >
                              <button
                                onClick={() => {
                                  handleTransformPageToTextbox(
                                    documentState.currentPage
                                  );
                                }}
                                disabled={pageState.isTransforming}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100 flex items-center space-x-2"
                                title="Transform current page to textboxes using OCR"
                              >
                                {pageState.isTransforming ? (
                                  <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Transforming...</span>
                                  </>
                                ) : (
                                  <>
                                    <svg
                                      className="w-5 h-5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                                      />
                                    </svg>
                                    <span>Transform JSON to Textbox</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Translated Document Elements - Wrapped for proper z-index */}
                        <div
                          className="absolute inset-0"
                          style={{ zIndex: 10000 }}
                        >
                          {/* Deletion Rectangles */}
                          {elementCollections.translatedDeletionRectangles
                            .filter(
                              (rect) => rect.page === documentState.currentPage
                            )
                            .map((rect) => (
                              <div
                                key={`trans-del-${rect.id}`}
                                className={`absolute ${
                                  editorState.showDeletionRectangles
                                    ? "border border-red-400"
                                    : ""
                                }`}
                                style={{
                                  left: rect.x * documentState.scale,
                                  top: rect.y * documentState.scale,
                                  width: rect.width * documentState.scale,
                                  height: rect.height * documentState.scale,
                                  zIndex: editorState.showDeletionRectangles
                                    ? -10
                                    : -20,
                                  backgroundColor: rect.background
                                    ? colorToRgba(
                                        rect.background,
                                        rect.opacity || 1.0
                                      )
                                    : "white",
                                }}
                              >
                                {editorState.showDeletionRectangles && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteDeletionRectangleWithUndo(
                                        rect.id,
                                        "translated"
                                      );
                                    }}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 text-xs shadow-md"
                                    title="Delete area"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}

                          {/* Translated Elements in Layer Order */}
                          {getTranslatedSortedElements(
                            documentState.currentPage
                          ).map(({ type, element }) => {
                            // Get elements that would be captured in the current selection preview
                            const elementsInSelectionPreview =
                              getElementsInSelectionPreview();

                            if (type === "textbox") {
                              const textBox = element as TextField;
                              const isInSelectionPreview =
                                elementsInSelectionPreview.has(textBox.id);
                              return (
                                <MemoizedTextBox
                                  key={`trans-text-${textBox.id}`}
                                  textBox={textBox}
                                  isSelected={
                                    editorState.selectedFieldId === textBox.id
                                  }
                                  isEditMode={editorState.isEditMode}
                                  scale={documentState.scale}
                                  showPaddingIndicator={showPaddingPopup}
                                  onSelect={handleTextBoxSelect}
                                  onUpdate={updateTextBoxWithUndo}
                                  onDelete={(id) =>
                                    handleDeleteTextBoxWithUndo(
                                      id,
                                      viewState.currentView
                                    )
                                  }
                                  isTextSelectionMode={
                                    editorState.isTextSelectionMode
                                  }
                                  isSelectedInTextMode={selectionState.selectedTextBoxes.textBoxIds.includes(
                                    textBox.id
                                  )}
                                  autoFocusId={autoFocusTextBoxId}
                                  onAutoFocusComplete={handleAutoFocusComplete}
                                  // Selection preview prop
                                  isInSelectionPreview={isInSelectionPreview}
                                />
                              );
                            } else if (type === "shape") {
                              const shape = element as ShapeType;
                              const isInSelectionPreview =
                                elementsInSelectionPreview.has(shape.id);
                              return (
                                <MemoizedShape
                                  key={`trans-shape-${shape.id}`}
                                  shape={shape}
                                  isSelected={
                                    editorState.selectedShapeId === shape.id
                                  }
                                  isEditMode={editorState.isEditMode}
                                  scale={documentState.scale}
                                  onSelect={handleShapeSelect}
                                  onUpdate={updateShapeWithUndo}
                                  onDelete={(id) =>
                                    handleDeleteShapeWithUndo(
                                      id,
                                      viewState.currentView
                                    )
                                  }
                                  // Selection preview prop
                                  isInSelectionPreview={isInSelectionPreview}
                                />
                              );
                            } else if (type === "image") {
                              const image = element as ImageType;
                              const isInSelectionPreview =
                                elementsInSelectionPreview.has(image.id);
                              return (
                                <MemoizedImage
                                  key={`trans-image-${image.id}`}
                                  image={image}
                                  isSelected={selectedElementId === image.id}
                                  isEditMode={editorState.isEditMode}
                                  scale={documentState.scale}
                                  onSelect={handleImageSelect}
                                  onUpdate={updateImage}
                                  onDelete={(id) =>
                                    handleDeleteImageWithUndo(
                                      id,
                                      viewState.currentView
                                    )
                                  }
                                  // Selection preview prop
                                  isInSelectionPreview={isInSelectionPreview}
                                />
                              );
                            }
                            return null;
                          })}

                          {/* Translated View Selection Components */}
                          {editorState.isSelectionMode && (
                            <>
                              {/* Selection Preview for Translated View */}
                              {editorState.multiSelection.isDrawingSelection &&
                                editorState.multiSelection.selectionStart &&
                                editorState.multiSelection.selectionEnd &&
                                editorState.multiSelection.targetView ===
                                  "translated" && (
                                  <SelectionPreview
                                    start={
                                      editorState.multiSelection.selectionStart
                                    }
                                    end={
                                      editorState.multiSelection.selectionEnd
                                    }
                                    scale={documentState.scale}
                                  />
                                )}

                              {/* Selection Rectangle for Translated View */}
                              {editorState.multiSelection.selectionBounds &&
                                editorState.multiSelection.selectedElements
                                  .length > 0 &&
                                viewState.currentView === "split" &&
                                editorState.multiSelection.targetView ===
                                  "translated" && (
                                  <SelectionRectangle
                                    bounds={
                                      editorState.multiSelection.selectionBounds
                                    }
                                    scale={documentState.scale}
                                    onMove={handleMoveSelection}
                                    onDelete={handleDeleteSelection}
                                    isMoving={
                                      editorState.multiSelection
                                        .isMovingSelection
                                    }
                                    onDragSelection={(deltaX, deltaY) => {
                                      // Move all selected elements by delta (in real time)
                                      moveSelectedElements(
                                        editorState.multiSelection
                                          .selectedElements,
                                        deltaX,
                                        deltaY,
                                        updateTextBoxWithUndo,
                                        updateShape,
                                        updateImage,
                                        getElementById,
                                        documentState.pageWidth,
                                        documentState.pageHeight
                                      );
                                      // Update selection bounds in real time
                                      setEditorState((prev) => {
                                        const updatedElements =
                                          prev.multiSelection.selectedElements.map(
                                            (el) => ({
                                              ...el,
                                              originalPosition: {
                                                x:
                                                  el.originalPosition.x +
                                                  deltaX,
                                                y:
                                                  el.originalPosition.y +
                                                  deltaY,
                                              },
                                            })
                                          );
                                        const newBounds =
                                          calculateSelectionBounds(
                                            updatedElements,
                                            getElementById
                                          );
                                        return {
                                          ...prev,
                                          multiSelection: {
                                            ...prev.multiSelection,
                                            selectedElements: updatedElements,
                                            selectionBounds: newBounds,
                                          },
                                        };
                                      });
                                    }}
                                    onDragStopSelection={
                                      handleDragStopSelection
                                    }
                                  />
                                )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show interactive elements in both original and translated views */}
                  {(viewState.currentView === "original" ||
                    viewState.currentView === "translated") && (
                    <div
                      className="absolute inset-0 interactive-elements-wrapper"
                      style={{
                        zIndex:
                          editorState.isTextSelectionMode ||
                          editorState.isAddTextBoxMode
                            ? 100
                            : 10000,
                        pointerEvents:
                          editorState.isTextSelectionMode ||
                          editorState.isAddTextBoxMode
                            ? "none"
                            : "auto",
                      }}
                    >
                      {/* Deletion Rectangles */}
                      {currentPageDeletionRectangles.map((rect) => (
                        <div
                          key={rect.id}
                          className={`absolute ${
                            editorState.showDeletionRectangles
                              ? "border border-red-400"
                              : ""
                          }`}
                          style={{
                            left: rect.x * documentState.scale,
                            top: rect.y * documentState.scale,
                            width: rect.width * documentState.scale,
                            height: rect.height * documentState.scale,
                            zIndex: editorState.showDeletionRectangles
                              ? -10
                              : -20,
                            backgroundColor: rect.background
                              ? colorToRgba(
                                  rect.background,
                                  rect.opacity || 1.0
                                )
                              : "white",
                          }}
                        >
                          {editorState.showDeletionRectangles && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDeletionRectangleWithUndo(
                                  rect.id,
                                  viewState.currentView
                                );
                              }}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 text-xs shadow-md"
                              title="Delete area"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Render elements in layer order */}
                      {currentPageSortedElements.map(renderElement)}

                      {/* Single View Selection Components */}
                      {editorState.isSelectionMode && (
                        <>
                          {/* Selection Preview for Single Views */}
                          {editorState.multiSelection.isDrawingSelection &&
                            editorState.multiSelection.selectionStart &&
                            editorState.multiSelection.selectionEnd &&
                            ((viewState.currentView === "original" &&
                              editorState.multiSelection.targetView ===
                                "original") ||
                              (viewState.currentView === "translated" &&
                                editorState.multiSelection.targetView ===
                                  "translated")) && (
                              <SelectionPreview
                                start={
                                  editorState.multiSelection.selectionStart
                                }
                                end={editorState.multiSelection.selectionEnd}
                                scale={documentState.scale}
                              />
                            )}

                          {/* Selection Rectangle for Single Views */}
                          {editorState.multiSelection.selectionBounds &&
                            editorState.multiSelection.selectedElements.length >
                              0 &&
                            ((viewState.currentView === "original" &&
                              editorState.multiSelection.targetView ===
                                "original") ||
                              (viewState.currentView === "translated" &&
                                editorState.multiSelection.targetView ===
                                  "translated")) && (
                              <SelectionRectangle
                                bounds={
                                  editorState.multiSelection.selectionBounds
                                }
                                scale={documentState.scale}
                                onMove={handleMoveSelection}
                                onDelete={handleDeleteSelection}
                                isMoving={
                                  editorState.multiSelection.isMovingSelection
                                }
                                onDragSelection={(deltaX, deltaY) => {
                                  // Move all selected elements by delta (in real time)
                                  moveSelectedElements(
                                    editorState.multiSelection.selectedElements,
                                    deltaX,
                                    deltaY,
                                    (id, updates) =>
                                      updateTextBoxWithUndo(id, updates, true), // Mark as ongoing operation
                                    (id, updates) =>
                                      updateShapeWithUndo(id, updates, true), // Mark as ongoing operation
                                    updateImage,
                                    getElementById,
                                    documentState.pageWidth,
                                    documentState.pageHeight
                                  );
                                  // Update selection bounds in real time
                                  setEditorState((prev) => {
                                    const updatedElements =
                                      prev.multiSelection.selectedElements.map(
                                        (el) => ({
                                          ...el,
                                          originalPosition: {
                                            x: el.originalPosition.x + deltaX,
                                            y: el.originalPosition.y + deltaY,
                                          },
                                        })
                                      );
                                    const newBounds = calculateSelectionBounds(
                                      updatedElements,
                                      getElementById
                                    );
                                    return {
                                      ...prev,
                                      multiSelection: {
                                        ...prev.multiSelection,
                                        selectedElements: updatedElements,
                                        selectionBounds: newBounds,
                                      },
                                    };
                                  });
                                }}
                                onDragStopSelection={handleDragStopSelection}
                              />
                            )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Shape Drawing Preview */}
                  {toolState.isDrawingInProgress &&
                    toolState.shapeDrawStart &&
                    toolState.shapeDrawEnd && (
                      <div
                        className="absolute border-2 border-dashed border-red-500 bg-red-100 bg-opacity-30 pointer-events-none"
                        style={{
                          left: getPreviewLeft(
                            Math.min(
                              toolState.shapeDrawStart.x,
                              toolState.shapeDrawEnd.x
                            ),
                            viewState.currentView === "split"
                              ? toolState.shapeDrawTargetView === "translated"
                              : viewState.currentView === "translated",
                            viewState.currentView,
                            documentState.pageWidth,
                            documentState.scale
                          ),
                          top:
                            Math.min(
                              toolState.shapeDrawStart.y,
                              toolState.shapeDrawEnd.y
                            ) * documentState.scale,
                          width:
                            Math.abs(
                              toolState.shapeDrawEnd.x -
                                toolState.shapeDrawStart.x
                            ) * documentState.scale,
                          height:
                            Math.abs(
                              toolState.shapeDrawEnd.y -
                                toolState.shapeDrawStart.y
                            ) * documentState.scale,
                          borderRadius:
                            toolState.shapeDrawingMode === "circle"
                              ? "50%"
                              : "0",
                          zIndex: 50,
                        }}
                      />
                    )}

                  {/* Erasure Drawing Preview */}
                  {erasureState.isDrawingErasure &&
                    erasureState.erasureDrawStart &&
                    erasureState.erasureDrawEnd && (
                      <div
                        className="absolute border-2 border-dashed pointer-events-none"
                        style={{
                          left: getPreviewLeft(
                            Math.min(
                              erasureState.erasureDrawStart.x,
                              erasureState.erasureDrawEnd.x
                            ),
                            viewState.currentView === "split"
                              ? erasureState.erasureDrawTargetView ===
                                  "translated"
                              : viewState.currentView === "translated",
                            viewState.currentView,
                            documentState.pageWidth,
                            documentState.scale
                          ),
                          top:
                            Math.min(
                              erasureState.erasureDrawStart.y,
                              erasureState.erasureDrawEnd.y
                            ) * documentState.scale,
                          width:
                            Math.abs(
                              erasureState.erasureDrawEnd.x -
                                erasureState.erasureDrawStart.x
                            ) * documentState.scale,
                          height:
                            Math.abs(
                              erasureState.erasureDrawEnd.y -
                                erasureState.erasureDrawStart.y
                            ) * documentState.scale,
                          backgroundColor: colorToRgba(
                            documentState.pdfBackgroundColor,
                            erasureState.erasureSettings.opacity
                          ),
                          zIndex: 50,
                        }}
                      />
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <PDFEditorStatusBar
        documentState={documentState}
        viewState={viewState}
        elementCollections={elementCollections}
        pageState={pageState}
        onZoomChange={(scale) => actions.updateScale(scale)}
        onZoomIn={() => actions.updateScale(documentState.scale + 0.1)}
        onZoomOut={() => actions.updateScale(documentState.scale - 0.1)}
        onZoomReset={() => actions.updateScale(1.0)}
      />
    </div>
  );
};
