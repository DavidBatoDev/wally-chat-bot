import { toast } from "sonner";

// Configuration
const PUPPETEER_SERVICE_URL =
  process.env.NEXT_PUBLIC_OCR_CAPTURE_SERVICE_URL || "http://localhost:3001";

export interface CapturedPage {
  pageNumber: number;
  viewType: "original" | "translated";
  imageData: string; // Base64 data URL
  timestamp: string;
  pageType?:
    | "social_media"
    | "birth_cert"
    | "nbi_clearance"
    | "dynamic_content";
  isTranslated?: boolean;
  error?: string;
}

export interface PageCaptureResponse {
  success: boolean;
  data?: {
    projectId: string;
    totalPages: number;
    nonDeletedPages: number[];
    deletedPages: number[];
    captures: CapturedPage[];
    summary: {
      totalPagesProcessed: number;
      totalCaptures: number;
      totalErrors: number;
      processingTime: number;
    };
  };
  error?: string;
  timestamp: string;
}

export interface PageCaptureOptions {
  projectId: string;
  captureUrl: string;
  quality?: number; // 1.0 = normal, 2.0 = high quality
  waitTime?: number; // milliseconds to wait between captures
  projectData?: any; // Optional project data
}

/**
 * Captures all non-deleted pages in both original and translated views using Puppeteer
 */
export async function captureAllPages(
  options: PageCaptureOptions
): Promise<PageCaptureResponse> {
  const {
    projectId,
    captureUrl,
    quality = 1.0,
    waitTime = 2000,
    projectData = null,
  } = options;

  try {
    console.log(`📸 Starting page capture for project: ${projectId}`);
    console.log(`   Capture URL: ${captureUrl}`);
    console.log(`   Quality: ${quality}`);

    const requestBody = {
      projectId,
      captureUrl,
      quality,
      waitTime,
      projectData,
    };

    const response = await fetch(`${PUPPETEER_SERVICE_URL}/capture-all-pages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const result: PageCaptureResponse = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    if (!result.success) {
      throw new Error(result.error || "Page capture failed");
    }

    console.log(`✅ Page capture completed successfully`);
    console.log(
      `   Total pages processed: ${result.data?.summary.totalPagesProcessed}`
    );
    console.log(`   Total captures: ${result.data?.summary.totalCaptures}`);
    console.log(`   Errors: ${result.data?.summary.totalErrors}`);

    try {
      const captures = result.data?.captures || [];
      const typeCounts: Record<string, number> = {};
      captures.forEach((c) => {
        const t = c.pageType || "(unset)";
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });
      console.log("🔎 Capture pageType counts:", typeCounts);
      console.log(
        "🔎 Sample captures:",
        captures.slice(0, 6).map((c) => ({
          pageNumber: c.pageNumber,
          viewType: c.viewType,
          pageType: c.pageType,
          hasError: !!c.error,
        }))
      );
    } catch {}

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`❌ Page capture failed:`, errorMessage);

    throw new Error(`Page capture failed: ${errorMessage}`);
  }
}

/**
 * Captures all pages for a project using the current browser window
 */
export async function captureCurrentProjectPages(
  projectId: string,
  options: Partial<PageCaptureOptions> = {}
): Promise<PageCaptureResponse> {
  // Construct the capture URL based on current location
  const currentUrl = window.location.href;
  let captureUrl = currentUrl;

  // If we're in the editor, construct the capture URL
  if (currentUrl.includes("/pdf-editor/")) {
    const baseUrl = currentUrl.split("/pdf-editor/")[0];
    captureUrl = `${baseUrl}/capture-project/${projectId}`;
  }

  // Try to include minimal projectData for Puppeteer (documentState only)
  let projectData = options.projectData;
  try {
    const docState = (window as any)?.__WALLY_DOC_STATE__;
    if (!projectData && docState) {
      projectData = { documentState: docState };
    }
  } catch {}

  return captureAllPages({
    projectId,
    captureUrl,
    ...options,
    projectData,
  });
}

/**
 * Downloads captured pages as individual images
 */
export function downloadCapturedPages(
  captures: CapturedPage[],
  projectId: string,
  format: "png" | "jpg" = "png"
): void {
  captures.forEach((capture) => {
    if (capture.error) return; // Skip failed captures

    try {
      // Create download link
      const link = document.createElement("a");

      // Convert to desired format if needed
      let imageData = capture.imageData;
      if (format === "jpg" && capture.imageData.includes("data:image/png")) {
        // Convert PNG to JPG if requested
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;

          // Fill with white background for JPG
          ctx!.fillStyle = "#ffffff";
          ctx!.fillRect(0, 0, canvas.width, canvas.height);

          ctx!.drawImage(img, 0, 0);
          imageData = canvas.toDataURL("image/jpeg", 0.9);

          link.href = imageData;
          link.download = `${projectId}_page_${capture.pageNumber}_${capture.viewType}.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        img.src = capture.imageData;
      } else {
        link.href = imageData;
        link.download = `${projectId}_page_${capture.pageNumber}_${capture.viewType}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error(
        `Failed to download page ${capture.pageNumber} - ${capture.viewType}:`,
        error
      );
      toast.error(
        `Failed to download page ${capture.pageNumber} - ${capture.viewType}`
      );
    }
  });

  toast.success(
    `Downloaded ${captures.filter((c) => !c.error).length} page captures`
  );
}

/**
 * Creates a ZIP file containing all captured pages
 */
export async function downloadCapturedPagesAsZip(
  captures: CapturedPage[],
  projectId: string
): Promise<void> {
  try {
    // Import JSZip dynamically to avoid bundle size issues
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const validCaptures = captures.filter((c) => !c.error);

    if (validCaptures.length === 0) {
      throw new Error("No valid captures to download");
    }

    // Add each capture to the ZIP
    validCaptures.forEach((capture) => {
      // Extract base64 data from data URL
      const base64Data = capture.imageData.split(",")[1];
      const filename = `page_${capture.pageNumber}_${capture.viewType}.png`;

      zip.file(filename, base64Data, { base64: true });
    });

    // Add a summary file
    const summary = {
      projectId,
      totalPages: validCaptures.length,
      captures: validCaptures.map((c) => ({
        pageNumber: c.pageNumber,
        viewType: c.viewType,
        pageType: c.pageType,
        isTranslated: c.isTranslated,
        timestamp: c.timestamp,
      })),
      createdAt: new Date().toISOString(),
    };

    zip.file("summary.json", JSON.stringify(summary, null, 2));

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: "blob" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(zipBlob);
    link.download = `${projectId}_page_captures.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up object URL
    URL.revokeObjectURL(link.href);

    toast.success(`Downloaded ${validCaptures.length} pages as ZIP file`);
  } catch (error) {
    console.error("Failed to create ZIP file:", error);
    toast.error("Failed to create ZIP file");
    throw error;
  }
}

/**
 * Utility function to check if the Puppeteer service is available
 */
export async function checkPuppeteerServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${PUPPETEER_SERVICE_URL}/health`, {
      method: "GET",
    });

    return response.ok;
  } catch (error) {
    console.warn("Puppeteer service health check failed:", error);
    return false;
  }
}

/**
 * Get service status information
 */
export async function getPuppeteerServiceStatus(): Promise<any> {
  try {
    const response = await fetch(`${PUPPETEER_SERVICE_URL}/status`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to get service status:", error);
    throw error;
  }
}

/**
 * Convert captured pages to the legacy SnapshotData format for compatibility
 */
export function convertCapturedPagesToSnapshots(
  captures: CapturedPage[]
): any[] {
  const snapshots: any[] = [];

  // Group captures by page number
  const pageGroups = new Map<
    number,
    { original?: CapturedPage; translated?: CapturedPage }
  >();

  captures.forEach((capture) => {
    if (!pageGroups.has(capture.pageNumber)) {
      pageGroups.set(capture.pageNumber, {});
    }

    const group = pageGroups.get(capture.pageNumber)!;
    if (capture.viewType === "original") {
      group.original = capture;
    } else if (capture.viewType === "translated") {
      group.translated = capture;
    }
  });

  // Convert to snapshot format
  pageGroups.forEach((group, pageNumber) => {
    if (
      group.original &&
      group.translated &&
      !group.original.error &&
      !group.translated.error
    ) {
      // Create a synthetic canvas to get dimensions
      const canvas = document.createElement("canvas");
      canvas.width = 800; // Default width
      canvas.height = 1000; // Default height

      snapshots.push({
        pageNumber,
        originalImage: group.original.imageData,
        translatedImage: group.translated.imageData,
        originalWidth: canvas.width,
        originalHeight: canvas.height,
        translatedWidth: canvas.width,
        translatedHeight: canvas.height,
        pageType: group.original.pageType || "dynamic_content",
      });
    }
  });

  try {
    const typeCounts: Record<string, number> = {};
    snapshots.forEach((s) => {
      const t = s.pageType || "(unset)";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    console.log("🔎 Snapshots pageType counts:", typeCounts);
    console.log(
      "🔎 Snapshot sample:",
      snapshots
        .slice(0, 6)
        .map((s) => ({ pageNumber: s.pageNumber, pageType: s.pageType }))
    );
  } catch {}

  return snapshots;
}
