import { useCallback, useRef } from "react";
import {
  EditorState,
  TextField,
  Shape as ShapeType,
  Image as ImageType,
  ViewMode,
} from "../../types/pdf-editor.types";
import {
  findElementsInSelection,
  calculateSelectionBounds,
  moveSelectedElements,
  moveSelectedElementsOptimized,
  batchApplyElementUpdates,
} from "../../utils/selectionUtils";
import { dragThrottle, BatchedUpdater } from "../../utils/performance";

interface UseMultiSelectionHandlersProps {
  editorState: EditorState;
  setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
  initialPositionsRef: React.MutableRefObject<
    Record<string, { x: number; y: number }>
  >;
  documentState: {
    scale: number;
    pageWidth: number;
    pageHeight: number;
    currentPage: number;
    finalLayoutCurrentPage?: number;
  };
  viewState: {
    currentView: ViewMode;
  };
  getCurrentTextBoxes: (view: ViewMode) => TextField[];
  getCurrentShapes: (view: ViewMode) => ShapeType[];
  getCurrentImages: (view: ViewMode) => ImageType[];
  updateTextBoxWithUndo: (
    id: string,
    updates: any,
    isOngoing?: boolean
  ) => void;
  updateShapeWithUndo: (id: string, updates: any, isOngoing?: boolean) => void;
  updateImage: (id: string, updates: any) => void;
  updateImageWithUndo?: (id: string, updates: any, isOngoing?: boolean) => void;
  getElementById: (id: string, type: "textbox" | "shape" | "image") => any;
  history?: any;
}

export const useMultiSelectionHandlers = ({
  editorState,
  setEditorState,
  initialPositionsRef,
  documentState,
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
}: UseMultiSelectionHandlersProps) => {
  // Multi-selection drag handlers for individual Rnd components

  // Enhanced throttling for mouse move events using dragThrottle
  const mouseMoveThrottleRef = useRef<number | null>(null);
  const batchedUpdaterRef = useRef(new BatchedUpdater());
  const pendingUpdatesRef = useRef<any[]>([]);

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

    // Helper function to get the correct current page based on target view
    const getCurrentPageForView = (view: string) => {
      if (view === "final-layout") {
        // For final-layout, use the final layout current page
        return (
          documentState.finalLayoutCurrentPage || documentState.currentPage
        );
      }
      return documentState.currentPage;
    };

    const currentPage = getCurrentPageForView(targetView || "");

    if (targetView === "original") {
      textBoxes = getCurrentTextBoxes("original").filter(
        (tb) => tb.page === currentPage
      );
      shapes = getCurrentShapes("original").filter(
        (s) => s.page === currentPage
      );
      images = getCurrentImages("original").filter(
        (img) => img.page === currentPage
      );
    } else if (targetView === "translated") {
      textBoxes = getCurrentTextBoxes("translated").filter(
        (tb) => tb.page === currentPage
      );
      shapes = getCurrentShapes("translated").filter(
        (s) => s.page === currentPage
      );
      images = getCurrentImages("translated").filter(
        (img) => img.page === currentPage
      );
    } else if (targetView === "final-layout") {
      textBoxes = getCurrentTextBoxes("final-layout").filter(
        (tb) => tb.page === currentPage
      );
      shapes = getCurrentShapes("final-layout").filter(
        (s) => s.page === currentPage
      );
      images = getCurrentImages("final-layout").filter(
        (img) => img.page === currentPage
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

  // Optimized multi-selection move handler with batching
  const handleMultiSelectionMove = useCallback(
    (event: CustomEvent) => {
      const { deltaX, deltaY } = event.detail;

      // Use the optimized movement function for visual feedback
      const updates = moveSelectedElementsOptimized(
        editorState.multiSelection.selectedElements,
        deltaX,
        deltaY,
        getElementById,
        documentState.pageWidth,
        documentState.pageHeight,
        true // Use transforms for visual feedback
      );

      // Store updates for final application
      pendingUpdatesRef.current = updates;

      // Update original positions for next move (batched)
      batchedUpdaterRef.current.addToBatch(() => {
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
      });
    },
    [
      editorState.multiSelection.selectedElements,
      getElementById,
      documentState.pageWidth,
      documentState.pageHeight,
      setEditorState,
    ]
  );

  const handleMultiSelectionMoveEnd = useCallback(() => {
    // Apply any pending updates
    if (pendingUpdatesRef.current.length > 0) {
      batchApplyElementUpdates(
        pendingUpdatesRef.current,
        (id, updates) => updateTextBoxWithUndo(id, updates, false),
        (id, updates) => updateShapeWithUndo(id, updates, false),
        (id, updates) => {
          if (updateImageWithUndo) {
            updateImageWithUndo(id, updates, false);
          } else {
            updateImage(id, updates);
          }
        },
        getElementById
      );
      pendingUpdatesRef.current = [];
    }

    // Flush any pending batched state updates
    batchedUpdaterRef.current.flush();

    // End batch operation if there's one
    if (history && history.endBatch) {
      history.endBatch();
    }
    
    setEditorState((prev) => ({
      ...prev,
      multiSelection: {
        ...prev.multiSelection,
        isMovingSelection: false,
        moveStart: null,
      },
    }));
  }, [
    updateTextBoxWithUndo,
    updateShapeWithUndo,
    updateImage,
    updateImageWithUndo,
    getElementById,
    setEditorState,
    history
  ]);

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
        
        // Set dragging state
        setEditorState((prev) => ({
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            isDragging: true,
            dragOffsets: {},
          },
        }));
      }
    },
    [editorState.multiSelection.selectedElements, getElementById, setEditorState]
  );

  // Optimized drag handler using throttling and transforms
  const throttledDrag = useCallback(
    dragThrottle((id: string, deltaX: number, deltaY: number) => {
      const selectedElements = editorState.multiSelection.selectedElements;
      if (selectedElements.length > 1 && editorState.multiSelection.isDragging) {
        // Use the optimized movement function for visual feedback
        const updates = moveSelectedElementsOptimized(
          selectedElements.filter(el => el.id !== id), // Skip the actively dragged element
          deltaX,
          deltaY,
          getElementById,
          documentState.pageWidth,
          documentState.pageHeight,
          true // Use transforms for visual feedback
        );

        // Store updates for final application
        pendingUpdatesRef.current = updates;

        // Update drag offsets for transform-based positioning (batched)
        batchedUpdaterRef.current.addToBatch(() => {
          const newOffsets: Record<string, { x: number; y: number }> = {};
          
          updates.forEach((update) => {
            newOffsets[update.id] = {
              x: update.constrainedX - update.originalX,
              y: update.constrainedY - update.originalY,
            };
          });

          setEditorState((prev) => ({
            ...prev,
            multiSelection: {
              ...prev.multiSelection,
              dragOffsets: newOffsets,
            },
          }));
        });
      }
    }, { fps: 60, immediate: true }),
    [
      editorState.multiSelection.selectedElements,
      editorState.multiSelection.isDragging,
      getElementById,
      documentState.pageWidth,
      documentState.pageHeight,
      setEditorState,
    ]
  );

  const handleMultiSelectDrag = useCallback(
    (id: string, deltaX: number, deltaY: number) => {
      throttledDrag(id, deltaX, deltaY);
    },
    [throttledDrag]
  );

  const handleMultiSelectDragStop = useCallback(
    (id: string, deltaX: number, deltaY: number) => {
      const selectedElements = editorState.multiSelection.selectedElements;
      if (selectedElements.length > 1 && editorState.multiSelection.isDragging) {
        // Calculate final positions for non-actively dragged elements
        const elementsToUpdate = selectedElements.filter(el => el.id !== id);
        const updates = moveSelectedElementsOptimized(
          elementsToUpdate,
          deltaX,
          deltaY,
          getElementById,
          documentState.pageWidth,
          documentState.pageHeight,
          false // Don't use transforms for final positioning
        );

        // Apply batched position updates
        if (updates.length > 0) {
          batchApplyElementUpdates(
            updates,
            (id, updates) => updateTextBoxWithUndo(id, updates, false),
            (id, updates) => updateShapeWithUndo(id, updates, false),
            (id, updates) => {
              if (updateImageWithUndo) {
                updateImageWithUndo(id, updates, false);
              } else {
                updateImage(id, updates);
              }
            },
            getElementById
          );
        }
        
        // Flush any remaining batched updates
        batchedUpdaterRef.current.flush();
        
        // Clear drag state
        setEditorState((prev) => ({
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            isDragging: false,
            dragOffsets: {},
          },
        }));
        
        // End batch operation if there's one
        if (history && history.endBatch) {
          history.endBatch();
        }
        
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
    [
      editorState.multiSelection.selectedElements,
      editorState.multiSelection.isDragging,
      updateTextBoxWithUndo,
      updateShapeWithUndo,
      updateImage,
      updateImageWithUndo,
      getElementById,
      documentState.pageWidth,
      documentState.pageHeight,
      setEditorState,
      history,
    ]
  );

  // Multi-element selection mouse handlers with optimized throttling
  const handleMultiSelectionMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!editorState.isSelectionMode) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (!rect) return;

      let x = (e.clientX - rect.left) / documentState.scale;
      let y = (e.clientY - rect.top) / documentState.scale;
      let targetView: "original" | "translated" | "final-layout" | null = null;

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

      setEditorState((prev) => ({
        ...prev,
        multiSelection: {
          ...prev.multiSelection,
          isDrawingSelection: true,
          selectionStart: { x, y },
          selectionEnd: { x, y },
          targetView,
        },
      }));

      e.preventDefault();
    },
    [
      editorState.isSelectionMode,
      documentState.scale,
      documentState.pageWidth,
      viewState.currentView,
      setEditorState,
    ]
  );

  // Optimized mouse move handler with enhanced throttling
  const throttledMouseMove = useCallback(
    dragThrottle((e: React.MouseEvent) => {
      if (
        !editorState.isSelectionMode ||
        !editorState.multiSelection.isDrawingSelection ||
        !editorState.multiSelection.selectionStart
      )
        return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (!rect) return;

      let x = (e.clientX - rect.left) / documentState.scale;
      let y = (e.clientY - rect.top) / documentState.scale;

      // Adjust coordinates for split view
      if (
        viewState.currentView === "split" &&
        (editorState.multiSelection.targetView === "translated" ||
          editorState.multiSelection.targetView === "final-layout")
      ) {
        const clickX = e.clientX - rect.left;
        const singleDocWidth = documentState.pageWidth * documentState.scale;
        const gap = 20;
        x = (clickX - singleDocWidth - gap) / documentState.scale;
      }

      // Use batched updater for state changes
      batchedUpdaterRef.current.addToBatch(() => {
        setEditorState((prev) => ({
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            selectionEnd: { x, y },
          },
        }));
      });
    }, { fps: 60, immediate: true }),
    [
      editorState.isSelectionMode,
      editorState.multiSelection.isDrawingSelection,
      editorState.multiSelection.selectionStart,
      editorState.multiSelection.targetView,
      documentState.scale,
      documentState.pageWidth,
      viewState.currentView,
      setEditorState,
    ]
  );

  const handleMultiSelectionMouseMove = useCallback(
    (e: React.MouseEvent) => {
      throttledMouseMove(e);
    },
    [throttledMouseMove]
  );

  const handleMultiSelectionMouseUp = useCallback(
    (e: React.MouseEvent) => {
      // Cancel any pending animation frame
      if (mouseMoveThrottleRef.current) {
        cancelAnimationFrame(mouseMoveThrottleRef.current);
        mouseMoveThrottleRef.current = null;
      }

      // Flush any pending batched updates
      batchedUpdaterRef.current.flush();

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

        // Calculate selection bounds
        const selectionBounds = calculateSelectionBounds(
          selectedElements,
          getElementById
        );

        // Update selection state
        setEditorState((prev) => ({
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            selectedElements,
            selectionBounds,
            isDrawingSelection: false,
            selectionStart: null,
            selectionEnd: null,
          },
        }));
      } else {
        // Clear selection if too small
        setEditorState((prev) => ({
          ...prev,
          multiSelection: {
            ...prev.multiSelection,
            selectedElements: [],
            selectionBounds: null,
            isDrawingSelection: false,
            selectionStart: null,
            selectionEnd: null,
            dragOffsets: {},
            isDragging: false,
          },
        }));
      }
    },
    [
      editorState.isSelectionMode,
      editorState.multiSelection.isDrawingSelection,
      editorState.multiSelection.selectionStart,
      editorState.multiSelection.selectionEnd,
      editorState.multiSelection.targetView,
      getCurrentTextBoxes,
      getCurrentShapes,
      getCurrentImages,
      documentState.currentPage,
      getElementById,
      setEditorState,
    ]
  );

  return {
    getElementsInSelectionPreview,
    handleMultiSelectionMove,
    handleMultiSelectionMoveEnd,
    handleMultiSelectDragStart,
    handleMultiSelectDrag,
    handleMultiSelectDragStop,
    handleMultiSelectionMouseDown,
    handleMultiSelectionMouseMove,
    handleMultiSelectionMouseUp,
  };
};
