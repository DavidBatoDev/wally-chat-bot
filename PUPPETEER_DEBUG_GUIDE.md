# Puppeteer Service Debug Guide - Real-Time Monitoring

## 🚀 Enhanced Debugging Features

Your Puppeteer service now includes comprehensive real-time debugging with:

- **Timestamps** for every operation
- **Progress tracking** with percentages
- **Detailed step-by-step logging**
- **Performance metrics** (duration tracking)
- **Real-time status endpoints**
- **Comprehensive error reporting**

## 📊 Debug Endpoints

### 1. **Health Check** - Basic Service Status

```bash
GET http://localhost:3001/health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "browser": "initialized"
}
```

### 2. **Service Status** - Detailed Service Info

```bash
GET http://localhost:3001/status
```

**Response:**

```json
{
  "service": "OCR Capture Service",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "browser": {
    "isConnected": true,
    "process": "running"
  },
  "endpoints": [
    "POST /capture-and-ocr",
    "GET /health",
    "GET /status",
    "GET /debug"
  ],
  "uptime": 3600.5,
  "memory": { "rss": 123456789, "heapTotal": 98765432, "heapUsed": 45678901 }
}
```

### 3. **Debug Info** - Comprehensive System Status

```bash
GET http://localhost:3001/debug
```

**Response:**

```json
{
  "service": "OCR Capture Service Debug Info",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "browser": {
    "initialized": true,
    "isConnected": true,
    "processRunning": "running",
    "pages": "active"
  },
  "system": {
    "uptime": 3600.5,
    "memory": { "rss": 123456789, "heapTotal": 98765432, "heapUsed": 45678901 },
    "platform": "win32",
    "nodeVersion": "v18.17.0",
    "pid": 12345
  },
  "environment": {
    "port": 3001,
    "nodeEnv": "development",
    "puppeteerArgs": "configured"
  }
}
```

## 🔍 Real-Time Console Output

When you run an OCR capture, you'll see detailed real-time output like this:

```
🚀 [2024-01-15T10:30:00.000Z] Starting OCR capture session
📋 Request Details:
   Project ID: project-123
   Capture URL: http://localhost:3000/capture-project/project-123
   Page Numbers: 1,2,3
   View Types: original,translated
   OCR API URL: http://localhost:8000/projects/process-file
   Project Data: ✅ Provided

📊 Processing Summary:
   Total Pages: 3
   Total Views: 2
   Total Operations: 6

🌐 [2024-01-15T10:30:01.000Z] Creating new Puppeteer page...
✅ Puppeteer page created successfully

🖥️  [2024-01-15T10:30:01.500Z] Setting viewport and navigating...
   Viewport: 1920x1080 with 2x device scale factor
✅ Viewport set successfully
   Navigating to: http://localhost:3000/capture-project/project-123
✅ Navigation completed successfully

⏳ [2024-01-15T10:30:02.000Z] Waiting for content to load...
   Waiting 3 seconds for initial render...
   Looking for .document-wrapper selector...
✅ Document wrapper found and loaded

🔄 [2024-01-15T10:30:05.000Z] Starting page capture and OCR processing...

📄 [2024-01-15T10:30:05.100Z] Operation 1/6: Page 1, View original
   Progress: 17%
      🔍 [2024-01-15T10:30:05.200Z] Starting page capture...
      ⏳ Waiting for page element with data-page-number="1"...
      ✅ Page element found successfully
      📏 Getting page dimensions...
      📐 Page dimensions: 800x1000
      🖼️  Capturing page image...
      🎯 Using dom-to-image for capture...
      ✅ Page capture completed in 150ms
      🖼️  Image buffer size: 245760 bytes
   ✅ Page capture successful
   📏 Dimensions: 800x1000
   🖼️  Image size: 245760 bytes
   📤 Sending to OCR service...
      📤 [2024-01-15T10:30:05.400Z] Preparing OCR service request...
      📎 File prepared: page-1-original.png
      📏 Dimensions added: 800x1000
      🌐 Sending to OCR service: http://localhost:8000/process-file
      📊 Request details:
         - Image size: 245760 bytes
         - Page dimensions: 800x1000
         - Project ID: project-123
         - Page number: 1
         - View type: original
      ✅ OCR service response received in 2500ms
      📡 Response status: 200
      📋 Response data keys: [extracted_text, layout_data, styled_pdf]
      📊 OCR Results Summary:
         - Extracted text: 1250 characters
         - Layout entities: 15 found
         - Styled PDF: ✅ Available
   ✅ OCR processing successful (2650ms)
   📊 Results summary:
      - Extracted text elements: 15
      - Styled PDF: ✅ Available

📄 [2024-01-15T10:30:08.000Z] Operation 2/6: Page 1, View translated
   Progress: 33%
   ... (similar detailed output for each operation)

🔒 [2024-01-15T10:30:20.000Z] Closing Puppeteer page...
✅ Puppeteer page closed successfully

🏁 [2024-01-15T10:30:20.500Z] OCR capture session completed
📈 Final Results:
   Total Duration: 20500ms (21s)
   Successful Operations: 6/6
   Failed Operations: 0/6
   Success Rate: 100%

📤 Sending response to client...
✅ Response sent successfully
```

## 🛠️ Troubleshooting with Debug Output

### **Common Issues & Debug Clues:**

#### 1. **Page Element Not Found**

```
❌ Page element not found
```

**Solution:** Check if capture-project page is accessible and rendering correctly

#### 2. **Navigation Timeout**

```
❌ Navigation failed: timeout
```

**Solution:** Verify capture URL is correct and page loads within 60 seconds

#### 3. **OCR Service Errors**

```
❌ OCR service error after 2500ms: Connection refused
```

**Solution:** Ensure your backend OCR service is running on port 8000

#### 4. **Browser Issues**

```
❌ Failed to initialize Puppeteer browser
```

**Solution:** Check system resources and Puppeteer installation

## 📱 Monitoring Dashboard

You can create a simple monitoring dashboard by polling the debug endpoints:

```javascript
// Example monitoring script
setInterval(async () => {
  try {
    const response = await fetch("http://localhost:3001/debug");
    const status = await response.json();

    console.log(`Service Status: ${status.browser.isConnected ? "🟢" : "🔴"}`);
    console.log(
      `Memory Usage: ${Math.round(
        status.system.memory.heapUsed / 1024 / 1024
      )}MB`
    );
    console.log(`Uptime: ${Math.round(status.system.uptime / 60)} minutes`);
  } catch (error) {
    console.log("❌ Service monitoring failed:", error.message);
  }
}, 5000); // Check every 5 seconds
```

## 🚨 Error Handling

The service now provides detailed error information:

- **Operation-level errors** with timing
- **OCR service errors** with response details
- **Browser errors** with stack traces
- **Network errors** with status codes

## 📈 Performance Metrics

Track performance in real-time:

- **Individual operation timing**
- **Total session duration**
- **Success rates**
- **Memory usage**
- **Browser performance**

## 🔧 Debug Configuration

To enable even more detailed logging, you can set environment variables:

```bash
# Enable verbose Puppeteer logging
DEBUG=puppeteer:*

# Enable Node.js debugging
NODE_OPTIONS="--inspect=0.0.0.0:9229"

# Enable detailed HTTP logging
DEBUG=axios:*
```

Your Puppeteer service is now a comprehensive debugging powerhouse! 🚀
