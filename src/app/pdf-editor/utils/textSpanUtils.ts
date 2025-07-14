import { TextField, DeletionRectangle } from "../types/pdf-editor.types";
import { generateUUID, measureText } from "./measurements";
import { colorToRgba } from "./colors";

// Detect font properties from a text span element
export const detectFontProperties = (span: HTMLSpanElement) => {
  const computedStyle = window.getComputedStyle(span);

  console.log("Raw computed style:", {
    fontFamily: computedStyle.fontFamily,
    fontWeight: computedStyle.fontWeight,
    fontStyle: computedStyle.fontStyle,
    fontSize: computedStyle.fontSize,
    color: computedStyle.color,
    textAlign: computedStyle.textAlign,
    letterSpacing: computedStyle.letterSpacing,
    lineHeight: computedStyle.lineHeight,
    textDecoration: computedStyle.textDecoration,
  });

  // Extract font family with fallbacks
  const fontFamily = computedStyle.fontFamily || "Arial, sans-serif";

  // Enhanced bold detection - check multiple sources
  const fontWeight = computedStyle.fontWeight;
  let isBold = false;

  console.log("Bold detection - initial values:", {
    computedFontWeight: fontWeight,
    fontWeightType: typeof fontWeight,
    fontWeightNumber: parseInt(fontWeight),
    spanClasses: Array.from(span.classList),
    spanStyle: span.getAttribute("style"),
    spanTagName: span.tagName,
  });

  // Check computed font weight
  if (
    fontWeight === "bold" ||
    fontWeight === "700" ||
    parseInt(fontWeight) >= 700
  ) {
    isBold = true;
    console.log("Bold detected from computed font weight:", fontWeight);
  }

  // Check if the span has any bold-related classes or attributes
  if (
    span.classList.contains("bold") ||
    span.classList.contains("strong") ||
    span.classList.contains("b") ||
    span.tagName.toLowerCase() === "strong" ||
    span.tagName.toLowerCase() === "b" ||
    span.getAttribute("style")?.includes("font-weight: bold") ||
    span.getAttribute("style")?.includes("font-weight:700") ||
    span.getAttribute("style")?.includes("font-weight: bold") ||
    span.getAttribute("style")?.includes("font-weight: 700")
  ) {
    isBold = true;
    console.log("Bold detected from span classes/attributes");
  }

  // Check for inline font-weight styles with different formats
  const styleAttr = span.getAttribute("style");
  if (styleAttr) {
    const fontWeightMatch = styleAttr.match(
      /font-weight:\s*(bold|700|800|900)/i
    );
    if (fontWeightMatch) {
      isBold = true;
      console.log("Bold detected from inline style:", fontWeightMatch[1]);
    }
  }

  // Check parent elements for bold styling
  let parent = span.parentElement;
  let parentLevel = 0;
  while (parent && parent !== document.body && parentLevel < 5) {
    const parentStyle = window.getComputedStyle(parent);
    const parentFontWeight = parentStyle.fontWeight;

    console.log(`Parent level ${parentLevel} bold check:`, {
      tagName: parent.tagName,
      classes: Array.from(parent.classList),
      fontWeight: parentFontWeight,
      fontWeightNumber: parseInt(parentFontWeight),
    });

    if (
      parentFontWeight === "bold" ||
      parentFontWeight === "700" ||
      parseInt(parentFontWeight) >= 700 ||
      parent.classList.contains("bold") ||
      parent.classList.contains("strong") ||
      parent.tagName.toLowerCase() === "strong" ||
      parent.tagName.toLowerCase() === "b"
    ) {
      isBold = true;
      console.log(
        `Bold detected from parent level ${parentLevel}:`,
        parent.tagName
      );
      break;
    }

    // Check parent's inline styles
    const parentStyleAttr = parent.getAttribute("style");
    if (parentStyleAttr) {
      const parentFontWeightMatch = parentStyleAttr.match(
        /font-weight:\s*(bold|700|800|900)/i
      );
      if (parentFontWeightMatch) {
        isBold = true;
        console.log(
          `Bold detected from parent level ${parentLevel} inline style:`,
          parentFontWeightMatch[1]
        );
        break;
      }
    }

    parent = parent.parentElement;
    parentLevel++;
  }

  // Additional checks for PDF-specific bold indicators
  if (
    span.style.fontWeight === "bold" ||
    span.style.fontWeight === "700" ||
    span.style.fontWeight === "800" ||
    span.style.fontWeight === "900"
  ) {
    isBold = true;
    console.log(
      "Bold detected from span.style.fontWeight:",
      span.style.fontWeight
    );
  }

  // Check if the text appears visually bold by comparing font weight to normal
  const normalFontWeight = parseInt(fontWeight) || 400;
  if (normalFontWeight >= 600) {
    isBold = true;
    console.log("Bold detected from font weight comparison:", normalFontWeight);
  }

  // Additional visual check - sometimes PDF text has subtle bold indicators
  const defaultFontWeight = 400;
  const fontWeightDiff = normalFontWeight - defaultFontWeight;
  if (fontWeightDiff >= 200) {
    isBold = true;
    console.log("Bold detected from font weight difference:", fontWeightDiff);
  }

  // Check font family for bold indicators
  const fontFamilyLower = fontFamily.toLowerCase();
  if (
    fontFamilyLower.includes("bold") ||
    fontFamilyLower.includes("heavy") ||
    fontFamilyLower.includes("black") ||
    fontFamilyLower.includes("extra-bold") ||
    fontFamilyLower.includes("ultra-bold")
  ) {
    isBold = true;
    console.log("Bold detected from font family:", fontFamily);
  }

  console.log("Final bold detection result:", isBold);

  // Detect italic
  const fontStyle = computedStyle.fontStyle;
  const isItalic = fontStyle === "italic" || fontStyle === "oblique";

  // Detect underline
  const textDecoration = computedStyle.textDecoration;
  const isUnderline = textDecoration.includes("underline");

  // Get font size
  const fontSize = parseFloat(computedStyle.fontSize) || 12;

  // Enhanced color detection - check multiple sources
  let color = computedStyle.color || "#000000";

  // If color is rgb(0, 0, 0) or similar, try to get a more specific color
  if (color === "rgb(0, 0, 0)" || color === "rgba(0, 0, 0, 1)") {
    // Check if there's a more specific color in the style attribute
    const styleAttr = span.getAttribute("style");
    if (styleAttr) {
      const colorMatch = styleAttr.match(/color:\s*([^;]+)/i);
      if (colorMatch) {
        color = colorMatch[1].trim();
      }
    }

    // Check parent elements for color
    parent = span.parentElement;
    while (parent && parent !== document.body) {
      const parentStyle = window.getComputedStyle(parent);
      const parentColor = parentStyle.color;
      if (
        parentColor &&
        parentColor !== "rgb(0, 0, 0)" &&
        parentColor !== "rgba(0, 0, 0, 1)"
      ) {
        color = parentColor;
        break;
      }
      parent = parent.parentElement;
    }
  }

  // Convert color to hex format for consistency
  if (color.startsWith("rgb(") || color.startsWith("rgba(")) {
    try {
      // Extract RGB values from rgb/rgba string
      const rgbMatch = color.match(
        /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/
      );
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        color = `#${r.toString(16).padStart(2, "0")}${g
          .toString(16)
          .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      }
    } catch (error) {
      console.warn("Failed to convert color to hex:", color, error);
      color = "#000000"; // Fallback to black
    }
  }

  // Get text alignment
  const textAlign = computedStyle.textAlign || "left";

  // Get letter spacing (character spacing)
  const letterSpacing = parseFloat(computedStyle.letterSpacing) || 0;

  // Get line height
  const lineHeight = parseFloat(computedStyle.lineHeight) || 1.2;

  // Get text transform
  const textTransform = computedStyle.textTransform || "none";

  const result = {
    fontFamily,
    isBold,
    isItalic,
    isUnderline,
    fontSize,
    color,
    textAlign,
    letterSpacing,
    lineHeight,
    textTransform,
  };

  console.log("Processed font properties:", result);

  return result;
};

// Create a text field from a span element
export const createTextFieldFromSpan = (
  span: HTMLElement,
  pdfPageEl: HTMLElement,
  currentPage: number,
  currentView: "original" | "translated",
  scale: number,
  addTextBox: (
    x: number,
    y: number,
    currentPage: number,
    currentView: "original" | "translated",
    targetView?: "original" | "translated",
    initialProperties?: any
  ) => string,
  addDeletionRectangle: (
    x: number,
    y: number,
    width: number,
    height: number,
    currentPage: number,
    currentView: "original" | "translated",
    background: string,
    opacity?: number
  ) => string,
  pdfBackgroundColor: string,
  erasureOpacity: number
): { textFieldId: string; properties: any } | null => {
  const textContent = span.textContent || "";
  console.log("Original text content:", textContent);

  if (!textContent.trim()) {
    console.log("Text content is empty after trim");
    return null;
  }

  if (!pdfPageEl) {
    console.log("PDF page element not provided");
    return null;
  }

  const spanRect = span.getBoundingClientRect();
  const pageRect = pdfPageEl.getBoundingClientRect();

  // Calculate dimensions in original scale
  const pageWidth = spanRect.width / scale;
  const pageHeight = spanRect.height / scale;
  const pageX = (spanRect.left - pageRect.left) / scale;
  const pageY = (spanRect.top - pageRect.top) / scale;

  // Enhanced text cleaning to handle newlines, whitespace, and special characters
  let cleanedTextContent = textContent;

  // Remove icon characters if they exist
  if (textContent.includes("×") || textContent.includes("✎")) {
    cleanedTextContent = cleanedTextContent.replace(/×✎/g, "");
  }

  // More aggressive text cleaning to handle all types of newlines and whitespace
  cleanedTextContent = cleanedTextContent
    // Remove all types of line breaks and replace with single space
    .replace(/\r\n|\r|\n/g, " ")
    // Replace tabs with space
    .replace(/\t/g, " ")
    // Replace multiple consecutive spaces with single space
    .replace(/\s+/g, " ")
    // Remove any remaining invisible characters that might cause issues
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width characters
    // Remove any remaining control characters except space
    .replace(/[\x00-\x1F\x7F]/g, " ")
    // Trim leading and trailing whitespace
    .trim();

  console.log("Cleaned text content:", cleanedTextContent);
  console.log("Text content length:", cleanedTextContent.length);
  console.log(
    "Text content bytes:",
    new TextEncoder().encode(cleanedTextContent)
  );
  console.log(
    "Text content character codes:",
    Array.from(cleanedTextContent).map((c) => c.charCodeAt(0))
  );
  console.log("Text content has newlines:", /\r|\n/.test(cleanedTextContent));

  if (!cleanedTextContent || cleanedTextContent.length === 0) {
    console.log("Text content is empty after cleaning");
    return null;
  }

  // Ensure we have at least some visible content
  if (cleanedTextContent.trim().length === 0) {
    console.log("Text content is only whitespace after cleaning");
    return null;
  }

  // Detect all font properties from the span
  const fontProperties = detectFontProperties(span as HTMLSpanElement);

  // Debug: Log detected font properties
  console.log("Detected font properties:", {
    originalText: textContent,
    cleanedText: cleanedTextContent,
    fontFamily: fontProperties.fontFamily,
    fontSize: fontProperties.fontSize,
    isBold: fontProperties.isBold,
    isItalic: fontProperties.isItalic,
    isUnderline: fontProperties.isUnderline,
    color: fontProperties.color,
    textAlign: fontProperties.textAlign,
    letterSpacing: fontProperties.letterSpacing,
    lineHeight: fontProperties.lineHeight,
  });

  // Use the detected font size, but ensure it's not too small
  // The font size from computed style is already in screen pixels, so we need to convert to PDF coordinates
  const fontSize = Math.max(8, fontProperties.fontSize / scale);
  console.log("Font size calculation:", {
    originalFontSize: fontProperties.fontSize,
    scale: scale,
    calculatedFontSize: fontSize,
  });

  const { width, height } = measureText(
    cleanedTextContent,
    fontSize,
    fontProperties.fontFamily,
    fontProperties.letterSpacing
  );

  // Ensure minimum dimensions for the text field
  const minWidth = Math.max(pageWidth, width || 50);
  const minHeight = Math.max(pageHeight, height || 20);

  // Final validation to ensure we have valid text content
  const finalTextContent =
    cleanedTextContent && cleanedTextContent.trim()
      ? cleanedTextContent
      : "Text";

  // Create text field with proper positioning and font properties
  const initialProperties = {
    value: finalTextContent,
    fontSize: fontSize,
    fontFamily: fontProperties.fontFamily,
    color: fontProperties.color,
    bold: fontProperties.isBold,
    italic: fontProperties.isItalic,
    underline: fontProperties.isUnderline,
    textAlign: fontProperties.textAlign as
      | "left"
      | "center"
      | "right"
      | "justify",
    letterSpacing: fontProperties.letterSpacing,
    lineHeight: fontProperties.lineHeight,
    width: minWidth,
    height: minHeight,
  };

  const textFieldId = addTextBox(
    pageX,
    pageY,
    currentPage,
    currentView,
    undefined,
    initialProperties
  );

  // Create deletion rectangle to cover the original text
  addDeletionRectangle(
    pageX,
    pageY,
    pageWidth,
    pageHeight,
    currentPage,
    currentView,
    pdfBackgroundColor,
    erasureOpacity
  );

  console.log("Created text field:", {
    id: textFieldId,
    value: finalTextContent,
    valueLength: finalTextContent.length,
    valueBytes: new TextEncoder().encode(finalTextContent),
    valueCharacterCodes: Array.from(finalTextContent).map((c) =>
      c.charCodeAt(0)
    ),
    hasNewlines: /\r|\n/.test(finalTextContent),
    fontSize: fontSize,
    fontFamily: fontProperties.fontFamily,
    color: fontProperties.color,
    bold: fontProperties.isBold,
    italic: fontProperties.isItalic,
    underline: fontProperties.isUnderline,
    textAlign: fontProperties.textAlign,
    letterSpacing: fontProperties.letterSpacing,
    lineHeight: fontProperties.lineHeight,
    width: minWidth,
    height: minHeight,
  });

  // Return the text field ID and properties for updating (though they should already be set)
  return {
    textFieldId,
    properties: initialProperties,
  };
};

// Create a deletion rectangle for a span element
export const createDeletionRectangleForSpan = (
  span: HTMLElement,
  pdfPageEl: HTMLElement,
  currentPage: number,
  currentView: "original" | "translated",
  scale: number,
  addDeletionRectangle: (
    x: number,
    y: number,
    width: number,
    height: number,
    currentPage: number,
    currentView: "original" | "translated",
    background: string,
    opacity?: number
  ) => string,
  pdfBackgroundColor: string,
  erasureOpacity: number
): string => {
  if (!pdfPageEl) {
    console.log("PDF page element not provided");
    return "";
  }
  const spanRect = span.getBoundingClientRect();
  const pageRect = pdfPageEl.getBoundingClientRect();
  const pageWidth = spanRect.width / scale;
  const pageHeight = spanRect.height / scale;
  const pageX = (spanRect.left - pageRect.left) / scale;
  const pageY = (spanRect.top - pageRect.top) / scale;
  return addDeletionRectangle(
    pageX,
    pageY,
    pageWidth,
    pageHeight,
    currentPage,
    currentView,
    pdfBackgroundColor,
    erasureOpacity
  );
};
