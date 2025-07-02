// client/src/components/chat/DocumentCanvas/types/workflow.ts
export interface TemplateMappingFont {
  name: string;
  size: number;
  color: string;
}

export interface TemplateMappingPosition {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TemplateMappingBboxCenter {
  x: number;
  y: number;
}

export interface TemplateMapping {
  label: string;
  font: TemplateMappingFont;
  position: TemplateMappingPosition;
  bbox_center: TemplateMappingBboxCenter;
  alignment: string;
  page_number: number;
}

export type WorkflowFieldStatus = "ocr" | "pending" | "edited" | "confirmed";
export type TranslatedFieldStatus =
  | "pending"
  | "translated"
  | "completed"
  | "edited";

export interface WorkflowField {
  value: string;
  value_status: WorkflowFieldStatus;
  translated_value: string | null;
  translated_status: TranslatedFieldStatus;
  isCustomField?: boolean;
}

export interface WorkflowData {
  file_id: string;
  base_file_public_url?: string;
  template_id: string;
  template_file_public_url?: string;
  origin_template_mappings?: Record<string, TemplateMapping>;
  fields?: Record<string, WorkflowField>;
  template_translated_id: string;
  template_translated_file_public_url?: string;
  translated_template_mappings?: Record<string, TemplateMapping>;
  translate_to: string;
  translate_from: string;
  shapes?: any[];
  deletion_rectangles?: any[];
}

export type ViewType = "original" | "template" | "translated_template";
