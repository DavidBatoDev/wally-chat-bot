import { toast } from "sonner";
import { generateUUID, measureText } from "../utils/measurements";
import { TextField, UntranslatedText } from "../types/pdf-editor.types";
import {
  serializeOcrResponse,
  getTextBoxesForPage,
} from "../utils/ocrResponseSerializer";

// Helper function to validate background service configuration
function validateBackgroundServiceConfig(): {
  isValid: boolean;
  missingVars: string[];
} {
  const missingVars: string[] = [];

  if (!process.env.NEXT_PUBLIC_OCR_CAPTURE_SERVICE_URL) {
    missingVars.push("NEXT_PUBLIC_OCR_CAPTURE_SERVICE_URL");
  }

  // No API key validation needed - direct call to backend
  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
}

// Types for OCR processing
export interface OcrOptions {
  pageNumber: number;
  sourceLanguage?: string;
  desiredLanguage?: string;
  projectId?: string; // Add project ID for capture URL
  viewType?: "original" | "translated"; // Add view type
  addTextBox: (
    x: number,
    y: number,
    page: number,
    view: any,
    targetView?: "original" | "translated",
    initialProperties?: any
  ) => string;
  setElementCollections: (updater: (prev: any) => any) => void;
  setIsTranslating: (isTranslating: boolean) => void;
  addUntranslatedText?: (untranslatedText: any) => void;
  // Birth certificate specific options
  pageType?: "social_media" | "birth_cert" | "dynamic_content";
  birthCertTemplateId?: string; // Template ID for birth certificate pages
}

export interface OcrResult {
  textBoxes: TextField[];
  success: boolean;
  message?: string;
}

export interface BulkOcrOptions extends Omit<OcrOptions, "pageNumber"> {
  totalPages: number;
  deletedPages: Set<number>;
  currentPage: number;
  onProgress?: (current: number, total: number) => void;
  onPageChange: (page: number) => void;
  cancelRef: React.MutableRefObject<{ cancelled: boolean }>;
  projectId?: string; // Add project ID for background service
  captureUrl?: string; // Add capture URL for background service
  ocrApiUrl?: string; // Add OCR API URL for background service
}

export const performPageOcr = async (options: OcrOptions): Promise<any> => {
  try {
    console.log("🚀 [OCR Service] Starting single page OCR...");
    console.log("📋 OCR Options:", {
      projectId: options.projectId,
      pageNumber: options.pageNumber,
      viewType: options.viewType || "original",
    });

    const requestPayload = {
      projectId: options.projectId,
      captureUrl: `http://localhost:3000/capture-project/${
        options.projectId || `single-page-${Date.now()}`
      }`, // Include project ID
      pageNumbers: options.pageNumber,
      viewTypes: [options.viewType || "original"],
      ocrApiUrl: "http://localhost:8000/projects/process-file", // Direct call to backend
    };

    console.log(
      "📤 [OCR Service] Sending request to Puppeteer service:",
      requestPayload
    );

    const response = await fetch("http://localhost:3001/capture-and-ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ [OCR Service] OCR completed successfully!");
    console.log("📊 [OCR Service] Full OCR Response:", result);

    // Log detailed results
    if (result.success && result.data && result.data.results) {
      console.log("🎯 [OCR Service] OCR Results Summary:");
      console.log(`   - Total pages processed: ${result.data.results.length}`);
      console.log(`   - Success rate: ${result.data.successRate}%`);
      console.log(`   - Duration: ${result.data.duration}ms`);

      // Serialize OCR response to get textboxes
      const { textBoxesByPage, pageDimensions, totalTextBoxes } =
        serializeOcrResponse(result);

      console.log(
        `🎯 [OCR Service] Serialized ${totalTextBoxes} textboxes across all pages`
      );

      // Log each page result
      result.data.results.forEach((pageResult: any, index: number) => {
        const pageTextBoxes = getTextBoxesForPage(
          textBoxesByPage,
          pageResult.pageNumber,
          pageResult.viewType
        );

        console.log(
          `\n📄 [OCR Service] Page ${pageResult.pageNumber} Results:`
        );
        console.log(`   - View type: ${pageResult.viewType}`);
        console.log(`   - Textboxes created: ${pageTextBoxes.length}`);

        if (pageResult.ocrResult?.styled_layout?.pages) {
          const pageData = pageResult.ocrResult.styled_layout.pages.find(
            (p: any) => p.page_number === pageResult.pageNumber
        );
        console.log(
            `   - OCR entities found: ${pageData?.entities?.length || 0}`
          );
        }
      });

      // Add the serialized result to the response for easy access
      result.serializedData = {
        textBoxesByPage,
        pageDimensions,
        totalTextBoxes,
      };

      // Create textboxes in the frontend using the serialized data
      if (options.setElementCollections && totalTextBoxes > 0) {
        console.log("🎯 [OCR Service] Creating textboxes in frontend...");

        // Collect all translated textboxes to add at once
        const translatedTextBoxesToAdd: any[] = [];

        // Process each page and create textboxes
        textBoxesByPage.forEach((pageMap, pageNumber) => {
          pageMap.forEach((textBoxes, viewType) => {
        console.log(
              `📝 [OCR Service] Creating ${textBoxes.length} textboxes for page ${pageNumber} (${viewType})`
            );

            textBoxes.forEach((textBox) => {
              try {
                // Prepare translated textbox to add directly to translatedTextBoxes array
                const translatedTextBox = {
                  ...textBox,
                  id: generateUUID(), // Generate new ID for translated version
                  value: textBox.value, // Set the detected text as the value
                  placeholder: "Enter translation...", // Generic placeholder for translation
                };

                translatedTextBoxesToAdd.push(translatedTextBox);

        console.log(
                  `✅ [OCR Service] Prepared textbox for translated page: ${translatedTextBox.id} at (${textBox.x}, ${textBox.y})`
                );
              } catch (error) {
                console.error(
                  `❌ [OCR Service] Error creating textbox:`,
                  error
                );
              }
            });
          });
        });

                 // Add all translated textboxes at once
         if (translatedTextBoxesToAdd.length > 0) {
           options.setElementCollections((prev: any) => ({
             ...prev,
             translatedTextBoxes: [
               ...prev.translatedTextBoxes,
               ...translatedTextBoxesToAdd,
             ],
           }));
           console.log(
             `✅ [OCR Service] Added ${translatedTextBoxesToAdd.length} textboxes directly to translatedTextBoxes array`
           );
           
           // Now apply measureText utility to optimize dimensions of all textboxes
           console.log("🔍 [OCR Service] Applying measureText utility to optimize textbox dimensions...");
           
           // Get the updated state to access the newly added textboxes
           options.setElementCollections((prev: any) => {
             const updatedTextBoxes = prev.translatedTextBoxes.map((textBox: any) => {
               try {
                 console.log(
                   `🔍 [OCR Service] Measuring text: "${textBox.value}" with font: ${textBox.fontSize || 16}px ${textBox.fontFamily || "Arial"}`
                 );
                 
                 const measured = measureText(
                   textBox.value,
                   textBox.fontSize || 16,
                   textBox.fontFamily || "Arial, sans-serif",
                   textBox.letterSpacing || 0,
                   undefined, // No maxWidth constraint
                   {
                     top: textBox.paddingTop || 0,
                     right: textBox.paddingRight || 0,
                     bottom: textBox.paddingBottom || 0,
                     left: textBox.paddingLeft || 0,
                   }
                 );
                 
                 console.log(
                   `📏 [OCR Service] Measured textbox dimensions: ${measured.width}x${measured.height} for text: "${textBox.value}" (original: ${textBox.width}x${textBox.height})`
                 );
                 
                 return {
                   ...textBox,
                   width: measured.width,
                   height: measured.height,
                 };
               } catch (error) {
                 console.warn(
                   `⚠️ [OCR Service] Failed to measure text dimensions for "${textBox.value}", keeping original:`,
                   error
                 );
                 return textBox;
               }
             });
             
             return {
               ...prev,
               translatedTextBoxes: updatedTextBoxes,
             };
           });
         }

          console.log(
          `🎉 [OCR Service] Successfully created ${translatedTextBoxesToAdd.length} translated textboxes in frontend`
          );
      } else {
            console.log(
          "ℹ️ [OCR Service] No textboxes to create or handlers not provided"
            );
          }
    } else {
      console.log("⚠️ [OCR Service] OCR completed but no results data found");
      console.log("📝 Response structure:", result);
    }

    return result;
  } catch (error) {
    console.error("❌ [OCR Service] OCR failed:", error);
    throw error;
  }
};

/**
 * Performs OCR on all pages in a document using the background capture service
 */
export async function performBulkOcr(options: BulkOcrOptions): Promise<{
  success: boolean;
  processedPages: number;
  totalPages: number;
  message?: string;
  backgroundJobId?: string; // Add background job ID for tracking
}> {
  const {
    deletedPages,
    totalPages,
    currentPage,
    onProgress,
    onPageChange,
    cancelRef,
    projectId,
    captureUrl,
    ocrApiUrl,
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
    console.log("🚀 [OCR Service] Starting bulk OCR...");
    console.log("📋 Bulk OCR Options:", {
      projectId: options.projectId,
      totalPages: options.totalPages,
      currentPage: options.currentPage,
      deletedPages: Array.from(options.deletedPages),
    });

    // Check if we have the required parameters for background service
    if (!projectId || !captureUrl || !ocrApiUrl) {
      console.warn("Missing required parameters for background OCR service");
      return {
        success: false,
        processedPages: 0,
        totalPages: pagesToProcess.length,
        message: "Missing configuration for background OCR service",
      };
    }

    // Validate background service configuration
    const configValidation = validateBackgroundServiceConfig();
    if (!configValidation.isValid) {
      const missingVars = configValidation.missingVars.join(", ");
      console.error(`Missing environment variables: ${missingVars}`);
      return {
        success: false,
        processedPages: 0,
        totalPages: pagesToProcess.length,
        message: `Missing environment configuration: ${missingVars}`,
      };
    }

    // Call the background OCR capture service
    const backgroundServiceUrl =
      process.env.NEXT_PUBLIC_OCR_CAPTURE_SERVICE_URL;
    if (!backgroundServiceUrl) {
      console.error("OCR Capture Service URL not configured");
      return {
        success: false,
        processedPages: 0,
        totalPages: pagesToProcess.length,
        message: "OCR Capture Service not configured",
      };
    }

    console.log("Initiating background OCR capture service...");
    console.log("Service URL:", backgroundServiceUrl);
    console.log("Project ID:", projectId);
    console.log("Pages to process:", pagesToProcess);

    // Prepare the request payload for the background service
    const requestPayload = {
      projectId: projectId || `bulk-ocr-${Date.now()}`,
      captureUrl: `http://localhost:3000/capture-project/${
        projectId || `bulk-ocr-${Date.now()}`
      }`, // Include project ID
      pageNumbers: pagesToProcess,
      viewTypes: ["original"], // Only process original view for OCR
      ocrApiUrl: "http://localhost:8000/projects/process-file", // Direct call to your backend
      projectData: {
        totalPages: pagesToProcess.length,
        sourceLanguage: options.sourceLanguage,
        desiredLanguage: options.desiredLanguage,
        timestamp: new Date().toISOString(),
      },
    };

    // Make the request to the background service
    const response = await fetch(`${backgroundServiceUrl}/capture-and-ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new Error(
        `Background service error: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();

    if (result.success) {
      console.log("Background OCR service initiated successfully:", result);

      // Check if we have OCR results to process
      if (result.data?.results && result.data.results.length > 0) {
        console.log("🎯 [Bulk OCR] Processing OCR results...");

        // Serialize OCR response to get textboxes
        const { textBoxesByPage, pageDimensions, totalTextBoxes } =
          serializeOcrResponse(result);

        console.log(
          `🎯 [Bulk OCR] Serialized ${totalTextBoxes} textboxes across all pages`
        );

        // Create textboxes in the frontend using the serialized data
        if (options.setElementCollections && totalTextBoxes > 0) {
          console.log("🎯 [Bulk OCR] Creating textboxes in frontend...");

          // Collect all translated textboxes to add at once
          const translatedTextBoxesToAdd: any[] = [];

          // Process each page and create textboxes
          textBoxesByPage.forEach((pageMap, pageNumber) => {
            pageMap.forEach((textBoxes, viewType) => {
              console.log(
                `📝 [Bulk OCR] Creating ${textBoxes.length} textboxes for page ${pageNumber} (${viewType})`
              );

              textBoxes.forEach((textBox) => {
                try {
                  // Prepare translated textbox to add directly to translatedTextBoxes array
                  const translatedTextBox = {
                    ...textBox,
                    id: generateUUID(), // Generate new ID for translated version
                    value: textBox.value, // Set the detected text as the value
                    placeholder: "Enter translation...", // Generic placeholder for translation
                  };

                  translatedTextBoxesToAdd.push(translatedTextBox);

                  console.log(
                    `✅ [Bulk OCR] Prepared textbox for translated page: ${translatedTextBox.id} at (${textBox.x}, ${textBox.y})`
                  );
                } catch (error) {
                  console.error(`❌ [Bulk OCR] Error creating textbox:`, error);
                }
              });
            });
          });

                     // Add all translated textboxes at once
           if (translatedTextBoxesToAdd.length > 0) {
             options.setElementCollections((prev: any) => ({
               ...prev,
               translatedTextBoxes: [
                 ...prev.translatedTextBoxes,
                 ...translatedTextBoxesToAdd,
               ],
             }));
             console.log(
               `✅ [Bulk OCR] Added ${translatedTextBoxesToAdd.length} textboxes directly to translatedTextBoxes array`
             );
             
             // Now apply measureText utility to optimize dimensions of all textboxes
             console.log("🔍 [Bulk OCR] Applying measureText utility to optimize textbox dimensions...");
             
             // Get the updated state to access the newly added textboxes
             options.setElementCollections((prev: any) => {
               const updatedTextBoxes = prev.translatedTextBoxes.map((textBox: any) => {
                 try {
                   console.log(
                     `🔍 [Bulk OCR] Measuring text: "${textBox.value}" with font: ${textBox.fontSize || 16}px ${textBox.fontFamily || "Arial"}`
                   );
                   
                   const measured = measureText(
                     textBox.value,
                     textBox.fontSize || 16,
                     textBox.fontFamily || "Arial, sans-serif",
                     textBox.letterSpacing || 0,
                     undefined, // No maxWidth constraint
                     {
                       top: textBox.paddingTop || 0,
                       right: textBox.paddingRight || 0,
                       bottom: textBox.paddingBottom || 0,
                       left: textBox.paddingLeft || 0,
                     }
                   );
                   
                   console.log(
                     `📏 [Bulk OCR] Measured textbox dimensions: ${measured.width}x${measured.height} for text: "${textBox.value}" (original: ${textBox.width}x${textBox.height})`
                   );
                   
                   return {
                     ...textBox,
                     width: measured.width,
                     height: measured.height,
                   };
                 } catch (error) {
                   console.warn(
                     `⚠️ [Bulk OCR] Failed to measure text dimensions for "${textBox.value}", keeping original:`,
                     error
                   );
                   return textBox;
                 }
               });
               
               return {
                 ...prev,
                 translatedTextBoxes: updatedTextBoxes,
               };
             });
           }

          console.log(
            `🎉 [Bulk OCR] Successfully created ${translatedTextBoxesToAdd.length} translated textboxes in frontend`
          );
        }
      }

      // Update progress for all pages
      for (let i = 0; i < pagesToProcess.length; i++) {
        if (cancelRef.current.cancelled) break;
        onProgress?.(i + 1, pagesToProcess.length);
        processedCount++;
      }

      // Restore the original page
      onPageChange(originalPage);

      toast.success(
        `Background OCR processing completed for ${processedCount} pages`
      );

      return {
        success: true,
        processedPages: processedCount,
        totalPages: pagesToProcess.length,
        message: `Background OCR processing completed for ${processedCount} pages`,
        backgroundJobId: result.data?.jobId, // Return job ID for tracking
      };
    } else {
      throw new Error(result.error || "Background service failed");
    }
  } catch (error) {
    console.error("❌ [OCR Service] Bulk OCR failed:", error);
    onPageChange(originalPage);

    toast.error(
      `Failed to initiate background OCR: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );

    return {
      success: false,
      processedPages: 0,
      totalPages: pagesToProcess.length,
      message: `Failed to initiate background OCR: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Converts OCR entities to TextField objects
 * This function is kept for backward compatibility and template-ocr format
 * For the new styled layout format, use serializeOcrEntities from ocrResponseSerializer
 */
export async function convertEntitiesToTextBoxes(
  entities: any[],
  pageNumber: number,
  pdfPageWidth: number,
  pdfPageHeight: number
): Promise<TextField[]> {
  // Check if this is the new styled layout format
  if (entities.length > 0 && entities[0].dimensions && entities[0].styling) {
    console.log(
      "🔄 [OCR Service] Using new styled layout format, delegating to serializer"
    );
    const { serializeOcrEntities } = await import(
      "../utils/ocrResponseSerializer"
    );
    return serializeOcrEntities(
      entities,
      pageNumber,
      pdfPageWidth,
      pdfPageHeight
    );
  }

  // Fallback to original logic for template-ocr format
  console.log(
    "🔄 [OCR Service] Using template-ocr format, using legacy conversion"
  );
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

    // Handle both regular OCR and template-ocr formats
    if (entity.dimensions) {
      // Regular OCR format
      x = entity.dimensions.box_x;
      width = entity.dimensions.box_width;
      height = entity.dimensions.box_height;
      y = entity.dimensions.box_y;
    } else if (entity.style) {
      // Template-ocr format
      x = entity.style.x;
      y = entity.style.y;
      width = entity.style.width;
      height = entity.style.height;
    }

    // Extract styling information from styled entity
    const styling = entity.styling || entity.style || {};
    const colors = styling.colors || {};

    // Handle template-ocr format where style properties are directly on entity.style
    const templateStyle = entity.style || {};

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

      let r: number,
        g: number,
        b: number,
        a: number = 1;

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

    // Handle template-ocr format for text color
    let textColor = "#000000";
    if (templateStyle.color) {
      textColor = templateStyle.color;
    } else if (colors.fill_color || colors.text_color) {
      textColor = rgbToHex(colors.fill_color || colors.text_color);
    }

    const borderRadius =
      styling.background?.border_radius || getStyleValue("border_radius", 0);
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
    const estimatedFontSize =
      templateStyle.font_size || getStyleValue("font_size", 12);
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

    // Calculate text dimensions using measureText function with buffer
    const bufferWidth = 20; // Add 20px buffer on each side
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

    // Use measured text width with buffer instead of original width
    const finalWidth = textWidth + bufferWidth * 2; // Add buffer on both sides
    const finalHeight = Math.max(textHeight, height) + textPadding * 2; // Use the larger of measured height or original height

    // Determine placeholder text
    const textValue = entity.text || "";
    const entityPlaceholder = entity.placeholder || "";

    // Always show placeholder: entity placeholder if provided, otherwise "Enter Text..."
    const placeholder = entityPlaceholder || "Enter Text...";

    const newTextBox: TextField = {
      id: generateUUID(),
      x: x,
      y: y,
      width: finalWidth,
      height: finalHeight,
      value: textValue,
      placeholder: placeholder,
      fontSize: estimatedFontSize,
      fontFamily:
        templateStyle.font_family ||
        getStyleValue("font_family", "Arial, sans-serif"),
      page: pageNumber,
      color: textColor,
      bold: !!(getStyleValue("bold", false) || fontWeight),
      italic: !!getStyleValue("italic", false),
      underline: !!getStyleValue("underline", false),
      textAlign: textAlign as "left" | "center" | "right" | "justify",
      listType: "none",
      letterSpacing: getStyleValue("letter_spacing", 0),
      lineHeight: getStyleValue("line_spacing", 1.2),
      rotation: templateStyle.rotation || 0,
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
      console.log(`Translating ${textsToTranslate.length} text elements...`);

      // Prepare translation options
      const translationOptions: any = {};

      // If source language is "auto", don't specify sourceLanguage to enable auto-detection
      if (sourceLanguage !== "auto") {
        translationOptions.sourceLanguage = sourceLanguage;
      }

      // Translate all texts in batch
      const translationResults = await translationService.translateTexts(
        textsToTranslate,
        desiredLanguage,
        translationOptions
      );

      // Update textbox values with translated text
      let translationIndex = 0;
      let detectedLanguages = new Set<string>();

      textBoxes.forEach((textbox) => {
        if (textbox.value && textbox.value.trim()) {
          textbox.value = translationResults[translationIndex].translatedText;

          // Collect detected languages if auto-detection was used
          if (
            sourceLanguage === "auto" &&
            translationResults[translationIndex].detectedSourceLanguage
          ) {
            const detectedLang =
              translationResults[translationIndex].detectedSourceLanguage;
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
