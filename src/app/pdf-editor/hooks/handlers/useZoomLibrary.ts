import { useEffect, useRef, useCallback } from "react";
import Panzoom, { PanzoomObject, PanzoomOptions } from "@panzoom/panzoom";
import { ViewState } from "../../types/pdf-editor.types";

interface UseZoomLibraryProps {
  viewState: ViewState;
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>;
  documentState: {
    scale: number;
  };
  actions: {
    updateScale: (scale: number) => void;
    updateScaleWithoutRerender: (scale: number) => void;
    resetScaleChanging: () => void;
  };
  containerRef: React.RefObject<HTMLDivElement | null>;
  documentRef: React.RefObject<HTMLDivElement | null>;
}

export const useZoomLibrary = ({
  viewState,
  setViewState,
  documentState,
  actions,
  containerRef,
  documentRef,
}: UseZoomLibraryProps) => {
  const panzoomRef = useRef<PanzoomObject | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize Panzoom
  useEffect(() => {
    const element = documentRef.current;
    const container = containerRef.current;
    
    if (!element || !container || isInitializedRef.current) return;

    const options: PanzoomOptions = {
      // Basic options
      minScale: 0.1,
      maxScale: 5,
      startScale: documentState.scale,
      
      // Disable pan - we only want zoom
      disablePan: true,
      
      // Smooth transitions
      animate: true,
      duration: 200,
      
      // Canvas mode for better performance
      canvas: false,
      
      // Use transform origin center
      origin: "center center",
      
      // Contain within parent
      contain: "outside",
      
      // Only zoom with ctrl/cmd + wheel
      noBind: true, // We'll bind our own events
    };

    // Create panzoom instance
    panzoomRef.current = Panzoom(element, options);
    isInitializedRef.current = true;

    // Handle zoom events
    element.addEventListener('panzoomzoom', (e: any) => {
      const scale = e.detail.scale;
      // Update our scale state without re-rendering
      actions.updateScaleWithoutRerender(scale);
    });

    element.addEventListener('panzoomend', () => {
      // Mark scale as settled after zoom ends
      actions.resetScaleChanging();
    });

    // Custom wheel handler for ctrl/cmd + wheel zoom
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1; // Zoom factor
        panzoomRef.current?.zoom(delta, {
          animate: false, // No animation for wheel zoom for smoother experience
        });
        
        setViewState((prev) => ({ ...prev, zoomMode: "page" }));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      element.removeEventListener('panzoomzoom', () => {});
      element.removeEventListener('panzoomend', () => {});
      panzoomRef.current?.destroy();
      panzoomRef.current = null;
      isInitializedRef.current = false;
    };
  }, [documentRef, containerRef, actions, setViewState]);

  // Update zoom when scale changes from external sources (like status bar controls)
  useEffect(() => {
    if (panzoomRef.current && documentState.scale !== panzoomRef.current.getScale()) {
      panzoomRef.current.zoom(documentState.scale, {
        animate: true,
        force: true,
      });
    }
  }, [documentState.scale]);

  // Expose zoom control methods
  const zoomIn = useCallback(() => {
    panzoomRef.current?.zoomIn({ animate: true });
  }, []);

  const zoomOut = useCallback(() => {
    panzoomRef.current?.zoomOut({ animate: true });
  }, []);

  const zoomReset = useCallback(() => {
    panzoomRef.current?.reset({ animate: true });
  }, []);

  const setZoom = useCallback((scale: number) => {
    panzoomRef.current?.zoom(scale, {
      animate: true,
      force: true,
    });
  }, []);

  return {
    zoomIn,
    zoomOut,
    zoomReset,
    setZoom,
    panzoomInstance: panzoomRef.current,
  };
};