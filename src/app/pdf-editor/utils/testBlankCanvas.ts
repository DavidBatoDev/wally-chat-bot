import { generateBlankCanvas } from "./pdfUtils";

/**
 * Test function to verify blank canvas generation works correctly
 */
export async function testBlankCanvas() {
  console.log("Testing blank canvas generation...");

  try {
    // Test with different dimensions
    const testDimensions = [
      { width: 800, height: 600 },
      { width: 595, height: 842 }, // A4
      { width: 1200, height: 800 },
    ];

    for (const { width, height } of testDimensions) {
      console.log(`Testing canvas generation: ${width}x${height}`);

      const canvas = await generateBlankCanvas(width, height);
      console.log(`Canvas generated successfully:`, {
        size: canvas.size,
        type: canvas.type,
        dimensions: `${width}x${height}`,
      });

      // Verify it's a valid blob
      if (canvas instanceof Blob && canvas.size > 0) {
        console.log("✅ Canvas blob is valid");
      } else {
        console.error("❌ Canvas blob is invalid");
      }
    }

    console.log("Blank canvas generation test completed successfully");
  } catch (error) {
    console.error("Blank canvas generation test failed:", error);
  }
}
