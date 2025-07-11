import { PDFFont } from 'pdf-lib';
import { TemplateMapping } from '../types/workflow';

export interface TextPositionOptions {
  mapping: TemplateMapping;
  textValue: string;
  font: PDFFont;
  pdfPageHeight: number;
  scale?: number;
  debugMode?: boolean;
}

export interface PositionResult {
  x: number;
  y: number;
  fontSize: number;
}

/**
 * Transforms coordinates from view overlay to PDF positioning with proper text centering
 * This function ensures text appears centered in boxes just like in the CSS overlay
 */
export function transformCoordinatesForPdf(options: TextPositionOptions): PositionResult {
  const { mapping, textValue, font, pdfPageHeight, scale = 1, debugMode = false } = options;
  
  // Extract box dimensions from mapping
  const { x0, y0, x1, y1 } = mapping.position;
  const boxWidth = x1 - x0;
  const boxHeight = y1 - y0;
  const fontSize = mapping.font.size || 12;

  if (debugMode) {
    console.log('PDF Text Positioning Debug:', {
      fieldKey: mapping.label,
      textValue,
      mapping: mapping.position,
      boxDimensions: { width: boxWidth, height: boxHeight },
      fontSize,
      pdfPageHeight,
      scale
    });
  }

  // Calculate horizontal centering
  let x: number;
  try {
    // Use actual text width measurement for precise centering
    const textWidth = font.widthOfTextAtSize(textValue, fontSize);
    x = x0 + (boxWidth - textWidth) / 2;
    
    if (debugMode) {
      console.log('Horizontal centering (precise):', {
        textWidth,
        x0,
        boxWidth,
        calculatedX: x
      });
    }
  } catch (error) {
    // Fallback: approximate text width when measurement fails
    const approximateTextWidth = textValue.length * fontSize * 0.6;
    x = x0 + (boxWidth - approximateTextWidth) / 2;
    
    if (debugMode) {
      console.log('Horizontal centering (fallback):', {
        approximateTextWidth,
        x0,
        boxWidth,
        calculatedX: x,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Calculate vertical centering with font baseline consideration
  // PDF coordinate system: (0,0) is bottom-left, text is drawn from baseline
  // CSS coordinate system: (0,0) is top-left, text is centered in flexbox
  
  // The key insight: we need to position the text baseline so that the text appears
  // visually centered in the box, just like CSS flexbox does
  
  // Step 1: Find the center point of the box in view coordinates
  const boxCenterY = y0 + (boxHeight / 2);
  
  // Step 2: Convert to PDF coordinates (flip Y axis)
  const pdfCenterY = pdfPageHeight - boxCenterY;
  
  // Step 3: Adjust for font baseline to center the text visually
  // Try to get actual font metrics for more accurate positioning
  let fontHeight = fontSize;
  let baselineOffset = fontSize * 0.25;
  
  try {
    // Attempt to get font ascent/descent for more accurate positioning
    // This is a more sophisticated approach but may not always work
    const fontAscent = fontSize * 0.75; // Approximate ascent
    const fontDescent = fontSize * 0.25; // Approximate descent
    fontHeight = fontAscent + fontDescent;
    baselineOffset = fontDescent;
  } catch {
    // Fallback to simple approximation
    fontHeight = fontSize;
    baselineOffset = fontSize * 0.25;
  }
  
  // Final Y position: center the text visually in the box
  // Position the baseline so the text appears centered
  const y = pdfCenterY - (fontHeight / 2) + baselineOffset;

  if (debugMode) {
    console.log('Vertical centering:', {
      y0,
      boxHeight,
      boxCenterY,
      pdfCenterY,
      fontHeight,
      baselineOffset,
      pdfPageHeight,
      calculatedY: y
    });
  }

  return {
    x,
    y,
    fontSize
  };
}

/**
 * Enhanced text drawing function with fallback handling
 */
export function drawTextWithFallback(
  page: any,
  text: string,
  position: PositionResult,
  primaryFont: PDFFont,
  fallbackFont: PDFFont,
  color: any,
  debugMode: boolean = false
): boolean {
  try {
    // Try with primary font first
    page.drawText(text, {
      x: position.x,
      y: position.y,
      size: position.fontSize,
      font: primaryFont,
      color
    });
    
    if (debugMode) {
      console.log('Text drawn successfully with primary font:', {
        text,
        position,
        font: 'primary'
      });
    }
    
    return true;
  } catch (primaryError) {
    if (debugMode) {
      console.warn('Primary font failed, trying fallback:', primaryError instanceof Error ? primaryError.message : String(primaryError));
    }
    
    try {
      // Fallback to standard font
      page.drawText(text, {
        x: position.x,
        y: position.y,
        size: position.fontSize,
        font: fallbackFont,
        color
      });
      
      if (debugMode) {
        console.log('Text drawn successfully with fallback font:', {
          text,
          position,
          font: 'fallback'
        });
      }
      
      return true;
    } catch (fallbackError) {
      if (debugMode) {
        console.error('Both fonts failed:', {
          text,
          position,
          primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
      }
      
      return false;
    }
  }
}

/**
 * Validates that text positioning will be within page bounds
 */
export function validateTextPosition(
  position: PositionResult,
  pageWidth: number,
  pageHeight: number,
  textValue: string,
  debugMode: boolean = false
): boolean {
  const { x, y, fontSize } = position;
  
  // Basic bounds checking
  const isWithinBounds = (
    x >= 0 && 
    x <= pageWidth && 
    y >= 0 && 
    y <= pageHeight
  );
  
  if (debugMode && !isWithinBounds) {
    console.warn('Text position out of bounds:', {
      position,
      pageSize: { width: pageWidth, height: pageHeight },
      textValue
    });
  }
  
  return isWithinBounds;
} 