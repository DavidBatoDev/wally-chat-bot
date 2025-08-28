# OCR Service Setup - Simplified Configuration

## Overview

The OCR system has been simplified to directly call your backend OCR service without requiring API keys or external service URLs.

## Required Environment Variables

Only **one** environment variable is needed:

```bash
NEXT_PUBLIC_OCR_CAPTURE_SERVICE_URL=http://localhost:3001
```

## What Was Removed

- ❌ `NEXT_PUBLIC_OCR_API_URL` - No longer needed
- ❌ `NEXT_PUBLIC_OCR_API_KEY` - No longer needed
- ❌ External API authentication - Direct backend calls

## How It Works Now

### 1. **Frontend** → **OCR Service**

- User triggers OCR in PDFEditorContent
- OCR service calls Puppeteer service

### 2. **Puppeteer Service** → **Your Backend**

- Puppeteer navigates to `http://localhost:3000/capture-project/[projectId]` (with actual project ID)
- Captures images from the capture-project page (which renders all project pages)
- Sends images directly to `http://localhost:8000/process-file`
- No authentication required

### 3. **Backend** → **Frontend**

- Your `ocr_service.py` processes the images
- Returns OCR results (layout data, styled PDF, etc.)
- Results flow back to frontend

## Service URLs

| Service                  | URL                                                 | Purpose               |
| ------------------------ | --------------------------------------------------- | --------------------- |
| **Puppeteer Service**    | `http://localhost:3001`                             | Captures DOM content  |
| **Capture Project Page** | `http://localhost:3000/capture-project/[projectId]` | Renders project pages |
| **Your Backend OCR**     | `http://localhost:8000/projects/process-file`       | Processes images      |
| **Frontend**             | `http://localhost:3000`                             | User interface        |

## ✅ **Recent Fixes**

### **Fixed Capture URL Issue**

- **Problem**: Puppeteer was navigating to `http://localhost:3000/capture-project/` (without project ID)
- **Solution**: Updated OCR service to include project ID in capture URL
- **Result**: Puppeteer now correctly navigates to `http://localhost:3000/capture-project/[actual-project-id]`

### **Updated Files**

- ✅ `client/src/app/pdf-editor/services/ocrService.ts` - Fixed capture URL generation
- ✅ `client/src/app/pdf-editor/PDFEditorContent.tsx` - Added project ID to OCR calls
- ✅ `client/backend/puppeteer/server.js` - Enhanced debugging for better troubleshooting

## Benefits of Simplified Setup

✅ **No API Keys**: Direct communication between services  
✅ **Fewer Config Variables**: Only one environment variable needed  
✅ **Better Security**: No external API keys exposed  
✅ **Faster Processing**: Direct network calls  
✅ **Easier Debugging**: Clear data flow

## Testing the Setup

1. **Start your backend**: `cd client/backend && python -m uvicorn src.main:app --reload --port 8000`
2. **Start Puppeteer service**: `cd client/backend/puppeteer && node server.js`
3. **Start frontend**: `cd client && npm run dev`
4. **Test OCR**: Use the OCR functionality in your PDF editor

## Troubleshooting

- **Puppeteer service not responding**: Check if it's running on port 3001
- **OCR processing fails**: Verify your backend is running on port 8000
- **Images not captured**: Ensure capture-project page is accessible

The system is now much simpler and more secure!
