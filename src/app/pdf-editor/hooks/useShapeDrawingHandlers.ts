import { useCallback } from "react";
import {
  ToolState,
  EditorState,
  ErasureState,
  ViewMode,
} from "../types/pdf-editor.types";

interface UseShapeDrawingHandlersProps {
  toolState: ToolState;
  setToolState: React.Dispatch<React.SetStateAction<ToolState>>;
  setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
  setErasureState: React.Dispatch<React.SetStateAction<ErasureState>>;
  documentState: {
    scale: number;
    pageWidth: number;
    currentPage: number;
  };
  viewState: {
    currentView: ViewMode;
  };
  documentRef: React.RefObject<HTMLDivElement | null>;
  handleAddShapeWithUndo: (
    type: "circle" | "rectangle",
    x: number,
    y: number,
    width: number,
    height: number,
    page: number,
    view: ViewMode,
    targetView?: "original" | "translated"
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
}: UseShapeDrawingHandlersProps) => {
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
          // Click on translated side
          targetView = "translated";
          x = (clickX - singleDocWidth - gap) / documentState.scale;
        } else if (clickX <= singleDocWidth) {
          // Click on original side
          targetView = "original";
        } else {
          // Click in gap
          return;
        }
      } else {
        targetView = viewState.currentView;
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
      setToolState,
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
          x = (clickX - documentState.pageWidth * documentState.scale - 20) / documentState.scale;
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
        const targetView = toolState.shapeDrawTargetView || viewState.currentView;
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
    handleAddShapeWithUndo,
    documentState.currentPage,
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
