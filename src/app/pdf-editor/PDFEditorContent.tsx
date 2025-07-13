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

  // Auto-focus state
  const [autoFocusTextBoxId, setAutoFocusTextBoxId] = useState<string | null>(
    null
  );

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
        updateTextBox,
        updateShape,
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
      updateTextBox,
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
                    updateTextBox(el.id, { x: constrainedX, y: constrainedY });
                    break;
                  case "shape":
                    updateShape(el.id, { x: constrainedX, y: constrainedY });
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
      updateTextBox,
      updateShape,
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
        (x, y, width, height, page, view, background, opacity) =>
          addDeletionRectangle(
            x,
            y,
            width,
            height,
            page,
            view,
            background || "",
            opacity
          ),
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
        (x, y, page, view) => addTextBox(x, y, page, view),
        (x, y, width, height, page, view, background, opacity) => {
          return addDeletionRectangle(
            x,
            y,
            width,
            height,
            page,
            view,
            background || "",
            opacity
          );
        },
        documentState.pdfBackgroundColor,
        erasureState.erasureSettings.opacity
      );
    },
    addDeletionRectangle: (x, y, width, height, page, background, opacity) => {
      const targetView =
        viewState.currentView === "split" ? "original" : viewState.currentView;
      return addDeletionRectangle(
        x,
        y,
        width,
        height,
        page,
        targetView,
        background || "",
        opacity
      );
    },
    updateTextBox,
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
            // Create deletion rectangle for each selected text box
            selectedIds.forEach((textBoxId) => {
              const textBox = currentPageTextBoxes.find(
                (tb) => tb.id === textBoxId
              );
              if (textBox) {
                addDeletionRectangle(
                  textBox.x,
                  textBox.y,
                  textBox.width,
                  textBox.height,
                  documentState.currentPage,
                  viewState.currentView,
                  documentState.pdfBackgroundColor,
                  erasureState.erasureSettings.opacity
                );
              }
            });
            toast.success(
              `Created deletion rectangles for ${selectedIds.length} selected text boxes`
            );
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
              updateTextBox(element.id, format);
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
              updateShape(element.id, updates);
            }
          });
        }
      } else if (selectedElementType === "textbox" && selectedElementId) {
        // Handle single text field format changes
        updateTextBox(selectedElementId, format);
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
        updateShape(selectedElementId, updates);
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
      updateTextBox,
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
        if (!enabled) {
          setToolState((prev) => ({ ...prev, shapeDrawingMode: "rectangle" }));
        }
        break;
      case "circle":
        if (!enabled) {
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
        addShape(
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

                // Create deletion rectangle
                addDeletionRectangle(
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

      // Use the addDeletionRectangle function from element management
      // In split view, use the target view; otherwise use current view
      const targetViewForDeletion =
        viewState.currentView === "split" ? targetView : viewState.currentView;

      addDeletionRectangle(
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
    addDeletionRectangle,
  ]);

  // Create deletion rectangle from selected text
  const createDeletionFromSelection = useCallback(
    (selection: {
      text: string;
      pagePosition: { x: number; y: number };
      pageSize: { width: number; height: number };
    }) => {
      addDeletionRectangle(
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
    [addDeletionRectangle, documentState.currentPage, viewState.currentView]
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
      const { x, y } = screenToDocumentCoordinates(
        e.clientX,
        e.clientY,
        rect,
        documentState.scale,
        null,
        viewState.currentView,
        documentState.pageWidth
      );

      console.log("Selection move coordinates", { x, y });

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
          deleteTextBox(selectedElement.id, viewState.currentView);
          break;
        case "shape":
          deleteShape(selectedElement.id, viewState.currentView);
          break;
        case "image":
          deleteImage(selectedElement.id, viewState.currentView);
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
  }, [
    editorState.multiSelection.selectedElements,
    deleteTextBox,
    deleteShape,
    deleteImage,
    viewState.currentView,
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
        updateTextBox,
        updateShape,
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
      updateTextBox,
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
        null,
        viewState.currentView,
        documentState.pageWidth
      );

      console.log("Move selection mouse down", { x, y });

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
        null,
        viewState.currentView,
        documentState.pageWidth
      );

      const deltaX = x - editorState.multiSelection.moveStart.x;
      const deltaY = y - editorState.multiSelection.moveStart.y;

      console.log("Move selection mouse move", { x, y, deltaX, deltaY });

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
        updateTextBox,
        updateShape,
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
        const fieldId = addTextBox(
          x,
          y,
          documentState.currentPage,
          viewState.currentView,
          targetView || undefined
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

  // File handlers
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        actions.loadDocument(file);
        setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));
      }
    },
    [actions]
  );

  const handleImageFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);

        const imageId = addImage(
          url,
          100,
          100,
          200,
          150,
          documentState.currentPage,
          viewState.currentView
        );

        handleImageSelect(imageId);

        if (imageInputRef.current) {
          imageInputRef.current.value = "";
        }

        toast.success("Image added to document");
      }
    },
    [
      addImage,
      documentState.currentPage,
      viewState.currentView,
      handleImageSelect,
    ]
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
          onUpdate={updateTextBox}
          onDelete={(id) => deleteTextBox(id, viewState.currentView)}
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
          onUpdate={updateShape}
          onDelete={(id) => deleteShape(id, viewState.currentView)}
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
          onDelete={(id) => deleteImage(id, viewState.currentView)}
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
          onChange={handleFileUpload}
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

          {/* Floating Toolbars */}
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

          {/* Erasure Settings Popup */}
          {erasureState.isErasureMode && (
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
                  <label className="text-xs text-gray-600 w-20">Opacity:</label>
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
                  <label className="text-xs text-gray-600 w-20">Page BG:</label>
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

                        {/* Transform JSON Button - positioned in the middle */}
                        {!pageState.isPageTranslated.get(
                          documentState.currentPage
                        ) && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <button
                              onClick={() => {
                                // TODO: Implement transform functionality
                                toast.info(
                                  "Transform functionality not yet implemented"
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
                                      deleteDeletionRectangle(
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
                                  onUpdate={updateTextBox}
                                  onDelete={(id) =>
                                    deleteTextBox(id, viewState.currentView)
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
                                  onUpdate={updateShape}
                                  onDelete={(id) =>
                                    deleteShape(id, viewState.currentView)
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
                                    deleteImage(id, viewState.currentView)
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
                                        updateTextBox,
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
                            <div className="absolute inset-0 flex items-center justify-center">
                              <button
                                onClick={() => {
                                  // TODO: Implement transform functionality
                                  toast.info(
                                    "Transform functionality not yet implemented"
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
                                      deleteDeletionRectangle(
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
                                  onUpdate={updateTextBox}
                                  onDelete={(id) =>
                                    deleteTextBox(id, viewState.currentView)
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
                                  onUpdate={updateShape}
                                  onDelete={(id) =>
                                    deleteShape(id, viewState.currentView)
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
                                    deleteImage(id, viewState.currentView)
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
                                        updateTextBox,
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
                                deleteDeletionRectangle(
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
                                    updateTextBox,
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
