import { Entity } from "../types/TemplateMapping";

interface TextDimensions {
  width: number;
  height: number;
  expandedWidth: number;
  expandedHeight: number;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates text dimensions based on font properties and content
 */
export const calculateTextDimensions = (
  text: string,
  fontSize: number,
  fontName: string,
  padding: number,
  leading: number
): TextDimensions => {
  // Create a temporary canvas for text measurements
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Set font properties
  ctx.font = `${fontSize}px ${fontName}`;

  // Calculate text metrics
  const metrics = ctx.measureText(text);
  const actualWidth = metrics.width;
  const actualHeight =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

  // Calculate expanded dimensions with padding
  const expandedWidth = actualWidth + padding * 2;
  const expandedHeight = actualHeight + padding * 2;

  return {
    width: actualWidth,
    height: actualHeight,
    expandedWidth,
    expandedHeight,
  };
};

/**
 * Converts relative coordinates to absolute pixel values
 */
export const convertToAbsoluteCoordinates = (
  vertices: { x: number; y: number }[],
  pageWidth: number,
  pageHeight: number
): BoundingBox => {
  const [topLeft, topRight, bottomRight, bottomLeft] = vertices;

  // Convert relative coordinates to absolute pixels
  const x = topLeft.x * pageWidth;
  const y = topLeft.y * pageHeight;
  const width = (topRight.x - topLeft.x) * pageWidth;
  const height = (bottomLeft.y - topLeft.y) * pageHeight;

  return { x, y, width, height };
};

/**
 * Processes chat message entities to calculate their layout properties
 */
export const processChatMessageLayout = (
  entity: Entity,
  pageWidth: number,
  pageHeight: number
) => {
  const { text, style, bounding_poly } = entity;
  const {
    font_size,
    font_name,
    padding,
    leading,
    background_color,
    text_color,
    border_color,
    border_radius,
    has_border,
    alignment,
  } = style;

  // Calculate text dimensions
  const dimensions = calculateTextDimensions(
    text,
    font_size,
    font_name,
    padding,
    leading
  );

  // Get absolute coordinates
  const boundingBox = convertToAbsoluteCoordinates(
    bounding_poly.vertices,
    pageWidth,
    pageHeight
  );

  // Return processed layout properties
  return {
    ...boundingBox,
    style: {
      fontSize: `${font_size}px`,
      fontFamily: font_name,
      padding: `${padding}px`,
      lineHeight: `${leading}px`,
      backgroundColor: background_color
        ? `rgb(${background_color.join(",")})`
        : "transparent",
      color: text_color ? `rgb(${text_color.join(",")})` : "#000",
      borderColor: border_color
        ? `rgb(${border_color.join(",")})`
        : "transparent",
      borderRadius: `${border_radius}px`,
      border: has_border ? "1px solid" : "none",
      textAlign: alignment,
      width: dimensions.expandedWidth,
      height: dimensions.expandedHeight,
      position: "absolute",
      left: boundingBox.x,
      top: boundingBox.y,
      display: "flex",
      alignItems: "center",
      justifyContent: alignment === "center" ? "center" : "flex-start",
    },
    dimensions,
    text,
  };
};

/**
 * Processes an array of entities to generate chat bubble layouts
 */
export const processPageEntities = (
  entities: Entity[],
  pageWidth: number,
  pageHeight: number
) => {
  return entities.map((entity) =>
    processChatMessageLayout(entity, pageWidth, pageHeight)
  );
};
