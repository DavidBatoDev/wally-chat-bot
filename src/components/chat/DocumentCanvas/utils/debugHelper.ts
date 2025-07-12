import { TemplateMapping, WorkflowField } from '../types/workflow';

export interface DebugInfo {
  fieldKey: string;
  textValue: string;
  mapping: TemplateMapping;
  viewPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pdfPosition: {
    x: number;
    y: number;
    fontSize: number;
  };
  fontInfo: {
    name: string;
    size: number;
    textWidth?: number;
  };
}

/**
 * Creates debug information for text positioning analysis
 */
export function createDebugInfo(
  fieldKey: string,
  textValue: string,
  mapping: TemplateMapping,
  pdfPosition: { x: number; y: number; fontSize: number },
  fontName: string,
  textWidth?: number
): DebugInfo {
  const { x0, y0, x1, y1 } = mapping.position;
  
  return {
    fieldKey,
    textValue,
    mapping,
    viewPosition: {
      x: x0,
      y: y0,
      width: x1 - x0,
      height: y1 - y0
    },
    pdfPosition,
    fontInfo: {
      name: fontName,
      size: mapping.font.size || 12,
      textWidth
    }
  };
}

/**
 * Logs comprehensive debug information for text positioning
 */
export function logDebugInfo(debugInfo: DebugInfo): void {
  console.group(`🔍 Debug Info: ${debugInfo.fieldKey}`);
  console.log('📝 Text Value:', debugInfo.textValue);
  console.log('📐 View Position:', debugInfo.viewPosition);
  console.log('📄 PDF Position:', debugInfo.pdfPosition);
  console.log('🔤 Font Info:', debugInfo.fontInfo);
  console.log('📊 Mapping:', debugInfo.mapping);
  console.groupEnd();
}

/**
 * Compares view and PDF positions to identify discrepancies
 * Note: This is a simplified analysis since we're comparing different coordinate systems
 */
export function analyzePositionDifference(debugInfo: DebugInfo): {
  horizontalDiff: number;
  verticalDiff: number;
  analysis: string;
} {
  const { viewPosition, pdfPosition } = debugInfo;
  
  // Calculate expected center positions in view coordinates
  const viewCenterX = viewPosition.x + viewPosition.width / 2;
  const viewCenterY = viewPosition.y + viewPosition.height / 2;
  
  // For horizontal comparison - this should be fairly accurate
  const horizontalDiff = Math.abs(pdfPosition.x - viewCenterX);
  
  // For vertical comparison - this is more complex due to coordinate system transformation
  // We'll report the difference but note that some offset is expected due to coordinate conversion
  const verticalDiff = Math.abs(pdfPosition.y - viewCenterY);
  
  let analysis = '';
  
  // Horizontal positioning should be quite accurate
  if (horizontalDiff > 15) {
    analysis += `⚠️ Horizontal offset: ${horizontalDiff.toFixed(1)}px. `;
  }
  
  // Vertical positioning will show differences due to coordinate transformation
  // We'll be more lenient here and focus on extreme outliers
  if (verticalDiff > 100) {
    analysis += `⚠️ Large vertical offset: ${verticalDiff.toFixed(1)}px (coordinate system difference). `;
  }
  
  if (horizontalDiff <= 15 && verticalDiff <= 100) {
    analysis = '✅ Positioning within acceptable range!';
  }
  
  // Add a note about coordinate system differences
  if (analysis.includes('vertical offset')) {
    analysis += 'Note: Vertical differences are expected due to coordinate system transformation.';
  }
  
  return {
    horizontalDiff,
    verticalDiff,
    analysis
  };
}

/**
 * Validates field data consistency
 */
export function validateFieldData(
  mappings: Record<string, TemplateMapping>,
  fields: Record<string, WorkflowField>,
  isTranslatedView: boolean = false
): {
  valid: boolean;
  issues: string[];
  summary: string;
} {
  const issues: string[] = [];
  
  // Check for mappings without corresponding fields
  for (const [key, mapping] of Object.entries(mappings)) {
    if (!mapping) {
      issues.push(`❌ Mapping ${key} is null/undefined`);
      continue;
    }
    
    if (!fields[key]) {
      issues.push(`❌ Field ${key} missing from fields data`);
      continue;
    }
    
    const field = fields[key];
    const value = isTranslatedView ? field.translated_value : field.value;
    
    if (!value || value.trim() === '') {
      issues.push(`⚠️ Field ${key} has empty value`);
    }
    
    // Validate mapping structure
    if (!mapping.position || typeof mapping.position.x0 !== 'number') {
      issues.push(`❌ Field ${key} has invalid position data`);
    }
    
    if (!mapping.font || typeof mapping.font.size !== 'number') {
      issues.push(`❌ Field ${key} has invalid font data`);
    }
  }
  
  const valid = issues.length === 0;
  const summary = valid 
    ? `✅ All ${Object.keys(mappings).length} fields validated successfully`
    : `❌ Found ${issues.length} issues in field validation`;
  
  return { valid, issues, summary };
}

/**
 * Creates a summary report of the PDF generation process
 */
export function createGenerationReport(
  debugInfos: DebugInfo[],
  fontName: string,
  isTranslatedView: boolean
): string {
  const successful = debugInfos.filter(info => info.textValue.trim() !== '').length;
  const skipped = debugInfos.length - successful;
  
  let report = `
📊 PDF Generation Report
========================
🎯 View: ${isTranslatedView ? 'Translated Template' : 'Template'}
🔤 Font: ${fontName}
📄 Total Fields: ${debugInfos.length}
✅ Processed: ${successful}
⏭️ Skipped (Empty): ${skipped}

📐 Position Analysis:
`;

  debugInfos.forEach(info => {
    if (info.textValue.trim() !== '') {
      const analysis = analyzePositionDifference(info);
      report += `  • ${info.fieldKey}: ${analysis.analysis}\n`;
    }
  });

  return report;
} 