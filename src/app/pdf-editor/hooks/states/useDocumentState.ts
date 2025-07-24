import { useState, useCallback, useEffect, useRef } from "react";
import { DocumentState } from "../../types/pdf-editor.types";
import { getFileType, isPdfFile } from "../../utils/measurements";
import { toast } from "sonner";

export const useDocumentState = () => {
  const [documentState, setDocumentState] = useState<DocumentState>({
    url: "",
    currentPage: 1,
    numPages: 0,
    scale: 1.0,
    pageWidth: 612,
    pageHeight: 792,
    isLoading: false,
    error: "",
    fileType: null,
    imageDimensions: null,
    isDocumentLoaded: false,
    isPageLoading: false,
    isScaleChanging: false,
    pdfBackgroundColor: "white",
    detectedPageBackgrounds: new Map(),
  });

  // Refs for scale changing
  const scaleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to reset scale changing state with debounce
  const resetScaleChanging = useCallback(() => {
    if (scaleTimeoutRef.current) {
      clearTimeout(scaleTimeoutRef.current);
    }
    scaleTimeoutRef.current = setTimeout(() => {
      setDocumentState((prev) => ({ ...prev, isScaleChanging: false }));
      scaleTimeoutRef.current = null;
    }, 150);
  }, []);

  // Document loading handlers
  const handleDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setDocumentState((prev) => ({
        ...prev,
        numPages,
        isDocumentLoaded: true,
        error: "",
      }));
    },
    []
  );

  const handleDocumentLoadError = useCallback((error: Error) => {
    setDocumentState((prev) => ({
      ...prev,
      error: `Failed to load document: ${error.message}`,
      isDocumentLoaded: false,
    }));
  }, []);

  const handlePageLoadSuccess = useCallback((page: any) => {
    const viewport = page.getViewport({ scale: 1 });
    setDocumentState((prev) => ({
      ...prev,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
      isPageLoading: false,
    }));
  }, []);

  const handlePageLoadError = useCallback((error: any) => {
    // Suppress text layer cancellation warnings as they're expected during zoom/mode changes
    if (
      error?.message?.includes("TextLayer task cancelled") ||
      error?.message?.includes("AbortException") ||
      error?.message?.includes("Invalid page request") ||
      error?.name === "AbortException" ||
      error?.name === "AbortError" ||
      error?.toString?.().includes("TextLayer task cancelled") ||
      error?.toString?.().includes("AbortException") ||
      error?.toString?.().includes("Invalid page request") ||
      (error?.error &&
        (error.error.message?.includes("TextLayer task cancelled") ||
          error.error.message?.includes("Invalid page request") ||
          error.error.name === "AbortException"))
    ) {
      return;
    }

    console.error("PDF page load error:", error);
    setDocumentState((prev) => ({
      ...prev,
      isPageLoading: false,
    }));
  }, []);

  const handleImageLoadSuccess = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      setDocumentState((prev) => ({
        ...prev,
        imageDimensions: {
          width: img.naturalWidth,
          height: img.naturalHeight,
        },
        pageWidth: img.naturalWidth,
        pageHeight: img.naturalHeight,
        isDocumentLoaded: true,
        error: "",
      }));
    },
    []
  );

  const handleImageLoadError = useCallback(() => {
    setDocumentState((prev) => ({
      ...prev,
      error: "Failed to load image",
      isDocumentLoaded: false,
    }));
  }, []);

  // Load document from file
  const loadDocument = useCallback((file: File) => {
    const fileType = getFileType(file.name);
    const url = URL.createObjectURL(file);

    setDocumentState((prev) => ({
      ...prev,
      url,
      fileType,
      isLoading: true,
      currentPage: 1,
      error: "",
      pdfBackgroundColor: "white",
      detectedPageBackgrounds: new Map(),
    }));

    setTimeout(() => {
      setDocumentState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }, 500);
  }, []);

  // Update scale with debouncing
  const updateScale = useCallback((newScale: number) => {
    setDocumentState((prev) => ({
      ...prev,
      scale: Math.max(0.1, Math.min(5.0, newScale)),
      isScaleChanging: true,
    }));

    // Reset scale changing state after a delay
    setTimeout(() => {
      setDocumentState((prev) => ({
        ...prev,
        isScaleChanging: false,
      }));
    }, 150);
  }, []);

  // Change current page
  const changePage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= documentState.numPages) {
        setDocumentState((prev) => ({
          ...prev,
          currentPage: page,
          isPageLoading: true,
        }));
      }
    },
    [documentState.numPages]
  );

  // Capture PDF background color
  const capturePdfBackgroundColor = useCallback(() => {
    const canvas = document.querySelector(
      ".react-pdf__Page__canvas"
    ) as HTMLCanvasElement;

    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        try {
          const pixel = ctx.getImageData(0, 0, 1, 1).data;
          const bgColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;

          setDocumentState((prev) => {
            const newDetectedBackgrounds = new Map(
              prev.detectedPageBackgrounds
            );
            newDetectedBackgrounds.set(prev.currentPage, bgColor);

            return {
              ...prev,
              pdfBackgroundColor: bgColor,
              detectedPageBackgrounds: newDetectedBackgrounds,
            };
          });

          console.log(
            `PDF background color captured for page ${documentState.currentPage}:`,
            bgColor
          );
        } catch (error) {
          console.warn("Failed to capture PDF background color:", error);
          setDocumentState((prev) => ({
            ...prev,
            pdfBackgroundColor: "white",
          }));
        }
      }
    }
  }, [documentState.currentPage]);

  // Update PDF background color manually
  const updatePdfBackgroundColor = useCallback((color: string) => {
    setDocumentState((prev) => ({
      ...prev,
      pdfBackgroundColor: color,
    }));
  }, []);

  return {
    documentState,
    setDocumentState,
    handlers: {
      handleDocumentLoadSuccess,
      handleDocumentLoadError,
      handlePageLoadSuccess,
      handlePageLoadError,
      handleImageLoadSuccess,
      handleImageLoadError,
    },
    actions: {
      loadDocument,
      updateScale,
      changePage,
      capturePdfBackgroundColor,
      updatePdfBackgroundColor,
      resetScaleChanging,
    },
  };
};
