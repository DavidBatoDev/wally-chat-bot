import { useCallback } from "react";
import {
  ToolState,
  EditorState,
  ErasureState,
  ViewMode,
} from "../../types/pdf-editor.types";
import { screenToDocumentCoordinates } from "../../utils/coordinates";

interface UseShapeDrawingHandlersProps {
  toolState: ToolState;
  setToolState: React.Dispatch<React.SetStateAction<ToolState>>;
  setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
  setErasureState: React.Dispatch<React.SetStateAction<ErasureState>>;
  documentState: {
    scale: number;
    pageWidth: number;
    currentPage: number;
    finalLayoutCurrentPage?: number;
  };
  getTranslatedTemplateScaleFactor?: (pageNumber: number) => number;
  viewState: {
    currentView: ViewMode;
  };
  documentRef: React.RefObject<HTMLDivElement | null>;
  handleAddShapeWithUndo: (
    type: "circle" | "rectangle" | "line",
    x: number,
    y: number,
    width: number,
    height: number,
    page: number,
    view: ViewMode,
    targetView?: "original" | "translated",
    // Line-specific parameters
    x1?: number,
    y1?: number,
    x2?: number,
    y2?: number
  ) => string | null;
}

export const useShapeDrawingHandlers = ({
  toolState,
  setToolState,
  setEditorState,
  setErasureState,
  documentState,
  viewState,
  documentRef,
  handleAddShapeWithUndo,
  getTranslatedTemplateScaleFactor,
}: UseShapeDrawingHandlersProps) => {
  // Helper function to get the correct current page based on view
  const getCurrentPageForView = useCallback(() => {
    if (viewState.currentView === "final-layout") {
      return documentState.finalLayoutCurrentPage || 1;
    }
    return documentState.currentPage;
  }, [
    viewState.currentView,
    documentState.currentPage,
    documentState.finalLayoutCurrentPage,
  ]);

  // Shape drawing handlers
  const handleShapeDrawStart = useCallback(
    (e: React.MouseEvent) => {
      if (!toolState.shapeDrawingMode) return;

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Determine target view in split mode
      let targetView: "original" | "translated" | null = null;
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
      setToolState,
    ]
  );

  const handleShapeDrawMove = useCallback(
    (e: React.MouseEvent) => {
      if (!toolState.isDrawingInProgress || !toolState.shapeDrawStart) return;

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Convert screen coordinates to document coordinates
      const { x, y } = screenToDocumentCoordinates(
        e.clientX,
        e.clientY,
        rect,
        documentState.scale,
        toolState.shapeDrawTargetView,
        viewState.currentView,
        documentState.pageWidth,
        toolState.shapeDrawTargetView === "translated"
          ? getTranslatedTemplateScaleFactor?.(documentState.currentPage)
          : undefined
      );

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
      setToolState,
    ]
  );

  const handleShapeDrawEnd = useCallback(() => {
    if (
      !toolState.isDrawingInProgress ||
      !toolState.shapeDrawStart ||
      !toolState.shapeDrawEnd
    )
      return;

    if (toolState.shapeDrawingMode === "line") {
      // For lines, use direct coordinates without minimum size constraint
      const targetView = toolState.shapeDrawTargetView || viewState.currentView;

      handleAddShapeWithUndo(
        "line",
        0, // Not used for lines
        0, // Not used for lines
        0, // Not used for lines
        0, // Not used for lines
        getCurrentPageForView(),
        viewState.currentView,
        toolState.shapeDrawTargetView || undefined,
        // Line coordinates
        toolState.shapeDrawStart.x,
        toolState.shapeDrawStart.y,
        toolState.shapeDrawEnd.x,
        toolState.shapeDrawEnd.y
      );
    } else {
      // For rectangles and circles, use bounding box
      const width = Math.abs(
        toolState.shapeDrawEnd.x - toolState.shapeDrawStart.x
      );
      const height = Math.abs(
        toolState.shapeDrawEnd.y - toolState.shapeDrawStart.y
      );

      if (width > 10 && height > 10) {
        const x = Math.min(
          toolState.shapeDrawStart.x,
          toolState.shapeDrawEnd.x
        );
        const y = Math.min(
          toolState.shapeDrawStart.y,
          toolState.shapeDrawEnd.y
        );

        const targetView =
          toolState.shapeDrawTargetView || viewState.currentView;
        handleAddShapeWithUndo(
          toolState.shapeDrawingMode as "circle" | "rectangle",
          x,
          y,
          width,
          height,
          getCurrentPageForView(),
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
    handleAddShapeWithUndo,
    documentState.currentPage,
    documentState.finalLayoutCurrentPage,
    viewState.currentView,
    setToolState,
    setEditorState,
    setErasureState,
  ]);

  return {
    handleShapeDrawStart,
    handleShapeDrawMove,
    handleShapeDrawEnd,
  };
};
