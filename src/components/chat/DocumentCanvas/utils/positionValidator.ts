import { TemplateMapping } from '../types/workflow';

export interface ValidationResult {
  isAccurate: boolean;
  horizontalError: number;
  verticalError: number;
  recommendations: string[];
}

/**
 * Validates text positioning accuracy by comparing expected vs actual positions
 */
export function validateTextPositioning(
  mapping: TemplateMapping,
  actualPdfPosition: { x: number; y: number },
  pdfPageHeight: number,
  textValue: string,
  fontSize: number
): ValidationResult {
  const { x0, y0, x1, y1 } = mapping.position;
  const boxWidth = x1 - x0;
  const boxHeight = y1 - y0;
  
  // Calculate expected center positions
  const expectedCenterX = x0 + boxWidth / 2;
  const expectedCenterY = y0 + boxHeight / 2;
  
  // For PDF coordinates, convert expected center to PDF coordinate system
  const expectedPdfCenterY = pdfPageHeight - expectedCenterY;
  
  // Calculate errors
  const horizontalError = Math.abs(actualPdfPosition.x - expectedCenterX);
  const verticalError = Math.abs(actualPdfPosition.y - expectedPdfCenterY);
  
  // Determine accuracy thresholds
  const horizontalThreshold = Math.max(5, boxWidth * 0.1); // 10% of box width or 5px minimum
  const verticalThreshold = Math.max(5, boxHeight * 0.1); // 10% of box height or 5px minimum
  
  const isHorizontalAccurate = horizontalError <= horizontalThreshold;
  const isVerticalAccurate = verticalError <= verticalThreshold;
  const isAccurate = isHorizontalAccurate && isVerticalAccurate;
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (!isHorizontalAccurate) {
    if (actualPdfPosition.x < expectedCenterX - horizontalThreshold) {
      recommendations.push('Text is positioned too far left - increase X coordinate');
    } else if (actualPdfPosition.x > expectedCenterX + horizontalThreshold) {
      recommendations.push('Text is positioned too far right - decrease X coordinate');
    }
  }
  
  if (!isVerticalAccurate) {
    if (actualPdfPosition.y < expectedPdfCenterY - verticalThreshold) {
      recommendations.push('Text is positioned too low - increase Y coordinate');
    } else if (actualPdfPosition.y > expectedPdfCenterY + verticalThreshold) {
      recommendations.push('Text is positioned too high - decrease Y coordinate');
    }
  }
  
  if (isAccurate) {
    recommendations.push('✅ Text positioning is accurate!');
  }
  
  return {
    isAccurate,
    horizontalError,
    verticalError,
    recommendations
  };
}

/**
 * Creates a visual debugging overlay for positioning validation
 */
export function createPositionDebugInfo(
  fieldKey: string,
  mapping: TemplateMapping,
  actualPosition: { x: number; y: number; fontSize: number },
  pdfPageHeight: number,
  textValue: string
): string {
  const validation = validateTextPositioning(
    mapping,
    actualPosition,
    pdfPageHeight,
    textValue,
    actualPosition.fontSize
  );
  
  const { x0, y0, x1, y1 } = mapping.position;
  const boxWidth = x1 - x0;
  const boxHeight = y1 - y0;
  
  return `
🔍 Position Debug: ${fieldKey}
═══════════════════════════════════
📝 Text: "${textValue}"
📐 Box: ${boxWidth.toFixed(1)}×${boxHeight.toFixed(1)} at (${x0.toFixed(1)}, ${y0.toFixed(1)})
📍 PDF Position: (${actualPosition.x.toFixed(1)}, ${actualPosition.y.toFixed(1)})
📊 Accuracy: ${validation.isAccurate ? '✅ GOOD' : '❌ NEEDS ADJUSTMENT'}
📏 Errors: H=${validation.horizontalError.toFixed(1)}px, V=${validation.verticalError.toFixed(1)}px
💡 Recommendations:
${validation.recommendations.map(r => `   • ${r}`).join('\n')}
`;
}

/**
 * Batch validation for multiple fields
 */
export function validateMultipleFields(
  mappings: Record<string, TemplateMapping>,
  actualPositions: Record<string, { x: number; y: number; fontSize: number }>,
  fieldValues: Record<string, string>,
  pdfPageHeight: number
): {
  overallAccuracy: number;
  accurateFields: string[];
  inaccurateFields: string[];
  summary: string;
} {
  const results: Array<{ fieldKey: string; isAccurate: boolean }> = [];
  
  for (const [fieldKey, mapping] of Object.entries(mappings)) {
    if (!actualPositions[fieldKey] || !fieldValues[fieldKey]) continue;
    
    const validation = validateTextPositioning(
      mapping,
      actualPositions[fieldKey],
      pdfPageHeight,
      fieldValues[fieldKey],
      actualPositions[fieldKey].fontSize
    );
    
    results.push({ fieldKey, isAccurate: validation.isAccurate });
  }
  
  const accurateFields = results.filter(r => r.isAccurate).map(r => r.fieldKey);
  const inaccurateFields = results.filter(r => !r.isAccurate).map(r => r.fieldKey);
  const overallAccuracy = results.length > 0 ? (accurateFields.length / results.length) * 100 : 0;
  
  const summary = `
📊 Positioning Validation Summary
═══════════════════════════════════
🎯 Overall Accuracy: ${overallAccuracy.toFixed(1)}%
✅ Accurate Fields: ${accurateFields.length}/${results.length}
❌ Needs Adjustment: ${inaccurateFields.length}/${results.length}

${inaccurateFields.length > 0 ? `
🔧 Fields needing adjustment:
${inaccurateFields.map(f => `   • ${f}`).join('\n')}
` : '🎉 All fields are positioned accurately!'}
`;
  
  return {
    overallAccuracy,
    accurateFields,
    inaccurateFields,
    summary
  };
} 