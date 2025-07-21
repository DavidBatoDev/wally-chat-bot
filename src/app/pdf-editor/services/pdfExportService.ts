import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { loadHtml2Canvas } from "../utils/html2canvasLoader";

// Types for PDF operations
export interface PdfExportOptions {
  documentRef: React.RefObject<HTMLDivElement | null>;
  documentState: {
    scale: number;
    numPages: number;
    pageWidth: number;
    pageHeight: number;
    url: string;
  };
  pageState: {
    deletedPages: Set<number>;
  };
  editorState: {
    selectedFieldId: string | null;
    selectedShapeId: string | null;
    isEditMode: boolean;
    isAddTextBoxMode: boolean;
  };
  viewState: {
    currentView: string;
  };
  templateCanvas?: HTMLCanvasElement | null;
  setDocumentState: (updater: (prev: any) => any) => void;
  setViewState: (updater: (prev: any) => any) => void;
  setEditorState: (updater: (prev: any) => any) => void;
}

export interface FileUploadOptions {
  file: File;
  actions: {
    loadDocument: (file: File) => void;
  };
  clearAllElementsAndState: () => void;
  createBlankPdfAndAddImage: (file: File) => Promise<void>;
  setViewState: (updater: (prev: any) => any) => void;
  setPageState: (updater: (prev: any) => any) => void;
}

export interface AppendDocumentOptions {
  file: File;
  documentState: {
    url: string;
  };
  actions: {
    loadDocument: (file: File) => void;
  };
  appendImageAsNewPage: (file: File) => Promise<void>;
  appendPdfDocument: (file: File) => Promise<void>;
  setViewState: (updater: (prev: any) => any) => void;
}

export interface CreateBlankPdfOptions {
  imageFile: File;
  actions: {
    loadDocument: (file: File) => void;
  };
  handleAddImageWithUndo: (
    url: string,
    x: number,
    y: number,
    width: number,
    height: number,
    page: number,
    view: string
  ) => string | null;
  handleImageSelect: (id: string) => void;
  setViewState: (updater: (prev: any) => any) => void;
}

/**
 * Exports the PDF document with all pages in a 2x2 grid layout
 */
export async function exportPdfDocument(options: PdfExportOptions): Promise<void> {
  const {
    documentRef,
    documentState,
    pageState,
    editorState,
    viewState,
    templateCanvas,
    setDocumentState,
    setViewState,
    setEditorState
  } = options;

  if (!documentRef.current) {
    toast.error("Document not loaded");
    return;
  }

  // Save current state
  const originalScale = documentState.scale;
  const originalView = viewState.currentView;
  const originalSelectedField = editorState.selectedFieldId;
  const originalSelectedShape = editorState.selectedShapeId;
  const originalEditMode = editorState.isEditMode;

  const loadingToast = toast.loading("Generating PDF...");

  try {
    // Set up for export - hide UI elements and set optimal scale
    setEditorState((prev) => ({
      ...prev,
      selectedFieldId: null,
      selectedShapeId: null,
      isEditMode: false,
      isTextSelectionMode: false,
      isAddTextBoxMode: false,
      isSelectionMode: false,
    }));

    // Set zoom to 500% for maximum quality
    setDocumentState((prev) => ({ ...prev, scale: 5.0 }));

    // Wait for zoom to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Load html2canvas with proper error handling
    const html2canvas = await loadHtml2Canvas();

    // Create PDF document
    const pdfDoc = await PDFDocument.create();

    // Add template page as the first page if template canvas is available
    if (templateCanvas) {
      await addTemplatePage(pdfDoc, templateCanvas);
    }

    // Capture all non-deleted pages
    const { captures, nonDeletedPages } = await captureAllPages(
      documentRef,
      documentState,
      pageState,
      html2canvas,
      setViewState,
      setDocumentState,
      setEditorState,
      editorState
    );

    if (nonDeletedPages.length === 0) {
      toast.error("No pages available for export. All pages have been deleted.");
      return;
    }

    // Create PDF pages from captures
    await createPdfPagesFromCaptures(pdfDoc, captures);

    // Save and download the PDF
    await downloadPdf(pdfDoc, "pdf-editor-export-all-pages.pdf");

    // Restore original state
    restoreOriginalState(
      setDocumentState,
      setViewState,
      setEditorState,
      originalScale,
      originalView,
      originalSelectedField,
      originalSelectedShape,
      originalEditMode
    );

    toast.dismiss(loadingToast);
    toast.success("PDF exported successfully!");

  } catch (error) {
    console.error("Error exporting PDF:", error);
    toast.dismiss(loadingToast);
    toast.error("Failed to export PDF");

    // Restore original state on error
    restoreOriginalState(
      setDocumentState,
      setViewState,
      setEditorState,
      originalScale,
      originalView,
      originalSelectedField,
      originalSelectedShape,
      originalEditMode
    );
  }
}

/**
 * Handles file upload for both PDF and image files
 */
export function handleFileUpload(
  event: React.ChangeEvent<HTMLInputElement>,
  options: FileUploadOptions
): void {
  const file = event.target.files?.[0];
  if (!file) return;

  const {
    actions,
    clearAllElementsAndState,
    createBlankPdfAndAddImage,
    setViewState,
    setPageState
  } = options;

  const fileType = getFileType(file.name);

  // Clear all elements and state when uploading a new document
  clearAllElementsAndState();

  if (fileType === "image") {
    // For images, create a blank PDF and add the image as an interactive element
    createBlankPdfAndAddImage(file);
    setPageState((prev) => ({ ...prev, deletedPages: new Set() }));
  } else {
    // For PDFs, load normally
    actions.loadDocument(file);
    setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));
    setPageState((prev) => ({ ...prev, deletedPages: new Set() }));
  }
}

/**
 * Handles appending documents to existing document
 */
export async function handleAppendDocument(
  event: React.ChangeEvent<HTMLInputElement>,
  options: AppendDocumentOptions
): Promise<void> {
  const file = event.target.files?.[0];
  if (!file) return;

  const {
    documentState,
    actions,
    appendImageAsNewPage,
    appendPdfDocument,
    setViewState
  } = options;

  const fileType = getFileType(file.name);

  if (!documentState.url) {
    toast.error("Please upload a document first before appending.");
    return;
  }

  try {
    if (fileType === "image") {
      await appendImageAsNewPage(file);
    } else {
      await appendPdfDocument(file);
    }

    // Switch to pages tab
    setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));
  } catch (error) {
    console.error("Error appending document:", error);
    toast.error("Failed to append document. Please try again.");
  }
}

/**
 * Creates a blank PDF and adds an image as an interactive element
 */
export async function createBlankPdfAndAddImage(
  imageFile: File,
  options: CreateBlankPdfOptions
): Promise<void> {
  const {
    actions,
    handleAddImageWithUndo,
    handleImageSelect,
    setViewState
  } = options;

  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Add a blank page (A4 size: 595.28 x 841.89 points)
    const page = pdfDoc.addPage([595.28, 841.89]);

    // Convert the PDF to bytes
    const pdfBytes = await pdfDoc.save();

    // Create a blob URL for the blank PDF
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

    // Convert Blob to File object
    const pdfFile = new File([pdfBlob], "blank-document.pdf", {
      type: "application/pdf",
    });

    // Load the blank PDF as the document
    actions.loadDocument(pdfFile);
    setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));

    // Create image URL and add as interactive element
    const imageUrl = URL.createObjectURL(imageFile);

    // Create a new image element
    const imageId = handleAddImageWithUndo(
      imageUrl,
      50, // Center the image on the page
      50,
      300, // Default size
      200,
      1, // Page 1
      "original" // Add to original view
    );

    // Select the image and open format drawer
    if (imageId) {
      handleImageSelect(imageId);
    }

    toast.success("Image uploaded as interactive element on blank PDF");
  } catch (error) {
    console.error("Error creating blank PDF:", error);
    toast.error("Failed to create blank PDF");
  }
}

/**
 * Appends an image as a new page to existing PDF
 */
export async function appendImageAsNewPage(
  imageFile: File,
  documentUrl: string,
  actions: { loadDocument: (file: File) => void },
  handleAddImageWithUndo: (
    url: string,
    x: number,
    y: number,
    width: number,
    height: number,
    page: number,
    view: string
  ) => string | null,
  handleImageSelect: (id: string) => void
): Promise<void> {
  try {
    // Load the current document
    const currentResponse = await fetch(documentUrl);
    const currentArrayBuffer = await currentResponse.arrayBuffer();
    const currentPdfDoc = await PDFDocument.load(currentArrayBuffer);

    // Add a new blank page (A4 size: 595.28 x 841.89 points)
    const newPage = currentPdfDoc.addPage([595.28, 841.89]);

    // Save the updated PDF as a new blob
    const updatedPdfBytes = await currentPdfDoc.save();
    const updatedBlob = new Blob([updatedPdfBytes], {
      type: "application/pdf",
    });

    // Convert Blob to File object
    const updatedFile = new File([updatedBlob], "updated-document.pdf", {
      type: "application/pdf",
    });

    // Load the updated PDF
    actions.loadDocument(updatedFile);

    // Create image URL and add as interactive element on the new page
    const imageUrl = URL.createObjectURL(imageFile);
    const newPageNumber = currentPdfDoc.getPageCount(); // The page we just added

    // Create a new image element
    const imageId = handleAddImageWithUndo(
      imageUrl,
      50, // Center the image on the page
      50,
      300, // Default size
      200,
      newPageNumber,
      "original" // Add to original view
    );

    // Select the image and open format drawer
    if (imageId) {
      handleImageSelect(imageId);
    }

    toast.success("Image appended as new page successfully!");
  } catch (error) {
    console.error("Error appending image:", error);
    toast.error("Failed to append image");
  }
}

/**
 * Appends a PDF document to existing document
 */
export async function appendPdfDocument(
  pdfFile: File,
  documentUrl: string,
  actions: { loadDocument: (file: File) => void }
): Promise<void> {
  try {
    // Load the current document
    const currentResponse = await fetch(documentUrl);
    const currentArrayBuffer = await currentResponse.arrayBuffer();
    const currentPdfDoc = await PDFDocument.load(currentArrayBuffer);

    // Load the new document to append
    const newArrayBuffer = await pdfFile.arrayBuffer();
    const newPdfDoc = await PDFDocument.load(newArrayBuffer);

    // Copy all pages from the new document to the current document
    const newPages = await currentPdfDoc.copyPages(
      newPdfDoc,
      newPdfDoc.getPageIndices()
    );
    newPages.forEach((page) => currentPdfDoc.addPage(page));

    // Save the merged PDF as a new blob
    const mergedPdfBytes = await currentPdfDoc.save();
    const mergedBlob = new Blob([mergedPdfBytes], {
      type: "application/pdf",
    });

    // Convert Blob to File object
    const mergedFile = new File([mergedBlob], "merged-document.pdf", {
      type: "application/pdf",
    });

    // Load the merged PDF
    actions.loadDocument(mergedFile);

    toast.success("PDF document appended successfully!");
  } catch (error) {
    console.error("Error appending PDF:", error);
    toast.error("Failed to append PDF document");
  }
}

/**
 * Exports element collections and document info as JSON
 */
export function exportDataAsJson(
  elementCollections: any,
  documentState: any
): void {
  const data = {
    ...elementCollections,
    documentInfo: {
      url: documentState.url,
      currentPage: documentState.currentPage,
      numPages: documentState.numPages,
      scale: documentState.scale,
      pageWidth: documentState.pageWidth,
      pageHeight: documentState.pageHeight,
    },
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pdf-editor-data.json";
  a.click();
  URL.revokeObjectURL(url);

  toast.success("Data exported successfully!");
}

// Helper functions

/**
 * Determines file type based on extension
 */
export function getFileType(filename: string): "pdf" | "image" {
  const extension = filename.split(".").pop()?.toLowerCase();
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
  return imageExtensions.includes(extension || "") ? "image" : "pdf";
}

/**
 * Adds template page to PDF document
 */
async function addTemplatePage(
  pdfDoc: PDFDocument,
  templateCanvas: HTMLCanvasElement
): Promise<void> {
  try {
    console.log("Adding template page to PDF");
    const templateDataUrl = templateCanvas.toDataURL("image/png", 1.0);
    
    const templateImageBytes = await fetch(templateDataUrl).then((res) =>
      res.arrayBuffer()
    );
    
    const templateImage = await pdfDoc.embedPng(templateImageBytes);

    // Create first page with template
    const templatePage = pdfDoc.addPage([612, 792]); // Letter size
    const { width: pageWidth, height: pageHeight } = templatePage.getSize();

    // Scale template to fit page while maintaining aspect ratio
    const templateDims = templateImage.scale(1);
    const scaleX = pageWidth / templateDims.width;
    const scaleY = pageHeight / templateDims.height;
    const templateScale = Math.min(scaleX, scaleY);

    const scaledWidth = templateDims.width * templateScale;
    const scaledHeight = templateDims.height * templateScale;

    // Center the template on the page
    const x = (pageWidth - scaledWidth) / 2;
    const y = (pageHeight - scaledHeight) / 2;

    templatePage.drawImage(templateImage, {
      x: x,
      y: y,
      width: scaledWidth,
      height: scaledHeight,
    });

    // Add a title to the template page
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    templatePage.drawText("EXPORT TEMPLATE", {
      x: pageWidth / 2 - 60,
      y: pageHeight - 30,
      size: 16,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Add page number to template page
    templatePage.drawText("Page 1 (Template)", {
      x: pageWidth / 2 - 50,
      y: 30,
      size: 12,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    console.log("Template page added successfully");
  } catch (error) {
    console.error("Error adding template page:", error);
    // Continue without template if there's an error
  }
}

/**
 * Captures all non-deleted pages in both original and translated views
 */
async function captureAllPages(
  documentRef: React.RefObject<HTMLDivElement | null>,
  documentState: any,
  pageState: any,
  html2canvas: any,
  setViewState: (updater: (prev: any) => any) => void,
  setDocumentState: (updater: (prev: any) => any) => void,
  setEditorState: (updater: (prev: any) => any) => void,
  editorState: any
): Promise<{ captures: any[]; nonDeletedPages: number[] }> {
  const totalPages = documentState.numPages;
  const deletedPages = pageState.deletedPages;
  const allCaptures = [];

  // Get all non-deleted page numbers
  const nonDeletedPages = [];
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    if (!deletedPages.has(pageNumber)) {
      nonDeletedPages.push(pageNumber);
    }
  }

  // Function to capture view as image for a specific page
  const captureViewAsImage = async (
    viewType: "original" | "translated",
    pageNumber: number
  ) => {
    // Set view to the target type
    setViewState((prev) => ({ ...prev, currentView: viewType }));

    // Set page number
    setDocumentState((prev) => ({ ...prev, currentPage: pageNumber }));

    // Temporarily disable text rendering for export
    const originalAddTextBoxMode = editorState.isAddTextBoxMode;
    setEditorState((prev) => ({ ...prev, isAddTextBoxMode: false }));

    // Wait for view and page to update
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Use the entire document ref
    const documentContainer = documentRef.current;

    if (!documentContainer) {
      throw new Error(
        `Document container not found for ${viewType} view page ${pageNumber}`
      );
    }

    // Capture the view
    const canvas = await html2canvas(documentContainer, {
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      foreignObjectRendering: false,
      ignoreElements: (element: Element): boolean => {
        return (
          element.classList.contains("drag-handle") ||
          element.tagName === "BUTTON" ||
          element.classList.contains("settings-popup") ||
          element.classList.contains("text-selection-popup") ||
          element.classList.contains("shape-dropdown") ||
          element.classList.contains("field-status-dropdown") ||
          element.classList.contains("fixed") ||
          element.closest(".fixed") !== null ||
          element.classList.contains("react-resizable-handle")
        );
      },
    });

    // Restore original text rendering state
    setEditorState((prev) => ({
      ...prev,
      isAddTextBoxMode: originalAddTextBoxMode,
    }));

    return canvas;
  };

  // Process non-deleted pages in pairs (2 pages per PDF page)
  for (let i = 0; i < nonDeletedPages.length; i += 2) {
    const page1 = nonDeletedPages[i];
    const page2 = nonDeletedPages[i + 1];
    const hasPage2 = page2 !== undefined;

    const pageCaptures = [];

    // Page 1 - Original view
    pageCaptures.push({
      canvas: await captureViewAsImage("original", page1),
      type: "original",
      page: page1,
      position: "top-left",
    });

    // Page 1 - Translated view
    pageCaptures.push({
      canvas: await captureViewAsImage("translated", page1),
      type: "translated",
      page: page1,
      position: "top-right",
    });

    if (hasPage2) {
      // Page 2 - Original view
      pageCaptures.push({
        canvas: await captureViewAsImage("original", page2),
        type: "original",
        page: page2,
        position: "bottom-left",
      });

      // Page 2 - Translated view
      pageCaptures.push({
        canvas: await captureViewAsImage("translated", page2),
        type: "translated",
        page: page2,
        position: "bottom-right",
      });
    }

    allCaptures.push({
      pageNumber: Math.floor(i / 2) + 1,
      captures: pageCaptures,
      page1,
      page2: hasPage2 ? page2 : null,
    });
  }

  return { captures: allCaptures, nonDeletedPages };
}

/**
 * Creates PDF pages from captured images
 */
async function createPdfPagesFromCaptures(
  pdfDoc: PDFDocument,
  captures: any[]
): Promise<void> {
  for (const pageData of captures) {
    const { pageNumber, captures: pageCaptures, page1, page2 } = pageData;

    // Convert captures to images and embed in PDF
    const embeddedImages = [];

    for (const capture of pageCaptures) {
      const dataUrl = capture.canvas.toDataURL("image/png", 1.0);
      const imageBytes = await fetch(dataUrl).then((res) =>
        res.arrayBuffer()
      );
      const embeddedImage = await pdfDoc.embedPng(imageBytes);
      embeddedImages.push({
        ...capture,
        image: embeddedImage,
        dims: embeddedImage.scale(1),
      });
    }

    // Create a new page for this pair
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Embed fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Add section labels
    const labelFontSize = 20;
    const originalLabel = "ORIGINAL";
    const translatedLabel = "TRANSLATED";

    // Calculate label widths for centering
    const halfWidth = pageWidth / 2;
    const originalLabelWidth = font.widthOfTextAtSize(
      originalLabel,
      labelFontSize
    );
    const translatedLabelWidth = font.widthOfTextAtSize(
      translatedLabel,
      labelFontSize
    );

    // Center labels in their respective halves
    const originalX = (halfWidth - originalLabelWidth) / 2;
    page.drawText(originalLabel, {
      x: originalX,
      y: pageHeight - 60,
      size: labelFontSize,
      font: font,
      color: rgb(0, 0, 0),
    });

    const translatedX = halfWidth + (halfWidth - translatedLabelWidth) / 2;
    page.drawText(translatedLabel, {
      x: translatedX,
      y: pageHeight - 60,
      size: labelFontSize,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Calculate grid layout
    const gridMargin = 10;
    const gridSpacing = 8;
    const labelSpace = 15;
    const availableWidth = pageWidth - gridMargin * 2;
    const availableHeight = pageHeight - gridMargin * 2 - labelSpace;

    const quadrantWidth = (availableWidth - gridSpacing) / 2;
    const quadrantHeight = (availableHeight - gridSpacing) / 2;

    // Draw each image in its grid position
    for (const imageData of embeddedImages) {
      const { image, dims, position } = imageData;

      // Calculate scaling to fit in quadrant
      const scaleX = quadrantWidth / dims.width;
      const scaleY = quadrantHeight / dims.height;
      const imageScale = Math.min(scaleX, scaleY);

      const scaledWidth = dims.width * imageScale;
      const scaledHeight = dims.height * imageScale;

      // Calculate position based on grid layout
      let x, y;
      switch (position) {
        case "top-left":
          x = gridMargin;
          y = pageHeight - labelSpace - quadrantHeight;
          break;
        case "top-right":
          x = gridMargin + quadrantWidth + gridSpacing;
          y = pageHeight - labelSpace - quadrantHeight;
          break;
        case "bottom-left":
          x = gridMargin;
          y = pageHeight - labelSpace - quadrantHeight * 2 - gridSpacing;
          break;
        case "bottom-right":
          x = gridMargin + quadrantWidth + gridSpacing;
          y = pageHeight - labelSpace - quadrantHeight * 2 - gridSpacing;
          break;
        default:
          x = gridMargin;
          y = pageHeight - labelSpace - quadrantHeight;
      }

      // Center the image in its quadrant
      x += (quadrantWidth - scaledWidth) / 2;
      y += (quadrantHeight - scaledHeight) / 2;

      // Draw the image
      page.drawImage(image, {
        x: x,
        y: y,
        width: scaledWidth,
        height: scaledHeight,
      });
    }

    // Add grid separator lines
    const centerX = gridMargin + quadrantWidth + gridSpacing / 2;
    const centerY =
      pageHeight - labelSpace - quadrantHeight - gridSpacing / 2;

    // Vertical line
    page.drawLine({
      start: { x: centerX, y: gridMargin },
      end: { x: centerX, y: pageHeight - labelSpace },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Horizontal line
    page.drawLine({
      start: { x: gridMargin, y: centerY },
      end: { x: pageWidth - gridMargin, y: centerY },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
  }
}

/**
 * Downloads the PDF document
 */
async function downloadPdf(pdfDoc: PDFDocument, filename: string): Promise<void> {
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Restores the original editor state after export
 */
function restoreOriginalState(
  setDocumentState: (updater: (prev: any) => any) => void,
  setViewState: (updater: (prev: any) => any) => void,
  setEditorState: (updater: (prev: any) => any) => void,
  originalScale: number,
  originalView: string,
  originalSelectedField: string | null,
  originalSelectedShape: string | null,
  originalEditMode: boolean
): void {
  setDocumentState((prev) => ({ ...prev, scale: originalScale }));
  setViewState((prev) => ({ ...prev, currentView: originalView }));
  setEditorState((prev) => ({
    ...prev,
    selectedFieldId: originalSelectedField,
    selectedShapeId: originalSelectedShape,
    isEditMode: originalEditMode,
  }));
}
