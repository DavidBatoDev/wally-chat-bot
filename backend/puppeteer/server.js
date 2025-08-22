// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const puppeteer = require("puppeteer");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const FormData = require("form-data");
const path = require("path");
const fs = require("fs");

// Translation service configuration
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const GOOGLE_TRANSLATE_BASE_URL =
  "https://translation.googleapis.com/language/translate/v2";

// Debug environment variable loading
// console.log(`🔍 [ENV DEBUG] Environment variable check:`);
// console.log(
//   `   - process.env.GOOGLE_TRANSLATE_API_KEY: ${
//     process.env.GOOGLE_TRANSLATE_API_KEY ? "SET" : "NOT SET"
//   }`
// );
// console.log(
//   `   - process.env keys containing GOOGLE: ${Object.keys(process.env)
//     .filter((key) => key.includes("GOOGLE"))
//     .join(", ")}`
// );
// console.log(
//   `   - All process.env keys: ${Object.keys(process.env).join(", ")}`
// );

// Log translation service status on startup
console.log(`🌐 [TRANSLATION] Service status:`);
console.log(
  `   - GOOGLE_TRANSLATE_API_KEY: ${
    GOOGLE_TRANSLATE_API_KEY ? "SET" : "NOT SET"
  }`
);
console.log(`   - GOOGLE_TRANSLATE_BASE_URL: ${GOOGLE_TRANSLATE_BASE_URL}`);
if (!GOOGLE_TRANSLATE_API_KEY) {
  console.log(
    `   ⚠️  Translation will be disabled until GOOGLE_TRANSLATE_API_KEY is set`
  );
} else {
  console.log(`   ✅ Translation service ready`);
}

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
let browserRestartCount = 0;
const MAX_BROWSER_RESTARTS = 5;
const BROWSER_RESTART_DELAY = 2000; // 2 seconds

// Translation service functions
async function translateText(text, targetLanguage, sourceLanguage = "auto") {
  try {
    if (!GOOGLE_TRANSLATE_API_KEY) {
      console.warn(
        "⚠️ [TRANSLATION] Google Translate API key not configured, skipping translation"
      );
      return text;
    }

    if (!text || !text.trim()) {
      return text;
    }

    console.log(`🌐 [TRANSLATION] Translating: "${text}" to ${targetLanguage}`);

    const params = new URLSearchParams({
      key: GOOGLE_TRANSLATE_API_KEY,
      q: text.trim(),
      target: targetLanguage,
      format: "text",
    });

    if (sourceLanguage && sourceLanguage !== "auto") {
      params.append("source", sourceLanguage);
    }

    console.log(
      `🔍 [TRANSLATION] API Request URL: ${GOOGLE_TRANSLATE_BASE_URL}?${params
        .toString()
        .replace(GOOGLE_TRANSLATE_API_KEY, "API_KEY_HIDDEN")}`
    );

    const response = await axios.post(
      `${GOOGLE_TRANSLATE_BASE_URL}?${params.toString()}`
    );

    console.log(`🔍 [TRANSLATION] API Response status: ${response.status}`);
    console.log(
      `🔍 [TRANSLATION] API Response data:`,
      JSON.stringify(response.data, null, 2)
    );

    if (
      response.data &&
      response.data.data &&
      response.data.data.translations &&
      response.data.data.translations.length > 0
    ) {
      const translatedText = response.data.data.translations[0].translatedText;
      console.log(
        `✅ [TRANSLATION] Translated: "${text}" → "${translatedText}"`
      );
      return translatedText;
    } else {
      console.warn(`⚠️ [TRANSLATION] No translation result for: "${text}"`);
      console.warn(`🔍 [TRANSLATION] Response structure:`, response.data);
      return text;
    }
  } catch (error) {
    console.error(
      `❌ [TRANSLATION] Failed to translate "${text}":`,
      error.message
    );
    return text; // Return original text if translation fails
  }
}

async function translateMultipleTexts(
  texts,
  targetLanguage,
  sourceLanguage = "auto"
) {
  try {
    if (!GOOGLE_TRANSLATE_API_KEY) {
      console.warn(
        "⚠️ [TRANSLATION] Google Translate API key not configured, skipping translation"
      );
      return texts;
    }

    if (!texts || texts.length === 0) {
      return texts;
    }

    console.log(
      `🌐 [TRANSLATION] Translating ${texts.length} texts to ${targetLanguage}`
    );
    console.log(`🔍 [TRANSLATION] Source language: ${sourceLanguage}`);
    console.log(`🔍 [TRANSLATION] Target language: ${targetLanguage}`);
    console.log(
      `🔍 [TRANSLATE] API Key length: ${
        GOOGLE_TRANSLATE_API_KEY ? GOOGLE_TRANSLATE_API_KEY.length : 0
      }`
    );
    console.log(
      `🔍 [TRANSLATE] API Key preview: ${
        GOOGLE_TRANSLATE_API_KEY
          ? GOOGLE_TRANSLATE_API_KEY.substring(0, 10) + "..."
          : "NOT SET"
      }`
    );
    console.log(
      `🔍 [TRANSLATE] API Key ends with: ${
        GOOGLE_TRANSLATE_API_KEY
          ? "..." +
            GOOGLE_TRANSLATE_API_KEY.substring(
              GOOGLE_TRANSLATE_API_KEY.length - 4
            )
          : "NOT SET"
      }`
    );
    console.log(
      `🔍 [TRANSLATE] API Key contains spaces: ${
        GOOGLE_TRANSLATE_API_KEY
          ? GOOGLE_TRANSLATE_API_KEY.includes(" ")
          : "NOT SET"
      }`
    );
    console.log(
      `🔍 [TRANSLATE] API Key contains quotes: ${
        GOOGLE_TRANSLATE_API_KEY
          ? GOOGLE_TRANSLATE_API_KEY.includes('"') ||
            GOOGLE_TRANSLATE_API_KEY.includes("'")
          : "NOT SET"
      }`
    );
    console.log(
      `🔍 [TRANSLATE] API Key trimmed length: ${
        GOOGLE_TRANSLATE_API_KEY
          ? GOOGLE_TRANSLATE_API_KEY.trim().length
          : "NOT SET"
      }`
    );

    // Google Translate API supports multiple texts in a single request
    const params = new URLSearchParams({
      key: GOOGLE_TRANSLATE_API_KEY,
      target: targetLanguage,
      format: "text",
    });

    if (sourceLanguage && sourceLanguage !== "auto") {
      params.append("source", sourceLanguage);
    }

    // Add all texts as separate 'q' parameters
    texts.forEach((text, index) => {
      if (text && text.trim()) {
        params.append("q", text.trim());
        console.log(
          `🔍 [TRANSLATION] Added text ${index + 1}: "${text.trim()}"`
        );
      }
    });

    console.log(
      `🔍 [TRANSLATION] Total params: ${
        params.toString().split("&").length
      } parameters`
    );
    console.log(
      `🔍 [TRANSLATION] Params preview: ${params
        .toString()
        .substring(0, 200)}...`
    );

    console.log(
      `🔍 [TRANSLATION] Batch API Request URL: ${GOOGLE_TRANSLATE_BASE_URL}?${params
        .toString()
        .replace(GOOGLE_TRANSLATE_API_KEY, "API_KEY_HIDDEN")}`
    );

    console.log(`🔍 [TRANSLATION] About to make API call...`);

    const response = await axios.post(
      `${GOOGLE_TRANSLATE_BASE_URL}?${params.toString()}`
    );

    console.log(
      `🔍 [TRANSLATION] Batch API Response status: ${response.status}`
    );
    console.log(
      `🔍 [TRANSLATION] Batch API Response data:`,
      JSON.stringify(response.data, null, 2)
    );

    if (
      response.data &&
      response.data.data &&
      response.data.data.translations
    ) {
      const translatedTexts = response.data.data.translations.map(
        (t) => t.translatedText
      );
      console.log(
        `✅ [TRANSLATION] Successfully translated ${translatedTexts.length} texts`
      );
      return translatedTexts;
    } else {
      console.warn(
        `⚠️ [TRANSLATE] No translation results for ${texts.length} texts`
      );
      console.warn(`🔍 [TRANSLATION] Batch response structure:`, response.data);
      return texts;
    }
  } catch (error) {
    console.error(
      `❌ [TRANSLATION] Failed to translate ${texts.length} texts:`,
      error.message
    );

    // Log detailed error information
    if (error.response) {
      console.error(
        `🔍 [TRANSLATION] Error response status: ${error.response.status}`
      );
      console.error(
        `🔍 [TRANSLATION] Error response data:`,
        JSON.stringify(error.response.data, null, 2)
      );
      console.error(
        `🔍 [TRANSLATION] Error response headers:`,
        JSON.stringify(error.response.headers, null, 2)
      );
    } else if (error.request) {
      console.error(`🔍 [TRANSLATION] Error request:`, error.request);
    } else {
      console.error(`🔍 [TRANSLATION] Error details:`, error);
    }

    return texts; // Return original texts if translation fails
  }
}

// Browser health check function
async function isBrowserHealthy() {
  try {
    if (!browser) return false;

    // Check if browser is still connected
    if (!browser.isConnected()) return false;

    // Try to create a test page to verify browser is responsive
    const testPage = await browser.newPage();
    await testPage.close();

    return true;
  } catch (error) {
    console.log(`🔍 Browser health check failed: ${error.message}`);
    return false;
  }
}

// Function to restart browser
async function restartBrowser() {
  try {
    browserRestartCount++;

    if (browserRestartCount > MAX_BROWSER_RESTARTS) {
      console.error(
        `💥 Maximum browser restart attempts (${MAX_BROWSER_RESTARTS}) exceeded. Exiting...`
      );
      process.exit(1);
    }

    console.log(
      `🔄 [${new Date().toISOString()}] Restarting Puppeteer browser (attempt ${browserRestartCount}/${MAX_BROWSER_RESTARTS})...`
    );

    // Close existing browser if it exists
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.log(`⚠️ Error closing old browser: ${error.message}`);
      }
      browser = null;
    }

    // Wait before restarting
    await new Promise((resolve) => setTimeout(resolve, BROWSER_RESTART_DELAY));

    // Reinitialize browser
    await initializeBrowser();

    console.log(`✅ Browser restarted successfully`);
  } catch (error) {
    console.error(`💥 Failed to restart browser: ${error.message}`);
    throw error;
  }
}

// Function to ensure browser is healthy, restart if needed
async function ensureBrowserHealth() {
  if (!(await isBrowserHealthy())) {
    console.log(`⚠️ Browser is not healthy, restarting...`);
    await restartBrowser();
  }
}

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
        "--disable-features=VizDisplayCompositor", // Add this for better stability
        "--disable-ipc-flooding-protection", // Add this for better stability
        "--disable-extensions", // Disable extensions for stability
        "--disable-plugins", // Disable plugins for stability
        "--disable-default-apps", // Disable default apps
        "--disable-sync", // Disable sync
        "--disable-translate", // Disable translate
        "--disable-web-security", // Disable web security for capture
        "--allow-running-insecure-content", // Allow insecure content for capture
        "--disable-features=TranslateUI", // Disable translate UI
        "--disable-component-extensions-with-background-pages", // Disable background pages
        "--disable-background-networking", // Disable background networking
        "--disable-background-timer-throttling", // Disable timer throttling
        "--disable-client-side-phishing-detection", // Disable phishing detection
        "--disable-default-apps", // Disable default apps
        "--disable-domain-reliability", // Disable domain reliability
        "--disable-features=AudioServiceOutOfProcess", // Disable audio service
        "--disable-hang-monitor", // Disable hang monitor
        "--disable-prompt-on-repost", // Disable repost prompt
        "--disable-renderer-backgrounding", // Disable renderer backgrounding
        "--disable-sync-preferences", // Disable sync preferences
        "--metrics-recording-only", // Metrics recording only
        "--no-default-browser-check", // No default browser check
        "--safebrowsing-disable-auto-update", // Disable safebrowsing auto-update
      ],
      defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 2 },
      timeout: 30000, // 30 second timeout for browser launch
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

    // Reset restart count on successful initialization
    browserRestartCount = 0;
  } catch (error) {
    console.error(
      `\n💥 [${new Date().toISOString()}] Failed to initialize Puppeteer browser:`,
      error
    );
    console.error(`   Error details:`, error.message);
    console.error(`   Stack trace:`, error.stack);

    // Try to restart browser if initialization fails
    if (browserRestartCount < MAX_BROWSER_RESTARTS) {
      console.log(`🔄 Attempting to restart browser...`);
      await restartBrowser();
    } else {
      console.error(`💥 Maximum restart attempts exceeded, exiting...`);
      process.exit(1);
    }
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    browser: browser ? "initialized" : "not initialized",
    browserHealth: browser
      ? {
          isConnected: browser.isConnected(),
          processRunning: browser.process() ? "running" : "not running",
          restartCount: browserRestartCount,
          maxRestarts: MAX_BROWSER_RESTARTS,
        }
      : null,
  });
});

// Manual browser restart endpoint
app.post("/restart-browser", async (req, res) => {
  try {
    console.log(
      `🔄 [${new Date().toISOString()}] Manual browser restart requested`
    );

    if (!browser) {
      return res.json({
        success: false,
        message: "No browser instance to restart",
        timestamp: new Date().toISOString(),
      });
    }

    await restartBrowser();

    res.json({
      success: true,
      message: "Browser restarted successfully",
      timestamp: new Date().toISOString(),
      restartCount: browserRestartCount,
    });
  } catch (error) {
    console.error(`💥 Manual browser restart failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
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

      // Ensure browser is healthy before starting capture
      await ensureBrowserHealth();

      // Create a new page for this capture session
      console.log(
        `\n🌐 [${new Date().toISOString()}] Creating new Puppeteer page...`
      );

      let page;
      try {
        page = await browser.newPage();
        console.log(`✅ Puppeteer page created successfully`);
      } catch (error) {
        console.error(`💥 Failed to create page: ${error.message}`);

        // If page creation fails, try to restart browser and retry
        if (
          error.message.includes("Connection closed") ||
          error.message.includes("Protocol error")
        ) {
          console.log(
            `🔄 Connection error detected, restarting browser and retrying...`
          );
          await restartBrowser();
          page = await browser.newPage();
          console.log(`✅ Puppeteer page created successfully after restart`);
        } else {
          throw error;
        }
      }

      try {
        // Set viewport and navigate to capture URL with retry logic
        console.log(
          `\n🖥️  [${new Date().toISOString()}] Setting viewport and navigating...`
        );
        console.log(`   Viewport: 1920x1080 with 2x device scale factor`);

        // Retry function for page operations
        const retryPageOperation = async (
          operation,
          operationName,
          maxRetries = 3
        ) => {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              await operation();
              return;
            } catch (error) {
              console.error(
                `❌ ${operationName} failed (attempt ${attempt}/${maxRetries}): ${error.message}`
              );

              if (attempt === maxRetries) {
                throw error;
              }

              // Check if it's a connection error
              if (
                error.message.includes("Connection closed") ||
                error.message.includes("Protocol error")
              ) {
                console.log(
                  `🔄 Connection error detected, restarting browser and retrying...`
                );
                await restartBrowser();

                // Recreate the page after browser restart
                try {
                  await page.close();
                } catch (closeError) {
                  console.log(
                    `⚠️ Error closing old page: ${closeError.message}`
                  );
                }

                page = await browser.newPage();
                console.log(`✅ New page created after browser restart`);
              }

              // Wait before retry
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * attempt)
              );
            }
          }
        };

        // Set viewport with retry
        await retryPageOperation(
          () =>
            page.setViewport({
              width: 1920,
              height: 1080,
              deviceScaleFactor: 2,
            }),
          "Setting viewport"
        );
        console.log(`✅ Viewport set successfully`);

        // Navigate with retry and enhanced network handling
        console.log(`   Navigating to: ${captureUrl}`);
        await retryPageOperation(async () => {
          // Set longer timeout for slow networks
          const response = await page.goto(captureUrl, {
            waitUntil: "networkidle2",
            timeout: 120000, // 2 minutes for slow networks
          });

          // Check if the page loaded successfully
          if (!response || !response.ok()) {
            throw new Error(
              `Page load failed with status: ${response?.status()}`
            );
          }

          // Additional check for common error pages
          const pageTitle = await page.title();
          if (
            pageTitle.includes("Error") ||
            pageTitle.includes("Not Found") ||
            pageTitle.includes("Timeout")
          ) {
            throw new Error(`Page shows error: ${pageTitle}`);
          }

          return response;
        }, "Navigation");
        console.log(`✅ Navigation completed successfully`);

        // Enhanced wait for content to load with multiple strategies
        console.log(
          `\n⏳ [${new Date().toISOString()}] Waiting for content to fully load...`
        );

        // Strategy 1: Wait for network to be idle
        console.log(`   🔄 Waiting for network to be idle...`);
        await page.waitForNetworkIdle({
          idleTime: 1000, // Wait 1 second of no network activity
          timeout: 30000, // 30 second timeout
        });
        console.log(`✅ Network is idle`);

        // Strategy 2: Wait for specific content selectors
        console.log(`   🔍 Looking for .document-wrapper selector...`);
        await page.waitForSelector(".document-wrapper", { timeout: 30000 });
        console.log(`✅ Document wrapper found`);

        // Strategy 3: Wait for PDF content to be visible
        console.log(`   📄 Looking for PDF content...`);
        await page.waitForFunction(
          () => {
            const pdfPages = document.querySelectorAll(".react-pdf__Page");
            return (
              pdfPages.length > 0 &&
              Array.from(pdfPages).some(
                (page) => page.offsetWidth > 0 && page.offsetHeight > 0
              )
            );
          },
          { timeout: 30000 }
        );
        console.log(`✅ PDF content is visible`);

        // Strategy 4: Quick check if content is already rendered
        console.log(`   🔍 Checking if content is already rendered...`);

        // First, check what's actually available right now
        const currentContentStatus = await page.evaluate(() => {
          const pdfPages = document.querySelectorAll(".react-pdf__Page");
          const documentWrapper = document.querySelector(".document-wrapper");

          return {
            hasWrapper: !!documentWrapper,
            pageCount: pdfPages.length,
            pages: Array.from(pdfPages).map((page, index) => {
              const canvas = page.querySelector("canvas");
              const textContent = page.textContent || "";

              return {
                index,
                pageNumber: page.getAttribute("data-page-number"),
                hasDimensions:
                  page.offsetWidth > 100 && page.offsetHeight > 100,
                dimensions: {
                  width: page.offsetWidth,
                  height: page.offsetHeight,
                },
                hasCanvas: !!canvas,
                canvasDimensions: canvas
                  ? { width: canvas.width, height: canvas.height }
                  : null,
                textLength: textContent.trim().length,
                isVisible:
                  page.getBoundingClientRect().width > 0 &&
                  page.getBoundingClientRect().height > 0,
              };
            }),
          };
        });

        console.log(`   📊 Current content status:`, currentContentStatus);
        console.log(
          `   ℹ️ Note: textLength is 0 because PDF text is rendered in canvas, not as DOM text`
        );

        // If we already have good content, skip the complex waiting
        // Note: PDF text is rendered in canvas, not as DOM text, so textLength will be 0
        const hasGoodContent = currentContentStatus.pages.every(
          (page) => page.hasDimensions && page.hasCanvas
        );

        // We need to wait for the PDF content to actually be rendered
        // The pages exist but they don't have canvases yet because PDF content isn't rendered
        console.log(`   ⏳ Waiting for PDF content to be rendered...`);

        // Wait for the PDF viewer to actually start rendering content
        let pdfContentRendered = false;
        try {
          await page.waitForFunction(
            () => {
              const pdfPages = document.querySelectorAll(".react-pdf__Page");
              if (pdfPages.length === 0) return false;

              // Check if at least one page has actual PDF content (canvas)
              return Array.from(pdfPages).some((page) => {
                const hasDimensions =
                  page.offsetWidth > 100 && page.offsetHeight > 100;
                const hasCanvas = page.querySelector("canvas");
                return hasDimensions && hasCanvas;
              });
            },
            { timeout: 45000 } // Give more time for PDF rendering
          );
          pdfContentRendered = true;
          console.log(`   ✅ PDF content is now being rendered`);
        } catch (timeoutError) {
          console.log(
            `   ⚠️ PDF content rendering timeout (${timeoutError.message}), proceeding with fallback...`
          );
        }

        // Now wait specifically for our required pages to have canvases
        const pagesToCheck = pagesToProcess.slice(0, 2); // Only check first 2 pages for now
        const pagesWithCanvas = [];

        for (const pageNum of pagesToCheck) {
          try {
            console.log(`   🔍 Waiting for page ${pageNum} to have canvas...`);
            await page.waitForFunction(
              (targetPageNum) => {
                const pageElement = document.querySelector(
                  `.react-pdf__Page[data-page-number="${targetPageNum}"]`
                );
                if (!pageElement) return false;

                const hasDimensions =
                  pageElement.offsetWidth > 100 &&
                  pageElement.offsetHeight > 100;
                const hasCanvas = pageElement.querySelector("canvas");

                return hasDimensions && hasCanvas;
              },
              { timeout: 30000 }, // Increased timeout for PDF rendering
              pageNum
            );
            pagesWithCanvas.push(pageNum);
            console.log(`   ✅ Page ${pageNum} now has canvas`);
          } catch (timeoutError) {
            console.log(
              `   ⚠️ Page ${pageNum} canvas timeout (${timeoutError.message}), will attempt capture anyway...`
            );
          }
        }

        if (pagesWithCanvas.length > 0) {
          console.log(
            `✅ ${pagesWithCanvas.length}/${pagesToCheck.length} pages have canvases, proceeding with capture`
          );
        } else {
          console.log(
            `⚠️ No pages have canvases yet, but proceeding with capture attempt as fallback`
          );
        }

        // Brief wait for any final rendering
        console.log(`   ⏳ Brief wait for final rendering...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log(`✅ Ready for capture`);

        // Wait for PDF viewer to be ready
        console.log(`   Looking for PDF viewer...`);
        await page.waitForSelector(".react-pdf__Document", { timeout: 30000 });
        console.log(`✅ PDF viewer found and loaded`);

        // Validate that the specific pages we need are ready (with fallback)
        console.log(`   🔍 Validating required pages...`);
        const contentValidation = await page.evaluate((requiredPages) => {
          const documentWrapper = document.querySelector(".document-wrapper");
          if (!documentWrapper) {
            return { valid: false, reason: "Document wrapper not found" };
          }

          // Check only the pages we need
          const requiredPagesReady = requiredPages.every((pageNum) => {
            const pageElement = document.querySelector(
              `.react-pdf__Page[data-page-number="${pageNum}"]`
            );
            if (!pageElement) return false;

            const hasDimensions =
              pageElement.offsetWidth > 100 && pageElement.offsetHeight > 100;
            const hasCanvas = pageElement.querySelector("canvas");

            return hasDimensions && hasCanvas;
          });

          // Fallback: if pages don't have canvases, check if they at least have dimensions
          if (!requiredPagesReady) {
            const pagesWithDimensions = requiredPages.every((pageNum) => {
              const pageElement = document.querySelector(
                `.react-pdf__Page[data-page-number="${pageNum}"]`
              );
              if (!pageElement) return false;

              const hasDimensions =
                pageElement.offsetWidth > 100 && pageElement.offsetHeight > 100;

              return hasDimensions; // Don't require canvas for fallback
            });

            if (pagesWithDimensions) {
              return {
                valid: true,
                requiredPages: requiredPages,
                fallback: true, // Mark as fallback mode
                reason: "Pages have dimensions but no canvases (fallback mode)",
              };
            }

            return { valid: false, reason: "Required pages not ready" };
          }

          return {
            valid: true,
            requiredPages: requiredPages,
            fallback: false,
            wrapperDimensions: {
              width: documentWrapper.offsetWidth,
              height: documentWrapper.offsetHeight,
            },
          };
        }, pagesToCheck);

        if (!contentValidation.valid) {
          throw new Error(
            `Content validation failed: ${contentValidation.reason}`
          );
        }

        console.log(`✅ Content validation passed:`);
        console.log(
          `   - Required pages: ${contentValidation.requiredPages.join(", ")}`
        );
        if (contentValidation.fallback) {
          console.log(
            `   ⚠️ Running in fallback mode (pages have dimensions but no canvases)`
          );
        }
        console.log(
          `   - Wrapper dimensions: ${contentValidation.wrapperDimensions.width}x${contentValidation.wrapperDimensions.height}`
        );

        // Wait for initial page to load
        console.log(`   Waiting for initial page to load...`);
        await page.waitForSelector(".react-pdf__Page", { timeout: 30000 });
        console.log(`✅ Initial page loaded`);

        // Wait for all pages to be available in the DOM
        console.log(`   Waiting for all pages to be available...`);
        await page.waitForFunction(
          () => {
            const pageElements = document.querySelectorAll(".react-pdf__Page");
            const totalPages = pageElements.length;
            console.log(`Found ${totalPages} page elements in DOM`);
            return totalPages > 0;
          },
          { timeout: 30000 }
        );

        // Get total pages count
        const totalPagesInViewer = await page.evaluate(() => {
          const pageElements = document.querySelectorAll(".react-pdf__Page");
          return pageElements.length;
        });
        console.log(`✅ PDF viewer has ${totalPagesInViewer} pages available`);

        // Verify we have all the pages we need
        if (totalPagesInViewer < pagesToProcess.length) {
          console.log(
            `⚠️ Warning: PDF viewer has ${totalPagesInViewer} pages, but we need to process ${pagesToProcess.length} pages`
          );
        }

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

              // // Debug: Check what pages are currently visible
              // console.log(`      🔍 Checking visible pages before capture...`);
              // const visiblePages = await page.evaluate(() => {
              //   const pageElements =
              //     document.querySelectorAll(".react-pdf__Page");
              //   return Array.from(pageElements).map((el) => ({
              //     pageNumber: el.getAttribute("data-page-number"),
              //     visible: el.offsetParent !== null,
              //     rect: el.getBoundingClientRect(),
              //   }));
              // });
              // console.log(`      📊 Visible pages:`, visiblePages);

              console.log(
                `      🎯 [${new Date().toISOString()}] Starting capture for page ${pageNum}...`
              );

              // Retry capture if content isn't loaded properly
              let captureResult;
              let captureAttempts = 0;
              const maxCaptureAttempts = 3;

              while (captureAttempts < maxCaptureAttempts) {
                captureAttempts++;
                console.log(
                  `      📸 Capture attempt ${captureAttempts}/${maxCaptureAttempts}...`
                );

                try {
                  captureResult = await capturePageView(
                    page,
                    pageNum,
                    viewType,
                    currentOperation,
                    totalOperations
                  );

                  // Validate the capture actually has content
                  if (captureResult.success && captureResult.imageData) {
                    const hasContent = await validateCaptureContent(
                      page,
                      pageNum
                    );
                    if (hasContent) {
                      console.log(
                        `      ✅ Capture successful with content on attempt ${captureAttempts}`
                      );
                      break;
                    } else {
                      console.log(
                        `      ⚠️ Capture succeeded but no content detected, retrying...`
                      );
                      if (captureAttempts < maxCaptureAttempts) {
                        await new Promise((resolve) =>
                          setTimeout(resolve, 2000)
                        ); // Wait 2 seconds before retry
                        continue;
                      }
                    }
                  }
                } catch (captureError) {
                  console.log(
                    `      ❌ Capture attempt ${captureAttempts} failed: ${captureError.message}`
                  );
                  if (captureAttempts < maxCaptureAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                    continue;
                  } else {
                    throw captureError; // Re-throw if all attempts failed
                  }
                }
              }

              console.log(
                `      📊 [${new Date().toISOString()}] Capture result for page ${pageNum}:`,
                {
                  success: captureResult.success,
                  hasImageBuffer: !!captureResult.imageBuffer,
                  imageSize: captureResult.imageBuffer?.length || 0,
                  dimensions: captureResult.success
                    ? `${captureResult.pageWidth}x${captureResult.pageHeight}`
                    : "N/A",
                  error: captureResult.error || "None",
                }
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
                console.log(`   📋 OCR request details:`, {
                  pageNumber: pageNum,
                  viewType,
                  imageSize: captureResult.imageBuffer.length,
                  dimensions: `${captureResult.pageWidth}x${captureResult.pageHeight}`,
                  projectId,
                });

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

                console.log(`   📊 OCR result for page ${pageNum}:`, {
                  success: ocrResult.success,
                  hasData: !!ocrResult.data,
                  error: ocrResult.error || "None",
                });

                if (ocrResult.success) {
                  const operationDuration = Date.now() - operationStartTime;
                  console.log(
                    `   ✅ OCR processing successful (${operationDuration}ms)`
                  );

                  // Debug: Log the actual OCR response structure
                  console.log(`   🔍 [OCR Debug] Response structure:`);
                  console.log(`      - Has data: ${!!ocrResult.data}`);
                  console.log(
                    `      - Data keys: ${Object.keys(
                      ocrResult.data || {}
                    ).join(", ")}`
                  );
                  console.log(
                    `      - Has styled_layout: ${!!ocrResult.data
                      ?.styled_layout}`
                  );
                  if (ocrResult.data?.styled_layout) {
                    console.log(
                      `      - Styled layout keys: ${Object.keys(
                        ocrResult.data.styled_layout
                      ).join(", ")}`
                    );
                    if (ocrResult.data.styled_layout.pages) {
                      console.log(
                        `      - Pages array length: ${ocrResult.data.styled_layout.pages.length}`
                      );
                      if (ocrResult.data.styled_layout.pages.length > 0) {
                        const firstPage = ocrResult.data.styled_layout.pages[0];
                        console.log(
                          `      - First page keys: ${Object.keys(
                            firstPage
                          ).join(", ")}`
                        );
                        if (firstPage.entities) {
                          console.log(
                            `      - First page entities length: ${firstPage.entities.length}`
                          );
                          if (firstPage.entities.length > 0) {
                            const firstEntity = firstPage.entities[0];
                            console.log(
                              `      - First entity keys: ${Object.keys(
                                firstEntity
                              ).join(", ")}`
                            );
                            console.log(
                              `      - First entity text: "${
                                firstEntity.text || "NO TEXT"
                              }"`
                            );
                          }
                        }
                      }
                    }
                  }

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

      // Translate OCR results if translation is enabled
      let translatedResults = results;

      // Check for translation parameters (support both translateTo and desiredLanguage)
      const targetLanguage =
        req.body.translateTo ||
        req.body.desiredLanguage ||
        req.body.projectData?.desiredLanguage;

      // Initialize translation variables in the outer scope
      let allTexts = [];
      let textMap = new Map();

      console.log(`🔍 [TRANSLATION] Translation check:`);
      console.log(`   - translateTo: ${req.body.translateTo || "NOT SET"}`);
      console.log(
        `   - desiredLanguage: ${req.body.desiredLanguage || "NOT SET"}`
      );
      console.log(
        `   - projectData.desiredLanguage: ${
          req.body.projectData?.desiredLanguage || "NOT SET"
        }`
      );
      console.log(`   - Target Language: ${targetLanguage || "NOT SET"}`);
      console.log(
        `   - GOOGLE_TRANSLATE_API_KEY: ${
          GOOGLE_TRANSLATE_API_KEY ? "SET" : "NOT SET"
        }`
      );
      console.log(
        `   - Translation enabled: ${!!(
          targetLanguage && GOOGLE_TRANSLATE_API_KEY
        )}`
      );

      // Debug request body
      console.log(`🔍 [REQUEST DEBUG] Request body analysis:`);
      console.log(
        `   - req.body keys: ${Object.keys(req.body || {}).join(", ")}`
      );
      console.log(`   - req.body content:`, JSON.stringify(req.body, null, 2));
      console.log(
        `   - req.headers content-type: ${req.headers["content-type"]}`
      );

      if (targetLanguage && GOOGLE_TRANSLATE_API_KEY) {
        try {
          console.log(
            `🌐 [TRANSLATION] Starting translation of OCR results to ${targetLanguage}...`
          );

          console.log(
            `🔍 [TRANSLATION] Analyzing ${results.length} OCR results for text extraction...`
          );

          results.forEach((result, resultIndex) => {
            console.log(
              `   📄 [TRANSLATION] Analyzing result ${resultIndex + 1}:`
            );
            console.log(
              `      - Page: ${result.pageNumber}, View: ${result.viewType}`
            );
            console.log(
              `      - Has extractedText: ${!!result.extractedText}, Length: ${
                result.extractedText?.length || 0
              }`
            );
            console.log(`      - Has ocrResult: ${!!result.ocrResult}`);
            console.log(
              `      - Has styled_layout: ${!!result.ocrResult?.styled_layout}`
            );

            // Extract text from extractedText array
            if (result.extractedText && result.extractedText.length > 0) {
              result.extractedText.forEach((textItem, textIndex) => {
                if (textItem.text && textItem.text.trim()) {
                  const text = textItem.text.trim();
                  allTexts.push(text);
                  textMap.set(text, null);
                  console.log(`      - Text ${textIndex + 1}: "${text}"`);
                }
              });
            }

            // Extract text from styled_layout entities (this is what the frontend actually uses)
            if (result.ocrResult && result.ocrResult.styled_layout) {
              if (
                result.ocrResult.styled_layout.entities &&
                result.ocrResult.styled_layout.entities.length > 0
              ) {
                console.log(
                  `      - Found ${result.ocrResult.styled_layout.entities.length} entities in styled_layout`
                );
                result.ocrResult.styled_layout.entities.forEach(
                  (entity, entityIndex) => {
                    if (entity.text && entity.text.trim()) {
                      const text = entity.text.trim();
                      if (!textMap.has(text)) {
                        // Avoid duplicates
                        allTexts.push(text);
                        textMap.set(text, null);
                        console.log(
                          `      - Entity ${entityIndex + 1}: "${text}"`
                        );
                      }
                    }
                  }
                );
              }

              if (
                result.ocrResult.styled_layout.pages &&
                result.ocrResult.styled_layout.pages.length > 0
              ) {
                console.log(
                  `      - Found ${result.ocrResult.styled_layout.pages.length} pages in styled_layout`
                );
                result.ocrResult.styled_layout.pages.forEach(
                  (page, pageIndex) => {
                    if (page.entities && page.entities.length > 0) {
                      console.log(
                        `      - Page ${pageIndex + 1} has ${
                          page.entities.length
                        } entities`
                      );
                      page.entities.forEach((entity, entityIndex) => {
                        if (entity.text && entity.text.trim()) {
                          const text = entity.text.trim();
                          if (!textMap.has(text)) {
                            // Avoid duplicates
                            allTexts.push(text);
                            textMap.set(text, null);
                            console.log(
                              `      - Page ${pageIndex + 1} Entity ${
                                entityIndex + 1
                              }: "${text}"`
                            );
                          }
                        }
                      });
                    }
                  }
                );
              }
            }
          });

          if (allTexts.length > 0) {
            console.log(
              `🌐 [TRANSLATION] Found ${allTexts.length} texts to translate:`
            );
            allTexts.forEach((text, index) => {
              console.log(`   ${index + 1}. "${text}"`);
            });

            console.log(`🌐 [TRANSLATION] Starting batch translation...`);

            // Translate all texts in batch
            const translatedTexts = await translateMultipleTexts(
              allTexts,
              targetLanguage,
              req.body.translateFrom ||
                req.body.projectData?.sourceLanguage ||
                "auto"
            );

            console.log(
              `🌐 [TRANSLATION] Translation completed, updating text map...`
            );

            // Update the text map with translations
            allTexts.forEach((originalText, index) => {
              const translatedText = translatedTexts[index];
              textMap.set(originalText, translatedText);
              console.log(`   "${originalText}" → "${translatedText}"`);
            });

            // Create translated results
            translatedResults = results.map((result) => {
              const translatedResult = { ...result };

              if (result.extractedText && result.extractedText.length > 0) {
                translatedResult.extractedText = result.extractedText.map(
                  (textItem) => {
                    const originalText = textItem.text;
                    const translatedText = textMap.get(originalText.trim());
                    const wasTranslated = !!translatedText;

                    return {
                      ...textItem,
                      text: translatedText || originalText,
                      originalText: originalText, // Always keep original text
                      translated: wasTranslated,
                      targetLanguage: wasTranslated ? targetLanguage : null,
                      translationStatus: wasTranslated ? "success" : "failed",
                    };
                  }
                );
              }

              // Also translate styled_layout if it exists
              if (result.ocrResult && result.ocrResult.styled_layout) {
                translatedResult.ocrResult = { ...result.ocrResult };

                // Translate entities in styled_layout
                if (result.ocrResult.styled_layout.entities) {
                  translatedResult.ocrResult.styled_layout.entities =
                    result.ocrResult.styled_layout.entities.map((entity) => {
                      const originalText = entity.text;
                      const translatedText = textMap.get(originalText.trim());
                      const wasTranslated = !!translatedText;

                      return {
                        ...entity,
                        text: translatedText || originalText,
                        originalText: originalText, // Always keep original text
                        translated: wasTranslated,
                        targetLanguage: wasTranslated ? targetLanguage : null,
                        translationStatus: wasTranslated ? "success" : "failed",
                      };
                    });
                }

                // Translate pages if they exist
                if (result.ocrResult.styled_layout.pages) {
                  translatedResult.ocrResult.styled_layout.pages =
                    result.ocrResult.styled_layout.pages.map((page) => {
                      if (page.entities) {
                        page.entities = page.entities.map((entity) => {
                          const originalText = entity.text;
                          const translatedText = textMap.get(
                            originalText.trim()
                          );
                          const wasTranslated = !!translatedText;

                          return {
                            ...entity,
                            text: translatedText || originalText,
                            originalText: originalText, // Always keep original text
                            translated: wasTranslated,
                            targetLanguage: wasTranslated
                              ? targetLanguage
                              : null,
                            translationStatus: wasTranslated
                              ? "success"
                              : "failed",
                          };
                        });
                      }
                      return page;
                    });
                }
              }

              return translatedResult;
            });

            // Count successful vs failed translations
            const successfulTranslations = allTexts.filter(
              (text) => textMap.get(text.trim()) !== null
            ).length;
            const failedTranslations = allTexts.length - successfulTranslations;

            console.log(
              `✅ [TRANSLATION] Translation summary: ${successfulTranslations} successful, ${failedTranslations} failed out of ${allTexts.length} total texts`
            );
            console.log(`🌐 [TRANSLATION] Target language: ${targetLanguage}`);
            console.log(`📤 [TRANSLATION] Frontend will receive:`);
            console.log(`   - Translated text in 'text' field`);
            console.log(`   - Original text in 'originalText' field`);
            console.log(
              `   - Translation status in 'translated' and 'translationStatus' fields`
            );

            // Log what was actually translated in the final results
            console.log(`🔍 [TRANSLATION] Final translation summary:`);
            translatedResults.forEach((result, resultIndex) => {
              console.log(
                `   📄 Result ${resultIndex + 1} (Page ${
                  result.pageNumber
                }, View ${result.viewType}):`
              );

              if (result.extractedText && result.extractedText.length > 0) {
                console.log(
                  `      - ExtractedText: ${result.extractedText.length} items`
                );
                result.extractedText.forEach((textItem, textIndex) => {
                  if (textItem.translated) {
                    console.log(
                      `         ${textIndex + 1}. "${
                        textItem.originalText
                      }" → "${textItem.text}"`
                    );
                  }
                });
              }

              if (result.ocrResult?.styled_layout?.entities) {
                console.log(
                  `      - StyledLayout Entities: ${result.ocrResult.styled_layout.entities.length} items`
                );
                result.ocrResult.styled_layout.entities.forEach(
                  (entity, entityIndex) => {
                    if (entity.translated) {
                      console.log(
                        `         ${entityIndex + 1}. "${
                          entity.originalText
                        }" → "${entity.text}"`
                      );
                    }
                  }
                );
              }
            });
          } else {
            console.log(`ℹ️ [TRANSLATION] No texts found to translate`);
            console.log(`🔍 [TRANSLATION] Debug info:`);
            results.forEach((result, resultIndex) => {
              console.log(`   Result ${resultIndex + 1}:`);
              console.log(
                `      - extractedText: ${
                  result.extractedText?.length || 0
                } items`
              );
              console.log(
                `      - styled_layout.entities: ${
                  result.ocrResult?.styled_layout?.entities?.length || 0
                } items`
              );
              console.log(
                `      - styled_layout.pages: ${
                  result.ocrResult?.styled_layout?.pages?.length || 0
                } pages`
              );
            });
          }
        } catch (translationError) {
          console.error(
            `❌ [TRANSLATION] Failed to translate OCR results:`,
            translationError.message
          );
          console.log(
            `⚠️ [TRANSLATION] Returning original (untranslated) results`
          );
          translatedResults = results;
        }
      } else {
        console.log(
          `ℹ️ [TRANSLATION] Translation not enabled or API key missing`
        );
        // Ensure allTexts is defined even when translation is disabled
        if (allTexts.length === 0) {
          // Extract texts for metadata even without translation
          results.forEach((result) => {
            if (result.extractedText && result.extractedText.length > 0) {
              result.extractedText.forEach((textItem) => {
                if (textItem.text && textItem.text.trim()) {
                  allTexts.push(textItem.text.trim());
                }
              });
            }
            if (result.ocrResult?.styled_layout?.entities) {
              result.ocrResult.styled_layout.entities.forEach((entity) => {
                if (entity.text && entity.text.trim()) {
                  allTexts.push(entity.text.trim());
                }
              });
            }
          });
        }
      }

      const response = {
        success: true,
        data: {
          projectId,
          totalPages: pagesToProcess.length,
          totalViews: viewsToProcess.length,
          processedPages: results.length,
          results: translatedResults, // Use translated results
          originalResults: results, // Keep original results for reference
          errors,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          duration,
          successRate: Math.round((results.length / totalOperations) * 100),
          translation: targetLanguage
            ? {
                targetLanguage: targetLanguage,
                sourceLanguage:
                  req.body.translateFrom ||
                  req.body.projectData?.sourceLanguage ||
                  "auto",
                translated: true,
                totalTextsTranslated: allTexts.length,
                successfulTranslations: allTexts.filter(
                  (text) => textMap.get(text.trim()) !== null
                ).length,
                failedTranslations: allTexts.filter(
                  (text) => textMap.get(text.trim()) === null
                ).length,
                translationStatus: "completed",
                translationMetadata: {
                  apiKeyValid: !!GOOGLE_TRANSLATE_API_KEY,
                  targetLanguage: targetLanguage,
                  sourceLanguage:
                    req.body.translateFrom ||
                    req.body.projectData?.sourceLanguage ||
                    "auto",
                },
              }
            : null,
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

      // Ensure page is closed even if there's an error
      if (page) {
        try {
          await page.close();
          console.log(`✅ Puppeteer page closed after error`);
        } catch (closeError) {
          console.log(
            `⚠️ Error closing page after error: ${closeError.message}`
          );
        }
      }

      // Check if it's a connection error and try to restart browser
      if (
        error.message.includes("Connection closed") ||
        error.message.includes("Protocol error")
      ) {
        console.log(
          `🔄 Connection error detected, attempting browser restart...`
        );
        try {
          await restartBrowser();
          console.log(
            `✅ Browser restarted successfully after connection error`
          );
        } catch (restartError) {
          console.error(
            `💥 Failed to restart browser after connection error: ${restartError.message}`
          );
        }
      }

      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
        timestamp: new Date().toISOString(),
        browserRestarted:
          error.message.includes("Connection closed") ||
          error.message.includes("Protocol error"),
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

    // Check if page is still valid before proceeding
    if (!page || page.isClosed()) {
      throw new Error("Page is closed or invalid");
    }

    // Navigate to the specific page if needed
    console.log(`      🧭 Navigating to page ${pageNumber}...`);

    try {
      // First, try to find the page element
      let pageElement = await page.$(
        `.react-pdf__Page[data-page-number="${pageNumber}"]`
      );

      console.log(`      🔍 Page ${pageNumber} element found:`, !!pageElement);

      if (!pageElement) {
        console.log(
          `      ⚠️ Page ${pageNumber} not visible, attempting to navigate...`
        );

        // Try multiple navigation strategies
        let navigationSuccess = false;

        // Strategy 1: Try to click on page navigation if available
        try {
          const pageNavButton = await page.$(
            `[data-page-number="${pageNumber}"]`
          );
          if (pageNavButton) {
            console.log(
              `      🖱️ Clicking page navigation for page ${pageNumber}...`
            );
            await pageNavButton.click();
            await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait for page change
            navigationSuccess = true;
          }
        } catch (clickError) {
          console.log(
            `      ⚠️ Click navigation failed: ${clickError.message}`
          );
        }

        // Strategy 2: Try to scroll to the page if it exists but is not visible
        if (!navigationSuccess) {
          try {
            console.log(
              `      📜 Attempting to scroll to page ${pageNumber}...`
            );
            await page.evaluate((pageNum) => {
              const pageElement = document.querySelector(
                `.react-pdf__Page[data-page-number="${pageNum}"]`
              );
              if (pageElement) {
                pageElement.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }
            }, pageNumber);
            await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait for scroll
            navigationSuccess = true;
          } catch (scrollError) {
            console.log(
              `      ⚠️ Scroll navigation failed: ${scrollError.message}`
            );
          }
        }

        // Strategy 3: Try to use keyboard navigation
        if (!navigationSuccess) {
          try {
            console.log(
              `      ⌨️ Attempting keyboard navigation to page ${pageNumber}...`
            );
            // Press Page Down multiple times to navigate
            for (let i = 1; i < pageNumber; i++) {
              await page.keyboard.press("PageDown");
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
            navigationSuccess = true;
          } catch (keyboardError) {
            console.log(
              `      ⚠️ Keyboard navigation failed: ${keyboardError.message}`
            );
          }
        }

        if (!navigationSuccess) {
          console.log(
            `      ⚠️ All navigation strategies failed for page ${pageNumber}`
          );
        }
      }
    } catch (navError) {
      console.log(`      ⚠️ Navigation attempt failed: ${navError.message}`);
    }

    // Wait for the specific page to be visible with retry logic
    console.log(
      `      ⏳ Waiting for page element with data-page-number="${pageNumber}"...`
    );

    let pageElementFound = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.waitForSelector(
          `.react-pdf__Page[data-page-number="${pageNumber}"]`,
          { timeout: 15000 } // Increased timeout for page navigation
        );
        pageElementFound = true;
        break;
      } catch (error) {
        console.log(
          `      ⚠️ Page element wait attempt ${attempt}/3 failed: ${error.message}`
        );

        if (attempt === 3) {
          throw new Error(
            `Failed to find page element after 3 attempts: ${error.message}`
          );
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!pageElementFound) {
      throw new Error("Page element not found after retries");
    }

    console.log(`      ✅ Page element found successfully`);

    // Get page dimensions with error handling
    console.log(`      📏 Getting page dimensions...`);
    let pageDimensions;

    try {
      pageDimensions = await page.evaluate(
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
    } catch (evaluateError) {
      console.log(
        `      ❌ Failed to evaluate page dimensions: ${evaluateError.message}`
      );
      return {
        success: false,
        error: `Page evaluation failed: ${evaluateError.message}`,
      };
    }

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

    // Page-specific waiting strategy - quick check if page is ready
    console.log(
      `      🎯 Checking if page ${pageNumber} is ready for capture...`
    );

    // Quick check of current page status
    const pageStatus = await page.evaluate((pageNum) => {
      const pageElement = document.querySelector(
        `.react-pdf__Page[data-page-number="${pageNum}"]`
      );
      if (!pageElement)
        return { ready: false, reason: "Page element not found" };

      const canvas = pageElement.querySelector("canvas");
      const textContent = pageElement.textContent || "";

      return {
        ready:
          pageElement.offsetWidth > 100 &&
          pageElement.offsetHeight > 100 &&
          !!canvas &&
          canvas.width > 100 &&
          canvas.height > 100,
        // Note: textLength will be 0 for PDFs since text is rendered in canvas
        dimensions: {
          width: pageElement.offsetWidth,
          height: pageElement.offsetHeight,
        },
        hasCanvas: !!canvas,
        canvasDimensions: canvas
          ? { width: canvas.width, height: canvas.height }
          : null,
        textLength: textContent.trim().length,
      };
    }, pageNumber);

    if (pageStatus.ready) {
      console.log(`      ✅ Page ${pageNumber} is already ready:`, pageStatus);
    } else {
      console.log(
        `      ⏳ Page ${pageNumber} not ready, waiting...`,
        pageStatus
      );

      // Simple wait for page to be ready
      await page.waitForFunction(
        (pageNum) => {
          const pageElement = document.querySelector(
            `.react-pdf__Page[data-page-number="${pageNum}"]`
          );
          if (!pageElement) return false;

          const canvas = pageElement.querySelector("canvas");
          const textContent = pageElement.textContent || "";

          return (
            pageElement.offsetWidth > 100 &&
            pageElement.offsetHeight > 100 &&
            !!canvas &&
            canvas.width > 100 &&
            canvas.height > 100
          );
        },
        { timeout: 15000 },
        pageNumber
      );

      console.log(`      ✅ Page ${pageNumber} is now ready for capture`);
    }

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
        let imageDataUrl;
        try {
          imageDataUrl = await page.evaluate(
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
        } catch (captureError) {
          console.log(
            `      ⚠️ dom-to-image capture failed: ${captureError.message}`
          );

          // Fallback: try to capture even without canvas
          console.log(`      🔄 Attempting fallback capture...`);
          try {
            imageDataUrl = await page.evaluate(
              async (pageNum, view) => {
                const pageElement = document.querySelector(
                  `.react-pdf__Page[data-page-number="${pageNum}"]`
                );
                if (!pageElement) throw new Error("Page element not found");

                // Try to capture the page element even without canvas
                if (window.domtoimage && window.domtoimage.toPng) {
                  try {
                    console.log(
                      `      🎯 Using fallback dom-to-image capture...`
                    );
                    const dataUrl = await window.domtoimage.toPng(pageElement, {
                      quality: 0.8, // Lower quality for fallback
                      bgcolor: "#ffffff",
                      width: pageElement.offsetWidth,
                      height: pageElement.offsetHeight,
                    });
                    return dataUrl;
                  } catch (fallbackError) {
                    throw new Error(
                      `Fallback capture failed: ${fallbackError.message}`
                    );
                  }
                } else {
                  throw new Error("dom-to-image not available for fallback");
                }
              },
              pageNumber,
              viewType
            );
            console.log(`      ✅ Fallback capture successful`);
          } catch (fallbackError) {
            console.log(
              `      💥 Fallback capture also failed: ${fallbackError.message}`
            );
            throw new Error(
              `All capture methods failed: ${captureError.message}, fallback: ${fallbackError.message}`
            );
          }
        }

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
        let elementBounds = await page.evaluate((pageNum) => {
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

        // Fallback: if element bounds not found, try to get any page element
        if (!elementBounds) {
          console.log(
            `      ⚠️ Could not determine element bounds, trying fallback...`
          );
          elementBounds = await page.evaluate((pageNum) => {
            // Try to find any page element with dimensions
            const pageElements = document.querySelectorAll(".react-pdf__Page");
            for (const element of pageElements) {
              if (element.offsetWidth > 100 && element.offsetHeight > 100) {
                const rect = element.getBoundingClientRect();
                return {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                };
              }
            }
            return null;
          }, pageNumber);
        }

        if (!elementBounds) {
          throw new Error(
            "Could not determine element bounds for screenshot, even with fallback"
          );
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
  console.log(`🔍 [Text Extraction] Analyzing styled_layout structure...`);
  console.log(`   - Keys: ${Object.keys(styledLayout).join(", ")}`);

  // Handle the actual OCR response structure
  if (styledLayout.pages && Array.isArray(styledLayout.pages)) {
    console.log(`   - Found ${styledLayout.pages.length} pages`);

    styledLayout.pages.forEach((page, pageIndex) => {
      console.log(`   - Page ${pageIndex + 1}:`);
      console.log(`     - Keys: ${Object.keys(page).join(", ")}`);

      if (page.entities && Array.isArray(page.entities)) {
        console.log(`     - Found ${page.entities.length} entities`);

        page.entities.forEach((entity, entityIndex) => {
          if (entity.text && entity.text.trim()) {
            console.log(`     - Entity ${entityIndex + 1}: "${entity.text}"`);
            textElements.push({
              text: entity.text.trim(),
              boundingBox: entity.bounding_box || entity.boundingBox,
              confidence: entity.confidence,
              pageNumber: pageIndex + 1,
              viewType: "original",
              entity: entity, // Keep the full entity for reference
            });
          }
        });
      }
    });
  }

  // Also check for direct entities (fallback)
  if (styledLayout.entities && Array.isArray(styledLayout.entities)) {
    console.log(`   - Found ${styledLayout.entities.length} direct entities`);

    styledLayout.entities.forEach((entity, entityIndex) => {
      if (entity.text && entity.text.trim()) {
        console.log(`   - Direct Entity ${entityIndex + 1}: "${entity.text}"`);
        textElements.push({
          text: entity.text.trim(),
          boundingBox: entity.bounding_box || entity.boundingBox,
          confidence: entity.confidence,
          pageNumber: 1, // Default page number
          viewType: "original",
          entity: entity, // Keep the full entity for reference
        });
      }
    });
  }

  console.log(`   - Total text elements extracted: ${textElements.length}`);
  return textElements;
}

// Function to extract text elements from styled_layout
function extractTextElements(styledLayout) {
  // Use the same logic as extractTextFromStyledLayout for consistency
  return extractTextFromStyledLayout(styledLayout);
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
    try {
      await browser.close();
      console.log("✅ Browser closed successfully");
    } catch (error) {
      console.log(`⚠️ Error closing browser: ${error.message}`);
    }
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  if (browser) {
    try {
      await browser.close();
      console.log("✅ Browser closed successfully");
    } catch (error) {
      console.log(`⚠️ Error closing browser: ${error.message}`);
    }
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  console.error("💥 Uncaught Exception:", error);
  console.error("Stack trace:", error.stack);

  if (browser) {
    try {
      await browser.close();
      console.log("✅ Browser closed after uncaught exception");
    } catch (closeError) {
      console.log(
        `⚠️ Error closing browser after exception: ${closeError.message}`
      );
    }
  }

  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason, promise) => {
  console.error("💥 Unhandled Promise Rejection:", reason);
  console.error("Promise:", promise);

  if (browser) {
    try {
      await browser.close();
      console.log("✅ Browser closed after unhandled rejection");
    } catch (closeError) {
      console.log(
        `⚠️ Error closing browser after rejection: ${closeError.message}`
      );
    }
  }

  process.exit(1);
});

// Function to validate that captured content actually has visible text
async function validateCaptureContent(page, pageNumber) {
  try {
    const contentCheck = await page.evaluate((targetPage) => {
      const pageElement = document.querySelector(
        `.react-pdf__Page[data-page-number="${targetPage}"]`
      );
      if (!pageElement) {
        return { hasContent: false, reason: "Page element not found" };
      }

      // Check if page has actual dimensions
      if (pageElement.offsetWidth < 100 || pageElement.offsetHeight < 100) {
        return { hasContent: false, reason: "Page has no dimensions" };
      }

      // Check if page has text content
      const textContent = pageElement.textContent || "";
      if (textContent.trim().length === 0) {
        return { hasContent: false, reason: "Page has no text content" };
      }

      // Check if page is actually visible (not hidden by CSS)
      const rect = pageElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return { hasContent: false, reason: "Page is not visible" };
      }

      return {
        hasContent: true,
        textLength: textContent.trim().length,
        dimensions: { width: rect.width, height: rect.height },
      };
    }, pageNumber);

    if (!contentCheck.hasContent) {
      console.log(`      ⚠️ Content validation failed: ${contentCheck.reason}`);
      return false;
    }

    console.log(
      `      ✅ Content validation passed: ${contentCheck.textLength} characters, ${contentCheck.dimensions.width}x${contentCheck.dimensions.height}`
    );
    return true;
  } catch (error) {
    console.log(`      ❌ Content validation error: ${error.message}`);
    return false;
  }
}

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

  // Start periodic browser health monitoring
  const healthCheckInterval = setInterval(async () => {
    try {
      if (!(await isBrowserHealthy())) {
        console.log(
          `⚠️ [${new Date().toISOString()}] Periodic health check failed, restarting browser...`
        );
        await restartBrowser();
      } else {
        // Log browser health status periodically (every 10th check to avoid spam)
        if (Math.random() < 0.1) {
          console.log(
            `🔍 [${new Date().toISOString()}] Browser health check passed - Browser is healthy`
          );
        }
      }
    } catch (error) {
      console.error(
        `💥 [${new Date().toISOString()}] Periodic health check error: ${
          error.message
        }`
      );
    }
  }, 30000); // Check every 30 seconds

  // Cleanup interval on process exit
  process.on("exit", () => {
    clearInterval(healthCheckInterval);
  });

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
    console.log(`🔍 Browser health monitoring active (every 30 seconds)\n`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
