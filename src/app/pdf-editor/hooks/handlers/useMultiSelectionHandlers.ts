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
} from "../../utils/selectionUtils";

interface UseMultiSelectionHandlersProps {
  editorState: EditorState;
  setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
  initialPositionsRef: React.MutableRefObject<Record<string, { x: number; y: number }>>;
  documentState: {
    scale: number;
    pageWidth: number;
    pageHeight: number;
    currentPage: number;
  };
  viewState: {
    currentView: ViewMode;
  };
  getCurrentTextBoxes: (view: ViewMode) => TextField[];
  getCurrentShapes: (view: ViewMode) => ShapeType[];
  getCurrentImages: (view: ViewMode) => ImageType[];
  updateTextBoxWithUndo: (id: string, updates: any, isOngoing?: boolean) => void;
  updateShapeWithUndo: (id: string, updates: any, isOngoing?: boolean) => void;
  updateImage: (id: string, updates: any) => void;
  getElementById: (id: string, type: "textbox" | "shape" | "image") => any;
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
  getElementById,
}: UseMultiSelectionHandlersProps) => {
  // Multi-selection drag handlers for individual Rnd components

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
      updateShapeWithUndo,
      updateImage,
      getElementById,
      documentState.pageWidth,
      documentState.pageHeight,
      setEditorState,
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
  }, [setEditorState]);

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
    [editorState.multiSelection.selectedElements, setEditorState]
  );

  // Multi-element selection mouse handlers
  const handleMultiSelectionMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!editorState.isSelectionMode) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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

  const handleMultiSelectionMouseMove = useCallback(
    (e: React.MouseEvent) => {
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
        editorState.multiSelection.targetView === "translated"
      ) {
        const clickX = e.clientX - rect.left;
        const singleDocWidth = documentState.pageWidth * documentState.scale;
        const gap = 20;
        x = (clickX - singleDocWidth - gap) / documentState.scale;
      }

      setEditorState((prev) => ({
        ...prev,
        multiSelection: {
          ...prev.multiSelection,
          selectionEnd: { x, y },
        },
      }));
    },
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
