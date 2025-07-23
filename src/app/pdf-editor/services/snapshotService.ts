import domtoimage from "dom-to-image";
import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface SnapshotData {
  pageNumber: number;
  originalImage: string; // base64 data URL
  translatedImage: string; // base64 data URL
  originalWidth: number;
  originalHeight: number;
  translatedWidth: number;
  translatedHeight: number;
}

export interface CaptureSnapshotsOptions {
  documentRef: React.RefObject<HTMLDivElement | null>;
  documentState: {
    numPages: number;
    scale: number;
    currentPage: number;
  };
  pageState: {
    deletedPages: Set<number>;
  };
  setViewState: (updater: (prev: any) => any) => void;
  setDocumentState: (updater: (prev: any) => any) => void;
  setEditorState: (updater: (prev: any) => any) => void;
  editorState: {
    isAddTextBoxMode: boolean;
  };
  progressCallback?: (current: number, total: number) => void;
}

/**
 * Captures snapshots of all non-deleted pages in both original and translated views
 */
export async function captureAllPageSnapshots(
  options: CaptureSnapshotsOptions
): Promise<SnapshotData[]> {
  const {
    documentRef,
    documentState,
    pageState,
    setViewState,
    setDocumentState,
    setEditorState,
    editorState,
    progressCallback,
  } = options;

  const totalPages = documentState.numPages;
  const deletedPages = pageState.deletedPages;
  const snapshots: SnapshotData[] = [];

  // Get all non-deleted page numbers
  const nonDeletedPages = [];
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    if (!deletedPages.has(pageNumber)) {
      nonDeletedPages.push(pageNumber);
    }
  }

  if (nonDeletedPages.length === 0) {
    throw new Error("No pages to capture");
  }

  // Save original state
  const originalAddTextBoxMode = editorState.isAddTextBoxMode;
  const originalScale = documentState.scale;
  const originalCurrentPage = documentState.currentPage;

  try {
    // Set optimal scale for high quality captures
    setDocumentState((prev) => ({ ...prev, scale: 2.0 }));

    // Temporarily disable text rendering for export
    setEditorState((prev) => ({ ...prev, isAddTextBoxMode: false }));

    // Wait for scale to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Capture each page in both views
    for (let i = 0; i < nonDeletedPages.length; i++) {
      const pageNumber = nonDeletedPages[i];

      // Update progress
      if (progressCallback) {
        progressCallback(i * 2 + 1, nonDeletedPages.length * 2);
      }

      try {
        // Capture original view
        const originalCapture = await capturePageView("original", pageNumber, {
          documentRef,
          setViewState,
          setDocumentState,
        });

        // Update progress
        if (progressCallback) {
          progressCallback(i * 2 + 2, nonDeletedPages.length * 2);
        }

        // Capture translated view
        const translatedCapture = await capturePageView(
          "translated",
          pageNumber,
          {
            documentRef,
            setViewState,
            setDocumentState,
          }
        );

        snapshots.push({
          pageNumber,
          originalImage: originalCapture.dataUrl,
          translatedImage: translatedCapture.dataUrl,
          originalWidth: originalCapture.width,
          originalHeight: originalCapture.height,
          translatedWidth: translatedCapture.width,
          translatedHeight: translatedCapture.height,
        });
      } catch (pageError) {
        console.error(`Error capturing page ${pageNumber}:`, pageError);
        // Continue with other pages rather than failing completely
        continue;
      }
    }

    return snapshots;
  } finally {
    // Restore original state
    setDocumentState((prev) => ({
      ...prev,
      scale: originalScale,
      currentPage: originalCurrentPage,
    }));
    setEditorState((prev) => ({
      ...prev,
      isAddTextBoxMode: originalAddTextBoxMode,
    }));
    setViewState((prev) => ({ ...prev, currentView: "original" }));
  }
}

/**
 * Captures a single page view as image
 */
async function capturePageView(
  viewType: "original" | "translated",
  pageNumber: number,
  options: {
    documentRef: React.RefObject<HTMLDivElement | null>;
    setViewState: (updater: (prev: any) => any) => void;
    setDocumentState: (updater: (prev: any) => any) => void;
  }
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { documentRef, setViewState, setDocumentState } = options;

  try {
    // Set view to the target type
    setViewState((prev) => ({ ...prev, currentView: viewType }));

    // Set page number
    setDocumentState((prev) => ({ ...prev, currentPage: pageNumber }));

    // Wait for view and page to update
    await new Promise((resolve) => setTimeout(resolve, 800));

    const documentContainer = documentRef.current;
    if (!documentContainer) {
      throw new Error("Document container not found");
    }

    // Additional wait to ensure PDF.js has time to render
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Use dom-to-image to capture the page
    const dataUrl = await domtoimage.toPng(documentContainer, {
      quality: 1.0,
      bgcolor: "#ffffff",
      width: documentContainer.offsetWidth,
      height: documentContainer.offsetHeight,
      style: {
        transform: "scale(1)",
        transformOrigin: "top left",
      },
      filter: (node) => {
        // Skip elements that might cause issues during capture
        if (
          node instanceof Element &&
          node.classList &&
          (node.classList.contains("react-pdf__message") ||
            node.classList.contains("react-pdf__loading"))
        ) {
          return false;
        }
        return true;
      },
    });

    return {
      dataUrl,
      width: documentContainer.offsetWidth,
      height: documentContainer.offsetHeight,
    };
  } catch (error) {
    console.error(
      `Error capturing ${viewType} view for page ${pageNumber}:`,
      error
    );

    // Create a fallback error image
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#666";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        `Error capturing ${viewType} page ${pageNumber}`,
        canvas.width / 2,
        canvas.height / 2
      );
    }

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  }
}

/**
 * Creates a blank PDF with the captured snapshots arranged in a 2x2 grid
 */
export async function createFinalLayoutPdf(
  snapshots: SnapshotData[]
): Promise<File> {
  try {
    const pdfDoc = await PDFDocument.create();

    // Calculate how many PDF pages we need (2 snapshots per PDF page)
    const pagesNeeded = Math.ceil(snapshots.length / 2);

    for (let pdfPageIndex = 0; pdfPageIndex < pagesNeeded; pdfPageIndex++) {
      const page = pdfDoc.addPage([612, 792]); // Letter size
      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Get snapshots for this PDF page
      const snapshot1 = snapshots[pdfPageIndex * 2];
      const snapshot2 = snapshots[pdfPageIndex * 2 + 1];

      // Calculate grid layout
      const margin = 20;
      const gridSpacing = 10;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;

      const quadrantWidth = (availableWidth - gridSpacing) / 2;
      const quadrantHeight = (availableHeight - gridSpacing) / 2;

      // Add first snapshot (top row)
      if (snapshot1) {
        await addSnapshotToPage(page, pdfDoc, snapshot1, {
          originalX: margin,
          originalY: pageHeight - margin - quadrantHeight,
          translatedX: margin + quadrantWidth + gridSpacing,
          translatedY: pageHeight - margin - quadrantHeight,
          quadrantWidth,
          quadrantHeight,
        });
      }

      // Add second snapshot (bottom row) if it exists
      if (snapshot2) {
        await addSnapshotToPage(page, pdfDoc, snapshot2, {
          originalX: margin,
          originalY: pageHeight - margin - quadrantHeight * 2 - gridSpacing,
          translatedX: margin + quadrantWidth + gridSpacing,
          translatedY: pageHeight - margin - quadrantHeight * 2 - gridSpacing,
          quadrantWidth,
          quadrantHeight,
        });
      }
    }

    // Convert to file
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    return new File([pdfBlob], "final-layout.pdf", { type: "application/pdf" });
  } catch (error) {
    console.error("Error creating final layout PDF:", error);
    throw new Error(
      `Failed to create final layout PDF: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Adds a snapshot's original and translated images to a PDF page
 */
async function addSnapshotToPage(
  page: any,
  pdfDoc: PDFDocument,
  snapshot: SnapshotData,
  layout: {
    originalX: number;
    originalY: number;
    translatedX: number;
    translatedY: number;
    quadrantWidth: number;
    quadrantHeight: number;
  }
) {
  try {
    // Embed original image
    const originalImageBytes = await fetch(snapshot.originalImage).then((res) =>
      res.arrayBuffer()
    );
    const originalImage = await pdfDoc.embedPng(originalImageBytes);

    // Embed translated image
    const translatedImageBytes = await fetch(snapshot.translatedImage).then(
      (res) => res.arrayBuffer()
    );
    const translatedImage = await pdfDoc.embedPng(translatedImageBytes);

    // Calculate scaling to fit within quadrants while maintaining aspect ratio
    const originalAspect = snapshot.originalWidth / snapshot.originalHeight;
    const translatedAspect =
      snapshot.translatedWidth / snapshot.translatedHeight;
    const quadrantAspect = layout.quadrantWidth / layout.quadrantHeight;

    // Scale original image
    let originalWidth, originalHeight;
    if (originalAspect > quadrantAspect) {
      originalWidth = layout.quadrantWidth;
      originalHeight = layout.quadrantWidth / originalAspect;
    } else {
      originalHeight = layout.quadrantHeight;
      originalWidth = layout.quadrantHeight * originalAspect;
    }

    // Scale translated image
    let translatedWidth, translatedHeight;
    if (translatedAspect > quadrantAspect) {
      translatedWidth = layout.quadrantWidth;
      translatedHeight = layout.quadrantWidth / translatedAspect;
    } else {
      translatedHeight = layout.quadrantHeight;
      translatedWidth = layout.quadrantHeight * translatedAspect;
    }

    // Center images in their quadrants
    const originalCenterX =
      layout.originalX + (layout.quadrantWidth - originalWidth) / 2;
    const originalCenterY =
      layout.originalY + (layout.quadrantHeight - originalHeight) / 2;
    const translatedCenterX =
      layout.translatedX + (layout.quadrantWidth - translatedWidth) / 2;
    const translatedCenterY =
      layout.translatedY + (layout.quadrantHeight - translatedHeight) / 2;

    // Draw images
    page.drawImage(originalImage, {
      x: originalCenterX,
      y: originalCenterY,
      width: originalWidth,
      height: originalHeight,
    });

    page.drawImage(translatedImage, {
      x: translatedCenterX,
      y: translatedCenterY,
      width: translatedWidth,
      height: translatedHeight,
    });

    // Add page number label
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText(`Page ${snapshot.pageNumber}`, {
      x: layout.originalX,
      y: layout.originalY - 15,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
    });
  } catch (error) {
    console.error("Error adding snapshot to page:", error);
    // Continue without this snapshot rather than failing completely
  }
}
