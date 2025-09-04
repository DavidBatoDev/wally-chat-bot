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
  // Prevent zooming via wheel while allowing normal scrolling
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const windowWheelHandler = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && container.contains(e.target as Node)) {
        handleWheel(e);
      }
    };

    window.addEventListener("wheel", windowWheelHandler, {
      passive: false,
      capture: true,
    });

    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: false,
    });

    const preventBrowserZoom = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "+" || e.key === "-" || e.key === "0")
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", preventBrowserZoom, {
      passive: false,
    });

    return () => {
      window.removeEventListener("wheel", windowWheelHandler, {
        capture: true,
      } as any);
      container.removeEventListener("wheel", handleWheel as any);
      document.removeEventListener("keydown", preventBrowserZoom as any);
    };
  }, [handleWheel, containerRef]);

  return {};
};
