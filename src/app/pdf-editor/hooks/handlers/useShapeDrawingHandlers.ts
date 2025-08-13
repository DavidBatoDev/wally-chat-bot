import { useCallback, useRef, useMemo } from "react";
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
    currentWorkflowStep?: "translate" | "layout" | "final-layout";
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
    targetView?: "original" | "translated" | "final-layout",
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
  // Performance optimization: Use refs to avoid unnecessary re-renders during drawing
  const drawingStateRef = useRef({
    isDrawing: false,
    startCoords: null as { x: number; y: number } | null,
    targetView: null as "original" | "translated" | "final-layout" | null,
  });

  // Performance optimization: Memoize scale factors to avoid recalculating on every move
  const memoizedScaleFactors = useMemo(() => {
    const baseScale = documentState.scale;
    const templateScale =
      getTranslatedTemplateScaleFactor?.(documentState.currentPage) || 1;
    const effectiveScale =
      viewState.currentView === "split" &&
      viewState.currentWorkflowStep === "translate"
        ? baseScale * templateScale
        : baseScale;

    return {
      baseScale,
      templateScale,
      effectiveScale,
      isSplitView: viewState.currentView === "split",
      isTranslated: viewState.currentWorkflowStep === "translate",
    };
  }, [
    documentState.scale,
    documentState.currentPage,
    viewState.currentView,
    viewState.currentWorkflowStep,
    getTranslatedTemplateScaleFactor,
  ]);

  // Performance optimization: Throttled mouse move handler using requestAnimationFrame
  const throttledMouseMoveRef = useRef<number | null>(null);
  const lastMouseMoveTimeRef = useRef(0);
  const MOUSE_MOVE_THROTTLE_MS = 8; // ~120fps for smoother drawing
  const lastStateUpdateRef = useRef(0);
  const STATE_UPDATE_THROTTLE_MS = 16; // ~60fps for state updates

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

      // Only left click
      if (e.button !== 0) return;

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Determine target view in split mode
      let targetView: "original" | "translated" | "final-layout" | null = null;
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
        targetView === "final-layout" ? null : targetView,
        viewState.currentView,
        documentState.pageWidth,
        targetView === "translated"
          ? getTranslatedTemplateScaleFactor?.(documentState.currentPage)
          : undefined
      );

      // Store drawing state in ref for performance
      drawingStateRef.current = {
        isDrawing: true,
        startCoords: { x, y },
        targetView,
      };

      setToolState((prev) => ({
        ...prev,
        isDrawingShape: true,
        shapeDrawStart: { x, y },
        shapeDrawEnd: { x, y },
        shapeDrawTargetView: targetView,
        isDrawingInProgress: true,
      }));

      e.preventDefault();
    },
    [
      toolState.shapeDrawingMode,
      documentState.scale,
      documentState.pageWidth,
      documentState.currentPage,
      viewState.currentView,
      setToolState,
      getTranslatedTemplateScaleFactor,
    ]
  );

  const handleShapeDrawMove = useCallback(
    (e: React.MouseEvent) => {
      if (!toolState.isDrawingShape || !toolState.shapeDrawStart) return;

      // Performance optimization: Throttle mouse move events
      const now = performance.now();
      if (now - lastMouseMoveTimeRef.current < MOUSE_MOVE_THROTTLE_MS) {
        return;
      }
      lastMouseMoveTimeRef.current = now;

      // Cancel any pending animation frame
      if (throttledMouseMoveRef.current) {
        cancelAnimationFrame(throttledMouseMoveRef.current);
      }

      // Use requestAnimationFrame for smooth updates
      throttledMouseMoveRef.current = requestAnimationFrame(() => {
        const rect = documentRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Convert screen coordinates to document coordinates
        const { x, y } = screenToDocumentCoordinates(
          e.clientX,
          e.clientY,
          rect,
          documentState.scale,
          toolState.shapeDrawTargetView === "final-layout"
            ? null
            : toolState.shapeDrawTargetView,
          viewState.currentView,
          documentState.pageWidth,
          toolState.shapeDrawTargetView === "translated"
            ? getTranslatedTemplateScaleFactor?.(documentState.currentPage)
            : undefined
        );

        // Performance optimization: Throttle state updates to reduce re-renders
        const stateUpdateNow = performance.now();
        if (
          stateUpdateNow - lastStateUpdateRef.current >=
          STATE_UPDATE_THROTTLE_MS
        ) {
          lastStateUpdateRef.current = stateUpdateNow;

          // Performance optimization: Only update the minimal state needed
          setToolState((prev) => ({
            ...prev,
            shapeDrawEnd: { x, y },
          }));
        }
      });
    },
    [
      toolState.isDrawingShape,
      toolState.shapeDrawStart,
      toolState.shapeDrawTargetView,
      documentState.scale,
      documentState.pageWidth,
      documentState.currentPage,
      viewState.currentView,
      setToolState,
      getTranslatedTemplateScaleFactor,
    ]
  );

  const handleShapeDrawEnd = useCallback(() => {
    if (
      !toolState.isDrawingShape ||
      !toolState.shapeDrawStart ||
      !toolState.shapeDrawEnd
    )
      return;

    // Clean up throttling
    if (throttledMouseMoveRef.current) {
      cancelAnimationFrame(throttledMouseMoveRef.current);
      throttledMouseMoveRef.current = null;
    }

    // Reset drawing state ref
    drawingStateRef.current = {
      isDrawing: false,
      startCoords: null,
      targetView: null,
    };

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
      isDrawingShape: false,
      shapeDrawStart: null,
      shapeDrawEnd: null,
      shapeDrawTargetView: null,
      isDrawingInProgress: false,
    }));
  }, [
    toolState.isDrawingShape,
    toolState.shapeDrawStart,
    toolState.shapeDrawEnd,
    toolState.shapeDrawingMode,
    toolState.shapeDrawTargetView,
    viewState.currentView,
    setToolState,
    handleAddShapeWithUndo,
    getCurrentPageForView,
  ]);

  // Cleanup function for component unmount
  const cleanup = useCallback(() => {
    if (throttledMouseMoveRef.current) {
      cancelAnimationFrame(throttledMouseMoveRef.current);
      throttledMouseMoveRef.current = null;
    }
  }, []);

  return {
    handleShapeDrawStart,
    handleShapeDrawMove,
    handleShapeDrawEnd,
    cleanup,
    memoizedScaleFactors,
  };
};
