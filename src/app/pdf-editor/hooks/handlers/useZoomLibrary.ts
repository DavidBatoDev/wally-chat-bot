import { useEffect, useRef, useCallback } from "react";
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
  // Since the existing codebase applies scale manually to all elements,
  // we'll keep using the existing scale state management but enhance it
  // with better zoom controls and animations
  
  const currentScaleRef = useRef(documentState.scale);
  const targetScaleRef = useRef(documentState.scale);
  const animationFrameRef = useRef<number | null>(null);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    currentScaleRef.current = documentState.scale;
  }, [documentState.scale]);

  // Smooth zoom animation
  const animateZoom = useCallback((targetScale: number, duration: number = 200) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startScale = currentScaleRef.current;
    const startTime = performance.now();
    targetScaleRef.current = targetScale;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      const easedProgress = easeOutCubic(progress);
      
      const newScale = startScale + (targetScale - startScale) * easedProgress;
      
      actions.updateScaleWithoutRerender(newScale);
      currentScaleRef.current = newScale;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
        // Mark scale as settled after animation
        if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = setTimeout(() => {
          actions.resetScaleChanging();
          zoomTimeoutRef.current = null;
        }, 50);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [actions]);

  // Enhanced wheel zoom handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let accumulatedDelta = 0;
    let wheelTimeout: NodeJS.Timeout | null = null;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        // Accumulate wheel delta for smoother zooming
        accumulatedDelta += e.deltaY;
        
        // Clear previous timeout
        if (wheelTimeout) clearTimeout(wheelTimeout);
        
        // Debounce wheel events
        wheelTimeout = setTimeout(() => {
          const zoomFactor = 0.002; // Smaller factor for smoother zoom
          const delta = -accumulatedDelta * zoomFactor;
          const currentScale = targetScaleRef.current || currentScaleRef.current;
          const newScale = Math.max(0.1, Math.min(5.0, currentScale * (1 + delta)));
          
          // Round to nearest 0.05 for cleaner values
          const roundedScale = Math.round(newScale * 20) / 20;
          
          if (roundedScale !== currentScale) {
            animateZoom(roundedScale, 100); // Faster animation for wheel zoom
            setViewState((prev) => ({ ...prev, zoomMode: "page" }));
          }
          
          accumulatedDelta = 0;
          wheelTimeout = null;
        }, 10);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    
    // Also add to document for better capture
    const documentHandler = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && container.contains(e.target as Node)) {
        handleWheel(e);
      }
    };
    
    document.addEventListener('wheel', documentHandler, { passive: false, capture: true });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      document.removeEventListener('wheel', documentHandler, { capture: true });
      if (wheelTimeout) clearTimeout(wheelTimeout);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    };
  }, [containerRef, setViewState, animateZoom]);

  // Zoom control methods with smooth animations
  const zoomIn = useCallback(() => {
    const currentScale = targetScaleRef.current || currentScaleRef.current;
    const newScale = Math.min(5.0, Math.round((currentScale + 0.1) * 10) / 10);
    animateZoom(newScale);
  }, [animateZoom]);

  const zoomOut = useCallback(() => {
    const currentScale = targetScaleRef.current || currentScaleRef.current;
    const newScale = Math.max(0.1, Math.round((currentScale - 0.1) * 10) / 10);
    animateZoom(newScale);
  }, [animateZoom]);

  const zoomReset = useCallback(() => {
    animateZoom(1.0);
  }, [animateZoom]);

  const setZoom = useCallback((scale: number) => {
    const clampedScale = Math.max(0.1, Math.min(5.0, scale));
    animateZoom(clampedScale);
  }, [animateZoom]);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          zoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          zoomReset();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, zoomReset]);

  return {
    zoomIn,
    zoomOut,
    zoomReset,
    setZoom,
    currentScale: currentScaleRef.current,
  };
};