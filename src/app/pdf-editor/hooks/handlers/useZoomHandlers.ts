import { useCallback, useEffect, useRef } from "react";
import { ViewState } from "../../types/pdf-editor.types";

interface UseZoomHandlersProps {
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

export const useZoomHandlers = ({
  viewState,
  setViewState,
  documentState,
  actions,
  containerRef,
  documentRef,
}: UseZoomHandlersProps) => {
  // Track latest scale without resubscribing listeners
  const currentScaleRef = useRef(documentState.scale);
  useEffect(() => {
    currentScaleRef.current = documentState.scale;
  }, [documentState.scale]);

  // Zoom functionality
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let targetScale = currentScaleRef.current;
    let rafId: number | null = null;
    let idleTimer: number | null = null;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Always zoom to center
        setViewState((prev) => ({ ...prev, transformOrigin: "center center" }));

        const zoomFactor = 0.12;
        const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;
        // Always accumulate from the last committed target, not stale prop
        const base = targetScale ?? currentScaleRef.current;
        const nextTarget = Math.max(0.1, base + delta); // Allow zooming down to 10%
        // Round to nearest 0.1 (10%) to ensure divisible by 10
        const roundedTarget = Math.round(nextTarget * 10) / 10;
        if (roundedTarget !== targetScale) {
          targetScale = roundedTarget;
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            // Smooth, non-re-rendering scale update
            actions.updateScaleWithoutRerender(targetScale);
          });
        }
        setViewState((prev) => ({ ...prev, zoomMode: "page" }));

        // Debounced commit
        if (idleTimer) window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => {
          // Mark scale settled to allow quality re-render if any listeners care
          actions.resetScaleChanging();
          rafId = null;
          idleTimer = null;
        }, 120);
        return false;
      }
    };

    // Add the event listener with aggressive options
    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    // Also try adding to document as backup
    const documentHandler = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && container.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleWheel(e);
      }
    };

    document.addEventListener("wheel", documentHandler, {
      passive: false,
      capture: true,
    });

    return () => {
      container.removeEventListener("wheel", handleWheel, { capture: true });
      document.removeEventListener("wheel", documentHandler, { capture: true });
      if (rafId) cancelAnimationFrame(rafId);
      if (idleTimer) window.clearTimeout(idleTimer);
    };
    // Depend only on stable references to avoid reattaching listeners mid-zoom
  }, [
    actions,
    setViewState,
    containerRef,
    documentRef,
    viewState.transformOrigin,
  ]);

  return {};
};
