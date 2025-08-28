import { useState, useCallback } from "react";
import { toast } from "sonner";

interface OcrCaptureOptions {
  projectId: string;
  captureUrl: string;
  pageNumbers?: number[];
  viewTypes?: ("original" | "translated" | "final-layout")[];
  ocrApiUrl: string;
  projectData?: any;
}

interface OcrCaptureJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  results?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export const useOcrCaptureService = () => {
  const [jobs, setJobs] = useState<OcrCaptureJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const startOcrCapture = useCallback(async (options: OcrCaptureOptions) => {
    const jobId = `ocr-capture-${Date.now()}`;

    const job: OcrCaptureJob = {
      id: jobId,
      status: "pending",
      progress: 0,
      startTime: new Date(),
    };

    setJobs((prev) => [...prev, job]);
    setIsProcessing(true);

    try {
      // Update job status
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, status: "processing", progress: 10 } : j
        )
      );

      // Make request to OCR capture service
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_OCR_CAPTURE_SERVICE_URL}/capture-and-ocr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: options.projectId,
            captureUrl: options.captureUrl,
            pageNumbers: options.pageNumbers?.join(","),
            viewTypes: options.viewTypes,
            ocrApiUrl: options.ocrApiUrl,
            projectData: options.projectData,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Update job as completed
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: "completed",
                  progress: 100,
                  results: result.data,
                  endTime: new Date(),
                }
              : j
          )
        );

        toast.success(
          `OCR capture completed! Processed ${result.data.processedPages} pages`
        );

        // Return results for further processing
        return result.data;
      } else {
        throw new Error(result.error || "OCR capture failed");
      }
    } catch (error) {
      console.error("OCR capture error:", error);

      // Update job as failed
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
                endTime: new Date(),
              }
            : j
        )
      );

      toast.error(
        `OCR capture failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const cancelJob = useCallback((jobId: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "cancelled" } : j))
    );
  }, []);

  const clearCompletedJobs = useCallback(() => {
    setJobs((prev) =>
      prev.filter(
        (j) =>
          j.status !== "completed" &&
          j.status !== "failed" &&
          j.status !== "cancelled"
      )
    );
  }, []);

  return {
    jobs,
    isProcessing,
    startOcrCapture,
    cancelJob,
    clearCompletedJobs,
  };
};
