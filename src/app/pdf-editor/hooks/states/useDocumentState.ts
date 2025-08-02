import { useState, useCallback, useEffect, useRef } from "react";
import { DocumentState, PageData } from "../../types/pdf-editor.types";
import { getFileType, isPdfFile } from "../../utils/measurements";
import { toast } from "sonner";
import { uploadFileWithFallback } from "../../services/fileUploadService";

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
    pages: [],
    deletedPages: new Set(),
    isTransforming: false,
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
      console.log(`handleDocumentLoadSuccess called with ${numPages} pages`);
      console.log("Current document state before load success:", documentState);

      // Only reset pages and deletedPages if this is truly a new document load
      // Check if numPages has actually changed or if we're reloading the same document
      if (
        documentState.numPages === numPages &&
        documentState.isDocumentLoaded
      ) {
        console.log(
          "Document already loaded with same page count, skipping reset"
        );
        setDocumentState((prev) => ({
          ...prev,
          isDocumentLoaded: true,
          error: "",
        }));
        return;
      }

      // Initialize pages array when document loads
      const initialPages: PageData[] = Array.from(
        { length: numPages },
        (_, index) => ({
          pageNumber: index + 1,
          isTranslated: false,
        })
      );

      console.log("Resetting document state for new document");
      setDocumentState((prev) => ({
        ...prev,
        numPages,
        isDocumentLoaded: true,
        error: "",
        pages: initialPages,
        deletedPages: new Set(),
      }));
    },
    [documentState.numPages, documentState.isDocumentLoaded]
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
  const loadDocument = useCallback(async (file: File) => {
    const fileType = getFileType(file.name);

    // Set initial loading state
    setDocumentState((prev) => ({
      ...prev,
      isLoading: true,
      currentPage: 1,
      error: "",
      pdfBackgroundColor: "white",
      detectedPageBackgrounds: new Map(),
      pages: [], // Clear pages when loading new document
      deletedPages: new Set(), // Clear deleted pages when loading new document
      isTransforming: false, // Reset transforming state
    }));

    try {
      // Upload file to Supabase or use blob URL as fallback
      const uploadResult = await uploadFileWithFallback(file);

      setDocumentState((prev) => ({
        ...prev,
        url: uploadResult.url,
        fileType,
        isLoading: false,
        // Store additional metadata for cleanup later
        supabaseFilePath: uploadResult.filePath,
        isSupabaseUrl: uploadResult.isSupabaseUrl,
      }));

      if (uploadResult.isSupabaseUrl) {
        toast.success("Document uploaded to cloud storage successfully!");
      }
    } catch (error) {
      console.error("Error loading document:", error);
      setDocumentState((prev) => ({
        ...prev,
        error: "Failed to load document",
        isLoading: false,
        isDocumentLoaded: false,
      }));
      toast.error("Failed to load document");
    }
  }, []);

  // Load document from URL (for project loading)
  const loadDocumentFromUrl = useCallback(
    async (
      url: string,
      fileType: "pdf" | "image" | null,
      supabaseFilePath?: string
    ) => {
      // Set loading state
      setDocumentState((prev) => ({
        ...prev,
        isLoading: true,
        error: "",
      }));

      try {
        setDocumentState((prev) => ({
          ...prev,
          url,
          fileType,
          isLoading: false,
          isDocumentLoaded: true,
          // Store Supabase metadata if available
          supabaseFilePath,
          isSupabaseUrl:
            url.includes("supabase.co") && url.includes("/storage/"),
        }));

        toast.success("Project document loaded successfully!");
      } catch (error) {
        console.error("Error loading document from URL:", error);
        setDocumentState((prev) => ({
          ...prev,
          error: "Failed to load document",
          isLoading: false,
          isDocumentLoaded: false,
        }));
        toast.error("Failed to load project document");
      }
    },
    []
  );

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

  // Page management functions
  const addPage = useCallback((pageData: PageData) => {
    setDocumentState((prev) => ({
      ...prev,
      pages: [...prev.pages, pageData],
      numPages: prev.numPages + 1,
    }));
  }, []);

  const appendPages = useCallback((newPages: PageData[]) => {
    setDocumentState((prev) => ({
      ...prev,
      pages: [...prev.pages, ...newPages],
      numPages: prev.numPages + newPages.length,
    }));
  }, []);

  const updatePage = useCallback(
    (pageNumber: number, updates: Partial<PageData>) => {
      setDocumentState((prev) => ({
        ...prev,
        pages: prev.pages.map((page) =>
          page.pageNumber === pageNumber ? { ...page, ...updates } : page
        ),
      }));
    },
    []
  );

  const deletePage = useCallback((pageNumber: number) => {
    setDocumentState((prev) => {
      const remainingPages = prev.numPages - prev.deletedPages.size;

      if (remainingPages <= 1) {
        toast.error("Cannot delete the last remaining page");
        return prev;
      }

      return {
        ...prev,
        deletedPages: new Set([...prev.deletedPages, pageNumber]),
      };
    });

    toast.success(`Page ${pageNumber} deleted`);
  }, []);

  const getCurrentPage = useCallback(() => {
    return (
      documentState.pages.find(
        (page) => page.pageNumber === documentState.currentPage
      ) || null
    );
  }, [documentState.pages, documentState.currentPage]);

  const getNonDeletedPages = useCallback(() => {
    return documentState.pages.filter(
      (page) => !documentState.deletedPages.has(page.pageNumber)
    );
  }, [documentState.pages, documentState.deletedPages]);

  const setPageTranslated = useCallback(
    (pageNumber: number, isTranslated: boolean) => {
      updatePage(pageNumber, { isTranslated });
    },
    [updatePage]
  );

  const setIsTransforming = useCallback((isTransforming: boolean) => {
    setDocumentState((prev) => ({
      ...prev,
      isTransforming,
    }));
  }, []);

  // Handle document appending - used when appending additional pages from new documents
  const handleDocumentAppend = useCallback(
    (additionalPages: number) => {
      const newPages: PageData[] = Array.from(
        { length: additionalPages },
        (_, index) => ({
          pageNumber: documentState.numPages + index + 1,
          isTranslated: false,
        })
      );

      appendPages(newPages);
    },
    [documentState.numPages, appendPages]
  );

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
      loadDocumentFromUrl,
      updateScale,
      changePage,
      capturePdfBackgroundColor,
      updatePdfBackgroundColor,
      resetScaleChanging,
    },
    pageActions: {
      addPage,
      appendPages,
      updatePage,
      deletePage,
      getCurrentPage,
      getNonDeletedPages,
      setPageTranslated,
      setIsTransforming,
      handleDocumentAppend,
    },
  };
};
