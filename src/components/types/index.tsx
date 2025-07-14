export interface Shape {
  id: string;
  type: "circle" | "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  borderColor: string;
  borderWidth: number;
  fillColor: string;
  fillOpacity: number;
  rotation?: number;
  borderRadius?: number; // Add border radius support
  zIndex?: number; // Add z-index support for layering
}

export interface Image {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  src: string;
  rotation?: number;
  opacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  zIndex?: number; // Add z-index support for layering
}

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
  type?: "chat_time" | "MessengerTextBox" | string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: "left" | "center" | "right" | "justify";
  listType?: "none" | "ordered" | "unordered";
  letterSpacing?: number;
  lineHeight?: number;
  rotation?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  isEditing?: boolean;
  hasBeenManuallyResized?: boolean; // Track if user has manually resized this textbox
  zIndex?: number; // Add z-index support for layering
}

// Alias for backward compatibility
export type TextBox = TextField;
