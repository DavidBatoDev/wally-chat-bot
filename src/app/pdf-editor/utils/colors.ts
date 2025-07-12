// Color utility functions

export const hexToRgba = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0, 0, 0, ${opacity})`;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Function to convert any color format to rgba with opacity
export const colorToRgba = (color: string, opacity: number): string => {
  // Handle hex colors
  if (color.startsWith("#")) {
    return hexToRgba(color, opacity);
  }

  // Handle rgb colors
  if (color.startsWith("rgb(")) {
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  }

  // Handle rgba colors
  if (color.startsWith("rgba(")) {
    const rgbaMatch = color.match(
      /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/
    );
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]);
      const g = parseInt(rgbaMatch[2]);
      const b = parseInt(rgbaMatch[3]);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  }

  // Fallback to black
  return `rgba(0, 0, 0, ${opacity})`;
};

// Function to convert rgb string to hex
export function rgbStringToHex(rgb: string): string {
  const result = rgb.match(/\d+/g);
  if (!result || result.length < 3) return "#000000";
  return (
    "#" +
    (
      (1 << 24) +
      (parseInt(result[0]) << 16) +
      (parseInt(result[1]) << 8) +
      parseInt(result[2])
    )
      .toString(16)
      .slice(1)
  );
}
