import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import domtoimage from "dom-to-image";
import JSZip from "jszip";

// Types for PDF operations
export interface PdfExportOptions {
  documentRef: React.RefObject<HTMLDivElement | null>;
  documentState: {
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

// Types for Image export operations
export interface ImageExportOptions {
  documentRef: React.RefObject<HTMLDivElement | null>;
  documentState: {
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
  exportSettings: {
    format: "png" | "jpg";
    quality: number;
    includeOriginal: boolean;
    includeTranslated: boolean;
    pageRange: "all" | "current" | "custom";
    customRange: string;
  };
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
 * Exports the PDF document with all pages in a 2x2 grid layout using DOM-to-image
 */
export async function exportPdfDocument(
  options: PdfExportOptions
): Promise<void> {
  const {
    documentRef,
    documentState,
    pageState,
    editorState,
    viewState,
    templateCanvas,
    setDocumentState,
    setViewState,
    setEditorState,
  } = options;

  if (!documentRef.current) {
    toast.error("Document not loaded");
    return;
  }

  // Save current state
  // Scale removed - always 1
  const originalView = viewState.currentView;
  const originalSelectedField = editorState.selectedFieldId;
  const originalSelectedShape = editorState.selectedShapeId;
  const originalEditMode = editorState.isEditMode;

  const loadingToast = toast.loading("Generating PDF from final layout...");

  try {
    // Set up for export - hide UI elements
    setEditorState((prev) => ({
      ...prev,
      selectedFieldId: null,
      selectedShapeId: null,
      isEditMode: false,
      isTextSelectionMode: false,
      isAddTextBoxMode: false,
      isSelectionMode: false,
    }));

    // Switch to final-layout view for export
    setViewState((prev) => ({ ...prev, currentView: "final-layout" }));

    // Wait for view to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create PDF document
    const pdfDoc = await PDFDocument.create();

    // Add template page as the first page if template canvas is available
    if (templateCanvas) {
      await addTemplatePage(pdfDoc, templateCanvas);
    }

    // Capture all non-deleted pages in final-layout view
    const { captures, nonDeletedPages } = await captureAllPagesWithDomToImage(
      documentRef,
      documentState,
      pageState,
      setViewState,
      setDocumentState,
      setEditorState,
      editorState
    );

    if (nonDeletedPages.length === 0) {
      toast.error(
        "No pages available for export. All pages have been deleted."
      );
      return;
    }

    // Create PDF pages from captures
    await createPdfPagesFromCaptures(pdfDoc, captures);

    // Save and download the PDF
    await downloadPdf(pdfDoc, "final-layout-export.pdf");

    // Restore original state
    restoreOriginalState(
      setDocumentState,
      setViewState,
      setEditorState,
      // scale removed
      originalView,
      originalSelectedField,
      originalSelectedShape,
      originalEditMode
    );

    toast.dismiss(loadingToast);
    toast.success("Final layout PDF exported successfully!");
  } catch (error) {
    console.error("Error exporting PDF:", error);
    toast.dismiss(loadingToast);
    toast.error("Failed to export PDF");

    // Restore original state on error
    restoreOriginalState(
      setDocumentState,
      setViewState,
      setEditorState,
      // scale removed
      originalView,
      originalSelectedField,
      originalSelectedShape,
      originalEditMode
    );
  }
}

/**
 * Exports the document as PNG images using DOM-to-image
 */
export async function exportPngImages(
  options: ImageExportOptions
): Promise<void> {
  const {
    documentRef,
    documentState,
    pageState,
    editorState,
    viewState,
    exportSettings,
    setDocumentState,
    setViewState,
    setEditorState,
  } = options;

  if (!documentRef.current) {
    toast.error("Document not loaded");
    return;
  }

  // Save current state
  // Scale removed - always 1
  const originalView = viewState.currentView;
  const originalSelectedField = editorState.selectedFieldId;
  const originalSelectedShape = editorState.selectedShapeId;
  const originalEditMode = editorState.isEditMode;

  const loadingToast = toast.loading("Generating PNG images...");

  try {
    // Set up for export - hide UI elements
    setEditorState((prev) => ({
      ...prev,
      selectedFieldId: null,
      selectedShapeId: null,
      isEditMode: false,
      isTextSelectionMode: false,
      isAddTextBoxMode: false,
      isSelectionMode: false,
    }));

    // Get pages to export based on settings
    const pagesToExport = getPagesToExport(
      documentState.numPages,
      pageState.deletedPages,
      exportSettings
    );

    if (pagesToExport.length === 0) {
      toast.error("No pages available for export");
      return;
    }

    // Capture and export each page
    const exportedFiles = [] as Array<{
      canvas: HTMLCanvasElement;
      filename: string;
      viewType: string;
    }>;
    for (const pageNumber of pagesToExport) {
      const pageImages = await capturePageAsImages(
        documentRef,
        pageNumber,
        exportSettings,
        setViewState,
        setDocumentState,
        setEditorState,
        editorState
      );

      exportedFiles.push(...pageImages);
    }

    // Download all images
    await downloadImages(exportedFiles, "png");

    // Restore original state
    restoreOriginalState(
      setDocumentState,
      setViewState,
      setEditorState,
      // scale removed
      originalView,
      originalSelectedField,
      originalSelectedShape,
      originalEditMode
    );

    toast.dismiss(loadingToast);
    toast.success(`${exportedFiles.length} PNG images exported successfully!`);
  } catch (error) {
    console.error("Error exporting PNG images:", error);
    toast.dismiss(loadingToast);
    toast.error("Failed to export PNG images");

    // Restore original state on error
    restoreOriginalState(
      setDocumentState,
      setViewState,
      setEditorState,
      // scale removed
      originalView,
      originalSelectedField,
      originalSelectedShape,
      originalEditMode
    );
  }
}

/**
 * Exports the document as JPEG images using DOM-to-image
 */
export async function exportJpegImages(
  options: ImageExportOptions
): Promise<void> {
  const {
    documentRef,
    documentState,
    pageState,
    editorState,
    viewState,
    exportSettings,
    setDocumentState,
    setViewState,
    setEditorState,
  } = options;

  if (!documentRef.current) {
    toast.error("Document not loaded");
    return;
  }

  // Save current state
  // Scale removed - always 1
  const originalView = viewState.currentView;
  const originalSelectedField = editorState.selectedFieldId;
  const originalSelectedShape = editorState.selectedShapeId;
  const originalEditMode = editorState.isEditMode;

  const loadingToast = toast.loading("Generating JPEG images...");

  try {
    // Set up for export - hide UI elements
    setEditorState((prev) => ({
      ...prev,
      selectedFieldId: null,
      selectedShapeId: null,
      isEditMode: false,
      isTextSelectionMode: false,
      isAddTextBoxMode: false,
      isSelectionMode: false,
    }));

    // Get pages to export based on settings
    const pagesToExport = getPagesToExport(
      documentState.numPages,
      pageState.deletedPages,
      exportSettings
    );

    if (pagesToExport.length === 0) {
      toast.error("No pages available for export");
      return;
    }

    // Capture and export each page
    const exportedFiles = [] as Array<{
      canvas: HTMLCanvasElement;
      filename: string;
      viewType: string;
    }>;
    for (const pageNumber of pagesToExport) {
      const pageImages = await capturePageAsImages(
        documentRef,
        pageNumber,
        exportSettings,
        setViewState,
        setDocumentState,
        setEditorState,
        editorState
      );

      exportedFiles.push(...pageImages);
    }

    // Download all images
    await downloadImages(exportedFiles, "jpeg");

    // Restore original state
    restoreOriginalState(
      setDocumentState,
      setViewState,
      setEditorState,
      // scale removed
      originalView,
      originalSelectedField,
      originalSelectedShape,
      originalEditMode
    );

    toast.dismiss(loadingToast);
    toast.success(`${exportedFiles.length} JPEG images exported successfully!`);
  } catch (error) {
    console.error("Error exporting JPEG images:", error);
    toast.dismiss(loadingToast);
    toast.error("Failed to export JPEG images");

    // Restore original state on error
    restoreOriginalState(
      setDocumentState,
      setViewState,
      setEditorState,
      // scale removed
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
    setPageState,
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
    setViewState,
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
  const { actions, handleAddImageWithUndo, handleImageSelect, setViewState } =
    options;

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
 * Captures all non-deleted pages using DOM-to-image
 */
async function captureAllPagesWithDomToImage(
  documentRef: React.RefObject<HTMLDivElement | null>,
  documentState: any,
  pageState: any,
  setViewState: (updater: (prev: any) => any) => void,
  setDocumentState: (updater: (prev: any) => any) => void,
  setEditorState: (updater: (prev: any) => any) => void,
  editorState: any
): Promise<{ captures: any[]; nonDeletedPages: number[] }> {
  const totalPages =
    documentState.finalLayoutNumPages || documentState.numPages;
  const deletedPages =
    documentState.finalLayoutDeletedPages || pageState.deletedPages;
  const allCaptures = [] as any[];

  // Get all non-deleted page numbers
  const nonDeletedPages = [] as number[];
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    if (!deletedPages.has(pageNumber)) {
      nonDeletedPages.push(pageNumber);
    }
  }

  // Function to capture final-layout view as image for a specific page using DOM-to-image
  const captureFinalLayoutView = async (pageNumber: number) => {
    console.log(`Setting up capture for final-layout page ${pageNumber}`);

    // Set view to final-layout
    setViewState((prev) => ({ ...prev, currentView: "final-layout" }));

    // Set final layout page number (use finalLayoutCurrentPage for final layout navigation)
    setDocumentState((prev) => ({
      ...prev,
      finalLayoutCurrentPage: pageNumber,
      currentPage: pageNumber, // Also update currentPage for compatibility
    }));

    // Force a re-render by updating the page loading state
    setDocumentState((prev) => ({
      ...prev,
      isPageLoading: true,
    }));

    console.log(
      `Set final-layout page to ${pageNumber}, waiting for update...`
    );

    // Temporarily disable text rendering for export
    const originalAddTextBoxMode = editorState.isAddTextBoxMode;
    setEditorState((prev) => ({ ...prev, isAddTextBoxMode: false }));

    // Wait for view and page to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`Starting DOM capture for final-layout page ${pageNumber}`);

    // Additional wait to ensure PDF.js has time to re-render the new page
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Wait for page loading to complete
    let attempts = 0;
    while (documentState.isPageLoading && attempts < 10) {
      console.log(
        `Waiting for page ${pageNumber} to finish loading... (attempt ${
          attempts + 1
        })`
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      attempts++;
    }

    // Verify that the page actually changed
    console.log(
      `Current final-layout page after update: ${documentState.finalLayoutCurrentPage}`
    );
    console.log(
      `Current regular page after update: ${documentState.currentPage}`
    );

    // Use the entire document ref
    const documentContainer = documentRef.current;

    if (!documentContainer) {
      throw new Error(
        `Document container not found for final-layout view page ${pageNumber}`
      );
    }

    // Log the current page number in the DOM to verify it changed
    const pageElements =
      documentContainer.querySelectorAll("[data-page-number]");
    console.log(`Found ${pageElements.length} page elements in DOM`);
    pageElements.forEach((el, index) => {
      console.log(
        `Page element ${index}:`,
        el.getAttribute("data-page-number")
      );
    });

    try {
      // Use DOM-to-image to capture the element
      const dataUrl = await domtoimage.toPng(documentContainer, {
        quality: 1.0,
        bgcolor: "#ffffff",
        width: documentContainer.offsetWidth,
        height: documentContainer.offsetHeight,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
        filter: (node: Node): boolean => {
          // Filter out unwanted elements
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            // Skip interactive UI elements
            if (
              element.classList.contains("drag-handle") ||
              element.tagName === "BUTTON" ||
              element.classList.contains("settings-popup") ||
              element.classList.contains("text-selection-popup") ||
              element.classList.contains("shape-dropdown") ||
              element.classList.contains("field-status-dropdown") ||
              element.classList.contains("fixed") ||
              element.closest(".fixed") !== null ||
              element.classList.contains("react-resizable-handle") ||
              element.classList.contains("resizable-handle")
            ) {
              return false;
            }
          }
          return true;
        },
      });

      // Convert data URL to canvas for consistency with the rest of the code
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      return new Promise<HTMLCanvasElement>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          resolve(canvas);
        };

        img.onerror = reject;
        img.src = dataUrl;
      });
    } catch (error) {
      console.error(
        `Error capturing final-layout view for page ${pageNumber}:`,
        error
      );
      // Fallback: create an error canvas
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
          "Error capturing page",
          canvas.width / 2,
          canvas.height / 2
        );
      }
      return canvas;
    } finally {
      // Restore original text rendering state
      setEditorState((prev) => ({
        ...prev,
        isAddTextBoxMode: originalAddTextBoxMode,
      }));
    }
  };

  // Process non-deleted pages - capture each page in final-layout view
  console.log(
    `Starting capture of ${nonDeletedPages.length} final layout pages:`,
    nonDeletedPages
  );

  for (let i = 0; i < nonDeletedPages.length; i++) {
    const pageNumber = nonDeletedPages[i];
    console.log(
      `Capturing final-layout page ${pageNumber} (${i + 1}/${
        nonDeletedPages.length
      })`
    );
    console.log(
      `Before capture - finalLayoutCurrentPage: ${documentState.finalLayoutCurrentPage}, currentPage: ${documentState.currentPage}`
    );

    try {
      // Capture the page in final-layout view
      const canvas = await captureFinalLayoutView(pageNumber);

      allCaptures.push({
        pageNumber: i + 1,
        captures: [
          {
            canvas: canvas,
            type: "final-layout",
            page: pageNumber,
            position: "full-page",
          },
        ],
        page1: pageNumber,
        page2: null,
      });

      console.log(`Successfully captured final-layout page ${pageNumber}`);
      console.log(
        `After capture - finalLayoutCurrentPage: ${documentState.finalLayoutCurrentPage}, currentPage: ${documentState.currentPage}`
      );
    } catch (error) {
      console.error(`Error capturing final-layout page ${pageNumber}:`, error);
      // Continue with what we have
    }
  }

  console.log(`Capture complete. Total captures: ${allCaptures.length}`);

  return { captures: allCaptures, nonDeletedPages };
}

/**
 * Creates PDF pages from captured final-layout images
 */
async function createPdfPagesFromCaptures(
  pdfDoc: PDFDocument,
  captures: any[]
): Promise<void> {
  for (const pageData of captures) {
    const { pageNumber, captures: pageCaptures } = pageData;

    // Convert captures to images and embed in PDF
    const embeddedImages = [] as Array<{ image: any; dims: any }>;

    for (const capture of pageCaptures) {
      const dataUrl = capture.canvas.toDataURL("image/png", 1.0);
      const imageBytes = await fetch(dataUrl).then((res) => res.arrayBuffer());
      const embeddedImage = await pdfDoc.embedPng(imageBytes);
      embeddedImages.push({
        ...capture,
        image: embeddedImage,
        dims: embeddedImage.scale(1),
      });
    }

    // Create a new page for each final-layout page
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Draw the final-layout page image centered on the PDF page
    for (const imageData of embeddedImages) {
      const { image, dims } = imageData;

      // Calculate scaling to fit the page with margins
      const margin = 20;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;

      const scaleX = availableWidth / dims.width;
      const scaleY = availableHeight / dims.height;
      const imageScale = Math.min(scaleX, scaleY);

      const scaledWidth = dims.width * imageScale;
      const scaledHeight = dims.height * imageScale;

      // Center the image on the page
      const x = (pageWidth - scaledWidth) / 2;
      const y = (pageHeight - scaledHeight) / 2;

      // Draw the final-layout page image
      page.drawImage(image, {
        x: x,
        y: y,
        width: scaledWidth,
        height: scaledHeight,
      });

      console.log(`Added final-layout page ${pageNumber} to PDF`);
    }
  }
}

/**
 * Downloads the PDF document
 */
async function downloadPdf(
  pdfDoc: PDFDocument,
  filename: string
): Promise<void> {
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
  // scale removed
  originalView: string,
  originalSelectedField: string | null,
  originalSelectedShape: string | null,
  originalEditMode: boolean
): void {
  // Scale removed - no need to restore
  setViewState((prev) => ({ ...prev, currentView: originalView }));
  setEditorState((prev) => ({
    ...prev,
    selectedFieldId: originalSelectedField,
    selectedShapeId: originalSelectedShape,
    isEditMode: originalEditMode,
  }));
}

// Helper functions for image export

/**
 * Gets the list of pages to export based on export settings
 */
function getPagesToExport(
  totalPages: number,
  deletedPages: Set<number>,
  exportSettings: {
    pageRange: "all" | "current" | "custom";
    customRange: string;
  }
): number[] {
  const pagesToExport: number[] = [];

  if (exportSettings.pageRange === "all") {
    // Export all non-deleted pages
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      if (!deletedPages.has(pageNumber)) {
        pagesToExport.push(pageNumber);
      }
    }
  } else if (exportSettings.pageRange === "current") {
    // Export current page only (assuming it's not deleted)
    const currentPage = 1; // This should be passed from the component
    if (!deletedPages.has(currentPage)) {
      pagesToExport.push(currentPage);
    }
  } else if (exportSettings.pageRange === "custom") {
    // Parse custom range (e.g., "1-3, 5, 7-9")
    const customPages = parseCustomPageRange(exportSettings.customRange);
    for (const pageNumber of customPages) {
      if (
        pageNumber >= 1 &&
        pageNumber <= totalPages &&
        !deletedPages.has(pageNumber)
      ) {
        pagesToExport.push(pageNumber);
      }
    }
  }

  return pagesToExport;
}

/**
 * Parses custom page range string (e.g., "1-3, 5, 7-9")
 */
function parseCustomPageRange(rangeString: string): number[] {
  const pages: number[] = [];
  const parts = rangeString.split(",").map((part) => part.trim());

  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((num) => parseInt(num.trim()));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
      }
    } else {
      const pageNum = parseInt(part);
      if (!isNaN(pageNum)) {
        pages.push(pageNum);
      }
    }
  }

  return pages;
}

/**
 * Captures a single page as images based on export settings
 */
async function capturePageAsImages(
  documentRef: React.RefObject<HTMLDivElement | null>,
  pageNumber: number,
  exportSettings: {
    includeOriginal: boolean;
    includeTranslated: boolean;
  },
  setViewState: (updater: (prev: any) => any) => void,
  setDocumentState: (updater: (prev: any) => any) => void,
  setEditorState: (updater: (prev: any) => any) => void,
  editorState: any
): Promise<
  Array<{ canvas: HTMLCanvasElement; filename: string; viewType: string }>
> {
  const images: Array<{
    canvas: HTMLCanvasElement;
    filename: string;
    viewType: string;
  }> = [];

  // Function to capture view as image for a specific page using DOM-to-image
  const captureViewAsImage = async (
    viewType: "original" | "translated",
    pageNumber: number
  ): Promise<HTMLCanvasElement> => {
    // Set view to the target type
    setViewState((prev) => ({ ...prev, currentView: viewType }));

    // Set page number
    setDocumentState((prev) => ({ ...prev, currentPage: pageNumber }));

    // Temporarily disable text rendering for export
    const originalAddTextBoxMode = editorState.isAddTextBoxMode;
    setEditorState((prev) => ({ ...prev, isAddTextBoxMode: false }));

    // Wait for view and page to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Use the entire document ref
    const documentContainer = documentRef.current;

    if (!documentContainer) {
      throw new Error(
        `Document container not found for ${viewType} view page ${pageNumber}`
      );
    }

    try {
      // Use DOM-to-image to capture the element
      const dataUrl = await domtoimage.toPng(documentContainer, {
        quality: 1.0,
        bgcolor: "#ffffff",
        width: documentContainer.offsetWidth,
        height: documentContainer.offsetHeight,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
        filter: (node: Node): boolean => {
          // Filter out unwanted elements
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            // Skip interactive UI elements
            if (
              element.classList.contains("drag-handle") ||
              element.tagName === "BUTTON" ||
              element.classList.contains("settings-popup") ||
              element.classList.contains("text-selection-popup") ||
              element.classList.contains("shape-dropdown") ||
              element.classList.contains("field-status-dropdown") ||
              element.classList.contains("fixed") ||
              element.closest(".fixed") !== null ||
              element.classList.contains("react-resizable-handle") ||
              element.classList.contains("resizable-handle")
            ) {
              return false;
            }
          }
          return true;
        },
      });

      // Convert data URL to canvas for consistency with the rest of the code
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      return new Promise<HTMLCanvasElement>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          resolve(canvas);
        };

        img.onerror = reject;
        img.src = dataUrl;
      });
    } catch (error) {
      console.error(
        `Error capturing ${viewType} view for page ${pageNumber}:`,
        error
      );
      // Fallback: create an error canvas
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
          "Error capturing page",
          canvas.width / 2,
          canvas.height / 2
        );
      }
      return canvas;
    } finally {
      // Restore original text rendering state
      setEditorState((prev) => ({
        ...prev,
        isAddTextBoxMode: originalAddTextBoxMode,
      }));
    }
  };

  // Capture original view if requested
  if (exportSettings.includeOriginal) {
    try {
      const canvas = await captureViewAsImage("original", pageNumber);
      images.push({
        canvas,
        filename: `page-${pageNumber}-original`,
        viewType: "original",
      });
    } catch (error) {
      console.error(
        `Error capturing original view for page ${pageNumber}:`,
        error
      );
    }
  }

  // Capture translated view if requested
  if (exportSettings.includeTranslated) {
    try {
      const canvas = await captureViewAsImage("translated", pageNumber);
      images.push({
        canvas,
        filename: `page-${pageNumber}-translated`,
        viewType: "translated",
      });
    } catch (error) {
      console.error(
        `Error capturing translated view for page ${pageNumber}:`,
        error
      );
    }
  }

  return images;
}

/**
 * Downloads multiple images as files
 */
async function downloadImages(
  images: Array<{
    canvas: HTMLCanvasElement;
    filename: string;
    viewType: string;
  }>,
  format: "png" | "jpeg"
): Promise<void> {
  const mimeType = format === "png" ? "image/png" : "image/jpeg";
  const fileExtension = format === "png" ? "png" : "jpg";

  for (const image of images) {
    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        image.canvas.toBlob(
          (blob) => {
            resolve(blob!);
          },
          mimeType,
          0.9
        ); // 0.9 quality for JPEG
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${image.filename}.${fileExtension}`;
      link.click();

      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error downloading image ${image.filename}:`, error);
    }
  }
}

/**
 * Downloads multiple images as a zip file
 */
export async function downloadImagesAsZip(
  images: Array<{
    canvas: HTMLCanvasElement;
    filename: string;
    viewType: string;
  }>,
  format: "png" | "jpeg",
  zipFilename = "exported-images.zip"
): Promise<void> {
  const mimeType = format === "png" ? "image/png" : "image/jpeg";
  const fileExtension = format === "png" ? "png" : "jpg";
  const zip = new JSZip();

  for (const image of images) {
    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        image.canvas.toBlob(
          (blob) => {
            resolve(blob!);
          },
          mimeType,
          0.9
        );
      });
      zip.file(`${image.filename}.${fileExtension}`, blob);
    } catch (error) {
      console.error(`Error zipping image ${image.filename}:`, error);
    }
  }

  // Generate the zip and trigger download
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipFilename;
  link.click();
  URL.revokeObjectURL(url);
}

// Service function for exporting to PDF
export async function exportToPDFService({
  documentRef,
  documentState,
  editorState,
  viewState,
  setDocumentState,
  setViewState,
  setEditorState,
}: {
  documentRef: React.RefObject<HTMLDivElement | null>;
  documentState: any;
  editorState: any;
  viewState: any;
  setDocumentState: (updater: (prev: any) => any) => void;
  setViewState: (updater: (prev: any) => any) => void;
  setEditorState: (updater: (prev: any) => any) => void;
}) {
  if (!documentRef.current) {
    toast.error("Document not loaded");
    return;
  }

  // Scale removed - always 1
  const originalView = viewState.currentView;
  const originalCurrentPage = documentState.currentPage;
  const originalSelectedField = editorState.selectedFieldId;
  const originalSelectedShape = editorState.selectedShapeId;
  const originalEditMode = editorState.isEditMode;

  const loadingToast = toast.loading("Generating PDF from final layout...");

  try {
    // Set up for export - hide UI elements
    setEditorState((prev: any) => ({
      ...prev,
      selectedFieldId: null,
      selectedShapeId: null,
      isEditMode: false,
      isTextSelectionMode: false,
      isAddTextBoxMode: false,
      isSelectionMode: false,
    }));

    // Switch to final-layout view
    setViewState((prev: any) => ({ ...prev, currentView: "final-layout" }));

    // Wait for view to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create PDF document
    const pdfDoc = await PDFDocument.create();

    // Get all non-deleted pages from final layout
    const totalPages =
      documentState.finalLayoutNumPages || documentState.numPages;
    const deletedPages =
      documentState.finalLayoutDeletedPages || documentState.deletedPages;
    const nonDeletedPages = [] as number[];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      if (!deletedPages.has(pageNumber)) {
        nonDeletedPages.push(pageNumber);
      }
    }

    if (nonDeletedPages.length === 0) {
      toast.error(
        "No pages available for export. All pages have been deleted."
      );
      return;
    }

    // Temporarily disable text rendering for export
    setEditorState((prev: any) => ({ ...prev, isAddTextBoxMode: false }));

    // Wait for editor state to update
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Capture each page in final-layout view
    for (const pageNumber of nonDeletedPages) {
      // Set final layout page number (use finalLayoutCurrentPage for final layout navigation)
      setDocumentState((prev: any) => ({
        ...prev,
        finalLayoutCurrentPage: pageNumber,
        currentPage: pageNumber, // Also update currentPage for compatibility
      }));

      // Force a re-render by updating the page loading state
      setDocumentState((prev: any) => ({
        ...prev,
        isPageLoading: true,
      }));

      // Wait for page to update
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Wait for page loading to complete
      let attempts = 0;
      while (documentState.isPageLoading && attempts < 10) {
        console.log(
          `Waiting for page ${pageNumber} to finish loading... (attempt ${
            attempts + 1
          })`
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
        attempts++;
      }

      const documentContainer = documentRef.current;
      if (!documentContainer) {
        console.warn(`Document container not found for page ${pageNumber}`);
        continue;
      }
      try {
        // Use DOM-to-image to capture the final-layout view
        const dataUrl = await domtoimage.toPng(documentContainer, {
          quality: 1.0,
          bgcolor: "#ffffff",
          width: documentContainer.offsetWidth,
          height: documentContainer.offsetHeight,
          style: {
            transform: "scale(1)",
            transformOrigin: "top left",
          },
          filter: (node: Node): boolean => {
            // Filter out unwanted elements
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;

              // Skip interactive UI elements
              if (
                element.classList.contains("drag-handle") ||
                element.tagName === "BUTTON" ||
                element.classList.contains("settings-popup") ||
                element.classList.contains("text-selection-popup") ||
                element.classList.contains("shape-dropdown") ||
                element.classList.contains("field-status-dropdown") ||
                element.classList.contains("fixed") ||
                element.closest(".fixed") !== null ||
                element.classList.contains("react-resizable-handle") ||
                element.classList.contains("resizable-handle")
              ) {
                return false;
              }
            }
            return true;
          },
        });

        // Convert data URL to image and embed in PDF
        const imageBytes = await fetch(dataUrl).then((res) =>
          res.arrayBuffer()
        );
        const embeddedImage = await pdfDoc.embedPng(imageBytes);

        // Create a new page for this final-layout page
        const page = pdfDoc.addPage([612, 792]); // Letter size
        const { width: pageWidth, height: pageHeight } = page.getSize();

        // Calculate image scaling to fit the page
        const imageDims = embeddedImage.scale(1);
        const scaleX = pageWidth / imageDims.width;
        const scaleY = pageHeight / imageDims.height;
        const imageScale = Math.min(scaleX, scaleY);

        // Calculate centered position
        const scaledWidth = imageDims.width * imageScale;
        const scaledHeight = imageDims.height * imageScale;
        const x = (pageWidth - scaledWidth) / 2;
        const y = (pageHeight - scaledHeight) / 2;

        // Draw the final-layout page image
        page.drawImage(embeddedImage, {
          x: x,
          y: y,
          width: scaledWidth,
          height: scaledHeight,
        });

        console.log(`Successfully captured final-layout page ${pageNumber}`);
      } catch (pageError) {
        console.error(
          `Error capturing final-layout page ${pageNumber}:`,
          pageError
        );
        continue;
      }
    }

    // Save and download the PDF
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "final-layout-export.pdf";
    link.click();
    URL.revokeObjectURL(url);

    toast.dismiss(loadingToast);
    toast.success("Final layout PDF exported successfully!");
  } catch (error) {
    console.error("Error exporting final layout PDF:", error);
    toast.dismiss(loadingToast);
    toast.error("Failed to export final layout PDF");
  } finally {
    // Restore original state
    setDocumentState((prev: any) => ({
      ...prev,
      // scale removed
      currentPage: originalCurrentPage,
    }));
    setViewState((prev: any) => ({ ...prev, currentView: originalView }));
    setEditorState((prev: any) => ({
      ...prev,
      selectedFieldId: originalSelectedField,
      selectedShapeId: originalSelectedShape,
      isEditMode: originalEditMode,
      isAddTextBoxMode: editorState.isAddTextBoxMode,
    }));
  }
}

// Service function for exporting to PNG
export async function exportToPNGService({
  documentRef,
  documentState,
  editorState,
  viewState,
  setDocumentState,
  setViewState,
  setEditorState,
}: {
  documentRef: React.RefObject<HTMLDivElement | null>;
  documentState: any;
  editorState: any;
  viewState: any;
  setDocumentState: (updater: (prev: any) => any) => void;
  setViewState: (updater: (prev: any) => any) => void;
  setEditorState: (updater: (prev: any) => any) => void;
}) {
  if (!documentRef.current) {
    toast.error("Document not loaded");
    return;
  }
  // Scale removed - always 1
  const originalView = viewState.currentView;
  const originalSelectedField = editorState.selectedFieldId;
  const originalSelectedShape = editorState.selectedShapeId;
  const originalEditMode = editorState.isEditMode;
  const loadingToast = toast.loading(
    "Generating PNG images from final layout..."
  );
  try {
    setEditorState((prev: any) => ({
      ...prev,
      selectedFieldId: null,
      selectedShapeId: null,
      isEditMode: false,
      isTextSelectionMode: false,
      isAddTextBoxMode: false,
      isSelectionMode: false,
    }));

    // Switch to final-layout view
    setViewState((prev: any) => ({ ...prev, currentView: "final-layout" }));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get all non-deleted pages from final layout
    const totalPages =
      documentState.finalLayoutNumPages || documentState.numPages;
    const deletedPages =
      documentState.finalLayoutDeletedPages || documentState.deletedPages;
    const nonDeletedPages = [] as number[];
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      if (!deletedPages.has(pageNumber)) {
        nonDeletedPages.push(pageNumber);
      }
    }
    if (nonDeletedPages.length === 0) {
      toast.error("No final layout pages available for export");
      return;
    }

    setEditorState((prev: any) => ({ ...prev, isAddTextBoxMode: false }));
    await new Promise((resolve) => setTimeout(resolve, 500));
    const images = [] as Array<{
      canvas: HTMLCanvasElement;
      filename: string;
      viewType: string;
    }>;
    console.log(
      `Starting capture of ${nonDeletedPages.length} final layout pages for PNG export:`,
      nonDeletedPages
    );

    for (const pageNumber of nonDeletedPages) {
      console.log(`Capturing final-layout page ${pageNumber} for PNG export`);

      // Set final layout page number
      setDocumentState((prev: any) => ({
        ...prev,
        finalLayoutCurrentPage: pageNumber,
        currentPage: pageNumber,
        isPageLoading: true,
      }));

      // Wait for page to update
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Wait for page loading to complete
      let attempts = 0;
      while (documentState.isPageLoading && attempts < 10) {
        console.log(
          `Waiting for page ${pageNumber} to finish loading for PNG export... (attempt ${
            attempts + 1
          })`
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
        attempts++;
      }

      const documentContainer = documentRef.current;
      if (!documentContainer) {
        console.warn(`Document container not found for page ${pageNumber}`);
        continue;
      }
      try {
        const dataUrl = await domtoimage.toPng(documentContainer, {
          quality: 1.0,
          bgcolor: "#ffffff",
          width: documentContainer.offsetWidth,
          height: documentContainer.offsetHeight,
          style: {
            transform: "scale(1)",
            transformOrigin: "top left",
          },
          filter: (node: Node): boolean => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (
                element.classList.contains("drag-handle") ||
                element.tagName === "BUTTON" ||
                element.classList.contains("settings-popup") ||
                element.classList.contains("text-selection-popup") ||
                element.classList.contains("shape-dropdown") ||
                element.classList.contains("field-status-dropdown") ||
                element.classList.contains("fixed") ||
                element.closest(".fixed") !== null ||
                element.classList.contains("react-resizable-handle") ||
                element.classList.contains("resizable-handle")
              ) {
                return false;
              }
            }
            return true;
          },
        });
        const img = new window.Image();
        img.src = dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve as any;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        images.push({
          canvas,
          filename: `final-layout-page-${pageNumber}`,
          viewType: "final-layout",
        });
      } catch (pageError) {
        console.error(
          `Error capturing final-layout page ${pageNumber}:`,
          pageError
        );
        continue;
      }
    }
    await downloadImagesAsZip(images, "png", "final-layout-export.zip");
    toast.dismiss(loadingToast);
    toast.success(`${images.length} final layout PNG images exported as ZIP!`);
  } catch (error) {
    console.error("Error exporting final layout PNG images:", error);
    toast.dismiss(loadingToast);
    toast.error("Failed to export final layout PNG images");
  } finally {
    setDocumentState((prev: any) => ({
      ...prev,
      // scale removed
      currentPage: documentState.currentPage,
    }));
    setViewState((prev: any) => ({ ...prev, currentView: originalView }));
    setEditorState((prev: any) => ({
      ...prev,
      selectedFieldId: originalSelectedField,
      selectedShapeId: originalSelectedShape,
      isEditMode: originalEditMode,
      isAddTextBoxMode: editorState.isAddTextBoxMode,
    }));
  }
}

// Service function for exporting to JPEG
export async function exportToJPEGService({
  documentRef,
  documentState,
  editorState,
  viewState,
  setDocumentState,
  setViewState,
  setEditorState,
}: {
  documentRef: React.RefObject<HTMLDivElement | null>;
  documentState: any;
  editorState: any;
  viewState: any;
  setDocumentState: (updater: (prev: any) => any) => void;
  setViewState: (updater: (prev: any) => any) => void;
  setEditorState: (updater: (prev: any) => any) => void;
}) {
  if (!documentRef.current) {
    toast.error("Document not loaded");
    return;
  }
  // Scale removed - always 1
  const originalView = viewState.currentView;
  const originalSelectedField = editorState.selectedFieldId;
  const originalSelectedShape = editorState.selectedShapeId;
  const originalEditMode = editorState.isEditMode;
  const loadingToast = toast.loading(
    "Generating JPEG images from final layout..."
  );
  try {
    setEditorState((prev: any) => ({
      ...prev,
      selectedFieldId: null,
      selectedShapeId: null,
      isEditMode: false,
      isTextSelectionMode: false,
      isAddTextBoxMode: false,
      isSelectionMode: false,
    }));

    // Switch to final-layout view
    setViewState((prev: any) => ({ ...prev, currentView: "final-layout" }));
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get all non-deleted pages from final layout
    const totalPages =
      documentState.finalLayoutNumPages || documentState.numPages;
    const deletedPages =
      documentState.finalLayoutDeletedPages || documentState.deletedPages;
    const nonDeletedPages = [] as number[];
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      if (!deletedPages.has(pageNumber)) {
        nonDeletedPages.push(pageNumber);
      }
    }
    if (nonDeletedPages.length === 0) {
      toast.error("No final layout pages available for export");
      return;
    }

    setEditorState((prev: any) => ({ ...prev, isAddTextBoxMode: false }));
    await new Promise((resolve) => setTimeout(resolve, 500));
    const images = [] as Array<{
      canvas: HTMLCanvasElement;
      filename: string;
      viewType: string;
    }>;
    console.log(
      `Starting capture of ${nonDeletedPages.length} final layout pages for JPEG export:`,
      nonDeletedPages
    );

    for (const pageNumber of nonDeletedPages) {
      console.log(`Capturing final-layout page ${pageNumber} for JPEG export`);

      // Set final layout page number
      setDocumentState((prev: any) => ({
        ...prev,
        finalLayoutCurrentPage: pageNumber,
        currentPage: pageNumber,
        isPageLoading: true,
      }));

      // Wait for page to update
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Wait for page loading to complete
      let attempts = 0;
      while (documentState.isPageLoading && attempts < 10) {
        console.log(
          `Waiting for page ${pageNumber} to finish loading for JPEG export... (attempt ${
            attempts + 1
          })`
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
        attempts++;
      }

      const documentContainer = documentRef.current;
      if (!documentContainer) {
        console.warn(`Document container not found for page ${pageNumber}`);
        continue;
      }
      try {
        const dataUrl = await domtoimage.toJpeg(documentContainer, {
          quality: 0.9,
          bgcolor: "#ffffff",
          width: documentContainer.offsetWidth,
          height: documentContainer.offsetHeight,
          style: {
            transform: "scale(1)",
            transformOrigin: "top left",
          },
          filter: (node: Node): boolean => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (
                element.classList.contains("drag-handle") ||
                element.tagName === "BUTTON" ||
                element.classList.contains("settings-popup") ||
                element.classList.contains("text-selection-popup") ||
                element.classList.contains("shape-dropdown") ||
                element.classList.contains("field-status-dropdown") ||
                element.classList.contains("fixed") ||
                element.closest(".fixed") !== null ||
                element.classList.contains("react-resizable-handle") ||
                element.classList.contains("resizable-handle")
              ) {
                return false;
              }
            }
            return true;
          },
        });
        const img = new window.Image();
        img.src = dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve as any;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        images.push({
          canvas,
          filename: `final-layout-page-${pageNumber}`,
          viewType: "final-layout",
        });
      } catch (pageError) {
        console.error(
          `Error capturing final-layout page ${pageNumber}:`,
          pageError
        );
        continue;
      }
    }
    await downloadImagesAsZip(images, "jpeg", "final-layout-export-jpeg.zip");
    toast.dismiss(loadingToast);
    toast.success(`${images.length} final layout JPEG images exported as ZIP!`);
  } catch (error) {
    console.error("Error exporting final layout JPEG images:", error);
    toast.dismiss(loadingToast);
    toast.error("Failed to export final layout JPEG images");
  } finally {
    setDocumentState((prev: any) => ({
      ...prev,
      // scale removed
      currentPage: documentState.currentPage,
    }));
    setViewState((prev: any) => ({ ...prev, currentView: originalView }));
    setEditorState((prev: any) => ({
      ...prev,
      selectedFieldId: originalSelectedField,
      selectedShapeId: originalSelectedShape,
      isEditMode: originalEditMode,
      isAddTextBoxMode: editorState.isAddTextBoxMode,
    }));
  }
}
