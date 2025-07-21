import { useCallback } from "react";
import { measureText } from "../utils/measurements";
import {
  EditorState,
  TextField,
  Shape as ShapeType,
  Image as ImageType,
  ViewMode,
} from "../types/pdf-editor.types";

interface UseFormatHandlersProps {
  editorState: EditorState;
  selectedElementId: string | null;
  selectedElementType: "textbox" | "shape" | "image" | null;
  currentFormat: any;
  setCurrentFormat: (format: any) => void;
  viewState: {
    currentView: ViewMode;
  };
  getCurrentTextBoxes: (view: ViewMode) => TextField[];
  getCurrentImages: (view: ViewMode) => ImageType[];
  updateTextBoxWithUndo: (id: string, updates: any, isOngoing?: boolean) => void;
  updateShapeWithUndo: (id: string, updates: any, isOngoing?: boolean) => void;
  updateImage: (id: string, updates: any) => void;
}

export const useFormatHandlers = ({
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
}: UseFormatHandlersProps) => {
  // Helper function to calculate new textbox dimensions when font properties change
  const calculateTextboxDimensionsForFontChange = useCallback(
    (textBox: TextField, newFontSize?: number, newFontFamily?: string) => {
      const padding = {
        top: textBox.paddingTop || 0,
        right: textBox.paddingRight || 0,
        bottom: textBox.paddingBottom || 0,
        left: textBox.paddingLeft || 0,
      };

      // Use new values or fall back to current values
      const fontSize = newFontSize || textBox.fontSize || 12;
      const fontFamily = newFontFamily || textBox.fontFamily || "Arial";

      // Calculate new dimensions based on the new font properties
      const { width: newTextWidth, height: newTextHeight } = measureText(
        textBox.value,
        fontSize,
        fontFamily,
        textBox.letterSpacing || 0,
        textBox.width, // Use current width as maxWidth to maintain width if text fits
        padding
      );

      // Add some padding for better visual appearance
      const paddingBuffer = 4;
      const newWidth = Math.max(newTextWidth + paddingBuffer, textBox.width);
      const newHeight = Math.max(newTextHeight + paddingBuffer, textBox.height);

      return { width: newWidth, height: newHeight };
    },
    []
  );

  // Format change handler for ElementFormatDrawer
  const handleFormatChange = useCallback(
    (format: any) => {
      // Check if we're in multi-selection mode
      const isMultiSelection =
        currentFormat &&
        "isMultiSelection" in currentFormat &&
        currentFormat.isMultiSelection;

      // Helper to check if any padding key is present in format
      const isPaddingChange =
        "paddingTop" in format ||
        "paddingRight" in format ||
        "paddingBottom" in format ||
        "paddingLeft" in format;

      if (
        isMultiSelection &&
        editorState.multiSelection.selectedElements.length > 0
      ) {
        // Handle multi-selection format changes
        const { selectedElements } = editorState.multiSelection;

        if (selectedElementType === "textbox") {
          // Apply text format changes to all selected textboxes
          selectedElements.forEach((element) => {
            if (element.type === "textbox") {
              // Get current textbox state
              const currentTextBox = getCurrentTextBoxes(
                viewState.currentView
              ).find((tb) => tb.id === element.id);

              if (
                currentTextBox &&
                ("fontSize" in format ||
                  "fontFamily" in format ||
                  isPaddingChange)
              ) {
                // Use new or current padding values
                const padding = {
                  top:
                    format.paddingTop !== undefined
                      ? format.paddingTop
                      : currentTextBox.paddingTop || 0,
                  right:
                    format.paddingRight !== undefined
                      ? format.paddingRight
                      : currentTextBox.paddingRight || 0,
                  bottom:
                    format.paddingBottom !== undefined
                      ? format.paddingBottom
                      : currentTextBox.paddingBottom || 0,
                  left:
                    format.paddingLeft !== undefined
                      ? format.paddingLeft
                      : currentTextBox.paddingLeft || 0,
                };

                // If font properties are changing, use new values, else use current
                const fontSize =
                  format.fontSize !== undefined
                    ? format.fontSize
                    : currentTextBox.fontSize;
                const fontFamily =
                  format.fontFamily !== undefined
                    ? format.fontFamily
                    : currentTextBox.fontFamily;

                const { width: newTextWidth, height: newTextHeight } =
                  measureText(
                    currentTextBox.value,
                    fontSize,
                    fontFamily,
                    currentTextBox.letterSpacing || 0,
                    undefined,
                    padding
                  );

                const paddingBuffer = 4;
                const newWidth = newTextWidth + paddingBuffer;
                const newHeight = newTextHeight + paddingBuffer;

                const updates = {
                  ...format,
                  width: newWidth,
                  height: newHeight,
                };

                updateTextBoxWithUndo(element.id, updates);
              } else {
                updateTextBoxWithUndo(element.id, format);
              }
            }
          });
        } else if (selectedElementType === "shape") {
          // Apply shape format changes to all selected shapes
          const updates: Partial<ShapeType> = {};

          // Map shape-specific format changes
          if ("type" in format) updates.type = format.type;
          if ("fillColor" in format) updates.fillColor = format.fillColor;
          if ("fillOpacity" in format) updates.fillOpacity = format.fillOpacity;
          if ("borderColor" in format) updates.borderColor = format.borderColor;
          if ("borderWidth" in format) updates.borderWidth = format.borderWidth;
          if ("rotation" in format) updates.rotation = format.rotation;
          if ("borderRadius" in format)
            updates.borderRadius = format.borderRadius;

          selectedElements.forEach((element) => {
            if (element.type === "shape") {
              updateShapeWithUndo(element.id, updates);
            }
          });
        }
      } else if (selectedElementType === "textbox" && selectedElementId) {
        // Handle single text field format changes
        const currentTextBox = getCurrentTextBoxes(viewState.currentView).find(
          (tb) => tb.id === selectedElementId
        );

        if (
          currentTextBox &&
          ("fontSize" in format || "fontFamily" in format || isPaddingChange)
        ) {
          // Use new or current padding values
          const padding = {
            top:
              format.paddingTop !== undefined
                ? format.paddingTop
                : currentTextBox.paddingTop || 0,
            right:
              format.paddingRight !== undefined
                ? format.paddingRight
                : currentTextBox.paddingRight || 0,
            bottom:
              format.paddingBottom !== undefined
                ? format.paddingBottom
                : currentTextBox.paddingBottom || 0,
            left:
              format.paddingLeft !== undefined
                ? format.paddingLeft
                : currentTextBox.paddingLeft || 0,
          };
          // If font properties are changing, use new values, else use current
          const fontSize =
            format.fontSize !== undefined
              ? format.fontSize
              : currentTextBox.fontSize;
          const fontFamily =
            format.fontFamily !== undefined
              ? format.fontFamily
              : currentTextBox.fontFamily;
          const { width: newTextWidth, height: newTextHeight } = measureText(
            currentTextBox.value,
            fontSize,
            fontFamily,
            currentTextBox.letterSpacing || 0,
            undefined,
            padding
          );
          const paddingBuffer = 4;
          const newWidth = newTextWidth + paddingBuffer;
          const newHeight = newTextHeight + paddingBuffer;
          const updates = {
            ...format,
            width: newWidth,
            height: newHeight,
          };
          updateTextBoxWithUndo(selectedElementId, updates);
        } else {
          updateTextBoxWithUndo(selectedElementId, format);
        }
      } else if (selectedElementType === "shape" && selectedElementId) {
        // Handle single shape format changes
        const updates: Partial<ShapeType> = {};

        // Map shape-specific format changes
        if ("type" in format) updates.type = format.type;
        if ("fillColor" in format) updates.fillColor = format.fillColor;
        if ("fillOpacity" in format) updates.fillOpacity = format.fillOpacity;
        if ("borderColor" in format) updates.borderColor = format.borderColor;
        if ("borderWidth" in format) updates.borderWidth = format.borderWidth;
        if ("rotation" in format) updates.rotation = format.rotation;
        if ("borderRadius" in format)
          updates.borderRadius = format.borderRadius;

        updateShapeWithUndo(selectedElementId, updates);
      } else if (selectedElementType === "image" && selectedElementId) {
        // Handle image format changes
        const updates: Partial<ImageType> = {};

        // Check for special resetAspectRatio command
        if ("resetAspectRatio" in format && format.resetAspectRatio) {
          // Find the current image
          const currentImage = getCurrentImages(viewState.currentView).find(
            (img) => img.id === selectedElementId
          );
          if (currentImage) {
            // Create a temporary image element to get natural dimensions
            const img = new Image();
            img.onload = () => {
              const originalAspectRatio = img.naturalWidth / img.naturalHeight;
              const newHeight = currentImage.width / originalAspectRatio;

              const aspectRatioUpdates: Partial<ImageType> = {
                height: newHeight,
              };

              // Update the image with new height to maintain aspect ratio
              updateImage(selectedElementId, aspectRatioUpdates);

              // Update the current format to keep drawer in sync
              if (currentFormat && "src" in currentFormat) {
                setCurrentFormat({
                  ...currentFormat,
                  ...aspectRatioUpdates,
                } as ImageType);
              }
            };
            img.src = currentImage.src;
            return; // Exit early since we're handling this specially
          }
        }

        // Map image-specific format changes
        if ("opacity" in format) updates.opacity = format.opacity;
        if ("borderColor" in format) updates.borderColor = format.borderColor;
        if ("borderWidth" in format) updates.borderWidth = format.borderWidth;
        if ("borderRadius" in format)
          updates.borderRadius = format.borderRadius;
        if ("rotation" in format) updates.rotation = format.rotation;

        updateImage(selectedElementId, updates);

        // Update the current format to keep drawer in sync
        if (currentFormat && "src" in currentFormat) {
          setCurrentFormat({ ...currentFormat, ...updates } as ImageType);
        }
      }
    },
    [
      selectedElementId,
      selectedElementType,
      editorState.multiSelection.selectedElements,
      currentFormat,
      updateTextBoxWithUndo,
      updateShapeWithUndo,
      updateImage,
      getCurrentImages,
      getCurrentTextBoxes,
      viewState.currentView,
      setCurrentFormat,
      calculateTextboxDimensionsForFontChange,
    ]
  );

  return {
    handleFormatChange,
    calculateTextboxDimensionsForFontChange,
  };
};
