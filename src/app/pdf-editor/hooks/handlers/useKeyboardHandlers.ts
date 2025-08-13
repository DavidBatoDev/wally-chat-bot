import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  EditorState,
  ViewState,
  TextField,
  ViewMode,
} from "../../types/pdf-editor.types";

interface UseKeyboardHandlersProps {
  editorState: EditorState;
  setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
  viewState: ViewState;
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>;
  documentState: {
    scale: number;
    currentPage: number;
    pdfBackgroundColor: string;
  };
  actions: {
    updateScale: (scale: number) => void;
    resetScaleChanging: () => void;
  };
  erasureState: {
    erasureSettings: {
      opacity: number;
    };
  };
  currentPageTextBoxes: TextField[];
  handleAddDeletionRectangleWithUndo: (
    x: number,
    y: number,
    width: number,
    height: number,
    page: number,
    view: ViewMode,
    background: string,
    opacity: number
  ) => string | null;
  handleDeleteTextBoxWithUndo: (id: string, view: ViewMode) => void;
  handleDeleteShapeWithUndo: (id: string, view: ViewMode) => void;
  handleDeleteImageWithUndo: (id: string, view: ViewMode) => void;
  handleDeleteSelection: () => void;
  history: {
    canUndo: () => boolean;
    canRedo: () => boolean;
    undo: () => boolean;
    redo: () => boolean;
    endBatch: () => void;
  };
  handleMultiSelectionMove: (event: CustomEvent) => void;
  handleMultiSelectionMoveEnd: (event: CustomEvent) => void;
  elementCollections: any;
}

export const useKeyboardHandlers = ({
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
}: UseKeyboardHandlersProps) => {
  // Undo/Redo debouncing state
  const UNDO_REDO_DEBOUNCE_MS = 300; // 300ms debounce for undo/redo

  // Track Ctrl key state for zoom indicator and handle keyboard shortcuts
  useEffect(() => {
    let lastUndoTime = 0;
    let lastRedoTime = 0;

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
          actions.updateScale(Math.max(1.0, documentState.scale - 0.1)); // Prevent below 100%
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
                // Create deletion rectangle covering the text box
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
                
                // Delete the text box
                handleDeleteTextBoxWithUndo(textBoxId);
              }
            });
            toast.success(
              `Replaced ${selectedIds.length} text boxes with deletion rectangles`
            );
          }
        }

        // Delete key to delete selected elements
        if (e.key === "Delete" && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          
          // Check for multi-selection first
          if (editorState.multiSelection.selectedElements.length > 0) {
            console.log('[KeyboardHandlers] Delete key pressed for multi-selection');
            // Use the multi-delete handler
            handleDeleteSelection();
          } else if (editorState.selectedFieldId) {
            console.log('[KeyboardHandlers] Delete key pressed for single textbox:', editorState.selectedFieldId);
            // Single textbox selected
            const textBoxView = elementCollections.originalTextBoxes.some((tb: any) => tb.id === editorState.selectedFieldId)
              ? "original"
              : elementCollections.translatedTextBoxes.some((tb: any) => tb.id === editorState.selectedFieldId)
              ? "translated"
              : "final-layout";
            handleDeleteTextBoxWithUndo(editorState.selectedFieldId, textBoxView);
          } else if (editorState.selectedShapeId) {
            console.log('[KeyboardHandlers] Delete key pressed for single shape:', editorState.selectedShapeId);
            // Single shape selected
            const shapeView = elementCollections.originalShapes.some((s: any) => s.id === editorState.selectedShapeId)
              ? "original"
              : elementCollections.translatedShapes.some((s: any) => s.id === editorState.selectedShapeId)
              ? "translated"
              : "final-layout";
            handleDeleteShapeWithUndo(editorState.selectedShapeId, shapeView);
          } else if (editorState.selectedImageId) {
            console.log('[KeyboardHandlers] Delete key pressed for single image:', editorState.selectedImageId);
            // Single image selected
            const imageView = elementCollections.originalImages.some((img: any) => img.id === editorState.selectedImageId)
              ? "original"
              : elementCollections.translatedImages.some((img: any) => img.id === editorState.selectedImageId)
              ? "translated"
              : "final-layout";
            handleDeleteImageWithUndo(editorState.selectedImageId, imageView);
          }
        }

        // Ctrl+Z to undo
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          const now = Date.now();
          if (now - lastUndoTime < UNDO_REDO_DEBOUNCE_MS) {
            return;
          }

          // End any ongoing batch before undo
          history.endBatch();
          
          if (history.canUndo()) {
            if (history.undo()) {
              lastUndoTime = now;
              toast.success("Undo");
            }
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

          // End any ongoing batch before redo
          history.endBatch();
          
          if (history.canRedo()) {
            if (history.redo()) {
              lastRedoTime = now;
              toast.success("Redo");
            }
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
            dragOffsets: {},
            isDragging: false,
            selectionDragOffset: null,
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
    documentState.currentPage,
    documentState.pdfBackgroundColor,
    viewState.currentView,
    actions,
    editorState.selectedTextBoxes.textBoxIds,
    editorState.multiSelection,
    erasureState.erasureSettings.opacity,
    currentPageTextBoxes,
    handleAddDeletionRectangleWithUndo,
    handleDeleteTextBoxWithUndo,
    history,
    handleMultiSelectionMove,
    handleMultiSelectionMoveEnd,
    setEditorState,
    setViewState,
  ]);

  return {};
};
