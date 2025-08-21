// Textbox optimization utility for OCR-generated textboxes
import { TextField } from "../types/pdf-editor.types";
import { measureText } from "./measurements";

/**
 * Optimizes textbox dimensions using measureText utility
 * This ensures OCR-generated textboxes have appropriate dimensions based on their content
 */
export function optimizeTextboxDimensions(textBox: TextField): TextField {
  try {
    console.log(
      `🔍 [Textbox Optimizer] Optimizing textbox: "${textBox.value}"`
    );
    console.log(`   Original dimensions: ${textBox.width}x${textBox.height}`);
    console.log(`   Font: ${textBox.fontSize}px ${textBox.fontFamily}`);
    console.log(
      `   Padding: ${textBox.paddingTop || 0}px top, ${
        textBox.paddingRight || 0
      }px right, ${textBox.paddingBottom || 0}px bottom, ${
        textBox.paddingLeft || 0
      }px left`
    );

    // Apply measureText utility to calculate optimal dimensions
    const optimizedDimensions = measureText(
      textBox.value,
      textBox.fontSize,
      textBox.fontFamily,
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
      `   Measured dimensions: ${optimizedDimensions.width}x${optimizedDimensions.height}`
    );

    // Calculate final dimensions using the same approach as convertEntitiesToTextBoxes
    // Use measured dimensions as primary, with buffer for better user experience
    const bufferWidth = 20; // Add 20px buffer on each side (same as convertEntitiesToTextBoxes)
    const finalWidth = optimizedDimensions.width + bufferWidth * 2; // Add buffer on both sides
    const finalHeight =
      Math.max(optimizedDimensions.height, textBox.height) +
      (textBox.paddingTop || 0) +
      (textBox.paddingBottom || 0);

    console.log(
      `   Buffer applied: ${
        bufferWidth * 2
      }px total (${bufferWidth}px each side)`
    );
    console.log(`   Final optimized dimensions: ${finalWidth}x${finalHeight}`);

    // Return optimized textbox
    return {
      ...textBox,
      width: finalWidth,
      height: finalHeight,
      hasBeenManuallyResized: false, // Reset since we're optimizing
    };
  } catch (error) {
    console.warn(
      `⚠️ [Textbox Optimizer] Failed to optimize textbox "${textBox.value}":`,
      error
    );
    console.log(
      `   Keeping original dimensions: ${textBox.width}x${textBox.height}`
    );
    return textBox; // Return original if optimization fails
  }
}

/**
 * Optimizes multiple textboxes at once
 */
export function optimizeMultipleTextboxes(textBoxes: TextField[]): TextField[] {
  console.log(
    `🔍 [Textbox Optimizer] Optimizing ${textBoxes.length} textboxes...`
  );

  const optimizedTextBoxes = textBoxes.map((textBox, index) => {
    console.log(
      `   [${index + 1}/${textBoxes.length}] Optimizing textbox: "${
        textBox.value
      }"`
    );
    return optimizeTextboxDimensions(textBox);
  });

  console.log(
    `✅ [Textbox Optimizer] Successfully optimized ${textBoxes.length} textboxes`
  );
  return optimizedTextBoxes;
}

/**
 * Validates that textbox dimensions are reasonable
 * Returns true if dimensions look correct, false if they seem wrong
 */
export function validateTextboxDimensions(textBox: TextField): boolean {
  const { width, height, fontSize, value } = textBox;

  // Basic validation rules
  const minWidth = fontSize * 0.5; // Minimum width should be at least half font size
  const minHeight = fontSize * 0.8; // Minimum height should be at least 80% of font size
  const maxWidth = fontSize * 100; // Maximum width should be reasonable
  const maxHeight = fontSize * 50; // Maximum height should be reasonable

  // Check if dimensions are within reasonable bounds
  const isWidthReasonable = width >= minWidth && width <= maxWidth;
  const isHeightReasonable = height >= minHeight && height <= maxHeight;

  // Check if dimensions are proportional to text length
  // Account for the 20px buffer on each side (same as convertEntitiesToTextBoxes)
  const bufferWidth = 20;
  const expectedMinWidth = value.length * fontSize * 0.6 + bufferWidth * 2; // Rough estimate + buffer
  const isProportional = width >= expectedMinWidth;

  const isValid = isWidthReasonable && isHeightReasonable && isProportional;

  if (!isValid) {
    console.warn(
      `⚠️ [Textbox Optimizer] Textbox dimensions validation failed:`,
      {
        text: value,
        dimensions: `${width}x${height}`,
        fontSize,
        minWidth,
        minHeight,
        maxWidth,
        maxHeight,
        expectedMinWidth,
        isWidthReasonable,
        isHeightReasonable,
        isProportional,
      }
    );
  }

  return isValid;
}

/**
 * Forces textbox dimensions to be at least minimum reasonable values
 */
export function enforceMinimumDimensions(textBox: TextField): TextField {
  const { fontSize, value } = textBox;

  // Calculate minimum reasonable dimensions
  // Account for the 20px buffer on each side (same as convertEntitiesToTextBoxes)
  const bufferWidth = 20;
  const minWidth = Math.max(
    fontSize * 0.5,
    value.length * fontSize * 0.6 + bufferWidth * 2
  );
  const minHeight = fontSize * 1.2; // At least 1.2x font size for height

  // Enforce minimum dimensions
  const enforcedWidth = Math.max(textBox.width, minWidth);
  const enforcedHeight = Math.max(textBox.height, minHeight);

  if (enforcedWidth !== textBox.width || enforcedHeight !== textBox.height) {
    console.log(
      `🔧 [Textbox Optimizer] Enforcing minimum dimensions for "${value}":`,
      {
        original: `${textBox.width}x${textBox.height}`,
        enforced: `${enforcedWidth}x${enforcedHeight}`,
        minWidth,
        minHeight,
      }
    );
  }

  return {
    ...textBox,
    width: enforcedWidth,
    height: enforcedHeight,
  };
}

/**
 * Comprehensive textbox optimization that includes validation and enforcement
 */
export function comprehensivelyOptimizeTextbox(textBox: TextField): TextField {
  console.log(
    `🚀 [Textbox Optimizer] Starting comprehensive optimization for: "${textBox.value}"`
  );

  // Step 1: Basic optimization using measureText
  let optimized = optimizeTextboxDimensions(textBox);

  // Step 2: Validate the optimized dimensions
  if (!validateTextboxDimensions(optimized)) {
    console.log(
      `⚠️ [Textbox Optimizer] Optimization produced invalid dimensions, applying fixes...`
    );

    // Step 3: Enforce minimum dimensions if validation fails
    optimized = enforceMinimumDimensions(optimized);

    // Step 4: Re-validate after fixes
    if (!validateTextboxDimensions(optimized)) {
      console.error(
        `❌ [Textbox Optimizer] Failed to produce valid dimensions for: "${textBox.value}"`
      );
      // Return original with enforced minimums as last resort
      return enforceMinimumDimensions(textBox);
    }
  }

  console.log(
    `✅ [Textbox Optimizer] Comprehensive optimization completed for: "${textBox.value}"`
  );
  return optimized;
}

/**
 * Optimizes textboxes for a specific page and view type
 */
export function optimizeTextboxesForPage(
  textBoxes: TextField[],
  pageNumber: number,
  viewType: string
): TextField[] {
  console.log(
    `🔍 [Textbox Optimizer] Optimizing ${textBoxes.length} textboxes for page ${pageNumber} (${viewType})`
  );

  const optimizedTextBoxes = textBoxes.map((textBox, index) => {
    console.log(
      `   [${index + 1}/${
        textBoxes.length
      }] Page ${pageNumber} (${viewType}): "${textBox.value}"`
    );
    return comprehensivelyOptimizeTextbox(textBox);
  });

  console.log(
    `✅ [Textbox Optimizer] Successfully optimized ${textBoxes.length} textboxes for page ${pageNumber} (${viewType})`
  );
  return optimizedTextBoxes;
}
