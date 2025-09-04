import { useCallback } from "react";
import {
  EditorState,
  ErasureState,
  SelectionState,
  TextField,
  ViewMode,
} from "../../types/pdf-editor.types";
import { screenToDocumentCoordinates } from "../../utils/coordinates";

interface UseDocumentMouseHandlersProps {
  editorState: EditorState;
  setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
  erasureState: ErasureState;
  setErasureState: React.Dispatch<React.SetStateAction<ErasureState>>;
  selectionState: SelectionState;
  setSelectionState: React.Dispatch<React.SetStateAction<SelectionState>>;
  documentState: {
    scale: number;
    pageWidth: number;
    currentPage: number;
    pdfBackgroundColor: string;
  };
  getTranslatedTemplateScaleFactor?: (pageNumber: number) => number;
  viewState: {
    currentView: ViewMode;
  };
  documentRef: React.RefObject<HTMLDivElement | null>;
  currentPageTextBoxes: TextField[];
  handleAddDeletionRectangleWithUndo: (
    x: number,
    y: number,
    width: number,
    height: number,
    page: number,
    view: "original" | "translated" | "final-layout",
    background: string,
    opacity: number
  ) => string | null;
}

export const useDocumentMouseHandlers = ({
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
}: UseDocumentMouseHandlersProps) => {
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
            selectedTextBoxes: { textBoxIds: [] },
          }));
        }

        e.preventDefault();
      } else if (erasureState.isErasureMode) {
        // Handle erasure drawing start
        if (e.button !== 0) return; // Only left click

        const rect = documentRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Determine target view
        let targetView: "original" | "translated" | "final-layout" | undefined =
          undefined;
        if (viewState.currentView === "split") {
          const clickX = e.clientX - rect.left;
          const singleDocWidth = documentState.pageWidth * documentState.scale;
          const gap = 20;

          if (clickX > singleDocWidth + gap) {
            targetView = "translated";
          } else if (clickX <= singleDocWidth) {
            targetView = "original";
          } else {
            return; // Click in gap
          }
        } else {
          targetView = viewState.currentView;
        }

        // Convert screen coordinates to document coordinates
        const { x, y } = screenToDocumentCoordinates(
          e.clientX,
          e.clientY,
          rect,
          documentState.scale,
          targetView,
          viewState.currentView,
          documentState.pageWidth,
          targetView === "translated"
            ? getTranslatedTemplateScaleFactor?.(documentState.currentPage)
            : undefined
        );

        setErasureState((prev) => ({
          ...prev,
          isDrawingErasure: true,
          erasureDrawStart: { x, y },
          erasureDrawEnd: { x, y },
          erasureDrawTargetView: targetView,
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
      setEditorState,
      setErasureState,
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
          selectionRect: {
            left: Math.min(prev.selectionStart!.x, x),
            top: Math.min(prev.selectionStart!.y, y),
            width: Math.abs(x - prev.selectionStart!.x),
            height: Math.abs(y - prev.selectionStart!.y),
          },
        }));
      } else if (
        erasureState.isDrawingErasure &&
        erasureState.erasureDrawStart
      ) {
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
            ? getTranslatedTemplateScaleFactor?.(documentState.currentPage)
            : undefined
        );

        setErasureState((prev) => ({
          ...prev,
          erasureDrawEnd: { x, y },
        }));
      }
    },
    [
      editorState.isTextSelectionMode,
      editorState.isDrawingSelection,
      editorState.selectionStart,
      erasureState.isDrawingErasure,
      erasureState.erasureDrawStart,
      erasureState.erasureDrawTargetView,
      documentState.scale,
      documentState.pageWidth,
      viewState.currentView,
      setEditorState,
      setErasureState,
    ]
  );

  const handleDocumentMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (editorState.isTextSelectionMode && editorState.isDrawingSelection) {
        // Handle text selection completion
        setEditorState((prev) => ({
          ...prev,
          isDrawingSelection: false,
          selectionStart: null,
          selectionEnd: null,
          selectionRect: null,
        }));

        // Process text selection if there's a valid selection
        if (editorState.selectionRect) {
          const rect = documentRef.current?.getBoundingClientRect();
          if (rect) {
            const scale = documentState.scale;
            const selectionInDoc = {
              x: (editorState.selectionRect.left - rect.left) / scale,
              y: (editorState.selectionRect.top - rect.top) / scale,
              width: editorState.selectionRect.width / scale,
              height: editorState.selectionRect.height / scale,
            };

            // Find overlapping textboxes
            const overlappingTextBoxes = currentPageTextBoxes.filter(
              (textBox) =>
                // Check if rectangles overlap
                selectionInDoc.x < textBox.x + textBox.width &&
                selectionInDoc.x + selectionInDoc.width > textBox.x &&
                selectionInDoc.y < textBox.y + textBox.height &&
                selectionInDoc.y + selectionInDoc.height > textBox.y
            );

            if (overlappingTextBoxes.length > 0) {
              const newIds = overlappingTextBoxes.map((tb) => tb.id);
              if (e.ctrlKey || e.metaKey) {
                // Add to existing selection
                setEditorState((prev) => ({
                  ...prev,
                  selectedTextBoxes: {
                    textBoxIds: [
                      ...prev.selectedTextBoxes.textBoxIds,
                      ...newIds.filter(
                        (id) => !prev.selectedTextBoxes.textBoxIds.includes(id)
                      ),
                    ],
                  },
                }));
              } else {
                // Replace selection
                setEditorState((prev) => ({
                  ...prev,
                  selectedTextBoxes: { textBoxIds: newIds },
                }));
              }
            }
          }
        }
      } else if (erasureState.isDrawingErasure) {
        // Handle erasure drawing end
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

          handleAddDeletionRectangleWithUndo(
            x,
            y,
            width,
            height,
            documentState.currentPage,
            targetView || "original",
            documentState.pdfBackgroundColor,
            erasureState.erasureSettings.opacity
          );
        }
      }
    },
    [
      editorState.isTextSelectionMode,
      editorState.isDrawingSelection,
      editorState.selectionRect,
      erasureState.isDrawingErasure,
      erasureState.erasureDrawStart,
      erasureState.erasureDrawEnd,
      erasureState.erasureDrawTargetView,
      erasureState.erasureSettings.opacity,
      documentState.scale,
      documentState.currentPage,
      documentState.pdfBackgroundColor,
      viewState.currentView,
      currentPageTextBoxes,
      handleAddDeletionRectangleWithUndo,
      setEditorState,
      setErasureState,
    ]
  );

  return {
    handleDocumentMouseDown,
    handleDocumentMouseMove,
    handleDocumentMouseUp,
  };
};
