import { useCallback, useEffect, useRef } from "react";
import { ViewState } from "../../types/pdf-editor.types";

interface UseZoomHandlersProps {
  viewState: ViewState;
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>;
  documentState: {
    scale: number;
    pdfRenderScale: number;
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
  // Simple direct zoom without complex throttling
  const handleWheel = useCallback((e: WheelEvent) => {
    // Check for ctrl/cmd key
    if (!e.ctrlKey && !e.metaKey) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Calculate new scale with smaller increments for smoother zoom
    const delta = e.deltaY;
    const zoomSpeed = 0.001; // Reduced for smoother zoom
    const zoomFactor = 1 - delta * zoomSpeed;
    const newScale = Math.max(0.1, Math.min(5.0, documentState.scale * zoomFactor));
    
    // Update scale directly for immediate response
    actions.updateScale(newScale);
  }, [documentState.scale, actions]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add wheel listener to container with capture
    const containerHandler = (e: WheelEvent) => {
      handleWheel(e);
    };
    
    container.addEventListener('wheel', containerHandler, { passive: false, capture: true });
    
    // Also add to window as backup
    const windowHandler = (e: WheelEvent) => {
      if (container.contains(e.target as Node)) {
        handleWheel(e);
      }
    };
    
    window.addEventListener('wheel', windowHandler, { passive: false, capture: true });

    return () => {
      container.removeEventListener('wheel', containerHandler);
      window.removeEventListener('wheel', windowHandler);
    };
  }, [handleWheel, containerRef]);

  return {};
};
