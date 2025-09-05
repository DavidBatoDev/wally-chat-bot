# Puppeteer Page Capture API

This API provides endpoints for capturing screenshots of web pages using Puppeteer, specifically designed to capture all non-deleted pages in both original and translated views for the PDF editor.

## New Endpoint: `/capture-all-pages`

### Purpose

Captures all non-deleted pages of a document in both original and translated views using Puppeteer for high-quality, consistent screenshots.

### Method

`POST /capture-all-pages`

### Request Body

```json
{
  "projectId": "string (required)",
  "captureUrl": "string (required)",
  "quality": "number (optional, default: 1.0)",
  "waitTime": "number (optional, default: 2000)",
  "projectData": "object (optional)"
}
```

#### Parameters:

- **projectId** (required): Unique identifier for the project
- **captureUrl** (required): URL of the page to capture (e.g., `https://wally-frontend-523614903618.us-central1.run.app/capture-project/project-id`)
- **quality** (optional): Device scale factor for high-quality captures (1.0 = normal, 2.0 = high quality)
- **waitTime** (optional): Milliseconds to wait between page transitions (default: 2000)
- **projectData** (optional): Additional project data if needed

### Response Format

#### Success Response

```json
{
  "success": true,
  "data": {
    "projectId": "string",
    "totalPages": "number",
    "nonDeletedPages": ["array of page numbers"],
    "deletedPages": ["array of deleted page numbers"],
    "captures": [
      {
        "pageNumber": "number",
        "viewType": "original|translated",
        "imageData": "base64 data URL",
        "timestamp": "ISO string",
        "pageType": "social_media|birth_cert|nbi_clearance|apostille|dynamic_content",
        "isTranslated": "boolean"
      }
    ],
    "summary": {
      "totalPagesProcessed": "number",
      "totalCaptures": "number",
      "totalErrors": "number",
      "processingTime": "number (milliseconds)"
    }
  },
  "timestamp": "ISO string"
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "ISO string"
}
```

### How It Works

1. **Page Navigation**: Navigates to the provided capture URL
2. **Project State Detection**: Attempts to extract project state from the page to determine:
   - Total number of pages
   - Which pages are deleted
   - Page metadata
3. **DOM Fallback**: If project state is not available, falls back to DOM inspection
4. **View Switching**: For each non-deleted page:
   - Switches to "original" view and captures screenshot
   - Switches to "translated" view and captures screenshot
5. **Screenshot Capture**: Uses Puppeteer's high-quality screenshot functionality
6. **Error Handling**: Gracefully handles individual page failures while continuing with others

### Integration with Frontend

The frontend service `pageCaptureService.ts` provides:

- **captureAllPages()**: Direct API call
- **captureCurrentProjectPages()**: Simplified call using current project context
- **convertCapturedPagesToSnapshots()**: Converts API response to legacy format
- **downloadCapturedPages()**: Download individual images
- **downloadCapturedPagesAsZip()**: Download as ZIP file
- **checkPuppeteerServiceHealth()**: Health check utility

### Usage Examples

#### Basic Usage

```javascript
import { captureCurrentProjectPages } from "./services/pageCaptureService";

const result = await captureCurrentProjectPages("project-123", {
  quality: 2.0,
  waitTime: 3000,
});

console.log(`Captured ${result.data.summary.totalCaptures} pages`);
```

#### With Custom URL

```javascript
import { captureAllPages } from "./services/pageCaptureService";

const result = await captureAllPages({
  projectId: "project-123",
  captureUrl:
    "https://wally-frontend-523614903618.us-central1.run.app/capture-project/project-123",
  quality: 1.5,
  waitTime: 2500,
});
```

### Testing

Run the test script to verify API functionality:

```bash
cd client/backend/puppeteer
node test-api.js
```

The test script checks:

- Service health and status
- Invalid request handling
- Basic page capture functionality
- Error handling

### Error Handling

Common error scenarios:

- **Service Unavailable**: Puppeteer service not running
- **Invalid URL**: Capture URL cannot be accessed
- **Missing Parameters**: Required fields not provided
- **Browser Issues**: Puppeteer browser crashes or becomes unresponsive
- **Page Load Failures**: Target page fails to load or render
- **DOM Element Issues**: Required page elements not found

### Performance Considerations

- High-quality captures (`quality: 2.0`) take longer but produce better results
- Each page view requires separate navigation and rendering
- Total time ≈ `(number_of_pages × 2 × waitTime) + navigation_overhead`
- Large projects with many pages may take several minutes

### Browser Requirements

- Chrome/Chromium browser installed
- Sufficient memory for page rendering
- Network access to target URLs

### Configuration

Environment variables:

- `OCR_CAPTURE_PORT`: Service port (default: 3001)
- `NEXT_PUBLIC_OCR_CAPTURE_SERVICE_URL`: Frontend service URL

### Troubleshooting

1. **Service won't start**: Check if port 3001 is available
2. **Capture failures**: Verify target URL is accessible
3. **Browser crashes**: Increase system memory, reduce quality setting
4. **Slow performance**: Reduce `waitTime`, lower `quality` setting
5. **Empty captures**: Check if page elements have correct selectors

### Migration from Legacy System

Replacing `captureAllPageSnapshots()`:

**Before:**

```javascript
const snapshots = await captureAllPageSnapshots({
  documentRef,
  documentState,
  pageState,
  setViewState,
  setDocumentState,
  setEditorState,
  editorState,
  progressCallback,
});
```

**After:**

```javascript
const result = await captureCurrentProjectPages(projectId);
const snapshots = convertCapturedPagesToSnapshots(result.data.captures);
```

Key improvements:

- ✅ Consistent cross-browser rendering
- ✅ Higher quality screenshots
- ✅ Better error handling
- ✅ No DOM manipulation conflicts
- ✅ Scalable architecture
- ✅ Independent service deployment
