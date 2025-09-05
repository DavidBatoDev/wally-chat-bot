import { TextField, DeletionRectangle } from "../types/pdf-editor.types";
import { measureText } from "./measurements";

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

  // Get text alignment with fallbacks (span → parents → classes/inline)
  const normalizeAlign = (align: string | null, dir: string | null) => {
    const a = (align || "").toLowerCase();
    const d = (dir || "ltr").toLowerCase();
    if (a === "start") return d === "rtl" ? "right" : "left";
    if (a === "end") return d === "rtl" ? "left" : "right";
    if (a === "center" || a === "right" || a === "left" || a === "justify")
      return a;
    return "left";
  };

  let textAlign = normalizeAlign(
    computedStyle.textAlign,
    computedStyle.direction
  );

  // If still left, look up the DOM tree for a stronger alignment
  if (textAlign === "left") {
    let parentAlignEl: HTMLElement | null = span.parentElement;
    let level = 0;
    while (parentAlignEl && parentAlignEl !== document.body && level < 5) {
      const ps = window.getComputedStyle(parentAlignEl);
      const pa = normalizeAlign(ps.textAlign, ps.direction);
      if (pa === "center" || pa === "right" || pa === "justify") {
        textAlign = pa;
        break;
      }
      parentAlignEl = parentAlignEl.parentElement;
      level++;
    }
  }

  // Heuristics: classes and inline styles commonly used by UIs
  if (textAlign === "left") {
    const styleAttr = span.getAttribute("style") || "";
    const classes = Array.from(span.classList).map((c) => c.toLowerCase());
    if (
      /(text-align\s*:\s*center)/i.test(styleAttr) ||
      classes.some(
        (c) =>
          c.includes("text-center") ||
          c.includes("align-center") ||
          c === "center"
      )
    ) {
      textAlign = "center";
    } else if (
      /(text-align\s*:\s*right)/i.test(styleAttr) ||
      classes.some(
        (c) =>
          c.includes("text-right") || c.includes("align-right") || c === "right"
      )
    ) {
      textAlign = "right";
    } else if (
      /(text-align\s*:\s*justify)/i.test(styleAttr) ||
      classes.some(
        (c) =>
          c.includes("text-justify") ||
          c.includes("align-justify") ||
          c === "justify"
      )
    ) {
      textAlign = "justify";
    }
  }

  // Get letter spacing (character spacing)
  const letterSpacing = parseFloat(computedStyle.letterSpacing) || 0;

  // Get line height - always return 1.2
  const lineHeight = 1.2;

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
  currentView: "original" | "translated" | "split" | "final-layout",
  scale: number,
  pageWidth: number,
  addTextBox: (
    x: number,
    y: number,
    currentPage: number,
    currentView: "original" | "translated" | "final-layout",
    targetView?: "original" | "translated" | "final-layout",
    initialProperties?: any
  ) => string,
  addDeletionRectangle: (
    x: number,
    y: number,
    width: number,
    height: number,
    currentPage: number,
    currentView: "original" | "translated" | "final-layout",
    background: string,
    opacity?: number
  ) => string,
  pdfBackgroundColor: string,
  erasureOpacity: number,
  getTranslatedTemplateScaleFactor?: (pageNumber: number) => number
): { textFieldId: string; properties: any } | null => {
  // Determine which view the span belongs to based on its position
  let targetView: "original" | "translated" | "final-layout" = "original";
  if (currentView === "split") {
    const spanRect = span.getBoundingClientRect();
    const pdfViewer = document.querySelector("[data-pdf-viewer]");

    if (pdfViewer) {
      const viewerRect = pdfViewer.getBoundingClientRect();
      const spanCenterX = spanRect.left + spanRect.width / 2;
      const clickX = spanCenterX - viewerRect.left;

      // Use the same logic as document mouse handlers
      const singleDocWidth = pageWidth * scale;
      const gap = 20;

      if (clickX > singleDocWidth + gap) {
        targetView = "translated";
      } else if (clickX <= singleDocWidth) {
        targetView = "original";
      } else {
        // Span is in the gap - default to original
        targetView = "original";
      }
    }
  } else if (currentView === "final-layout") {
    targetView = "final-layout";
  } else {
    targetView = currentView as "original" | "translated";
  }
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

  // Calculate coordinates at current scale
  let pageX = spanRect.left - pageRect.left;
  let pageY = spanRect.top - pageRect.top;
  let spanWidth = spanRect.width;
  let spanHeight = spanRect.height;

  // Convert all coordinates and dimensions to 100% scale (scale = 1.0)
  // This ensures textbox and deletion rectangles are always accurate regardless of zoom level
  pageX = pageX / scale;
  pageY = pageY / scale;
  spanWidth = spanWidth / scale;
  spanHeight = spanHeight / scale;

  // Adjust coordinates for split view when span is in translated view
  if (currentView === "split" && targetView === "translated") {
    // In split view, the translated document is positioned to the right of the original
    // At 100% scale, each document has width = pageWidth, with a 20px gap between them
    const singleDocWidth = pageWidth; // Width of one document at 100% scale
    const gap = 20 / scale; // Gap adjusted to 100% scale

    // Adjust X coordinate to account for the translated document position
    pageX = pageX - singleDocWidth - gap;

    // Apply template scaling factor to coordinates when template is scaled in split view
    if (getTranslatedTemplateScaleFactor) {
      const templateScaleFactor = getTranslatedTemplateScaleFactor(currentPage);
      if (templateScaleFactor && templateScaleFactor !== 1) {
        pageX = pageX / templateScaleFactor;
        pageY = pageY / templateScaleFactor;
      }
    }
  }

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

  // Normalize font size to document coordinate space (100% scale)
  // Then dynamically fit it to the span's normalized box so it's not oversized
  let fontSize = Math.max(6, fontProperties.fontSize / scale);
  let measured = measureText(
    cleanedTextContent,
    fontSize,
    fontProperties.fontFamily,
    fontProperties.letterSpacing
  );
  // Compute scale factors to fit within span bounds
  const widthScale = measured.width > 0 ? spanWidth / measured.width : 1;
  const heightScale = measured.height > 0 ? spanHeight / measured.height : 1;
  const fitScale = Math.min(1, widthScale, heightScale);
  if (fitScale > 0 && fitScale !== 1) {
    fontSize = Math.max(6, fontSize * fitScale);
    measured = measureText(
      cleanedTextContent,
      fontSize,
      fontProperties.fontFamily,
      fontProperties.letterSpacing
    );
  }
  console.log("Font size calculation:", {
    originalDetectedFontSize: fontProperties.fontSize,
    currentScale: scale,
    widthScale,
    heightScale,
    appliedScale: fitScale,
    normalizedFontSize: fontSize,
  });

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
    // Use the span's normalized dimensions so textbox aligns with deletion rectangle
    width: spanWidth,
    height: spanHeight,
  };

  const textFieldId = addTextBox(
    pageX,
    pageY,
    currentPage,
    targetView,
    targetView,
    initialProperties
  );

  // Create deletion rectangle to cover the original text
  addDeletionRectangle(
    pageX,
    pageY,
    spanWidth,
    spanHeight,
    currentPage,
    targetView,
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
    width: spanWidth,
    height: spanHeight,
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
  currentView: "original" | "translated" | "split" | "final-layout",
  scale: number,
  pageWidth: number,
  addDeletionRectangle: (
    x: number,
    y: number,
    width: number,
    height: number,
    currentPage: number,
    currentView: "original" | "translated" | "final-layout",
    background: string,
    opacity?: number
  ) => string,
  pdfBackgroundColor: string,
  erasureOpacity: number,
  getTranslatedTemplateScaleFactor?: (pageNumber: number) => number
): string => {
  if (!pdfPageEl) {
    console.log("PDF page element not provided");
    return "";
  }

  // Determine which view the span belongs to based on its position
  let targetView: "original" | "translated" | "final-layout" = "original";
  if (currentView === "split") {
    const spanRect = span.getBoundingClientRect();
    const pdfViewer = document.querySelector("[data-pdf-viewer]");

    if (pdfViewer) {
      const viewerRect = pdfViewer.getBoundingClientRect();
      const spanCenterX = spanRect.left + spanRect.width / 2;
      const clickX = spanCenterX - viewerRect.left;

      // Use the same logic as document mouse handlers
      const singleDocWidth = pageWidth * scale;
      const gap = 20;

      if (clickX > singleDocWidth + gap) {
        targetView = "translated";
      } else if (clickX <= singleDocWidth) {
        targetView = "original";
      } else {
        // Span is in the gap - default to original
        targetView = "original";
      }
    }
  } else if (currentView === "final-layout") {
    targetView = "final-layout";
  } else {
    targetView = currentView as "original" | "translated";
  }

  const spanRect = span.getBoundingClientRect();
  const pageRect = pdfPageEl.getBoundingClientRect();

  // Calculate coordinates at current scale
  let pageX = spanRect.left - pageRect.left;
  let pageY = spanRect.top - pageRect.top;
  let spanWidth = spanRect.width;
  let spanHeight = spanRect.height;

  // Convert all coordinates and dimensions to 100% scale (scale = 1.0)
  // This ensures deletion rectangles are always accurate regardless of zoom level
  pageX = pageX / scale;
  pageY = pageY / scale;
  spanWidth = spanWidth / scale;
  spanHeight = spanHeight / scale;

  // Adjust coordinates for split view when span is in translated view
  if (currentView === "split" && targetView === "translated") {
    // In split view, the translated document is positioned to the right of the original
    // At 100% scale, each document has width = pageWidth, with a 20px gap between them
    const singleDocWidth = pageWidth; // Width of one document at 100% scale
    const gap = 20 / scale; // Gap adjusted to 100% scale

    // Adjust X coordinate to account for the translated document position
    pageX = pageX - singleDocWidth - gap;

    // Apply template scaling factor to coordinates when template is scaled in split view
    if (getTranslatedTemplateScaleFactor) {
      const templateScaleFactor = getTranslatedTemplateScaleFactor(currentPage);
      if (templateScaleFactor && templateScaleFactor !== 1) {
        pageX = pageX / templateScaleFactor;
        pageY = pageY / templateScaleFactor;
      }
    }
  }

  return addDeletionRectangle(
    pageX,
    pageY,
    spanWidth,
    spanHeight,
    currentPage,
    targetView,
    pdfBackgroundColor,
    erasureOpacity
  );
};
