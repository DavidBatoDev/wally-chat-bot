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

// Import services
import { performPageOcr, performBulkOcr } from "./services/ocrService";
import {
  exportPdfDocument,
  // handleFileUpload as handleFileUploadService,
  // handleAppendDocument,
  // createBlankPdfAndAddImage as createBlankPdfAndAddImageService,
  // appendImageAsNewPage as appendImageAsNewPageService,
  // appendPdfDocument as appendPdfDocumentService,
  exportToPDFService,
  exportToPNGService,
  exportToJPEGService,
} from "./services/pdfExportService";
import { preloadHtml2Canvas } from "./utils/html2canvasLoader";

// Import types
import {
  EditorState,
  ToolState,
  ErasureState,
  SelectionState,
  ViewState,
  PageState,
  ViewMode,
  WorkflowStep,
  TextField,
  Shape as ShapeType,
  Image as ImageType,
  DeletionRectangle,
  SortedElement,
} from "./types/pdf-editor.types";

// Import hooks
import { useDocumentState } from "./hooks/states/useDocumentState";
import { useElementManagement } from "./hooks/states/useElementManagement";
import { useTextSpanHandling } from "./hooks/states/useTextSpanHandling";
import { useHistory } from "./hooks/states/useHistory";
import { useProjectState } from "./hooks/states/useProjectState";
import { useProjectCreation } from "./hooks/useProjectCreation";
import { uploadFileWithFallback } from "./services/fileUploadService";
import {
  useHandleAddTextBoxWithUndo,
  useHandleDuplicateTextBoxWithUndo,
  useHandleUpdateTextBoxWithUndo,
  useUpdateTextBoxWithUndo,
  useUpdateOriginalTextBoxWithUndo,
  useUpdateTranslatedTextBoxWithUndo,
  useUpdateFinalLayoutTextBoxWithUndo,
  useHandleAddShapeWithUndo,
  useHandleUpdateShapeWithUndo,
  useUpdateShapeWithUndo,
  useHandleDeleteTextBoxWithUndo,
  useHandleDeleteShapeWithUndo,
  useHandleAddDeletionRectangleWithUndo,
  useHandleDeleteDeletionRectangleWithUndo,
  useHandleAddImageWithUndo,
  useHandleDeleteImageWithUndo,
} from "./hooks/handlers/undoRedoHandlers";

// Import refactored event handler hooks
import { useMultiSelectionHandlers } from "./hooks/handlers/useMultiSelectionHandlers";
import { useToolHandlers } from "./hooks/handlers/useToolHandlers";
import { useShapeDrawingHandlers } from "./hooks/handlers/useShapeDrawingHandlers";
import { useDocumentMouseHandlers } from "./hooks/handlers/useDocumentMouseHandlers";
import { useFormatHandlers } from "./hooks/handlers/useFormatHandlers";
import { useKeyboardHandlers } from "./hooks/handlers/useKeyboardHandlers";
import { useZoomHandlers } from "./hooks/handlers/useZoomHandlers";

// Import components
import { PDFEditorHeader } from "./components/layout/PDFEditorHeader";
import { PDFEditorSidebar } from "./components/layout/PDFEditorSidebar";
import { PDFEditorStatusBar } from "./components/layout/PDFEditorStatusBar";
import { FloatingToolbar } from "./components/layout/FloatingToolbar";
import { MemoizedTextBox } from "./components/elements/TextBox";
import { MemoizedShape } from "./components/elements/Shape";
import { MemoizedImage } from "./components/elements/ImageElement";
import DocumentPanel from "@/components/pdf-editor/DocumentPanel";
import { SelectionPreview } from "./components/elements/SelectionPreview";
import { SelectionRectangle } from "./components/elements/SelectionRectangle";
import LanguageSelectionModal from "./components/LanguageSelectionModal";
import ConfirmationModal from "./components/ConfirmationModal";
import { TranslationTableView } from "./components/TranslationTableView";
import { FinalLayoutSettings } from "./components/FinalLayoutSettings";
import { UntranslatedTextHighlight } from "./components/UntranslatedTextHighlight";
import { BirthCertificateSelectionModal } from "./components/BirthCertificateSelectionModal";
import { LoadingModal } from "@/components/ui/loading-modal";
import { ProjectSelectionModal } from "./components/ProjectSelectionModal";
import { generateUUID } from "./utils/measurements";
import { UntranslatedText } from "./types/pdf-editor.types";
import {
  captureAllPageSnapshots,
  createFinalLayoutPdf,
  SnapshotData,
} from "./services/snapshotService";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

// Import utilities
import { isPdfFile, measureText } from "./utils/measurements";
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
import { calculateImageFitAndPosition } from "./utils/measurements";
import {
  findElementsInSelection,
  calculateSelectionBounds,
  moveSelectedElements,
} from "./utils/selectionUtils";

// Import styles
import "./styles/pdf-editor.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Suppress specific PDF.js console warnings
const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  // Convert all arguments to strings to check for warning patterns
  const message = args.join(" ");

  // Suppress PDF.js "Invalid page request" warnings during final layout
  if (message.includes("Invalid page request")) {
    return;
  }

  // Call original console.warn for other warnings
  originalConsoleWarn(...args);
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
  const { documentState, setDocumentState, handlers, actions, pageActions } =
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
    getFinalLayoutSortedElements,
    addTextBox,
    duplicateTextBox,
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
    addUntranslatedText,
    updateUntranslatedText,
    deleteUntranslatedText,
    getUntranslatedTextByTranslatedId,
  } = useElementManagement();

  ///////////////////////// STATES /////////////////////////
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
  // Template state
  const [birthCertModalPage, setBirthCertModalPage] = useState<number>(1);

  // Helper functions for birth certificate templates
  const getPageBirthCertTemplate = useCallback(
    (pageNumber: number) => {
      const page = documentState.pages.find((p) => p.pageNumber === pageNumber);
      return page?.birthCertTemplate || null;
    },
    [documentState.pages]
  );

  const getPageBirthCertType = useCallback(
    (pageNumber: number) => {
      const page = documentState.pages.find((p) => p.pageNumber === pageNumber);
      return page?.birthCertType || null;
    },
    [documentState.pages]
  );

  // Helper function to get the translated document URL for a specific page
  const getTranslatedDocumentUrl = useCallback(
    (pageNumber: number) => {
      const page = documentState.pages.find((p) => p.pageNumber === pageNumber);
      console.log(
        "Getting translated document URL for page:",
        pageNumber,
        "page data:",
        page
      );
      // If the page has a birth certificate template, use its URL for translated view
      if (page?.translatedTemplateURL) {
        console.log("Using template URL:", page.translatedTemplateURL);
        return page.translatedTemplateURL;
      }
      // Otherwise, return empty string to show blank page
      console.log("No template URL found, returning empty string");
      return "";
    },
    [documentState.pages]
  );

  // Function to update template dimensions when template loads
  const updateTemplateDimensions = useCallback(
    (pageNumber: number, width: number, height: number) => {
      setDocumentState((prev) => {
        const updatedPages = [...prev.pages];
        const pageIndex = pageNumber - 1;

        if (pageIndex >= 0 && pageIndex < updatedPages.length) {
          updatedPages[pageIndex] = {
            ...updatedPages[pageIndex],
            translatedTemplateWidth: width,
            translatedTemplateHeight: height,
          };
        }

        return {
          ...prev,
          pages: updatedPages,
        };
      });
    },
    []
  );

  // Helper function to get the translated template dimensions for a specific page
  const getTranslatedTemplateDimensions = useCallback(
    (pageNumber: number) => {
      const page = documentState.pages.find((p) => p.pageNumber === pageNumber);

      // If the page has a template URL but no dimensions yet, return original dimensions
      // The dimensions will be updated when the template actually loads
      if (
        page?.translatedTemplateURL &&
        (!page?.translatedTemplateWidth || !page?.translatedTemplateHeight)
      ) {
        return {
          width: documentState.pageWidth,
          height: documentState.pageHeight,
        };
      }

      // If the page has template dimensions, use them
      if (page?.translatedTemplateWidth && page?.translatedTemplateHeight) {
        return {
          width: page.translatedTemplateWidth,
          height: page.translatedTemplateHeight,
        };
      }

      // If no template is applied, return original document dimensions
      return {
        width: documentState.pageWidth,
        height: documentState.pageHeight,
      };
    },
    [documentState.pages, documentState.pageWidth, documentState.pageHeight]
  );

  // Helper function to calculate scale factor for translated template in split view
  const getTranslatedTemplateScaleFactor = useCallback(
    (pageNumber: number) => {
      const page = documentState.pages.find((p) => p.pageNumber === pageNumber);

      // If no template or no dimensions, return 1 (no scaling)
      if (
        !page?.translatedTemplateURL ||
        !page?.translatedTemplateWidth ||
        !page?.translatedTemplateHeight
      ) {
        return 1;
      }

      // Calculate scale factors to fit within original document dimensions
      const scaleX = documentState.pageWidth / page.translatedTemplateWidth;
      const scaleY = documentState.pageHeight / page.translatedTemplateHeight;

      // Use the smaller scale factor to ensure the template fits within the original dimensions
      return Math.min(scaleX, scaleY);
    },
    [documentState.pages, documentState.pageWidth, documentState.pageHeight]
  );

  const setPageBirthCertTemplate = useCallback(
    (pageNumber: number, template: any) => {
      console.log(
        "Setting birth certificate template for page:",
        pageNumber,
        "template:",
        template
      );

      setDocumentState((prev) => {
        console.log("Previous document state:", prev);
        const updatedPages = [...prev.pages];
        const pageIndex = pageNumber - 1;

        if (pageIndex >= 0 && pageIndex < updatedPages.length) {
          updatedPages[pageIndex] = {
            ...updatedPages[pageIndex],
            pageType: "birth_cert" as const,
            birthCertTemplate: template,
            birthCertType: template.variation,
            translatedTemplateURL: template.file_url, // Store the template URL for translated view
            // Template dimensions will be set when the template is actually loaded
            translatedTemplateWidth: undefined, // Will be set when template loads
            translatedTemplateHeight: undefined, // Will be set when template loads
          };
        }

        const newState = {
          ...prev,
          pages: updatedPages,
        };
        console.log("New document state:", newState);
        return newState;
      });
    },
    []
  );

  // View state
  const [viewState, setViewState] = useState<ViewState>({
    currentView: "split",
    zoomMode: "page",
    containerWidth: 0,
    isCtrlPressed: false,
    transformOrigin: "center center",
    isSidebarCollapsed: true, // Close sidebar initially
    activeSidebarTab: "pages",
    currentWorkflowStep: "translate",
  });

  // Helper function to get effective scale for translated view in split mode
  const getEffectiveScale = useCallback(
    (targetView: "original" | "translated" | null) => {
      if (targetView === "translated" && viewState.currentView === "split") {
        return (
          documentState.scale *
          (getTranslatedTemplateScaleFactor(documentState.currentPage) || 1)
        );
      }
      return documentState.scale;
    },
    [
      documentState.scale,
      viewState.currentView,
      getTranslatedTemplateScaleFactor,
      documentState.currentPage,
    ]
  );
  // Performance optimization: Track ongoing operations to batch updates
  const [ongoingOperations, setOngoingOperations] = useState<{
    [elementId: string]: {
      type: "resize" | "drag" | "text" | "multi-drag";
      startState: any;
      lastUpdate: number;
    };
  }>({});
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
  // Language state
  const [sourceLanguage, setSourceLanguage] = useState<string>("");
  const [desiredLanguage, setDesiredLanguage] = useState<string>("");

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);

  // Highlighted untranslated text state
  const [highlightedUntranslatedTextId, setHighlightedUntranslatedTextId] =
    useState<string | null>(null);

  // Snapshot capturing state for final layout
  const [isCapturingSnapshots, setIsCapturingSnapshots] = useState(false);
  const [isCancellingSnapshots, setIsCancellingSnapshots] = useState(false);
  const [snapshotProgress, setSnapshotProgress] = useState({
    current: 0,
    total: 0,
  });

  const [capturedSnapshots, setCapturedSnapshots] = useState<SnapshotData[]>(
    []
  );
  const snapshotCancelRef = useRef<{ cancelled: boolean }>({
    cancelled: false,
  });

  const isCapturingSnapshotsRef = useRef(false);

  // Update the ref whenever the state changes
  useEffect(() => {
    isCapturingSnapshotsRef.current = isCapturingSnapshots;
  }, [isCapturingSnapshots]);

  ///////////////////////// HOOKS /////////////////////////
  // Debounce timer for batched updates
  const debounceTimersRef = useRef<{ [elementId: string]: NodeJS.Timeout }>({});
  // Undo/Redo history
  const history = useHistory();

  ///////////////////////// UNDO/REDO HANDLERS /////////////////////////
  const handleAddTextBoxWithUndo = useHandleAddTextBoxWithUndo(
    addTextBox,
    deleteTextBox,
    history
  );
  const handleDuplicateTextBoxWithUndo = useHandleDuplicateTextBoxWithUndo(
    duplicateTextBox,
    deleteTextBox,
    history
  );
  const handleUpdateTextBoxWithUndo = useHandleUpdateTextBoxWithUndo(
    updateTextBox,
    history
  );
  const updateTextBoxWithUndo = useUpdateTextBoxWithUndo(
    updateTextBox,
    handleUpdateTextBoxWithUndo,
    getCurrentTextBoxState,
    documentState,
    viewState
  );
  const updateOriginalTextBoxWithUndo = useUpdateOriginalTextBoxWithUndo(
    updateTextBox,
    handleUpdateTextBoxWithUndo,
    getCurrentTextBoxState,
    documentState
  );
  const updateTranslatedTextBoxWithUndo = useUpdateTranslatedTextBoxWithUndo(
    updateTextBox,
    handleUpdateTextBoxWithUndo,
    getCurrentTextBoxState,
    documentState
  );

  const updateFinalLayoutTextBoxWithUndo = useUpdateFinalLayoutTextBoxWithUndo(
    updateTextBox,
    handleUpdateTextBoxWithUndo,
    getCurrentTextBoxState,
    documentState
  );
  const handleAddShapeWithUndo = useHandleAddShapeWithUndo(
    addShape,
    deleteShape,
    history
  );
  const handleUpdateShapeWithUndo = useHandleUpdateShapeWithUndo(
    updateShape,
    history
  );
  const updateShapeWithUndo = useUpdateShapeWithUndo(
    updateShape,
    handleUpdateShapeWithUndo,
    getCurrentShapeState,
    elementCollections,
    ongoingOperations
  );
  const handleDeleteTextBoxWithUndo = useHandleDeleteTextBoxWithUndo(
    deleteTextBox,
    addTextBox,
    history,
    handleAddTextBoxWithUndo,
    elementCollections,
    editorState,
    selectedElementId,
    clearSelectionState
  );

  // Handler for deleting both textbox and corresponding untranslated text
  const handleDeleteTextBoxAndUntranslatedText = useCallback(
    (textboxId: string) => {
      // Find and delete the corresponding untranslated text
      const untranslatedText = elementCollections.untranslatedTexts.find(
        (text) => text.translatedTextboxId === textboxId
      );

      if (untranslatedText) {
        deleteUntranslatedText(untranslatedText.id);
      }

      // Delete the textbox
      handleDeleteTextBoxWithUndo(textboxId, "translated");
    },
    [
      elementCollections.untranslatedTexts,
      deleteUntranslatedText,
      handleDeleteTextBoxWithUndo,
    ]
  );

  // Handler for highlighting untranslated text when clicking a row in translation table
  const handleTranslationRowClick = useCallback(
    (textboxId: string) => {
      const untranslatedText = elementCollections.untranslatedTexts.find(
        (text) => text.translatedTextboxId === textboxId
      );

      if (untranslatedText) {
        setHighlightedUntranslatedTextId(untranslatedText.id);

        // Auto-clear highlight after 3 seconds
        setTimeout(() => {
          setHighlightedUntranslatedTextId(null);
        }, 3000);
      }
    },
    [elementCollections.untranslatedTexts]
  );

  // Wrapper functions for TranslationTableView compatibility
  const handleAddCustomTextBox = useCallback(
    (
      x: number,
      y: number,
      page: number,
      targetView: "original" | "translated",
      customInitialState?: Partial<TextField>
    ) => {
      return (
        handleAddTextBoxWithUndo(
          x,
          y,
          page,
          "translated",
          targetView,
          customInitialState
        ) || ""
      );
    },
    [handleAddTextBoxWithUndo]
  );

  const handleAddCustomUntranslatedText = useCallback(
    (untranslatedText: Omit<UntranslatedText, "id">) => {
      const fullUntranslatedText: UntranslatedText = {
        id: generateUUID(),
        ...untranslatedText,
      };
      addUntranslatedText(fullUntranslatedText);
    },
    [addUntranslatedText]
  );

  const handleDeleteShapeWithUndo = useHandleDeleteShapeWithUndo(
    deleteShape,
    addShape,
    history,
    elementCollections,
    editorState,
    selectedElementId,
    clearSelectionState
  );
  const handleAddDeletionRectangleWithUndo =
    useHandleAddDeletionRectangleWithUndo(
      addDeletionRectangle,
      deleteDeletionRectangle,
      history
    );
  const handleDeleteDeletionRectangleWithUndo =
    useHandleDeleteDeletionRectangleWithUndo(
      deleteDeletionRectangle,
      addDeletionRectangle,
      history,
      elementCollections
    );
  const handleAddImageWithUndo = useHandleAddImageWithUndo(
    addImage,
    deleteImage,
    history
  );
  const handleDeleteImageWithUndo = useHandleDeleteImageWithUndo(
    deleteImage,
    addImage,
    history,
    elementCollections,
    selectedElementId,
    clearSelectionState
  );

  // Use a ref to track ongoing operations for immediate access in timers
  const ongoingOperationsRef = useRef<{
    [elementId: string]: {
      type: "resize" | "drag" | "text" | "multi-drag";
      startState: any;
      lastUpdate: number;
    };
  }>({});

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

  // Handler for duplicating a textbox
  const handleDuplicateTextBox = useCallback(
    (textboxId: string) => {
      const duplicatedId = handleDuplicateTextBoxWithUndo(
        textboxId,
        viewState.currentView,
        documentState.currentPage
      );

      if (duplicatedId) {
        // Select the newly duplicated textbox
        setSelectedElementId(duplicatedId);
        setSelectedElementType("textbox");
        setIsDrawerOpen(true);
        setAutoFocusTextBoxId(duplicatedId);

        // Update editor state to select the duplicated textbox
        setEditorState((prev) => ({
          ...prev,
          selectedFieldId: duplicatedId,
          multiSelection: {
            ...prev.multiSelection,
            selectedElements: [],
            selectionBounds: null,
          },
        }));
      }
    },
    [
      handleDuplicateTextBoxWithUndo,
      viewState.currentView,
      documentState.currentPage,
      setSelectedElementId,
      setSelectedElementType,
      setIsDrawerOpen,
      setAutoFocusTextBoxId,
      setEditorState,
    ]
  );

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

  // Multi-selection drag handlers (extracted to custom hook)
  const initialPositionsRef = useRef<Record<string, { x: number; y: number }>>(
    {}
  );

  const {
    handleMultiSelectDragStart,
    handleMultiSelectDrag,
    handleMultiSelectDragStop,
  } = useMultiSelectionHandlers({
    editorState,
    setEditorState,
    initialPositionsRef,
    documentState: {
      ...documentState,
      finalLayoutCurrentPage: documentState.finalLayoutCurrentPage,
    },
    viewState,
    getCurrentTextBoxes,
    getCurrentShapes,
    getCurrentImages,
    updateTextBoxWithUndo,
    updateShapeWithUndo,
    updateImage,
    getElementById,
  });

  // Refs
  const documentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to clear only final-layout elements when in final-layout workflow step
  const clearFinalLayoutElementsOnly = useCallback(() => {
    // Only clear final-layout elements, preserve original and translated elements
    setElementCollections((prev) => ({
      ...prev,
      finalLayoutTextboxes: [],
      finalLayoutShapes: [],
      finalLayoutDeletionRectangles: [],
      finalLayoutImages: [],
    }));
  }, [setElementCollections]);

  // Function to capture snapshots and create final layout pages with interactive elements
  const createFinalLayoutWithSnapshots = useCallback(async () => {
    // Prevent multiple simultaneous operations
    if (isCapturingSnapshots) {
      console.warn("Snapshot capture already in progress, skipping...");
      return;
    }

    console.log("Starting createFinalLayoutWithSnapshots");
    console.log(
      "Initial cancellation status:",
      snapshotCancelRef.current.cancelled
    );
    console.log("Document state:", documentState);
    console.log("Element collections:", elementCollections);

    // Safety check: ensure we have a valid document
    if (documentState.numPages === 0) {
      console.error("No valid document loaded, cannot capture snapshots");
      toast.error("No document loaded. Please load a document first.");
      return;
    }

    try {
      // Reset cancellation flag at the very beginning
      snapshotCancelRef.current.cancelled = false;
      setIsCapturingSnapshots(true);
      setIsCancellingSnapshots(false);
      setSnapshotProgress({ current: 0, total: 0 });

      console.log(
        "Reset cancellation flag to:",
        snapshotCancelRef.current.cancelled
      );

      // Capture all page snapshots with cancellation support
      console.log("Starting snapshot capture...");
      const snapshots = await captureAllPageSnapshots({
        documentRef,
        documentState,
        pageState: {
          deletedPages: documentState.deletedPages,
        },
        setViewState,
        setDocumentState,
        setEditorState,
        editorState,
        progressCallback: (current, total) => {
          if (snapshotCancelRef.current.cancelled) {
            console.log("Progress callback detected cancellation");
            throw new Error("Snapshot capture cancelled");
          }
          setSnapshotProgress({ current, total });
        },
      });

      // Check if cancelled during capture
      if (snapshotCancelRef.current.cancelled || isCancellingSnapshots) {
        console.log("Snapshot capture was cancelled during capture phase");
        console.log("Cancelled flag:", snapshotCancelRef.current.cancelled);
        console.log("Is cancelling:", isCancellingSnapshots);
        return;
      }

      console.log("Captured snapshots:", snapshots.length, "snapshots");
      setCapturedSnapshots(snapshots);

      // Create final layout PDF with template page and snapshots
      console.log("Creating final layout PDF with template page...");
      const finalLayoutFile = await createFinalLayoutPdf(snapshots);

      // Check if cancelled after PDF creation
      if (snapshotCancelRef.current.cancelled || isCancellingSnapshots) {
        console.log("Operation cancelled after PDF creation");
        return;
      }

      console.log("Clearing existing final-layout elements only...");
      // Clear only final-layout elements, preserve original and translated elements
      clearFinalLayoutElementsOnly();

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

      // Store the final layout PDF URL without loading it as the main document
      try {
        // Add a small delay to ensure previous operations are complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check for cancellation before loading
        if (snapshotCancelRef.current.cancelled || isCancellingSnapshots) {
          console.log("Operation cancelled before storing final layout URL");
          return;
        }

        // Create URL for the final layout file and store it
        const finalLayoutUrl = URL.createObjectURL(finalLayoutFile);

        console.log("Storing final layout URL...");

        // Update document state with final layout URL (without loading as main document)
        setDocumentState((prev) => ({
          ...prev,
          finalLayoutUrl: finalLayoutUrl,
          finalLayoutCurrentPage: 1,
          finalLayoutNumPages: Math.ceil(snapshots.length / 2) + 1, // +1 for template page
          finalLayoutDeletedPages: new Set<number>(), // Initialize empty set for deleted pages
        }));

        setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));

        // Add another small delay before adding interactive elements
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Check for cancellation again
        if (snapshotCancelRef.current.cancelled || isCancellingSnapshots) {
          console.log("Operation cancelled before adding interactive elements");
          return;
        }

        // Add interactive elements to the layout pages
        console.log("Adding interactive elements to layout...");
        await addInteractiveElementsToLayout(snapshots);
        console.log("Interactive elements added successfully");

        toast.success(
          "Created final layout with template page and interactive snapshots"
        );
        // Set view to final-layout and zoom to 100% after final layout creation
        setViewState((prev) => ({ ...prev, currentView: "final-layout" }));
        actions.updateScale(1.0);
      } catch (storeError) {
        console.error("Error storing final layout URL:", storeError);

        // Handle specific PDF.js worker errors
        if (storeError instanceof Error) {
          if (
            storeError.message.includes("sendWithPromise") ||
            storeError.message.includes("worker")
          ) {
            toast.error(
              "PDF worker error occurred. Please refresh the page and try again."
            );
          } else {
            toast.error(
              `Created layout but failed to store final layout URL: ${storeError.message}`
            );
          }
        } else {
          toast.error(
            "Created layout but failed to store final layout URL. Please try refreshing."
          );
        }
      }
    } catch (error) {
      console.error("Error creating final layout:", error);

      // Handle different types of errors
      if (!snapshotCancelRef.current.cancelled && !isCancellingSnapshots) {
        if (error instanceof Error) {
          if (error.message.includes("cancelled")) {
            toast.info("Snapshot capture cancelled");
          } else if (
            error.message.includes("sendWithPromise") ||
            error.message.includes("worker")
          ) {
            toast.error(
              "PDF worker error occurred. Please refresh the page and try again."
            );
          } else {
            toast.error(`Failed to create final layout: ${error.message}`);
          }
        } else {
          toast.error("Failed to create final layout due to an unknown error");
        }
      } else {
        toast.info("Snapshot capture cancelled");
      }
    } finally {
      setIsCapturingSnapshots(false);
      setIsCancellingSnapshots(false);
      setSnapshotProgress({ current: 0, total: 0 });
      snapshotCancelRef.current.cancelled = false;
    }
  }, [
    isCapturingSnapshots,
    isCancellingSnapshots,
    documentState,
    editorState,
    actions,
    setElementCollections,
    setLayerState,
    setEditorState,
    setToolState,
    setErasureState,
    setViewState,
    clearFinalLayoutElementsOnly,
  ]);

  // Helper function to calculate image dimensions that fit within quadrant while maintaining aspect ratio
  const calculateFittedImageDimensions = useCallback(
    (
      originalWidth: number,
      originalHeight: number,
      maxWidth: number,
      maxHeight: number
    ) => {
      // Calculate aspect ratios
      const imageAspectRatio = originalWidth / originalHeight;
      const quadrantAspectRatio = maxWidth / maxHeight;

      let fitWidth: number;
      let fitHeight: number;

      if (imageAspectRatio > quadrantAspectRatio) {
        // Image is wider relative to quadrant - fit by width
        fitWidth = maxWidth;
        fitHeight = maxWidth / imageAspectRatio;
      } else {
        // Image is taller relative to quadrant - fit by height
        fitHeight = maxHeight;
        fitWidth = maxHeight * imageAspectRatio;
      }

      return { width: fitWidth, height: fitHeight };
    },
    []
  );

  // Function to add interactive elements (images and lines) to the final layout
  const addInteractiveElementsToLayout = useCallback(
    async (snapshots: SnapshotData[]) => {
      const pagesNeeded = Math.ceil(snapshots.length / 2);

      for (let pdfPageIndex = 0; pdfPageIndex < pagesNeeded; pdfPageIndex++) {
        // Start from page 2 since page 1 is the template page (export_first_page.pdf)
        const pageNumber = pdfPageIndex + 2;
        const snapshot1 = snapshots[pdfPageIndex * 2];
        const snapshot2 = snapshots[pdfPageIndex * 2 + 1];

        // Calculate layout dimensions (matching the PDF creation logic)
        const pageWidth = 612; // Letter size in points
        const pageHeight = 792;
        const gridMargin = 10;
        const gridSpacing = 8;
        const labelSpace = 15;
        const availableWidth = pageWidth - gridMargin * 2;
        const availableHeight = pageHeight - gridMargin * 2 - labelSpace;
        const quadrantWidth = (availableWidth - gridSpacing) / 2; // ~292px
        const quadrantHeight = (availableHeight - gridSpacing) / 2; // ~379.5px

        // Add first snapshot's images (bottom row) - corrected positioning
        if (snapshot1) {
          // Calculate fitted dimensions for original image
          const originalDimensions = calculateFittedImageDimensions(
            snapshot1.originalWidth,
            snapshot1.originalHeight,
            quadrantWidth,
            quadrantHeight
          );

          // Calculate fitted dimensions for translated image
          const translatedDimensions = calculateFittedImageDimensions(
            snapshot1.translatedWidth,
            snapshot1.translatedHeight,
            quadrantWidth,
            quadrantHeight
          );

          // Calculate centering offsets for original image
          const originalOffsetX =
            (quadrantWidth - originalDimensions.width) / 2;
          const originalOffsetY =
            (quadrantHeight - originalDimensions.height) / 2;

          // Calculate centering offsets for translated image
          const translatedOffsetX =
            (quadrantWidth - translatedDimensions.width) / 2;
          const translatedOffsetY =
            (quadrantHeight - translatedDimensions.height) / 2;

          // Original image (bottom-left, centered in quadrant) - swapped position
          const originalImageId = handleAddImageWithUndo(
            snapshot1.originalImage,
            gridMargin + originalOffsetX,
            pageHeight -
              labelSpace -
              quadrantHeight * 2 -
              gridSpacing +
              originalOffsetY,
            originalDimensions.width,
            originalDimensions.height,
            pageNumber,
            "final-layout",
            undefined // No Supabase metadata for snapshot images
          );

          // Translated image (bottom-right, centered in quadrant) - swapped position
          const translatedImageId = handleAddImageWithUndo(
            snapshot1.translatedImage,
            gridMargin + quadrantWidth + gridSpacing + translatedOffsetX,
            pageHeight -
              labelSpace -
              quadrantHeight * 2 -
              gridSpacing +
              translatedOffsetY,
            translatedDimensions.width,
            translatedDimensions.height,
            pageNumber,
            "final-layout",
            undefined // No Supabase metadata for snapshot images
          );

          // Add dividing line between original and translated (vertical)
          const verticalLineId = handleAddShapeWithUndo(
            "line",
            gridMargin + quadrantWidth + gridSpacing / 2,
            gridMargin,
            2, // width
            pageHeight - labelSpace, // height
            pageNumber,
            "final-layout",
            undefined, // targetView should be undefined for final layout
            gridMargin + quadrantWidth + gridSpacing / 2, // x1
            gridMargin, // y1
            gridMargin + quadrantWidth + gridSpacing / 2, // x2
            pageHeight - labelSpace // y2
          );
        }

        // Add second snapshot's images (top row) - corrected positioning
        if (snapshot2) {
          // Calculate fitted dimensions for original image
          const originalDimensions2 = calculateFittedImageDimensions(
            snapshot2.originalWidth,
            snapshot2.originalHeight,
            quadrantWidth,
            quadrantHeight
          );

          // Calculate fitted dimensions for translated image
          const translatedDimensions2 = calculateFittedImageDimensions(
            snapshot2.translatedWidth,
            snapshot2.translatedHeight,
            quadrantWidth,
            quadrantHeight
          );

          // Calculate centering offsets for original image
          const originalOffsetX2 =
            (quadrantWidth - originalDimensions2.width) / 2;
          const originalOffsetY2 =
            (quadrantHeight - originalDimensions2.height) / 2;

          // Calculate centering offsets for translated image
          const translatedOffsetX2 =
            (quadrantWidth - translatedDimensions2.width) / 2;
          const translatedOffsetY2 =
            (quadrantHeight - translatedDimensions2.height) / 2;

          // Original image (top-left, centered in quadrant) - swapped position
          const originalImageId2 = handleAddImageWithUndo(
            snapshot2.originalImage,
            gridMargin + originalOffsetX2,
            pageHeight - labelSpace - quadrantHeight + originalOffsetY2,
            originalDimensions2.width,
            originalDimensions2.height,
            pageNumber,
            "final-layout",
            undefined // No Supabase metadata for snapshot images
          );

          // Translated image (top-right, centered in quadrant) - swapped position
          const translatedImageId2 = handleAddImageWithUndo(
            snapshot2.translatedImage,
            gridMargin + quadrantWidth + gridSpacing + translatedOffsetX2,
            pageHeight - labelSpace - quadrantHeight + translatedOffsetY2,
            translatedDimensions2.width,
            translatedDimensions2.height,
            pageNumber,
            "final-layout",
            undefined // No Supabase metadata for snapshot images
          );

          // Add dividing line between original and translated (vertical, top row)
          const verticalLineId2 = handleAddShapeWithUndo(
            "line",
            gridMargin + quadrantWidth + gridSpacing / 2,
            pageHeight - labelSpace - quadrantHeight,
            2, // width
            quadrantHeight, // height
            pageNumber,
            "final-layout",
            undefined, // targetView should be undefined for final layout
            gridMargin + quadrantWidth + gridSpacing / 2, // x1
            pageHeight - labelSpace - quadrantHeight, // y1
            gridMargin + quadrantWidth + gridSpacing / 2, // x2
            pageHeight - labelSpace // y2 - corrected to go to top
          );
        }

        // Add horizontal dividing line between top and bottom rows (if there's a second snapshot)
        if (snapshot2) {
          const horizontalLineId = handleAddShapeWithUndo(
            "line",
            gridMargin,
            pageHeight - labelSpace - quadrantHeight - gridSpacing / 2,
            availableWidth, // width
            2, // height
            pageNumber,
            "final-layout",
            undefined, // targetView should be undefined for final layout
            gridMargin, // x1
            pageHeight - labelSpace - quadrantHeight - gridSpacing / 2, // y1
            gridMargin + availableWidth, // x2
            pageHeight - labelSpace - quadrantHeight - gridSpacing / 2 // y2
          );
        }
      }
    },
    [
      handleAddImageWithUndo,
      handleAddShapeWithUndo,
      calculateFittedImageDimensions,
    ]
  );

  // Workflow step change handler
  const handleWorkflowStepChange = useCallback(
    (step: WorkflowStep, previousStep?: WorkflowStep) => {
      // Only intercept when switching to 'layout' from a different step
      const prevStep = previousStep || viewState.currentWorkflowStep;
      if (step === "layout" && prevStep !== "layout") {
        // Check untranslated texts
        const untranslated = elementCollections.untranslatedTexts || [];
        const needsCheck = untranslated.filter(
          (t) =>
            (t.status === "isEmpty" || t.status === "needsChecking") &&
            !t.isCustomTextbox
        );
        if (needsCheck.length > 0) {
          // Prepare list for modal
          setUntranslatedCheckList(
            needsCheck.map((t) => ({
              id: t.id,
              page: t.page,
              status: t.status,
              originalText: t.originalText,
            }))
          );
          setShowUntranslatedCheckModal(true);
          setPendingWorkflowStep(step);
          return; // Block workflow change for now
        }
      }
      // Get the previous step from current state if not provided
      const prev = previousStep || viewState.currentWorkflowStep;

      // Handle leaving final-layout step - restore backup if available

      // Handle entering final-layout step
      if (step === "final-layout" && prev !== "final-layout") {
        // Set view to final-layout and zoom to 100%
        setViewState((prev) => ({
          ...prev,
          currentView: "final-layout",
        }));
        actions.updateScale(1.0);
        // Reset cancellation state to ensure clean entry
        console.log("Entering final-layout, resetting cancellation state");
        snapshotCancelRef.current.cancelled = false;
        setIsCancellingSnapshots(false);

        // Always capture fresh snapshots when entering final layout
        // Only start snapshot capture if not already in progress
        if (!isCapturingSnapshots) {
          console.log("Capturing fresh snapshots for final layout");
          createFinalLayoutWithSnapshots();
        } else {
          console.warn(
            "Snapshot capture already in progress, not starting new capture"
          );
        }
      }

      setViewState((prev) => ({
        ...prev,
        currentWorkflowStep: step,
      }));
    },
    [
      viewState.currentWorkflowStep,
      isCapturingSnapshots,
      capturedSnapshots,
      createFinalLayoutWithSnapshots,
      elementCollections.untranslatedTexts,
    ]
  );

  // Text span handling hook
  const { isZooming: isTextSpanZooming } = useTextSpanHandling({
    isAddTextBoxMode: editorState.isAddTextBoxMode,
    scale: documentState.scale,
    currentPage: documentState.currentPage,
    pdfBackgroundColor: documentState.pdfBackgroundColor,
    erasureSettings: erasureState.erasureSettings,
    createDeletionRectangleForSpan: (span: HTMLElement) => {
      const pdfPageEl = documentRef.current?.querySelector(
        ".react-pdf__Page"
      ) as HTMLElement;
      return createDeletionRectangleForSpan(
        span,
        pdfPageEl,
        documentState.currentPage,
        viewState.currentView,
        documentState.scale,
        documentState.pageWidth,
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
        erasureState.erasureSettings.opacity,
        getTranslatedTemplateScaleFactor
      );
    },
    createTextFieldFromSpan: (span: HTMLElement) => {
      const pdfPageEl = documentRef.current?.querySelector(
        ".react-pdf__Page"
      ) as HTMLElement;
      return createTextFieldFromSpanUtil(
        span,
        pdfPageEl,
        documentState.currentPage,
        viewState.currentView,
        documentState.scale,
        documentState.pageWidth,
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
        erasureState.erasureSettings.opacity,
        getTranslatedTemplateScaleFactor
      );
    },
    addDeletionRectangle: (x, y, width, height, page, background, opacity) => {
      const result = handleAddDeletionRectangleWithUndo(
        x,
        y,
        width,
        height,
        page,
        viewState.currentView,
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

  // Zoom functionality (extracted to custom hook)
  useZoomHandlers({
    viewState,
    setViewState,
    documentState,
    actions,
    containerRef,
  });

  // Format handlers (extracted to custom hook)
  const { calculateTextboxDimensionsForFontChange, handleFormatChange } =
    useFormatHandlers({
      editorState,
      selectedElementId,
      selectedElementType,
      currentFormat,
      setCurrentFormat,
      viewState,
      getCurrentTextBoxes,
      getCurrentImages,
      updateTextBoxWithUndo,
      updateShapeWithUndo,
      updateImage,
    });

  // Effect to handle element selection and ElementFormatDrawer updates
  useEffect(() => {
    // Use setTimeout to ensure state updates happen after render
    const timeoutId = setTimeout(() => {
      // Close drawer if not in edit mode
      if (!editorState.isEditMode) {
        setIsDrawerOpen(false);
        setSelectedElementId(null);
        setCurrentFormat(null);
        return;
      }

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
    editorState.isEditMode,
    viewState.currentView,
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

  // Preload html2canvas to avoid dynamic import issues
  useEffect(() => {
    preloadHtml2Canvas();
  }, []);

  // Cleanup snapshot capture on unmount to prevent worker issues
  useEffect(() => {
    return () => {
      // Only cancel if we're actually capturing when component unmounts
      if (isCapturingSnapshotsRef.current) {
        console.log(
          "Component unmounting during snapshot capture, cancelling..."
        );
        snapshotCancelRef.current.cancelled = true;
      }
    };
  }, []); // Empty dependency array to only run on actual mount/unmount

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

  // Tool and element selection handlers (extracted to custom hook)
  const {
    handleToolChange,
    handleTextBoxSelect,
    handleShapeSelect,
    handleImageSelect,
  } = useToolHandlers({
    setEditorState,
    setToolState,
    setErasureState,
    setSelectedElementId,
    setSelectedElementType,
    setCurrentFormat,
    setIsDrawerOpen,
    clearSelectionState,
  });

  // Shape drawing handlers (extracted to custom hook)
  const { handleShapeDrawStart, handleShapeDrawMove, handleShapeDrawEnd } =
    useShapeDrawingHandlers({
      toolState,
      setToolState,
      setEditorState,
      setErasureState,
      documentState,
      viewState,
      documentRef,
      handleAddShapeWithUndo,
      getTranslatedTemplateScaleFactor,
    });

  // Document mouse handlers for text selection and erasure
  const {
    handleDocumentMouseDown,
    handleDocumentMouseMove,
    handleDocumentMouseUp,
  } = useDocumentMouseHandlers({
    editorState,
    setEditorState,
    erasureState,
    setErasureState,
    selectionState,
    setSelectionState,
    documentState,
    viewState,
    documentRef,
    currentPageTextBoxes,
    handleAddDeletionRectangleWithUndo,
    getTranslatedTemplateScaleFactor,
  });

  // Keyboard handlers for shortcuts, undo/redo, and multi-selection
  useKeyboardHandlers({
    editorState,
    setEditorState,
    viewState,
    setViewState,
    documentState,
    actions,
    erasureState,
    currentPageTextBoxes,
    handleAddDeletionRectangleWithUndo,
    handleDeleteTextBoxWithUndo: (id: string) =>
      deleteTextBox(id, viewState.currentView),
    history,
    handleMultiSelectionMove,
    handleMultiSelectionMoveEnd,
  });

  // Erasure drawing handlers
  const handleErasureDrawMove = useCallback(
    (e: React.MouseEvent) => {
      if (!erasureState.isDrawingErasure || !erasureState.erasureDrawStart)
        return;

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Convert screen coordinates to document coordinates
      const { x, y } = screenToDocumentCoordinates(
        e.clientX,
        e.clientY,
        rect,
        documentState.scale,
        erasureState.erasureDrawTargetView,
        viewState.currentView,
        documentState.pageWidth,
        erasureState.erasureDrawTargetView === "translated"
          ? getTranslatedTemplateScaleFactor(documentState.currentPage)
          : undefined
      );

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
        documentState.pageWidth,
        clickedView === "translated"
          ? getTranslatedTemplateScaleFactor(documentState.currentPage)
          : undefined
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
        documentState.pageWidth,
        editorState.multiSelection.targetView === "translated"
          ? getTranslatedTemplateScaleFactor(documentState.currentPage)
          : undefined
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
    const { selectedElements, targetView } = editorState.multiSelection;

    selectedElements.forEach((selectedElement) => {
      // Use targetView for split view, otherwise use currentView
      const deleteView = targetView || viewState.currentView;

      switch (selectedElement.type) {
        case "textbox":
          handleDeleteTextBoxWithUndo(selectedElement.id, deleteView);
          break;
        case "shape":
          handleDeleteShapeWithUndo(selectedElement.id, deleteView);
          break;
        case "image":
          handleDeleteImageWithUndo(selectedElement.id, deleteView);
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
    editorState.multiSelection.targetView,
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
        documentState.pageWidth,
        editorState.multiSelection.targetView === "translated"
          ? getTranslatedTemplateScaleFactor(documentState.currentPage)
          : undefined
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
        documentState.pageWidth,
        editorState.multiSelection.targetView === "translated"
          ? getTranslatedTemplateScaleFactor(documentState.currentPage)
          : undefined
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
        documentState.pageWidth,
        targetView === "translated"
          ? getTranslatedTemplateScaleFactor(documentState.currentPage)
          : undefined
      );

      // Helper function to get the correct current page based on view
      const getCurrentPageForView = () => {
        if (viewState.currentView === "final-layout") {
          return documentState.finalLayoutCurrentPage || 1;
        }
        return documentState.currentPage;
      };

      if (editorState.isAddTextBoxMode) {
        const fieldId = handleAddTextBoxWithUndo(
          x,
          y,
          getCurrentPageForView(),
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
      untranslatedTexts: [],
      finalLayoutTextboxes: [],
      finalLayoutShapes: [],
      finalLayoutDeletionRectangles: [],
      finalLayoutImages: [],
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

        // Load the blank PDF as the document (this will upload to Supabase if authenticated)
        await actions.loadDocument(pdfFile);
        setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));

        // Calculate proper image dimensions and position
        const { x, y, width, height } = await calculateImageFitAndPosition(
          imageFile,
          documentState.pageWidth,
          documentState.pageHeight
        );

        // Upload image to Supabase or use blob URL as fallback
        const imageUploadResult = await uploadFileWithFallback(imageFile);

        // Helper function to get the correct current page based on view
        const getCurrentPageForView = () => {
          if (viewState.currentView === "final-layout") {
            return documentState.finalLayoutCurrentPage || 1;
          }
          return documentState.currentPage;
        };

        // Create a new image element with proper positioning
        const imageId = handleAddImageWithUndo(
          imageUploadResult.url,
          x,
          y,
          width,
          height,
          getCurrentPageForView(),
          viewState.currentView,
          {
            isSupabaseUrl: imageUploadResult.isSupabaseUrl,
            filePath: imageUploadResult.filePath,
            fileName: imageFile.name,
            fileObjectId: imageUploadResult.fileObjectId,
          }
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
    [
      actions,
      handleAddImageWithUndo,
      handleImageSelect,
      documentState.pageWidth,
      documentState.pageHeight,
    ]
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

        // Store current state before appending
        const currentDeletedPages = new Set(documentState.deletedPages);
        const currentPages = [...documentState.pages];

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

        // Update document URL without using loadDocument to preserve deletedPages
        const newUrl = URL.createObjectURL(updatedFile);
        const newPageNumber = currentPdfDoc.getPageCount();

        setDocumentState((prev) => ({
          ...prev,
          url: newUrl,
          numPages: newPageNumber,
          pages: [
            ...currentPages,
            {
              pageNumber: newPageNumber,
              isTranslated: false,
              pageType: "dynamic_content" as const,
            },
          ],
          deletedPages: currentDeletedPages, // Preserve deleted pages
          isDocumentLoaded: true,
          error: "",
        }));

        // Calculate proper image dimensions and position
        const { x, y, width, height } = await calculateImageFitAndPosition(
          imageFile,
          documentState.pageWidth,
          documentState.pageHeight
        );

        // Upload image to Supabase or use blob URL as fallback
        const imageUploadResult = await uploadFileWithFallback(imageFile);

        // Use setTimeout to ensure the document state is updated before adding the image
        setTimeout(() => {
          // Create a new image element with proper positioning
          const imageId = handleAddImageWithUndo(
            imageUploadResult.url,
            x,
            y,
            width,
            height,
            newPageNumber,
            viewState.currentView,
            {
              isSupabaseUrl: imageUploadResult.isSupabaseUrl,
              filePath: imageUploadResult.filePath,
              fileName: imageFile.name,
              fileObjectId: imageUploadResult.fileObjectId,
            }
          );

          // Select the image and open format drawer
          if (imageId) {
            handleImageSelect(imageId);
          }
        }, 100);

        toast.success("Image appended as new page successfully!");
      } catch (error) {
        console.error("Error appending image:", error);
        toast.error("Failed to append image");
      }
    },
    [
      documentState.url,
      documentState.deletedPages,
      documentState.pages,
      documentState.pageWidth,
      documentState.pageHeight,
      setDocumentState,
      handleAddImageWithUndo,
      handleImageSelect,
    ]
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

        // Store current state before appending
        const currentDeletedPages = new Set(documentState.deletedPages);
        const currentPages = [...documentState.pages];
        const currentNumPages = documentState.numPages;

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

        // Upload merged PDF to Supabase or use blob URL as fallback
        const uploadResult = await uploadFileWithFallback(mergedFile);
        const newUrl = uploadResult.url;
        const totalPages = currentPdfDoc.getPageCount();
        const addedPagesCount = newPages.length;

        // Create new page entries for the appended pages
        const newPageEntries = Array.from(
          { length: addedPagesCount },
          (_, index) => ({
            pageNumber: currentNumPages + index + 1,
            isTranslated: false,
            pageType: "dynamic_content" as const,
          })
        );

        setDocumentState((prev) => ({
          ...prev,
          url: newUrl,
          numPages: totalPages,
          pages: [...currentPages, ...newPageEntries],
          deletedPages: currentDeletedPages, // Preserve deleted pages
          isDocumentLoaded: true,
          error: "",
        }));

        toast.success("PDF document appended successfully!");
      } catch (error) {
        console.error("Error appending PDF:", error);
        toast.error("Failed to append PDF document");
      }
    },
    [
      documentState.url,
      documentState.deletedPages,
      documentState.pages,
      documentState.numPages,
      setDocumentState,
    ]
  );

  const handleImageFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        try {
          // Upload image to Supabase or use blob URL as fallback
          const uploadResult = await uploadFileWithFallback(file);
          const url = uploadResult.url;

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
            // Add to current view - only allow in 'original' or 'translated', not 'split'
            const targetView =
              viewState.currentView === "split"
                ? "original"
                : viewState.currentView;
            const imageId = handleAddImageWithUndo(
              url,
              x,
              y,
              width,
              height,
              documentState.currentPage,
              targetView,
              {
                isSupabaseUrl: uploadResult.isSupabaseUrl,
                filePath: uploadResult.filePath,
                fileName: file.name,
                fileObjectId: uploadResult.fileObjectId,
              }
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
        } catch (error) {
          console.error("Error uploading image:", error);
          toast.error("Failed to upload image");
        }
      }
    },
    [
      handleAddImageWithUndo,
      documentState.pageWidth,
      documentState.pageHeight,
      documentState.currentPage,
      handleImageSelect,
      viewState.currentView,
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
      const isFinalLayout = viewState.currentView === "final-layout";
      console.log("🔄 Page Change:", {
        page,
        isFinalLayout,
        currentView: viewState.currentView,
        beforeChange: {
          currentPage: documentState.currentPage,
          finalLayoutCurrentPage: documentState.finalLayoutCurrentPage,
          numPages: documentState.numPages,
          finalLayoutNumPages: documentState.finalLayoutNumPages,
        },
      });
      actions.changePage(page, isFinalLayout);
    },
    [actions, viewState.currentView, documentState]
  );

  const handlePageDelete = useCallback(
    (pageNumber: number) => {
      const isFinalLayout = viewState.currentView === "final-layout";
      pageActions.deletePage(pageNumber, isFinalLayout);
    },
    [pageActions, viewState.currentView]
  );

  // Transform page to textbox functionality
  const handleTransformPageToTextbox = useCallback(
    async (pageNumber: number) => {
      try {
        // Create a compatibility wrapper for setPageState
        const setPageStateCompat = (updater: (prev: any) => any) => {
          const prev = {
            isTransforming: documentState.isTransforming,
            deletedPages: documentState.deletedPages,
            isPageTranslated: new Map(
              documentState.pages.map((p) => [p.pageNumber, p.isTranslated])
            ),
          };
          const newState = updater(prev);

          if (newState.isTransforming !== undefined) {
            pageActions.setIsTransforming(newState.isTransforming);
          }
        };

        // Get page information for birth certificate detection
        const page = documentState.pages.find(
          (p) => p.pageNumber === pageNumber
        );
        const pageType = page?.pageType;
        const birthCertTemplateId = page?.birthCertTemplate?.id;

        await performPageOcr({
          pageNumber,
          documentRef,
          containerRef,
          documentState,
          viewState,
          editorState,
          setPageState: setPageStateCompat,
          setViewState,
          setEditorState,
          actions,
          sourceLanguage,
          desiredLanguage,
          handleAddTextBoxWithUndo,
          setIsTranslating,
          addUntranslatedText,
          pageType,
          birthCertTemplateId,
        });
      } catch (error) {
        console.error("Error in handleTransformPageToTextbox:", error);
        toast.error("Failed to transform page to textboxes");
      }
    },
    [
      documentRef,
      containerRef,
      documentState,
      viewState,
      editorState,
      pageActions,
      setViewState,
      setEditorState,
      actions,
      sourceLanguage,
      desiredLanguage,
      handleAddTextBoxWithUndo,
      setIsTranslating,
    ]
  );

  // Clear translation for a single page
  const handleClearPageTranslation = useCallback(
    (pageNumber: number) => {
      // Remove all translated elements for the specific page
      const pageTranslatedTextBoxes = getCurrentTextBoxes("translated").filter(
        (tb) => tb.page === pageNumber
      );
      const pageTranslatedShapes = getCurrentShapes("translated").filter(
        (s) => s.page === pageNumber
      );
      const pageTranslatedImages = getCurrentImages("translated").filter(
        (img) => img.page === pageNumber
      );

      // Delete all translated elements for this page
      pageTranslatedTextBoxes.forEach((tb) => {
        deleteTextBox(tb.id, "translated");
      });
      pageTranslatedShapes.forEach((s) => {
        deleteShape(s.id, "translated");
      });
      pageTranslatedImages.forEach((img) => {
        deleteImage(img.id, "translated");
      });

      // Reset page translation state
      pageActions.setPageTranslated(pageNumber, false);

      toast.success(`Translation cleared for page ${pageNumber}`);
    },
    [
      getCurrentTextBoxes,
      getCurrentShapes,
      getCurrentImages,
      deleteTextBox,
      deleteShape,
      deleteImage,
      pageActions,
    ]
  );

  // Automatic project creation on document upload
  const {
    projectId: currentProjectId,
    isCreatingProject,
    projectCreationError,
    handleFileUploadWithProjectCreation,
    shouldShowProjectStatus,
    isAuthenticated: isUserAuthenticated,
    createProjectOnUpload,
  } = useProjectCreation({
    documentState,
    viewState,
    elementCollections,
    layerState,
    editorState,
    sourceLanguage,
    desiredLanguage,
  });

  // Project management with enhanced save/load functionality
  const {
    saveProject: saveProjectToStorage,
    loadProject,
    exportToJson,
    importFromJson,
    getSavedProjects,
    deleteProject,
    setCurrentProjectId,
  } = useProjectState({
    documentState,
    setDocumentState,
    elementCollections,
    setElementCollections,
    layerState,
    setLayerState,
    viewState,
    setViewState,
    editorState,
    setEditorState,
    sourceLanguage,
    setSourceLanguage,
    desiredLanguage,
    setDesiredLanguage,
  });

  // Keep backward compatibility for existing save project calls
  const saveProject = useCallback(
    (projectName?: string) => {
      return saveProjectToStorage(projectName);
    },
    [saveProjectToStorage]
  );

  // Enhanced file upload handler with automatic project creation
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Store file reference for automatic project creation
      lastUploadedFileRef.current = file;

      const fileType = getFileType(file.name);

      // Clear all elements and state when uploading a new document
      clearAllElementsAndState();

      // Process the file upload
      if (fileType === "image") {
        // For images, create a blank PDF and add the image as an interactive element
        createBlankPdfAndAddImage(file);
      } else {
        // For PDFs, load normally
        actions.loadDocument(file);
        setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));
      }

      // Note: Automatic project creation will happen when document is fully loaded
      // See the useEffect hook that monitors documentState.isDocumentLoaded

      if (!isUserAuthenticated) {
        // Show a toast suggesting the user to sign in for project management
        toast.info("Sign in to automatically save your projects!", {
          description:
            "You can still work on your document, but it won't be saved to your account. Click here to sign in.",
          duration: 5000,
          action: {
            label: "Sign In",
            onClick: () => {
              // Redirect to login page
              window.location.href = "/auth/login";
            },
          },
        });
      }
    },
    [
      getFileType,
      createBlankPdfAndAddImage,
      actions,
      clearAllElementsAndState,
      isUserAuthenticated,
    ]
  );

  // State for export confirmation modal
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [pendingExport, setPendingExport] = useState<(() => void) | null>(null);

  // State for template editor
  const [templateCanvas, setTemplateCanvas] =
    useState<HTMLCanvasElement | null>(null);

  // Add this state near other export-related states
  const [pendingTemplateExport, setPendingTemplateExport] = useState(false);

  // Actual export function
  const performExport = useCallback(async () => {
    try {
      // Create compatibility pageState object
      const pageStateCompat = {
        deletedPages: documentState.deletedPages,
        isPageTranslated: new Map(
          documentState.pages.map((p) => [p.pageNumber, p.isTranslated])
        ),
        isTransforming: documentState.isTransforming,
      };

      await exportPdfDocument({
        documentRef,
        documentState,
        pageState: pageStateCompat,
        editorState,
        viewState,
        templateCanvas,
        setDocumentState,
        setViewState,
        setEditorState,
      });
    } catch (error) {
      console.error("Error in performExport:", error);
      toast.error("Failed to export PDF");
    }
  }, [
    documentRef,
    documentState,
    editorState,
    viewState,
    templateCanvas,
    setDocumentState,
    setViewState,
    setEditorState,
  ]);

  // Export function that directly exports original view pages without template popup
  const exportToPDF = useCallback(async () => {
    setIsExportingPDF(true);
    try {
      await exportToPDFService({
        documentRef,
        documentState,
        editorState,
        viewState,
        setDocumentState,
        setViewState,
        setEditorState,
      });
      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF");
    } finally {
      setIsExportingPDF(false);
    }
  }, [
    documentRef,
    documentState,
    editorState,
    viewState,
    setDocumentState,
    setViewState,
    setEditorState,
  ]);

  // Export to PNG function
  const exportToPNG = useCallback(async () => {
    setIsExportingPNG(true);
    try {
      await exportToPNGService({
        documentRef,
        documentState,
        editorState,
        viewState,
        setDocumentState,
        setViewState,
        setEditorState,
      });
      toast.success("PNG exported successfully!");
    } catch (error) {
      console.error("Error exporting PNG:", error);
      toast.error("Failed to export PNG");
    } finally {
      setIsExportingPNG(false);
    }
  }, [
    documentRef,
    documentState,
    editorState,
    viewState,
    setDocumentState,
    setViewState,
    setEditorState,
  ]);

  // Export to JPEG function
  const exportToJPEG = useCallback(async () => {
    setIsExportingJPEG(true);
    try {
      await exportToJPEGService({
        documentRef,
        documentState,
        editorState,
        viewState,
        setDocumentState,
        setViewState,
        setEditorState,
      });
      toast.success("JPEG exported successfully!");
    } catch (error) {
      console.error("Error exporting JPEG:", error);
      toast.error("Failed to export JPEG");
    } finally {
      setIsExportingJPEG(false);
    }
  }, [
    documentRef,
    documentState,
    editorState,
    viewState,
    setDocumentState,
    setViewState,
    setEditorState,
  ]);

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
    documentState.pages,
    documentState.isTransforming,
    documentState.currentPage,
  ]);

  // Auto-loading disabled - users start with a clean slate

  // Check for languages after document is loaded
  useEffect(() => {
    if (documentState.isDocumentLoaded && documentState.url) {
      // Open sidebar when document is loaded
      setViewState((prev) => ({
        ...prev,
        isSidebarCollapsed: false,
      }));

      // Don't show language modal if we're in final-layout workflow step
      if (viewState.currentWorkflowStep === "final-layout") {
        return;
      }

      // Check if source and desired languages are set
      if (
        !sourceLanguage ||
        !desiredLanguage ||
        sourceLanguage === desiredLanguage
      ) {
        // Open language selection modal
        setShowLanguageModal(true);
        setPendingOcrAction({ type: "bulk" });
      }
    }
  }, [
    documentState.isDocumentLoaded,
    documentState.url,
    sourceLanguage,
    desiredLanguage,
    viewState.currentWorkflowStep,
    setViewState,
  ]);

  // Automatic project creation when document is fully loaded
  const lastUploadedFileRef = useRef<File | null>(null);
  const hasCreatedProjectForCurrentDocumentRef = useRef(false);

  useEffect(() => {
    const createProjectAfterDocumentLoad = async () => {
      // Only create project if:
      // 1. User is authenticated
      // 2. Document is loaded
      // 3. We have a valid document URL
      // 4. We haven't already created a project for this document
      // 5. We have a reference to the uploaded file
      if (
        isUserAuthenticated &&
        documentState.isDocumentLoaded &&
        documentState.url &&
        !hasCreatedProjectForCurrentDocumentRef.current &&
        lastUploadedFileRef.current
      ) {
        hasCreatedProjectForCurrentDocumentRef.current = true;

        try {
          console.log("DEBUG: Creating project after document load", {
            documentState,
            file: lastUploadedFileRef.current,
          });

          const projectId = await createProjectOnUpload(
            lastUploadedFileRef.current
          );
          if (projectId) {
            // Set the current project ID so future saves will update this project
            setCurrentProjectId(projectId);
            console.log(
              "DEBUG: Set current project ID after auto-creation:",
              projectId
            );
          }
          toast.success("Project created automatically!");
        } catch (error) {
          console.error("Failed to create project after document load:", error);
          hasCreatedProjectForCurrentDocumentRef.current = false; // Allow retry
        }
      }
    };

    createProjectAfterDocumentLoad();
  }, [
    isUserAuthenticated,
    documentState.isDocumentLoaded,
    documentState.url,
    documentState.numPages, // Include numPages to ensure document is fully processed
    createProjectOnUpload,
  ]);

  // Reset project creation flag when a new document is uploaded
  useEffect(() => {
    if (!documentState.isDocumentLoaded) {
      hasCreatedProjectForCurrentDocumentRef.current = false;
    }
  }, [documentState.isDocumentLoaded]);

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

  // Render elements with view-specific update functions
  const renderElement = (element: SortedElement, targetView: ViewMode) => {
    // For split view, we need to determine which view this element belongs to
    // This function is called from single view contexts, so we use the current view
    const actualTargetView = targetView === "split" ? "original" : targetView;

    // Calculate effective scale for translated view in split screen
    const effectiveScale =
      targetView === "translated" &&
      viewState.currentView === "split" &&
      getTranslatedTemplateScaleFactor(documentState.currentPage)
        ? documentState.scale *
          getTranslatedTemplateScaleFactor(documentState.currentPage)
        : documentState.scale;

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

      // Use view-specific update function
      const updateFunction =
        actualTargetView === "original"
          ? updateOriginalTextBoxWithUndo
          : updateTranslatedTextBoxWithUndo;

      return (
        <MemoizedTextBox
          key={textBox.id}
          textBox={textBox}
          isSelected={editorState.selectedFieldId === textBox.id}
          isEditMode={editorState.isEditMode}
          scale={effectiveScale}
          showPaddingIndicator={showPaddingPopup}
          onSelect={handleTextBoxSelect}
          onUpdate={updateFunction}
          onDelete={(id) => handleDeleteTextBoxWithUndo(id, actualTargetView)}
          onDuplicate={handleDuplicateTextBox}
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
          scale={effectiveScale}
          pageWidth={documentState.pageWidth}
          pageHeight={documentState.pageHeight}
          onSelect={handleShapeSelect}
          onUpdate={updateShapeWithUndo}
          onDelete={(id) => handleDeleteShapeWithUndo(id, targetView)}
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
          scale={effectiveScale}
          pageWidth={documentState.pageWidth}
          pageHeight={documentState.pageHeight}
          onSelect={handleImageSelect}
          onUpdate={updateImage}
          onDelete={(id) => handleDeleteImageWithUndo(id, targetView)}
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
      .map((el) => renderElement(el, viewState.currentView));
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

    setIsBulkOcrRunning(true);
    setBulkOcrProgress({ current: 0, total: 0 });
    bulkOcrCancelRef.current.cancelled = false;

    try {
      const result = await performBulkOcr({
        documentRef,
        containerRef,
        documentState,
        editorState,
        viewState,
        actions,
        setEditorState,
        setViewState,
        setPageState: (updater: (prev: any) => any) => {
          // Compatibility wrapper for bulk OCR
          const prev = {
            isTransforming: documentState.isTransforming,
            deletedPages: documentState.deletedPages,
            isPageTranslated: new Map(
              documentState.pages.map((p) => [p.pageNumber, p.isTranslated])
            ),
          };
          const newState = updater(prev);

          if (newState.isTransforming !== undefined) {
            pageActions.setIsTransforming(newState.isTransforming);
          }
        },
        sourceLanguage,
        desiredLanguage,
        handleAddTextBoxWithUndo,
        setIsTranslating,
        totalPages: documentState.numPages,
        deletedPages: documentState.deletedPages,
        currentPage: documentState.currentPage,
        onProgress: (current, total) => {
          setBulkOcrProgress({ current, total });
        },
        onPageChange: (page) => {
          actions.changePage(page);
        },
        cancelRef: bulkOcrCancelRef,
        addUntranslatedText,
      });

      if (result.success) {
        toast.success(
          result.message ||
            `Successfully processed ${result.processedPages} pages`
        );
      } else {
        toast.error(result.message || "Bulk OCR process failed");
      }
    } catch (error) {
      console.error("Error in bulk OCR:", error);
      toast.error("Failed to complete bulk OCR process");
    } finally {
      setIsBulkOcrRunning(false);
      setBulkOcrProgress(null);
    }
  }, [
    isBulkOcrRunning,
    documentRef,
    containerRef,
    documentState,
    editorState,
    viewState,
    pageActions,
    actions,
    setEditorState,
    setViewState,
    sourceLanguage,
    desiredLanguage,
    handleAddTextBoxWithUndo,
    setIsTranslating,
  ]);

  // Wrapper function to check language states before running OCR
  const checkLanguageAndRunOcr = useCallback(
    (type: "single" | "bulk", pageNumber?: number) => {
      // Check if we have both source and desired languages set
      if (
        sourceLanguage &&
        desiredLanguage &&
        sourceLanguage !== desiredLanguage
      ) {
        // Languages are set, proceed with OCR
        if (type === "single" && pageNumber) {
          handleTransformPageToTextbox(pageNumber);
        } else if (type === "bulk") {
          handleRunOcrAllPages();
        }
      } else {
        // Show language selection modal
        setPendingOcrAction({ type, pageNumber });
        setShowLanguageModal(true);
      }
    },
    [
      sourceLanguage,
      desiredLanguage,
      handleTransformPageToTextbox,
      handleRunOcrAllPages,
    ]
  );

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

  // Add state for language selection modal
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [pendingOcrAction, setPendingOcrAction] = useState<{
    type: "single" | "bulk";
    pageNumber?: number;
  } | null>(null);

  // Add state for settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempSourceLanguage, setTempSourceLanguage] = useState<string>("");
  const [tempDesiredLanguage, setTempDesiredLanguage] = useState<string>("");

  // Add state for birth certificate modal
  const [showBirthCertModal, setShowBirthCertModal] = useState(false);

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

  // Page type change handler
  const handlePageTypeChange = useCallback(
    (
      pageNumber: number,
      pageType: "social_media" | "birth_cert" | "dynamic_content"
    ) => {
      setDocumentState((prev) => ({
        ...prev,
        pages: prev.pages.map((page) =>
          page.pageNumber === pageNumber ? { ...page, pageType } : page
        ),
      }));
    },
    []
  );

  // Birth certificate modal handler
  const handleBirthCertModalOpen = useCallback(
    (pageNumber?: number) => {
      setBirthCertModalPage(pageNumber || documentState.currentPage);
      setShowBirthCertModal(true);
    },
    [documentState.currentPage]
  );

  // Language modal handlers
  const handleLanguageConfirm = useCallback(() => {
    setShowLanguageModal(false);
    // Always run bulk OCR when Translate Document is clicked
    handleRunOcrAllPages();
    if (pendingOcrAction) {
      setPendingOcrAction(null);
    }
  }, [pendingOcrAction, handleRunOcrAllPages]);

  // Deprecated
  const handleLanguageCancel = useCallback(() => {
    setShowLanguageModal(false);
    setPendingOcrAction(null);
    // Save the current language selections when "Set without Translating" is clicked
    // The languages are already saved through the onSourceLanguageChange and onDesiredLanguageChange props
    toast.success("Language settings saved successfully");
  }, []);

  // Settings modal handlers
  const handleOpenSettings = useCallback(() => {
    setTempSourceLanguage(sourceLanguage);
    setTempDesiredLanguage(desiredLanguage);
    setShowSettingsModal(true);
  }, [sourceLanguage, desiredLanguage]);

  const handleSettingsSave = useCallback(() => {
    setSourceLanguage(tempSourceLanguage);
    setDesiredLanguage(tempDesiredLanguage);
    setShowSettingsModal(false);
    // Always run bulk OCR when Translate Document is clicked from settings
    handleRunOcrAllPages();
  }, [tempSourceLanguage, tempDesiredLanguage, handleRunOcrAllPages]);

  const handleSettingsBack = useCallback(() => {
    setShowSettingsModal(false);
    // Save the temporary language values to the actual state
    setSourceLanguage(tempSourceLanguage);
    setDesiredLanguage(tempDesiredLanguage);
    toast.success("Language settings saved successfully");
  }, [tempSourceLanguage, tempDesiredLanguage]);

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

  // Add state for untranslated check modal
  const [showUntranslatedCheckModal, setShowUntranslatedCheckModal] =
    useState(false);
  const [untranslatedCheckList, setUntranslatedCheckList] = useState<
    { id: string; page: number; status: string; originalText: string }[]
  >([]);
  const [pendingWorkflowStep, setPendingWorkflowStep] =
    useState<WorkflowStep | null>(null);

  // Add state for export loading modals
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingPNG, setIsExportingPNG] = useState(false);
  const [isExportingJPEG, setIsExportingJPEG] = useState(false);

  // Add state for project management modal
  const [showProjectModal, setShowProjectModal] = useState(false);

  // Handler for modal continue/cancel
  const handleUntranslatedCheckContinue = useCallback(() => {
    setShowUntranslatedCheckModal(false);
    if (pendingWorkflowStep) {
      // Actually proceed to layout
      setViewState((prev) => ({
        ...prev,
        currentWorkflowStep: pendingWorkflowStep,
      }));
      setPendingWorkflowStep(null);
    }
  }, [pendingWorkflowStep]);
  const handleUntranslatedCheckCancel = useCallback(() => {
    setShowUntranslatedCheckModal(false);
    setPendingWorkflowStep(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-white">
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
        onProjectManagement={() => setShowProjectModal(true)}
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
        // Bulk OCR props
        onRunOcrAllPages={() => checkLanguageAndRunOcr("bulk")}
        isBulkOcrRunning={isBulkOcrRunning}
        bulkOcrProgress={bulkOcrProgress}
        onCancelBulkOcr={handleCancelBulkOcr}
        hasPages={documentState.numPages > 0}
        onOpenSettings={handleOpenSettings}
        onClearPageTranslation={() =>
          handleClearPageTranslation(documentState.currentPage)
        }
        isCurrentPageTranslated={
          documentState.pages.find(
            (p) => p.pageNumber === documentState.currentPage
          )?.isTranslated || false
        }
        currentWorkflowStep={viewState.currentWorkflowStep}
        onWorkflowStepChange={handleWorkflowStepChange}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative bg-white">
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
          pageState={{
            deletedPages: documentState.deletedPages,
            isPageTranslated: new Map(
              documentState.pages.map((p) => [p.pageNumber, p.isTranslated])
            ),
            isTransforming: documentState.isTransforming,
          }}
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
          onPageTypeChange={handlePageTypeChange}
          onBirthCertModalOpen={handleBirthCertModalOpen}
          documentRef={documentRef}
          sourceLanguage={sourceLanguage}
          desiredLanguage={desiredLanguage}
        />

        {/* Main Content Area */}
        <PanelGroup direction="horizontal" className="flex-1">
          {/* Left side - Document Content */}
          <Panel
            defaultSize={100}
            minSize={20}
            className={`flex flex-col overflow-hidden relative bg-white ${
              viewState.currentView === "split" &&
              (viewState.currentWorkflowStep === "translate" ||
                viewState.currentWorkflowStep === "final-layout")
                ? "flex-1"
                : "flex-1"
            }`}
          >
            {/* ElementFormatDrawer - only show in edit mode */}
            {editorState.isEditMode && (
              <div className="relative z-40 transition-all duration-300">
                <ElementFormatDrawer />
              </div>
            )}

            {/* Floating Toolbars - Only show when PDF is loaded */}
            {documentState.url && !documentState.error && (
              <FloatingToolbar
                editorState={editorState}
                toolState={toolState}
                erasureState={erasureState}
                currentView={viewState.currentView}
                showDeletionRectangles={editorState.showDeletionRectangles}
                isSidebarCollapsed={viewState.isSidebarCollapsed}
                currentWorkflowStep={viewState.currentWorkflowStep}
                onToolChange={handleToolChange}
                onViewChange={(view) => {
                  // Clear selection when changing views to close ElementFormatDrawer
                  clearSelectionState();
                  console.log(
                    `View changing from ${viewState.currentView} to ${view}`
                  );
                  console.log(
                    "Current deleted pages before view change:",
                    documentState.deletedPages
                  );
                  setViewState((prev) => ({ ...prev, currentView: view }));
                }}
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
                onImageUpload={
                  viewState.currentView !== "split"
                    ? () => imageInputRef.current?.click()
                    : undefined
                }
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
                        {Math.round(erasureState.erasureSettings.opacity * 100)}
                        %
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
                paddingTop: "64px",
              }}
            >
              {/* Document Error */}
              {documentState.error && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-red-500 text-lg mb-2">Error</div>
                    <div className="text-gray-600">{documentState.error}</div>
                  </div>
                </div>
              )}

              {/* No Document Loaded */}
              {!documentState.url && !documentState.error && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md mx-auto p-8">
                    {/* Icon */}
                    <div className="mb-6">
                      <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary/20 to-primary/30 rounded-full flex items-center justify-center">
                        <svg
                          className="w-12 h-12 text-primary"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                      Welcome to Wally Editor
                    </h2>

                    {/* Description */}
                    <p className="text-gray-600 mb-8 leading-relaxed">
                      Upload a PDF document to get started with editing,
                      translation, and layout creation. Support for images and
                      various file formats available.
                    </p>

                    {/* Upload Button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isCreatingProject}
                      className={`inline-flex items-center px-6 py-3 font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
                        isCreatingProject
                          ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                          : "bg-primary text-white hover:bg-primaryLight"
                      }`}
                    >
                      {isCreatingProject ? (
                        <>
                          <svg
                            className="w-5 h-5 mr-2 animate-spin"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Creating Project...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          Upload Document
                        </>
                      )}
                    </button>

                    {/* File type info */}
                    <div className="mt-6 text-sm text-gray-500">
                      <p>Supported formats: PDF, JPG, PNG, GIF, BMP, WebP</p>

                      {/* Project creation status */}
                      {shouldShowProjectStatus() && (
                        <div className="mt-4 p-3 rounded-lg border">
                          {isCreatingProject && (
                            <div className="flex items-center text-blue-600">
                              <svg
                                className="w-4 h-4 mr-2 animate-spin"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              Creating your project...
                            </div>
                          )}

                          {projectCreationError && (
                            <div className="flex items-center text-red-600">
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Project creation failed
                            </div>
                          )}

                          {currentProjectId && !isCreatingProject && (
                            <div className="flex items-center text-green-600">
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Project created successfully!
                            </div>
                          )}
                        </div>
                      )}

                      {/* Authentication status */}
                      {!isUserAuthenticated && (
                        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-amber-700">
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="text-sm">
                                Sign in to automatically save projects
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                (window.location.href = "/auth/login")
                              }
                              className="ml-3 px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
                            >
                              Sign In
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
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
                      viewState.currentView === "split" &&
                        viewState.currentWorkflowStep == "layout"
                        ? documentState.pageWidth * documentState.scale * 2 +
                            100 // Double width for split view plus gap and padding
                        : documentState.pageWidth * documentState.scale + 80
                    )}px`,
                    minWidth: `${Math.max(
                      100,
                      viewState.currentView === "split" &&
                        viewState.currentWorkflowStep == "layout"
                        ? documentState.pageWidth * documentState.scale * 2 +
                            100
                        : documentState.pageWidth * documentState.scale + 80
                    )}px`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    paddingTop: "64px",
                    paddingBottom: "40px",
                    paddingLeft: "40px",
                    paddingRight: "40px",
                    margin: "0 auto",
                  }}
                >
                  <div
                    ref={documentRef}
                    className={`relative bg-transparent document-page ${
                      documentState.isScaleChanging ? "" : "zoom-transition"
                    } ${
                      editorState.isAddTextBoxMode ? "add-text-box-mode" : ""
                    } ${
                      editorState.isTextSelectionMode
                        ? "text-selection-mode"
                        : ""
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
                        viewState.currentView === "split" &&
                        viewState.currentWorkflowStep !== "translate" &&
                        viewState.currentWorkflowStep !== "final-layout"
                          ? documentState.pageWidth * documentState.scale * 2 +
                            20 // Double width plus gap for split view
                          : documentState.pageWidth * documentState.scale,
                      height: documentState.pageHeight * documentState.scale,
                      minWidth:
                        viewState.currentView === "split" &&
                        viewState.currentWorkflowStep !== "translate" &&
                        viewState.currentWorkflowStep !== "final-layout"
                          ? documentState.pageWidth * documentState.scale * 2 +
                            20
                          : documentState.pageWidth * documentState.scale,
                      minHeight: documentState.pageHeight * documentState.scale,
                      display: "block",
                    }}
                  >
                    {/* Document Rendering - Show different content based on view */}
                    {viewState.currentView === "original" && (
                      <DocumentPanel
                        viewType="original"
                        documentUrl={documentState.url}
                        currentPage={documentState.currentPage}
                        pageWidth={documentState.pageWidth}
                        pageHeight={documentState.pageHeight}
                        scale={documentState.scale}
                        numPages={documentState.numPages}
                        isScaleChanging={documentState.isScaleChanging}
                        isAddTextBoxMode={editorState.isAddTextBoxMode}
                        isTextSpanZooming={isTextSpanZooming}
                        isPdfFile={isPdfFile}
                        handlers={handlers}
                        actions={actions}
                        setDocumentState={setDocumentState}
                        deletionRectangles={
                          elementCollections.originalDeletionRectangles
                        }
                        showDeletionRectangles={
                          editorState.showDeletionRectangles
                        }
                        onDeleteDeletionRectangle={(id) =>
                          handleDeleteDeletionRectangleWithUndo(id, "original")
                        }
                        colorToRgba={colorToRgba}
                        sortedElements={getOriginalSortedElements(
                          documentState.currentPage
                        )}
                        getElementsInSelectionPreview={
                          getElementsInSelectionPreview
                        }
                        selectedFieldId={editorState.selectedFieldId}
                        selectedShapeId={editorState.selectedShapeId}
                        selectedElementId={selectedElementId}
                        isEditMode={editorState.isEditMode}
                        showPaddingIndicator={showPaddingPopup}
                        onTextBoxSelect={handleTextBoxSelect}
                        onShapeSelect={handleShapeSelect}
                        onImageSelect={handleImageSelect}
                        onUpdateTextBox={updateOriginalTextBoxWithUndo}
                        onUpdateShape={updateShapeWithUndo}
                        onUpdateImage={updateImage}
                        onDeleteTextBox={(id) =>
                          handleDeleteTextBoxWithUndo(id, "original")
                        }
                        onDeleteShape={(id) =>
                          handleDeleteShapeWithUndo(id, "original")
                        }
                        onDeleteImage={(id) =>
                          handleDeleteImageWithUndo(id, "original")
                        }
                        isTextSelectionMode={editorState.isTextSelectionMode}
                        selectedTextBoxes={selectionState.selectedTextBoxes}
                        autoFocusTextBoxId={autoFocusTextBoxId}
                        onAutoFocusComplete={handleAutoFocusComplete}
                        isSelectionMode={editorState.isSelectionMode}
                        multiSelection={editorState.multiSelection}
                        currentView={viewState.currentView}
                        onMoveSelection={handleMoveSelection}
                        onDeleteSelection={handleDeleteSelection}
                        onDragSelection={(deltaX, deltaY) => {
                          // Move all selected elements by delta (in real time)
                          moveSelectedElements(
                            editorState.multiSelection.selectedElements,
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

                    {viewState.currentView === "final-layout" &&
                      documentState.finalLayoutUrl && (
                        <DocumentPanel
                          viewType="final-layout"
                          documentUrl={documentState.finalLayoutUrl}
                          currentPage={
                            documentState.finalLayoutCurrentPage || 1
                          }
                          pageWidth={documentState.pageWidth}
                          pageHeight={documentState.pageHeight}
                          scale={documentState.scale}
                          numPages={documentState.finalLayoutNumPages || 1}
                          isScaleChanging={documentState.isScaleChanging}
                          isAddTextBoxMode={editorState.isAddTextBoxMode}
                          isTextSpanZooming={isTextSpanZooming}
                          isPdfFile={isPdfFile}
                          handlers={handlers}
                          actions={actions}
                          setDocumentState={setDocumentState}
                          deletionRectangles={
                            elementCollections.originalDeletionRectangles
                          }
                          showDeletionRectangles={
                            editorState.showDeletionRectangles
                          }
                          onDeleteDeletionRectangle={(id) =>
                            handleDeleteDeletionRectangleWithUndo(
                              id,
                              "final-layout"
                            )
                          }
                          colorToRgba={colorToRgba}
                          sortedElements={getFinalLayoutSortedElements(
                            documentState.finalLayoutCurrentPage || 1
                          )}
                          getElementsInSelectionPreview={
                            getElementsInSelectionPreview
                          }
                          selectedFieldId={editorState.selectedFieldId}
                          selectedShapeId={editorState.selectedShapeId}
                          selectedElementId={selectedElementId}
                          isEditMode={editorState.isEditMode}
                          showPaddingIndicator={showPaddingPopup}
                          onTextBoxSelect={handleTextBoxSelect}
                          onShapeSelect={handleShapeSelect}
                          onImageSelect={handleImageSelect}
                          onUpdateTextBox={updateFinalLayoutTextBoxWithUndo}
                          onUpdateShape={updateShapeWithUndo}
                          onUpdateImage={updateImage}
                          onDeleteTextBox={(id) =>
                            handleDeleteTextBoxWithUndo(id, "final-layout")
                          }
                          onDeleteShape={(id) =>
                            handleDeleteShapeWithUndo(id, "final-layout")
                          }
                          onDeleteImage={(id) =>
                            handleDeleteImageWithUndo(id, "final-layout")
                          }
                          isTextSelectionMode={editorState.isTextSelectionMode}
                          selectedTextBoxes={selectionState.selectedTextBoxes}
                          autoFocusTextBoxId={autoFocusTextBoxId}
                          onAutoFocusComplete={handleAutoFocusComplete}
                          isSelectionMode={editorState.isSelectionMode}
                          multiSelection={editorState.multiSelection}
                          currentView={viewState.currentView}
                          onMoveSelection={handleMoveSelection}
                          onDeleteSelection={handleDeleteSelection}
                          onDragSelection={(deltaX, deltaY) => {
                            // Move all selected elements by delta (in real time)
                            moveSelectedElements(
                              editorState.multiSelection.selectedElements,
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

                    {/* Translated Document View */}
                    {viewState.currentView === "translated" && (
                      <>
                        {/* Show normal document layout when in layout or final-layout workflow step */}
                        {(viewState.currentWorkflowStep === "layout" ||
                          viewState.currentWorkflowStep === "final-layout") && (
                          /* Show normal document layout when in layout workflow step */
                          <DocumentPanel
                            viewType="translated"
                            documentUrl={getTranslatedDocumentUrl(
                              documentState.currentPage
                            )}
                            currentPage={documentState.currentPage}
                            pageWidth={documentState.pageWidth}
                            pageHeight={documentState.pageHeight}
                            scale={documentState.scale}
                            numPages={documentState.numPages}
                            isScaleChanging={documentState.isScaleChanging}
                            isAddTextBoxMode={editorState.isAddTextBoxMode}
                            isTextSpanZooming={isTextSpanZooming}
                            isPdfFile={isPdfFile}
                            handlers={handlers}
                            actions={actions}
                            setDocumentState={setDocumentState}
                            isPageTranslated={
                              documentState.pages.find(
                                (p) =>
                                  p.pageNumber === documentState.currentPage
                              )?.isTranslated || false
                            }
                            isTransforming={documentState.isTransforming}
                            isTranslating={isTranslating}
                            templateWidth={
                              getTranslatedTemplateDimensions(
                                documentState.currentPage
                              ).width
                            }
                            templateHeight={
                              getTranslatedTemplateDimensions(
                                documentState.currentPage
                              ).height
                            }
                            templateScaleFactor={1} // No scaling in translated view
                            onTemplateLoadSuccess={updateTemplateDimensions}
                            onRunOcr={() =>
                              checkLanguageAndRunOcr(
                                "single",
                                documentState.currentPage
                              )
                            }
                            deletionRectangles={
                              elementCollections.translatedDeletionRectangles
                            }
                            showDeletionRectangles={
                              editorState.showDeletionRectangles
                            }
                            onDeleteDeletionRectangle={(id) =>
                              handleDeleteDeletionRectangleWithUndo(
                                id,
                                "translated"
                              )
                            }
                            colorToRgba={colorToRgba}
                            sortedElements={getTranslatedSortedElements(
                              documentState.currentPage
                            )}
                            getElementsInSelectionPreview={
                              getElementsInSelectionPreview
                            }
                            selectedFieldId={editorState.selectedFieldId}
                            selectedShapeId={editorState.selectedShapeId}
                            selectedElementId={selectedElementId}
                            isEditMode={editorState.isEditMode}
                            showPaddingIndicator={showPaddingPopup}
                            onTextBoxSelect={handleTextBoxSelect}
                            onShapeSelect={handleShapeSelect}
                            onImageSelect={handleImageSelect}
                            onUpdateTextBox={updateTranslatedTextBoxWithUndo}
                            onUpdateShape={updateShapeWithUndo}
                            onUpdateImage={updateImage}
                            onDeleteTextBox={(id) =>
                              handleDeleteTextBoxWithUndo(id, "translated")
                            }
                            onDeleteShape={(id) =>
                              handleDeleteShapeWithUndo(id, "translated")
                            }
                            onDeleteImage={(id) =>
                              handleDeleteImageWithUndo(id, "translated")
                            }
                            isTextSelectionMode={
                              editorState.isTextSelectionMode
                            }
                            selectedTextBoxes={selectionState.selectedTextBoxes}
                            autoFocusTextBoxId={autoFocusTextBoxId}
                            onAutoFocusComplete={handleAutoFocusComplete}
                            isSelectionMode={editorState.isSelectionMode}
                            multiSelection={editorState.multiSelection}
                            currentView={viewState.currentView}
                            onMoveSelection={handleMoveSelection}
                            onDeleteSelection={handleDeleteSelection}
                            onDragSelection={(deltaX, deltaY) => {
                              // Move all selected elements by delta (in real time)
                              moveSelectedElements(
                                editorState.multiSelection.selectedElements,
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

                    {/* Split Screen View */}
                    {viewState.currentView === "split" && (
                      <div
                        className="flex relative"
                        style={{
                          width:
                            documentState.pageWidth * documentState.scale * 2 +
                            20, // Double width plus gap
                          height:
                            documentState.pageHeight * documentState.scale,
                        }}
                      >
                        {/* Original Document Side */}
                        <div style={{ position: "relative" }}>
                          <DocumentPanel
                            viewType="original"
                            documentUrl={documentState.url}
                            currentPage={documentState.currentPage}
                            pageWidth={documentState.pageWidth}
                            pageHeight={documentState.pageHeight}
                            scale={documentState.scale}
                            numPages={documentState.numPages}
                            isScaleChanging={documentState.isScaleChanging}
                            isAddTextBoxMode={editorState.isAddTextBoxMode}
                            isTextSpanZooming={isTextSpanZooming}
                            isPdfFile={isPdfFile}
                            handlers={handlers}
                            actions={actions}
                            setDocumentState={setDocumentState}
                            deletionRectangles={
                              elementCollections.finalLayoutDeletionRectangles
                            }
                            showDeletionRectangles={
                              editorState.showDeletionRectangles
                            }
                            onDeleteDeletionRectangle={(id) =>
                              handleDeleteDeletionRectangleWithUndo(
                                id,
                                "original"
                              )
                            }
                            colorToRgba={colorToRgba}
                            sortedElements={getOriginalSortedElements(
                              documentState.currentPage
                            )}
                            getElementsInSelectionPreview={
                              getElementsInSelectionPreview
                            }
                            selectedFieldId={editorState.selectedFieldId}
                            selectedShapeId={editorState.selectedShapeId}
                            selectedElementId={selectedElementId}
                            isEditMode={editorState.isEditMode}
                            showPaddingIndicator={showPaddingPopup}
                            onTextBoxSelect={handleTextBoxSelect}
                            onShapeSelect={handleShapeSelect}
                            onImageSelect={handleImageSelect}
                            onUpdateTextBox={updateOriginalTextBoxWithUndo}
                            onUpdateShape={updateShapeWithUndo}
                            onUpdateImage={updateImage}
                            onDeleteTextBox={(id) =>
                              handleDeleteTextBoxWithUndo(id, "original")
                            }
                            onDeleteShape={(id) =>
                              handleDeleteShapeWithUndo(id, "original")
                            }
                            onDeleteImage={(id) =>
                              handleDeleteImageWithUndo(id, "original")
                            }
                            isTextSelectionMode={
                              editorState.isTextSelectionMode
                            }
                            selectedTextBoxes={selectionState.selectedTextBoxes}
                            autoFocusTextBoxId={autoFocusTextBoxId}
                            onAutoFocusComplete={handleAutoFocusComplete}
                            isSelectionMode={editorState.isSelectionMode}
                            multiSelection={editorState.multiSelection}
                            currentView={viewState.currentView}
                            onMoveSelection={handleMoveSelection}
                            onDeleteSelection={handleDeleteSelection}
                            onDragSelection={(deltaX, deltaY) => {
                              moveSelectedElements(
                                editorState.multiSelection.selectedElements,
                                deltaX,
                                deltaY,
                                updateTextBoxWithUndo,
                                updateShape,
                                updateImage,
                                getElementById,
                                documentState.pageWidth,
                                documentState.pageHeight
                              );
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
                          {/* Interactive elements overlay for Original in Split View */}
                          <div
                            className="absolute top-0 left-0 interactive-elements-wrapper"
                            style={{
                              width:
                                documentState.pageWidth * documentState.scale,
                              height:
                                documentState.pageHeight * documentState.scale,
                              pointerEvents: "auto",
                              zIndex: 10000,
                            }}
                          >
                            {/* Deletion Rectangles */}
                            {getCurrentDeletionRectangles("original")
                              .filter(
                                (rect) =>
                                  rect.page === documentState.currentPage
                              )
                              .map((rect) => (
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

                            {/* Untranslated text highlight overlay */}
                            <UntranslatedTextHighlight
                              untranslatedTexts={
                                elementCollections.untranslatedTexts
                              }
                              highlightedId={highlightedUntranslatedTextId}
                              currentPage={documentState.currentPage}
                              scale={documentState.scale}
                            />

                            {/* Render all elements in layer order */}
                            {getOriginalSortedElements(
                              documentState.currentPage
                            ).map((el) => renderElement(el, "original"))}
                            {/* Selection overlays for original view */}
                            {editorState.isSelectionMode &&
                              editorState.multiSelection.isDrawingSelection &&
                              editorState.multiSelection.selectionStart &&
                              editorState.multiSelection.selectionEnd &&
                              editorState.multiSelection.targetView ===
                                "original" && (
                                <SelectionPreview
                                  start={
                                    editorState.multiSelection.selectionStart
                                  }
                                  end={editorState.multiSelection.selectionEnd}
                                  scale={documentState.scale}
                                />
                              )}
                            {editorState.isSelectionMode &&
                              editorState.multiSelection.selectionBounds &&
                              editorState.multiSelection.selectedElements
                                .length > 0 &&
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
                                    editorState.multiSelection.isMovingSelection
                                  }
                                  onDragSelection={(deltaX, deltaY) => {
                                    moveSelectedElements(
                                      editorState.multiSelection
                                        .selectedElements,
                                      deltaX,
                                      deltaY,
                                      (id, updates) =>
                                        updateTextBoxWithUndo(
                                          id,
                                          updates,
                                          true
                                        ),
                                      (id, updates) =>
                                        updateShapeWithUndo(id, updates, true),
                                      updateImage,
                                      getElementById,
                                      documentState.pageWidth,
                                      documentState.pageHeight
                                    );
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
                                  onDragStopSelection={handleDragStopSelection}
                                />
                              )}
                          </div>
                        </div>

                        {/* Gap between documents */}
                        <div className="w-5 flex items-center justify-center">
                          <div className="w-px h-full bg-gray-300"></div>
                        </div>

                        {/* Translated Document Side */}
                        <div style={{ position: "relative" }}>
                          {/* Show normal document layout when in layout or final-layout workflow step */}
                          {viewState.currentWorkflowStep === "layout" && (
                            /* Show normal document layout when in layout workflow step */
                            <DocumentPanel
                              viewType="translated"
                              documentUrl={getTranslatedDocumentUrl(
                                documentState.currentPage
                              )}
                              currentPage={documentState.currentPage}
                              pageWidth={documentState.pageWidth}
                              pageHeight={documentState.pageHeight}
                              scale={documentState.scale}
                              numPages={documentState.numPages}
                              isScaleChanging={documentState.isScaleChanging}
                              isAddTextBoxMode={editorState.isAddTextBoxMode}
                              isTextSpanZooming={isTextSpanZooming}
                              isPdfFile={isPdfFile}
                              handlers={handlers}
                              actions={actions}
                              setDocumentState={setDocumentState}
                              isPageTranslated={
                                documentState.pages.find(
                                  (p) =>
                                    p.pageNumber === documentState.currentPage
                                )?.isTranslated || false
                              }
                              isTransforming={documentState.isTransforming}
                              isTranslating={isTranslating}
                              templateWidth={
                                getTranslatedTemplateDimensions(
                                  documentState.currentPage
                                ).width
                              }
                              templateHeight={
                                getTranslatedTemplateDimensions(
                                  documentState.currentPage
                                ).height
                              }
                              templateScaleFactor={getTranslatedTemplateScaleFactor(
                                documentState.currentPage
                              )}
                              onTemplateLoadSuccess={updateTemplateDimensions}
                              onRunOcr={() =>
                                checkLanguageAndRunOcr(
                                  "single",
                                  documentState.currentPage
                                )
                              }
                              deletionRectangles={
                                elementCollections.translatedDeletionRectangles
                              }
                              showDeletionRectangles={
                                editorState.showDeletionRectangles
                              }
                              onDeleteDeletionRectangle={(id) =>
                                handleDeleteDeletionRectangleWithUndo(
                                  id,
                                  "translated"
                                )
                              }
                              colorToRgba={colorToRgba}
                              sortedElements={getTranslatedSortedElements(
                                documentState.currentPage
                              )}
                              getElementsInSelectionPreview={
                                getElementsInSelectionPreview
                              }
                              selectedFieldId={editorState.selectedFieldId}
                              selectedShapeId={editorState.selectedShapeId}
                              selectedElementId={selectedElementId}
                              isEditMode={editorState.isEditMode}
                              showPaddingIndicator={showPaddingPopup}
                              onTextBoxSelect={handleTextBoxSelect}
                              onShapeSelect={handleShapeSelect}
                              onImageSelect={handleImageSelect}
                              onUpdateTextBox={updateTranslatedTextBoxWithUndo}
                              onUpdateShape={updateShapeWithUndo}
                              onUpdateImage={updateImage}
                              onDeleteTextBox={(id) =>
                                handleDeleteTextBoxWithUndo(id, "translated")
                              }
                              onDeleteShape={(id) =>
                                handleDeleteShapeWithUndo(id, "translated")
                              }
                              onDeleteImage={(id) =>
                                handleDeleteImageWithUndo(id, "translated")
                              }
                              isTextSelectionMode={
                                editorState.isTextSelectionMode
                              }
                              selectedTextBoxes={
                                selectionState.selectedTextBoxes
                              }
                              autoFocusTextBoxId={autoFocusTextBoxId}
                              onAutoFocusComplete={handleAutoFocusComplete}
                              isSelectionMode={editorState.isSelectionMode}
                              multiSelection={editorState.multiSelection}
                              currentView={viewState.currentView}
                              onMoveSelection={handleMoveSelection}
                              onDeleteSelection={handleDeleteSelection}
                              onDragSelection={(deltaX, deltaY) => {
                                moveSelectedElements(
                                  editorState.multiSelection.selectedElements,
                                  deltaX,
                                  deltaY,
                                  updateTextBoxWithUndo,
                                  updateShape,
                                  updateImage,
                                  getElementById,
                                  documentState.pageWidth,
                                  documentState.pageHeight
                                );
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
                              header={
                                <div className="absolute -top-8 left-0 right-0 flex items-center justify-center">
                                  <div className="bg-primary text-white px-3 py-1 rounded-t-lg text-sm font-medium">
                                    Translated Document
                                  </div>
                                </div>
                              }
                            />
                          )}
                          {/* Interactive elements overlay for Translated in Split View - only show in layout mode */}
                          {viewState.currentWorkflowStep === "layout" && (
                            <div
                              className="absolute top-0 left-0 interactive-elements-wrapper"
                              style={{
                                width:
                                  getTranslatedTemplateDimensions(
                                    documentState.currentPage
                                  ).width *
                                  documentState.scale *
                                  getTranslatedTemplateScaleFactor(
                                    documentState.currentPage
                                  ),
                                height:
                                  getTranslatedTemplateDimensions(
                                    documentState.currentPage
                                  ).height *
                                  documentState.scale *
                                  getTranslatedTemplateScaleFactor(
                                    documentState.currentPage
                                  ),
                                pointerEvents: "auto",
                                zIndex: 10000,
                              }}
                            >
                              {/* Deletion Rectangles */}
                              {getCurrentDeletionRectangles("translated")
                                .filter(
                                  (rect) =>
                                    rect.page === documentState.currentPage
                                )
                                .map((rect) => (
                                  <div
                                    key={rect.id}
                                    className={`absolute ${
                                      editorState.showDeletionRectangles
                                        ? "border border-red-400"
                                        : ""
                                    }`}
                                    style={{
                                      left:
                                        rect.x *
                                        documentState.scale *
                                        getTranslatedTemplateScaleFactor(
                                          documentState.currentPage
                                        ),
                                      top:
                                        rect.y *
                                        documentState.scale *
                                        getTranslatedTemplateScaleFactor(
                                          documentState.currentPage
                                        ),
                                      width:
                                        rect.width *
                                        documentState.scale *
                                        getTranslatedTemplateScaleFactor(
                                          documentState.currentPage
                                        ),
                                      height:
                                        rect.height *
                                        documentState.scale *
                                        getTranslatedTemplateScaleFactor(
                                          documentState.currentPage
                                        ),
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
                              {/* Render all elements in layer order */}
                              {getTranslatedSortedElements(
                                documentState.currentPage
                              ).map((el) => renderElement(el, "translated"))}
                              {/* Selection overlays for translated view */}
                              {editorState.isSelectionMode &&
                                editorState.multiSelection.isDrawingSelection &&
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
                                    scale={
                                      documentState.scale *
                                      getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      )
                                    }
                                  />
                                )}
                              {editorState.isSelectionMode &&
                                editorState.multiSelection.selectionBounds &&
                                editorState.multiSelection.selectedElements
                                  .length > 0 &&
                                editorState.multiSelection.targetView ===
                                  "translated" && (
                                  <SelectionRectangle
                                    bounds={
                                      editorState.multiSelection.selectionBounds
                                    }
                                    scale={
                                      documentState.scale *
                                      getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      )
                                    }
                                    onMove={handleMoveSelection}
                                    onDelete={handleDeleteSelection}
                                    isMoving={
                                      editorState.multiSelection
                                        .isMovingSelection
                                    }
                                    onDragSelection={(deltaX, deltaY) => {
                                      moveSelectedElements(
                                        editorState.multiSelection
                                          .selectedElements,
                                        deltaX,
                                        deltaY,
                                        (id, updates) =>
                                          updateTextBoxWithUndo(
                                            id,
                                            updates,
                                            true
                                          ),
                                        (id, updates) =>
                                          updateShapeWithUndo(
                                            id,
                                            updates,
                                            true
                                          ),
                                        updateImage,
                                        getElementById,
                                        documentState.pageWidth,
                                        documentState.pageHeight
                                      );
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
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Show interactive elements in both original and translated views */}
                    {(viewState.currentView === "original" ||
                      (viewState.currentView === "translated" &&
                        viewState.currentWorkflowStep !== "translate")) && (
                      <div
                        className="absolute inset-0 interactive-elements-wrapper"
                        style={{
                          width:
                            viewState.currentView === "translated"
                              ? getTranslatedTemplateDimensions(
                                  documentState.currentPage
                                ).width * documentState.scale
                              : documentState.pageWidth * documentState.scale,
                          height:
                            viewState.currentView === "translated"
                              ? getTranslatedTemplateDimensions(
                                  documentState.currentPage
                                ).height * documentState.scale
                              : documentState.pageHeight * documentState.scale,
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
                        {currentPageSortedElements.map((el) =>
                          renderElement(el, viewState.currentView)
                        )}

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
                              editorState.multiSelection.selectedElements
                                .length > 0 &&
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
                                      editorState.multiSelection
                                        .selectedElements,
                                      deltaX,
                                      deltaY,
                                      (id, updates) =>
                                        updateTextBoxWithUndo(
                                          id,
                                          updates,
                                          true
                                        ), // Mark as ongoing operation
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
                        <>
                          {toolState.shapeDrawingMode === "line" ? (
                            // Line preview using SVG
                            <svg
                              className="absolute pointer-events-none"
                              style={{
                                left: getPreviewLeft(
                                  Math.min(
                                    toolState.shapeDrawStart.x,
                                    toolState.shapeDrawEnd.x
                                  ) - 10,
                                  viewState.currentView === "split"
                                    ? toolState.shapeDrawTargetView ===
                                        "translated"
                                    : viewState.currentView === "translated",
                                  viewState.currentView,
                                  documentState.pageWidth,
                                  documentState.scale,
                                  toolState.shapeDrawTargetView === "translated"
                                    ? getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      )
                                    : undefined
                                ),
                                top:
                                  (Math.min(
                                    toolState.shapeDrawStart.y,
                                    toolState.shapeDrawEnd.y
                                  ) -
                                    10) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale),
                                width:
                                  (Math.abs(
                                    toolState.shapeDrawEnd.x -
                                      toolState.shapeDrawStart.x
                                  ) +
                                    20) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale),
                                height:
                                  (Math.abs(
                                    toolState.shapeDrawEnd.y -
                                      toolState.shapeDrawStart.y
                                  ) +
                                    20) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale),
                                zIndex: 50,
                              }}
                            >
                              <line
                                x1={
                                  (toolState.shapeDrawStart.x -
                                    Math.min(
                                      toolState.shapeDrawStart.x,
                                      toolState.shapeDrawEnd.x
                                    ) +
                                    10) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale)
                                }
                                y1={
                                  (toolState.shapeDrawStart.y -
                                    Math.min(
                                      toolState.shapeDrawStart.y,
                                      toolState.shapeDrawEnd.y
                                    ) +
                                    10) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale)
                                }
                                x2={
                                  (toolState.shapeDrawEnd.x -
                                    Math.min(
                                      toolState.shapeDrawStart.x,
                                      toolState.shapeDrawEnd.x
                                    ) +
                                    10) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale)
                                }
                                y2={
                                  (toolState.shapeDrawEnd.y -
                                    Math.min(
                                      toolState.shapeDrawStart.y,
                                      toolState.shapeDrawEnd.y
                                    ) +
                                    10) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale)
                                }
                                stroke="#ef4444"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                                strokeLinecap="round"
                              />
                              {/* Preview anchor points */}
                              <circle
                                cx={
                                  (toolState.shapeDrawStart.x -
                                    Math.min(
                                      toolState.shapeDrawStart.x,
                                      toolState.shapeDrawEnd.x
                                    ) +
                                    10) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale)
                                }
                                cy={
                                  (toolState.shapeDrawStart.y -
                                    Math.min(
                                      toolState.shapeDrawStart.y,
                                      toolState.shapeDrawEnd.y
                                    ) +
                                    10) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale)
                                }
                                r="4"
                                fill="#3b82f6"
                                stroke="white"
                                strokeWidth="1"
                              />
                              <circle
                                cx={
                                  (toolState.shapeDrawEnd.x -
                                    Math.min(
                                      toolState.shapeDrawStart.x,
                                      toolState.shapeDrawEnd.x
                                    ) +
                                    10) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale)
                                }
                                cy={
                                  (toolState.shapeDrawEnd.y -
                                    Math.min(
                                      toolState.shapeDrawStart.y,
                                      toolState.shapeDrawEnd.y
                                    ) +
                                    10) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale)
                                }
                                r="4"
                                fill="#3b82f6"
                                stroke="white"
                                strokeWidth="1"
                              />
                            </svg>
                          ) : (
                            // Rectangle/Circle preview using bounding box
                            <div
                              className="absolute border-2 border-dashed border-red-500 bg-red-100 bg-opacity-30 pointer-events-none"
                              style={{
                                left: getPreviewLeft(
                                  Math.min(
                                    toolState.shapeDrawStart.x,
                                    toolState.shapeDrawEnd.x
                                  ),
                                  viewState.currentView === "split"
                                    ? toolState.shapeDrawTargetView ===
                                        "translated"
                                    : viewState.currentView === "translated",
                                  viewState.currentView,
                                  documentState.pageWidth,
                                  documentState.scale,
                                  toolState.shapeDrawTargetView === "translated"
                                    ? getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      )
                                    : undefined
                                ),
                                top:
                                  Math.min(
                                    toolState.shapeDrawStart.y,
                                    toolState.shapeDrawEnd.y
                                  ) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale),
                                width:
                                  Math.abs(
                                    toolState.shapeDrawEnd.x -
                                      toolState.shapeDrawStart.x
                                  ) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale),
                                height:
                                  Math.abs(
                                    toolState.shapeDrawEnd.y -
                                      toolState.shapeDrawStart.y
                                  ) *
                                  (toolState.shapeDrawTargetView ===
                                    "translated" &&
                                  viewState.currentView === "split"
                                    ? documentState.scale *
                                      (getTranslatedTemplateScaleFactor(
                                        documentState.currentPage
                                      ) || 1)
                                    : documentState.scale),
                                borderRadius:
                                  toolState.shapeDrawingMode === "circle"
                                    ? "50%"
                                    : "0",
                                zIndex: 50,
                              }}
                            />
                          )}
                        </>
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
                              documentState.scale,
                              erasureState.erasureDrawTargetView ===
                                "translated"
                                ? getTranslatedTemplateScaleFactor(
                                    documentState.currentPage
                                  )
                                : undefined
                            ),
                            top:
                              Math.min(
                                erasureState.erasureDrawStart.y,
                                erasureState.erasureDrawEnd.y
                              ) *
                              (erasureState.erasureDrawTargetView ===
                                "translated" &&
                              viewState.currentView === "split"
                                ? documentState.scale *
                                  (getTranslatedTemplateScaleFactor(
                                    documentState.currentPage
                                  ) || 1)
                                : documentState.scale),
                            width:
                              Math.abs(
                                erasureState.erasureDrawEnd.x -
                                  erasureState.erasureDrawStart.x
                              ) *
                              (erasureState.erasureDrawTargetView ===
                                "translated" &&
                              viewState.currentView === "split"
                                ? documentState.scale *
                                  (getTranslatedTemplateScaleFactor(
                                    documentState.currentPage
                                  ) || 1)
                                : documentState.scale),
                            height:
                              Math.abs(
                                erasureState.erasureDrawEnd.y -
                                  erasureState.erasureDrawStart.y
                              ) *
                              (erasureState.erasureDrawTargetView ===
                                "translated" &&
                              viewState.currentView === "split"
                                ? documentState.scale *
                                  (getTranslatedTemplateScaleFactor(
                                    documentState.currentPage
                                  ) || 1)
                                : documentState.scale),
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
          </Panel>

          {/* Resize Handle - Only show when sidebar is visible */}
          {viewState.currentView === "split" &&
            (viewState.currentWorkflowStep === "translate" ||
              viewState.currentWorkflowStep === "final-layout") && (
              <PanelResizeHandle className="w-1 bg-primary/40 hover:bg-primary/60 transition-colors duration-200" />
            )}

          {/* Right Sidebar - Resizable */}
          <Panel
            defaultSize={
              viewState.currentWorkflowStep === "translate" ? 60 : 35
            }
            minSize={20}
            maxSize={80}
            className={
              viewState.currentView === "split" &&
              (viewState.currentWorkflowStep === "translate" ||
                viewState.currentWorkflowStep === "final-layout")
                ? "bg-primary/10 border-l border-primary/20 overflow-auto flex-shrink-0 transition-all duration-500 ease-in-out"
                : "hidden"
            }
          >
            {viewState.currentView === "split" &&
              viewState.currentWorkflowStep === "translate" && (
                <div className="h-full transition-opacity duration-300 opacity-100">
                  <TranslationTableView
                    translatedTextBoxes={getCurrentTextBoxes("translated")}
                    untranslatedTexts={elementCollections.untranslatedTexts}
                    onUpdateTextBox={updateTranslatedTextBoxWithUndo}
                    onUpdateUntranslatedText={updateUntranslatedText}
                    onDeleteTextBox={handleDeleteTextBoxAndUntranslatedText}
                    onRowClick={handleTranslationRowClick}
                    onAddTextBox={handleAddCustomTextBox}
                    onAddUntranslatedText={handleAddCustomUntranslatedText}
                    pageWidth={documentState.pageWidth}
                    pageHeight={documentState.pageHeight}
                    scale={1}
                    currentPage={documentState.currentPage}
                    sourceLanguage={sourceLanguage}
                    desiredLanguage={desiredLanguage}
                  />
                </div>
              )}
            {viewState.currentView === "split" &&
              viewState.currentWorkflowStep === "final-layout" && (
                <div className="transition-opacity duration-300 opacity-100">
                  <FinalLayoutSettings
                    currentPage={documentState.currentPage}
                    totalPages={documentState.numPages}
                    capturedSnapshots={capturedSnapshots}
                    isCapturingSnapshots={isCapturingSnapshots}
                    onExportPDF={exportToPDF}
                    onExportPNG={exportToPNG}
                    onExportJPEG={exportToJPEG}
                    onSaveProject={saveProject}
                  />
                </div>
              )}
          </Panel>
        </PanelGroup>
      </div>

      {/* Status Bar */}
      <PDFEditorStatusBar
        documentState={documentState}
        viewState={viewState}
        elementCollections={elementCollections}
        pageState={{
          deletedPages: documentState.deletedPages,
          isPageTranslated: new Map(
            documentState.pages.map((p) => [p.pageNumber, p.isTranslated])
          ),
          isTransforming: documentState.isTransforming,
        }}
        onZoomChange={(scale) => actions.updateScale(Math.max(1.0, scale))}
        onZoomIn={() =>
          actions.updateScale(Math.min(5.0, documentState.scale + 0.1))
        }
        onZoomOut={() =>
          actions.updateScale(Math.max(1.0, documentState.scale - 0.1))
        }
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

      {/* Language Selection Modal */}
      <LanguageSelectionModal
        open={showLanguageModal}
        sourceLanguage={sourceLanguage}
        desiredLanguage={desiredLanguage}
        onSourceLanguageChange={setSourceLanguage}
        onDesiredLanguageChange={setDesiredLanguage}
        onConfirm={handleLanguageConfirm}
        onCancel={handleLanguageCancel}
      />

      {/* Birth Certificate Selection Modal */}
      <BirthCertificateSelectionModal
        isOpen={showBirthCertModal}
        onClose={() => setShowBirthCertModal(false)}
        documentUrl={documentState.url}
        currentPage={documentState.currentPage}
        pageWidth={documentState.pageWidth}
        pageHeight={documentState.pageHeight}
        sourceLanguage={sourceLanguage}
        desiredLanguage={desiredLanguage}
        pageNumber={birthCertModalPage}
        currentTemplate={getPageBirthCertTemplate(birthCertModalPage)}
        originalTextBoxes={elementCollections.originalTextBoxes}
        originalShapes={elementCollections.originalShapes}
        originalImages={elementCollections.originalImages}
        pdfBackgroundColor={documentState.pdfBackgroundColor}
        onTemplateSelect={(template, pageNumber) => {
          console.log("Selected template:", template, "for page:", pageNumber);

          // Update the specific page with the template information
          setPageBirthCertTemplate(pageNumber, template);

          // Show success message
          toast.success(
            `Template "${template.variation}" applied to page ${pageNumber}`
          );

          setShowBirthCertModal(false);
        }}
      />

      {/* Settings Modal */}
      <LanguageSelectionModal
        open={showSettingsModal}
        sourceLanguage={tempSourceLanguage}
        desiredLanguage={tempDesiredLanguage}
        onSourceLanguageChange={setTempSourceLanguage}
        onDesiredLanguageChange={setTempDesiredLanguage}
        onConfirm={handleSettingsSave}
        onCancel={handleSettingsBack}
        isSettings={true}
        onSave={handleSettingsSave}
        onBack={handleSettingsBack}
      />

      {/* Bulk OCR Loading Modal */}
      <LoadingModal
        isOpen={isBulkOcrRunning}
        title="Transforming Pages"
        message="Please wait while we transform all pages. This may take a few moments..."
        progress={bulkOcrProgress}
        onCancel={handleCancelBulkOcr}
        cancelText="Cancel Transformation"
      />

      {/* Snapshot Capturing Loading Modal */}
      <LoadingModal
        isOpen={isCapturingSnapshots}
        title="Creating Final Layout"
        message="Please wait while we capture page snapshots and create the final layout..."
        progress={snapshotProgress}
        onCancel={() => {
          // Cancel snapshot capturing
          snapshotCancelRef.current.cancelled = true;
          setIsCancellingSnapshots(true);
          toast.info("Cancelling snapshot capture...");
          // Go back to layout step
          handleWorkflowStepChange("layout", "final-layout");
        }}
        cancelText="Cancel"
      />

      {/* PDF Export Loading Modal */}
      <LoadingModal
        isOpen={isExportingPDF}
        title="Exporting PDF"
        message="Please wait while we generate your PDF file..."
      />

      {/* PNG Export Loading Modal */}
      <LoadingModal
        isOpen={isExportingPNG}
        title="Exporting PNG"
        message="Please wait while we generate your PNG file..."
      />

      {/* JPEG Export Loading Modal */}
      <LoadingModal
        isOpen={isExportingJPEG}
        title="Exporting JPEG"
        message="Please wait while we generate your JPEG file..."
      />

      {/* Untranslated Check Modal */}
      <ConfirmationModal
        open={showUntranslatedCheckModal}
        title="Some pages require review before layout"
        description={
          untranslatedCheckList.length > 0 ? (
            <div>
              <div className="mb-2 text-gray-700">
                Before proceeding to layout, please review the following page
                {[...new Set(untranslatedCheckList.map((t) => t.page))].length >
                1
                  ? "s"
                  : ""}
                :
              </div>
              <ul className="mb-4 pl-5 list-disc text-base text-primary font-semibold">
                {Array.from(
                  new Set(untranslatedCheckList.map((t) => t.page))
                ).map((page) => (
                  <li key={page} className="mb-1">
                    Page {page}
                  </li>
                ))}
              </ul>
              <div className="text-gray-500 text-sm">
                These pages have textboxes that are empty or need checking. You
                can continue anyway, or go back and review them.
              </div>
            </div>
          ) : undefined
        }
        onConfirm={handleUntranslatedCheckContinue}
        onCancel={handleUntranslatedCheckCancel}
        confirmText="Continue Anyway"
        cancelText="Cancel"
      />

      {/* Project Management Modal */}
      <ProjectSelectionModal
        open={showProjectModal}
        onOpenChange={setShowProjectModal}
        onLoadProject={loadProject as (projectId?: string) => Promise<boolean>}
        onSaveProject={saveProject as (projectName?: string) => Promise<any>}
        onExportToJson={exportToJson}
        onImportFromJson={importFromJson}
        onDeleteProject={
          deleteProject as (projectId: string) => Promise<boolean>
        }
        getSavedProjects={getSavedProjects as () => Promise<any[]>}
      />
    </div>
  );
};
