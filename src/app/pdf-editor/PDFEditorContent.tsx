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
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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
import { TemplateEditorPopup } from "./components/TemplateEditorPopup";

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

  // Split text into lines for multi-line support
  const lines = text.split("\n");
  let maxLineWidth = 0;
  lines.forEach((line) => {
    const metrics = context.measureText(line);
    const lineWidth =
      metrics.width + characterSpacing * Math.max(0, line.length - 1);
    if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
  });

  // Height: number of lines * line height
  const lineHeight = fontSize * 1.1; // Reduced line height for more compact text
  const textHeight = lineHeight * lines.length;

  // Add padding to width and height if provided
  const paddingLeft = padding?.left || 0;
  const paddingRight = padding?.right || 0;
  const paddingTop = padding?.top || 0;
  const paddingBottom = padding?.bottom || 0;

  const totalWidth = maxLineWidth + paddingLeft + paddingRight;
  const totalHeight = textHeight + paddingTop + paddingBottom;

  return { width: totalWidth, height: totalHeight };
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

// Simple confirmation modal component
const ConfirmationModal: React.FC<{
  open: boolean;
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}> = ({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = "Yes",
  cancelText = "Cancel",
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-[320px] max-w-[90vw]">
        <h2 className="text-lg font-bold mb-2">{title}</h2>
        {description && <p className="text-gray-700 mb-4">{description}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

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
    setElementCollections,
    layerState,
    setLayerState,
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
              const operation = ongoingOperationsRef.current[id];
              if (operation) {
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

  const handleDeleteDeletionRectangleWithUndo = useCallback(
    (id: string, view: ViewMode) => {
      // Find the deletion rectangle to delete
      const allDeletionRectangles = [
        ...elementCollections.originalDeletionRectangles,
        ...elementCollections.translatedDeletionRectangles,
      ];
      const rect = allDeletionRectangles.find((r) => r.id === id);
      if (!rect) {
        return;
      }

      // Determine which view the deletion rectangle belongs to
      const rectView = elementCollections.originalDeletionRectangles.some(
        (r) => r.id === id
      )
        ? "original"
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
          rect.background || "",
          rect.opacity
        );
      };
      const cmd = new DeleteDeletionRectangleCommand(remove, add, rect);
      cmd.execute();
      history.push(rect.page, rectView, cmd);
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
      let newId: string | null = null;
      const idRef = { current: null as string | null };
      const add = () => {
        // Always default to 'original' if view is split and targetView is not set
        const finalView = view === "split" ? targetView || "original" : view;
        newId = addImage(src, x, y, width, height, page, finalView);
        idRef.current = newId;
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

  const handleDeleteImageWithUndo = useCallback(
    (id: string, view: ViewMode) => {
      // Find the image to delete
      const allImages = [
        ...elementCollections.originalImages,
        ...elementCollections.translatedImages,
      ];
      const image = allImages.find((img) => img.id === id);
      if (!image) {
        return;
      }

      // Determine which view the image belongs to
      const imageView = elementCollections.originalImages.some(
        (img) => img.id === id
      )
        ? "original"
        : "translated";

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

    // Get elements from the target view only, but only on the current page
    const targetView = editorState.multiSelection.targetView;
    let textBoxes: TextField[] = [];
    let shapes: ShapeType[] = [];
    let images: ImageType[] = [];

    if (targetView === "original") {
      textBoxes = getCurrentTextBoxes("original").filter(
        (tb) => tb.page === documentState.currentPage
      );
      shapes = getCurrentShapes("original").filter(
        (s) => s.page === documentState.currentPage
      );
      images = getCurrentImages("original").filter(
        (img) => img.page === documentState.currentPage
      );
    } else if (targetView === "translated") {
      textBoxes = getCurrentTextBoxes("translated").filter(
        (tb) => tb.page === documentState.currentPage
      );
      shapes = getCurrentShapes("translated").filter(
        (s) => s.page === documentState.currentPage
      );
      images = getCurrentImages("translated").filter(
        (img) => img.page === documentState.currentPage
      );
    }

    // Find elements in selection
    const selectedElements = findElementsInSelection(
      selectionRect,
      textBoxes,
      shapes,
      images
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
    documentState.currentPage,
  ]);

  // Handle multi-selection move events
  const handleMultiSelectionMove = useCallback(
    (event: CustomEvent) => {
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
      if (e.ctrlKey || e.metaKey) {
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
            return;
          }

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
            return;
          }

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

  // Helper function to calculate new textbox dimensions when font properties change
  const calculateTextboxDimensionsForFontChange = useCallback(
    (textBox: TextField, newFontSize?: number, newFontFamily?: string) => {
      const padding = {
        top: textBox.paddingTop || 0,
        right: textBox.paddingRight || 0,
        bottom: textBox.paddingBottom || 0,
        left: textBox.paddingLeft || 0,
      };

      // Use new values or fall back to current values
      const fontSize = newFontSize || textBox.fontSize || 12;
      const fontFamily = newFontFamily || textBox.fontFamily || "Arial";

      // Calculate new dimensions based on the new font properties
      const { width: newTextWidth, height: newTextHeight } = measureText(
        textBox.value,
        fontSize,
        fontFamily,
        textBox.letterSpacing || 0,
        textBox.width, // Use current width as maxWidth to maintain width if text fits
        padding
      );

      // Add some padding for better visual appearance
      const paddingBuffer = 4;
      const newWidth = Math.max(newTextWidth + paddingBuffer, textBox.width);
      const newHeight = Math.max(newTextHeight + paddingBuffer, textBox.height);

      return { width: newWidth, height: newHeight };
    },
    []
  );

  // Format change handler for ElementFormatDrawer
  const handleFormatChange = useCallback(
    (format: any) => {
      // Check if we're in multi-selection mode
      const isMultiSelection =
        currentFormat &&
        "isMultiSelection" in currentFormat &&
        currentFormat.isMultiSelection;

      // Helper to check if any padding key is present in format
      const isPaddingChange =
        "paddingTop" in format ||
        "paddingRight" in format ||
        "paddingBottom" in format ||
        "paddingLeft" in format;

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
              // Get current textbox state
              const currentTextBox = getCurrentTextBoxes(
                viewState.currentView
              ).find((tb) => tb.id === element.id);

              if (
                currentTextBox &&
                ("fontSize" in format ||
                  "fontFamily" in format ||
                  isPaddingChange)
              ) {
                // Use new or current padding values
                const padding = {
                  top:
                    format.paddingTop !== undefined
                      ? format.paddingTop
                      : currentTextBox.paddingTop || 0,
                  right:
                    format.paddingRight !== undefined
                      ? format.paddingRight
                      : currentTextBox.paddingRight || 0,
                  bottom:
                    format.paddingBottom !== undefined
                      ? format.paddingBottom
                      : currentTextBox.paddingBottom || 0,
                  left:
                    format.paddingLeft !== undefined
                      ? format.paddingLeft
                      : currentTextBox.paddingLeft || 0,
                };
                // If font properties are changing, use new values, else use current
                const fontSize =
                  format.fontSize !== undefined
                    ? format.fontSize
                    : currentTextBox.fontSize;
                const fontFamily =
                  format.fontFamily !== undefined
                    ? format.fontFamily
                    : currentTextBox.fontFamily;
                const { width: newTextWidth, height: newTextHeight } =
                  measureText(
                    currentTextBox.value,
                    fontSize,
                    fontFamily,
                    currentTextBox.letterSpacing || 0,
                    undefined,
                    padding
                  );
                const paddingBuffer = 4;
                const newWidth = newTextWidth + paddingBuffer;
                const newHeight = newTextHeight + paddingBuffer;
                const updates = {
                  ...format,
                  width: newWidth,
                  height: newHeight,
                };
                updateTextBoxWithUndo(element.id, updates);
              } else {
                updateTextBoxWithUndo(element.id, format);
              }
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
        const currentTextBox = getCurrentTextBoxes(viewState.currentView).find(
          (tb) => tb.id === selectedElementId
        );

        if (
          currentTextBox &&
          ("fontSize" in format || "fontFamily" in format || isPaddingChange)
        ) {
          // Use new or current padding values
          const padding = {
            top:
              format.paddingTop !== undefined
                ? format.paddingTop
                : currentTextBox.paddingTop || 0,
            right:
              format.paddingRight !== undefined
                ? format.paddingRight
                : currentTextBox.paddingRight || 0,
            bottom:
              format.paddingBottom !== undefined
                ? format.paddingBottom
                : currentTextBox.paddingBottom || 0,
            left:
              format.paddingLeft !== undefined
                ? format.paddingLeft
                : currentTextBox.paddingLeft || 0,
          };
          // If font properties are changing, use new values, else use current
          const fontSize =
            format.fontSize !== undefined
              ? format.fontSize
              : currentTextBox.fontSize;
          const fontFamily =
            format.fontFamily !== undefined
              ? format.fontFamily
              : currentTextBox.fontFamily;
          const { width: newTextWidth, height: newTextHeight } = measureText(
            currentTextBox.value,
            fontSize,
            fontFamily,
            currentTextBox.letterSpacing || 0,
            undefined,
            padding
          );
          const paddingBuffer = 4;
          const newWidth = newTextWidth + paddingBuffer;
          const newHeight = newTextHeight + paddingBuffer;
          const updates = {
            ...format,
            width: newWidth,
            height: newHeight,
          };
          updateTextBoxWithUndo(selectedElementId, updates);
        } else {
          updateTextBoxWithUndo(selectedElementId, format);
        }
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
      getCurrentTextBoxes,
      viewState.currentView,
      setCurrentFormat,
      calculateTextboxDimensionsForFontChange,
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
              // Opacity fields
              textOpacity:
                selectedTextBox.textOpacity !== undefined
                  ? selectedTextBox.textOpacity
                  : 1,
              backgroundOpacity:
                selectedTextBox.backgroundOpacity !== undefined
                  ? selectedTextBox.backgroundOpacity
                  : 1,
              // State
              isEditing: selectedTextBox.isEditing || false,
            };

            // Update the format drawer state
            setCurrentFormat(safeTextBox);
            setIsDrawerOpen(true);
          } else {
            // Don't clear selection if the textbox might be from TemplateEditorPopup
            // Only clear if we're sure it should be in the main editor's collections
            if (!showTemplateEditor) {
              // Close drawer if selected text box is not found and we're not in template editor
              setIsDrawerOpen(false);
              setSelectedElementId(null);
              setCurrentFormat(null);
            }
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

            setCurrentFormat(shapeFormat);
            setIsDrawerOpen(true);
          } else {
            // Don't clear selection if the shape might be from TemplateEditorPopup
            if (!showTemplateEditor) {
              setIsDrawerOpen(false);
              setSelectedElementId(null);
              setCurrentFormat(null);
            }
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
            setCurrentFormat(selectedImage);
            setIsDrawerOpen(true);
          } else {
            // Don't clear selection if the image might be from TemplateEditorPopup
            if (!showTemplateEditor) {
              setIsDrawerOpen(false);
              setSelectedElementId(null);
              setCurrentFormat(null);
            }
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
  useEffect(() => {}, [
    editorState.isSelectionMode,
    editorState.multiSelection,
  ]);

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
      return;
    }

    const width = Math.abs(hadEnd.x - hadStart.x);
    const height = Math.abs(hadEnd.y - hadStart.y);

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
        // Only check elements from the target view on the current page
        const targetView = editorState.multiSelection.targetView;
        let textBoxes: TextField[] = [];
        let shapes: ShapeType[] = [];
        let images: ImageType[] = [];

        if (targetView === "original") {
          textBoxes = getCurrentTextBoxes("original").filter(
            (tb) => tb.page === documentState.currentPage
          );
          shapes = getCurrentShapes("original").filter(
            (s) => s.page === documentState.currentPage
          );
          images = getCurrentImages("original").filter(
            (img) => img.page === documentState.currentPage
          );
        } else if (targetView === "translated") {
          textBoxes = getCurrentTextBoxes("translated").filter(
            (tb) => tb.page === documentState.currentPage
          );
          shapes = getCurrentShapes("translated").filter(
            (s) => s.page === documentState.currentPage
          );
          images = getCurrentImages("translated").filter(
            (img) => img.page === documentState.currentPage
          );
        }

        const selectedElements = findElementsInSelection(
          selectionRect,
          textBoxes,
          shapes,
          images
        );

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
      documentState.currentPage,
      getElementById,
    ]
  );

  // Move selected elements - start moving mode
  const handleMoveSelection = useCallback(() => {
    setEditorState((prev) => {
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
      if (!editorState.multiSelection.isMovingSelection) {
        return;
      }
      if (e.button !== 0) {
        return; // Only left click
      }

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) {
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
      if (
        !editorState.multiSelection.isMovingSelection ||
        !editorState.multiSelection.moveStart
      ) {
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

  // Helper function to clear all elements and state
  const clearAllElementsAndState = useCallback(() => {
    // Clear all elements from both original and translated views
    setElementCollections({
      originalTextBoxes: [],
      originalShapes: [],
      originalDeletionRectangles: [],
      originalImages: [],
      translatedTextBoxes: [],
      translatedShapes: [],
      translatedDeletionRectangles: [],
      translatedImages: [],
    });

    // Clear layer order
    setLayerState({
      originalLayerOrder: [],
      translatedLayerOrder: [],
    });

    // Clear editor state
    setEditorState((prev) => ({
      ...prev,
      selectedFieldId: null,
      selectedShapeId: null,
      isEditMode: false,
      isAddTextBoxMode: false,
      isTextSelectionMode: false,
      showDeletionRectangles: false,
      isImageUploadMode: false,
      selectedTextBoxes: { textBoxIds: [] },
      isDrawingSelection: false,
      selectionStart: null,
      selectionEnd: null,
      selectionRect: null,
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
    }));

    // Clear tool state
    setToolState((prev) => ({
      ...prev,
      shapeDrawingMode: null,
      selectedShapeType: "rectangle",
      isDrawingShape: false,
      shapeDrawStart: null,
      shapeDrawEnd: null,
      isDrawingInProgress: false,
      shapeDrawTargetView: null,
    }));

    // Clear erasure state
    setErasureState((prev) => ({
      ...prev,
      isErasureMode: false,
      isDrawingErasure: false,
      erasureDrawStart: null,
      erasureDrawEnd: null,
      erasureDrawTargetView: null,
    }));
  }, [
    setElementCollections,
    setLayerState,
    setEditorState,
    setToolState,
    setErasureState,
  ]);

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

        // Clear all elements and state when uploading a new document
        clearAllElementsAndState();

        if (fileType === "image") {
          // For images, create a blank PDF and add the image as an interactive element
          createBlankPdfAndAddImage(file);
          // Reset deletedPages after upload
          setPageState((prev) => ({ ...prev, deletedPages: new Set() }));
        } else {
          // For PDFs, load normally
          actions.loadDocument(file);
          setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));
          // Reset deletedPages after upload
          setPageState((prev) => ({ ...prev, deletedPages: new Set() }));
        }
      }
    },
    [getFileType, createBlankPdfAndAddImage, actions, clearAllElementsAndState]
  );

  const handleImageFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        // Load the image to get its natural dimensions
        const img = new window.Image();
        img.onload = () => {
          const pageWidth = documentState.pageWidth;
          const pageHeight = documentState.pageHeight;
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          let width = pageWidth * 0.8;
          let height = width / aspectRatio;
          if (height > pageHeight * 0.8) {
            height = pageHeight * 0.8;
            width = height * aspectRatio;
          }
          // Center the image on the page
          const x = (pageWidth - width) / 2;
          const y = (pageHeight - height) / 2;
          // Always add to 'original' view and layer order
          const imageId = handleAddImageWithUndo(
            url,
            x,
            y,
            width,
            height,
            documentState.currentPage,
            "original",
            "original"
          );
          if (imageId) {
            handleImageSelect(imageId);
          }
          if (imageInputRef.current) {
            imageInputRef.current.value = "";
          }
          toast.success("Image added to document");
        };
        img.onerror = () => {
          toast.error("Failed to load image");
        };
        img.src = url;
      }
    },
    [
      handleAddImageWithUndo,
      documentState.pageWidth,
      documentState.pageHeight,
      documentState.currentPage,
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

        // Switch back to the previous view (tab) after snapshot
        setViewState((prev) => ({ ...prev, currentView: previousView }));

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

        // Call the OCR API using our centralized API
        const { processFile } = await import("@/lib/api");

        let data;
        try {
          data = await processFile(formData);

          // --- BEGIN: DETAILED RESPONSE DEBUG ---

          if (data.styled_layout) {
            if (
              data.styled_layout.pages &&
              data.styled_layout.pages.length > 0
            ) {
              const firstPage = data.styled_layout.pages[0];

              if (firstPage.entities && firstPage.entities.length > 0) {
              }
            }
          }

          if (data.styled_layout) {
            if (data.styled_layout.document_info) {
            }
            if (data.styled_layout.pages) {
            }
          }

          if (data.layout) {
            if (data.layout.document_info) {
            }
            if (data.layout.pages) {
            }
          }

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

        console.log("Returned entities from OCR API:", entities);

        if (entities.length > 0) {
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

            // Extract styling information from styled entity (handle both old and new formats)
            const styling = entity.styling || entity.style || {};
            const colors = styling.colors || {};

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
              if (a < 0.1) {
                return "transparent";
              }

              return `#${r.toString(16).padStart(2, "0")}${g
                .toString(16)
                .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
            };

            // --- Background color logic (use same logic as text color) ---
            let backgroundColor = "transparent";
            let backgroundOpacity = 1;
            if (colors.background_color) {
              const color = colors.background_color;
              // Use the same rgbToHex function as for textColor
              backgroundColor = rgbToHex(color);
              // Extract alpha if present
              if (Array.isArray(color)) {
                backgroundOpacity = color[3] !== undefined ? color[3] : 1;
              } else if (typeof color === "object" && "a" in color) {
                backgroundOpacity = color.a !== undefined ? color.a : 1;
              }
            }

            // --- Border color and width logic fix ---
            let borderColor = "#000000";
            let borderWidth = 0;
            if (colors.border_color) {
              // Use the same rgbToHex function as for textColor/backgroundColor
              borderColor = rgbToHex(colors.border_color);
              borderWidth = 1;
            }

            const textColor =
              colors.fill_color || colors.text_color
                ? rgbToHex(colors.fill_color || colors.text_color)
                : "#000000";
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
            const textPadding =
              styling.text_padding || getStyleValue("text_padding", 0);
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
              {
                top: textPadding,
                right: textPadding,
                bottom: textPadding,
                left: textPadding,
              } // padding
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
            }

            console.log("🫡 textPadding:", textPadding);
            console.log("🫡 width:", width);
            console.log("🫡 height:", height);

            // Add text_padding if present (after width/height are set)
            width += textPadding * 2;
            height += textPadding * 2;

            console.log("🫡 after width:", width);
            console.log("🫡 after height:", height);

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
              backgroundColor: backgroundColor,
              backgroundOpacity: backgroundOpacity,
              borderColor: borderColor,
              borderWidth: borderWidth,
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
              paddingTop: textPadding || 0,
              paddingRight: textPadding || 0,
              paddingBottom: textPadding || 0,
              paddingLeft: textPadding || 0,
              isEditing: false,
            };

            console.log("New textbox:", newTextBox);
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
                backgroundOpacity: textbox.backgroundOpacity,
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

          toast.success(
            `Transformed ${newTextBoxes.length} entities into textboxes`
          );

          // Switch back to the previous view
          setViewState((prev) => ({ ...prev, currentView: previousView }));
        } else {
          toast.error("No text entities found in the document");

          // Reset transforming state when no entities are found
          setPageState((prev) => ({
            ...prev,
            isTransforming: false,
          }));

          // Switch back to the previous view
          setViewState((prev) => ({ ...prev, currentView: previousView }));
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

  // Helper function to check if all non-deleted pages are translated
  const areAllPagesTranslated = useCallback(() => {
    const totalPages = documentState.numPages;
    const deletedPages = pageState.deletedPages;

    // Check each page that hasn't been deleted
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      if (!deletedPages.has(pageNumber)) {
        // If any non-deleted page is not translated, return false
        if (!pageState.isPageTranslated.get(pageNumber)) {
          return false;
        }
      }
    }
    return true;
  }, [
    documentState.numPages,
    pageState.deletedPages,
    pageState.isPageTranslated,
  ]);

  // State for export confirmation modal
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [pendingExport, setPendingExport] = useState<(() => void) | null>(null);

  // State for template editor
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [templateCanvas, setTemplateCanvas] =
    useState<HTMLCanvasElement | null>(null);

  // Add this state near other export-related states
  const [pendingTemplateExport, setPendingTemplateExport] = useState(false);

  // Actual export function
  const performExport = useCallback(async () => {
    if (!documentRef.current) {
      toast.error("Document not loaded");
      return;
    }

    // Save current state
    const originalScale = documentState.scale;
    const originalView = viewState.currentView;
    const originalSelectedField = editorState.selectedFieldId;
    const originalSelectedShape = editorState.selectedShapeId;
    const originalEditMode = editorState.isEditMode;

    const loadingToast = toast.loading("Generating PDF...");

    try {
      // Set up for export - hide UI elements and set optimal scale
      setEditorState((prev) => ({
        ...prev,
        selectedFieldId: null,
        selectedShapeId: null,
        isEditMode: false,
        isTextSelectionMode: false,
        isAddTextBoxMode: false,
        isSelectionMode: false,
      }));

      // Set zoom to 500% for maximum quality
      setDocumentState((prev) => ({ ...prev, scale: 5.0 }));

      // Wait for zoom to update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Import html2canvas dynamically
      const html2canvas = (await import("html2canvas")).default;

      // Create PDF document
      const pdfDoc = await PDFDocument.create();

      // Add template page as the first page if template canvas is available
      console.log("Template canvas check:", {
        hasTemplateCanvas: !!templateCanvas,
        templateCanvasType: templateCanvas ? typeof templateCanvas : "null",
        templateCanvasWidth: templateCanvas?.width,
        templateCanvasHeight: templateCanvas?.height,
      });

      if (templateCanvas) {
        try {
          console.log("Adding template page to PDF");
          const templateDataUrl = templateCanvas.toDataURL("image/png", 1.0);
          console.log(
            "Template data URL created, length:",
            templateDataUrl.length
          );

          const templateImageBytes = await fetch(templateDataUrl).then((res) =>
            res.arrayBuffer()
          );
          console.log(
            "Template image bytes loaded, size:",
            templateImageBytes.byteLength
          );

          const templateImage = await pdfDoc.embedPng(templateImageBytes);
          console.log("Template image embedded in PDF");

          // Create first page with template - this will be page 1
          const templatePage = pdfDoc.addPage([612, 792]); // Letter size
          const { width: pageWidth, height: pageHeight } =
            templatePage.getSize();

          // Scale template to fit page while maintaining aspect ratio
          const templateDims = templateImage.scale(1);
          const scaleX = pageWidth / templateDims.width;
          const scaleY = pageHeight / templateDims.height;
          const templateScale = Math.min(scaleX, scaleY);

          const scaledWidth = templateDims.width * templateScale;
          const scaledHeight = templateDims.height * templateScale;

          // Center the template on the page
          const x = (pageWidth - scaledWidth) / 2;
          const y = (pageHeight - scaledHeight) / 2;

          templatePage.drawImage(templateImage, {
            x: x,
            y: y,
            width: scaledWidth,
            height: scaledHeight,
          });

          console.log("Template page added successfully as first page");

          // Add a title to the template page
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          templatePage.drawText("EXPORT TEMPLATE", {
            x: pageWidth / 2 - 60,
            y: pageHeight - 30,
            size: 16,
            font: font,
            color: rgb(0, 0, 0),
          });

          // Add page number to template page
          templatePage.drawText("Page 1 (Template)", {
            x: pageWidth / 2 - 50,
            y: 30,
            size: 12,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
          });
        } catch (error) {
          console.error("Error adding template page:", error);
          // Continue without template if there's an error
        }
      } else {
        console.log("No template canvas available, skipping template page");
      }

      // Function to capture view as image for a specific page
      const captureViewAsImage = async (
        viewType: "original" | "translated",
        pageNumber: number
      ) => {
        // Set view to the target type
        setViewState((prev) => ({ ...prev, currentView: viewType }));

        // Set page number
        setDocumentState((prev) => ({ ...prev, currentPage: pageNumber }));

        // Wait for view and page to update
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Use the entire document ref like DocumentCanvas does
        const documentContainer = documentRef.current;

        if (!documentContainer) {
          throw new Error(
            `Document container not found for ${viewType} view page ${pageNumber}`
          );
        }

        console.log(
          `Capturing ${viewType} view from page ${pageNumber}:`,
          documentContainer
        );

        // Capture the view using the same approach as DocumentCanvas
        const canvas = await html2canvas(documentContainer, {
          scale: 1, // Use 1x scale since we already scaled the content to 500%
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          foreignObjectRendering: false, // Disable for better PDF.js compatibility
          ignoreElements: (element) => {
            // Only ignore control elements, NOT shapes themselves
            return (
              element.classList.contains("drag-handle") ||
              element.tagName === "BUTTON" ||
              element.classList.contains("settings-popup") ||
              element.classList.contains("text-selection-popup") ||
              element.classList.contains("shape-dropdown") ||
              element.classList.contains("field-status-dropdown") ||
              element.classList.contains("fixed") ||
              element.closest(".fixed") !== null ||
              // Ignore resize handles but not the shapes themselves
              element.classList.contains("react-resizable-handle")
            );
          },
          onclone: (clonedDoc) => {
            console.log("Cloning document for export...");

            // Find the cloned document container
            const clonedContainer = clonedDoc.querySelector(
              'div[style*="relative"]'
            );

            if (clonedContainer) {
              // Remove control elements but keep shapes
              clonedContainer
                .querySelectorAll(
                  "button, .drag-handle, .settings-popup, .text-selection-popup, .shape-dropdown, .field-status-dropdown, .fixed, .react-resizable-handle"
                )
                .forEach((el) => el.remove());

              // Clean up Rnd containers (both text fields and shapes)
              clonedContainer.querySelectorAll(".rnd").forEach((rnd) => {
                if (rnd instanceof HTMLElement) {
                  // Remove border and controls but keep the content
                  rnd.style.border = "none";
                  rnd.style.backgroundColor = "transparent";
                  rnd.style.boxShadow = "none";
                  rnd.style.outline = "none";
                  rnd.style.cursor = "default";

                  // Check if this is a text field container and raise it for better export appearance
                  const textarea = rnd.querySelector("textarea");
                  if (textarea && textarea instanceof HTMLElement) {
                    // Raise ALL text field containers by adjusting position
                    const currentTop = parseFloat(rnd.style.top || "0");
                    rnd.style.top = `${currentTop - 5 * documentState.scale}px`; // Raise by 5px scaled

                    // Clean up textarea styling
                    textarea.style.border = "none";
                    textarea.style.outline = "none";
                    textarea.style.resize = "none";
                    textarea.style.padding = "2px"; // Match live editor padding
                    textarea.style.margin = "0";
                    textarea.style.backgroundColor = "transparent";
                    textarea.style.cursor = "default";
                    textarea.style.overflow = "visible"; // Allow overflow during export to prevent clipping
                    textarea.style.whiteSpace = "pre-wrap"; // Ensure text wrapping is preserved
                    textarea.style.wordWrap = "break-word"; // Ensure long words break properly
                    textarea.style.wordBreak = "break-word"; // Additional word breaking support

                    // Ensure adequate height for wrapped text during export
                    const textContent = textarea.value || "";
                    if (textContent.length > 0) {
                      // Force explicit text wrapping styles
                      textarea.style.whiteSpace = "pre-wrap";
                      textarea.style.wordWrap = "break-word";
                      textarea.style.wordBreak = "break-word";
                      textarea.style.overflowWrap = "break-word";

                      // Calculate estimated height based on content
                      const fontSize = parseFloat(
                        textarea.style.fontSize || "12"
                      );
                      const lineHeight = fontSize * 1.1;

                      // Count explicit line breaks and estimate wrapped lines
                      const explicitLines =
                        (textContent.match(/\n/g) || []).length + 1;
                      const avgCharsPerLine = Math.max(
                        20,
                        Math.floor(
                          parseFloat(rnd.style.width || "200") /
                            (fontSize * 0.6)
                        )
                      );
                      const estimatedWrappedLines = Math.ceil(
                        textContent.replace(/\n/g, " ").length / avgCharsPerLine
                      );
                      const totalEstimatedLines = Math.max(
                        explicitLines,
                        estimatedWrappedLines
                      );

                      // Apply generous height to ensure all text is visible
                      const generousHeight =
                        totalEstimatedLines * lineHeight + 20; // Extra 20px buffer
                      const currentHeight = parseFloat(rnd.style.height || "0");

                      // Always expand if we have multi-line content
                      if (
                        totalEstimatedLines > 1 ||
                        generousHeight > currentHeight
                      ) {
                        rnd.style.height = `${generousHeight}px`;
                        textarea.style.height = `${generousHeight - 8}px`; // Slightly smaller than container
                      }

                      // Ensure no text overflow
                      textarea.style.overflow = "visible";
                      textarea.style.textOverflow = "clip";
                    }

                    // No position adjustments - keep exactly what user sees in live editor
                  }

                  // Ensure shapes are visible and properly styled for export
                  const shapeElement = rnd.querySelector(".shape-drag-handle");
                  if (shapeElement && shapeElement instanceof HTMLElement) {
                    // Keep the shape but remove interactive styling for export
                    shapeElement.style.cursor = "default";
                    shapeElement.style.pointerEvents = "none";
                    // Ensure the shape maintains its visual properties
                    shapeElement.style.display = "block";
                    shapeElement.style.visibility = "visible";
                    shapeElement.style.opacity = "1";
                  }
                }
              });

              // Also clean up any standalone shape elements that might not be in Rnd containers
              clonedContainer
                .querySelectorAll(".shape-drag-handle")
                .forEach((shape) => {
                  if (shape instanceof HTMLElement) {
                    shape.style.cursor = "default";
                    shape.style.pointerEvents = "none";
                    shape.style.display = "block";
                    shape.style.visibility = "visible";
                    shape.style.opacity = "1";
                  }
                });

              // Ensure the PDF canvas is visible in the clone
              const clonedCanvas = clonedContainer.querySelector(
                ".react-pdf__Page__canvas"
              ) as HTMLCanvasElement;
              if (clonedCanvas) {
                clonedCanvas.style.display = "block";
                clonedCanvas.style.position = "relative";
                clonedCanvas.style.zIndex = "1";
                console.log("Cloned canvas configured:", {
                  width: clonedCanvas.width,
                  height: clonedCanvas.height,
                });
              }
            }
          },
        });

        return canvas;
      };

      // Capture all non-deleted pages in the document
      const totalPages = documentState.numPages;
      const deletedPages = pageState.deletedPages;
      const allCaptures = [];

      // Get all non-deleted page numbers
      const nonDeletedPages = [];
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        if (!deletedPages.has(pageNumber)) {
          nonDeletedPages.push(pageNumber);
        }
      }

      // If no pages to export, show error and return
      if (nonDeletedPages.length === 0) {
        toast.error(
          "No pages available for export. All pages have been deleted."
        );
        return;
      }

      // Process non-deleted pages in pairs (2 pages per PDF page)
      for (let i = 0; i < nonDeletedPages.length; i += 2) {
        const page1 = nonDeletedPages[i];
        const page2 = nonDeletedPages[i + 1];
        const hasPage2 = page2 !== undefined;

        const pageCaptures = [];

        // Page 1 - Original view
        pageCaptures.push({
          canvas: await captureViewAsImage("original", page1),
          type: "original",
          page: page1,
          position: "top-left",
        });

        // Page 1 - Translated view
        pageCaptures.push({
          canvas: await captureViewAsImage("translated", page1),
          type: "translated",
          page: page1,
          position: "top-right",
        });

        if (hasPage2) {
          // Page 2 - Original view
          pageCaptures.push({
            canvas: await captureViewAsImage("original", page2),
            type: "original",
            page: page2,
            position: "bottom-left",
          });

          // Page 2 - Translated view
          pageCaptures.push({
            canvas: await captureViewAsImage("translated", page2),
            type: "translated",
            page: page2,
            position: "bottom-right",
          });
        }

        allCaptures.push({
          pageNumber: Math.floor(i / 2) + 1,
          captures: pageCaptures,
          page1,
          page2: hasPage2 ? page2 : null,
        });
      }

      // Process each page pair and create PDF pages
      for (const pageData of allCaptures) {
        const { pageNumber, captures, page1, page2 } = pageData;

        // Convert captures to images and embed in PDF
        const embeddedImages = [];

        for (const capture of captures) {
          const dataUrl = capture.canvas.toDataURL("image/png", 1.0);
          const imageBytes = await fetch(dataUrl).then((res) =>
            res.arrayBuffer()
          );
          const embeddedImage = await pdfDoc.embedPng(imageBytes);
          embeddedImages.push({
            ...capture,
            image: embeddedImage,
            dims: embeddedImage.scale(1),
          });
        }

        // Create a new page for this pair
        const page = pdfDoc.addPage([612, 792]); // Letter size: 8.5" x 11" in points
        const { width: pageWidth, height: pageHeight } = page.getSize();

        // Calculate layout - split page into two halves
        const halfWidth = pageWidth / 2;
        const margin = 20;
        const contentWidth = halfWidth - margin * 2;
        const contentHeight = pageHeight - margin * 2;

        // Embed fonts
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Add section labels - centered in their sections
        const labelFontSize = 20;
        const originalLabel = "ORIGINAL";
        const translatedLabel = "TRANSLATED";

        // Calculate label widths for centering
        const originalLabelWidth = font.widthOfTextAtSize(
          originalLabel,
          labelFontSize
        );
        const translatedLabelWidth = font.widthOfTextAtSize(
          translatedLabel,
          labelFontSize
        );

        // Center ORIGINAL in the left half
        const originalX = (halfWidth - originalLabelWidth) / 2;
        page.drawText(originalLabel, {
          x: originalX,
          y: pageHeight - 60,
          size: labelFontSize,
          font: font,
          color: rgb(0, 0, 0),
        });

        // Center TRANSLATED in the right half
        const translatedX = halfWidth + (halfWidth - translatedLabelWidth) / 2;
        page.drawText(translatedLabel, {
          x: translatedX,
          y: pageHeight - 60,
          size: labelFontSize,
          font: font,
          color: rgb(0, 0, 0),
        });

        // Calculate grid layout - optimized for better space utilization
        const gridMargin = 10; // Reduced margin for more content space
        const gridSpacing = 8; // Reduced spacing for tighter layout
        const labelSpace = 15; // Space reserved for labels
        const availableWidth = pageWidth - gridMargin * 2;
        const availableHeight = pageHeight - gridMargin * 2 - labelSpace;

        // For 2x2 grid, each quadrant gets half the available space minus spacing
        const quadrantWidth = (availableWidth - gridSpacing) / 2;
        const quadrantHeight = (availableHeight - gridSpacing) / 2;

        // Draw each image in its grid position
        for (const imageData of embeddedImages) {
          const { image, dims, position, type, page: pageNumber } = imageData;

          // Calculate scaling to fit in quadrant while maintaining aspect ratio
          const scaleX = quadrantWidth / dims.width;
          const scaleY = quadrantHeight / dims.height;
          const imageScale = Math.min(scaleX, scaleY);

          const scaledWidth = dims.width * imageScale;
          const scaledHeight = dims.height * imageScale;

          // Calculate position based on grid layout
          let x, y;
          switch (position) {
            case "top-left":
              x = gridMargin;
              y = pageHeight - labelSpace - quadrantHeight;
              break;
            case "top-right":
              x = gridMargin + quadrantWidth + gridSpacing;
              y = pageHeight - labelSpace - quadrantHeight;
              break;
            case "bottom-left":
              x = gridMargin;
              y = pageHeight - labelSpace - quadrantHeight * 2 - gridSpacing;
              break;
            case "bottom-right":
              x = gridMargin + quadrantWidth + gridSpacing;
              y = pageHeight - labelSpace - quadrantHeight * 2 - gridSpacing;
              break;
            default:
              x = gridMargin;
              y = pageHeight - labelSpace - quadrantHeight;
          }

          // Center the image in its quadrant
          x += (quadrantWidth - scaledWidth) / 2;
          y += (quadrantHeight - scaledHeight) / 2;

          // Draw the image
          page.drawImage(image, {
            x: x,
            y: y,
            width: scaledWidth,
            height: scaledHeight,
          });

          // Add label for each quadrant - simplified labels
          let label = "";
          let labelX = 0;
          let labelY = 0;

          if (position === "top-left") {
            label = "ORIGINAL";
            labelX = x;
            labelY = y + scaledHeight + 5;
          } else if (position === "top-right") {
            label = "TRANSLATED";
            labelX = x;
            labelY = y + scaledHeight + 5;
          }
          // No labels for bottom quadrants

          if (label) {
            const labelFontSize = 10;
            page.drawText(label, {
              x: labelX,
              y: labelY,
              size: labelFontSize,
              font: font,
              color: rgb(0.4, 0.4, 0.4),
            });
          }
        }

        // Add grid separator lines
        const centerX = gridMargin + quadrantWidth + gridSpacing / 2;
        const centerY =
          pageHeight - labelSpace - quadrantHeight - gridSpacing / 2;

        // Vertical line
        page.drawLine({
          start: { x: centerX, y: gridMargin },
          end: { x: centerX, y: pageHeight - labelSpace },
          thickness: 1,
          color: rgb(0.8, 0.8, 0.8),
        });

        // Horizontal line
        page.drawLine({
          start: { x: gridMargin, y: centerY },
          end: { x: pageWidth - gridMargin, y: centerY },
          thickness: 1,
          color: rgb(0.8, 0.8, 0.8),
        });
      }

      // Save the PDF
      console.log("Final PDF page count:", pdfDoc.getPageCount());
      console.log("Template canvas was:", templateCanvas ? "present" : "null");

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `pdf-editor-export-all-pages.pdf`;
      link.click();

      URL.revokeObjectURL(url);

      // Restore original state
      setDocumentState((prev) => ({ ...prev, scale: originalScale }));
      setViewState((prev) => ({ ...prev, currentView: originalView }));
      setEditorState((prev) => ({
        ...prev,
        selectedFieldId: originalSelectedField,
        selectedShapeId: originalSelectedShape,
        isEditMode: originalEditMode,
      }));

      // Dismiss loading toast and show success message
      toast.dismiss(loadingToast);
      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error("Error exporting PDF:", error);

      // Dismiss loading toast and show error message
      toast.dismiss(loadingToast);
      toast.error("Failed to export PDF");

      // Restore original state on error as well
      setDocumentState((prev) => ({ ...prev, scale: originalScale }));
      setViewState((prev) => ({ ...prev, currentView: originalView }));
      setEditorState((prev) => ({
        ...prev,
        selectedFieldId: originalSelectedField,
        selectedShapeId: originalSelectedShape,
        isEditMode: originalEditMode,
      }));
    }
  }, [
    documentState,
    viewState.currentView,
    editorState,
    colorToRgba,
    rgbStringToHex,
    templateCanvas,
  ]);

  // Template editor handlers
  const handleTemplateEditorClose = useCallback(() => {
    setShowTemplateEditor(false);
    setTemplateCanvas(null);
  }, []);

  const handleTemplateEditorContinue = useCallback(
    (canvas: HTMLCanvasElement) => {
      setTemplateCanvas(canvas);
      setShowTemplateEditor(false);
      setPendingTemplateExport(true); // trigger export after canvas is set
    },
    []
  );

  // Export function with confirmation logic
  const exportToPDF = useCallback(() => {
    // First show the template editor
    setShowTemplateEditor(true);
  }, []);

  // Simple test export function to verify template page
  const testTemplateExport = useCallback(async () => {
    if (!templateCanvas) {
      toast.error("No template canvas available");
      return;
    }

    try {
      const loadingToast = toast.loading("Testing template export...");

      // Create PDF document
      const pdfDoc = await PDFDocument.create();

      // Add template page as the first page
      console.log("Adding template page to test PDF");
      const templateDataUrl = templateCanvas.toDataURL("image/png", 1.0);
      const templateImageBytes = await fetch(templateDataUrl).then((res) =>
        res.arrayBuffer()
      );
      const templateImage = await pdfDoc.embedPng(templateImageBytes);

      // Create first page with template
      const templatePage = pdfDoc.addPage([612, 792]); // Letter size
      const { width: pageWidth, height: pageHeight } = templatePage.getSize();

      // Scale template to fit page while maintaining aspect ratio
      const templateDims = templateImage.scale(1);
      const scaleX = pageWidth / templateDims.width;
      const scaleY = pageHeight / templateDims.height;
      const templateScale = Math.min(scaleX, scaleY);

      const scaledWidth = templateDims.width * templateScale;
      const scaledHeight = templateDims.height * templateScale;

      // Center the template on the page
      const x = (pageWidth - scaledWidth) / 2;
      const y = (pageHeight - scaledHeight) / 2;

      templatePage.drawImage(templateImage, {
        x: x,
        y: y,
        width: scaledWidth,
        height: scaledHeight,
      });

      // Add a title to the template page
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      templatePage.drawText("TEMPLATE TEST PAGE", {
        x: pageWidth / 2 - 80,
        y: pageHeight - 30,
        size: 16,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Add page number
      templatePage.drawText("Page 1 (Template Only)", {
        x: pageWidth / 2 - 60,
        y: 30,
        size: 12,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

      console.log("Template test PDF page count:", pdfDoc.getPageCount());

      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `template-test.pdf`;
      link.click();

      URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success("Template test PDF exported!");
    } catch (error) {
      console.error("Error in template test export:", error);
      toast.error("Template test export failed");
    }
  }, [templateCanvas]);

  // Export confirmation handlers
  const handleConfirmExport = useCallback(() => {
    setShowExportConfirm(false);
    if (pendingExport) {
      pendingExport();
      setPendingExport(null);
    }
  }, [pendingExport]);

  const handleCancelExport = useCallback(() => {
    setShowExportConfirm(false);
    setPendingExport(null);
  }, []);

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
  useEffect(() => {}, [
    isDrawerOpen,
    selectedElementType,
    currentFormat,
    selectedElementId,
  ]);

  // Add effect to monitor multi-selection state for debugging
  useEffect(() => {}, [editorState.multiSelection]);

  // Add effect to monitor page translation state for debugging
  useEffect(() => {}, [
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

  // Memoized values
  const memoizedTextBoxElements = useMemo(() => {
    return currentPageSortedElements
      .filter((el) => el.type === "textbox")
      .map(renderElement);
  }, [
    currentPageSortedElements,
    editorState.selectedFieldId,
    editorState.isEditMode,
    documentState.scale,
    showPaddingPopup,
    editorState.isTextSelectionMode,
    selectionState.selectedTextBoxes.textBoxIds,
    autoFocusTextBoxId,
  ]);

  // Add effect to log translatedTextBoxes on document click
  useEffect(() => {
    const handleClick = () => {
      const originalTextBox = elementCollections.originalTextBoxes;
      const translatedTextBoxes = elementCollections.translatedTextBoxes;
      console.log("Current originalTextBoxes:", originalTextBox);
      console.log("Current translatedTextBoxes:", translatedTextBoxes);
    };
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [elementCollections.translatedTextBoxes]);

  // Add state for bulk OCR
  const [isBulkOcrRunning, setIsBulkOcrRunning] = useState(false);
  const [bulkOcrProgress, setBulkOcrProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const bulkOcrCancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Handler to run OCR for all pages
  const handleRunOcrAllPages = useCallback(async () => {
    if (isBulkOcrRunning) return;
    const deletedPages = pageState.deletedPages;
    const totalPages = documentState.numPages;
    // Build a list of non-deleted pages
    const pagesToProcess = Array.from(
      { length: totalPages },
      (_, i) => i + 1
    ).filter((page) => !deletedPages.has(page));
    setIsBulkOcrRunning(true);
    setBulkOcrProgress({ current: 0, total: pagesToProcess.length });
    bulkOcrCancelRef.current.cancelled = false;

    // Store the current page to restore later
    const originalPage = documentState.currentPage;

    for (let i = 0; i < pagesToProcess.length; i++) {
      if (bulkOcrCancelRef.current.cancelled) break;
      const page = pagesToProcess[i];
      // Switch to the page
      actions.changePage(page);
      // Wait for the page to render (wait for isPageLoading to be false)
      await new Promise((resolve) => {
        let waited = 0;
        const check = () => {
          // If cancelled, resolve immediately
          if (bulkOcrCancelRef.current.cancelled) return resolve(null);
          // If page is loaded, resolve
          if (!documentState.isPageLoading) return resolve(null);
          // Otherwise, check again after a short delay
          waited += 50;
          if (waited > 5000) return resolve(null); // Timeout after 5s
          setTimeout(check, 50);
        };
        check();
      });
      // Run OCR for this page
      try {
        await handleTransformPageToTextbox(page);
      } catch (e) {
        // Optionally handle error per page
      }
      setBulkOcrProgress({ current: i + 1, total: pagesToProcess.length });
      // DO NOT restore the original page here; only do it after the loop
    }

    // Restore the original page only after all processing is done or cancelled
    actions.changePage(originalPage);
    setIsBulkOcrRunning(false);
    setBulkOcrProgress(null);
  }, [
    isBulkOcrRunning,
    documentState.numPages,
    documentState.currentPage,
    documentState.isPageLoading,
    pageState.deletedPages,
    handleTransformPageToTextbox,
    actions,
  ]);

  // Handler to cancel bulk OCR
  const handleCancelBulkOcr = useCallback(() => {
    bulkOcrCancelRef.current.cancelled = true;
    setIsBulkOcrRunning(false);
  }, []);

  // Add state for confirmation modal
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingFileUpload, setPendingFileUpload] = useState<
    (() => void) | null
  >(null);

  // Intercept file upload to show confirmation if a document is loaded
  const handleFileUploadIntercept = useCallback(() => {
    if (documentState.url) {
      setShowReplaceConfirm(true);
      setPendingFileUpload(() => () => {
        setShowReplaceConfirm(false);
        setPendingFileUpload(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fileInputRef.current?.click();
      });
    } else {
      if (fileInputRef.current) fileInputRef.current.value = "";
      fileInputRef.current?.click();
    }
  }, [documentState.url]);

  // When confirmed, reset all state (including deletedPages) and proceed
  const handleConfirmReplace = useCallback(() => {
    setShowReplaceConfirm(false);
    if (pendingFileUpload) pendingFileUpload();
  }, [pendingFileUpload]);

  const handleCancelReplace = useCallback(() => {
    setShowReplaceConfirm(false);
    setPendingFileUpload(null);
  }, []);

  useEffect(() => {
    if (pendingExport && templateCanvas) {
      performExport();
      setPendingExport(null);
    }
  }, [pendingExport, templateCanvas, performExport]);

  useEffect(() => {
    if (pendingTemplateExport && templateCanvas) {
      performExport();
      setPendingTemplateExport(false);
    }
  }, [pendingTemplateExport, templateCanvas, performExport]);

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
        onFileUpload={handleFileUploadIntercept}
        onSaveProject={saveProject}
        onExportData={exportToPDF}
        onUndo={() => {
          const now = Date.now();
          if (now - lastUndoTime < UNDO_REDO_DEBOUNCE_MS) {
            return;
          }

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
            return;
          }

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
        // Bulk OCR props
        onRunOcrAllPages={handleRunOcrAllPages}
        isBulkOcrRunning={isBulkOcrRunning}
        bulkOcrProgress={bulkOcrProgress}
        onCancelBulkOcr={handleCancelBulkOcr}
        hasPages={documentState.numPages > 0}
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
          onFileUpload={handleFileUploadIntercept}
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
                                  <span>Run OCR</span>
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
                                    <span>RUN OCR</span>
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

                      {/* Render all elements in layer order */}
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={showReplaceConfirm}
        title="Replace Document?"
        description="Uploading a new document will remove all current pages, including deleted ones, and reset the editor. Continue?"
        onConfirm={handleConfirmReplace}
        onCancel={handleCancelReplace}
        confirmText="Replace"
        cancelText="Cancel"
      />

      {/* Export Confirmation Modal */}
      <ConfirmationModal
        open={showExportConfirm}
        title="Not All Pages Translated"
        description="Some non-deleted pages have not been translated yet. Do you wish to continue with the export?"
        onConfirm={handleConfirmExport}
        onCancel={handleCancelExport}
        confirmText="Continue Export"
        cancelText="Cancel"
      />

      {/* Template Editor Popup */}
      <TemplateEditorPopup
        isOpen={showTemplateEditor}
        onClose={handleTemplateEditorClose}
        onContinue={handleTemplateEditorContinue}
      />
    </div>
  );
};
