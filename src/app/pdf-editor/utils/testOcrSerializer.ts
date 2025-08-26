import {
  serializeOcrResponse,
  getTextBoxesForPage,
  getAllTextBoxes,
} from "./ocrResponseSerializer";

// Sample OCR response data (from the user's example)
const sampleOcrResponse = {
  success: true,
  data: {
    projectId: "c9f7b6ce-396f-4cf9-b37b-a3eaf67c6d56",
    totalPages: 1,
    totalViews: 1,
    processedPages: 1,
    results: [
      {
        pageNumber: 1,
        viewType: "original",
        ocrResult: {
          styled_layout: {
            document_info: {
              total_pages: 1,
              mime_type: "application/pdf",
              page_width: 288,
              page_height: 432,
            },
            pages: [
              {
                page_number: 1,
                text: "8:05\n<\niyo hahanapan\n12 JAN 2023 AT 13:09\ngood morning\n12 JAN 2023 AT 14:27\n12 JAN 2023 AT 15:05\n12 JAN 2023 AT 17:30\niyo wait pajan ako\nkaka uli ko lang\n35\nNaga kana?\nSi charger daa\n",
                entities: [
                  {
                    type: "MessengerTextBox",
                    text: "iyo hahanapan",
                    confidence: 0.9853746294975281,
                    id: "8",
                    bounding_poly: {
                      vertices: [
                        { x: 0.22184300422668457, y: 0.26505494117736816 },
                        { x: 0.4266211688518524, y: 0.26505494117736816 },
                        { x: 0.4266211688518524, y: 0.2887912094593048 },
                        { x: 0.22184300422668457, y: 0.2887912094593048 },
                      ],
                    },
                    styling: {
                      font_size: 5.4,
                      font_family: "Helvetica",
                      colors: {
                        fill_color: { r: 0, g: 0, b: 0 },
                        stroke_color: { r: 0, g: 0, b: 0 },
                        background_color: { r: 0.95, g: 0.95, b: 0.95, a: 0.5 },
                        border_color: { r: 0.7, g: 0.7, b: 0.7 },
                      },
                      text_alignment: "left",
                      line_spacing: 1.2,
                      line_height: 3.7740678977966304,
                      text_padding: 3.24,
                      text_lines: ["iyo hahanapan"],
                      line_count: 1,
                      background: {
                        border_radius: 2.7,
                        expanded_x: 60.650785217285154,
                        expanded_y: 111.26373458862305,
                        expanded_width: 65.45611141204834,
                        expanded_height: 16.73406789779663,
                      },
                    },
                    dimensions: {
                      box_width: 58.97611141204834,
                      box_height: 10.25406789779663,
                      box_x: 63.890785217285156,
                      box_y: 114.50373458862305,
                      text_y: 118.27780248641967,
                      coordinates: {
                        x1: 63.890785217285156,
                        y1: 114.50373458862305,
                        x2: 122.8668966293335,
                        y2: 114.50373458862305,
                        x3: 122.8668966293335,
                        y3: 124.75780248641968,
                        x4: 63.890785217285156,
                        y4: 124.75780248641968,
                      },
                    },
                  },
                  {
                    type: "chat_time",
                    text: "12 JAN 2023 AT 13:09",
                    confidence: 0.999929666519165,
                    id: "2",
                    bounding_poly: {
                      vertices: [
                        { x: 0.3731513023376465, y: 0.33714285492897034 },
                        { x: 0.6331058144569397, y: 0.33714285492897034 },
                        { x: 0.6331058144569397, y: 0.35164836049079895 },
                        { x: 0.3731513023376465, y: 0.35164836049079895 },
                      ],
                    },
                    styling: {
                      font_size: 5.4,
                      font_family: "Helvetica",
                      colors: {
                        fill_color: { r: 0.5, g: 0.5, b: 0.5 },
                        stroke_color: { r: 0, g: 0, b: 0 },
                        background_color: null,
                        border_color: null,
                      },
                      text_alignment: "center",
                      line_spacing: 1.2,
                      line_height: 0.8663784027099606,
                      text_padding: 2.7,
                      text_lines: ["12 JAN 2023 AT 13:09"],
                      line_count: 1,
                    },
                    dimensions: {
                      box_width: 74.86689949035645,
                      box_height: 6.266378402709961,
                      box_x: 107.46757507324219,
                      box_y: 145.64571332931519,
                      text_y: 146.51209173202514,
                      coordinates: {
                        x1: 107.46757507324219,
                        y1: 145.64571332931519,
                        x2: 182.33447456359863,
                        y2: 145.64571332931519,
                        x3: 182.33447456359863,
                        y3: 151.91209173202515,
                        x4: 107.46757507324219,
                        y4: 151.91209173202515,
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
        captureInfo: {
          width: 288,
          height: 432,
          imageSize: 36978,
        },
      },
    ],
    errors: [],
    startTime: "2025-08-21T13:39:14.182Z",
    endTime: "2025-08-21T13:39:41.331Z",
    duration: 27149,
    successRate: 100,
  },
};

/**
 * Test function to demonstrate the OCR response serializer
 */
export function testOcrSerializer() {
  console.log("🧪 Testing OCR Response Serializer...");

  try {
    // Serialize the OCR response
    const { textBoxesByPage, pageDimensions, totalTextBoxes } =
      serializeOcrResponse(sampleOcrResponse);

    console.log(`✅ Successfully serialized ${totalTextBoxes} textboxes`);
    console.log(`📄 Pages processed: ${pageDimensions.size}`);

    // Get textboxes for page 1, original view
    const page1TextBoxes = getTextBoxesForPage(textBoxesByPage, 1, "original");
    console.log(`📝 Page 1 (original): ${page1TextBoxes.length} textboxes`);

    // Log details of each textbox
    page1TextBoxes.forEach((textBox, index) => {
      console.log(`\n📦 TextBox ${index + 1}:`);
      console.log(`   - Text: "${textBox.value}"`);
      console.log(`   - Type: ${textBox.type}`);
      console.log(`   - Position: (${textBox.x}, ${textBox.y})`);
      console.log(`   - Size: ${textBox.width} x ${textBox.height}`);
      console.log(`   - Font: ${textBox.fontSize}px ${textBox.fontFamily}`);
      console.log(`   - Color: ${textBox.color}`);
      console.log(
        `   - Background: ${textBox.backgroundColor} (${textBox.backgroundOpacity})`
      );
      console.log(
        `   - Border: ${textBox.borderColor} ${textBox.borderWidth}px`
      );
      console.log(`   - Alignment: ${textBox.textAlign}`);
    });

    // Get all textboxes across all pages
    const allTextBoxes = getAllTextBoxes(textBoxesByPage);
    console.log(
      `\n🎯 Total textboxes across all pages: ${allTextBoxes.length}`
    );

    return {
      success: true,
      textBoxesByPage,
      pageDimensions,
      totalTextBoxes,
      page1TextBoxes,
    };
  } catch (error) {
    console.error("❌ Error testing OCR serializer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Export the sample data for testing
export { sampleOcrResponse };

