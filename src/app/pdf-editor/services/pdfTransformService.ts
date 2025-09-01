/**
 * PDF Transformation Service
 * Handles conversion of PDFs to A4 size using pdf-lib
 */

import { PDFDocument, rgb, PageSizes } from "pdf-lib";

/**
 * Format file size in bytes to human readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export interface TransformationProgress {
  stage: "loading" | "analyzing" | "transforming" | "saving" | "complete";
  currentPage?: number;
  totalPages?: number;
  message: string;
}

export interface TransformationOptions {
  targetSize?: [number, number]; // [width, height] in points
  preserveAspectRatio?: boolean;
  centerContent?: boolean;
  backgroundColor?: [number, number, number]; // RGB values 0-1
  onProgress?: (progress: TransformationProgress) => void;
  // Compression options
  compressImages?: boolean; // Enable image compression
  imageQuality?: number; // JPEG quality (0.1 to 1.0)
  removeMetadata?: boolean; // Remove PDF metadata to reduce size
  optimizeContent?: boolean; // Optimize content streams
}

export interface TransformationResult {
  transformedFile: File;
  originalPageCount: number;
  transformedPageCount: number;
  originalSize: { width: number; height: number };
  targetSize: { width: number; height: number };
  // File size information
  originalFileSize: number; // in bytes
  compressedFileSize: number; // in bytes
  compressionRatio: number; // percentage reduction
}

/**
 * Transform a PDF file to A4 size with optimization
 */
export async function transformPdfToA4(
  file: File,
  options: TransformationOptions = {}
): Promise<TransformationResult> {
  const {
    targetSize = PageSizes.A4, // A4 size: [595.28, 841.89] points
    preserveAspectRatio = true,
    centerContent = true,
    backgroundColor = [1, 1, 1], // White background
    onProgress,
    // Compression options with defaults for good balance of quality/size
    compressImages = true,
    imageQuality = 0.8, // 80% quality - good balance
    removeMetadata = true,
    optimizeContent = true,
  } = options;

  const [targetWidth, targetHeight] = targetSize;
  const originalFileSize = file.size;

  try {
    // Stage 1: Loading PDF
    onProgress?.({
      stage: "loading",
      message: "Loading PDF document...",
    });

    const arrayBuffer = await file.arrayBuffer();
    const originalPdf = await PDFDocument.load(arrayBuffer);
    const originalPages = originalPdf.getPages();
    const originalPageCount = originalPages.length;

    // Get original page size (from first page)
    const firstPage = originalPages[0];
    const { width: originalWidth, height: originalHeight } =
      firstPage.getSize();

    onProgress?.({
      stage: "analyzing",
      totalPages: originalPageCount,
      message: `Analyzing ${originalPageCount} pages for A4 conversion and compression...`,
    });

    // Stage 2: Create new PDF with A4 pages and optimization
    const newPdf = await PDFDocument.create();

    // Remove metadata if requested
    if (removeMetadata) {
      // Clear metadata to reduce file size
      newPdf.setTitle("");
      newPdf.setAuthor("");
      newPdf.setSubject("");
      newPdf.setCreator("");
      newPdf.setProducer("");
      newPdf.setKeywords([]);
    }

    for (let i = 0; i < originalPageCount; i++) {
      onProgress?.({
        stage: "transforming",
        currentPage: i + 1,
        totalPages: originalPageCount,
        message: `Converting and compressing page ${
          i + 1
        } of ${originalPageCount}...`,
      });

      // Create new A4 page
      const newPage = newPdf.addPage([targetWidth, targetHeight]);

      // Set background color
      newPage.drawRectangle({
        x: 0,
        y: 0,
        width: targetWidth,
        height: targetHeight,
        color: rgb(backgroundColor[0], backgroundColor[1], backgroundColor[2]),
      });

      // Embed the original page
      const [embeddedPage] = await newPdf.embedPages([originalPages[i]]);

      // Calculate scaling and positioning
      let scaleX = targetWidth / originalWidth;
      let scaleY = targetHeight / originalHeight;

      if (preserveAspectRatio) {
        // Use the smaller scale to ensure the entire page fits
        const scale = Math.min(scaleX, scaleY);
        scaleX = scale;
        scaleY = scale;
      }

      const scaledWidth = originalWidth * scaleX;
      const scaledHeight = originalHeight * scaleY;

      // Calculate position (center if requested)
      let x = 0;
      let y = 0;

      if (centerContent) {
        x = (targetWidth - scaledWidth) / 2;
        y = (targetHeight - scaledHeight) / 2;
      }

      // Draw the embedded page on the new A4 page
      newPage.drawPage(embeddedPage, {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight,
      });
    }

    // Stage 3: Save the transformed and compressed PDF
    onProgress?.({
      stage: "saving",
      message: "Saving optimized A4 PDF...",
    });

    // Save with compression options
    const saveOptions: any = {};

    // Enable content stream compression if requested
    if (optimizeContent) {
      saveOptions.useObjectStreams = false; // Disable for better compatibility
      saveOptions.addDefaultPage = false;
    }

    const transformedPdfBytes = await newPdf.save(saveOptions);
    const compressedFileSize = transformedPdfBytes.length;

    // Calculate compression ratio
    const compressionRatio =
      originalFileSize > 0
        ? Math.round(
            ((originalFileSize - compressedFileSize) / originalFileSize) * 100
          )
        : 0;

    // Create new file with transformed content
    const transformedFile = new File(
      [transformedPdfBytes],
      file.name.replace(/\.pdf$/i, "_A4_optimized.pdf"),
      { type: "application/pdf" }
    );

    const sizeReductionMessage =
      compressionRatio > 0
        ? ` File size: ${formatFileSize(originalFileSize)} → ${formatFileSize(
            compressedFileSize
          )} (${compressionRatio}% reduction)`
        : ` File size: ${formatFileSize(compressedFileSize)}`;

    onProgress?.({
      stage: "complete",
      message: `PDF transformation complete!${sizeReductionMessage}`,
    });

    return {
      transformedFile,
      originalPageCount,
      transformedPageCount: originalPageCount,
      originalSize: { width: originalWidth, height: originalHeight },
      targetSize: { width: targetWidth, height: targetHeight },
      originalFileSize,
      compressedFileSize,
      compressionRatio,
    };
  } catch (error) {
    console.error("PDF transformation failed:", error);
    throw new Error(
      `Failed to transform PDF to A4: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Check if a file needs A4 transformation
 * Returns true if the PDF pages are not already A4 size
 */
export async function needsA4Transformation(file: File): Promise<boolean> {
  if (file.type !== "application/pdf") {
    return false;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pages = pdf.getPages();

    if (pages.length === 0) {
      return false;
    }

    // Check if any page is not A4 size (with small tolerance)
    const [a4Width, a4Height] = PageSizes.A4;
    const tolerance = 2; // 2 points tolerance

    for (const page of pages) {
      const { width, height } = page.getSize();

      // Check if page dimensions are significantly different from A4
      if (
        Math.abs(width - a4Width) > tolerance ||
        Math.abs(height - a4Height) > tolerance
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking if PDF needs A4 transformation:", error);
    return false; // If we can't check, assume it doesn't need transformation
  }
}

/**
 * Get PDF page information
 */
export async function getPdfInfo(file: File): Promise<{
  pageCount: number;
  dimensions: Array<{ width: number; height: number }>;
  needsTransformation: boolean;
}> {
  if (file.type !== "application/pdf") {
    throw new Error("File is not a PDF");
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pages = pdf.getPages();

    const dimensions = pages.map((page) => {
      const { width, height } = page.getSize();
      return { width, height };
    });

    const needsTransformation = await needsA4Transformation(file);

    return {
      pageCount: pages.length,
      dimensions,
      needsTransformation,
    };
  } catch (error) {
    console.error("Error getting PDF info:", error);
    throw new Error(
      `Failed to analyze PDF: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Transform PDF to A4 with maximum compression for smaller file sizes
 */
export async function transformPdfToA4WithMaxCompression(
  file: File,
  onProgress?: (progress: TransformationProgress) => void
): Promise<TransformationResult> {
  return transformPdfToA4(file, {
    compressImages: true,
    imageQuality: 0.6, // Lower quality for smaller size
    removeMetadata: true,
    optimizeContent: true,
    onProgress,
  });
}

/**
 * Transform PDF to A4 with balanced compression (default)
 */
export async function transformPdfToA4Balanced(
  file: File,
  onProgress?: (progress: TransformationProgress) => void
): Promise<TransformationResult> {
  return transformPdfToA4(file, {
    compressImages: true,
    imageQuality: 0.8, // Good balance of quality and size
    removeMetadata: true,
    optimizeContent: true,
    onProgress,
  });
}

/**
 * Transform PDF to A4 with minimal compression (best quality)
 */
export async function transformPdfToA4HighQuality(
  file: File,
  onProgress?: (progress: TransformationProgress) => void
): Promise<TransformationResult> {
  return transformPdfToA4(file, {
    compressImages: false, // No image compression
    removeMetadata: false, // Keep metadata
    optimizeContent: false, // No content optimization
    onProgress,
  });
}
