const express = require("express");
const puppeteer = require("puppeteer");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const FormData = require("form-data");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.OCR_CAPTURE_PORT || 3001;

// Configure multer for file uploads (Multer 2.x syntax)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Puppeteer browser
let browser;

async function initializeBrowser() {
  try {
    console.log(
      `\n🚀 [${new Date().toISOString()}] Initializing Puppeteer browser...`
    );
    console.log(`   Platform: ${process.platform}`);
    console.log(`   Node version: ${process.version}`);
    console.log(`   Launching with headless mode and optimized arguments...`);

    browser = await puppeteer.launch({
      headless: "new", // Use new headless mode for Puppeteer 24.x
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
      defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 2 },
    });

    console.log(`✅ Puppeteer browser initialized successfully`);
    console.log(
      `   Browser process ID: ${browser.process()?.pid || "unknown"}`
    );
    console.log(`   Browser version: ${await browser.version()}`);
    console.log(`   Default viewport: 1920x1080 with 2x scale`);

    // Test browser functionality
    const testPage = await browser.newPage();
    await testPage.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2,
    });
    await testPage.close();
    console.log(`✅ Browser functionality test passed`);
  } catch (error) {
    console.error(
      `\n💥 [${new Date().toISOString()}] Failed to initialize Puppeteer browser:`,
      error
    );
    console.error(`   Error details:`, error.message);
    console.error(`   Stack trace:`, error.stack);
    process.exit(1);
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    browser: browser ? "initialized" : "not initialized",
  });
});

// Service status endpoint
app.get("/status", (req, res) => {
  res.json({
    service: "OCR Capture Service",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    browser: browser
      ? {
          isConnected: browser.isConnected(),
          process: browser.process() ? "running" : "not running",
        }
      : "not initialized",
    endpoints: [
      "POST /capture-and-ocr",
      "GET /health",
      "GET /status",
      "GET /debug",
    ],
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Debug endpoint for real-time monitoring
app.get("/debug", (req, res) => {
  res.json({
    service: "OCR Capture Service Debug Info",
    timestamp: new Date().toISOString(),
    browser: {
      initialized: !!browser,
      isConnected: browser?.isConnected() || false,
      processRunning: browser?.process() ? "running" : "not running",
      pages: browser ? "active" : "not available",
    },
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid,
    },
    environment: {
      port: PORT,
      nodeEnv: process.env.NODE_ENV || "development",
      puppeteerArgs: browser ? "configured" : "not configured",
    },
  });
});

// Main OCR capture endpoint
app.post(
  "/capture-and-ocr",
  upload.single("project_data"),
  async (req, res) => {
    try {
      const {
        projectId,
        captureUrl,
        pageNumbers,
        viewTypes,
        ocrApiUrl = "http://localhost:8000/projects/process-file", // Default to our OCR service
        projectData,
      } = req.body;

      // Enhanced debug logging with timestamps
      const startTime = Date.now();
      console.log(
        `\n🚀 [${new Date().toISOString()}] Starting OCR capture session`
      );
      console.log(`📋 Request Details:`);
      console.log(`   Project ID: ${projectId}`);
      console.log(`   Capture URL: ${captureUrl}`);
      console.log(`   Page Numbers: ${pageNumbers}`);
      console.log(`   View Types: ${viewTypes}`);
      console.log(`   OCR API URL: ${ocrApiUrl}`);
      console.log(
        `   Project Data: ${projectData ? "✅ Provided" : "❌ Not provided"}`
      );

      // Validate required parameters
      if (!projectId || !captureUrl) {
        console.error(`❌ Validation failed: Missing required parameters`);
        return res.status(400).json({
          success: false,
          error: "Missing required parameters: projectId or captureUrl",
        });
      }

      // Validate pageNumbers parameter
      if (!pageNumbers) {
        console.error(
          `❌ Validation failed: pageNumbers parameter is required`
        );
        return res.status(400).json({
          success: false,
          error: "pageNumbers parameter is required",
        });
      }

      // Parse page numbers and view types
      let pagesToProcess = [];
      try {
        // Handle different input formats
        let pageNumbersStr = pageNumbers;
        if (Array.isArray(pageNumbers)) {
          pageNumbersStr = pageNumbers.join(",");
        } else if (typeof pageNumbers === "object") {
          pageNumbersStr = JSON.stringify(pageNumbers);
        }

        pagesToProcess = String(pageNumbersStr)
          .split(",")
          .map(Number)
          .filter((n) => !isNaN(n));

        console.log(
          `✅ Parsed page numbers: ${pageNumbers} → [${pagesToProcess.join(
            ", "
          )}]`
        );
      } catch (error) {
        console.error(`❌ Error parsing pageNumbers:`, error);
        return res.status(400).json({
          success: false,
          error: `Invalid pageNumbers format: ${pageNumbers}. Expected comma-separated numbers.`,
        });
      }

      // Only process "original" view for OCR - we don't need translated view
      const viewsToProcess = ["original"];
      console.log(
        `   📝 Note: Only processing "original" view for OCR (translated view skipped)`
      );

      if (pagesToProcess.length === 0) {
        console.error(`❌ No valid page numbers provided`);
        return res.status(400).json({
          success: false,
          error: "No valid page numbers provided",
        });
      }

      console.log(`\n📊 Processing Summary:`);
      console.log(`   Total Pages: ${pagesToProcess.length}`);
      console.log(`   Total Views: ${viewsToProcess.length}`);
      console.log(
        `   Total Operations: ${pagesToProcess.length * viewsToProcess.length}`
      );

      const results = [];
      const errors = [];
      let currentOperation = 0;
      const totalOperations = pagesToProcess.length * viewsToProcess.length;

      // Create a new page for this capture session
      console.log(
        `\n🌐 [${new Date().toISOString()}] Creating new Puppeteer page...`
      );
      const page = await browser.newPage();
      console.log(`✅ Puppeteer page created successfully`);

      try {
        // Set viewport and navigate to capture URL
        console.log(
          `\n🖥️  [${new Date().toISOString()}] Setting viewport and navigating...`
        );
        console.log(`   Viewport: 1920x1080 with 2x device scale factor`);

        await page.setViewport({
          width: 1920,
          height: 1080,
          deviceScaleFactor: 2,
        });
        console.log(`✅ Viewport set successfully`);

        console.log(`   Navigating to: ${captureUrl}`);
        await page.goto(captureUrl, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });
        console.log(`✅ Navigation completed successfully`);

        // Wait for content to load
        console.log(
          `\n⏳ [${new Date().toISOString()}] Waiting for content to load...`
        );
        console.log(`   Waiting 3 seconds for initial render...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        console.log(`   Looking for .document-wrapper selector...`);
        await page.waitForSelector(".document-wrapper", { timeout: 30000 });
        console.log(`✅ Document wrapper found and loaded`);

        // Process each page and view combination
        console.log(
          `\n🔄 [${new Date().toISOString()}] Starting page capture and OCR processing...`
        );

        for (const pageNum of pagesToProcess) {
          for (const viewType of viewsToProcess) {
            currentOperation++;
            const operationStartTime = Date.now();

            try {
              console.log(
                `\n📄 [${new Date().toISOString()}] Operation ${currentOperation}/${totalOperations}: Page ${pageNum}, View ${viewType}`
              );
              console.log(
                `   Progress: ${Math.round(
                  (currentOperation / totalOperations) * 100
                )}%`
              );

              const captureResult = await capturePageView(
                page,
                pageNum,
                viewType,
                currentOperation,
                totalOperations
              );

              if (captureResult.success) {
                console.log(`   ✅ Page capture successful`);
                console.log(
                  `   📏 Dimensions: ${captureResult.pageWidth}x${captureResult.pageHeight}`
                );
                console.log(
                  `   🖼️  Image size: ${captureResult.imageBuffer.length} bytes`
                );
                console.log(
                  `   🎯 Capture method: ${captureResult.captureMethod}`
                );
                console.log(
                  `   📸 Data URL: ${
                    captureResult.dataUrl ? "✅ Available" : "❌ Not available"
                  }`
                );

                // Create and log blob URL for immediate image viewing
                if (captureResult.dataUrl) {
                  try {
                    // Save image to disk for inspection instead of blob URL
                    const fs = require("fs");
                    const path = require("path");

                    // Create debug directory if it doesn't exist
                    const debugDir = path.join(__dirname, "debug_captures");
                    if (!fs.existsSync(debugDir)) {
                      fs.mkdirSync(debugDir, { recursive: true });
                    }

                    // Generate unique filename
                    const timestamp = new Date()
                      .toISOString()
                      .replace(/[:.]/g, "-");
                    const filename = `page-${pageNum}-${viewType}-${timestamp}.png`;
                    const filePath = path.join(debugDir, filename);

                    // Save the image buffer to disk
                    fs.writeFileSync(filePath, captureResult.imageBuffer);
                    console.log(`   💾 Image saved to: ${filePath}`);
                    console.log(`   📁 Debug directory: ${debugDir}`);

                    // Log image details
                    console.log(`   📸 Image Details:`);
                    console.log(`      - File path: ${filePath}`);
                    console.log(
                      `      - File size: ${captureResult.imageBuffer.length} bytes`
                    );
                    console.log(
                      `      - Dimensions: ${captureResult.pageWidth}x${captureResult.pageHeight}`
                    );
                    console.log(
                      `      - Data URL length: ${captureResult.dataUrl.length} characters`
                    );
                  } catch (fileError) {
                    console.log(
                      `   ⚠️  Could not save image to disk: ${fileError.message}`
                    );
                    console.log(`   📸 Image Details (fallback):`);
                    console.log(
                      `      - Buffer size: ${captureResult.imageBuffer.length} bytes`
                    );
                    console.log(
                      `      - Dimensions: ${captureResult.pageWidth}x${captureResult.pageHeight}`
                    );
                    console.log(
                      `      - Data URL length: ${captureResult.dataUrl.length} characters`
                    );
                  }
                }

                console.log(`   📤 Sending to OCR service...`);

                // Send captured image to OCR service
                console.log(`   📤 Sending to OCR service...`);
                const ocrResult = await sendToOcrService(
                  captureResult.imageBuffer,
                  ocrApiUrl,
                  {
                    projectId,
                    pageNumber: pageNum,
                    viewType,
                    pageWidth: captureResult.pageWidth,
                    pageHeight: captureResult.pageHeight,
                    projectData,
                    dataUrl: captureResult.dataUrl, // Pass data URL for validation
                  }
                );

                if (ocrResult.success) {
                  const operationDuration = Date.now() - operationStartTime;
                  console.log(
                    `   ✅ OCR processing successful (${operationDuration}ms)`
                  );

                  results.push({
                    pageNumber: pageNum,
                    viewType,
                    ocrResult: ocrResult.data,
                    captureInfo: {
                      width: captureResult.pageWidth,
                      height: captureResult.pageHeight,
                      imageSize: captureResult.imageBuffer.length,
                    },
                    // Extract key OCR data for easier access
                    extractedText:
                      extractTextFromStyledLayout(
                        ocrResult.data?.styled_layout
                      ) || [],
                    styledPdf: ocrResult.data?.styled_pdf || null,
                    // Add structured text data
                    textElements:
                      extractTextElements(ocrResult.data?.styled_layout) || [],
                    layoutSections:
                      extractLayoutSections(ocrResult.data?.styled_layout) ||
                      [],
                  });

                  console.log(`   📊 Results summary:`);
                  console.log(
                    `      - Extracted text elements: ${
                      results[results.length - 1].extractedText.length
                    }`
                  );
                  console.log(
                    `      - Text elements: ${
                      results[results.length - 1].textElements.length
                    }`
                  );
                  console.log(
                    `      - Layout sections: ${
                      results[results.length - 1].layoutSections.length
                    }`
                  );
                  console.log(
                    `      - Styled PDF: ${
                      results[results.length - 1].styledPdf
                        ? "✅ Available"
                        : "❌ Not available"
                    }`
                  );

                  // Show sample of extracted text
                  if (results[results.length - 1].extractedText.length > 0) {
                    const sampleText =
                      results[results.length - 1].extractedText[0];
                    console.log(
                      `      - Sample text: "${
                        sampleText.text?.substring(0, 50) || "No text"
                      }"`
                    );
                  }

                  // Log what was actually sent to OCR service
                  console.log(`   📤 OCR Service Summary:`);
                  console.log(
                    `      - Image sent: ${captureResult.imageBuffer.length} bytes`
                  );
                  console.log(
                    `      - Data URL sent: ${
                      captureResult.dataUrl
                        ? `${captureResult.dataUrl.length} characters`
                        : "None"
                    }`
                  );
                  console.log(
                    `      - Dimensions sent: ${captureResult.pageWidth}x${captureResult.pageHeight}`
                  );

                  // Show blob URL again for easy access
                  if (captureResult.dataUrl) {
                    try {
                      const fs = require("fs");
                      const path = require("path");

                      // Find the saved image file
                      const debugDir = path.join(__dirname, "debug_captures");
                      const files = fs
                        .readdirSync(debugDir)
                        .filter((f) =>
                          f.includes(`page-${pageNum}-${viewType}`)
                        );

                      if (files.length > 0) {
                        const latestFile = files[files.length - 1]; // Get most recent
                        const filePath = path.join(debugDir, latestFile);
                        console.log(
                          `      - View Image: ${filePath} (open this file to see what was sent to OCR)`
                  );
                } else {
                        console.log(
                          `      - View Image: ❌ No saved file found`
                        );
                      }
                    } catch (fileError) {
                      console.log(
                        `      - View Image: ❌ Could not locate saved file`
                      );
                    }
                  }
                } else {
                  const operationDuration = Date.now() - operationStartTime;
                  console.error(
                    `   ❌ OCR failed after ${operationDuration}ms:`,
                    ocrResult.error
                  );
                  errors.push({
                    pageNumber: pageNum,
                    viewType,
                    error: ocrResult.error || "OCR service failed",
                  });
                }
              } else {
                const operationDuration = Date.now() - operationStartTime;
                console.error(
                  `   ❌ Page capture failed after ${operationDuration}ms:`,
                  captureResult.error
                );
                errors.push({
                  pageNumber: pageNum,
                  viewType,
                  error: captureResult.error || "Page capture failed",
                });
              }
            } catch (error) {
              const operationDuration = Date.now() - operationStartTime;
              console.error(
                `   ❌ Operation failed after ${operationDuration}ms:`,
                error.message
              );
              errors.push({
                pageNumber: pageNum,
                viewType,
                error: error.message || "Unknown error",
              });
            }
          }
        }
      } finally {
        console.log(
          `\n🔒 [${new Date().toISOString()}] Closing Puppeteer page...`
        );
        await page.close();
        console.log(`✅ Puppeteer page closed successfully`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(
        `\n🏁 [${new Date().toISOString()}] OCR capture session completed`
      );
      console.log(`📈 Final Results:`);
      console.log(
        `   Total Duration: ${duration}ms (${Math.round(duration / 1000)}s)`
      );
      console.log(
        `   Successful Operations: ${results.length}/${totalOperations}`
      );
      console.log(`   Failed Operations: ${errors.length}/${totalOperations}`);
      console.log(
        `   Success Rate: ${Math.round(
          (results.length / totalOperations) * 100
        )}%`
      );

      if (errors.length > 0) {
        console.log(`\n❌ Errors encountered:`);
        errors.forEach((error, index) => {
          console.log(
            `   ${index + 1}. Page ${error.pageNumber}, View ${
              error.viewType
            }: ${error.error}`
          );
        });
      }

      const response = {
        success: true,
        data: {
          projectId,
          totalPages: pagesToProcess.length,
          totalViews: viewsToProcess.length,
          processedPages: results.length,
          results,
          errors,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          duration,
          successRate: Math.round((results.length / totalOperations) * 100),
        },
      };

      console.log(`\n📤 Sending response to client...`);
      res.json(response);
      console.log(`✅ Response sent successfully\n`);
    } catch (error) {
      console.error(
        `\n💥 [${new Date().toISOString()}] Fatal error in OCR capture:`,
        error
      );
      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Function to capture a specific page view
async function capturePageView(
  page,
  pageNumber,
  viewType,
  currentOperation,
  totalOperations
) {
  const captureStartTime = Date.now();

  try {
    console.log(
      `      🔍 [${new Date().toISOString()}] Starting page capture...`
    );

    // Wait for the specific page to be visible
    console.log(
      `      ⏳ Waiting for page element with data-page-number="${pageNumber}"...`
    );
    await page.waitForSelector(
      `.react-pdf__Page[data-page-number="${pageNumber}"]`,
      { timeout: 10000 }
    );
    console.log(`      ✅ Page element found successfully`);

    // Get page dimensions
    console.log(`      📏 Getting page dimensions...`);
    const pageDimensions = await page.evaluate(
      (pageNum, view) => {
        const pageElement = document.querySelector(
          `.react-pdf__Page[data-page-number="${pageNum}"]`
        );
        if (!pageElement) return null;

        const rect = pageElement.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
        };
      },
      pageNumber,
      viewType
    );

    if (!pageDimensions) {
      console.log(`      ❌ Page dimensions not found`);
      return { success: false, error: "Page element not found" };
    }

    console.log(
      `      📐 Page dimensions: ${pageDimensions.width}x${pageDimensions.height}`
    );

    // Inject dom-to-image library into the page
    console.log(`      📦 Injecting dom-to-image library...`);
    await page.addScriptTag({
      path: path.join(
        __dirname,
        "node_modules/dom-to-image/dist/dom-to-image.min.js"
      ),
    });
    console.log(`      ✅ dom-to-image library injected successfully`);

    // Wait a moment for the library to load
    await page.waitForFunction(() => window.domtoimage, { timeout: 10000 });
    console.log(`      ✅ dom-to-image library loaded and ready`);

    // Capture the page using dom-to-image
    console.log(`      🖼️  Capturing page image...`);

    let imageBuffer;
    let captureMethod = "unknown";
    let dataUrl = null; // Store the data URL for validation

    try {
      // Only use dom-to-image for "original" view
      if (viewType === "original") {
        console.log(`      🎯 Using dom-to-image for original view...`);

        // Try dom-to-image first
        const imageDataUrl = await page.evaluate(
      async (pageNum, view) => {
        const pageElement = document.querySelector(
          `.react-pdf__Page[data-page-number="${pageNum}"]`
        );
        if (!pageElement) throw new Error("Page element not found");

            // Use dom-to-image for capture
        if (window.domtoimage && window.domtoimage.toPng) {
          try {
                console.log(`      🎯 Using dom-to-image for capture...`);
            const dataUrl = await window.domtoimage.toPng(pageElement, {
              quality: 1.0,
              bgcolor: "#ffffff",
              width: pageElement.offsetWidth,
              height: pageElement.offsetHeight,
            });

                // Return the data URL as a string (no Buffer conversion in browser)
                return dataUrl;
          } catch (error) {
                throw new Error(
                  `dom-to-image capture failed: ${error.message}`
                );
              }
            } else {
              throw new Error("dom-to-image library not available");
            }
          },
          pageNumber,
          viewType
        );

        // Convert data URL to buffer in Node.js context (where Buffer is available)
        console.log(`      🔄 Converting data URL to buffer...`);

        if (!imageDataUrl || typeof imageDataUrl !== "string") {
          throw new Error("Invalid data URL returned from capture");
        }

        if (!imageDataUrl.startsWith("data:image/png;base64,")) {
          throw new Error("Invalid PNG data URL format");
        }

        const base64 = imageDataUrl.split(",")[1];
        if (!base64) {
          throw new Error("No base64 data found in data URL");
        }

        imageBuffer = Buffer.from(base64, "base64");
        dataUrl = imageDataUrl; // Store for OCR service
        captureMethod = "dom-to-image";
        console.log(`      ✅ Data URL converted to buffer successfully`);
        console.log(
          `      📊 Data URL length: ${imageDataUrl.length} characters`
        );
        console.log(`      📊 Base64 length: ${base64.length} characters`);
      } else {
        // For translated view, use Puppeteer screenshot directly
        console.log(
          `      📸 Using Puppeteer screenshot for ${viewType} view...`
        );

        // Get the page element position for screenshot clipping
        const elementBounds = await page.evaluate((pageNum) => {
          const pageElement = document.querySelector(
            `.react-pdf__Page[data-page-number="${pageNum}"]`
          );
          if (!pageElement) return null;

          const rect = pageElement.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        }, pageNumber);

        if (!elementBounds) {
          throw new Error("Could not determine element bounds for screenshot");
        }

        // Take screenshot of the specific page element
        imageBuffer = await page.screenshot({
          clip: {
            x: elementBounds.x,
            y: elementBounds.y,
            width: elementBounds.width,
            height: elementBounds.height,
          },
          type: "png",
        });

        captureMethod = "puppeteer-screenshot";
        console.log(`      ✅ Puppeteer screenshot successful`);
      }
    } catch (captureError) {
      console.log(`      ❌ Capture failed: ${captureError.message}`);

      // Fallback to Puppeteer screenshot for any view if dom-to-image fails
      try {
        console.log(`      🔄 Falling back to Puppeteer screenshot...`);

        // Get the page element position for screenshot clipping
        const elementBounds = await page.evaluate((pageNum) => {
          const pageElement = document.querySelector(
            `.react-pdf__Page[data-page-number="${pageNum}"]`
          );
          if (!pageElement) return null;

          const rect = pageElement.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        }, pageNumber);

        if (!elementBounds) {
          throw new Error("Could not determine element bounds for screenshot");
        }

        // Take screenshot of the specific page element
        imageBuffer = await page.screenshot({
          clip: {
            x: elementBounds.x,
            y: elementBounds.y,
            width: elementBounds.width,
            height: elementBounds.height,
          },
          type: "png",
        });

        captureMethod = "puppeteer-screenshot-fallback";
        console.log(`      ✅ Puppeteer screenshot fallback successful`);
      } catch (screenshotError) {
        throw new Error(
          `Both capture methods failed. Primary: ${captureError.message}, fallback: ${screenshotError.message}`
        );
      }
    }

    const captureDuration = Date.now() - captureStartTime;
    console.log(`      ✅ Page capture completed in ${captureDuration}ms`);
    console.log(`      🖼️  Image buffer size: ${imageBuffer.length} bytes`);
    console.log(`      🎯 Capture method used: ${captureMethod}`);

    return {
      success: true,
      imageBuffer,
      pageWidth: pageDimensions.width,
      pageHeight: pageDimensions.height,
      captureMethod,
      dataUrl: dataUrl, // Return the data URL
    };
  } catch (error) {
    const captureDuration = Date.now() - captureStartTime;
    console.log(
      `      ❌ Page capture failed after ${captureDuration}ms: ${error.message}`
    );
    return {
      success: false,
      error: error.message || "Page capture failed",
    };
  }
}

// Function to send captured image to OCR service
async function sendToOcrService(imageBuffer, ocrApiUrl, metadata) {
  const ocrStartTime = Date.now();

  try {
    console.log(
      `      📤 [${new Date().toISOString()}] Preparing OCR service request...`
    );

    // Use form-data package for Node.js compatibility
    const FormData = require("form-data");
    const formData = new FormData();

    // Add the image as a file
    const filename = `page-${metadata.pageNumber}-${metadata.viewType}.png`;
    formData.append("file", imageBuffer, {
      filename: filename,
      contentType: "image/png",
    });
    console.log(`      📎 File prepared: ${filename}`);

    // Add frontend dimensions if available
    if (metadata.pageWidth && metadata.pageHeight) {
      formData.append("frontend_page_width", metadata.pageWidth.toString());
      formData.append("frontend_page_height", metadata.pageHeight.toString());
      console.log(
        `      📏 Dimensions added: ${metadata.pageWidth}x${metadata.pageHeight}`
      );
    }

    // Add data URL for validation if available
    if (metadata.dataUrl) {
      formData.append("data_url", metadata.dataUrl);
      console.log(`      🔍 Data URL added for validation`);

      // Save image to disk for inspection
      try {
        const fs = require("fs");
        const path = require("path");

        // Create debug directory if it doesn't exist
        const debugDir = path.join(__dirname, "debug_ocr_requests");
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }

        // Generate unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `ocr-${metadata.pageNumber}-${metadata.viewType}-${timestamp}.png`;
        const filePath = path.join(debugDir, filename);

        // Save the image buffer to disk
        fs.writeFileSync(filePath, imageBuffer);
        console.log(`      💾 Image saved for OCR inspection: ${filePath}`);

        // Log detailed image information for debugging
        console.log(`      📸 Image Details:`);
        console.log(`         - File path: ${filePath}`);
        console.log(
          `         - Data URL length: ${metadata.dataUrl.length} characters`
        );
        console.log(
          `         - Data URL preview: ${metadata.dataUrl.substring(
            0,
            100
          )}...`
        );
        console.log(
          `         - Base64 data length: ${
            metadata.dataUrl.split(",")[1]?.length || 0
          } characters`
        );
        console.log(
          `         - Image dimensions: ${metadata.pageWidth}x${metadata.pageHeight}`
        );
        console.log(`         - Buffer size: ${imageBuffer.length} bytes`);
        console.log(
          `         - Expected file size: ~${
            Math.round((imageBuffer.length / 1024) * 100) / 100
          } KB`
        );

        // Validate data URL format
        if (metadata.dataUrl.startsWith("data:image/png;base64,")) {
          console.log(`         - Format: ✅ Valid PNG data URL`);
        } else {
          console.log(
            `         - Format: ⚠️  Unexpected format: ${metadata.dataUrl.substring(
              0,
              50
            )}...`
          );
        }
      } catch (fileError) {
        console.log(
          `      ⚠️  Could not save image to disk: ${fileError.message}`
        );

        // Fallback logging without file saving
        console.log(`      📸 Image Details (fallback):`);
        console.log(
          `         - Data URL length: ${metadata.dataUrl.length} characters`
        );
        console.log(
          `         - Data URL preview: ${metadata.dataUrl.substring(
            0,
            100
          )}...`
        );
        console.log(
          `         - Base64 data length: ${
            metadata.dataUrl.split(",")[1]?.length || 0
          } characters`
        );
        console.log(
          `         - Image dimensions: ${metadata.pageWidth}x${metadata.pageHeight}`
        );
        console.log(`         - Buffer size: ${imageBuffer.length} bytes`);
        console.log(
          `         - Expected file size: ~${
            Math.round((imageBuffer.length / 1024) * 100) / 100
          } KB`
        );

        // Validate data URL format
        if (metadata.dataUrl.startsWith("data:image/png;base64,")) {
          console.log(`         - Format: ✅ Valid PNG data URL`);
        } else {
          console.log(
            `         - Format: ⚠️  Unexpected format: ${metadata.dataUrl.substring(
              0,
              50
            )}...`
          );
        }
      }
    }

    // Add project data if available
    if (metadata.projectData) {
      formData.append("project_data", JSON.stringify(metadata.projectData));
      console.log(
        `      📋 Project data added: ${
          JSON.stringify(metadata.projectData).length
        } characters`
      );
    }

    // No authorization headers needed - direct call to your backend
    const headers = {
      ...formData.getHeaders(),
    };

    // Log FormData contents for debugging
    console.log(`      📋 FormData Contents:`);
    console.log(`         - File: ${filename} (${imageBuffer.length} bytes)`);
    console.log(`         - frontend_page_width: ${metadata.pageWidth}`);
    console.log(`         - frontend_page_height: ${metadata.pageHeight}`);
    if (metadata.dataUrl) {
      console.log(`         - data_url: ${metadata.dataUrl.length} characters`);
    }
    if (metadata.projectData) {
      console.log(
        `         - project_data: ${
          JSON.stringify(metadata.projectData).length
        } characters`
      );
    }

    console.log(`      🌐 Sending to OCR service: ${ocrApiUrl}`);
    console.log(`      📊 Request details:`);
    console.log(`         - Image size: ${imageBuffer.length} bytes`);
    console.log(
      `         - Page dimensions: ${metadata.pageWidth}x${metadata.pageHeight}`
    );
    console.log(`         - Project ID: ${metadata.projectId}`);
    console.log(`         - Page number: ${metadata.pageNumber}`);
    console.log(`         - View type: ${metadata.viewType}`);

    // Show what's being sent in the request
    console.log(`      📤 Request payload:`);
    console.log(`         - File: ${filename} (${imageBuffer.length} bytes)`);
    console.log(
      `         - Form fields: frontend_page_width, frontend_page_height, data_url, project_data`
    );

    // Send to your backend OCR service
    const response = await axios.post(ocrApiUrl, formData, {
      headers,
      timeout: 120000, // 2 minute timeout
      maxContentLength: 100 * 1024 * 1024, // 100MB
      maxBodyLength: 100 * 1024 * 1024,
    });

    const ocrDuration = Date.now() - ocrStartTime;
    console.log(`      ✅ OCR service response received in ${ocrDuration}ms`);
    console.log(`      📡 Response status: ${response.status}`);
    console.log(
      `      📋 Response data keys: [${Object.keys(response.data || {}).join(
        ", "
      )}]`
    );

    // Log OCR results summary
    if (response.data) {
      const data = response.data;
      console.log(`      📊 OCR Results Summary:`);

      if (data.extracted_text) {
        console.log(
          `         - Extracted text: ${data.extracted_text.length} characters`
        );
      }

      if (data.layout_data && data.layout_data.entities) {
        console.log(
          `         - Layout entities: ${data.layout_data.entities.length} found`
        );
      }

      if (data.styled_pdf) {
        console.log(`         - Styled PDF: ✅ Available`);
      } else {
        console.log(`         - Styled PDF: ❌ Not available`);
      }

      // Log key OCR service response data
      console.log(`      🔍 OCR Service Response:`);
      console.log(`         - Response status: ${response.status}`);
      console.log(
        `         - Response data keys: [${Object.keys(data).join(", ")}]`
      );

      // Show styled_layout content if available (this is what your OCR service returns)
      if (data.styled_layout) {
        console.log(`      🎨 Styled Layout Found:`);
        if (typeof data.styled_layout === "object") {
          const layoutKeys = Object.keys(data.styled_layout);
          console.log(`         - Layout sections: ${layoutKeys.length} found`);
          console.log(`         - Section names: [${layoutKeys.join(", ")}]`);

          // Show a sample of the styled layout content
          const firstSection = layoutKeys[0];
          if (firstSection && data.styled_layout[firstSection]) {
            const sample = data.styled_layout[firstSection];
            if (typeof sample === "object") {
              console.log(
                `         - Sample section "${firstSection}": ${JSON.stringify(
                  sample
                ).substring(0, 100)}...`
              );
            } else {
              console.log(
                `         - Sample section "${firstSection}": ${sample}`
              );
            }
          }
        } else {
          console.log(`         - Content: ${data.styled_layout}`);
        }
      } else {
        console.log(`      ⚠️  No styled_layout found in OCR response`);
        console.log(
          `      📝 Available data: ${JSON.stringify(data).substring(
            0,
            200
          )}...`
        );
      }
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const ocrDuration = Date.now() - ocrStartTime;
    console.error(
      `      ❌ OCR service error after ${ocrDuration}ms:`,
      error.message
    );

    if (error.response) {
      console.error(`      📡 Error response details:`);
      console.error(`         - Status: ${error.response.status}`);
      console.error(`         - Status Text: ${error.response.statusText}`);
      console.error(`         - Error Data:`, error.response.data);
    } else if (error.request) {
      console.error(`      📡 No response received from OCR service`);
    } else {
      console.error(`      📡 Request setup error:`, error.message);
    }

    return {
      success: false,
      error:
        error.response?.data?.error ||
        error.response?.data?.detail ||
        error.message ||
        "Failed to send to OCR service",
    };
  }
}

// Function to extract text from styled_layout
function extractTextFromStyledLayout(styledLayout) {
  if (!styledLayout) return [];

  const textElements = [];

  function traverse(node) {
    if (node.type === "text") {
      textElements.push({
        text: node.text,
        boundingBox: node.boundingBox,
        confidence: node.confidence,
        pageNumber: node.pageNumber,
        viewType: node.viewType,
      });
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(styledLayout);
  return textElements;
}

// Function to extract text elements from styled_layout
function extractTextElements(styledLayout) {
  if (!styledLayout) return [];

  const textElements = [];

  function traverse(node) {
    if (node.type === "text") {
      textElements.push({
        text: node.text,
        boundingBox: node.boundingBox,
        confidence: node.confidence,
        pageNumber: node.pageNumber,
        viewType: node.viewType,
      });
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(styledLayout);
  return textElements;
}

// Function to extract layout sections from styled_layout
function extractLayoutSections(styledLayout) {
  if (!styledLayout) return [];

  const sections = [];

  function traverse(node) {
    if (node.type === "section") {
      sections.push({
        name: node.name,
        boundingBox: node.boundingBox,
        confidence: node.confidence,
        pageNumber: node.pageNumber,
        viewType: node.viewType,
      });
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(styledLayout);
  return sections;
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start server
async function startServer() {
  console.log(
    `\n🚀 [${new Date().toISOString()}] Starting OCR Capture Service...`
  );
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Node version: ${process.version}`);

  await initializeBrowser();

  app.listen(PORT, () => {
    console.log(`\n✅ OCR Capture Service running successfully!`);
    console.log(`📍 Service URLs:`);
    console.log(`   Main Service: http://localhost:${PORT}`);
    console.log(`   Health Check: http://localhost:${PORT}/health`);
    console.log(`   Status Info: http://localhost:${PORT}/status`);
    console.log(`   Debug Info: http://localhost:${PORT}/debug`);
    console.log(
      `   Capture Endpoint: http://localhost:${PORT}/capture-and-ocr`
    );
    console.log(
      `\n🔍 Monitor the service in real-time using the debug endpoints above`
    );
    console.log(`📊 Service is ready to capture and process OCR requests\n`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
