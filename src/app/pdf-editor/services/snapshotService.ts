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
    // A4 size in PDF points (72 DPI): 595.28 x 841.89
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;

    try {
      const typeCounts: Record<string, number> = {};
      snapshots.forEach((s) => {
        const t = s.pageType || "(unset)";
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });
      console.log("🔎 Input snapshots pageType counts:", typeCounts);
      console.log(
        "🔎 Input snapshot sample:",
        snapshots
          .slice(0, 6)
          .map((s) => ({ pageNumber: s.pageNumber, pageType: s.pageType }))
      );
    } catch {}

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
    const documentsSnapshot = snapshots.filter(
      (s) =>
        s.pageType === "birth_cert" ||
        s.pageType === "nbi_clearance" ||
        s.pageType === "apostille"
    );
    const SocialMediaSnapshots = snapshots.filter(
      (s) =>
        s.pageType !== "birth_cert" &&
        s.pageType !== "nbi_clearance" &&
        s.pageType !== "apostille"
    );

    // Sort snapshots by page number
    documentsSnapshot.sort((a, b) => a.pageNumber - b.pageNumber);
    SocialMediaSnapshots.sort((a, b) => a.pageNumber - b.pageNumber);

    console.log(
      `Processing ${documentsSnapshot.length} document pages and ${SocialMediaSnapshots.length} social media/dynamic pages`
    );

    // Process document pages first (each gets 2 full A4 pages: original + translated)
    for (const snapshot of documentsSnapshot) {
      console.log(
        `DEBUG: Creating document pages (A4) for page ${snapshot.pageNumber}`
      );

      // Add original page (blank, A4)
      const originalPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      const { width: pageWidth, height: pageHeight } = originalPage.getSize();

      // Create a clean white background
      originalPage.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(1, 1, 1), // White background
      });

      // Add translated page (blank, A4)
      const translatedPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

      // Create a clean white background
      translatedPage.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(1, 1, 1), // White background
      });
    }

    // Process social media/dynamic content pages in 2x2 layout (2 snapshots per PDF page)
    const socialMediaPageNeeded = Math.ceil(SocialMediaSnapshots.length / 2);

    for (
      let pdfPageIndex = 0;
      pdfPageIndex < socialMediaPageNeeded;
      pdfPageIndex++
    ) {
      const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Get snapshots for this PDF page (2 snapshots per PDF page for dynamic content)
      const snapshot1 = SocialMediaSnapshots[pdfPageIndex * 2];
      const snapshot2 = SocialMediaSnapshots[pdfPageIndex * 2 + 1];

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
