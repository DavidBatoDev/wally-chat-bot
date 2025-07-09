export interface TextField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  fontSize: number;
  fontFamily: string;
  page: number;
  rotation?: number;
  // Text formatting properties
  // headingType?: "normal" | "h1" | "h2" | "h3" | "h4";
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  listType?: "none" | "ordered" | "unordered";
  // Spacing and layout
  lineHeight?: number;
  letterSpacing?: number;
  // Border and background
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  borderRadius?: number;
  // Padding
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  // State
  isEditing?: boolean;
}

// Alias for backward compatibility
export type TextBox = TextField;
