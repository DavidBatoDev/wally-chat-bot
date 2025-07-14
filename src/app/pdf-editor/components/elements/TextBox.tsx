import React, { memo, useCallback, useEffect } from "react";
import { Rnd } from "react-rnd";
import { Trash2, Move } from "lucide-react";
import { TextField } from "@/components/types";
import { measureText } from "../../utils/measurements";
import { measureWrappedTextHeight } from "../../utils/measurements";

interface TextBoxProps {
  textBox: TextField;
  isSelected: boolean;
  isEditMode: boolean;
  scale: number;
  showPaddingIndicator?: boolean;
  onSelect: (id: string) => void;
  onUpdate: (
    id: string,
    updates: Partial<TextField>,
    isOngoingOperation?: boolean
  ) => void;
  onDelete: (id: string) => void;
  isTextSelectionMode?: boolean;
  isSelectedInTextMode?: boolean;
  onTextSelectionClick?: (id: string, event: React.MouseEvent) => void;
  autoFocusId?: string | null;
  onAutoFocusComplete?: (id: string) => void;
  // Multi-selection props
  isMultiSelected?: boolean;
  selectedElementIds?: string[];
  onMultiSelectDragStart?: (id: string) => void;
  onMultiSelectDrag?: (id: string, deltaX: number, deltaY: number) => void;
  onMultiSelectDragStop?: (id: string, deltaX: number, deltaY: number) => void;
  // Selection preview prop
  isInSelectionPreview?: boolean;
}

export const MemoizedTextBox = memo(
  ({
    textBox,
    isSelected,
    isEditMode,
    scale,
    showPaddingIndicator,
    onSelect,
    onUpdate,
    onDelete,
    isTextSelectionMode,
    isSelectedInTextMode,
    onTextSelectionClick,
    autoFocusId,
    onAutoFocusComplete,
    // Multi-selection props
    isMultiSelected = false,
    selectedElementIds = [],
    onMultiSelectDragStart,
    onMultiSelectDrag,
    onMultiSelectDragStop,
    // Selection preview prop
    isInSelectionPreview = false,
  }: TextBoxProps) => {
    // Helper function to get padding object from textbox
    const getPadding = () => ({
      top: textBox.paddingTop || 0,
      right: textBox.paddingRight || 0,
      bottom: textBox.paddingBottom || 0,
      left: textBox.paddingLeft || 0,
    });

    // Helper function to check if resize would cause text clipping
    const wouldResizeCauseClipping = (newWidth: number, newHeight: number) => {
      const padding = getPadding();
      // Calculate available space for text after padding
      const availableWidth = newWidth - padding.left - padding.right;
      const availableHeight = newHeight - padding.top - padding.bottom;
      // Check if there's any space left for text
      if (availableWidth <= 0 || availableHeight <= 0) {
        // Only block if padding is nonzero
        if (
          padding.top > 0 ||
          padding.right > 0 ||
          padding.bottom > 0 ||
          padding.left > 0
        ) {
          return true;
        }
        return false;
      }
      // Calculate the actual text dimensions
      const textHeight = measureWrappedTextHeight(
        textBox.value,
        textBox.fontSize,
        textBox.fontFamily,
        availableWidth,
        padding
      );
      const { width: textWidth } = measureText(
        textBox.value,
        textBox.fontSize,
        textBox.fontFamily,
        textBox.letterSpacing || 0
      );
      // Only block if text would be clipped AND padding is nonzero
      const isClipped =
        textHeight > availableHeight || textWidth > availableWidth;
      const hasPadding =
        padding.top > 0 ||
        padding.right > 0 ||
        padding.bottom > 0 ||
        padding.left > 0;
      return isClipped && hasPadding;
    };

    const handleTextChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        onUpdate(textBox.id, { value: newValue }, true); // Mark as ongoing operation

        // Auto-resize textbox based on content changes
        if (newValue.length !== textBox.value.length) {
          const isAddingText = newValue.length > textBox.value.length;
          const isNewLine =
            (newValue.includes("\n") && !textBox.value.includes("\n")) ||
            newValue.split("\n").length > textBox.value.split("\n").length;
          const hasBeenManuallyResized =
            textBox.hasBeenManuallyResized || false;

          if (isNewLine) {
            // For new lines, only expand height, keep current width
            const { height } = measureText(
              newValue,
              textBox.fontSize,
              textBox.fontFamily,
              0, // characterSpacing
              textBox.width, // maxWidth - don't exceed current width
              getPadding()
            );

            const padding = 4;
            const newHeight = Math.max(textBox.height, height + padding);

            if (newHeight > textBox.height) {
              onUpdate(textBox.id, { height: newHeight }, true);
            }
          } else if (isAddingText) {
            // For regular text addition
            const { width, height } = measureText(
              newValue,
              textBox.fontSize,
              textBox.fontFamily,
              0, // characterSpacing
              undefined, // maxWidth
              getPadding()
            );

            const padding = 4;
            const newHeight = Math.max(textBox.height, height + padding);

            // Only expand width if the textbox hasn't been manually resized
            let updates: Partial<TextField> = {};

            if (newHeight > textBox.height) {
              updates.height = newHeight;
            }

            if (!hasBeenManuallyResized) {
              const newWidth = Math.max(textBox.width, width + padding);
              if (newWidth > textBox.width) {
                updates.width = newWidth;
              }
            }

            if (Object.keys(updates).length > 0) {
              onUpdate(textBox.id, updates, true);
            }
          }
          // Note: We don't shrink textboxes when text is deleted to avoid layout jumps
        }
      },
      [
        textBox.id,
        onUpdate,
        textBox.value,
        textBox.fontSize,
        textBox.fontFamily,
        textBox.width,
        textBox.height,
        textBox.paddingTop,
        textBox.paddingRight,
        textBox.paddingBottom,
        textBox.paddingLeft,
      ]
    );

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();

        // In text selection mode, use the text selection handler
        if (isTextSelectionMode && onTextSelectionClick) {
          onTextSelectionClick(textBox.id, e);
        } else {
          onSelect(textBox.id);
        }
      },
      [textBox.id, onSelect, isTextSelectionMode, onTextSelectionClick]
    );

    const handleFocus = useCallback(() => {
      onSelect(textBox.id);

      // Clear default text when manually focusing on a textbox with "New Text Field"
      if (textBox.value === "New Text Field") {
        onUpdate(textBox.id, { value: "" }, false);
      }
    }, [textBox.id, onSelect, textBox.value, onUpdate]);

    // Multi-selection drag handlers
    const handleDragStart = useCallback(
      (e: any, d: any) => {
        if (
          isMultiSelected &&
          selectedElementIds.length > 1 &&
          onMultiSelectDragStart
        ) {
          onMultiSelectDragStart(textBox.id);
        }
      },
      [isMultiSelected, selectedElementIds, onMultiSelectDragStart, textBox.id]
    );

    const handleDrag = useCallback(
      (e: any, d: any) => {
        if (
          isMultiSelected &&
          selectedElementIds.length > 1 &&
          onMultiSelectDrag
        ) {
          const deltaX = (d.x - textBox.x * scale) / scale;
          const deltaY = (d.y - textBox.y * scale) / scale;
          onMultiSelectDrag(textBox.id, deltaX, deltaY);
        }
      },
      [
        isMultiSelected,
        selectedElementIds,
        onMultiSelectDrag,
        textBox.id,
        textBox.x,
        textBox.y,
        scale,
      ]
    );

    const handleDragStop = useCallback(
      (e: any, d: any) => {
        if (
          isMultiSelected &&
          selectedElementIds.length > 1 &&
          onMultiSelectDragStop
        ) {
          const deltaX = (d.x - textBox.x * scale) / scale;
          const deltaY = (d.y - textBox.y * scale) / scale;
          onMultiSelectDragStop(textBox.id, deltaX, deltaY);
        } else {
          // Regular single element update
          onUpdate(textBox.id, { x: d.x / scale, y: d.y / scale }, true); // Mark as ongoing operation
        }
      },
      [
        isMultiSelected,
        selectedElementIds,
        onMultiSelectDragStop,
        textBox.id,
        textBox.x,
        textBox.y,
        scale,
        onUpdate,
      ]
    );

    // Auto-focus logic
    useEffect(() => {
      if (autoFocusId === textBox.id && onAutoFocusComplete) {
        // Use a timeout to ensure the DOM element is available after render
        const timeoutId = setTimeout(() => {
          const textareaElement = document.querySelector(
            `[data-textbox-id="${textBox.id}"]`
          ) as HTMLTextAreaElement;
          if (textareaElement) {
            textareaElement.focus();

            // If the textbox has default "New Text Field" text, clear it and position cursor
            if (textBox.value === "New Text Field") {
              onUpdate(textBox.id, { value: "" }, false);
              textareaElement.setSelectionRange(0, 0);
            } else {
              // Position cursor at the end of existing text
              textareaElement.setSelectionRange(
                textBox.value.length,
                textBox.value.length
              );
            }

            onAutoFocusComplete(textBox.id);
          }
        }, 50); // Small delay to ensure DOM is ready

        return () => clearTimeout(timeoutId);
      }
    }, [autoFocusId, textBox.id, onAutoFocusComplete, textBox.value, onUpdate]);

    // Auto-resize when font size changes
    useEffect(() => {
      // Only auto-resize if the textbox has content and is selected
      if (textBox.value && textBox.value.trim() && isSelected) {
        // Calculate new dimensions based on current content and font size
        const { width, height } = measureText(
          textBox.value,
          textBox.fontSize,
          textBox.fontFamily,
          0, // characterSpacing
          textBox.width, // maxWidth - don't exceed current width
          getPadding()
        );

        const padding = 4;
        const minHeight = Math.max(height + padding, textBox.fontSize);

        // Only auto-resize if the current height is smaller than the minimum required height
        // This allows users to manually make the textbox taller than the minimum
        if (textBox.height < minHeight) {
          onUpdate(textBox.id, { height: minHeight }, false);
        }
      }
    }, [
      textBox.fontSize,
      textBox.value,
      textBox.width,
      textBox.height,
      textBox.paddingTop,
      textBox.paddingRight,
      textBox.paddingBottom,
      textBox.paddingLeft,
      isSelected,
      onUpdate,
    ]);

    return (
      <Rnd
        key={textBox.id}
        position={{ x: textBox.x * scale, y: textBox.y * scale }}
        size={{ width: textBox.width * scale, height: textBox.height * scale }}
        bounds="parent"
        disableDragging={isTextSelectionMode}
        dragHandleClassName="drag-handle"
        enableResizing={false}
        minHeight={measureWrappedTextHeight(
          textBox.value,
          textBox.fontSize,
          textBox.fontFamily,
          textBox.width,
          getPadding()
        )}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResizeStop={(e, direction, ref, delta, position) => {
          const newWidth = parseInt(ref.style.width) / scale;
          const userSetHeight = parseInt(ref.style.height) / scale;
          const minHeight = measureWrappedTextHeight(
            textBox.value,
            textBox.fontSize,
            textBox.fontFamily,
            newWidth,
            getPadding()
          );
          const finalHeight = Math.max(userSetHeight, minHeight);

          // Check if the resize would cause text clipping
          if (!wouldResizeCauseClipping(newWidth, finalHeight)) {
            onUpdate(
              textBox.id,
              {
                x: position.x / scale,
                y: position.y / scale,
                width: newWidth,
                height: finalHeight,
                hasBeenManuallyResized: true, // Mark as manually resized
              },
              false
            ); // Don't mark as ongoing operation - resize is a one-time event
          }
        }}
        className={`${isSelected ? "ring-2 ring-gray-500 selected" : ""} ${
          isEditMode ? "edit-mode" : ""
        } ${
          isSelectedInTextMode
            ? "ring-2 ring-blue-500 text-selection-highlight"
            : ""
        } ${isMultiSelected ? "ring-2 ring-blue-500 multi-selected" : ""} ${
          isInSelectionPreview
            ? "ring-2 ring-blue-400 ring-dashed selection-preview"
            : ""
        }`}
        style={{ transform: "none" }}
        onClick={handleClick}
      >
        <div className="w-full h-full relative group">
          {/* Delete button - only show when selected and in edit mode */}
          {isEditMode && isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(textBox.id);
              }}
              className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 z-10"
              title="Delete text field"
            >
              <Trash2 size={10} />
            </button>
          )}

          {/* Move handle - only show when selected and in edit mode and NOT in text selection mode */}
          {isEditMode && isSelected && !isTextSelectionMode && (
            <div className="absolute -bottom-7 left-1 transform transition-all duration-300 z-20 flex items-center space-x-1">
              <div className="drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                <Move size={10} />
              </div>
            </div>
          )}

          {/* Resize handle - only show when selected and in edit mode and NOT in text selection mode */}
          {isEditMode && isSelected && !isTextSelectionMode && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 bg-gray-600 border-2 border-white rounded-full shadow-lg cursor-se-resize transform translate-x-1 translate-y-1 z-30 flex items-center justify-center hover:scale-110 transition-transform duration-200"
              style={{
                backgroundImage: `
                linear-gradient(45deg, transparent 30%, white 30%, white 40%, transparent 40%),
                linear-gradient(45deg, transparent 60%, white 60%, white 70%, transparent 70%)
              `,
                backgroundSize: "8px 8px",
                backgroundRepeat: "no-repeat",
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = textBox.width * scale;
                const startHeight = textBox.height * scale;

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const deltaY = moveEvent.clientY - startY;
                  const newWidth = Math.max(50, startWidth + deltaX) / scale;
                  const minHeight = measureWrappedTextHeight(
                    textBox.value,
                    textBox.fontSize,
                    textBox.fontFamily,
                    newWidth,
                    getPadding()
                  );
                  const userSetHeight = Math.max(
                    minHeight,
                    Math.max(20, startHeight + deltaY) / scale
                  );
                  const finalHeight = Math.max(userSetHeight, minHeight);

                  // Check if the resize would cause text clipping
                  if (!wouldResizeCauseClipping(newWidth, finalHeight)) {
                    onUpdate(
                      textBox.id,
                      {
                        width: newWidth,
                        height: finalHeight,
                        hasBeenManuallyResized: true, // Mark as manually resized
                      },
                      true
                    );
                  }
                };

                const handleMouseUp = (upEvent: MouseEvent) => {
                  document.removeEventListener("mousemove", handleMouseMove);
                  document.removeEventListener("mouseup", handleMouseUp);

                  // Create final undo command when resize ends
                  const finalWidth =
                    Math.max(50, startWidth + (upEvent.clientX - startX)) /
                    scale;
                  const minHeight = measureWrappedTextHeight(
                    textBox.value,
                    textBox.fontSize,
                    textBox.fontFamily,
                    finalWidth,
                    getPadding()
                  );
                  const userSetHeight = Math.max(
                    minHeight,
                    Math.max(20, startHeight + (upEvent.clientY - startY)) /
                      scale
                  );
                  const finalHeight = Math.max(userSetHeight, minHeight);

                  // Check if the resize would cause text clipping
                  if (!wouldResizeCauseClipping(finalWidth, finalHeight)) {
                    onUpdate(
                      textBox.id,
                      {
                        width: finalWidth,
                        height: finalHeight,
                        hasBeenManuallyResized: true, // Mark as manually resized
                      },
                      false
                    ); // Don't mark as ongoing operation - resize is complete
                  }
                };

                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
              }}
            />
          )}

          {/* Text content */}
          <div
            className="w-full h-full absolute"
            style={{
              transform: textBox.rotation
                ? `rotate(${textBox.rotation}deg)`
                : "none",
              transformOrigin: "center center",
            }}
          >
            <textarea
              value={textBox.value}
              onChange={handleTextChange}
              onClick={handleClick}
              onFocus={handleFocus}
              placeholder="Enter text..."
              data-textbox-id={textBox.id}
              className="absolute top-0 left-0 w-full h-full bg-transparent border-none outline-none cursor-text resize-none"
              style={{
                fontSize: `${textBox.fontSize * scale}px`,
                fontFamily: textBox.fontFamily,
                fontWeight: textBox.bold ? "bold" : "normal",
                fontStyle: textBox.italic ? "italic" : "normal",
                color: textBox.color || "#000000",
                letterSpacing: `${(textBox.letterSpacing || 0) * scale}px`,
                textAlign: textBox.textAlign || "left",
                textDecoration: textBox.underline ? "underline" : "none",
                lineHeight: textBox.lineHeight || 1.1,
                backgroundColor: isSelected
                  ? "rgba(107, 114, 128, 0.1)"
                  : textBox.backgroundColor || "transparent",
                border: textBox.borderWidth
                  ? `${textBox.borderWidth * scale}px solid ${
                      textBox.borderColor || "#000000"
                    }`
                  : "none",
                borderRadius:
                  textBox.borderTopLeftRadius !== undefined ||
                  textBox.borderTopRightRadius !== undefined ||
                  textBox.borderBottomLeftRadius !== undefined ||
                  textBox.borderBottomRightRadius !== undefined
                    ? `${(textBox.borderTopLeftRadius || 0) * scale}px ${
                        (textBox.borderTopRightRadius || 0) * scale
                      }px ${(textBox.borderBottomRightRadius || 0) * scale}px ${
                        (textBox.borderBottomLeftRadius || 0) * scale
                      }px`
                    : `${(textBox.borderRadius || 0) * scale}px`,
                padding: `${(textBox.paddingTop || 0) * scale}px ${
                  (textBox.paddingRight || 0) * scale
                }px ${(textBox.paddingBottom || 0) * scale}px ${
                  (textBox.paddingLeft || 0) * scale
                }px`,
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
              }}
            />

            {/* Padding Visual Indicator - only show when padding popup is open and this textbox is selected */}
            {showPaddingIndicator && isSelected && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Top Padding */}
                {(textBox.paddingTop || 0) > 0 && (
                  <div
                    className="absolute top-0 left-0 right-0 bg-yellow-300 bg-opacity-40 border-t-2 border-yellow-500"
                    style={{
                      height: `${(textBox.paddingTop || 0) * scale}px`,
                    }}
                  />
                )}

                {/* Right Padding */}
                {(textBox.paddingRight || 0) > 0 && (
                  <div
                    className="absolute top-0 right-0 bottom-0 bg-yellow-300 bg-opacity-40 border-r-2 border-yellow-500"
                    style={{
                      width: `${(textBox.paddingRight || 0) * scale}px`,
                    }}
                  />
                )}

                {/* Bottom Padding */}
                {(textBox.paddingBottom || 0) > 0 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-yellow-300 bg-opacity-40 border-b-2 border-yellow-500"
                    style={{
                      height: `${(textBox.paddingBottom || 0) * scale}px`,
                    }}
                  />
                )}

                {/* Left Padding */}
                {(textBox.paddingLeft || 0) > 0 && (
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-yellow-300 bg-opacity-40 border-l-2 border-yellow-500"
                    style={{
                      width: `${(textBox.paddingLeft || 0) * scale}px`,
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </Rnd>
    );
  }
);

MemoizedTextBox.displayName = "MemoizedTextBox";
