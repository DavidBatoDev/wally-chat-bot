# Puppeteer OCR Capture Service

A Node.js service that captures web pages using Puppeteer and processes them through the existing OCR service.

## Overview

This service is designed to work with the Wally chatbot system to:

1. Capture specific pages from web applications (like the PDF editor)
2. Send captured images to the existing OCR service for processing
3. Return structured OCR results for further processing

## Features

- **Page Capture**: Captures specific pages from web applications using Puppeteer
- **OCR Integration**: Integrates with existing FastAPI OCR service (`/process-file` endpoint)
- **Multi-page Support**: Processes multiple pages in a single request
- **View Type Support**: Captures both "original" and "translated" views
- **Error Handling**: Comprehensive error handling and logging
- **Type Safety**: Robust parameter validation and type conversion

## Prerequisites

- Node.js 16+ and npm
- FastAPI backend running on port 8000 with OCR service
- Chrome/Chromium browser (for Puppeteer)

## Installation

```bash
cd client/backend/puppeteer
npm install
```

## Configuration

The service runs on port 3001 by default. You can change this by setting the `OCR_CAPTURE_PORT` environment variable.

## Usage

### Starting the Service

```bash
# Development mode with nodemon
npm run dev

# Production mode
npm start

# Or directly with node
node server.js
```

### API Endpoints

#### POST `/capture-and-ocr`

Captures web pages and processes them through OCR.

**Request Body:**

```json
{
  "projectId": "uuid-string",
  "captureUrl": "http://localhost:3000/capture-project/project-id",
  "pageNumbers": [1, 2, 3, 4, 5],
  "viewTypes": ["original", "translated"],
  "ocrApiUrl": "http://localhost:8000/process-file", // Optional, defaults to this
  "ocrApiKey": "optional-api-key",
  "projectData": "file-upload-data"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "projectId": "uuid-string",
    "totalPages": 5,
    "totalViews": 2,
    "processedPages": 10,
    "results": [
      {
        "pageNumber": 1,
        "viewType": "original",
        "ocrResult": {
          /* OCR service response */
        },
        "captureInfo": {
          "width": 1920,
          "height": 1080,
          "imageSize": 12345
        },
        "extractedText": [
          /* OCR entities */
        ],
        "styledPdf": "base64-string-or-null"
      }
    ],
    "errors": [],
    "startTime": "2024-12-19T10:00:00.000Z",
    "endTime": "2024-12-19T10:01:00.000Z",
    "duration": 60000
  }
}
```

#### GET `/health`

Health check endpoint.

#### GET `/status`

Service status and information.

## Integration with OCR Service

The Puppeteer service automatically integrates with the existing FastAPI OCR service:

1. **Image Capture**: Captures web pages as images using Puppeteer
2. **Image Processing**: Sends images to `/process-file` endpoint
3. **OCR Processing**: OCR service processes images using Google Document AI
4. **Result Return**: Returns structured OCR data and styled PDFs

## Error Handling

The service includes comprehensive error handling:

- **Parameter Validation**: Validates all required parameters
- **Type Conversion**: Handles different input formats gracefully
- **OCR Service Errors**: Captures and reports OCR service errors
- **Puppeteer Errors**: Handles browser and page capture errors
- **Network Errors**: Manages timeouts and connection issues

## Testing

### Test Parsing Logic

```bash
node test_parsing.js
```

### Test OCR Integration

```bash
node test_ocr_integration.js
```

## Troubleshooting

### Common Issues

1. **Browser Initialization Failed**

   - Ensure Chrome/Chromium is installed
   - Check system resources
   - Verify Puppeteer installation

2. **OCR Service Connection Failed**

   - Ensure FastAPI backend is running on port 8000
   - Check `/process-file` endpoint availability
   - Verify network connectivity

3. **Page Capture Failed**
   - Check if target URL is accessible
   - Verify page elements exist (`.document-wrapper`)
   - Check page load timeouts

### Logs

The service provides detailed logging for debugging:

- Request parameters and types
- Page capture progress
- OCR service communication
- Error details and stack traces

## Development

### Adding New Features

1. **New Capture Methods**: Extend `capturePageView()` function
2. **Additional OCR Options**: Modify `sendToOcrService()` parameters
3. **New View Types**: Update view type handling logic

### Code Structure

- `server.js`: Main service file with Express server and Puppeteer logic
- `test_parsing.js`: Tests for parameter parsing logic
- `test_ocr_integration.js`: Tests for OCR service integration
- `CHANGELOG.md`: Change history and documentation

## License

Part of the Wally chatbot project.
