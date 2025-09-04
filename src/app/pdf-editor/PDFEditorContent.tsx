import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";
import { useTextFormat } from "@/components/editor/ElementFormatContext";
import { ElementFormatDrawer } from "@/components/editor/ElementFormatDrawer";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/AuthStore";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

// Import services
import {
  performPageOcr,
  performBulkOcr,
  abortOcrOperation,
} from "./services/ocrService";
import {
  exportPdfDocument,
  exportToPDFService,
  exportToPNGService,
  exportToJPEGService,
} from "./services/pdfExportService";
import {
  updateProjectShareSettings,
  getProjectShareSettings,
} from "./services/projectApiService";
import { preloadHtml2Canvas } from "./utils/html2canvasLoader";
import { permissions } from "../pdf-editor-shared/utils/permissions";

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
import { useSharedProjectPersistence } from "../pdf-editor-shared/hooks/useSharedProjectPersistence";
import { isInSharedMode } from "../pdf-editor-shared/services/sharedProjectService";
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
  useHandleUpdateImageWithUndo,
  useUpdateImageWithUndo,
  useHandleMultiDeleteWithUndo,
} from "./hooks/handlers/undoRedoHandlers";

// Import refactored event handler hooks
import { useMultiSelectionHandlers } from "./hooks/handlers/useMultiSelectionHandlers";
import { useToolHandlers } from "./hooks/handlers/useToolHandlers";
import { useShapeDrawingHandlers } from "./hooks/handlers/useShapeDrawingHandlers";
import { ShapePreview } from "./components/elements/ShapePreview";
import { useDocumentMouseHandlers } from "./hooks/handlers/useDocumentMouseHandlers";
import { useFormatHandlers } from "./hooks/handlers/useFormatHandlers";
import { useKeyboardHandlers } from "./hooks/handlers/useKeyboardHandlers";
import { useZoomHandlers } from "./hooks/handlers/useZoomHandlers";

// Import components
import { PDFEditorHeader } from "./components/layout/PDFEditorHeader";
import { PDFEditorSidebar } from "./components/layout/PDFEditorSidebar";
import { PDFEditorStatusBar } from "./components/layout/PDFEditorStatusBar";
import { FloatingToolbar } from "./components/layout/FloatingToolbar";
import { ViewerViewSwitcher } from "./components/layout/ViewerViewSwitcher";
import { MemoizedTextBox } from "./components/elements/TextBox";
import { MemoizedShape } from "./components/elements/Shape";
import { MemoizedImage } from "./components/elements/ImageElement";
import { MultiMoveCommand } from "./hooks/handlers/commands";
import DocumentPanel from "@/components/pdf-editor/DocumentPanel";
import { MemoizedSelectionPreview as SelectionPreview } from "./components/elements/SelectionPreview";
import { SelectionRectangle } from "./components/elements/SelectionRectangle";
import LanguageSelectionModal from "./components/LanguageSelectionModal";
import ConfirmationModal from "./components/ConfirmationModal";
import { TranslationTableView } from "./components/TranslationTableView";
import { ViewerTranslationTable } from "./components/ViewerTranslationTable";
import { FinalLayoutSettings } from "./components/FinalLayoutSettings";
import { UntranslatedTextHighlight } from "./components/UntranslatedTextHighlight";
import { BirthCertificateSelectionModal } from "./components/BirthCertificateSelectionModal";
import { NBIClearanceSelectionModal } from "./components/NBIClearanceSelectionModal";
import { ApostilleSelectionModal } from "./components/ApostilleSelectionModal";
import { LoadingModal } from "@/components/ui/loading-modal";
import { ProjectSelectionModal } from "./components/ProjectSelectionModal";
import {
  ShareProjectModal,
  ShareSettings,
} from "./components/ShareProjectModal";
import { SpotlightTour } from "./components/SpotlightTour";
import { useSpotlightTour } from "./hooks/useSpotlightTour";
import { useLayoutTour } from "./hooks/useLayoutTour";
import { generateUUID } from "./utils/measurements";
import { UntranslatedText } from "./types/pdf-editor.types";
import { createFinalLayoutPdf, SnapshotData } from "./services/snapshotService";
import {
  transformPdfToA4Balanced,
  needsA4Transformation,
  convertImageToA4Pdf,
  convertDocxToA4Pdf,
} from "./services/pdfTransformService";
import {
  captureCurrentProjectPages,
  convertCapturedPagesToSnapshots,
  checkPuppeteerServiceHealth,
} from "./services/pageCaptureService";
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

// Helper function to get PDF page count without loading as main document
const getPdfPageCount = async (pdfUrl: string): Promise<number> => {
  try {
    const loadingTask = pdfjs.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;

    // Clean up the loading task
    loadingTask.destroy();

    return pageCount;
  } catch (error) {
    console.error("Error getting PDF page count:", error);
    // Return a fallback count based on common scenarios
    return 7; // Default fallback
  }
};

export const PDFEditorContent: React.FC<{ projectId?: string }> = ({
  projectId,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // Auth state
  const { user, session } = useAuthStore();
  const isUserAuthenticated = !!(user && session);

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
    restoreTextBox,
    restoreShape,
    restoreImage,
    restoreDeletionRectangle,
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
    selectedImageId: null,
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
      dragOffsets: {},
      isDragging: false,
    },
    isSelectionMode: false,
  });
  // Template state

  // Unsaved changes state for save button highlighting
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Helper functions for universal templates
  const getPageTemplate = useCallback(
    (pageNumber: number) => {
      const page = documentState.pages.find((p) => p.pageNumber === pageNumber);
      return page?.template || null;
    },
    [documentState.pages]
  );

  const getPageTemplateType = useCallback(
    (pageNumber: number) => {
      const page = documentState.pages.find((p) => p.pageNumber === pageNumber);
      return page?.templateType || null;
    },
    [documentState.pages]
  );

  // Helper function to get the translated document URL for a specific page
  const getTranslatedDocumentUrl = useCallback(
    (pageNumber: number) => {
      const page = documentState.pages.find((p) => p.pageNumber === pageNumber);
      // If the page has a birth certificate template, use its URL for translated view
      if (page?.translatedTemplateURL) {
        return page.translatedTemplateURL;
      }
      // Otherwise, return empty string to show blank page
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

  const setPageTemplate = useCallback(
    (
      pageNumber: number,
      template: any,
      pageType: "birth_cert" | "nbi_clearance" | "apostille"
    ) => {
      console.log(
        `Setting ${pageType} template for page:`,
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
            pageType: pageType,
            template: template,
            templateType: template.variation,
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
        ...elementCollections.finalLayoutTextboxes, // Add final layout textboxes
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
        ...elementCollections.finalLayoutShapes, // Add final layout shapes
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
        dragOffsets: {},
        isDragging: false,
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

  // Final layout settings panel state
  const [showFinalLayoutSettings, setShowFinalLayoutSettings] = useState(false);

  // Final layout settings state
  const [finalLayoutSettings, setFinalLayoutSettings] = useState({
    exportSettings: {
      format: "pdf" as "pdf" | "png" | "jpg",
      quality: 100,
      includeOriginal: true,
      includeTranslated: true,
      pageRange: "all" as "all" | "current" | "custom",
      customRange: "",
    },
    activeTab: "export" as "export" | "preview" | "settings",
    isPreviewMode: false,
  });

  // Dirty tracking: snapshot of persistable content (exclude selection, zoom, view toggles)
  const lastSavedSnapshotRef = useRef<string>("");

  const buildPersistedSnapshot = useCallback(() => {
    const detectedPageBackgroundsEntries = Array.from(
      documentState.detectedPageBackgrounds.entries()
    ).sort((a, b) => a[0] - b[0]);
    const deletedPages = Array.from(documentState.deletedPages).sort(
      (a, b) => a - b
    );
    const finalLayoutDeletedPages = Array.from(
      documentState.finalLayoutDeletedPages || new Set<number>()
    ).sort((a, b) => a - b);

    return {
      doc: {
        url: documentState.url,
        fileType: documentState.fileType,
        pages: documentState.pages,
        deletedPages,
        pdfBackgroundColor: documentState.pdfBackgroundColor,
        detectedPageBackgrounds: detectedPageBackgroundsEntries,
        finalLayoutUrl: documentState.finalLayoutUrl,
        finalLayoutNumPages: documentState.finalLayoutNumPages,
        finalLayoutDeletedPages,
      },
      elements: elementCollections,
      layers: {
        originalLayerOrder: [...layerState.originalLayerOrder],
        translatedLayerOrder: [...layerState.translatedLayerOrder],
        finalLayoutLayerOrder: [...layerState.finalLayoutLayerOrder],
      },
      langs: { sourceLanguage, desiredLanguage },
      extra:
        viewState.currentWorkflowStep === "final-layout"
          ? { finalLayoutSettings }
          : undefined,
    };
  }, [
    documentState.url,
    documentState.fileType,
    documentState.pages,
    documentState.deletedPages,
    documentState.pdfBackgroundColor,
    documentState.detectedPageBackgrounds,
    documentState.finalLayoutUrl,
    documentState.finalLayoutNumPages,
    documentState.finalLayoutDeletedPages,
    elementCollections,
    layerState.originalLayerOrder,
    layerState.translatedLayerOrder,
    layerState.finalLayoutLayerOrder,
    sourceLanguage,
    desiredLanguage,
    viewState.currentWorkflowStep,
    finalLayoutSettings,
  ]);

  const persistedSnapshotString = useMemo(() => {
    try {
      return JSON.stringify(buildPersistedSnapshot());
    } catch {
      return Math.random().toString();
    }
  }, [buildPersistedSnapshot]);

  // Initialize baseline once
  useEffect(() => {
    if (!lastSavedSnapshotRef.current) {
      lastSavedSnapshotRef.current = persistedSnapshotString;
    }
  }, [persistedSnapshotString]);

  // Update dirty flag when persisted content changes
  useEffect(() => {
    const t = setTimeout(() => {
      setHasUnsavedChanges(
        persistedSnapshotString !== lastSavedSnapshotRef.current
      );
    }, 150);
    return () => clearTimeout(t);
  }, [persistedSnapshotString]);

  const markAsSaved = useCallback(() => {
    lastSavedSnapshotRef.current = persistedSnapshotString;
    setHasUnsavedChanges(false);
  }, [persistedSnapshotString]);

  // Warn on tab close/refresh if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      // Some browsers require setting returnValue
      event.returnValue = "You have unsaved changes.";
      return "You have unsaved changes.";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

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
    history,
    elementCollections
  );
  const handleDuplicateTextBoxWithUndo = useHandleDuplicateTextBoxWithUndo(
    duplicateTextBox,
    deleteTextBox,
    history,
    elementCollections
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
    viewState,
    history
  );
  const updateOriginalTextBoxWithUndo = useUpdateOriginalTextBoxWithUndo(
    updateTextBox,
    handleUpdateTextBoxWithUndo,
    getCurrentTextBoxState,
    documentState,
    history
  );
  const updateTranslatedTextBoxWithUndo = useUpdateTranslatedTextBoxWithUndo(
    updateTextBox,
    handleUpdateTextBoxWithUndo,
    getCurrentTextBoxState,
    documentState,
    history
  );

  const updateFinalLayoutTextBoxWithUndo = useUpdateFinalLayoutTextBoxWithUndo(
    updateTextBox,
    handleUpdateTextBoxWithUndo,
    getCurrentTextBoxState,
    documentState,
    history
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
    history
  );
  const handleDeleteTextBoxWithUndo = useHandleDeleteTextBoxWithUndo(
    deleteTextBox,
    restoreTextBox,
    history,
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
    restoreShape,
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
      restoreDeletionRectangle,
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
    restoreImage,
    history,
    elementCollections,
    selectedElementId,
    clearSelectionState
  );

  // Multi-delete handler for selected elements
  const handleMultiDeleteWithUndo = useHandleMultiDeleteWithUndo(
    deleteTextBox,
    deleteShape,
    deleteImage,
    restoreTextBox,
    restoreShape,
    restoreImage,
    history,
    elementCollections,
    editorState.multiSelection,
    clearSelectionState
  );

  // Add image update handlers
  const handleUpdateImageWithUndo = useHandleUpdateImageWithUndo(
    updateImage,
    history
  );

  const getCurrentImageState = useCallback(
    (id: string): Partial<ImageType> | null => {
      const allImages = [
        ...elementCollections.originalImages,
        ...elementCollections.translatedImages,
        ...elementCollections.finalLayoutImages,
      ];
      const image = allImages.find((img) => img.id === id);
      return image ? { ...image } : null;
    },
    [elementCollections]
  );

  const updateImageWithUndo = useUpdateImageWithUndo(
    updateImage,
    handleUpdateImageWithUndo,
    getCurrentImageState,
    history
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
      // Search in all views including final layout
      const originalTextBoxes = getCurrentTextBoxes("original");
      const originalShapes = getCurrentShapes("original");
      const originalImages = getCurrentImages("original");
      const translatedTextBoxes = getCurrentTextBoxes("translated");
      const translatedShapes = getCurrentShapes("translated");
      const translatedImages = getCurrentImages("translated");
      const finalLayoutTextBoxes = getCurrentTextBoxes("final-layout");
      const finalLayoutShapes = getCurrentShapes("final-layout");
      const finalLayoutImages = getCurrentImages("final-layout");

      switch (type) {
        case "textbox":
          return (
            originalTextBoxes.find((tb) => tb.id === id) ||
            translatedTextBoxes.find((tb) => tb.id === id) ||
            finalLayoutTextBoxes.find((tb) => tb.id === id) ||
            null
          );
        case "shape":
          return (
            originalShapes.find((s) => s.id === id) ||
            translatedShapes.find((s) => s.id === id) ||
            finalLayoutShapes.find((s) => s.id === id) ||
            null
          );
        case "image":
          return (
            originalImages.find((img) => img.id === id) ||
            translatedImages.find((img) => img.id === id) ||
            finalLayoutImages.find((img) => img.id === id) ||
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
    } else if (targetView === "final-layout") {
      textBoxes = getCurrentTextBoxes("final-layout").filter(
        (tb) => tb.page === documentState.currentPage
      );
      shapes = getCurrentShapes("final-layout").filter(
        (s) => s.page === documentState.currentPage
      );
      images = getCurrentImages("final-layout").filter(
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
    updateImageWithUndo,
    getElementById,
    history,
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
      // Toast-based progress UI
      let toastCompleted = false;
      const toastId = toast.loading("Preparing to create final layout...", {
        duration: Infinity,
      });
      // Reset cancellation flag at the very beginning
      snapshotCancelRef.current.cancelled = false;
      setIsCapturingSnapshots(true);
      setIsCancellingSnapshots(false);
      setSnapshotProgress({ current: 0, total: 0 });

      console.log(
        "Reset cancellation flag to:",
        snapshotCancelRef.current.cancelled
      );

      // Check if Puppeteer service is available
      const isPuppeteerAvailable = await checkPuppeteerServiceHealth();

      if (!isPuppeteerAvailable) {
        throw new Error(
          "Puppeteer capture service is not available. Please ensure it's running on port 3001."
        );
      }

      // Ensure we have a project ID
      if (!projectId) {
        throw new Error("Project ID is required for page capture");
      }

      // Capture all page snapshots using Puppeteer API
      console.log("Starting Puppeteer page capture...");

      // Set up progress tracking
      const totalNonDeletedPages =
        documentState.numPages - documentState.deletedPages.size;
      const totalOperations = totalNonDeletedPages * 2; // original + translated for each page
      setSnapshotProgress({ current: 0, total: totalOperations });
      toast.loading(`Creating Final Layout...`, {
        id: toastId,
        duration: Infinity,
      });

      const captureResponse = await captureCurrentProjectPages(projectId, {
        quality: 3.0, // Higher quality capture (3x scale)
        waitTime: 2400, // Slightly longer to ensure render settles
      });

      // Check if cancelled during capture
      if (snapshotCancelRef.current.cancelled || isCancellingSnapshots) {
        console.log("Snapshot capture was cancelled during capture phase");
        return;
      }

      if (!captureResponse.success || !captureResponse.data) {
        throw new Error(captureResponse.error || "Page capture failed");
      }

      // Convert captured pages to legacy snapshot format for compatibility
      const snapshots = convertCapturedPagesToSnapshots(
        captureResponse.data.captures
      );

      // Update progress to completed
      setSnapshotProgress({ current: totalOperations, total: totalOperations });
      toast.loading(`Generating final layout PDF...`, {
        id: toastId,
        duration: Infinity,
      });

      // Check if cancelled during capture
      if (snapshotCancelRef.current.cancelled || isCancellingSnapshots) {
        console.log("Snapshot capture was cancelled during capture phase");
        console.log("Cancelled flag:", snapshotCancelRef.current.cancelled);
        console.log("Is cancelling:", isCancellingSnapshots);
        return;
      }

      console.log("Captured snapshots:", snapshots.length, "snapshots");
      // Align/derive pageType from document state and template metadata if available
      const correctedSnapshots = snapshots.map((s) => {
        const pageMeta = documentState.pages?.find(
          (p: any) => p.pageNumber === s.pageNumber
        );

        const normalize = (v?: string) => (v || "").toLowerCase();
        const pageType = normalize(pageMeta?.pageType as any);
        const docType = normalize((pageMeta as any)?.template?.doc_type);
        const templateType = normalize((pageMeta as any)?.templateType);

        let derivedType = s.pageType as any;
        if (
          pageType === "birth_cert" ||
          pageType === "nbi_clearance" ||
          pageType === "apostille"
        ) {
          derivedType = pageType;
        } else if (
          docType.includes("birth_certificate") ||
          docType.includes("birth_cert")
        ) {
          derivedType = "birth_cert";
        } else if (docType.includes("nbi_clearance")) {
          derivedType = "nbi_clearance";
        } else if (docType.includes("apostille")) {
          derivedType = "apostille";
        } else if (
          templateType.includes("birth") ||
          templateType.includes("birth_cert")
        ) {
          derivedType = "birth_cert";
        } else if (templateType.includes("nbi")) {
          derivedType = "nbi_clearance";
        } else if (templateType.includes("apostille")) {
          derivedType = "apostille";
        }

        return derivedType && derivedType !== s.pageType
          ? { ...s, pageType: derivedType }
          : s;
      });

      try {
        const typeCounts: Record<string, number> = {};
        correctedSnapshots.forEach((s: any) => {
          const t = s.pageType || "(unset)";
          typeCounts[t] = (typeCounts[t] || 0) + 1;
        });
        console.log("🔎 Corrected snapshots pageType counts:", typeCounts);
      } catch {}

      setCapturedSnapshots(correctedSnapshots);

      // Create final layout PDF with template page and snapshots
      console.log("Creating final layout PDF with template page...");
      const finalLayoutResult = await createFinalLayoutPdf(correctedSnapshots);

      // Check if cancelled after PDF creation
      if (snapshotCancelRef.current.cancelled || isCancellingSnapshots) {
        console.log("Operation cancelled after PDF creation");
        return;
      }

      console.log("Clearing existing final-layout elements only...");
      // Clear only final-layout elements, preserve original and translated elements
      clearFinalLayoutElementsOnly();

      // Clear editor state (and disable edit mode for final layout)
      setEditorState((prev) => ({
        ...prev,
        selectedFieldId: null,
        selectedShapeId: null,
        isEditMode: false, // Keep edit mode disabled for final layout
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
          dragOffsets: {},
          isDragging: false,
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
        // The createFinalLayoutPdf function already returns a properly managed URL
        const finalLayoutUrl = finalLayoutResult.url;
        const isSupabaseUrl = finalLayoutResult.isSupabaseUrl;

        console.log("Final layout URL created:", finalLayoutUrl);

        // Get the actual page count from the PDF without loading it as main document
        const finalLayoutPageCount = await getPdfPageCount(finalLayoutUrl);
        console.log("Final layout page count:", finalLayoutPageCount);

        // Update document state with final layout URL and correct page count
        setDocumentState((prev) => ({
          ...prev,
          finalLayoutUrl: finalLayoutUrl,
          finalLayoutCurrentPage: 1,
          finalLayoutNumPages: finalLayoutPageCount,
          finalLayoutDeletedPages: new Set<number>(),
          // Update metadata if uploaded to Supabase
          finalLayoutSupabaseFilePath: finalLayoutResult.filePath,
          finalLayoutIsSupabaseUrl: isSupabaseUrl,
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
        toast.loading(`Adding interactive elements...`, {
          id: toastId,
          duration: Infinity,
        });
        await addInteractiveElementsToLayout(snapshots);
        console.log("Interactive elements added successfully");

        toast.success("Final layout created", {
          id: toastId,
          description:
            "Template page generated and interactive snapshots added.",
        });
        toastCompleted = true;
        // After successful creation, move to final-layout step and view
        setViewState((prev) => ({
          ...prev,
          currentView: "final-layout",
          currentWorkflowStep: "final-layout",
          activeSidebarTab: "pages",
        }));
        // Clear any deferred workflow change
        try {
          setPendingWorkflowStep(null);
        } catch {}
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
              "PDF worker error occurred. Please refresh and try again."
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
        toastCompleted = true;
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
              "PDF worker error occurred. Please refresh and try again."
            );
          } else {
            toast.error(`Failed to create final layout: ${error.message}`);
          }
        } else {
          toast.error("Failed to create final layout due to an unknown error");
        }
        // mark
      }
    } finally {
      setIsCapturingSnapshots(false);
      setIsCancellingSnapshots(false);
      setSnapshotProgress({ current: 0, total: 0 });
      snapshotCancelRef.current.cancelled = false;
      // Ensure we don't leave a loading toast hanging
      // If success/error already updated the toast, do nothing
      // Otherwise dismiss
      // Note: Sonner ignores dismiss for toasts already updated to success/error
      try {
        // @ts-ignore
        if (typeof toastCompleted !== "undefined" && !toastCompleted) {
          toast.dismiss();
        }
      } catch {}
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

  // Helper function to convert data URL to File object
  const dataUrlToFile = useCallback(
    (dataUrl: string, fileName: string): File => {
      const arr = dataUrl.split(",");
      const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], fileName, { type: mime });
    },
    []
  );

  // Helper function to add full-page image for birth certificates
  const addFullPageImage = useCallback(
    async (
      imageDataUrl: string,
      imageWidth: number,
      imageHeight: number,
      pageNumber: number,
      imagePrefix: string
    ) => {
      try {
        // Calculate dimensions to fit the full page while maintaining aspect ratio
        const pageWidth = 612; // Letter size in points
        const pageHeight = 792;
        const margin = 20; // Small margin around the image
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;

        const fittedDimensions = calculateFittedImageDimensions(
          imageWidth,
          imageHeight,
          maxWidth,
          maxHeight
        );

        // Center the image on the page
        const offsetX = (pageWidth - fittedDimensions.width) / 2;
        const offsetY = (pageHeight - fittedDimensions.height) / 2;

        // Upload image to Supabase
        const fileName = `${imagePrefix}-${Date.now()}.png`;
        const file = dataUrlToFile(imageDataUrl, fileName);
        const uploadResult = await uploadFileWithFallback(file);

        // Add the image to the final layout
        handleAddImageWithUndo(
          uploadResult.url,
          offsetX,
          offsetY,
          fittedDimensions.width,
          fittedDimensions.height,
          pageNumber,
          "final-layout",
          {
            isSupabaseUrl: true,
            filePath: uploadResult.filePath,
            fileName: fileName,
            fileObjectId: uploadResult.fileObjectId,
          }
        );
      } catch (error) {
        console.error(
          `Error uploading full page image for page ${pageNumber}:`,
          error
        );
        toast.error(`Failed to upload image for page ${pageNumber}`);

        // Fallback to using data URL directly
        const pageWidth = 612;
        const pageHeight = 792;
        const margin = 20;
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;

        const fittedDimensions = calculateFittedImageDimensions(
          imageWidth,
          imageHeight,
          maxWidth,
          maxHeight
        );

        const offsetX = (pageWidth - fittedDimensions.width) / 2;
        const offsetY = (pageHeight - fittedDimensions.height) / 2;

        handleAddImageWithUndo(
          imageDataUrl,
          offsetX,
          offsetY,
          fittedDimensions.width,
          fittedDimensions.height,
          pageNumber,
          "final-layout",
          undefined
        );
      }
    },
    [calculateFittedImageDimensions, dataUrlToFile, handleAddImageWithUndo]
  );

  // Helper function to add quadrant images for dynamic content
  const addQuadrantImages = useCallback(
    async (
      snapshot: SnapshotData,
      pageNumber: number,
      gridMargin: number,
      pageHeight: number,
      labelSpace: number,
      quadrantWidth: number,
      quadrantHeight: number,
      gridSpacing: number,
      position: "top" | "bottom"
    ) => {
      try {
        // Calculate fitted dimensions for both images
        const originalDimensions = calculateFittedImageDimensions(
          snapshot.originalWidth,
          snapshot.originalHeight,
          quadrantWidth,
          quadrantHeight
        );
        const translatedDimensions = calculateFittedImageDimensions(
          snapshot.translatedWidth,
          snapshot.translatedHeight,
          quadrantWidth,
          quadrantHeight
        );

        // Calculate centering offsets
        const originalOffsetX = (quadrantWidth - originalDimensions.width) / 2;
        const originalOffsetY =
          (quadrantHeight - originalDimensions.height) / 2;
        const translatedOffsetX =
          (quadrantWidth - translatedDimensions.width) / 2;
        const translatedOffsetY =
          (quadrantHeight - translatedDimensions.height) / 2;

        // Calculate Y positions based on row (top or bottom)
        const rowY =
          position === "top"
            ? pageHeight - labelSpace - quadrantHeight + originalOffsetY
            : pageHeight -
              labelSpace -
              quadrantHeight * 2 -
              gridSpacing +
              originalOffsetY;
        const translatedRowY =
          position === "top"
            ? pageHeight - labelSpace - quadrantHeight + translatedOffsetY
            : pageHeight -
              labelSpace -
              quadrantHeight * 2 -
              gridSpacing +
              translatedOffsetY;

        // Upload original image
        const originalFileName = `final-layout-original-page-${
          snapshot.pageNumber
        }-${position}-${Date.now()}.png`;
        const originalFile = dataUrlToFile(
          snapshot.originalImage,
          originalFileName
        );
        const originalUploadResult = await uploadFileWithFallback(originalFile);

        // Upload translated image
        const translatedFileName = `final-layout-translated-page-${
          snapshot.pageNumber
        }-${position}-${Date.now()}.png`;
        const translatedFile = dataUrlToFile(
          snapshot.translatedImage,
          translatedFileName
        );
        const translatedUploadResult = await uploadFileWithFallback(
          translatedFile
        );

        // Add original image (left side)
        handleAddImageWithUndo(
          originalUploadResult.url,
          gridMargin + originalOffsetX,
          rowY,
          originalDimensions.width,
          originalDimensions.height,
          pageNumber,
          "final-layout",
          {
            isSupabaseUrl: true,
            filePath: originalUploadResult.filePath,
            fileName: originalFileName,
            fileObjectId: originalUploadResult.fileObjectId,
          }
        );

        // Add translated image (right side)
        handleAddImageWithUndo(
          translatedUploadResult.url,
          gridMargin + quadrantWidth + gridSpacing + translatedOffsetX,
          translatedRowY,
          translatedDimensions.width,
          translatedDimensions.height,
          pageNumber,
          "final-layout",
          {
            isSupabaseUrl: true,
            filePath: translatedUploadResult.filePath,
            fileName: translatedFileName,
            fileObjectId: translatedUploadResult.fileObjectId,
          }
        );
      } catch (error) {
        console.error(
          `Error uploading quadrant images for snapshot ${snapshot.pageNumber}:`,
          error
        );
        toast.error(`Failed to upload images for page ${snapshot.pageNumber}`);

        // Fallback to using data URLs directly
        const originalDimensions = calculateFittedImageDimensions(
          snapshot.originalWidth,
          snapshot.originalHeight,
          quadrantWidth,
          quadrantHeight
        );
        const translatedDimensions = calculateFittedImageDimensions(
          snapshot.translatedWidth,
          snapshot.translatedHeight,
          quadrantWidth,
          quadrantHeight
        );

        const originalOffsetX = (quadrantWidth - originalDimensions.width) / 2;
        const originalOffsetY =
          (quadrantHeight - originalDimensions.height) / 2;
        const translatedOffsetX =
          (quadrantWidth - translatedDimensions.width) / 2;
        const translatedOffsetY =
          (quadrantHeight - translatedDimensions.height) / 2;

        const rowY =
          position === "top"
            ? pageHeight - labelSpace - quadrantHeight + originalOffsetY
            : pageHeight -
              labelSpace -
              quadrantHeight * 2 -
              gridSpacing +
              originalOffsetY;
        const translatedRowY =
          position === "top"
            ? pageHeight - labelSpace - quadrantHeight + translatedOffsetY
            : pageHeight -
              labelSpace -
              quadrantHeight * 2 -
              gridSpacing +
              translatedOffsetY;

        handleAddImageWithUndo(
          snapshot.originalImage,
          gridMargin + originalOffsetX,
          rowY,
          originalDimensions.width,
          originalDimensions.height,
          pageNumber,
          "final-layout",
          undefined
        );

        handleAddImageWithUndo(
          snapshot.translatedImage,
          gridMargin + quadrantWidth + gridSpacing + translatedOffsetX,
          translatedRowY,
          translatedDimensions.width,
          translatedDimensions.height,
          pageNumber,
          "final-layout",
          undefined
        );
      }
    },
    [calculateFittedImageDimensions, dataUrlToFile, handleAddImageWithUndo]
  );

  // Helper function to add grid lines for dynamic content layout
  const addGridLines = useCallback(
    (
      pageNumber: number,
      gridMargin: number,
      pageWidth: number,
      pageHeight: number,
      labelSpace: number,
      availableWidth: number,
      quadrantHeight: number,
      gridSpacing: number,
      hasSecondSnapshot: boolean
    ) => {
      // Add vertical dividing line between original and translated
      handleAddShapeWithUndo(
        "line",
        gridMargin + availableWidth / 2,
        gridMargin,
        2, // width
        pageHeight - labelSpace, // height
        pageNumber,
        "final-layout",
        undefined,
        gridMargin + availableWidth / 2, // x1
        gridMargin, // y1
        gridMargin + availableWidth / 2, // x2
        pageHeight - labelSpace // y2
      );

      // Add horizontal dividing line between top and bottom rows (if there's a second snapshot)
      if (hasSecondSnapshot) {
        handleAddShapeWithUndo(
          "line",
          gridMargin,
          pageHeight - labelSpace - quadrantHeight - gridSpacing / 2,
          availableWidth, // width
          2, // height
          pageNumber,
          "final-layout",
          undefined,
          gridMargin, // x1
          pageHeight - labelSpace - quadrantHeight - gridSpacing / 2, // y1
          gridMargin + availableWidth, // x2
          pageHeight - labelSpace - quadrantHeight - gridSpacing / 2 // y2
        );
      }
    },
    [handleAddShapeWithUndo]
  );

  // Function to add interactive elements (images and lines) to the final layout
  const addInteractiveElementsToLayout = useCallback(
    async (snapshots: SnapshotData[]) => {
      console.log(
        "Adding interactive elements, total snapshots:",
        snapshots.length
      );

      // Separate snapshots by page type (matching the PDF creation logic)
      const documentsSnapshot = snapshots.filter(
        (s) =>
          s.pageType === "birth_cert" ||
          s.pageType === "nbi_clearance" ||
          s.pageType === "apostille"
      );
      const SocialMediaSnapshots = snapshots.filter(
        (s) =>
          s.pageType !== "birth_cert" &&
          s.pageType !== "nbi_clearance" &&
          s.pageType !== "apostille"
      );

      // Sort both arrays by page number
      documentsSnapshot.sort((a, b) => a.pageNumber - b.pageNumber);
      SocialMediaSnapshots.sort((a, b) => a.pageNumber - b.pageNumber);

      console.log(
        `Processing ${documentsSnapshot.length} document snapshots and ${SocialMediaSnapshots.length} social media/dynamic snapshots`
      );

      let currentPdfPageNumber = 2; // Start after template page (page 1)

      // 1. Process document pages (2 PDF pages per doc: original + translated)
      for (const snapshot of documentsSnapshot) {
        console.log(
          `Adding document elements for original page ${snapshot.pageNumber} -> PDF page ${currentPdfPageNumber}`
        );

        // Add full-page original image
        await addFullPageImage(
          snapshot.originalImage,
          snapshot.originalWidth,
          snapshot.originalHeight,
          currentPdfPageNumber,
          `document-original-${snapshot.pageNumber}`
        );
        currentPdfPageNumber++;

        console.log(
          `Adding document elements for translated page ${snapshot.pageNumber} -> PDF page ${currentPdfPageNumber}`
        );

        // Add full-page translated image
        await addFullPageImage(
          snapshot.translatedImage,
          snapshot.translatedWidth,
          snapshot.translatedHeight,
          currentPdfPageNumber,
          `document-translated-${snapshot.pageNumber}`
        );
        currentPdfPageNumber++;
      }

      // 2. Process social media/dynamic content pages (2x2 grid layout)
      if (SocialMediaSnapshots.length > 0) {
        console.log(
          `Starting dynamic content layout from PDF page ${currentPdfPageNumber}`
        );

        const socialMediaPageNeeded = Math.ceil(
          SocialMediaSnapshots.length / 2
        );

        for (
          let pdfPageIndex = 0;
          pdfPageIndex < socialMediaPageNeeded;
          pdfPageIndex++
        ) {
          const pageNumber = currentPdfPageNumber + pdfPageIndex;
          const snapshot1 = SocialMediaSnapshots[pdfPageIndex * 2];
          const snapshot2 = SocialMediaSnapshots[pdfPageIndex * 2 + 1];

          console.log(
            `Adding dynamic content elements to PDF page ${pageNumber}`
          );

          // Calculate layout dimensions (matching the PDF creation logic) - A4 size in points
          const pageWidth = 595.28;
          const pageHeight = 841.89;
          const gridMargin = 10;
          const gridSpacing = 8;
          const labelSpace = 15;
          const availableWidth = pageWidth - gridMargin * 2;
          const availableHeight = pageHeight - gridMargin * 2 - labelSpace;
          const quadrantWidth = (availableWidth - gridSpacing) / 2; // ~292px
          const quadrantHeight = (availableHeight - gridSpacing) / 2; // ~379.5px

          // Add first snapshot's images (top row)
          if (snapshot1) {
            await addQuadrantImages(
              snapshot1,
              pageNumber,
              gridMargin,
              pageHeight,
              labelSpace,
              quadrantWidth,
              quadrantHeight,
              gridSpacing,
              "top" // Position: top row
            );
          }

          // Add second snapshot's images (bottom row)
          if (snapshot2) {
            await addQuadrantImages(
              snapshot2,
              pageNumber,
              gridMargin,
              pageHeight,
              labelSpace,
              quadrantWidth,
              quadrantHeight,
              gridSpacing,
              "bottom" // Position: bottom row
            );
          }

          // Add dividing lines
          addGridLines(
            pageNumber,
            gridMargin,
            pageWidth,
            pageHeight,
            labelSpace,
            availableWidth,
            quadrantHeight,
            gridSpacing,
            !!snapshot2
          );
        }
      }

      console.log("Interactive elements layout completed");
    },
    [
      handleAddImageWithUndo,
      handleAddShapeWithUndo,
      calculateFittedImageDimensions,
      dataUrlToFile,
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
      const prev: WorkflowStep = previousStep || viewState.currentWorkflowStep;

      // Handle leaving final-layout step - set view to split when going to translate or layout
      if (
        prev === "final-layout" &&
        (step === "translate" || step === "layout")
      ) {
        console.log(
          `Leaving final-layout step, setting view to split for ${step} step`
        );
        setViewState((prevState) => {
          console.log(
            `Final-layout leaving: Changing view from ${prevState.currentView} to split`
          );
          return {
            ...prevState,
            currentView: "split",
          };
        });
        // Hide final layout settings when leaving final layout step
        console.log(
          "Leaving final-layout step, setting showFinalLayoutSettings to false"
        );
        setShowFinalLayoutSettings(false);
      }

      // Handle entering translate step
      if (step === "translate" && prev !== "translate") {
        console.log(
          "Entering translate step, disabling edit mode and setting view to split"
        );

        // Disable edit mode for translate step
        setEditorState((prev) => ({
          ...prev,
          isEditMode: false,
        }));

        // Set view to split for translate step
        setViewState((prevState) => ({
          ...prevState,
          currentView: "split",
        }));
      }

      // Handle entering layout step
      if (step === "layout" && prev !== "layout") {
        console.log(
          `Entering layout step from ${prev} step, current view: ${viewState.currentView}`
        );

        // Enable edit mode for layout step
        setEditorState((prev) => ({
          ...prev,
          isEditMode: true,
        }));

        // Set initial view to split for layout step (but allow changing it)
        // Only set to split if coming from a different step, not when already in layout
        if (prev && prev !== ("layout" as WorkflowStep)) {
          setViewState((prevState) => ({
            ...prevState,
            currentView: "split",
          }));
        }

        console.log("Layout step: Initialized");
      }

      // Handle entering final-layout step
      if (step === "final-layout" && prev !== "final-layout") {
        // Gate transition until final layout assets are ready
        const hasFinalLayoutElements =
          elementCollections.finalLayoutTextboxes.length > 0 ||
          elementCollections.finalLayoutShapes.length > 0 ||
          elementCollections.finalLayoutImages.length > 0 ||
          elementCollections.finalLayoutDeletionRectangles.length > 0;
        const hasFinalLayoutUrl = !!documentState.finalLayoutUrl;

        if (!hasFinalLayoutElements || !hasFinalLayoutUrl) {
          if (!isCapturingSnapshots) {
            console.log(
              "Final layout not ready. Starting createFinalLayoutWithSnapshots and deferring step change."
            );
            setPendingWorkflowStep("final-layout");
            createFinalLayoutWithSnapshots();
          } else {
            console.log(
              "Final layout generation already in progress. Deferring step change."
            );
          }
          return; // Block switching to final-layout until ready
        }

        // Final layout is ready: now switch view and UI state
        setEditorState((prev) => ({
          ...prev,
          isEditMode: false,
        }));

        setViewState((prev) => ({
          ...prev,
          currentView: "final-layout",
        }));

        actions.updateScale(1.0);
        // Reset cancellation state to ensure clean entry
        console.log("Entering final-layout, resetting cancellation state");
        snapshotCancelRef.current.cancelled = false;
        setIsCancellingSnapshots(false);

        // Show final layout settings when entering final layout step
        console.log(
          "Entering final-layout step, setting showFinalLayoutSettings to true"
        );
        setShowFinalLayoutSettings(true);
      }

      // Update workflow step first
      setViewState((prev) => ({
        ...prev,
        currentWorkflowStep: step,
      }));

      // Layout step allows free view switching, so don't enforce split view
    },
    [
      viewState.currentWorkflowStep,
      isCapturingSnapshots,
      capturedSnapshots,
      createFinalLayoutWithSnapshots,
      elementCollections.untranslatedTexts,
      elementCollections.finalLayoutTextboxes,
      elementCollections.finalLayoutShapes,
      elementCollections.finalLayoutImages,
      elementCollections.finalLayoutDeletionRectangles,
      actions,
      setEditorState,
      setViewState,
    ]
  );

  // View change handler for tour
  const handleViewChange = useCallback(
    (view: "original" | "translated" | "split" | "final-layout") => {
      setViewState((prev) => ({ ...prev, currentView: view }));
    },
    []
  );

  // Spotlight tour hook (for translate workflow)
  const {
    isTourOpen,
    currentStepIndex,
    hasCompletedTour,
    tourSteps,
    startTour,
    closeTour,
    completeTour,
    resetTour,
    goToStep,
    nextStep,
    currentStep,
    isFirstStep,
    isLastStep,
    totalSteps,
  } = useSpotlightTour(handleWorkflowStepChange, handleViewChange);

  // Layout tour hook (for layout workflow)
  const layoutTour = useLayoutTour(
    handleWorkflowStepChange,
    handleViewChange,
    () => {
      // Toggle edit mode for the layout tour
      setEditorState((prev) => ({
        ...prev,
        isEditMode: true,
      }));
    },
    () => {
      // Robust selection across all collections with retry while document loads
      let attempts = 0;
      const trySelect = () => {
        attempts += 1;
        if (!documentState.isDocumentLoaded) {
          if (attempts < 20) return setTimeout(trySelect, 100);
          console.warn("Layout Tour: Document not loaded, giving up.");
          return;
        }

        const allTextBoxes = [
          ...elementCollections.originalTextBoxes,
          ...elementCollections.translatedTextBoxes,
          ...elementCollections.finalLayoutTextboxes,
        ];
        const allShapes = [
          ...elementCollections.originalShapes,
          ...elementCollections.translatedShapes,
          ...elementCollections.finalLayoutShapes,
        ];
        const allImages = [
          ...elementCollections.originalImages,
          ...elementCollections.translatedImages,
          ...elementCollections.finalLayoutImages,
        ];

        const elTb = allTextBoxes[0];
        const elSh = allShapes[0];
        const elIm = allImages[0];

        if (elTb) {
          console.log("🎯 Layout Tour: Selecting first textbox:", elTb.id);
          // Ensure correct page first
          if (typeof elTb.page === "number") {
            setDocumentState((prev) => ({ ...prev, currentPage: elTb.page }));
          }
          setSelectedElementId(elTb.id);
          setSelectedElementType("textbox");
          setCurrentFormat(elTb);
          setIsDrawerOpen(true);
          setEditorState((prev) => ({
            ...prev,
            isEditMode: true,
            selectedFieldId: elTb.id,
            selectedShapeId: null,
            selectedImageId: null,
          }));

          // Click DOM node to trigger selection side-effects
          setTimeout(() => {
            const node = document.querySelector(
              `[data-element-id="${elTb.id}"]`
            ) as HTMLElement | null;
            if (!node && attempts < 20) return setTimeout(trySelect, 100);
            if (node) node.click();
          }, 50);
          return;
        }

        if (elSh) {
          console.log("🎯 Layout Tour: Selecting first shape:", elSh.id);
          if (typeof elSh.page === "number") {
            setDocumentState((prev) => ({ ...prev, currentPage: elSh.page }));
          }
          setSelectedElementId(elSh.id);
          setSelectedElementType("shape");
          setCurrentFormat(elSh);
          setIsDrawerOpen(true);
          setEditorState((prev) => ({
            ...prev,
            isEditMode: true,
            selectedFieldId: null,
            selectedShapeId: elSh.id,
            selectedImageId: null,
          }));
          setTimeout(() => {
            const node = document.querySelector(
              `[data-element-id=\"${elSh.id}\"]`
            ) as HTMLElement | null;
            if (!node && attempts < 20) return setTimeout(trySelect, 100);
            if (node) node.click();
          }, 50);
          return;
        }

        if (elIm) {
          console.log("🎯 Layout Tour: Selecting first image:", elIm.id);
          if (typeof elIm.page === "number") {
            setDocumentState((prev) => ({ ...prev, currentPage: elIm.page }));
          }
          setSelectedElementId(elIm.id);
          setSelectedElementType("image");
          setCurrentFormat(elIm);
          setIsDrawerOpen(true);
          setEditorState((prev) => ({
            ...prev,
            isEditMode: true,
            selectedFieldId: null,
            selectedShapeId: null,
            selectedImageId: elIm.id,
          }));
          setTimeout(() => {
            const node = document.querySelector(
              `[data-element-id=\"${elIm.id}\"]`
            ) as HTMLElement | null;
            if (!node && attempts < 20) return setTimeout(trySelect, 100);
            if (node) node.click();
          }, 50);
          return;
        }

        // None found yet, retry briefly as elements may still be mounting
        if (attempts < 20) return setTimeout(trySelect, 100);
        console.log("⚠️ Layout Tour: No elements found across collections.");

        // Fallback: create a textbox so the drawer can be demonstrated
        try {
          const page = documentState.currentPage;
          const x = 100;
          const y = 100;
          const view = viewState.currentView;
          const createdId = handleAddTextBoxWithUndo(
            x,
            y,
            page,
            view,
            undefined,
            undefined
          );
          if (createdId) {
            setSelectedElementId(createdId);
            setSelectedElementType("textbox");
            setIsDrawerOpen(true);
            setEditorState((prev) => ({
              ...prev,
              isEditMode: true,
              selectedFieldId: createdId,
              selectedShapeId: null,
              selectedImageId: null,
            }));
            setTimeout(() => {
              const node = document.querySelector(
                `[data-element-id="${createdId}"]`
              ) as HTMLElement | null;
              if (node) node.click();
            }, 50);
          }
        } catch (e) {
          console.warn("Layout Tour: Failed to create fallback textbox", e);
        }
      };

      // Slight delay to allow UI to settle after step change
      setTimeout(trySelect, 150);
    },
    () => {
      // Move to first non-deleted page after tutorial completion
      const pages = documentState.pages;
      if (pages && pages.length > 0) {
        // Find the first page that is not in the deletedPages set
        const firstNonDeletedPage = pages.find(
          (page) => !documentState.deletedPages.has(page.pageNumber)
        );
        if (firstNonDeletedPage) {
          setDocumentState((prev) => ({
            ...prev,
            currentPage: firstNonDeletedPage.pageNumber,
          }));
        }
      }
    }
  );

  // Ensure view is always split when in layout step
  useEffect(() => {
    if (
      viewState.currentWorkflowStep === "layout" &&
      viewState.currentView !== "split"
    ) {
      console.log(
        `Layout step detected but view is ${viewState.currentView}, forcing to split`
      );
      setViewState((prevState) => ({
        ...prevState,
        currentView: "split",
      }));
    }
  }, [viewState.currentWorkflowStep, setViewState]);

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

  // Zoom functionality (optimized)
  useZoomHandlers({
    viewState,
    setViewState,
    documentState,
    actions,
    containerRef,
    documentRef,
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
      // Close drawer if not in edit mode, unless we're in final-layout workflow step
      if (
        !editorState.isEditMode &&
        viewState.currentWorkflowStep !== "final-layout"
      ) {
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
              ...elementCollections.finalLayoutTextboxes, // Add final layout textboxes
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
              ...elementCollections.finalLayoutShapes, // Add final layout shapes
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
          // Find the selected text box from all text boxes (including final layout)
          const allTextBoxes = [
            ...elementCollections.originalTextBoxes,
            ...elementCollections.translatedTextBoxes,
            ...elementCollections.finalLayoutTextboxes, // Add final layout textboxes
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
          const allShapes = [
            ...elementCollections.originalShapes,
            ...elementCollections.translatedShapes,
            ...elementCollections.finalLayoutShapes, // Add final layout shapes
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
          const allImages = [
            ...elementCollections.originalImages,
            ...elementCollections.translatedImages,
            ...elementCollections.finalLayoutImages, // Add final layout images
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
        // Close drawer when no element is selected AND no multi-selection
        if (selectedElements.length === 0) {
          setIsDrawerOpen(false);
          setSelectedElementId(null);
          setCurrentFormat(null);
        }
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
        snapshotCancelRef.current.cancelled = true;
      }
    };
  }, []); // Empty dependency array to only run on actual mount/unmount

  // Editor-specific functions for shared projects (defined early to avoid initialization order issues)
  const isEditorMode = useCallback(() => {
    if (typeof window === "undefined") return false;
    return (
      localStorage.getItem("pdf-editor-shared-mode") === "true" &&
      localStorage.getItem("pdf-editor-shared-permissions") === "editor"
    );
  }, []);

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
  const {
    handleShapeDrawStart,
    handleShapeDrawMove,
    handleShapeDrawEnd,
    cleanup: cleanupShapeDrawing,
  } = useShapeDrawingHandlers({
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

  // Cleanup shape drawing on unmount
  useEffect(() => {
    return () => {
      cleanupShapeDrawing();
    };
  }, [cleanupShapeDrawing]);

  // Delete selected elements - defined before useKeyboardHandlers to avoid initialization error
  const handleDeleteSelection = useCallback(() => {
    const { selectedElements } = editorState.multiSelection;

    if (selectedElements.length > 0) {
      console.log(
        "[PDFEditorContent] Deleting",
        selectedElements.length,
        "selected elements"
      );
      // Use the multi-delete handler for atomic undo/redo
      handleMultiDeleteWithUndo();
    }

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
    handleMultiDeleteWithUndo,
    setSelectedElementId,
    setSelectedElementType,
    setCurrentFormat,
    setIsDrawerOpen,
  ]);

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
    handleDeleteTextBoxWithUndo,
    handleDeleteShapeWithUndo,
    handleDeleteImageWithUndo,
    handleDeleteSelection,
    history,
    handleMultiSelectionMove,
    handleMultiSelectionMoveEnd,
    elementCollections,
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
          : undefined,
        documentState.pdfRenderScale
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
      let clickedView: "original" | "translated" | "final-layout" = "original";
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
          viewState.currentView === "translated"
            ? "translated"
            : viewState.currentView === "final-layout"
            ? "final-layout"
            : "original";
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
          : undefined,
        documentState.pdfRenderScale
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
          : undefined,
        documentState.pdfRenderScale
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
        } else if (targetView === "final-layout") {
          textBoxes = getCurrentTextBoxes("final-layout").filter(
            (tb) => tb.page === documentState.currentPage
          );
          shapes = getCurrentShapes("final-layout").filter(
            (s) => s.page === documentState.currentPage
          );
          images = getCurrentImages("final-layout").filter(
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

  // Smooth group dragging for multi-selection using transform offsets
  const selectionDragRafRef = useRef<number | null>(null);
  const selectionLastDeltaRef = useRef<{ x: number; y: number } | null>(null);
  const selectionBoundsStartRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const selectionDragElementsRef = useRef<HTMLElement[]>([]);

  const ensureSelectionDragInitialized = useCallback(() => {
    if (!editorState.multiSelection.isDragging) {
      // Initialize initial positions for all selected elements
      const initial: Record<string, { x: number; y: number }> = {};
      const domNodes: HTMLElement[] = [];
      editorState.multiSelection.selectedElements.forEach((el) => {
        const element = getElementById(el.id, el.type);
        if (element) {
          initial[el.id] = { x: element.x, y: element.y };
        }
        const node = document.querySelector(
          `[data-element-id="${el.id}"]`
        ) as HTMLElement | null;
        if (node) domNodes.push(node);
      });
      initialPositionsRef.current = initial;
      selectionDragElementsRef.current = domNodes;

      // Snapshot selection bounds at drag start for smooth rectangle movement
      selectionBoundsStartRef.current = editorState.multiSelection
        .selectionBounds
        ? { ...editorState.multiSelection.selectionBounds }
        : null;

      // Enter dragging state and reset offsets
      setEditorState((prev) => ({
        ...prev,
        multiSelection: {
          ...prev.multiSelection,
          isDragging: true,
          dragOffsets: {},
        },
      }));
    }
  }, [
    editorState.multiSelection.isDragging,
    editorState.multiSelection.selectedElements,
    getElementById,
    setEditorState,
  ]);

  const updateSelectionDragOffsets = useCallback(
    (deltaX: number, deltaY: number) => {
      ensureSelectionDragInitialized();

      if (selectionDragRafRef.current) {
        selectionLastDeltaRef.current = { x: deltaX, y: deltaY };
        return;
      }

      selectionLastDeltaRef.current = { x: deltaX, y: deltaY };
      selectionDragRafRef.current = requestAnimationFrame(() => {
        selectionDragRafRef.current = null;
        const currentDelta = selectionLastDeltaRef.current;
        if (!currentDelta) return;

        // Clamp delta based on selection bounds instead of per-element constraints
        const startBounds = selectionBoundsStartRef.current;
        let clampedDeltaX = currentDelta.x;
        let clampedDeltaY = currentDelta.y;
        if (startBounds) {
          const proposedX = startBounds.x + currentDelta.x;
          const proposedY = startBounds.y + currentDelta.y;
          const clampedX = Math.max(
            0,
            Math.min(proposedX, documentState.pageWidth - startBounds.width)
          );
          const clampedY = Math.max(
            0,
            Math.min(proposedY, documentState.pageHeight - startBounds.height)
          );
          clampedDeltaX = clampedX - startBounds.x;
          clampedDeltaY = clampedY - startBounds.y;
        }

        // Imperatively set CSS variables to avoid React re-renders during drag
        const pxX = `${clampedDeltaX * documentState.scale}px`;
        const pxY = `${clampedDeltaY * documentState.scale}px`;
        const nodes = selectionDragElementsRef.current;
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i];
          node.style.setProperty("--drag-offset-x", pxX);
          node.style.setProperty("--drag-offset-y", pxY);
        }
      });
    },
    [
      documentState.pageWidth,
      documentState.pageHeight,
      editorState.multiSelection.selectedElements,
      ensureSelectionDragInitialized,
      documentState.scale,
    ]
  );

  const commitSelectionDrag = useCallback(
    (finalDeltaX: number, finalDeltaY: number) => {
      if (selectionDragRafRef.current) {
        cancelAnimationFrame(selectionDragRafRef.current);
        selectionDragRafRef.current = null;
      }

      // Build a single grouped move command so undo/redo is atomic
      const moves = {
        textBoxes: [] as {
          id: string;
          before: { x: number; y: number };
          after: { x: number; y: number };
        }[],
        shapes: [] as {
          id: string;
          before: { x: number; y: number };
          after: { x: number; y: number };
        }[],
        images: [] as {
          id: string;
          before: { x: number; y: number };
          after: { x: number; y: number };
        }[],
      };

      editorState.multiSelection.selectedElements.forEach((el) => {
        const initialPos = initialPositionsRef.current[el.id];
        if (!initialPos) return;
        const element = getElementById(el.id, el.type);
        if (!element) return;

        const newX = initialPos.x + finalDeltaX;
        const newY = initialPos.y + finalDeltaY;

        const constrainedX = Math.max(
          0,
          Math.min(newX, documentState.pageWidth - element.width)
        );
        const constrainedY = Math.max(
          0,
          Math.min(newY, documentState.pageHeight - element.height)
        );

        const record = {
          id: el.id,
          before: { x: initialPos.x, y: initialPos.y },
          after: { x: constrainedX, y: constrainedY },
        };

        if (el.type === "textbox") {
          moves.textBoxes.push(record);
        } else if (el.type === "shape") {
          moves.shapes.push(record);
        } else if (el.type === "image") {
          moves.images.push(record);
        }
      });

      if (
        moves.textBoxes.length + moves.shapes.length + moves.images.length >
        0
      ) {
        const cmd = new MultiMoveCommand(
          updateTextBox,
          updateShape,
          updateImage,
          moves
        );
        history.executeCommand(cmd);
      }

      // Compute final moved selection bounds based on the snapshot at drag start
      let movedBounds = null as null | {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      const startBounds = selectionBoundsStartRef.current;
      if (startBounds) {
        const proposedX = startBounds.x + finalDeltaX;
        const proposedY = startBounds.y + finalDeltaY;
        const clampedX = Math.max(
          0,
          Math.min(proposedX, documentState.pageWidth - startBounds.width)
        );
        const clampedY = Math.max(
          0,
          Math.min(proposedY, documentState.pageHeight - startBounds.height)
        );
        movedBounds = {
          x: clampedX,
          y: clampedY,
          width: startBounds.width,
          height: startBounds.height,
        };
      }

      // Clear drag state and update selection metadata
      setEditorState((prev) => {
        const updatedElements = prev.multiSelection.selectedElements.map(
          (el) => ({
            ...el,
            originalPosition: {
              x: el.originalPosition.x + finalDeltaX,
              y: el.originalPosition.y + finalDeltaY,
            },
          })
        );

        return {
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            selectedElements: updatedElements,
            selectionBounds: movedBounds || prev.multiSelection.selectionBounds,
            isDragging: false,
            isMovingSelection: false,
            moveStart: null,
          },
        };
      });

      // Reset initial positions cache
      initialPositionsRef.current = {};
      selectionLastDeltaRef.current = null;
      selectionBoundsStartRef.current = null;

      // Clear CSS variables set during drag
      const nodes = selectionDragElementsRef.current;
      for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        el.style.removeProperty("--drag-offset-x");
        el.style.removeProperty("--drag-offset-y");
      }
      selectionDragElementsRef.current = [];
    },
    [
      documentState.pageWidth,
      documentState.pageHeight,
      editorState.multiSelection.selectedElements,
      selectionBoundsStartRef.current,
      getElementById,
      setEditorState,
      updateImage,
      updateShape,
      updateTextBox,
      history,
    ]
  );

  // Handle drag stop for selection rectangle (commit positions)
  const handleDragStopSelection = useCallback(
    (deltaX: number, deltaY: number) => {
      commitSelectionDrag(deltaX, deltaY);
    },
    [commitSelectionDrag]
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
          : undefined,
        documentState.pdfRenderScale
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
          : undefined,
        documentState.pdfRenderScale
      );

      const deltaX = x - editorState.multiSelection.moveStart.x;
      const deltaY = y - editorState.multiSelection.moveStart.y;

      // Update transform-based offsets for smooth dragging
      updateSelectionDragOffsets(deltaX, deltaY);

      // Track latest delta for commit on mouse up
      selectionLastDeltaRef.current = { x: deltaX, y: deltaY };

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
      updateSelectionDragOffsets,
    ]
  );

  const handleMoveSelectionMouseUp = useCallback(() => {
    if (!editorState.multiSelection.isMovingSelection) return;

    // End any ongoing batch operations for multi-selection move
    if (history.isBatching()) {
      console.log("[PDFEditorContent] Ending batch for multi-selection move");
      history.endBatch();
    }

    // Commit final positions using last tracked delta
    const finalDelta = selectionLastDeltaRef.current || { x: 0, y: 0 };
    commitSelectionDrag(finalDelta.x, finalDelta.y);
  }, [editorState.multiSelection.isMovingSelection, history]);

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
          : undefined,
        documentState.pdfRenderScale
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
            dragOffsets: {},
            isDragging: false,
          },
        }));
        setSelectedElementId(fieldId);
        setSelectedElementType("textbox");
        setIsDrawerOpen(true);
        setAutoFocusTextBoxId(fieldId);
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
              dragOffsets: {},
              isDragging: false,
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
      finalLayoutLayerOrder: [],
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
        dragOffsets: {},
        isDragging: false,
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
        const pdfBlob = new Blob([new Uint8Array(pdfBytes)], {
          type: "application/pdf",
        });

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

        // Only proceed if the image was successfully uploaded to cloud storage
        if (!imageUploadResult.isSupabaseUrl) {
          toast.error(
            "Failed to upload image to cloud storage. Please try again."
          );
          return;
        }

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
        const oldUrl = documentState.url;

        // Add a new blank page (A4 size: 595.28 x 841.89 points)
        const newPage = currentPdfDoc.addPage([595.28, 841.89]);

        // Save the updated PDF as a new blob
        const updatedPdfBytes = await currentPdfDoc.save();
        const updatedBlob = new Blob([new Uint8Array(updatedPdfBytes)], {
          type: "application/pdf",
        });

        // Convert Blob to File object
        const updatedFile = new File([updatedBlob], "updated-document.pdf", {
          type: "application/pdf",
        });

        // Upload to Supabase or create blob URL
        const uploadResult = await uploadFileWithFallback(updatedFile);

        // Only proceed if the PDF was successfully uploaded to cloud storage
        if (!uploadResult.isSupabaseUrl) {
          toast.error(
            "Failed to upload updated document to cloud storage. Please try again."
          );
          return;
        }

        const newUrl = uploadResult.url;
        const newPageNumber = currentPdfDoc.getPageCount();

        // Clean up old blob URL if it's a blob URL (not Supabase URL)
        if (
          oldUrl &&
          oldUrl.startsWith("blob:") &&
          !uploadResult.isSupabaseUrl
        ) {
          URL.revokeObjectURL(oldUrl);
        }

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
          // Update metadata if uploaded to Supabase
          supabaseFilePath: uploadResult.filePath,
          isSupabaseUrl: uploadResult.isSupabaseUrl,
        }));

        // Calculate proper image dimensions and position
        const { x, y, width, height } = await calculateImageFitAndPosition(
          imageFile,
          documentState.pageWidth,
          documentState.pageHeight
        );

        // Upload image to Supabase or use blob URL as fallback
        const imageUploadResult = await uploadFileWithFallback(imageFile);

        // Only proceed if the image was successfully uploaded to cloud storage
        if (!imageUploadResult.isSupabaseUrl) {
          toast.error(
            "Failed to upload image to cloud storage. Please try again."
          );
          return;
        }

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
        const oldUrl = documentState.url;

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
        const mergedBlob = new Blob([new Uint8Array(mergedPdfBytes)], {
          type: "application/pdf",
        });

        // Convert Blob to File object
        const mergedFile = new File([mergedBlob], "merged-document.pdf", {
          type: "application/pdf",
        });

        // Upload merged PDF to Supabase or use blob URL as fallback
        const uploadResult = await uploadFileWithFallback(mergedFile);

        // Only proceed if the merged PDF was successfully uploaded to cloud storage
        if (!uploadResult.isSupabaseUrl) {
          toast.error(
            "Failed to upload merged document to cloud storage. Please try again."
          );
          return;
        }

        const newUrl = uploadResult.url;
        const totalPages = currentPdfDoc.getPageCount();
        const addedPagesCount = newPages.length;

        // Clean up old blob URL if it's a blob URL (not Supabase URL)
        if (
          oldUrl &&
          oldUrl.startsWith("blob:") &&
          !uploadResult.isSupabaseUrl
        ) {
          URL.revokeObjectURL(oldUrl);
        }

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
          // Update metadata if uploaded to Supabase
          supabaseFilePath: uploadResult.filePath,
          isSupabaseUrl: uploadResult.isSupabaseUrl,
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

          // Only proceed if the image was successfully uploaded to cloud storage
          if (!uploadResult.isSupabaseUrl) {
            toast.error(
              "Failed to upload image to cloud storage. Please try again."
            );
            return;
          }

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

      if (!documentState.url) {
        toast.error("Please upload a document first before appending.");
        return;
      }

      try {
        let fileToMerge: File | null = null;
        const isImage = file.type.startsWith("image/");
        const isDocx =
          file.type.includes("officedocument.wordprocessingml") ||
          file.name.toLowerCase().endsWith(".docx");
        const isPdf = file.type === "application/pdf";

        // 1) Normalize to A4 PDF
        if (isImage) {
          const { transformedFile } = await convertImageToA4Pdf(file);
          fileToMerge = transformedFile;
        } else if (isDocx) {
          const { transformedFile } = await convertDocxToA4Pdf(file);
          fileToMerge = transformedFile;
        } else if (isPdf) {
          const needsTransform = await needsA4Transformation(file);
          if (needsTransform) {
            const { transformedFile } = await transformPdfToA4Balanced(file);
            fileToMerge = transformedFile;
          } else {
            fileToMerge = file;
          }
        } else {
          toast.error("Unsupported file type for appending.");
          return;
        }

        // 2) Merge normalized A4 PDF into existing document
        if (fileToMerge) {
          await appendPdfDocument(fileToMerge);
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

      // Clear multi-selection when switching pages
      setEditorState((prev) => ({
        ...prev,
        multiSelection: {
          ...prev.multiSelection,
          selectedElements: [],
          selectionBounds: null,
          isDrawingSelection: false,
          selectionStart: null,
          selectionEnd: null,
          isMovingSelection: false,
          moveStart: null,
          dragOffsets: {},
          isDragging: false,
        },
      }));

      // Also clear single element selection state
      setSelectedElementId(null);
      setSelectedElementType(null);
      setCurrentFormat(null);
      setIsDrawerOpen(false);

      actions.changePage(page, isFinalLayout);
    },
    [
      actions,
      viewState.currentView,
      documentState,
      setSelectedElementId,
      setSelectedElementType,
      setCurrentFormat,
      setIsDrawerOpen,
    ]
  );

  const handlePageDelete = useCallback(
    (pageNumber: number) => {
      const isFinalLayout = viewState.currentView === "final-layout";
      pageActions.deletePage(pageNumber, isFinalLayout);
    },
    [pageActions, viewState.currentView]
  );

  // Transform page to textbox functionality - will be defined after useProjectState hook

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

  // Project management with enhanced save/load functionality
  const {
    saveProject: saveProjectToStorage,
    loadProject,
    exportToJson,
    importFromJson,
    getSavedProjects,
    deleteProject,
    setCurrentProjectId,
    currentProjectId,
    currentProjectName,
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
    finalLayoutSettings,
    setFinalLayoutSettings,
    documentActions: {
      loadDocumentFromUrl: actions.loadDocumentFromUrl,
      loadFinalLayoutFromUrl: actions.loadFinalLayoutFromUrl,
    },
  });

  // Shared project persistence for editor mode (works independently)
  const sharedProjectPersistence = useSharedProjectPersistence({
    documentState,
    elementCollections,
    layerState,
    viewState,
    editorState,
    sourceLanguage,
    desiredLanguage,
    finalLayoutSettings,
    setDocumentState,
    setElementCollections,
    setLayerState,
    setViewState,
    setEditorState,
    setSourceLanguage,
    setDesiredLanguage,
    setFinalLayoutSettings,
    documentActions: {
      loadDocumentFromUrl: actions.loadDocumentFromUrl,
      loadFinalLayoutFromUrl: actions.loadFinalLayoutFromUrl,
    },
  });

  // Use shared editor save/load if in shared mode, otherwise use regular ones
  const isSharedMode = isInSharedMode();
  console.log(
    "PDFEditorContent: Using",
    isSharedMode ? "shared editor" : "regular",
    "save/load functions"
  );

  const actualSaveProject = isSharedMode
    ? sharedProjectPersistence.saveProject
    : saveProjectToStorage;

  const actualLoadProject = isSharedMode
    ? sharedProjectPersistence.loadProject
    : loadProject;

  // Auto-load project when projectId prop is provided
  useEffect(() => {
    if (projectId && !currentProjectId) {
      console.log("Auto-loading project with ID:", projectId);
      (async () => {
        try {
          const success = await actualLoadProject(projectId);
          if (success) {
            markAsSaved();
          }
        } catch (e) {
          console.error("Auto-load failed:", e);
        }
      })();
    }
  }, [projectId, currentProjectId, actualLoadProject, markAsSaved]);

  // Auto-load shared project from localStorage (run only once on mount)
  useLayoutEffect(() => {
    // Check if we're in shared mode
    const isSharedMode =
      localStorage.getItem("pdf-editor-shared-mode") === "true";
    const sharedPermissions = localStorage.getItem(
      "pdf-editor-shared-permissions"
    );
    const sharedProjectId = localStorage.getItem(
      "pdf-editor-shared-project-id"
    );

    console.log("PDFEditorContent auto-load check:", {
      isSharedMode,
      sharedPermissions,
      sharedProjectId,
      projectId,
      isEditor: sharedPermissions === "editor",
    });

    // For editor mode, load the current state from database
    if (
      isSharedMode &&
      sharedPermissions === "editor" &&
      sharedProjectId &&
      !projectId
    ) {
      console.log(
        "Editor mode: Loading current project state from database:",
        sharedProjectId
      );

      // Use setTimeout to ensure this happens after render
      setTimeout(() => {
        actualLoadProject(sharedProjectId)
          .then((success) => {
            if (success) {
              console.log(
                "Successfully loaded project from database for editor"
              );
              markAsSaved();
            } else {
              console.error("Failed to load project from database for editor");
            }
          })
          .catch((error) => {
            console.error(
              "Error loading project from database for editor:",
              error
            );
          });
      }, 0);
    }
    // For viewer mode, load from localStorage as before
    else if (isSharedMode && sharedPermissions === "viewer") {
      const currentProjectKey = localStorage.getItem(
        "pdf-editor-current-project"
      );
      if (currentProjectKey && !projectId) {
        console.log(
          "Viewer mode: Auto-loading shared project from localStorage:",
          currentProjectKey
        );

        setTimeout(() => {
          actualLoadProject()
            .then((success) => {
              if (success) {
                console.log("Successfully loaded shared project for viewer");
                markAsSaved();
              } else {
                console.error("Failed to load shared project for viewer");
              }
            })
            .catch((error) => {
              console.error("Error loading shared project for viewer:", error);
            });
        }, 0);
      }
    }
  }, []); // Empty dependency array to run only once

  // Editor now uses the same save functionality as owner

  // Handle manual project loading from modal
  const handleManualProjectLoad = useCallback(
    async (projectId?: string): Promise<boolean> => {
      if (!projectId) {
        console.error("No project ID provided");
        return false;
      }

      try {
        console.log("Manually loading project with ID:", projectId);
        const success = await actualLoadProject(projectId);
        return success;
      } catch (error) {
        console.error("Failed to manually load project:", error);
        return false;
      }
    },
    [actualLoadProject]
  );

  // Keep backward compatibility for existing save project calls
  const saveProject = useCallback(
    async (projectName?: string) => {
      // Add a small delay to ensure all state updates are synchronized
      // This fixes the issue where manual saves don't persist but auto-saves do
      await new Promise((resolve) => setTimeout(resolve, 100));
      const result = await actualSaveProject(projectName);
      if (result) {
        markAsSaved();
        // Notify about successful save
        localStorage.setItem("pdf-editor-last-saved", new Date().toISOString());
      }
      return result;
    },
    [actualSaveProject, markAsSaved]
  );

  // Handle share project
  const handleShareProject = useCallback(async () => {
    if (!currentProjectId) {
      toast.error("Please save the project first before sharing");
      return;
    }

    try {
      // Get current share settings
      const shareSettings = await getProjectShareSettings(currentProjectId);
      setCurrentShareSettings({
        isPublic: shareSettings.is_public,
        shareLink: shareSettings.share_link || "",
        shareId: shareSettings.share_id,
        permissions: shareSettings.share_permissions || "viewer",
        requiresAuth: shareSettings.requires_auth,
      });
      setShowShareModal(true);
    } catch (error) {
      console.error("Error fetching share settings:", error);
      // Open modal with default settings
      setCurrentShareSettings({
        isPublic: false,
        shareLink: "",
        permissions: "viewer",
        requiresAuth: false,
      });
      setShowShareModal(true);
    }
  }, [currentProjectId]);

  // Editor uses the exact same saveProject function as owner - no wrapper needed

  const handleEditorShare = useCallback(() => {
    if (!isEditorMode()) return handleShareProject();

    // For editors, just copy the share link
    const shareId = localStorage.getItem("pdf-editor-share-id");
    if (shareId) {
      const shareLink = `${window.location.origin}/pdf-editor/shared/${shareId}`;
      navigator.clipboard.writeText(shareLink);
      toast.success("Share link copied to clipboard!");
    } else {
      toast.error("Share ID not found");
    }
  }, [isEditorMode, handleShareProject]);

  // Handle updating share settings
  const handleUpdateShareSettings = useCallback(
    async (settings: ShareSettings) => {
      if (!currentProjectId) {
        throw new Error("No project ID available");
      }

      await updateProjectShareSettings(currentProjectId, {
        is_public: settings.isPublic,
        share_id: settings.shareId,
        share_permissions: settings.permissions,
        requires_auth: settings.requiresAuth,
      });

      setCurrentShareSettings(settings);
    },
    [currentProjectId]
  );

  // Enhanced file upload handler with A4 transformation pipeline (mirrors dashboard upload)
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsUploadingFile(true);
      let finalFile = file;

      try {
        // Clear all elements and state when uploading a new document
        clearAllElementsAndState();

        // Apply same A4 transformation pipeline used in dashboard page
        if (file.type.startsWith("image/")) {
          const result = await convertImageToA4Pdf(file, () => {});
          finalFile = result.transformedFile;
        } else if (
          file.type.includes("officedocument.wordprocessingml") ||
          file.name.toLowerCase().endsWith(".docx")
        ) {
          const result = await convertDocxToA4Pdf(file, () => {});
          finalFile = result.transformedFile;
        } else if (file.type === "application/pdf") {
          const needsTransform = await needsA4Transformation(file);
          if (needsTransform) {
            const result = await transformPdfToA4Balanced(file, () => {});
            finalFile = result.transformedFile;
          }
        }

        // Load transformed (or original) document
        actions.loadDocument(finalFile);
        setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));

        if (!isUserAuthenticated) {
          toast.info("Sign in to automatically save your projects!", {
            description:
              "You can still work on your document, but it won't be saved to your account. Click here to sign in.",
            duration: 5000,
            action: {
              label: "Sign In",
              onClick: () => {
                window.location.href = "/auth/login";
              },
            },
          });
        }
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error("Failed to upload file");
        setIsUploadingFile(false);
      }
      // setIsUploadingFile(false) is handled after document load effect
    },
    [actions, clearAllElementsAndState, isUserAuthenticated, setViewState]
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
    // Create view-aware layer management functions
    const createLayerFunction = (fn: Function, defaultView?: ViewMode) => {
      return (id: string, targetView?: ViewMode) => {
        // Determine which view to use for layer management
        let effectiveView: ViewMode;
        if (targetView) {
          effectiveView = targetView;
        } else if (viewState.currentView === "split") {
          // In split view, we need to determine which side the element belongs to
          // Check if the element exists in original or translated collections
          const isInOriginal =
            elementCollections.originalTextBoxes.some((tb) => tb.id === id) ||
            elementCollections.originalShapes.some(
              (shape) => shape.id === id
            ) ||
            elementCollections.originalImages.some((img) => img.id === id);

          const isInTranslated =
            elementCollections.translatedTextBoxes.some((tb) => tb.id === id) ||
            elementCollections.translatedShapes.some(
              (shape) => shape.id === id
            ) ||
            elementCollections.translatedImages.some((img) => img.id === id);

          if (isInOriginal) {
            effectiveView = "original";
          } else if (isInTranslated) {
            effectiveView = "translated";
          } else {
            effectiveView = defaultView || "original";
          }
        } else {
          effectiveView = viewState.currentView;
        }

        fn(id, effectiveView);
      };
    };

    setLayerOrderFunctions({
      moveToFront: createLayerFunction(moveToFront, "original"),
      moveToBack: createLayerFunction(moveToBack, "original"),
      moveForward: createLayerFunction(moveForward, "original"),
      moveBackward: createLayerFunction(moveBackward, "original"),
    });
  }, [
    moveToFront,
    moveToBack,
    moveForward,
    moveBackward,
    viewState.currentView,
    elementCollections,
    setLayerOrderFunctions,
  ]);

  useEffect(() => {
    // Create view-aware layer position helper functions
    const createLayerPositionHelper = (
      fn: Function,
      defaultView?: ViewMode
    ) => {
      return (id: string, targetView?: ViewMode) => {
        // Determine which view to use for layer position checking
        let effectiveView: ViewMode;
        if (targetView) {
          effectiveView = targetView;
        } else if (viewState.currentView === "split") {
          // In split view, we need to determine which side the element belongs to
          const isInOriginal =
            elementCollections.originalTextBoxes.some((tb) => tb.id === id) ||
            elementCollections.originalShapes.some(
              (shape) => shape.id === id
            ) ||
            elementCollections.originalImages.some((img) => img.id === id);

          const isInTranslated =
            elementCollections.translatedTextBoxes.some((tb) => tb.id === id) ||
            elementCollections.translatedShapes.some(
              (shape) => shape.id === id
            ) ||
            elementCollections.translatedImages.some((img) => img.id === id);

          if (isInOriginal) {
            effectiveView = "original";
          } else if (isInTranslated) {
            effectiveView = "translated";
          } else {
            effectiveView = defaultView || "original";
          }
        } else {
          effectiveView = viewState.currentView;
        }

        return fn(id, effectiveView);
      };
    };

    setLayerPositionHelpers({
      isElementAtFront: createLayerPositionHelper(isElementAtFront, "original"),
      isElementAtBack: createLayerPositionHelper(isElementAtBack, "original"),
    });
  }, [
    isElementAtFront,
    isElementAtBack,
    viewState.currentView,
    elementCollections,
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
      // Stop file upload loading state when document is fully loaded
      setIsUploadingFile(false);

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

  // Cleanup effect for blob URLs
  useEffect(() => {
    return () => {
      // Cleanup main document blob URL on unmount
      if (
        documentState.url &&
        documentState.url.startsWith("blob:") &&
        !documentState.isSupabaseUrl
      ) {
        URL.revokeObjectURL(documentState.url);
      }
      // Cleanup final layout blob URL on unmount
      if (
        documentState.finalLayoutUrl &&
        documentState.finalLayoutUrl.startsWith("blob:")
      ) {
        URL.revokeObjectURL(documentState.finalLayoutUrl);
      }
    };
  }, [
    documentState.url,
    documentState.finalLayoutUrl,
    documentState.isSupabaseUrl,
  ]);

  // Project creation is now handled manually in handleFileUpload

  // Clear upload loading state on document error
  useEffect(() => {
    if (documentState.error) {
      setIsUploadingFile(false);
    }
  }, [documentState.error]);

  // Cleanup effect to clear any remaining debounce timers and classes
  useEffect(() => {
    // Handle window blur to cleanup resizing state
    const handleWindowBlur = () => {
      document.body.classList.remove("resizing-element");
    };

    window.addEventListener("blur", handleWindowBlur);

    return () => {
      // Clear all debounce timers on unmount
      Object.values(debounceTimersRef.current).forEach((timer) => {
        clearTimeout(timer);
      });
      debounceTimersRef.current = {};
      ongoingOperationsRef.current = {};

      // Ensure resizing class is removed on unmount
      document.body.classList.remove("resizing-element");

      // Remove event listener
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  // Render elements with view-specific update functions
  const renderElement = (element: SortedElement, targetView: ViewMode) => {
    // For split view, we need to determine which view this element belongs to
    // In split view, targetView will be "original" or "translated" when called correctly
    const actualTargetView = targetView;

    // Calculate effective scale for translated view in split screen
    const effectiveScale =
      targetView === "translated" &&
      viewState.currentView === "split" &&
      getTranslatedTemplateScaleFactor(documentState.currentPage)
        ? documentState.scale *
          getTranslatedTemplateScaleFactor(documentState.currentPage)
        : documentState.scale;

    // Get elements that would be captured in the current selection preview
    // Optimize: avoid recomputing preview set while user is drawing the selection
    const elementsInSelectionPreview = editorState.multiSelection
      .isDrawingSelection
      ? new Set<string>()
      : getElementsInSelectionPreview();

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
          // Transform-based drag offset for performance
          dragOffset={
            editorState.multiSelection.isDragging
              ? editorState.multiSelection.dragOffsets[textBox.id] || null
              : null
          }
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
          onDelete={(id) => handleDeleteShapeWithUndo(id, actualTargetView)}
          // Selection preview prop
          isInSelectionPreview={isInSelectionPreview}
          // Transform-based drag offset for performance
          dragOffset={
            editorState.multiSelection.isDragging
              ? editorState.multiSelection.dragOffsets[shape.id] || null
              : null
          }
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
          onDelete={(id) => handleDeleteImageWithUndo(id, actualTargetView)}
          // Selection preview prop
          isInSelectionPreview={isInSelectionPreview}
          // Transform-based drag offset for performance
          dragOffset={
            editorState.multiSelection.isDragging
              ? editorState.multiSelection.dragOffsets[image.id] || null
              : null
          }
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

    // Create a persistent loading toast that will be updated
    const loadingToastId = toast.loading(
      "Starting bulk page transformation...",
      {
        duration: Infinity, // Keep it open until we dismiss it
        style: {
          background: "white",
          color: "#374151",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "16px",
          fontSize: "14px",
          fontWeight: "500",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
        },
        action: {
          label: "✕",
          onClick: () => {
            bulkOcrCancelRef.current.cancelled = true;
            handleCancelBulkOcr();
          },
        },
      }
    );

    try {
      // Create complete project data for bulk OCR template detection
      const completeProjectData = {
        totalPages: documentState.numPages,
        sourceLanguage: sourceLanguage || "auto",
        desiredLanguage: desiredLanguage || "en",
        timestamp: new Date().toISOString(),
        // Include the complete document state with pages
        documentState: {
          ...documentState,
          pages: documentState.pages,
        },
      };

      // Log the complete project data being sent for bulk OCR
      console.log(
        "🔍 [FRONTEND BULK OCR DEBUG] Complete project data being sent:",
        completeProjectData
      );
      console.log(
        "🔍 [FRONTEND BULK OCR DEBUG] Document state pages:",
        documentState.pages
      );

      const result = await performBulkOcr({
        sourceLanguage,
        desiredLanguage,
        addTextBox,
        setElementCollections,
        setIsTranslating,
        totalPages: documentState.numPages,
        deletedPages: documentState.deletedPages,
        currentPage: documentState.currentPage,
        onProgress: (current, total) => {
          // Check if operation was cancelled
          if (bulkOcrCancelRef.current.cancelled) {
            toast.dismiss(loadingToastId);
            toast.info("🛑 Page transformation was cancelled", {
              duration: 3000,
            });
            return;
          }

          setBulkOcrProgress({ current, total });

          // Update the loading toast with progress information
          const percentage = Math.round((current / total) * 100);
          if (current === 1) {
            toast.loading(
              `🔄 Transforming pages... (${current}/${total}) - ${percentage}%`,
              {
                id: loadingToastId,
                style: {
                  background: "white",
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "16px",
                  fontSize: "14px",
                  fontWeight: "500",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                },
                action: {
                  label: "✕",
                  onClick: () => {
                    bulkOcrCancelRef.current.cancelled = true;
                    handleCancelBulkOcr();
                  },
                },
              }
            );
          } else if (current === total) {
            toast.loading(
              `🔄 Finalizing transformation... (${current}/${total}) - ${percentage}%`,
              {
                id: loadingToastId,
                style: {
                  background: "white",
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "16px",
                  fontSize: "14px",
                  fontWeight: "500",
                  boxShadow: "0 8px 32px rgba(0,0, 0, 0.12)",
                },
                action: {
                  label: "✕",
                  onClick: () => {
                    bulkOcrCancelRef.current.cancelled = true;
                    handleCancelBulkOcr();
                  },
                },
              }
            );
          } else {
            // Update every 3rd page to avoid too many updates
            if (current % 3 === 0 || current === total) {
              toast.loading(
                `🔄 Transforming pages... (${current}/${total}) - ${percentage}%`,
                {
                  id: loadingToastId,
                  style: {
                    background: "white",
                    color: "#374151",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "16px",
                    fontSize: "14px",
                    fontWeight: "500",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                  },
                  action: {
                    label: "✕",
                    onClick: () => {
                      bulkOcrCancelRef.current.cancelled = true;
                      handleCancelBulkOcr();
                    },
                  },
                }
              );
            }
          }
        },
        onPageChange: (page) => {
          actions.changePage(page);
        },
        cancelRef: bulkOcrCancelRef,
        addUntranslatedText,
        // Add required parameters for background OCR service
        projectId: currentProjectId || `bulk-ocr-${Date.now()}`,
        captureUrl: "http://localhost:3000/capture-project/", // Point to capture-project page
        ocrApiUrl: "http://localhost:8000/projects/process-file", // Direct call to backend
        // Add required project data for template detection
        projectData: completeProjectData,
      });

      // Dismiss the loading toast and show success
      toast.dismiss(loadingToastId);

      if (result.success) {
        toast.success(
          `🎉 ${
            result.message ||
            `Successfully processed ${result.processedPages} pages`
          }`,
          {
            duration: 5000,
            style: {
              background: "white",
              color: "#059669",
              border: "1px solid #10b981",
              borderRadius: "12px",
              padding: "16px",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
            },
          }
        );
      } else {
        toast.error(`❌ ${result.message || "Bulk OCR process failed"}`, {
          duration: 5000,
          style: {
            background: "white",
            color: "#dc2626",
            border: "1px solid #ef4444",
            borderRadius: "12px",
            padding: "16px",
            fontSize: "14px",
            fontWeight: "500",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
          },
        });
      }
    } catch (error) {
      console.error("Error in bulk OCR:", error);
      // Dismiss the loading toast and show error
      toast.dismiss(loadingToastId);
      toast.error("❌ Failed to complete bulk OCR process", {
        duration: 5000,
        style: {
          background: "white",
          color: "#dc2626",
          border: "1px solid #ef4444",
          borderRadius: "12px",
          padding: "16px",
          fontSize: "14px",
          fontWeight: "500",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
        },
      });
    } finally {
      // Check if operation was cancelled
      if (bulkOcrCancelRef.current.cancelled) {
        toast.dismiss(loadingToastId);
        toast.info("🛑 Page transformation cancelled", {
          duration: 3000,
        });
      }

      setIsBulkOcrRunning(false);
      setBulkOcrProgress(null);
    }
  }, [
    isBulkOcrRunning,
    documentState,
    pageActions,
    actions,
    sourceLanguage,
    desiredLanguage,
    addTextBox,
    setElementCollections,
    setIsTranslating,
    currentProjectId, // Add currentProjectId to dependencies
  ]);

  // Transform page to textbox functionality - defined after useProjectState hook
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
        const templateId = page?.template?.id;

        // Create complete project data for template detection
        const completeProjectData = {
          totalPages: documentState.numPages,
          sourceLanguage: sourceLanguage || "auto",
          desiredLanguage: desiredLanguage || "en",
          timestamp: new Date().toISOString(),
          // Include the complete document state with pages
          documentState: {
            ...documentState,
            pages: documentState.pages,
          },
        };

        // Log the complete project data being sent
        console.log(
          "🔍 [FRONTEND DEBUG] Complete project data being sent:",
          completeProjectData
        );
        console.log(
          "🔍 [FRONTEND DEBUG] Document state pages:",
          documentState.pages
        );
        console.log("🔍 [FRONTEND DEBUG] Page type:", pageType);
        console.log("🔍 [FRONTEND DEBUG] Template ID:", templateId);

        await performPageOcr({
          pageNumber,
          sourceLanguage,
          desiredLanguage,
          projectId: currentProjectId || undefined, // Handle null case
          setIsTranslating,
          addTextBox,
          setElementCollections,
          addUntranslatedText,
          pageType,
          templateId: templateId,
          projectData: completeProjectData, // Pass complete project data
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
      addTextBox,
      setElementCollections,
      setIsTranslating,
      currentProjectId, // Add currentProjectId to dependencies
    ]
  );

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
  const handleCancelBulkOcr = useCallback(async () => {
    bulkOcrCancelRef.current.cancelled = true;
    setIsBulkOcrRunning(false);

    // Show cancellation toast with loading state
    toast.loading("🛑 Cancelling page transformation...", {
      duration: 2000,
      style: {
        background: "white",
        color: "#374151",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "16px",
        fontSize: "14px",
        fontWeight: "500",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
      },
    });

    // Also abort the Puppeteer operation if we have a project ID
    if (currentProjectId) {
      try {
        const abortResult = await abortOcrOperation(currentProjectId);
        if (abortResult.success) {
          toast.success("✅ Page transformation cancelled successfully", {
            duration: 4000,
            style: {
              background: "white",
              color: "#059669",
              border: "1px solid #10b981",
              borderRadius: "12px",
              padding: "16px",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
            },
          });
        } else {
          console.warn(
            "Failed to abort Puppeteer operation:",
            abortResult.error
          );
          toast.error("❌ Failed to cancel page transformation", {
            duration: 4000,
            style: {
              background: "white",
              color: "#dc2626",
              border: "1px solid #ef4444",
              borderRadius: "12px",
              padding: "16px",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
            },
          });
        }
      } catch (error) {
        console.error("Error aborting Puppeteer operation:", error);
        toast.error("❌ Error occurred while cancelling", {
          duration: 4000,
          style: {
            background: "white",
            color: "#dc2626",
            border: "1px solid #ef4444",
            borderRadius: "12px",
            padding: "16px",
            fontSize: "14px",
            fontWeight: "500",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
          },
        });
      }
    }
  }, [currentProjectId]);

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
  const [birthCertModalPage, setBirthCertModalPage] = useState<number>(1);

  // Add state for NBI clearance modal
  const [showNBIClearanceModal, setShowNBIClearanceModal] = useState(false);
  const [nbiClearanceModalPage, setNBIClearanceModalPage] = useState<number>(1);

  // Add state for apostille modal
  const [showApostilleModal, setShowApostilleModal] = useState(false);
  const [apostilleModalPage, setApostilleModalPage] = useState<number>(1);

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
      pageType:
        | "social_media"
        | "birth_cert"
        | "nbi_clearance"
        | "apostille"
        | "dynamic_content"
    ) => {
      setDocumentState((prev) => ({
        ...prev,
        pages: prev.pages.map((page) => {
          if (page.pageNumber !== pageNumber) return page;

          // When page type changes, update template-related fields to reflect the new type
          // We reset/remove any previously selected template so the UI can prompt/select appropriately
          return {
            ...page,
            pageType,
            template: null,
            templateType: undefined,
            translatedTemplateURL: undefined,
            translatedTemplateWidth: undefined,
            translatedTemplateHeight: undefined,
          };
        }),
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

  // NBI clearance modal handler
  const handleNBIClearanceModalOpen = useCallback(
    (pageNumber?: number) => {
      setNBIClearanceModalPage(pageNumber || documentState.currentPage);
      setShowNBIClearanceModal(true);
    },
    [documentState.currentPage]
  );

  // Apostille modal handler
  const handleApostilleModalOpen = useCallback(
    (pageNumber?: number) => {
      setApostilleModalPage(pageNumber || documentState.currentPage);
      setShowApostilleModal(true);
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

  // Handle project creation and document loading after upload
  // Project creation and document loading is now handled directly in handleFileUpload

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

  // Add state for file upload loading
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Add state for project management modal
  const [showProjectModal, setShowProjectModal] = useState(false);

  // Add state for share project modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentShareSettings, setCurrentShareSettings] =
    useState<ShareSettings>();

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
        onFileUpload={handleFileUploadIntercept}
        onSaveProject={saveProject}
        hasUnsavedChanges={hasUnsavedChanges}
        onProjectManagement={() => setShowProjectModal(true)}
        onShareProject={handleEditorShare}
        onExportData={permissions.canExportProject() ? exportToPDF : () => {}}
        onUndo={() => {
          const now = Date.now();
          if (now - lastUndoTime < UNDO_REDO_DEBOUNCE_MS) {
            return;
          }

          if (history.canUndo()) {
            history.undo();
            setLastUndoTime(now);
            toast.success("Undo");
          }
        }}
        onRedo={() => {
          const now = Date.now();
          if (now - lastRedoTime < UNDO_REDO_DEBOUNCE_MS) {
            return;
          }

          if (history.canRedo()) {
            history.redo();
            setLastRedoTime(now);
            toast.success("Redo");
          }
        }}
        canUndo={history.canUndo()}
        canRedo={history.canRedo()}
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
        onRecreateFinalLayout={createFinalLayoutWithSnapshots}
        isCapturingSnapshots={isCapturingSnapshots}
        projectName={currentProjectName}
        onBackToDashboard={() => router.push("/pdf-editor")}
        hasFinalLayout={!!documentState.finalLayoutUrl}
        onStartTutorial={() => {
          if (viewState.currentWorkflowStep === "translate") {
            startTour();
          } else if (viewState.currentWorkflowStep === "layout") {
            layoutTour.startTour();
          }
        }}
      />

      {/* Bulk OCR Loading Indicator */}
      {isBulkOcrRunning && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 animate-spin text-blue-600"
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
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative bg-white">
        {/* Floating Hamburger Menu Button */}
        <Button
          onClick={() =>
            setViewState((prev) => ({
              ...prev,
              isSidebarCollapsed: !prev.isSidebarCollapsed,
            }))
          }
          variant="outline"
          size="sm"
          className="fixed top-24 left-4 z-50 bg-white shadow-lg border-primary/20 text-primary hover:text-primaryLight hover:bg-primary/10 transition-colors w-10 h-10 p-0"
          title={viewState.isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        >
          <Menu className="w-4 h-4" />
        </Button>

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
          onNBIClearanceModalOpen={handleNBIClearanceModalOpen}
          onApostilleModalOpen={handleApostilleModalOpen}
          onResetTour={resetTour}
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

            {/* Viewer View Switcher - Only show for viewers */}
            {documentState.url &&
              !documentState.error &&
              !permissions.canEditContent() && (
                <ViewerViewSwitcher
                  currentView={viewState.currentView}
                  onViewChange={(view) => {
                    setViewState((prev) => ({
                      ...prev,
                      currentView: view,
                    }));
                  }}
                />
              )}

            {/* Viewer Translation Table - Only show for viewers in translate step */}
            {documentState.url &&
              !documentState.error &&
              !permissions.canEditContent() &&
              viewState.currentWorkflowStep === "translate" &&
              elementCollections.translatedTextBoxes &&
              elementCollections.translatedTextBoxes.length > 0 && (
                <ViewerTranslationTable
                  translatedTextBoxes={elementCollections.translatedTextBoxes}
                  untranslatedTexts={elementCollections.untranslatedTexts || []}
                  currentPage={documentState.currentPage}
                  sourceLanguage={sourceLanguage}
                  desiredLanguage={desiredLanguage}
                />
              )}

            {/* Floating Toolbars - Only show when PDF is loaded and user has tool access */}
            {documentState.url &&
              !documentState.error &&
              permissions.shouldShowToolbar() && (
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
                    setViewState((prev) => ({ ...prev, currentView: view }));
                  }}
                  onEditModeToggle={() => {
                    setEditorState((prev) => {
                      const newEditMode = !prev.isEditMode;
                      // Clear all modes and selections when turning off edit mode
                      if (!newEditMode) {
                        clearSelectionState();

                        // Clear all tool states
                        setToolState((toolPrev) => ({
                          ...toolPrev,
                          shapeDrawingMode: null,
                          isDrawingShape: false,
                          shapeDrawStart: null,
                          shapeDrawEnd: null,
                          isDrawingInProgress: false,
                          shapeDrawTargetView: null,
                        }));

                        // Clear erasure state
                        setErasureState((erasurePrev) => ({
                          ...erasurePrev,
                          isErasureMode: false,
                          isDrawingErasure: false,
                          erasureDrawStart: null,
                          erasureDrawEnd: null,
                          erasureDrawTargetView: null,
                        }));

                        return {
                          ...prev,
                          isEditMode: newEditMode,
                          isAddTextBoxMode: false,
                          isTextSelectionMode: false,
                          isImageUploadMode: false,
                          isSelectionMode: false,
                        };
                      }

                      return {
                        ...prev,
                        isEditMode: newEditMode,
                      };
                    });
                  }}
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
                  showFinalLayoutSettings={showFinalLayoutSettings}
                  onToggleFinalLayoutSettings={() => {
                    setShowFinalLayoutSettings((prev) => {
                      return !prev;
                    });
                  }}
                  onErasureStateChange={setErasureState}
                  documentState={documentState}
                  onPdfBackgroundColorChange={actions.updatePdfBackgroundColor}
                />
              )}

            {/* Document Viewer */}
            <div
              id="document-viewer"
              className="flex-1 document-viewer document-container"
              ref={containerRef}
              style={{
                scrollBehavior: documentState.isScaleChanging
                  ? "auto"
                  : "smooth",
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
                          className="w-12 h-12 text-primary animate-spin"
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
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                      Loading Project
                    </h2>

                    {/* Description */}
                    <p className="text-gray-600 leading-relaxed">
                      {projectId
                        ? "Loading your project and document content..."
                        : "Preparing the PDF editor..."}
                    </p>
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
                        editorState.multiSelection.isMovingSelection ||
                        toolState.shapeDrawingMode
                      ) {
                        if (editorState.multiSelection.isMovingSelection) {
                          handleMoveSelectionMouseDown(e);
                        } else if (editorState.isSelectionMode) {
                          handleMultiSelectionMouseDown(e);
                        } else if (toolState.shapeDrawingMode) {
                          handleShapeDrawStart(e);
                        } else {
                          handleDocumentMouseDown(e);
                        }
                      }
                    }}
                    onMouseMove={(e) => {
                      if (
                        toolState.shapeDrawingMode &&
                        toolState.isDrawingShape
                      ) {
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
                      if (
                        toolState.shapeDrawingMode &&
                        toolState.isDrawingShape
                      ) {
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
                        pdfRenderScale={documentState.pdfRenderScale}
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
                          updateSelectionDragOffsets(deltaX, deltaY);
                          selectionLastDeltaRef.current = {
                            x: deltaX,
                            y: deltaY,
                          };
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
                          pdfRenderScale={documentState.pdfRenderScale}
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
                            updateSelectionDragOffsets(deltaX, deltaY);
                            selectionLastDeltaRef.current = {
                              x: deltaX,
                              y: deltaY,
                            };
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
                            pdfRenderScale={documentState.pdfRenderScale}
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
                              updateSelectionDragOffsets(deltaX, deltaY);
                              selectionLastDeltaRef.current = {
                                x: deltaX,
                                y: deltaY,
                              };
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
                            documentState.pageWidth * documentState.scale + 20, // Double width plus gap
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
                            pdfRenderScale={documentState.pdfRenderScale}
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
                                    updateSelectionDragOffsets(deltaX, deltaY);
                                    selectionLastDeltaRef.current = {
                                      x: deltaX,
                                      y: deltaY,
                                    };
                                  }}
                                  onDragStopSelection={handleDragStopSelection}
                                />
                              )}
                          </div>
                        </div>

                        {/* Gap between documents */}
                        <div className="shrink-0 w-5 flex items-center justify-center">
                          <div className="w-px h-full bg-grey-300"></div>
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
                              pdfRenderScale={documentState.pdfRenderScale}
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
                                updateSelectionDragOffsets(deltaX, deltaY);
                                selectionLastDeltaRef.current = {
                                  x: deltaX,
                                  y: deltaY,
                                };
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
                                      updateSelectionDragOffsets(
                                        deltaX,
                                        deltaY
                                      );
                                      selectionLastDeltaRef.current = {
                                        x: deltaX,
                                        y: deltaY,
                                      };
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
                                    updateSelectionDragOffsets(deltaX, deltaY);
                                    selectionLastDeltaRef.current = {
                                      x: deltaX,
                                      y: deltaY,
                                    };
                                  }}
                                  onDragStopSelection={handleDragStopSelection}
                                />
                              )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Shape Drawing Preview - Optimized Canvas-based Component */}
                    {toolState.isDrawingShape &&
                      toolState.shapeDrawStart &&
                      toolState.shapeDrawEnd && (
                        <ShapePreview
                          key={`${toolState.shapeDrawStart.x}-${toolState.shapeDrawStart.y}-${toolState.shapeDrawEnd.x}-${toolState.shapeDrawEnd.y}`}
                          isDrawing={toolState.isDrawingShape}
                          shapeType={toolState.shapeDrawingMode}
                          startCoords={toolState.shapeDrawStart}
                          endCoords={toolState.shapeDrawEnd}
                          targetView={toolState.shapeDrawTargetView}
                          currentView={viewState.currentView}
                          pageWidth={documentState.pageWidth}
                          scale={documentState.scale}
                          templateScaleFactor={
                            toolState.shapeDrawTargetView === "translated"
                              ? getTranslatedTemplateScaleFactor?.(
                                  documentState.currentPage
                                )
                              : undefined
                          }
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
          {((viewState.currentView === "split" &&
            (viewState.currentWorkflowStep === "translate" ||
              viewState.currentWorkflowStep === "final-layout")) ||
            (viewState.currentWorkflowStep === "final-layout" &&
              showFinalLayoutSettings)) && (
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
              (viewState.currentView === "split" &&
                (viewState.currentWorkflowStep === "translate" ||
                  viewState.currentWorkflowStep === "final-layout")) ||
              (viewState.currentWorkflowStep === "final-layout" &&
                showFinalLayoutSettings)
                ? "bg-primary/10 border-l border-primary/20 overflow-auto flex-shrink-0 transition-all duration-500 ease-in-out"
                : "hidden"
            }
          >
            {viewState.currentView === "split" &&
              viewState.currentWorkflowStep === "translate" && (
                <div
                  className="h-full transition-opacity duration-300 opacity-100"
                  id="translation-table-view"
                >
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
                    translatedTemplateURL={getTranslatedDocumentUrl(
                      documentState.currentPage
                    )}
                    translatedTemplateWidth={
                      getTranslatedTemplateDimensions(documentState.currentPage)
                        .width
                    }
                    translatedTemplateHeight={
                      getTranslatedTemplateDimensions(documentState.currentPage)
                        .height
                    }
                  />
                </div>
              )}
            {(() => {
              return (
                viewState.currentWorkflowStep === "final-layout" &&
                showFinalLayoutSettings
              );
            })() && (
              <div className="transition-opacity duration-300 opacity-100">
                <FinalLayoutSettings
                  currentPage={documentState.currentPage}
                  totalPages={documentState.numPages}
                  capturedSnapshots={capturedSnapshots}
                  isCapturingSnapshots={isCapturingSnapshots}
                  hasFinalLayout={!!documentState.finalLayoutUrl}
                  onExportPDF={exportToPDF}
                  onExportPNG={exportToPNG}
                  onExportJPEG={exportToJPEG}
                  onSaveProject={saveProject}
                  savedExportSettings={finalLayoutSettings.exportSettings}
                  savedActiveTab={finalLayoutSettings.activeTab}
                  savedIsPreviewMode={finalLayoutSettings.isPreviewMode}
                  onSettingsChange={setFinalLayoutSettings}
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
        onZoomChange={(scale) =>
          actions.updateScaleWithoutRerender(
            Math.max(0.25, Math.round(scale * 4) / 4)
          )
        }
        onZoomIn={() =>
          actions.updateScaleWithoutRerender(
            Math.min(5.0, Math.round((documentState.scale + 0.25) * 4) / 4)
          )
        }
        onZoomOut={() =>
          actions.updateScaleWithoutRerender(
            Math.max(0.25, Math.round((documentState.scale - 0.25) * 4) / 4)
          )
        }
        onZoomReset={() => actions.updateScaleWithoutRerender(1.0)}
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
        isBulkOcrRunning={isBulkOcrRunning}
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
        currentTemplate={getPageTemplate(birthCertModalPage)}
        originalTextBoxes={elementCollections.originalTextBoxes}
        originalShapes={elementCollections.originalShapes}
        originalImages={elementCollections.originalImages}
        pdfBackgroundColor={documentState.pdfBackgroundColor}
        onTemplateSelect={(template, pageNumber) => {
          // Update the specific page with the template information
          setPageTemplate(pageNumber, template, "birth_cert");

          // Show success message
          toast.success(
            `Template "${template.variation}" applied to page ${pageNumber}`
          );

          setShowBirthCertModal(false);
        }}
      />

      {/* NBI Clearance Selection Modal */}
      <NBIClearanceSelectionModal
        isOpen={showNBIClearanceModal}
        onClose={() => setShowNBIClearanceModal(false)}
        documentUrl={documentState.url}
        currentPage={documentState.currentPage}
        pageWidth={documentState.pageWidth}
        pageHeight={documentState.pageHeight}
        sourceLanguage={sourceLanguage}
        desiredLanguage={desiredLanguage}
        pageNumber={nbiClearanceModalPage}
        currentTemplate={getPageTemplate(nbiClearanceModalPage)}
        originalTextBoxes={elementCollections.originalTextBoxes}
        originalShapes={elementCollections.originalShapes}
        originalImages={elementCollections.originalImages}
        pdfBackgroundColor={documentState.pdfBackgroundColor}
        onTemplateSelect={(template, pageNumber) => {
          // Update the specific page with the template information
          setPageTemplate(pageNumber, template, "nbi_clearance");

          // Show success message
          toast.success(
            `Template "${template.variation}" applied to page ${pageNumber}`
          );

          setShowNBIClearanceModal(false);
        }}
      />

      {/* Apostille Selection Modal */}
      <ApostilleSelectionModal
        isOpen={showApostilleModal}
        onClose={() => setShowApostilleModal(false)}
        documentUrl={documentState.url}
        currentPage={documentState.currentPage}
        pageWidth={documentState.pageWidth}
        pageHeight={documentState.pageHeight}
        sourceLanguage={sourceLanguage}
        desiredLanguage={desiredLanguage}
        pageNumber={apostilleModalPage}
        currentTemplate={getPageTemplate(apostilleModalPage)}
        originalTextBoxes={elementCollections.originalTextBoxes}
        originalShapes={elementCollections.originalShapes}
        originalImages={elementCollections.originalImages}
        pdfBackgroundColor={documentState.pdfBackgroundColor}
        onTemplateSelect={(template, pageNumber) => {
          // Update the specific page with the template information
          setPageTemplate(pageNumber, template, "apostille");

          // Show success message
          toast.success(
            `Template "${template.variation}" applied to page ${pageNumber}`
          );

          setShowApostilleModal(false);
        }}
      />

      {/* Settings Modal */}
      <LanguageSelectionModal
        open={showSettingsModal}
        sourceLanguage={tempSourceLanguage}
        desiredLanguage={desiredLanguage}
        onSourceLanguageChange={setTempSourceLanguage}
        onDesiredLanguageChange={setTempDesiredLanguage}
        onConfirm={handleSettingsSave}
        onCancel={handleSettingsBack}
        isSettings={true}
        onSave={handleSettingsSave}
        onBack={handleSettingsBack}
        isBulkOcrRunning={isBulkOcrRunning}
      />

      {/* Bulk OCR Loading Modal - Replaced with toast-based approach */}

      {/* Snapshot Capturing: toast-based progress now; modal removed */}

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

      {/* File Upload Loading Modal */}
      <LoadingModal
        isOpen={isUploadingFile}
        title="Loading Document"
        message="Please wait while we load your document..."
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
                {Array.from(new Set(untranslatedCheckList.map((t) => t.page)))
                  .length > 1
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
        onLoadProject={handleManualProjectLoad}
        onSaveProject={saveProject as (projectName?: string) => Promise<any>}
        onExportToJson={exportToJson}
        onImportFromJson={importFromJson}
        onDeleteProject={
          deleteProject as (projectId: string) => Promise<boolean>
        }
        getSavedProjects={getSavedProjects as () => Promise<any[]>}
      />

      {/* Share Project Modal */}
      <ShareProjectModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        projectId={currentProjectId}
        projectName={
          documentState.url
            ? `Project ${new Date().toLocaleDateString()}`
            : "Untitled Project"
        }
        currentShareSettings={currentShareSettings}
        onUpdateShareSettings={handleUpdateShareSettings}
      />

      {/* Spotlight Tour */}
      <SpotlightTour
        isOpen={isTourOpen}
        onClose={closeTour}
        steps={tourSteps}
        currentStepIndex={currentStepIndex}
        onStepChange={goToStep}
      />

      {/* Layout Tour */}
      <SpotlightTour
        isOpen={layoutTour.isTourOpen}
        onClose={layoutTour.closeTour}
        steps={layoutTour.tourSteps}
        currentStepIndex={layoutTour.currentStepIndex}
        onStepChange={layoutTour.goToStep}
      />
    </div>
  );
};
