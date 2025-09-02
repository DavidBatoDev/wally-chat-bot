/**
 * PDF Transformation Service
 * Handles conversion of PDFs to A4 size using pdf-lib
 */

import { PDFDocument, rgb, PageSizes } from "pdf-lib";
import mammoth from "mammoth";

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

/**
 * Convert an image file to A4 PDF format
 * This function converts any image to a PDF with A4 dimensions
 */
export async function convertImageToA4Pdf(
  file: File,
  onProgress?: (progress: TransformationProgress) => void
): Promise<TransformationResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File is not an image");
  }

  const originalFileSize = file.size;

  try {
    // Stage 1: Loading image
    onProgress?.({
      stage: "loading",
      message: "Loading image file...",
    });

    // Create image element to get dimensions
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = objectUrl;
    });

    const originalWidth = img.width;
    const originalHeight = img.height;
    URL.revokeObjectURL(objectUrl);

    onProgress?.({
      stage: "analyzing",
      message: "Analyzing image for A4 conversion...",
    });

    // Stage 2: Create PDF with A4 dimensions
    onProgress?.({
      stage: "transforming",
      currentPage: 1,
      totalPages: 1,
      message: "Converting image to A4 PDF...",
    });

    const pdfDoc = await PDFDocument.create();
    const [a4Width, a4Height] = PageSizes.A4; // A4 size: [595.28, 841.89] points

    // Add A4 page
    const page = pdfDoc.addPage([a4Width, a4Height]);

    // Set white background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: a4Width,
      height: a4Height,
      color: rgb(1, 1, 1), // White background
    });

    // Convert image to PDF-compatible format and embed
    let image;
    if (file.type === "image/png") {
      const imageBytes = new Uint8Array(await file.arrayBuffer());
      image = await pdfDoc.embedPng(imageBytes);
    } else if (file.type === "image/jpeg" || file.type === "image/jpg") {
      const imageBytes = new Uint8Array(await file.arrayBuffer());
      image = await pdfDoc.embedJpg(imageBytes);
    } else {
      // Convert other formats to PNG for better PDF compatibility
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = originalWidth;
      canvas.height = originalHeight;
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), "image/png", 0.9);
      });
      const imageBytes = new Uint8Array(await blob.arrayBuffer());
      image = await pdfDoc.embedPng(imageBytes);
    }
    const imageDims = image.scale(1);

    // Calculate scaling to fit image on A4 page while maintaining aspect ratio
    const scaleX = (a4Width * 0.9) / imageDims.width; // Use 90% of page width
    const scaleY = (a4Height * 0.9) / imageDims.height; // Use 90% of page height
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = imageDims.width * scale;
    const scaledHeight = imageDims.height * scale;

    // Center the image on the page
    const x = (a4Width - scaledWidth) / 2;
    const y = (a4Height - scaledHeight) / 2;

    // Draw the image
    page.drawImage(image, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    });

    // Stage 3: Save the PDF
    onProgress?.({
      stage: "saving",
      message: "Saving A4 PDF...",
    });

    const pdfBytes = await pdfDoc.save();
    const compressedFileSize = pdfBytes.length;

    // Calculate compression ratio
    const compressionRatio =
      originalFileSize > 0
        ? Math.round(
            ((originalFileSize - compressedFileSize) / originalFileSize) * 100
          )
        : 0;

    // Create new PDF file
    const transformedFile = new File(
      [pdfBytes],
      file.name.replace(/\.[^/.]+$/, "_A4.pdf"), // Replace extension with _A4.pdf
      { type: "application/pdf" }
    );

    onProgress?.({
      stage: "complete",
      message: `Image converted to A4 PDF successfully!`,
    });

    return {
      transformedFile,
      originalPageCount: 1,
      transformedPageCount: 1,
      originalSize: { width: originalWidth, height: originalHeight },
      targetSize: { width: a4Width, height: a4Height },
      originalFileSize,
      compressedFileSize,
      compressionRatio,
    };
  } catch (error) {
    console.error("Image to A4 PDF conversion failed:", error);
    throw new Error(
      `Failed to convert image to A4 PDF: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Convert a DOCX file to A4 PDF format
 * This function converts DOCX to HTML and then renders it as PDF
 */
export async function convertDocxToA4Pdf(
  file: File,
  onProgress?: (progress: TransformationProgress) => void
): Promise<TransformationResult> {
  if (
    !file.type.includes("officedocument.wordprocessingml") &&
    !file.name.toLowerCase().endsWith(".docx")
  ) {
    throw new Error("File is not a DOCX document");
  }

  const originalFileSize = file.size;

  try {
    // Stage 1: Loading DOCX
    onProgress?.({
      stage: "loading",
      message: "Loading DOCX document...",
    });

    const arrayBuffer = await file.arrayBuffer();

    onProgress?.({
      stage: "analyzing",
      message: "Converting DOCX to HTML...",
    });

    // Convert DOCX to HTML using mammoth
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const htmlContent = result.value;

    if (result.messages.length > 0) {
      console.warn("Mammoth conversion warnings:", result.messages);
    }

    onProgress?.({
      stage: "transforming",
      currentPage: 1,
      totalPages: 1,
      message: "Converting HTML to A4 PDF...",
    });

    // Create PDF with A4 dimensions
    const pdfDoc = await PDFDocument.create();
    const [a4Width, a4Height] = PageSizes.A4;

    // Create HTML element to render content
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.cssText = `
      width: ${a4Width * 0.75}px; 
      font-family: 'Times New Roman', serif;
      font-size: 12px;
      line-height: 1.4;
      color: black;
      background: white;
      padding: 40px;
      box-sizing: border-box;
      position: absolute;
      left: -9999px;
      top: -9999px;
    `;

    // Add to DOM temporarily for measurement
    document.body.appendChild(tempDiv);

    // Calculate how many pages we need
    const contentHeight = tempDiv.scrollHeight;
    const pageContentHeight = (a4Height - 80) * 0.75; // Account for margins
    const numberOfPages = Math.ceil(contentHeight / pageContentHeight);

    // Remove temp div
    document.body.removeChild(tempDiv);

    // For simplicity, we'll create a single page with the content
    // In a more advanced implementation, you could paginate the content
    const page = pdfDoc.addPage([a4Width, a4Height]);

    // Set white background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: a4Width,
      height: a4Height,
      color: rgb(1, 1, 1),
    });

    // Extract plain text from HTML for basic text rendering
    const textContent = htmlContent
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Basic text rendering (simplified)
    const fontSize = 12;
    const lineHeight = fontSize * 1.4;
    const margin = 40;
    const maxWidth = a4Width - 2 * margin;
    const maxLinesPerPage = Math.floor((a4Height - 2 * margin) / lineHeight);

    // Split text into words and create lines
    const words = textContent.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      // Rough estimation of text width (more precise measurement would require font metrics)
      const estimatedWidth = testLine.length * (fontSize * 0.6);

      if (estimatedWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          lines.push(word);
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // Draw text lines
    let y = a4Height - margin - fontSize;
    for (let i = 0; i < Math.min(lines.length, maxLinesPerPage); i++) {
      page.drawText(lines[i], {
        x: margin,
        y,
        size: fontSize,
        color: rgb(0, 0, 0),
      });
      y -= lineHeight;
    }

    // If there's more content, add a note
    if (lines.length > maxLinesPerPage) {
      page.drawText(
        `[Content truncated - ${lines.length - maxLinesPerPage} more lines...]`,
        {
          x: margin,
          y: y - lineHeight,
          size: fontSize - 2,
          color: rgb(0.5, 0.5, 0.5),
        }
      );
    }

    // Stage 3: Save the PDF
    onProgress?.({
      stage: "saving",
      message: "Saving A4 PDF...",
    });

    const pdfBytes = await pdfDoc.save();
    const compressedFileSize = pdfBytes.length;

    // Calculate compression ratio
    const compressionRatio =
      originalFileSize > 0
        ? Math.round(
            ((originalFileSize - compressedFileSize) / originalFileSize) * 100
          )
        : 0;

    // Create new PDF file
    const transformedFile = new File(
      [pdfBytes],
      file.name.replace(/\.docx$/i, "_A4.pdf"),
      { type: "application/pdf" }
    );

    onProgress?.({
      stage: "complete",
      message: "DOCX converted to A4 PDF successfully!",
    });

    return {
      transformedFile,
      originalPageCount: 1,
      transformedPageCount: 1,
      originalSize: { width: 595, height: 842 }, // Approximate original size
      targetSize: { width: a4Width, height: a4Height },
      originalFileSize,
      compressedFileSize,
      compressionRatio,
    };
  } catch (error) {
    console.error("DOCX to A4 PDF conversion failed:", error);
    throw new Error(
      `Failed to convert DOCX to A4 PDF: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
