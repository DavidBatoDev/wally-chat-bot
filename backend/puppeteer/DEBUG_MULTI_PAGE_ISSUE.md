# Debug Guide: Multi-Page OCR Issue

## 🚨 **Problem Description**

**Issue**: Only page 1 is getting textboxes during OCR capture, even though the API returns results for all pages.

**Symptoms**:

- API returns 2 pages successfully
- OCR results show both pages captured
- Only 0 textboxes created for page 1
- Page 2 not processed at all

## 🔍 **Debugging Steps**

### 1. **Check Puppeteer Page Navigation**

Look for these log patterns in the Puppeteer service:

```
🧭 Navigating to page 2...
🔍 Page 2 element found: false
⚠️ Page 2 not visible, attempting to navigate...
🖱️ Clicking page navigation for page 2...
📜 Attempting to scroll to page 2...
⌨️ Attempting keyboard navigation to page 2...
```

**Expected**: Page 2 should be found and navigated to successfully
**Issue**: If page 2 element is never found, navigation is failing

### 2. **Check Page Capture Results**

Look for these logs:

```
📄 Operation 1/3: Page 1, View original
   ✅ Page capture successful
   📏 Dimensions: 800x1000
   🖼️ Image size: 50000 bytes

📄 Operation 2/3: Page 2, View original
   ✅ Page capture successful
   📏 Dimensions: 800x1000
   🖼️ Image size: 50000 bytes
```

**Expected**: Both pages should show successful capture
**Issue**: If page 2 capture fails, OCR won't process it

### 3. **Check OCR API Calls**

Look for these logs:

```
📤 Sending to OCR service...
📋 OCR request details: {pageNumber: 1, viewType: "original", imageSize: 50000}
📊 OCR result for page 1: {success: true, hasData: true, error: "None"}

📤 Sending to OCR service...
📋 OCR request details: {pageNumber: 2, viewType: "original", imageSize: 50000}
📊 OCR result for page 2: {success: true, hasData: true, error: "None"}
```

**Expected**: Both pages should be sent to OCR service successfully
**Issue**: If page 2 OCR call fails, no textboxes will be created

### 4. **Check OCR Response Structure**

Look for these logs in the frontend:

```
🔍 [OCR Serializer] Processing page 1: {
  hasOcrResult: true,
  hasStyledLayout: true,
  styledLayoutPages: 2,
  pageNumbers: [1, 2],
  hasEntities: true,
  entityCount: 15
}

🔍 [OCR Serializer] Processing page 2: {
  hasOcrResult: true,
  hasStyledLayout: true,
  styledLayoutPages: 2,
  pageNumbers: [1, 2],
  hasEntities: true,
  entityCount: 12
}
```

**Expected**: Both pages should have entities
**Issue**: If page 2 has no entities, no textboxes will be created

## 🚨 **Common Issues & Solutions**

### **Issue 1: Page Navigation Failing**

**Symptoms**:

- Page 2 element never found
- Navigation strategies all fail
- Only page 1 is visible

**Causes**:

- PDF viewer not properly initialized
- Page elements not loaded in DOM
- CSS selectors not matching

**Solutions**:

1. Increase page loading timeout
2. Check PDF viewer initialization
3. Verify page element selectors

### **Issue 2: Page Capture Failing**

**Symptoms**:

- Page 2 capture returns error
- No image buffer for page 2
- Capture dimensions are 0x0

**Causes**:

- Page not properly rendered
- DOM-to-image library injection failed
- Page element not visible

**Solutions**:

1. Wait longer for page rendering
2. Check DOM-to-image library
3. Verify page visibility

### **Issue 3: OCR API Processing Only First Page**

**Symptoms**:

- Page 2 sent to OCR successfully
- OCR returns success but no data
- Styled layout only contains page 1

**Causes**:

- OCR backend processing issue
- Image format problems
- Backend page handling bug

**Solutions**:

1. Check OCR backend logs
2. Verify image format compatibility
3. Check backend page processing logic

### **Issue 4: Frontend Serialization Issue**

**Symptoms**:

- OCR data available for both pages
- Serializer not finding page 2 entities
- Textbox creation fails

**Causes**:

- Mismatch in page number mapping
- Entity structure different than expected
- Serialization logic bug

**Solutions**:

1. Check page number mapping
2. Verify entity structure
3. Debug serialization logic

## 🧪 **Testing Commands**

### **Test Single Page**

```bash
curl -X POST https://wally-puppet-523614903618.us-central1.run.app/capture-and-ocr \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","captureUrl":"https://wally-frontend-523614903618.us-central1.run.app/capture-project/test","pageNumbers":"1"}'
```

### **Test Multiple Pages**

```bash
curl -X POST https://wally-puppet-523614903618.us-central1.run.app/capture-and-ocr \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","captureUrl":"https://wally-frontend-523614903618.us-central1.run.app/capture-project/test","pageNumbers":"1,2"}'
```

### **Check Service Health**

```bash
curl https://wally-puppet-523614903618.us-central1.run.app/health
```

## 📊 **Expected Log Flow**

### **Successful Multi-Page Capture**

```
🚀 Starting OCR capture session
📊 Processing Summary: Total Pages: 2, Total Views: 1, Total Operations: 2

📄 Operation 1/3: Page 1, View original
   🧭 Navigating to page 1...
   🔍 Page 1 element found: true
   ✅ Page element found successfully
   ✅ Page capture successful
   📤 Sending to OCR service...
   📊 OCR result for page 1: {success: true, hasData: true}

📄 Operation 2/3: Page 2, View original
   🧭 Navigating to page 2...
   🔍 Page 2 element found: false
   ⚠️ Page 2 not visible, attempting to navigate...
   🖱️ Clicking page navigation for page 2...
   ✅ Page element found successfully
   ✅ Page capture successful
   📤 Sending to OCR service...
   📊 OCR result for page 2: {success: true, hasData: true}

🏁 OCR capture session completed
   Successful Operations: 2/2
   Success Rate: 100%
```

## 🔧 **Debugging Tools**

### **Browser DevTools**

1. Open Puppeteer page in browser
2. Check console for JavaScript errors
3. Inspect PDF viewer elements
4. Verify page navigation

### **Network Tab**

1. Check OCR API calls
2. Verify request/response payloads
3. Check for failed requests
4. Monitor response times

### **Element Inspector**

1. Check PDF page elements
2. Verify data-page-number attributes
3. Check element visibility
4. Test CSS selectors

## 📝 **Next Steps**

1. **Run the enhanced debugging** with the new logs
2. **Check Puppeteer service logs** for page navigation issues
3. **Verify OCR API responses** for both pages
4. **Check frontend serialization** for entity processing
5. **Identify the exact failure point** in the pipeline

---

**Note**: This debugging guide will help identify exactly where the multi-page OCR process is failing. The enhanced logging will show whether the issue is in page navigation, capture, OCR processing, or frontend serialization.
