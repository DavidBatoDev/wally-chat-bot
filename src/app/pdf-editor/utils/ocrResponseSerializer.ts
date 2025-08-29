import { TextField } from "../types/pdf-editor.types";
import { generateUUID, measureText } from "./measurements";

// Types for the OCR response structure
export interface OcrEntity {
  type: string;
  text: string;
  confidence: number;
  id: string;
  bounding_poly: {
    vertices: Array<{ x: number; y: number }>;
  };
  styling: {
    font_size: number;
    font_family: string;
    colors: {
      fill_color: { r: number; g: number; b: number };
      stroke_color: { r: number; g: number; b: number };
      background_color: { r: number; g: number; b: number; a: number } | null;
      border_color: { r: number; g: number; b: number } | null;
    };
    text_alignment: string;
    line_spacing: number;
    line_height: number;
    text_padding: number;
    text_lines: string[];
    line_count: number;
    background?: {
      border_radius: number;
      expanded_x: number;
      expanded_y: number;
      expanded_width: number;
      expanded_height: number;
    };
  };
  dimensions: {
    box_width: number;
    box_height: number;
    box_x: number;
    box_y: number;
    text_y: number;
    coordinates: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      x3: number;
      y3: number;
      x4: number;
      y4: number;
    };
  };
}

export interface OcrPageResult {
  pageNumber: number;
  viewType: string;
  ocrResult: {
    styled_layout: {
      document_info: {
        total_pages: number;
        mime_type: string;
        page_width: number;
        page_height: number;
      };
      pages: Array<{
        page_number: number;
        text: string;
        entities: OcrEntity[];
      }>;
    };
  };
  captureInfo: {
    width: number;
    height: number;
    imageSize: number;
  };
}

export interface OcrResponse {
  success: boolean;
  data: {
    projectId: string;
    totalPages: number;
    totalViews: number;
    processedPages: number;
    results: OcrPageResult[];
    errors: string[];
    startTime: string;
    endTime: string;
    duration: number;
    successRate: number;
  };
}

/**
 * Converts RGB/RGBA colors to hex format
 */
function rgbToHex(
  rgb: { r: number; g: number; b: number; a?: number } | null
): string {
  if (!rgb) return "transparent";

  const r = Math.round(rgb.r * 255);
  const g = Math.round(rgb.g * 255);
  const b = Math.round(rgb.b * 255);
  const a = rgb.a !== undefined ? rgb.a : 1;

  if (a < 0.1) return "transparent";

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Maps OCR text alignment to frontend text alignment
 */
function mapTextAlignment(
  ocrAlignment: string
): "left" | "center" | "right" | "justify" {
  switch (ocrAlignment.toLowerCase()) {
    case "center":
      return "center";
    case "right":
      return "right";
    case "justify":
      return "justify";
    default:
      return "left";
  }
}

/**
 * Converts OCR entities to TextField objects
 */
export function serializeOcrEntities(
  entities: OcrEntity[],
  pageNumber: number,
  pageWidth: number,
  pageHeight: number
): TextField[] {
  const textBoxes: TextField[] = [];

  entities.forEach((entity) => {
    // Skip entities without proper bounding information
    if (!entity.dimensions || !entity.styling) {
      console.warn(
        `Skipping entity ${entity.id} - missing dimensions or styling`
      );
      return;
    }

    const { dimensions, styling } = entity;
    const colors = styling.colors;

    // Convert colors
    const backgroundColor = colors.background_color
      ? rgbToHex(colors.background_color)
      : "transparent";

    const backgroundOpacity = colors.background_color?.a ?? 1;
    const borderColor = colors.border_color
      ? rgbToHex(colors.border_color)
      : "#000000";

    const textColor = colors.fill_color
      ? rgbToHex(colors.fill_color)
      : "#000000";

    // Use measureText utility to calculate optimal dimensions based on text content and font properties
    const measuredDimensions = measureText(
      entity.text,
      styling.font_size,
      styling.font_family || "Arial, sans-serif",
      0, // characterSpacing
      undefined, // No maxWidth constraint
      {
        top: styling.text_padding || 0,
        right: styling.text_padding || 0,
        bottom: styling.text_padding || 0,
        left: styling.text_padding || 0,
      }
    );

    // Log the dimension optimization for debugging
    console.log(
      `🔍 [OCR Serializer] Text: "${entity.text}" - Original: ${
        dimensions.box_width
      }x${dimensions.box_height}, Measured: ${measuredDimensions.width}x${
        measuredDimensions.height
      }, Font: ${styling.font_size}px ${styling.font_family || "Arial"}`
    );

    // Create TextField object with optimized dimensions
    const textBox: TextField = {
      id: generateUUID(),
      x: dimensions.box_x,
      y: dimensions.box_y,
      width: Math.max(dimensions.box_width, measuredDimensions.width),
      height: Math.max(dimensions.box_height, measuredDimensions.height),
      value: entity.text,
      placeholder: `Enter or Remove Text for ${entity.type}`,
      fontSize: styling.font_size,
      fontFamily: styling.font_family || "Arial, sans-serif",
      page: pageNumber,
      type: entity.type,
      color: textColor,
      bold: styling.font_family?.toLowerCase().includes("bold") || false,
      italic: false,
      underline: false,
      textAlign: mapTextAlignment(styling.text_alignment),
      listType: "none",
      letterSpacing: 0,
      lineHeight: styling.line_spacing || 1.2,
      rotation: 0,
      backgroundColor,
      backgroundOpacity,
      borderColor: colors.border_color ? borderColor : "transparent",
      borderWidth: colors.border_color ? 1 : 0,
      borderRadius: styling.background?.border_radius || 0,
      borderTopLeftRadius: styling.background?.border_radius || 0,
      borderTopRightRadius: styling.background?.border_radius || 0,
      borderBottomLeftRadius: styling.background?.border_radius || 0,
      borderBottomRightRadius: styling.background?.border_radius || 0,
      paddingTop: styling.text_padding || 0,
      paddingRight: styling.text_padding || 0,
      paddingBottom: styling.text_padding || 0,
      paddingLeft: styling.text_padding || 0,
      isEditing: false,
      hasBeenManuallyResized: false,
      zIndex: 1,
    };

    textBoxes.push(textBox);
  });

  return textBoxes;
}

/**
 * Serializes the complete OCR response and organizes textboxes by page and view type
 */
export function serializeOcrResponse(ocrResponse: OcrResponse): {
  textBoxesByPage: Map<number, Map<string, TextField[]>>;
  pageDimensions: Map<number, { width: number; height: number }>;
  totalTextBoxes: number;
} {
  const textBoxesByPage = new Map<number, Map<string, TextField[]>>();
  const pageDimensions = new Map<number, { width: number; height: number }>();
  let totalTextBoxes = 0;

  if (!ocrResponse.success || !ocrResponse.data?.results) {
    console.warn("OCR response is not successful or missing results");
    return { textBoxesByPage, pageDimensions, totalTextBoxes };
  }

  ocrResponse.data.results.forEach((pageResult) => {
    const { pageNumber, viewType, ocrResult, captureInfo } = pageResult;

    console.log(`🔍 [OCR Serializer] Processing page ${pageNumber}:`, {
      hasOcrResult: !!ocrResult,
      hasStyledLayout: !!ocrResult?.styled_layout,
      styledLayoutPages: ocrResult?.styled_layout?.pages?.length || 0,
      pageNumbers:
        ocrResult?.styled_layout?.pages?.map((p) => p.page_number) || [],
      hasEntities: !!ocrResult?.styled_layout?.pages?.find(
        (p) => p.page_number === pageNumber
      )?.entities,
      entityCount:
        ocrResult?.styled_layout?.pages?.find(
          (p) => p.page_number === pageNumber
        )?.entities?.length || 0,
    });

    // Store page dimensions
    if (captureInfo) {
      pageDimensions.set(pageNumber, {
        width: captureInfo.width,
        height: captureInfo.height,
      });
    }

    // Initialize page map if it doesn't exist
    if (!textBoxesByPage.has(pageNumber)) {
      textBoxesByPage.set(pageNumber, new Map());
    }

    const pageMap = textBoxesByPage.get(pageNumber)!;

    // Process entities for this page and view
    if (ocrResult?.styled_layout?.pages) {
      // Try to find the page data in styled_layout.pages first
      let pageData = ocrResult.styled_layout.pages.find(
        (p) => p.page_number === pageNumber
      );

      console.log(
        `🔍 [OCR Serializer] Page ${pageNumber} data from styled_layout.pages:`,
        {
          found: !!pageData,
          pageNumber: pageData?.page_number,
          entityCount: pageData?.entities?.length || 0,
          hasEntities: !!pageData?.entities,
        }
      );

      // If no page data found in styled_layout.pages, check if this is a single-page response
      if (!pageData && ocrResult.styled_layout.pages.length === 1) {
        console.log(
          `🔍 [OCR Serializer] Page ${pageNumber}: Single-page OCR response detected`
        );
        const singlePage = ocrResult.styled_layout.pages[0];

        // Check if this single page has entities and if it matches our page number
        if (singlePage?.entities && singlePage.entities.length > 0) {
          console.log(
            `🔍 [OCR Serializer] Page ${pageNumber}: Using single page entities (${singlePage.entities.length} entities)`
          );
          pageData = singlePage;
        }
      }

      if (pageData?.entities) {
        const textBoxes = serializeOcrEntities(
          pageData.entities,
          pageNumber,
          captureInfo?.width || 0,
          captureInfo?.height || 0
        );

        pageMap.set(viewType, textBoxes);
        totalTextBoxes += textBoxes.length;

        console.log(
          `Page ${pageNumber} (${viewType}): ${textBoxes.length} textboxes created`
        );
      } else {
        console.log(
          `⚠️ [OCR Serializer] Page ${pageNumber} has no entities or page data not found`
        );

        // Additional debugging: Check what's actually in the OCR result
        console.log(
          `🔍 [OCR Serializer] OCR result structure for page ${pageNumber}:`,
          {
            hasStyledLayout: !!ocrResult.styled_layout,
            styledLayoutKeys: Object.keys(ocrResult.styled_layout || {}),
            pagesLength: ocrResult.styled_layout?.pages?.length || 0,
            firstPageKeys: ocrResult.styled_layout?.pages?.[0]
              ? Object.keys(ocrResult.styled_layout.pages[0])
              : [],
            hasDocumentInfo: !!ocrResult.styled_layout?.document_info,
            totalPages: ocrResult.styled_layout?.document_info?.total_pages,
          }
        );

        // Try alternative entity locations
        let alternativeEntities: OcrEntity[] | null = null;

        // Check if entities are in the first page of styled_layout.pages (fallback for single-page responses)
        if (ocrResult.styled_layout?.pages?.[0]?.entities) {
          console.log(
            `🔍 [OCR Serializer] Found entities in first page: ${ocrResult.styled_layout.pages[0].entities.length} entities`
          );
          alternativeEntities = ocrResult.styled_layout.pages[0].entities;
        }

        // Use alternative entities if found
        if (alternativeEntities && alternativeEntities.length > 0) {
          console.log(
            `🔍 [OCR Serializer] Using alternative entities for page ${pageNumber}: ${alternativeEntities.length} entities`
          );
          const textBoxes = serializeOcrEntities(
            alternativeEntities,
            pageNumber,
            captureInfo?.width || 0,
            captureInfo?.height || 0
          );

          pageMap.set(viewType, textBoxes);
          totalTextBoxes += textBoxes.length;

          console.log(
            `Page ${pageNumber} (${viewType}): ${textBoxes.length} textboxes created from alternative source`
          );
        }
      }
    } else {
      console.log(
        `⚠️ [OCR Serializer] Page ${pageNumber} has no styled_layout.pages`
      );

      // Additional debugging: Check what's in the OCR result
      console.log(
        `🔍 [OCR Serializer] OCR result structure for page ${pageNumber}:`,
        {
          hasOcrResult: !!ocrResult,
          ocrResultKeys: Object.keys(ocrResult || {}),
          hasStyledLayout: !!ocrResult?.styled_layout,
          styledLayoutKeys: ocrResult?.styled_layout
            ? Object.keys(ocrResult.styled_layout)
            : [],
        }
      );
    }
  });

  return { textBoxesByPage, pageDimensions, totalTextBoxes };
}

/**
 * Gets textboxes for a specific page and view type
 */
export function getTextBoxesForPage(
  textBoxesByPage: Map<number, Map<string, TextField[]>>,
  pageNumber: number,
  viewType: string = "original"
): TextField[] {
  const pageMap = textBoxesByPage.get(pageNumber);
  if (!pageMap) return [];

  return pageMap.get(viewType) || [];
}

/**
 * Gets all textboxes across all pages and views
 */
export function getAllTextBoxes(
  textBoxesByPage: Map<number, Map<string, TextField[]>>
): TextField[] {
  const allTextBoxes: TextField[] = [];

  textBoxesByPage.forEach((pageMap) => {
    pageMap.forEach((textBoxes) => {
      allTextBoxes.push(...textBoxes);
    });
  });

  return allTextBoxes;
}
