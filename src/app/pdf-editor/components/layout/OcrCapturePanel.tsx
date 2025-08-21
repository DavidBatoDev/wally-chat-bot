import React from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  X,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Download,
} from "lucide-react";
import { OcrCaptureJob } from "../../hooks/useOcrCaptureService";

interface OcrCapturePanelProps {
  jobs: OcrCaptureJob[];
  isProcessing: boolean;
  onStartOcrCapture: () => void;
  onCancelJob: (jobId: string) => void;
  onClearCompletedJobs: () => void;
}

export const OcrCapturePanel: React.FC<OcrCapturePanelProps> = ({
  jobs,
  isProcessing,
  onStartOcrCapture,
  onCancelJob,
  onClearCompletedJobs,
}) => {
  const getStatusIcon = (status: OcrCaptureJob["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "cancelled":
        return <X className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: OcrCaptureJob["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const getJobSummary = (job: OcrCaptureJob) => {
    if (job.results) {
      const { totalPages, totalViews, processedPages, errors } = job.results;
      return {
        total: totalPages * totalViews,
        processed: processedPages,
        errors: errors?.length || 0,
      };
    }
    return { total: 0, processed: 0, errors: 0 };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center space-x-2">
          <FileText className="w-5 h-5" />
          <span>OCR Capture Service</span>
        </h3>
        <div className="flex space-x-2">
          <Button
            onClick={onStartOcrCapture}
            disabled={isProcessing}
            size="sm"
            className="flex items-center space-x-2"
          >
            <Play className="w-4 h-4" />
            <span>Start Capture</span>
          </Button>

          {isProcessing && (
            <Button
              onClick={() =>
                onCancelJob(
                  jobs.find((j) => j.status === "processing")?.id || ""
                )
              }
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Pause className="w-4 h-4" />
              <span>Cancel</span>
            </Button>
          )}

          <Button
            onClick={onClearCompletedJobs}
            variant="ghost"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear</span>
          </Button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>No OCR capture jobs</p>
          <p className="text-sm">
            Start an OCR capture job to process documents automatically
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const summary = getJobSummary(job);
            return (
              <div key={job.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(job.status)}
                    <Badge className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                    <span className="text-sm font-medium">OCR Capture Job</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {formatTime(job.updatedAt || job.startTime)}
                    </span>

                    {job.status === "processing" && (
                      <Button
                        onClick={() => onCancelJob(job.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {job.status === "processing" && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                    <div className="text-xs text-gray-500">
                      Processing OCR capture...
                    </div>
                  </div>
                )}

                {job.status === "completed" && job.results && (
                  <div className="space-y-2">
                    <div className="text-sm text-green-600 flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Successfully completed OCR capture</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-green-50 p-2 rounded">
                        <div className="font-medium text-green-800">
                          {summary.total}
                        </div>
                        <div className="text-green-600">Total Pages</div>
                      </div>
                      <div className="bg-blue-50 p-2 rounded">
                        <div className="font-medium text-blue-800">
                          {summary.processed}
                        </div>
                        <div className="text-blue-600">Processed</div>
                      </div>
                      <div className="bg-red-50 p-2 rounded">
                        <div className="font-medium text-red-800">
                          {summary.errors}
                        </div>
                        <div className="text-red-600">Errors</div>
                      </div>
                    </div>
                    {job.results.duration && (
                      <div className="text-xs text-gray-500">
                        Duration: {Math.round(job.results.duration / 1000)}s
                      </div>
                    )}
                  </div>
                )}

                {job.status === "failed" && job.error && (
                  <div className="text-sm text-red-600 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Error: {job.error}</span>
                  </div>
                )}

                {job.status === "cancelled" && (
                  <div className="text-sm text-gray-600 flex items-center space-x-2">
                    <X className="w-4 h-4" />
                    <span>Cancelled by user</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Service Status */}
      <div className="mt-6 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Service Status:</span>
          <Badge variant={isProcessing ? "default" : "secondary"}>
            {isProcessing ? "Processing" : "Idle"}
          </Badge>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {jobs.length > 0 &&
            `Active Jobs: ${
              jobs.filter((j) => j.status === "processing").length
            }`}
        </div>
      </div>
    </div>
  );
};

