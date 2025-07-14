// Utility functions for text and element measurements

export const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const measureText = (
  text: string,
  fontSize: number,
  fontFamily: string,
  characterSpacing: number = 0,
  maxWidth?: number,
  padding?: { top?: number; right?: number; bottom?: number; left?: number }
): { width: number; height: number } => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return { width: 100, height: fontSize };

  context.font = `${fontSize}px ${fontFamily}`;

  // Split text into lines
  const lines = text.split("\n");
  let maxLineWidth = 0;
  let totalHeight = 0;
  const lineHeight = fontSize * 1.1; // Use 1.1 line height to match DocumentCanvas

  for (const line of lines) {
    const metrics = context.measureText(line);
    const lineWidth =
      metrics.width + characterSpacing * Math.max(0, line.length - 1);
    maxLineWidth = Math.max(maxLineWidth, lineWidth);
    totalHeight += lineHeight;
  }

  // If maxWidth is provided, calculate wrapped height using the same method as measureWrappedTextHeight
  if (maxWidth) {
    // Account for padding by reducing the available width for text
    const paddingLeft = padding?.left || 0;
    const paddingRight = padding?.right || 0;
    const availableWidth = maxWidth - paddingLeft - paddingRight;

    // Check if it's single line text
    if (lines.length === 1 && !text.includes("\n")) {
      // For single line, check if it fits within the available width
      // If text fits within available width, return single line height
      if (maxLineWidth <= availableWidth) {
        return { width: maxWidth, height: fontSize * 1.1 }; // Exactly one line height
      }
    }

    // If multi-line or single line exceeds available width, use textarea measurement
    const textarea = document.createElement("textarea");
    textarea.style.position = "absolute";
    textarea.style.visibility = "hidden";
    textarea.style.height = "auto";
    textarea.style.width = `${availableWidth}px`;
    textarea.style.fontSize = `${fontSize}px`;
    textarea.style.fontFamily = fontFamily;
    textarea.style.lineHeight = "1.1"; // Match the actual textarea lineHeight
    textarea.style.whiteSpace = "pre-wrap";
    textarea.style.wordWrap = "break-word";
    textarea.style.wordBreak = "break-word";
    textarea.style.padding = "0px";
    textarea.style.overflow = "hidden";
    textarea.value = text;

    document.body.appendChild(textarea);
    const wrappedHeight = textarea.scrollHeight;
    document.body.removeChild(textarea);

    return { width: maxWidth, height: Math.max(wrappedHeight, fontSize * 1.1) };
  }

  const finalWidth = maxLineWidth;
  const finalHeight = Math.max(totalHeight, fontSize); // Ensure minimum height is at least font size (not forcing 2 lines)

  return { width: finalWidth, height: finalHeight };
};

export const measureWrappedTextHeight = (
  text: string,
  fontSize: number,
  fontFamily: string,
  width: number,
  padding?: { top?: number; right?: number; bottom?: number; left?: number }
): number => {
  // Account for padding by reducing the available width for text
  const paddingLeft = padding?.left || 0;
  const paddingRight = padding?.right || 0;
  const availableWidth = width - paddingLeft - paddingRight;

  // Check if it's single line text
  const lines = text.split("\n");
  if (lines.length === 1 && !text.includes("\n")) {
    // For single line, check if it fits within the available width
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      context.font = `${fontSize}px ${fontFamily}`;
      const textWidth = context.measureText(text).width;

      // If text fits within available width, return single line height
      if (textWidth <= availableWidth) {
        return fontSize * 1.1; // Exactly one line height
      }
    }
  }

  // If multi-line or single line exceeds available width, use textarea measurement
  const textarea = document.createElement("textarea");
  textarea.style.position = "absolute";
  textarea.style.visibility = "hidden";
  textarea.style.height = "auto";
  textarea.style.width = `${availableWidth}px`;
  textarea.style.fontSize = `${fontSize}px`;
  textarea.style.fontFamily = fontFamily;
  textarea.style.lineHeight = "1.1"; // Match the actual textarea lineHeight
  textarea.style.whiteSpace = "pre-wrap";
  textarea.style.wordWrap = "break-word";
  textarea.style.wordBreak = "break-word";
  textarea.style.padding = "0px";
  textarea.style.overflow = "hidden";
  textarea.value = text;

  document.body.appendChild(textarea);
  const height = textarea.scrollHeight;
  document.body.removeChild(textarea);

  return Math.max(height, fontSize * 1.1);
};

export const getCleanExtension = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split(".").pop()?.toLowerCase() || "";
    return extension;
  } catch {
    return url.split(".").pop()?.toLowerCase() || "";
  }
};

export const getFileType = (url: string): "pdf" | "image" => {
  const extension = getCleanExtension(url);
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
  return imageExtensions.includes(extension) ? "image" : "pdf";
};

export const isPdfFile = (url: string): boolean => {
  return getFileType(url) === "pdf";
};

export const isImageFile = (url: string): boolean => {
  return getFileType(url) === "image";
};
