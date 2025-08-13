import { useCallback } from "react";
import {
  EditorState,
  ToolState,
  ErasureState,
} from "../../types/pdf-editor.types";

interface UseToolHandlersProps {
  setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
  setToolState: React.Dispatch<React.SetStateAction<ToolState>>;
  setErasureState: React.Dispatch<React.SetStateAction<ErasureState>>;
  setSelectedElementId: (id: string | null) => void;
  setSelectedElementType: (type: "textbox" | "shape" | "image" | null) => void;
  setCurrentFormat: (format: any) => void;
  setIsDrawerOpen: (open: boolean) => void;
  clearSelectionState: () => void;
}

export const useToolHandlers = ({
  setEditorState,
  setToolState,
  setErasureState,
  setSelectedElementId,
  setSelectedElementType,
  setCurrentFormat,
  setIsDrawerOpen,
  clearSelectionState,
}: UseToolHandlersProps) => {
  // Tool change handler
  const handleToolChange = useCallback(
    (tool: string, enabled: boolean) => {
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
            setEditorState((prev) => ({
              ...prev,
              isSelectionMode: true,
              isAddTextBoxMode: false,
              isTextSelectionMode: false,
            }));
          }
          break;
        case "textSelection":
          if (enabled) {
            setEditorState((prev) => ({
              ...prev,
              isTextSelectionMode: true,
              isAddTextBoxMode: false,
              isSelectionMode: false,
            }));
          }
          break;
        case "addTextBox":
          if (enabled) {
            setEditorState((prev) => ({
              ...prev,
              isAddTextBoxMode: true,
              isTextSelectionMode: false,
              isSelectionMode: false,
            }));
          }
          break;
        case "rectangle":
          if (enabled) {
            setToolState((prev) => ({
              ...prev,
              shapeDrawingMode: "rectangle",
              selectedShapeType: "rectangle",
            }));
            setEditorState((prev) => ({
              ...prev,
              isAddTextBoxMode: false,
              isTextSelectionMode: false,
              isSelectionMode: false,
            }));
          }
          break;
        case "circle":
          if (enabled) {
            setToolState((prev) => ({
              ...prev,
              shapeDrawingMode: "circle",
              selectedShapeType: "circle",
            }));
            setEditorState((prev) => ({
              ...prev,
              isAddTextBoxMode: false,
              isTextSelectionMode: false,
              isSelectionMode: false,
            }));
          }
          break;
        case "line":
          if (enabled) {
            setToolState((prev) => ({
              ...prev,
              shapeDrawingMode: "line",
              selectedShapeType: "line",
            }));
            setEditorState((prev) => ({
              ...prev,
              isAddTextBoxMode: false,
              isTextSelectionMode: false,
              isSelectionMode: false,
            }));
          }
          break;
        case "erasure":
          if (enabled) {
            setErasureState((prev) => ({
              ...prev,
              isErasureMode: true,
            }));
            setEditorState((prev) => ({
              ...prev,
              isAddTextBoxMode: false,
              isTextSelectionMode: false,
              isSelectionMode: false,
            }));
          }
          break;
      }
    },
    [setEditorState, setToolState, setErasureState]
  );

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
          dragOffsets: {},
          isDragging: false,
          selectionDragOffset: null,
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
    [
      setSelectedElementId,
      setSelectedElementType,
      setIsDrawerOpen,
      setEditorState,
      setToolState,
      setErasureState,
    ]
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
          dragOffsets: {},
          isDragging: false,
          selectionDragOffset: null,
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
    [
      setSelectedElementId,
      setSelectedElementType,
      setIsDrawerOpen,
      setEditorState,
      setToolState,
      setErasureState,
    ]
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
          dragOffsets: {},
          isDragging: false,
          selectionDragOffset: null,
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
    [
      setSelectedElementId,
      setSelectedElementType,
      setIsDrawerOpen,
      setEditorState,
      setToolState,
      setErasureState,
    ]
  );

  return {
    handleToolChange,
    handleTextBoxSelect,
    handleShapeSelect,
    handleImageSelect,
  };
};
