import { toast } from "sonner";
import { generateUUID, measureText } from "../utils/measurements";
import { TextField, UntranslatedText } from "../types/pdf-editor.types";
import domtoimage from "dom-to-image";

// Types for OCR processing
export interface OcrOptions {
  pageNumber: number;
  documentRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  documentState: {
    scale: number;
    pageWidth: number;
    pageHeight: number;
  };
  editorState: {
    isAddTextBoxMode: boolean;
  };
  viewState: {
    currentView: string;
  };
  actions: {
    updateScale: (scale: number) => void;
  };
  setEditorState: (updater: (prev: any) => any) => void;
  setViewState: (updater: (prev: any) => any) => void;
  setPageState: (updater: (prev: any) => any) => void;
  sourceLanguage?: string;
  desiredLanguage?: string;
  handleAddTextBoxWithUndo: (
    x: number,
    y: number,
    page: number,
    view: any,
    targetView?: "original" | "translated",
    initialProperties?: any
  ) => string | null;
  setIsTranslating: (isTranslating: boolean) => void;
  addUntranslatedText?: (untranslatedText: any) => void;
}

export interface OcrResult {
  textBoxes: TextField[];
  success: boolean;
  message?: string;
}

export interface BulkOcrOptions extends Omit<OcrOptions, 'pageNumber'> {
  totalPages: number;
  deletedPages: Set<number>;
  currentPage: number;
  onProgress?: (current: number, total: number) => void;
  onPageChange: (page: number) => void;
  cancelRef: React.MutableRefObject<{ cancelled: boolean }>;
}

/**
 * Performs OCR on a single page of a PDF document
 */
export async function performPageOcr(options: OcrOptions): Promise<OcrResult> {
  const {
    pageNumber,
    documentRef,
    containerRef,
    documentState,
    editorState,
    viewState,
    actions,
    setEditorState,
    setViewState,
    setPageState,
    sourceLanguage,
    desiredLanguage,
    setIsTranslating
  } = options;

  const previousView = viewState.currentView;

  try {
    // Set transforming state
    setPageState((prev) => ({
      ...prev,
      isTransforming: true,
    }));

    // Switch to original view
    setViewState((prev) => ({ ...prev, currentView: "original" }));

    // Wait for the view change to apply and document to render
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get the document element after view change
    const documentElement = documentRef.current;
    if (!documentElement) {
      throw new Error("Document element not found");
    }

    // Get the PDF page element
    const pdfPage = documentElement.querySelector(
      ".react-pdf__Page"
    ) as HTMLElement;
    if (!pdfPage) {
      throw new Error("PDF page element not found");
    }

    // Calculate PDF offset in container
    if (!containerRef.current) {
      throw new Error("Container element not found");
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const pdfRect = pdfPage.getBoundingClientRect();
    const offsetLeft = pdfRect.left - containerRect.left;
    const centerOffsetX = (containerRect.width - pdfRect.width) / 2 + 30;
    const offsetTop = pdfRect.top - containerRect.top + 20;

    // Temporarily set scale to 500% for better OCR
    const originalScale = documentState.scale;
    const captureScale = 5;

    // Save original state
    const wasAddTextBoxMode = editorState.isAddTextBoxMode;
    setEditorState((prev) => ({ ...prev, isAddTextBoxMode: false }));

    // Set the scale
    actions.updateScale(captureScale);

    // Wait for the scale change to apply
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Capture the PDF page as an image using dom-to-image
    const containerEl = documentRef.current;
    if (!containerEl) throw new Error("Document container not found");
    
    // Use DOM-to-image to capture the element
    const dataUrl = await domtoimage.toPng(containerEl, {
      quality: 1.0,
      bgcolor: "#ffffff",
      width: containerEl.offsetWidth,
      height: containerEl.offsetHeight,
      filter: (node: Node): boolean => {
        // Filter out unwanted elements
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          
          // Skip interactive UI elements
          return !(
            element.classList.contains("text-format-drawer") ||
            element.classList.contains("element-format-drawer") ||
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
          );
        }
        return true;
      }
    });

    // Convert data URL to canvas for blob conversion
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        resolve();
      };
      
      img.onerror = reject;
      img.src = dataUrl;
    });

    // Reset scale
    actions.updateScale(originalScale);
    setEditorState((prev) => ({
      ...prev,
      isAddTextBoxMode: wasAddTextBoxMode,
    }));

    // Switch back to the previous view (tab) after snapshot
    setViewState((prev) => ({ ...prev, currentView: previousView }));

    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob: Blob | null) => {
        if (blob) resolve(blob);
      }, "image/png");
    });

    // Create FormData and send to API
    const formData = new FormData();
    formData.append("file", blob, `page-${pageNumber}.png`);
    formData.append("page_number", "1");

    // Send frontend document dimensions to backend for accurate coordinate calculations
    formData.append(
      "frontend_page_width",
      documentState.pageWidth.toString()
    );
    formData.append(
      "frontend_page_height",
      documentState.pageHeight.toString()
    );
    formData.append("frontend_scale", documentState.scale.toString());

    // Call the OCR API using our centralized API
    const { processFile } = await import("@/lib/api");

    let data;
    try {
      data = await processFile(formData);
    } catch (error: any) {
      console.error("=== OCR API ERROR ===");
      console.error("Error object:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response statusText:", error.response.statusText);
        console.error("Response headers:", error.response.headers);
        console.error("Response data:", error.response.data);

        if (error.response.data) {
          console.error("Response data:", error.response.data);
          if (error.response.data.detail) {
            console.error("Error detail:", error.response.data.detail);
          }
        }
      }

      if (error.request) {
        console.error("Request details:", error.request);
      }

      throw error;
    }

    // Extract entities from the response (handle both old and new API formats)
    let entities: any[] = [];

    if (
      data.styled_layout &&
      data.styled_layout.pages &&
      data.styled_layout.pages.length > 0
    ) {
      // New API format
      entities = data.styled_layout.pages[0].entities || [];
    } else if (
      data.layout &&
      data.layout.pages &&
      data.layout.pages.length > 0
    ) {
      // Old API format
      entities = data.layout.pages[0].entities || [];
    }

    console.log("Returned entities from OCR API:", entities);

    if (entities.length > 0) {
      // Convert entities to textboxes
      const newTextBoxes = await convertEntitiesToTextBoxes(
        entities,
        pageNumber,
        documentState.pageWidth,
        documentState.pageHeight
      );

      // Translate all textboxes if languages are set
      if (
        sourceLanguage &&
        desiredLanguage &&
        sourceLanguage !== desiredLanguage
      ) {
        await translateTextBoxes(newTextBoxes, sourceLanguage, desiredLanguage, setIsTranslating);
      }

      // Add all textboxes to the translated view using the undo system
      newTextBoxes.forEach((textbox, index) => {
        // Store original text before adding the textbox
        const originalText = entities[index]?.text || "";
        
        const textboxId = options.handleAddTextBoxWithUndo(
          textbox.x,
          textbox.y,
          textbox.page,
          "translated",
          "translated",
          {
            value: textbox.value,
            fontSize: textbox.fontSize,
            fontFamily: textbox.fontFamily,
            color: textbox.color,
            bold: textbox.bold,
            italic: textbox.italic,
            underline: textbox.underline,
            textAlign: textbox.textAlign,
            letterSpacing: textbox.letterSpacing,
            lineHeight: textbox.lineHeight,
            width: textbox.width,
            height: textbox.height,
            borderColor: textbox.borderColor,
            borderWidth: textbox.borderWidth,
            backgroundColor: textbox.backgroundColor,
            backgroundOpacity: textbox.backgroundOpacity,
            borderRadius: textbox.borderRadius,
            borderTopLeftRadius: textbox.borderTopLeftRadius,
            borderTopRightRadius: textbox.borderTopRightRadius,
            borderBottomLeftRadius: textbox.borderBottomLeftRadius,
            borderBottomRightRadius: textbox.borderBottomRightRadius,
            paddingTop: textbox.paddingTop,
            paddingRight: textbox.paddingRight,
            paddingBottom: textbox.paddingBottom,
            paddingLeft: textbox.paddingLeft,
          }
        );

        // Create untranslated text entry if textbox was created successfully and function is available
        if (textboxId && originalText && options.addUntranslatedText) {
          const untranslatedText: UntranslatedText = {
            id: generateUUID(),
            translatedTextboxId: textboxId,
            originalText: originalText,
            page: pageNumber,
            x: textbox.x,
            y: textbox.y,
            width: textbox.width,
            height: textbox.height,
            isCustomTextbox: false,
            status: originalText.trim() === "" ? "isEmpty" : "needsChecking",
          };
          options.addUntranslatedText(untranslatedText);
        }
      });

      // Mark the page as transformed
      setPageState((prev) => ({
        ...prev,
        isPageTranslated: new Map(
          prev.isPageTranslated.set(pageNumber, true)
        ),
        isTransforming: false,
      }));

      const translationMessage =
        sourceLanguage &&
        desiredLanguage &&
        sourceLanguage !== desiredLanguage
          ? `Transformed and translated ${newTextBoxes.length} entities into textboxes`
          : `Transformed ${newTextBoxes.length} entities into textboxes`;

      // Switch back to the previous view
      setViewState((prev) => ({ ...prev, currentView: previousView }));

      return {
        textBoxes: newTextBoxes,
        success: true,
        message: translationMessage
      };
    } else {
      // Reset transforming state when no entities are found
      setPageState((prev) => ({
        ...prev,
        isTransforming: false,
      }));

      // Switch back to the previous view
      setViewState((prev) => ({ ...prev, currentView: previousView }));

      return {
        textBoxes: [],
        success: false,
        message: "No text entities found in the document"
      };
    }
  } catch (error) {
    console.error("Error transforming page to textboxes:", error);

    // Reset transforming state on error
    setPageState((prev) => ({
      ...prev,
      isTransforming: false,
    }));

    // Reset view if error occurred
    setViewState((prev) => ({ ...prev, currentView: previousView }));

    return {
      textBoxes: [],
      success: false,
      message: "Failed to transform page to textboxes"
    };
  }
}

/**
 * Performs OCR on all pages in a document
 */
export async function performBulkOcr(options: BulkOcrOptions): Promise<{
  success: boolean;
  processedPages: number;
  totalPages: number;
  message?: string;
}> {
  const {
    deletedPages,
    totalPages,
    currentPage,
    onProgress,
    onPageChange,
    cancelRef,
    ...ocrOptions
  } = options;

  // Build a list of non-deleted pages
  const pagesToProcess = Array.from(
    { length: totalPages },
    (_, i) => i + 1
  ).filter((page) => !deletedPages.has(page));

  // Store the current page to restore later
  const originalPage = currentPage;
  let processedCount = 0;

  try {
    for (let i = 0; i < pagesToProcess.length; i++) {
      if (cancelRef.current.cancelled) break;
      
      const page = pagesToProcess[i];

      // Switch to the page
      onPageChange(page);

      // Wait for the page to render
      await new Promise((resolve) => {
        setTimeout(resolve, 1000); // Simple delay to ensure page is rendered
      });

      // Run OCR for this page
      try {
        const result = await performPageOcr({
          ...ocrOptions,
          pageNumber: page
        });
        
        if (result.success) {
          processedCount++;
        }
      } catch (e) {
        console.error(`Error processing page ${page}:`, e);
        // Continue with next page
      }

      // Update progress
      onProgress?.(i + 1, pagesToProcess.length);
    }

    // Restore the original page only after all processing is done or cancelled
    onPageChange(originalPage);

    return {
      success: true,
      processedPages: processedCount,
      totalPages: pagesToProcess.length,
      message: `Successfully processed ${processedCount} out of ${pagesToProcess.length} pages`
    };

  } catch (error) {
    console.error("Bulk OCR error:", error);
    onPageChange(originalPage);
    
    return {
      success: false,
      processedPages: processedCount,
      totalPages: pagesToProcess.length,
      message: "Bulk OCR process failed"
    };
  }
}

/**
 * Converts OCR entities to TextField objects
 */
export async function convertEntitiesToTextBoxes(
  entities: any[],
  pageNumber: number,
  pdfPageWidth: number,
  pdfPageHeight: number
): Promise<TextField[]> {
  const newTextBoxes: TextField[] = [];

  entities.forEach((entity: any) => {
    if (
      !entity.bounding_poly ||
      !entity.bounding_poly.vertices ||
      entity.bounding_poly.vertices.length < 4
    ) {
      return;
    }

    // Use the styled entity dimensions if available, otherwise calculate from vertices
    let x, y, width, height;

    x = entity.dimensions.box_x;
    width = entity.dimensions.box_width;
    height = entity.dimensions.box_height;
    y = entity.dimensions.box_y;

    // Extract styling information from styled entity
    const styling = entity.styling || entity.style || {};
    const colors = styling.colors || {};

    // Helper function to get style values
    const getStyleValue = (key: string, fallback: any = null) => {
      return styling[key] !== undefined ? styling[key] : fallback;
    };

    // Convert RGB/RGBA colors to hex
    const rgbToHex = (
      rgb:
        | {
            r: number;
            g: number;
            b: number;
            a?: number;
          }
        | number[]
    ): string => {
      if (!rgb) return "#000000";

      let r: number, g: number, b: number, a: number = 1;

      if (Array.isArray(rgb)) {
        r = Math.round(rgb[0] * 255);
        g = Math.round(rgb[1] * 255);
        b = Math.round(rgb[2] * 255);
        a = rgb[3] !== undefined ? rgb[3] : 1;
      } else {
        r = Math.round(rgb.r * 255);
        g = Math.round(rgb.g * 255);
        b = Math.round(rgb.b * 255);
        a = rgb.a !== undefined ? rgb.a : 1;
      }

      if (a < 0.1) {
        return "transparent";
      }

      return `#${r.toString(16).padStart(2, "0")}${g
        .toString(16)
        .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    };

    // Extract colors and styling
    let backgroundColor = "transparent";
    let backgroundOpacity = 1;
    if (colors.background_color) {
      const color = colors.background_color;
      backgroundColor = rgbToHex(color);
      if (Array.isArray(color)) {
        backgroundOpacity = color[3] !== undefined ? color[3] : 1;
      } else if (typeof color === "object" && "a" in color) {
        backgroundOpacity = color.a !== undefined ? color.a : 1;
      }
    }

    let borderColor = "#000000";
    let borderWidth = 0;
    if (colors.border_color) {
      borderColor = rgbToHex(colors.border_color);
      borderWidth = 1;
    }

    const textColor =
      colors.fill_color || colors.text_color
        ? rgbToHex(colors.fill_color || colors.text_color)
        : "#000000";
    const borderRadius =
      styling.background?.border_radius ||
      getStyleValue("border_radius", 0);
    const textPadding =
      styling.text_padding || getStyleValue("text_padding", 0);
    const fontWeight =
      getStyleValue("font_family", "") === "Helvetica-Bold" ||
      getStyleValue("font_weight") === "bold";
    const textAlign = getStyleValue(
      "text_alignment",
      getStyleValue("alignment", "left")
    );

    // Calculate text dimensions if needed
    const estimatedFontSize = getStyleValue("font_size", 12);
    const textLines = getStyleValue(
      "text_lines",
      (entity.text || "").split("\n")
    );

    // Find the longest line
    let longestLine = "";
    for (const line of textLines) {
      if (line.length > longestLine.length) {
        longestLine = line;
      }
    }

    // Calculate text dimensions using measureText function
    const { width: textWidth, height: textHeight } = measureText(
      longestLine,
      estimatedFontSize,
      styling.font_family || "Arial, sans-serif",
      0,
      undefined,
      {
        top: textPadding,
        right: textPadding,
        bottom: textPadding,
        left: textPadding,
      }
    );

    // Use styled entity dimensions if available, otherwise calculate from vertices
    if (!entity.dimensions) {
      // Fallback: calculate from bounding_poly vertices
      const vertices = entity.bounding_poly.vertices;

      const minX =
        Math.min(...vertices.map((v: any) => v.x)) * pdfPageWidth;
      const maxX =
        Math.max(...vertices.map((v: any) => v.x)) * pdfPageWidth;
      const minY =
        Math.min(...vertices.map((v: any) => v.y)) * pdfPageHeight;
      const maxY =
        Math.max(...vertices.map((v: any) => v.y)) * pdfPageHeight;

      x = minX;
      y = pdfPageHeight - maxY;
      width = maxX - minX;
      height = maxY - minY;
    }

    // Add text_padding if present
    width += textPadding * 2;
    height += textPadding * 2;

    const newTextBox: TextField = {
      id: generateUUID(),
      x: x,
      y: y,
      width: width,
      height: height,
      value: entity.text || "",
      fontSize: getStyleValue("font_size", 12),
      fontFamily: getStyleValue("font_family", "Arial, sans-serif"),
      page: pageNumber,
      color: textColor || "#000000",
      bold: !!(getStyleValue("bold", false) || fontWeight),
      italic: !!getStyleValue("italic", false),
      underline: !!getStyleValue("underline", false),
      textAlign: textAlign as "left" | "center" | "right" | "justify",
      listType: "none",
      letterSpacing: getStyleValue("letter_spacing", 0),
      lineHeight: getStyleValue("line_spacing", 1.2),
      rotation: 0,
      backgroundColor: backgroundColor,
      backgroundOpacity: backgroundOpacity,
      borderColor: borderColor,
      borderWidth: borderWidth,
      borderRadius: borderRadius || 0,
      borderTopLeftRadius: getStyleValue(
        "border_top_left_radius",
        borderRadius || 0
      ),
      borderTopRightRadius: getStyleValue(
        "border_top_right_radius",
        borderRadius || 0
      ),
      borderBottomLeftRadius: getStyleValue(
        "border_bottom_left_radius",
        borderRadius || 0
      ),
      borderBottomRightRadius: getStyleValue(
        "border_bottom_right_radius",
        borderRadius || 0
      ),
      paddingTop: textPadding || 0,
      paddingRight: textPadding || 0,
      paddingBottom: textPadding || 0,
      paddingLeft: textPadding || 0,
      isEditing: false,
    };

    newTextBoxes.push(newTextBox);
  });

  return newTextBoxes;
}

/**
 * Translates text boxes using the translation service
 */
export async function translateTextBoxes(
  textBoxes: TextField[],
  sourceLanguage: string,
  desiredLanguage: string,
  setIsTranslating: (isTranslating: boolean) => void
): Promise<void> {
  try {
    console.log("Starting translation of textboxes...");
    setIsTranslating(true);

    const { getTranslationService } = await import(
      "@/lib/api/translationService"
    );
    const translationService = getTranslationService();

    // Collect all texts to translate
    const textsToTranslate = textBoxes
      .map((textbox) => textbox.value)
      .filter((text) => text && text.trim());

    if (textsToTranslate.length > 0) {
      console.log(
        `Translating ${textsToTranslate.length} text elements...`
      );

      // Prepare translation options
      const translationOptions: any = {};

      // If source language is "auto", don't specify sourceLanguage to enable auto-detection
      if (sourceLanguage !== "auto") {
        translationOptions.sourceLanguage = sourceLanguage;
      }

      // Translate all texts in batch
      const translationResults =
        await translationService.translateTexts(
          textsToTranslate,
          desiredLanguage,
          translationOptions
        );

      // Update textbox values with translated text
      let translationIndex = 0;
      let detectedLanguages = new Set<string>();

      textBoxes.forEach((textbox) => {
        if (textbox.value && textbox.value.trim()) {
          textbox.value =
            translationResults[translationIndex].translatedText;

          // Collect detected languages if auto-detection was used
          if (
            sourceLanguage === "auto" &&
            translationResults[translationIndex]
              .detectedSourceLanguage
          ) {
            const detectedLang =
              translationResults[translationIndex]
                .detectedSourceLanguage;
            if (detectedLang) {
              detectedLanguages.add(detectedLang);
            }
          }

          translationIndex++;
        }
      });

      console.log("Translation completed successfully");

      // Show success message with detected language info if auto-detection was used
      if (sourceLanguage === "auto" && detectedLanguages.size > 0) {
        const detectedLanguageNames = Array.from(detectedLanguages)
          .map((code) => {
            // Map common language codes to names
            const languageMap: { [key: string]: string } = {
              en: "English",
              es: "Spanish",
              fr: "French",
              de: "German",
              it: "Italian",
              pt: "Portuguese",
              ru: "Russian",
              "zh-CN": "Chinese (Simplified)",
              "zh-TW": "Chinese (Traditional)",
              ja: "Japanese",
              ko: "Korean",
              ar: "Arabic",
              hi: "Hindi",
              nl: "Dutch",
              sv: "Swedish",
              no: "Norwegian",
              da: "Danish",
              fi: "Finnish",
              pl: "Polish",
              tr: "Turkish",
              el: "Greek",
              he: "Hebrew",
              hu: "Hungarian",
              cs: "Czech",
              sk: "Slovak",
              ro: "Romanian",
              bg: "Bulgarian",
              hr: "Croatian",
              sr: "Serbian",
              sl: "Slovenian",
              et: "Estonian",
              lv: "Latvian",
              lt: "Lithuanian",
              uk: "Ukrainian",
              be: "Belarusian",
              th: "Thai",
              vi: "Vietnamese",
              id: "Indonesian",
              ms: "Malay",
              tl: "Filipino",
              bn: "Bengali",
              ur: "Urdu",
              pa: "Punjabi",
              gu: "Gujarati",
              mr: "Marathi",
              kn: "Kannada",
              ta: "Tamil",
              te: "Telugu",
              ml: "Malayalam",
              si: "Sinhala",
              my: "Burmese",
              km: "Khmer",
              lo: "Lao",
              ne: "Nepali",
              bo: "Tibetan",
              mn: "Mongolian",
              kk: "Kazakh",
              uz: "Uzbek",
              ky: "Kyrgyz",
              tg: "Tajik",
              tk: "Turkmen",
              az: "Azerbaijani",
              ka: "Georgian",
              hy: "Armenian",
              fa: "Persian",
              ku: "Kurdish",
              ps: "Pashto",
              prs: "Dari",
              ug: "Uyghur",
            };
            return languageMap[code] || code;
          })
          .join(", ");
        toast.success(
          `Translated ${translationResults.length} text elements to ${desiredLanguage} (detected: ${detectedLanguageNames})`
        );
      } else {
        toast.success(
          `Translated ${translationResults.length} text elements to ${desiredLanguage}`
        );
      }
    }
  } catch (translationError) {
    console.error("Translation error:", translationError);
    toast.error(
      "Failed to translate text. Textboxes will be created with original text."
    );
    // Continue with original text if translation fails
  } finally {
    setIsTranslating(false);
  }
}
