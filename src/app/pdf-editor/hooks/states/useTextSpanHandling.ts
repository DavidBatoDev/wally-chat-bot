import { useCallback, useEffect, useRef, useState } from "react";
import { TextField, DeletionRectangle } from "../../types/pdf-editor.types";

interface UseTextSpanHandlingProps {
  isAddTextBoxMode: boolean;
  scale: number;
  currentPage: number;
  pdfBackgroundColor: string;
  erasureSettings: {
    width: number;
    height: number;
    background: string;
    opacity: number;
  };
  createDeletionRectangleForSpan: (span: HTMLElement) => string;
  createTextFieldFromSpan: (span: HTMLElement) => {
    textFieldId: string;
    properties: any;
  } | null;
  addDeletionRectangle: (
    x: number,
    y: number,
    width: number,
    height: number,
    page: number,
    background?: string,
    opacity?: number
  ) => string;
  updateTextBox: (id: string, updates: any) => void;
  setAutoFocusTextBoxId: (id: string | null) => void;
}

export const useTextSpanHandling = ({
  isAddTextBoxMode,
  scale,
  currentPage,
  pdfBackgroundColor,
  erasureSettings,
  createDeletionRectangleForSpan,
  createTextFieldFromSpan,
  addDeletionRectangle,
  updateTextBox,
  setAutoFocusTextBoxId,
}: UseTextSpanHandlingProps) => {
  const [isZooming, setIsZooming] = useState(false);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Remove icons from a text span
  const removeIconsFromSpan = useCallback((span: HTMLElement) => {
    const overlay = span.querySelector(".text-span-icons");
    if (overlay) {
      overlay.remove();
    }
    span.classList.remove("text-span-clicked");
  }, []);

  // Create icon overlay for text spans (only shown on click)
  const createIconOverlay = useCallback(
    (span: HTMLElement) => {
      // Remove existing overlay if any
      const existingOverlay = span.querySelector(".text-span-icons");
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // Add clicked class for styling
      span.classList.add("text-span-clicked");

      // Create overlay container
      const overlay = document.createElement("div");
      overlay.className = "text-span-icons";

      // Create delete icon
      const deleteIcon = document.createElement("div");
      deleteIcon.className = "text-span-icon-delete";
      deleteIcon.innerHTML = "×";
      deleteIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log("Delete icon clicked for span:", span.textContent);
        // Create deletion rectangle to cover the text
        createDeletionRectangleForSpan(span);
        // Remove icons after deletion
        removeIconsFromSpan(span);
      });

      // Create edit icon
      const editIcon = document.createElement("div");
      editIcon.className = "text-span-icon-edit";
      editIcon.innerHTML = "✎";
      editIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log("Edit icon clicked for span:", span.textContent);
        // Create text field and deletion rectangle
        const result = createTextFieldFromSpan(span);
        if (result && result.textFieldId) {
          // Update the text field with the detected properties
          updateTextBox(result.textFieldId, result.properties);
          // Set auto-focus for the new text field
          setAutoFocusTextBoxId(result.textFieldId);
        }
      });

      // Add icons to overlay
      overlay.appendChild(deleteIcon);
      overlay.appendChild(editIcon);

      // Add overlay to span
      span.appendChild(overlay);
    },
    [
      createDeletionRectangleForSpan,
      createTextFieldFromSpan,
      removeIconsFromSpan,
      updateTextBox,
      setAutoFocusTextBoxId,
    ]
  );

  // Handle text span click during add text field mode - show icons instead of creating text field
  const handleTextSpanClick = useCallback(
    (e: MouseEvent) => {
      if (!isAddTextBoxMode) return;
      e.stopPropagation();

      const span = e.currentTarget as HTMLSpanElement;
      const textContent = span.textContent || "";

      if (!textContent.trim()) return;

      // Clear any existing icons from other spans
      const allSpans = document.querySelectorAll(
        ".react-pdf__Page__textContent span"
      );
      allSpans.forEach((otherSpan) => {
        if (otherSpan !== span) {
          removeIconsFromSpan(otherSpan as HTMLElement);
        }
      });

      // Check if this span already has icons
      const hasIcons = span.querySelector(".text-span-icons");
      if (hasIcons) {
        // Remove icons if clicking the same span again
        removeIconsFromSpan(span);
      } else {
        // Show icons for this span
        createIconOverlay(span);
      }
    },
    [isAddTextBoxMode, removeIconsFromSpan, createIconOverlay]
  );

  // Handle zoom state changes
  useEffect(() => {
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }

    setIsZooming(true);

    // Set a timeout to mark zooming as complete
    zoomTimeoutRef.current = setTimeout(() => {
      setIsZooming(false);
    }, 500); // Wait 500ms after scale change to re-enable text layer

    return () => {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
    };
  }, [scale]);

  // Attach click handlers to text spans for add text field mode
  useEffect(() => {
    if (!isAddTextBoxMode || isZooming) return;

    let debounceTimer: NodeJS.Timeout;

    const attachHandlers = () => {
      // Clear any existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Debounce to prevent excessive re-attachments during zoom/render
      debounceTimer = setTimeout(() => {
        // Only proceed if we're still in add textbox mode and not zooming
        if (!isAddTextBoxMode || isZooming) return;

        const textLayerDiv = document.querySelector(
          ".react-pdf__Page__textContent"
        );
        const textSpans = document.querySelectorAll(
          ".react-pdf__Page__textContent span"
        );

        // Only attach if text layer exists and has content
        if (!textLayerDiv || textSpans.length === 0) return;

        textSpans.forEach((span) => {
          // Only attach handler once and ensure span has content
          if (!(span as any).hasListener && span.textContent?.trim()) {
            span.addEventListener("click", handleTextSpanClick as any);
            (span as any).hasListener = true;
          }
        });
      }, 200); // Increased debounce to 200ms for better stability
    };

    // Only create observer if not zooming
    let observer: MutationObserver | null = null;

    if (!isZooming) {
      // Create a mutation observer to detect when text layer updates
      observer = new MutationObserver((mutations) => {
        // Skip if we're zooming
        if (isZooming) return;

        // Only process mutations that involve text content changes
        const hasTextChanges = mutations.some((mutation) =>
          Array.from(mutation.addedNodes).some(
            (node) =>
              node.nodeType === Node.ELEMENT_NODE &&
              (node as Element).classList?.contains(
                "react-pdf__Page__textContent"
              )
          )
        );

        if (hasTextChanges) {
          attachHandlers();
        }
      });

      const documentElement = document.querySelector(".document-container");
      if (documentElement) {
        const config = {
          childList: true,
          subtree: true,
          // Only observe specific changes to reduce noise
          attributeFilter: ["class"],
        };
        observer.observe(documentElement, config);

        // Initial attachment with delay to ensure text layer is ready
        setTimeout(() => {
          attachHandlers();
        }, 300);
      }
    }

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (observer) {
        observer.disconnect();
      }

      // Clean up all handlers and overlays
      const textSpans = document.querySelectorAll(
        ".react-pdf__Page__textContent span"
      );
      textSpans.forEach((span) => {
        if ((span as any).hasListener) {
          span.removeEventListener("click", handleTextSpanClick as any);
          (span as any).hasListener = false;
        }
        removeIconsFromSpan(span as HTMLElement);
      });
    };
  }, [isAddTextBoxMode, isZooming, handleTextSpanClick, removeIconsFromSpan]);

  return {
    isZooming,
    removeIconsFromSpan,
    createIconOverlay,
  };
};
