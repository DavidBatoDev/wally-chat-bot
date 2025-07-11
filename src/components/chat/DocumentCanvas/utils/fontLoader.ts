import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export interface FontLoadResult {
  primaryFont: PDFFont;
  fallbackFont: PDFFont;
  success: boolean;
  fontName: string;
}

/**
 * Loads fonts for PDF generation with Unicode support and fallback handling
 */
export async function loadFontsForPdf(pdfDoc: PDFDocument): Promise<FontLoadResult> {
  // Register fontkit for Unicode support
  pdfDoc.registerFontkit(fontkit);
  
  let primaryFont: PDFFont;
  let fallbackFont: PDFFont;
  let success = false;
  let fontName = 'Helvetica (Standard)';
  
  try {
    // Try to load custom font with Unicode support
    const fontResponse = await fetch('/fonts/NotoSans-Regular.ttf');
    if (fontResponse.ok) {
      const fontBytes = await fontResponse.arrayBuffer();
      primaryFont = await pdfDoc.embedFont(fontBytes);
      fallbackFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      success = true;
      fontName = 'NotoSans-Regular (Custom)';
      console.log('Custom font loaded successfully for PDF generation');
    } else {
      throw new Error(`Font fetch failed: ${fontResponse.status}`);
    }
  } catch (fontError) {
    console.warn('Failed to load custom font, using standard font:', fontError);
    // Fallback to standard fonts
    primaryFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fallbackFont = primaryFont;
    success = false;
    fontName = 'Helvetica (Fallback)';
  }
  
  return {
    primaryFont,
    fallbackFont,
    success,
    fontName
  };
}

/**
 * Alternative font paths to try if the primary font fails
 */
export const FONT_FALLBACK_PATHS = [
  '/fonts/NotoSans-Regular.ttf',
  '/NotoSans-Regular.ttf',
  // Add more font paths as needed
];

/**
 * Enhanced font loader with multiple fallback attempts
 */
export async function loadFontsWithFallbacks(pdfDoc: PDFDocument): Promise<FontLoadResult> {
  pdfDoc.registerFontkit(fontkit);
  
  // Initialize with standard font as default
  let primaryFont: PDFFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let fallbackFont: PDFFont = primaryFont;
  let success = false;
  let fontName = 'Helvetica (Standard)';
  
  // Try each font path
  for (const fontPath of FONT_FALLBACK_PATHS) {
    try {
      const fontResponse = await fetch(fontPath);
      if (fontResponse.ok) {
        const fontBytes = await fontResponse.arrayBuffer();
        primaryFont = await pdfDoc.embedFont(fontBytes);
        fallbackFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        success = true;
        fontName = `Custom font from ${fontPath}`;
        console.log(`Successfully loaded font from: ${fontPath}`);
        break;
      }
    } catch (error) {
      console.warn(`Failed to load font from ${fontPath}:`, error);
      continue;
    }
  }
  
  // Update font name if we're still using the default
  if (!success) {
    fontName = 'Helvetica (Standard Fallback)';
    console.log('Using standard font as fallback');
  }
  
  return {
    primaryFont,
    fallbackFont,
    success,
    fontName
  };
} 