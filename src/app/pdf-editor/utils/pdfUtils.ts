import { pdfjs } from "react-pdf";

/**
 * Get the page count of a PDF from its URL without loading it as the main document
 * @param pdfUrl - The URL of the PDF file
 * @returns Promise<number> - The number of pages in the PDF
 */
export const getPdfPageCount = async (pdfUrl: string): Promise<number> => {
  try {
    const loadingTask = pdfjs.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;

    // Clean up the loading task
    loadingTask.destroy();

    return pageCount;
  } catch (error) {
    console.error("Error getting PDF page count:", error);
    // Return a fallback count based on common scenarios
    return 1; // Default fallback to 1 page
  }
};

/**
 * Get the page count and dimensions of a PDF from a File object
 * @param file - The PDF file object
 * @returns Promise<{pageCount: number, pageWidth: number, pageHeight: number}> - Page count and dimensions
 */
export const getPdfPageCountFromFile = async (
  file: File
): Promise<{ pageCount: number; pageWidth: number; pageHeight: number }> => {
  try {
    // Create a temporary URL for the file
    const fileUrl = URL.createObjectURL(file);

    const loadingTask = pdfjs.getDocument(fileUrl);
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;

    // Get dimensions from the first page
    let pageWidth = 595; // Default A4 width in points
    let pageHeight = 842; // Default A4 height in points

    if (pageCount > 0) {
      try {
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1.0 });
        pageWidth = viewport.width;
        pageHeight = viewport.height;
      } catch (pageError) {
        console.warn(
          "Could not get page dimensions, using defaults:",
          pageError
        );
      }
    }

    // Clean up
    loadingTask.destroy();
    URL.revokeObjectURL(fileUrl);

    return { pageCount, pageWidth, pageHeight };
  } catch (error) {
    console.error("Error getting PDF page count from file:", error);
    // Return fallback values
    return {
      pageCount: 1,
      pageWidth: 595, // Default A4 width in points
      pageHeight: 842, // Default A4 height in points
    };
  }
};

/**
 * Get the page count of a PDF from a File object (backward compatibility)
 * @param file - The PDF file object
 * @returns Promise<number> - The number of pages in the PDF
 */
export const getPdfPageCountFromFileLegacy = async (
  file: File
): Promise<number> => {
  const result = await getPdfPageCountFromFile(file);
  return result.pageCount;
};

/**
 * Generate a blank canvas with white background that can be used as a PDF-like document
 * @param width - Page width in pixels
 * @param height - Page height in pixels
 * @returns Promise<Blob> - The generated canvas as a Blob
 */
export const generateBlankCanvas = async (
  width: number,
  height: number
): Promise<Blob> => {
  try {
    // Check if we're in a browser environment
    if (typeof document === "undefined") {
      throw new Error("Canvas generation requires browser environment");
    }

    // Validate dimensions
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid dimensions: width and height must be positive");
    }

    // Limit dimensions to reasonable values to prevent memory issues
    const maxDimension = 10000;
    if (width > maxDimension || height > maxDimension) {
      throw new Error(
        `Dimensions too large: max allowed is ${maxDimension}x${maxDimension}`
      );
    }

    // Create a canvas element
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    // Get the 2D context and fill with white background
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas 2D context");
    }

    // Set white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Add a subtle border to make the page visible
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert canvas to blob"));
          }
        },
        "image/png",
        0.95
      ); // High quality PNG
    });
  } catch (error) {
    console.error("Error generating blank canvas:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate blank canvas: ${errorMessage}`);
  }
};

/**
 * Check if a file is a PDF
 * @param file - The file to check
 * @returns boolean - True if the file is a PDF
 */
export const isPdfFile = (file: File): boolean => {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
};

/**
 * Get file type information
 * @param file - The file to analyze
 * @returns object - File type information
 */
export const getFileTypeInfo = (file: File) => {
  const isPdf = isPdfFile(file);
  const isImage = file.type.startsWith("image/");

  return {
    isPdf,
    isImage,
    mimeType: file.type,
    extension: file.name.split(".").pop()?.toLowerCase() || "",
    fileName: file.name,
  };
};
