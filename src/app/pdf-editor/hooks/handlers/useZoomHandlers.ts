import { useCallback, useEffect, useRef } from "react";
import { ViewState } from "../../types/pdf-editor.types";

interface UseZoomHandlersProps {
  viewState: ViewState;
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>;
  documentState: {
    scale: number;
    pdfRenderScale: number;
    pageWidth: number;
    pageHeight: number;
  };
  actions: {
    updateScale: (scale: number) => void;
    updateScaleWithoutRerender: (scale: number) => void;
    resetScaleChanging: () => void;
  };
  containerRef: React.RefObject<HTMLDivElement | null>;
  documentRef: React.RefObject<HTMLDivElement | null>;
}

export const useZoomHandlers = ({
  viewState,
  setViewState,
  documentState,
  actions,
  containerRef,
  documentRef,
}: UseZoomHandlersProps) => {
  // Store the current scale in a ref for immediate access
  const currentScaleRef = useRef<number>(documentState.scale);
  
  // Update ref when documentState.scale changes
  useEffect(() => {
    currentScaleRef.current = documentState.scale;
  }, [documentState.scale]);

  // Store pending scroll position
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null);

  // Apply pending scroll after scale changes
  useEffect(() => {
    if (pendingScrollRef.current && containerRef.current) {
      const { left, top } = pendingScrollRef.current;
      containerRef.current.scrollLeft = left;
      containerRef.current.scrollTop = top;
      pendingScrollRef.current = null;
    }
  }, [documentState.scale, containerRef]);

  // Main zoom handler with correct zoom-to-cursor
  const handleWheel = useCallback((e: WheelEvent) => {
    // Only zoom if CTRL or CMD is pressed
    if (!e.ctrlKey && !e.metaKey) return;
    
    // CRITICAL: Prevent default scrolling behavior
    e.preventDefault();
    e.stopPropagation();
    
    const container = containerRef.current;
    if (!container) return;
    
    // Get the current scale
    const oldScale = currentScaleRef.current;
    
    // Calculate zoom factor
    const delta = e.deltaY;
    const zoomSpeed = 0.001;
    const zoomFactor = 1 - (delta * zoomSpeed);
    const newScale = Math.max(0.1, Math.min(5.0, oldScale * zoomFactor));
    
    // If scale hasn't changed, skip
    if (Math.abs(newScale - oldScale) < 0.0001) return;
    
    // Get container rect for mouse position
    const containerRect = container.getBoundingClientRect();
    
    // Mouse position relative to container viewport
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    // Current scroll position
    const oldScrollLeft = container.scrollLeft;
    const oldScrollTop = container.scrollTop;
    
    // Calculate the document point under the cursor
    // Since the container is scaled (width = pageWidth * scale),
    // we need to unscale to get the actual document coordinates
    const docX = (oldScrollLeft + mouseX) / oldScale;
    const docY = (oldScrollTop + mouseY) / oldScale;
    
    // Calculate new scroll position to keep the document point under the cursor
    const newScrollLeft = Math.max(0, (docX * newScale) - mouseX);
    const newScrollTop = Math.max(0, (docY * newScale) - mouseY);
    
    // Store the pending scroll position
    pendingScrollRef.current = { left: newScrollLeft, top: newScrollTop };
    
    // Update scale (this will trigger the useEffect to apply scroll)
    currentScaleRef.current = newScale;
    actions.updateScale(newScale);
    
  }, [containerRef, actions]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Window-level handler to catch all events early
    const windowWheelHandler = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && container.contains(e.target as Node)) {
        handleWheel(e);
      }
    };

    // Add listeners
    window.addEventListener('wheel', windowWheelHandler, { 
      passive: false, 
      capture: true 
    });
    
    container.addEventListener('wheel', handleWheel, { 
      passive: false,
      capture: false 
    });
    
    // Prevent browser zoom
    const preventBrowserZoom = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '0')) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('keydown', preventBrowserZoom, { passive: false });
    
    // Cleanup
    return () => {
      window.removeEventListener('wheel', windowWheelHandler, { capture: true });
      container.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', preventBrowserZoom);
    };
  }, [handleWheel]);

  return {};
};