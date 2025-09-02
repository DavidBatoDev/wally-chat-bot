import domtoimage from "dom-to-image";
import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { uploadFileWithFallback } from "./fileUploadService";

export interface SnapshotData {
  pageNumber: number;
  originalImage: string; // base64 data URL
  translatedImage: string; // base64 data URL
  originalWidth: number;
  originalHeight: number;
  translatedWidth: number;
  translatedHeight: number;
  pageType?:
    | "social_media"
    | "birth_cert"
    | "nbi_clearance"
    | "apostille"
    | "dynamic_content";
}

export interface CaptureSnapshotsOptions {
  documentRef: React.RefObject<HTMLDivElement | null>;
  documentState: {
    numPages: number;
    scale: number;
    currentPage: number;
    pages: Array<{
      pageNumber: number;
      pageType?:
        | "social_media"
        | "birth_cert"
        | "nbi_clearance"
        | "apostille"
        | "dynamic_content";
      isTranslated: boolean;
    }>;
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

        // Get page type from document state
        const pageData = documentState.pages.find(
          (p) => p.pageNumber === pageNumber
        );
        const pageType = pageData?.pageType || "dynamic_content";

        snapshots.push({
          pageNumber,
          originalImage: originalCapture.dataUrl,
          translatedImage: translatedCapture.dataUrl,
          originalWidth: originalCapture.width,
          originalHeight: originalCapture.height,
          translatedWidth: translatedCapture.width,
          translatedHeight: translatedCapture.height,
          pageType,
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
 * Creates a PDF with the export_first_page.pdf as the first page, followed by captured snapshots arranged in a 2x2 grid
 * Uploads the PDF to Supabase storage or creates a blob URL as fallback
 */
export async function createFinalLayoutPdf(snapshots: SnapshotData[]): Promise<{
  url: string;
  isSupabaseUrl: boolean;
  filePath?: string;
  fileObjectId?: string;
}> {
  try {
    const pdfDoc = await PDFDocument.create();

    // Load and add the export_first_page.pdf as the first page
    try {
      const templateResponse = await fetch(
        "/export_template/export_first_page.pdf"
      );
      const templateArrayBuffer = await templateResponse.arrayBuffer();
      const templatePdfDoc = await PDFDocument.load(templateArrayBuffer);

      // Copy the first page from the template
      const [templatePage] = await pdfDoc.copyPages(templatePdfDoc, [0]);
      pdfDoc.addPage(templatePage);

      console.log("Successfully added export_first_page.pdf as the first page");
    } catch (templateError) {
      console.warn(
        "Could not load export_first_page.pdf, proceeding without it:",
        templateError
      );
      // Continue with the layout pages even if template fails to load
    }

    // Separate snapshots by page type
    const birthCertSnapshots = snapshots.filter(
      (s) => s.pageType === "birth_cert" || s.pageType === "apostille"
    );
    const dynamicContentSnapshots = snapshots.filter(
      (s) => s.pageType !== "birth_cert" && s.pageType !== "apostille"
    );

    // Sort birth cert snapshots by page number (birth certs go first)
    birthCertSnapshots.sort((a, b) => a.pageNumber - b.pageNumber);

    // Sort dynamic content snapshots by page number
    dynamicContentSnapshots.sort((a, b) => a.pageNumber - b.pageNumber);

    console.log(
      `Processing ${birthCertSnapshots.length} birth certificate pages and ${dynamicContentSnapshots.length} dynamic content pages`
    );

    // Process birth certificate pages first (each gets 2 full pages: original + translated)
    for (const snapshot of birthCertSnapshots) {
      console.log(
        `DEBUG: Creating birth cert pages for page ${snapshot.pageNumber}`
      );

      // Add original page (blank)
      const originalPage = pdfDoc.addPage([612, 792]); // Letter size
      const { width: pageWidth, height: pageHeight } = originalPage.getSize();

      // Create a clean white background
      originalPage.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(1, 1, 1), // White background
      });

      // Add translated page (blank)
      const translatedPage = pdfDoc.addPage([612, 792]); // Letter size

      // Create a clean white background
      translatedPage.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(1, 1, 1), // White background
      });
    }

    // Process dynamic content pages in 2x2 grid layout (blank pages)
    const dynamicPagesNeeded = Math.ceil(dynamicContentSnapshots.length / 2);

    for (
      let pdfPageIndex = 0;
      pdfPageIndex < dynamicPagesNeeded;
      pdfPageIndex++
    ) {
      const page = pdfDoc.addPage([612, 792]); // Letter size
      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Get snapshots for this PDF page (2 snapshots per PDF page for dynamic content)
      const snapshot1 = dynamicContentSnapshots[pdfPageIndex * 2];
      const snapshot2 = dynamicContentSnapshots[pdfPageIndex * 2 + 1];

      // Create a clean white background
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(1, 1, 1), // White background
      });

      // Add page titles for the dynamic content pages in 2x2 layout
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      if (snapshot1) {
        // Top left quadrant label - Original
        page.drawText(`Page ${snapshot1.pageNumber} - Original`, {
          x: 10,
          y: pageHeight - 15,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });

        // Top right quadrant label - Translated
        page.drawText(`Page ${snapshot1.pageNumber} - Translated`, {
          x: pageWidth / 2 + 10,
          y: pageHeight - 15,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      }

      if (snapshot2) {
        // Bottom left quadrant label - Original
        page.drawText(`Page ${snapshot2.pageNumber} - Original`, {
          x: 10,
          y: pageHeight / 2 - 5,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });

        // Bottom right quadrant label - Translated
        page.drawText(`Page ${snapshot2.pageNumber} - Translated`, {
          x: pageWidth / 2 + 10,
          y: pageHeight / 2 - 5,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }

    // Convert to PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Debug: Log final page count
    console.log(`DEBUG: Final PDF has ${pdfDoc.getPageCount()} pages total`);

    // Create a File object for upload
    const pdfFile = new File([pdfBytes], "final-layout-with-template.pdf", {
      type: "application/pdf",
    });

    // Upload to Supabase or use blob URL as fallback
    const uploadResult = await uploadFileWithFallback(pdfFile);

    return uploadResult;
  } catch (error) {
    console.error("Error creating final layout PDF:", error);
    throw new Error(
      `Failed to create final layout PDF: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
