import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  startTransition,
} from "react";
import { Rnd } from "react-rnd";
import { Trash2, Move, Copy } from "lucide-react";
import { TextField } from "../../types/pdf-editor.types";
import { measureText } from "../../utils/measurements";
import { measureWrappedTextHeight } from "../../utils/measurements";
import { dragThrottle } from "../../utils/performance";

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
  onDuplicate?: (id: string) => void;
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
  // Element index for z-index ordering
  elementIndex?: number;
  // Transform-based drag offset for performance optimization
  dragOffset?: { x: number; y: number } | null;
}

// Custom comparison function for memo to prevent unnecessary rerenders
const arePropsEqual = (prevProps: TextBoxProps, nextProps: TextBoxProps) => {
  // Check if the textbox object itself changed (most important check)
  if (prevProps.textBox !== nextProps.textBox) {
    // If objects are different, check if the actual content changed
    const prev = prevProps.textBox;
    const next = nextProps.textBox;

    // Check all relevant textbox properties
    if (
      prev.id !== next.id ||
      prev.value !== next.value ||
      prev.x !== next.x ||
      prev.y !== next.y ||
      prev.width !== next.width ||
      prev.height !== next.height ||
      prev.fontSize !== next.fontSize ||
      prev.fontFamily !== next.fontFamily ||
      prev.color !== next.color ||
      prev.backgroundColor !== next.backgroundColor ||
      prev.textAlign !== next.textAlign ||
      prev.paddingTop !== next.paddingTop ||
      prev.paddingRight !== next.paddingRight ||
      prev.paddingBottom !== next.paddingBottom ||
      prev.paddingLeft !== next.paddingLeft ||
      prev.hasBeenManuallyResized !== next.hasBeenManuallyResized ||
      prev.page !== next.page
    ) {
      return false;
    }
  }

  // Check other important props that affect rendering
  if (
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.isEditMode !== nextProps.isEditMode ||
    prevProps.scale !== nextProps.scale ||
    prevProps.showPaddingIndicator !== nextProps.showPaddingIndicator ||
    prevProps.isTextSelectionMode !== nextProps.isTextSelectionMode ||
    prevProps.isSelectedInTextMode !== nextProps.isSelectedInTextMode ||
    prevProps.autoFocusId !== nextProps.autoFocusId ||
    prevProps.isInSelectionPreview !== nextProps.isInSelectionPreview ||
    prevProps.elementIndex !== nextProps.elementIndex
  ) {
    return false;
  }

  // Check drag offset for transform-based dragging performance
  const prevDragOffset = prevProps.dragOffset;
  const nextDragOffset = nextProps.dragOffset;
  if (
    (prevDragOffset === null) !== (nextDragOffset === null) ||
    (prevDragOffset && nextDragOffset && 
     (prevDragOffset.x !== nextDragOffset.x || prevDragOffset.y !== nextDragOffset.y))
  ) {
    return false;
  }

  // For multi-selection, only check if this specific textbox's selection state changed
  const prevIsMultiSelected =
    prevProps.selectedElementIds?.includes(prevProps.textBox.id) || false;
  const nextIsMultiSelected =
    nextProps.selectedElementIds?.includes(nextProps.textBox.id) || false;

  if (prevIsMultiSelected !== nextIsMultiSelected) {
    return false;
  }

  // All relevant props are the same, no need to rerender
  return true;
};

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
    onDuplicate,
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
    // Element index for z-index ordering
    elementIndex = 0,
    dragOffset,
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
      // Only block if there is literally no space for text
      return availableWidth <= 0 || availableHeight <= 0;
    };

    // Memoize padding calculation to avoid recalculation on every render
    const padding = useMemo(
      () => getPadding(),
      [
        textBox.paddingTop,
        textBox.paddingRight,
        textBox.paddingBottom,
        textBox.paddingLeft,
      ]
    );

    // Memoize stable textbox properties to reduce callback dependencies
    const textBoxProps = useMemo(
      () => ({
        id: textBox.id,
        fontSize: textBox.fontSize,
        fontFamily: textBox.fontFamily,
        width: textBox.width,
        height: textBox.height,
        hasBeenManuallyResized: textBox.hasBeenManuallyResized || false,
      }),
      [
        textBox.id,
        textBox.fontSize,
        textBox.fontFamily,
        textBox.width,
        textBox.height,
        textBox.hasBeenManuallyResized,
      ]
    );

    // Debounce timer ref for resize operations
    const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastResizeRequestRef = useRef<number>(0);
    const isTypingFastRef = useRef<boolean>(false);
    const fastTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Immediate text change handler (for responsive typing)
    const handleTextChangeImmediate = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;

        // Always update the text value immediately for responsive typing
        onUpdate(textBoxProps.id, { value: newValue }, true);

        // Detect fast typing
        const now = Date.now();
        const timeSinceLastResize = now - lastResizeRequestRef.current;

        if (timeSinceLastResize < 100) {
          // Less than 100ms between keystrokes = fast typing
          isTypingFastRef.current = true;

          // Reset fast typing flag after user stops typing
          if (fastTypingTimeoutRef.current) {
            clearTimeout(fastTypingTimeoutRef.current);
          }
          fastTypingTimeoutRef.current = setTimeout(() => {
            isTypingFastRef.current = false;
          }, 500); // 500ms of no typing to reset fast typing flag
        }

        lastResizeRequestRef.current = now;
      },
      [onUpdate, textBoxProps.id]
    );

    // Debounced resize handler (for expensive operations)
    const handleTextChangeDebounced = useCallback(
      (newValue: string) => {
        const currentValue = textBox.value;

        // Skip expensive resize operations during fast typing
        if (isTypingFastRef.current) {
          return;
        }

        // Auto-resize textbox based on content changes
        if (newValue.length !== currentValue.length) {
          const isAddingText = newValue.length > currentValue.length;
          const isNewLine =
            (newValue.includes("\n") && !currentValue.includes("\n")) ||
            newValue.split("\n").length > currentValue.split("\n").length;

          if (isNewLine) {
            // For new lines, update both width and height
            const { width, height } = measureText(
              newValue,
              textBoxProps.fontSize,
              textBoxProps.fontFamily,
              0, // characterSpacing
              undefined, // Remove maxWidth constraint to get natural width
              padding
            );

            const paddingValue = 4;
            const newWidth = Math.max(textBoxProps.width, width + paddingValue);
            const newHeight = Math.max(
              textBoxProps.height,
              height + paddingValue
            );

            let updates: Partial<TextField> = {};

            if (newWidth > textBoxProps.width) {
              updates.width = newWidth;
            }

            if (newHeight > textBoxProps.height) {
              updates.height = newHeight;
            }

            if (Object.keys(updates).length > 0) {
              // Use startTransition for non-critical resize updates
              startTransition(() => {
                onUpdate(textBoxProps.id, updates, true);
              });
            }
          } else if (isAddingText) {
            // For regular text addition
            const { width, height } = measureText(
              newValue,
              textBoxProps.fontSize,
              textBoxProps.fontFamily,
              0, // characterSpacing
              undefined, // maxWidth
              padding
            );

            const paddingValue = 4;
            const newHeight = Math.max(
              textBoxProps.height,
              height + paddingValue
            );

            // Only expand width if the textbox hasn't been manually resized
            let updates: Partial<TextField> = {};

            if (newHeight > textBoxProps.height) {
              updates.height = newHeight;
            }

            if (!textBoxProps.hasBeenManuallyResized) {
              const newWidth = Math.max(
                textBoxProps.width,
                width + paddingValue
              );
              if (newWidth > textBoxProps.width) {
                updates.width = newWidth;
              }
            }

            if (Object.keys(updates).length > 0) {
              // Use startTransition for non-critical resize updates
              startTransition(() => {
                onUpdate(textBoxProps.id, updates, true);
              });
            }
          }
          // Note: We don't shrink textboxes when text is deleted to avoid layout jumps
        }
      },
      [onUpdate, textBox.value, textBoxProps, padding]
    );

    // Combined text change handler with debouncing for resize operations
    const handleTextChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;

        // Update text immediately for responsive typing
        handleTextChangeImmediate(e);

        // Debounce expensive resize calculations
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }

        // Use more aggressive debouncing during fast typing
        const debounceDelay = isTypingFastRef.current ? 500 : 150;

        resizeTimeoutRef.current = setTimeout(() => {
          // Use requestIdleCallback for non-critical resize operations during fast typing
          if (isTypingFastRef.current && window.requestIdleCallback) {
            window.requestIdleCallback(
              () => {
                handleTextChangeDebounced(newValue);
              },
              { timeout: 1000 }
            ); // Max 1 second delay
          } else {
            handleTextChangeDebounced(newValue);
          }
        }, debounceDelay);
      },
      [handleTextChangeImmediate, handleTextChangeDebounced]
    );

    // Cleanup timeouts on unmount
    useEffect(() => {
      return () => {
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        if (fastTypingTimeoutRef.current) {
          clearTimeout(fastTypingTimeoutRef.current);
        }
      };
    }, []);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        // Don't allow selection if we're currently dragging AND this is not the selected element
        if (
          document.body.classList.contains("dragging-element") &&
          !isSelected
        ) {
          return;
        }

        e.stopPropagation();

        // In text selection mode, use the text selection handler
        if (isTextSelectionMode && onTextSelectionClick) {
          onTextSelectionClick(textBoxProps.id, e);
        } else {
          onSelect(textBoxProps.id);
        }
      },
      [
        textBoxProps.id,
        onSelect,
        isTextSelectionMode,
        onTextSelectionClick,
        isSelected,
      ]
    );

    const handleFocus = useCallback(() => {
      console.log(`TextBox focused: ${textBoxProps.id}`, {
        textBoxId: textBoxProps.id,
        value: textBox.value,
        x: textBox.x,
        y: textBox.y,
        width: textBoxProps.width,
        height: textBoxProps.height,
        page: textBox.page,
      });
      onSelect(textBoxProps.id);

      // Clear default text when manually focusing on a textbox with "New Text Field"
      if (textBox.value === "New Text Field") {
        onUpdate(textBoxProps.id, { value: "" }, false);
      }
    }, [
      textBoxProps.id,
      onSelect,
      textBox.value,
      onUpdate,
      textBox.x,
      textBox.y,
      textBoxProps.width,
      textBoxProps.height,
      textBox.page,
    ]);

    // Track if this element is the one being actively dragged
    const isActivelyDraggedRef = useRef(false);

    const handleDragStart = useCallback(
      (e: any, d: any) => {
        isActivelyDraggedRef.current = true;
        document.body.classList.add("dragging-element");
        if (
          isMultiSelected &&
          selectedElementIds.length > 1 &&
          onMultiSelectDragStart
        ) {
          onMultiSelectDragStart(textBoxProps.id);
        }
      },
      [
        isMultiSelected,
        selectedElementIds,
        onMultiSelectDragStart,
        textBoxProps.id,
      ]
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
          onMultiSelectDrag(textBoxProps.id, deltaX, deltaY);
        }
      },
      [
        isMultiSelected,
        selectedElementIds,
        onMultiSelectDrag,
        textBoxProps.id,
        textBox.x,
        textBox.y,
        scale,
      ]
    );

    // Create a throttled version of the drag handler that only works for the actively dragged element
    const throttledHandleDrag = useCallback(
      dragThrottle((e: any, d: any) => {
        // Only process multi-select drag if this element initiated the drag
        if (
          isActivelyDraggedRef.current &&
          isMultiSelected &&
          selectedElementIds.length > 1 &&
          onMultiSelectDrag
        ) {
          const deltaX = (d.x - textBox.x * scale) / scale;
          const deltaY = (d.y - textBox.y * scale) / scale;
          onMultiSelectDrag(textBoxProps.id, deltaX, deltaY);
        }
      }, { fps: 60, immediate: true }),
      [
        isMultiSelected,
        selectedElementIds,
        onMultiSelectDrag,
        textBoxProps.id,
        textBox.x,
        textBox.y,
        scale,
      ]
    );

    const handleDragStop = useCallback(
      (e: any, d: any) => {
        const wasActivelyDragged = isActivelyDraggedRef.current;
        isActivelyDraggedRef.current = false;
        
        // Remove the class after drag with a small delay to prevent immediate selection
        setTimeout(() => {
          document.body.classList.remove("dragging-element");
        }, 50);

        if (
          wasActivelyDragged &&
          isMultiSelected &&
          selectedElementIds.length > 1 &&
          onMultiSelectDragStop
        ) {
          const deltaX = (d.x - textBox.x * scale) / scale;
          const deltaY = (d.y - textBox.y * scale) / scale;
          onMultiSelectDragStop(textBoxProps.id, deltaX, deltaY);
        } else if (!isMultiSelected || selectedElementIds.length <= 1) {
          // Regular single element update
          onUpdate(textBoxProps.id, { x: d.x / scale, y: d.y / scale }, true); // Mark as ongoing operation
        }
      },
      [
        isMultiSelected,
        selectedElementIds,
        onMultiSelectDragStop,
        textBoxProps.id,
        textBox.x,
        textBox.y,
        scale,
        onUpdate,
      ]
    );

    // Auto-focus logic
    useEffect(() => {
      if (autoFocusId === textBoxProps.id && onAutoFocusComplete) {
        // Use a timeout to ensure the DOM element is available after render
        const timeoutId = setTimeout(() => {
          const textareaElement = document.querySelector(
            `[data-textbox-id="${textBoxProps.id}"]`
          ) as HTMLTextAreaElement;
          if (textareaElement) {
            textareaElement.focus();

            // If the textbox has default "New Text Field" text, clear it and position cursor
            if (textBox.value === "New Text Field") {
              onUpdate(textBoxProps.id, { value: "" }, false);
              textareaElement.setSelectionRange(0, 0);
            } else {
              // Position cursor at the end of existing text
              textareaElement.setSelectionRange(
                textBox.value.length,
                textBox.value.length
              );
            }

            onAutoFocusComplete(textBoxProps.id);
          }
        }, 50); // Small delay to ensure DOM is ready

        return () => clearTimeout(timeoutId);
      }
    }, [
      autoFocusId,
      textBoxProps.id,
      onAutoFocusComplete,
      textBox.value,
      onUpdate,
    ]);

    // Auto-resize when font size changes
    useEffect(() => {
      // Only auto-resize if the textbox has content and is selected
      if (textBox.value && textBox.value.trim() && isSelected) {
        // Calculate new dimensions based on current content and font size
        const { width, height } = measureText(
          textBox.value,
          textBoxProps.fontSize,
          textBoxProps.fontFamily,
          0, // characterSpacing
          undefined, // Remove maxWidth constraint to get natural dimensions
          padding
        );

        const paddingValue = 4;
        const newWidth = Math.max(textBoxProps.width, width + paddingValue);
        const newHeight = Math.max(
          height + paddingValue,
          textBoxProps.fontSize
        );

        let updates: Partial<TextField> = {};

        // Always update both width and height when font size changes
        if (newWidth > textBoxProps.width) {
          updates.width = newWidth;
        }

        if (textBoxProps.height < newHeight) {
          updates.height = newHeight;
        }

        if (Object.keys(updates).length > 0) {
          onUpdate(textBoxProps.id, updates, false);
        }
      }
    }, [
      textBoxProps.id,
      textBoxProps.fontSize,
      textBoxProps.fontFamily,
      textBox.value,
      textBoxProps.width,
      textBoxProps.height,
      padding,
      isSelected,
      onUpdate,
    ]);

    return (
      <Rnd
        key={textBoxProps.id}
        data-element-id={textBox.id}
        position={{ x: textBox.x * scale, y: textBox.y * scale }}
        size={{
          width: textBoxProps.width * scale,
          height: textBoxProps.height * scale,
        }}
        bounds="parent"
        disableDragging={isTextSelectionMode}
        dragHandleClassName="drag-handle"
        enableResizing={false}
        minHeight={measureWrappedTextHeight(
          textBox.value,
          textBoxProps.fontSize,
          textBoxProps.fontFamily,
          textBoxProps.width,
          padding
        )}
        onDragStart={handleDragStart}
        onDrag={throttledHandleDrag}
        onDragStop={handleDragStop}
        onResizeStop={(e, direction, ref, delta, position) => {
          const newWidth = parseInt(ref.style.width) / scale;
          const userSetHeight = parseInt(ref.style.height) / scale;
          const minHeight = measureWrappedTextHeight(
            textBox.value,
            textBoxProps.fontSize,
            textBoxProps.fontFamily,
            newWidth,
            padding
          );
          const finalHeight = Math.max(userSetHeight, minHeight);

          // Check if the resize would cause text clipping
          if (!wouldResizeCauseClipping(newWidth, finalHeight)) {
            onUpdate(
              textBoxProps.id,
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
        } ${isEditMode && !isSelected ? "edit-mode-unselected" : ""} ${
          isSelectedInTextMode
            ? "ring-2 ring-blue-500 text-selection-highlight"
            : ""
        } ${isMultiSelected ? "ring-2 ring-blue-500 multi-selected" : ""} ${
          isInSelectionPreview
            ? "ring-2 ring-blue-400 ring-dashed selection-preview"
            : ""
        }`}
        style={{
          transform: dragOffset 
            ? `translate(${dragOffset.x * scale}px, ${dragOffset.y * scale}px)` 
            : "none",
          zIndex: isSelected ? 9999 : elementIndex,
          willChange: dragOffset ? 'transform' : 'auto',
        }}
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
              className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200"
              style={{ zIndex: 10 }}
              title="Delete text field"
            >
              <Trash2 size={10} />
            </button>
          )}

          {/* Move handle and Duplicate button - only show when selected and in edit mode and NOT in text selection mode */}
          {isEditMode && isSelected && !isTextSelectionMode && (
            <div
              className="absolute -bottom-7 left-1 transform transition-all duration-300 flex items-center space-x-1"
              style={{ zIndex: 20 }}
            >
              <div className="drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                <Move size={10} />
              </div>
              {onDuplicate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(textBox.id);
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200"
                  title="Duplicate text field"
                >
                  <Copy size={10} />
                </button>
              )}
            </div>
          )}

          {/* Resize handle - only show when selected and in edit mode and NOT in text selection mode */}
          {isEditMode && isSelected && !isTextSelectionMode && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 bg-gray-600 border-2 border-white rounded-full shadow-lg cursor-se-resize transform translate-x-1 translate-y-1 flex items-center justify-center hover:scale-110 transition-transform duration-200"
              style={{
                backgroundImage: `
                linear-gradient(45deg, transparent 30%, white 30%, white 40%, transparent 40%),
                linear-gradient(45deg, transparent 60%, white 60%, white 70%, transparent 70%)
              `,
                backgroundSize: "8px 8px",
                backgroundRepeat: "no-repeat",
                zIndex: 30,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault(); // Prevent text selection

                // Add class to body to prevent text selection globally
                document.body.classList.add("resizing-element");

                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = textBoxProps.width * scale;
                const startHeight = textBoxProps.height * scale;

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const deltaY = moveEvent.clientY - startY;
                  const newWidth = Math.max(50, startWidth + deltaX) / scale;
                  const minHeight = measureWrappedTextHeight(
                    textBox.value,
                    textBoxProps.fontSize,
                    textBoxProps.fontFamily,
                    newWidth,
                    padding
                  );
                  const userSetHeight = Math.max(
                    minHeight,
                    Math.max(20, startHeight + deltaY) / scale
                  );
                  const finalHeight = Math.max(userSetHeight, minHeight);

                  // Check if the resize would cause text clipping
                  if (!wouldResizeCauseClipping(newWidth, finalHeight)) {
                    onUpdate(
                      textBoxProps.id,
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

                  // Remove class from body to restore text selection
                  document.body.classList.remove("resizing-element");

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
              value={
                isEditMode || (textBox.value && textBox.value.trim() !== "")
                  ? textBox.value
                  : ""
              }
              onChange={handleTextChange}
              onClick={handleClick}
              onFocus={handleFocus}
              placeholder={
                isEditMode ? textBox.placeholder || "Enter Text..." : ""
              }
              data-textbox-id={textBoxProps.id}
              className="absolute top-0 left-0 w-full h-full bg-transparent overflow-hidden border-none outline-none cursor-text resize-none"
              style={{
                fontSize: `${textBoxProps.fontSize * scale}px`,
                fontFamily: textBoxProps.fontFamily,
                fontWeight: textBox.bold ? "bold" : "normal",
                fontStyle: textBox.italic ? "italic" : "normal",
                color:
                  textBox.color && textBox.color !== "transparent"
                    ? textBox.textOpacity !== undefined &&
                      textBox.textOpacity < 1 &&
                      textBox.color.startsWith("#")
                      ? `rgba(${parseInt(
                          textBox.color.slice(1, 3),
                          16
                        )},${parseInt(
                          textBox.color.slice(3, 5),
                          16
                        )},${parseInt(textBox.color.slice(5, 7), 16)},${
                          textBox.textOpacity
                        })`
                      : textBox.color
                    : `rgba(0,0,0,${
                        textBox.textOpacity !== undefined
                          ? textBox.textOpacity
                          : 1
                      })`,
                letterSpacing: `${(textBox.letterSpacing || 0) * scale}px`,
                textAlign: textBox.textAlign || "left",
                textDecoration: textBox.underline ? "underline" : "none",
                lineHeight: textBox.lineHeight || 1.1,
                backgroundColor:
                  textBox.backgroundColor &&
                  textBox.backgroundColor !== "transparent"
                    ? textBox.backgroundOpacity !== undefined &&
                      textBox.backgroundOpacity < 1 &&
                      textBox.backgroundColor.startsWith("#")
                      ? `rgba(${parseInt(
                          textBox.backgroundColor.slice(1, 3),
                          16
                        )},${parseInt(
                          textBox.backgroundColor.slice(3, 5),
                          16
                        )},${parseInt(
                          textBox.backgroundColor.slice(5, 7),
                          16
                        )},${textBox.backgroundOpacity})`
                      : textBox.backgroundColor
                    : "transparent",
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
  },
  arePropsEqual
);

MemoizedTextBox.displayName = "MemoizedTextBox";
