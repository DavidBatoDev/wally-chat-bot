# OCR Response Serializer

This utility transforms the backend OCR response into properly formatted textbox elements that can be used in the frontend.

## Problem

The backend returns OCR results with detailed styling and dimension information, but the frontend wasn't properly transforming these into the expected textbox elements. The textboxes were not being created with the correct styling, dimensions, and positioning.

## Solution

The `ocrResponseSerializer.ts` utility provides functions to:

1. **Parse the OCR response structure** - Handle the new styled layout format
2. **Convert OCR entities to TextField objects** - Transform backend data to frontend format
3. **Organize textboxes by page and view type** - Support multiple pages and views
4. **Preserve all styling information** - Colors, fonts, borders, positioning, etc.

## Usage

### Basic Serialization

```typescript
import {
  serializeOcrResponse,
  getTextBoxesForPage,
} from "./ocrResponseSerializer";

// After receiving OCR response from backend
const ocrResponse = await performPageOcr(options);

// Serialize the response
const { textBoxesByPage, pageDimensions, totalTextBoxes } =
  serializeOcrResponse(ocrResponse);

console.log(`Created ${totalTextBoxes} textboxes across all pages`);
```

### Get TextBoxes for Specific Page

```typescript
// Get textboxes for page 1, original view
const page1TextBoxes = getTextBoxesForPage(textBoxesByPage, 1, "original");

// Get textboxes for page 1, translated view
const page1TranslatedTextBoxes = getTextBoxesForPage(
  textBoxesByPage,
  1,
  "translated"
);
```

### Access All TextBoxes

```typescript
import { getAllTextBoxes } from "./ocrResponseSerializer";

// Get all textboxes across all pages and views
const allTextBoxes = getAllTextBoxes(textBoxesByPage);
```

## OCR Response Structure

The serializer expects this structure from the backend:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "pageNumber": 1,
        "viewType": "original",
        "ocrResult": {
          "styled_layout": {
            "pages": [
              {
                "page_number": 1,
                "entities": [
                  {
                    "type": "MessengerTextBox",
                    "text": "Sample text",
                    "dimensions": {
                      "box_x": 100,
                      "box_y": 200,
                      "box_width": 150,
                      "box_height": 50
                    },
                    "styling": {
                      "font_size": 12,
                      "font_family": "Arial",
                      "colors": {
                        "fill_color": { "r": 0, "g": 0, "b": 0 },
                        "background_color": {
                          "r": 0.95,
                          "g": 0.95,
                          "b": 0.95,
                          "a": 0.5
                        }
                      },
                      "text_alignment": "left",
                      "text_padding": 5
                    }
                  }
                ]
              }
            ]
          }
        }
      }
    ]
  }
}
```

## Features

### Automatic Color Conversion

- Converts RGB/RGBA colors to hex format
- Handles transparency and opacity
- Preserves background and border colors

### Styling Preservation

- Font size and family
- Text alignment (left, center, right, justify)
- Background colors with opacity
- Border colors and widths
- Border radius
- Text padding

### Dimension Handling

- Uses exact dimensions from backend
- Preserves positioning (x, y coordinates)
- Maintains width and height

### Type Safety

- Full TypeScript support
- Proper interfaces for all data structures
- Type-safe return values

## Integration with OCR Service

The OCR service now automatically uses this serializer:

```typescript
// In performPageOcr function
const result = await response.json();

// Automatically serialize the response
const { textBoxesByPage, pageDimensions, totalTextBoxes } =
  serializeOcrResponse(result);

// Add serialized data to result for easy access
result.serializedData = {
  textBoxesByPage,
  pageDimensions,
  totalTextBoxes,
};
```

## Backward Compatibility

The existing `convertEntitiesToTextBoxes` function now automatically detects the format and delegates to the appropriate serializer:

- **New styled layout format** → Uses `serializeOcrEntities`
- **Template-OCR format** → Uses legacy conversion logic

## Example Output

After serialization, you get properly formatted TextField objects:

```typescript
{
  id: "uuid-here",
  x: 63.89,
  y: 114.50,
  width: 58.98,
  height: 10.25,
  value: "iyo hahanapan",
  type: "MessengerTextBox",
  fontSize: 5.4,
  fontFamily: "Helvetica",
  color: "#000000",
  backgroundColor: "#f2f2f2",
  backgroundOpacity: 0.5,
  borderColor: "#b3b3b3",
  borderWidth: 1,
  borderRadius: 2.7,
  textAlign: "left",
  paddingTop: 3.24,
  paddingRight: 3.24,
  paddingBottom: 3.24,
  paddingLeft: 3.24,
  page: 1
}
```

## Benefits

1. **Proper TextBox Creation** - Textboxes now appear with correct styling and positioning
2. **Structured Organization** - Textboxes organized by page and view type
3. **Complete Styling** - All visual properties preserved from backend
4. **Type Safety** - Full TypeScript support with proper interfaces
5. **Easy Integration** - Simple API that works with existing code
6. **Backward Compatible** - Doesn't break existing functionality
