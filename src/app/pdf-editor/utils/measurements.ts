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
  maxWidth?: number
): { width: number; height: number } => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return { width: 100, height: fontSize };

  context.font = `${fontSize}px ${fontFamily}`;

  // Split text into lines
  const lines = text.split("\n");
  let maxLineWidth = 0;
  let totalHeight = 0;
  const lineHeight = fontSize * 1.2; // Line height for multi-line text

  for (const line of lines) {
    const metrics = context.measureText(line);
    const lineWidth =
      metrics.width + characterSpacing * Math.max(0, line.length - 1);
    maxLineWidth = Math.max(maxLineWidth, lineWidth);
    totalHeight += lineHeight;
  }

  // If maxWidth is provided, don't exceed it
  const finalWidth = maxWidth ? Math.min(maxLineWidth, maxWidth) : maxLineWidth;
  const finalHeight = Math.max(totalHeight, fontSize * 1.1); // Ensure minimum height

  return { width: finalWidth, height: finalHeight };
};

export const measureWrappedTextHeight = (
  text: string,
  fontSize: number,
  fontFamily: string,
  width: number
): number => {
  // Create a hidden textarea for accurate measurement
  const textarea = document.createElement("textarea");
  textarea.style.position = "absolute";
  textarea.style.visibility = "hidden";
  textarea.style.height = "auto";
  textarea.style.width = `${width}px`;
  textarea.style.fontSize = `${fontSize}px`;
  textarea.style.fontFamily = fontFamily;
  textarea.style.lineHeight = "normal";
  textarea.style.whiteSpace = "pre-wrap";
  textarea.style.wordBreak = "break-word";
  textarea.value = text;

  document.body.appendChild(textarea);
  const height = textarea.scrollHeight;
  document.body.removeChild(textarea);

  return height;
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
