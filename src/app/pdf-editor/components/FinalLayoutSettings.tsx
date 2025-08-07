import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Download,
  FileImage,
  FileText,
  Palette,
  Layout,
  Grid,
  Maximize2,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";

interface FinalLayoutSettingsProps {
  currentPage: number;
  totalPages: number;
  capturedSnapshots: any[];
  isCapturingSnapshots: boolean;
  onExportPDF: () => void;
  onExportPNG: () => void;
  onExportJPEG: () => void;
  onSaveProject: () => void;
  onPreviewToggle?: () => void;
  isPreviewMode?: boolean;
  // Saved settings props
  savedExportSettings?: {
    format: "pdf" | "png" | "jpg";
    quality: number;
    includeOriginal: boolean;
    includeTranslated: boolean;
    pageRange: "all" | "current" | "custom";
    customRange: string;
  };
  savedActiveTab?: "export" | "preview" | "settings";
  savedIsPreviewMode?: boolean;
  onSettingsChange?: (settings: {
    exportSettings: {
      format: "pdf" | "png" | "jpg";
      quality: number;
      includeOriginal: boolean;
      includeTranslated: boolean;
      pageRange: "all" | "current" | "custom";
      customRange: string;
    };
    activeTab: "export" | "preview" | "settings";
    isPreviewMode: boolean;
  }) => void;
}

export const FinalLayoutSettings: React.FC<FinalLayoutSettingsProps> = ({
  currentPage,
  totalPages,
  capturedSnapshots,
  isCapturingSnapshots,
  onExportPDF,
  onExportPNG,
  onExportJPEG,
  onSaveProject,
  onPreviewToggle,
  isPreviewMode = false,
  savedExportSettings,
  savedActiveTab,
  savedIsPreviewMode,
  onSettingsChange,
}) => {
  const [activeTab, setActiveTab] = useState<"export" | "preview" | "settings">(
    savedActiveTab || "export"
  );
  const [exportSettings, setExportSettings] = useState({
    format: (savedExportSettings?.format || "pdf") as "pdf" | "png" | "jpg",
    quality: savedExportSettings?.quality || 100,
    includeOriginal: savedExportSettings?.includeOriginal ?? true,
    includeTranslated: savedExportSettings?.includeTranslated ?? true,
    pageRange: (savedExportSettings?.pageRange || "all") as
      | "all"
      | "current"
      | "custom",
    customRange: savedExportSettings?.customRange || "",
  });

  const handleExportSettingChange = useCallback((key: string, value: any) => {
    setExportSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Save settings when they change
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange({
        exportSettings,
        activeTab,
        isPreviewMode: isPreviewMode,
      });
    }
  }, [exportSettings, activeTab, isPreviewMode, onSettingsChange]);

  if (capturedSnapshots.length === 0 && !isCapturingSnapshots) {
    return (
      <div className="bg-white h-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Final Layout Settings
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure export settings and preview your document
            </p>
          </div>
        </div>

        {/* Loading State */}
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <div className="text-xl mb-3 text-gray-600 font-medium">
              Processing Document...
            </div>
            <div className="text-sm text-gray-500 max-w-md">
              Creating final layout snapshots. This may take a moment.
            </div>
            <div className="mt-4">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Final Layout Settings
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Page {currentPage} of {totalPages} • Ready for export
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex-shrink-0">
        <nav className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab("export")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "export"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Download className="w-4 h-4 inline mr-2" />
            Export
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "preview"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Eye className="w-4 h-4 inline mr-2" />
            Preview
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "settings"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Settings
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "export" && (
          <div className="p-6 space-y-6">
            {/* Export Format */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-900 block">
                Export Format
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleExportSettingChange("format", "pdf")}
                  className={`p-3 border rounded-lg text-center transition-colors ${
                    exportSettings.format === "pdf"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <FileText className="w-6 h-6 mx-auto mb-1" />
                  <div className="text-sm font-medium">PDF</div>
                </button>
                <button
                  onClick={() => handleExportSettingChange("format", "png")}
                  className={`p-3 border rounded-lg text-center transition-colors ${
                    exportSettings.format === "png"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <FileImage className="w-6 h-6 mx-auto mb-1" />
                  <div className="text-sm font-medium">PNG</div>
                </button>
                <button
                  onClick={() => handleExportSettingChange("format", "jpg")}
                  className={`p-3 border rounded-lg text-center transition-colors ${
                    exportSettings.format === "jpg"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <FileImage className="w-6 h-6 mx-auto mb-1" />
                  <div className="text-sm font-medium">JPG</div>
                </button>
              </div>
            </div>

            {/* Content Options */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-900 block">
                Content to Include
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportSettings.includeOriginal}
                    onChange={(e) =>
                      handleExportSettingChange(
                        "includeOriginal",
                        e.target.checked
                      )
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Include original pages
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportSettings.includeTranslated}
                    onChange={(e) =>
                      handleExportSettingChange(
                        "includeTranslated",
                        e.target.checked
                      )
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Include translated pages
                  </span>
                </label>
              </div>
            </div>

            {/* Page Range */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-900 block">
                Page Range
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="pageRange"
                    value="all"
                    checked={exportSettings.pageRange === "all"}
                    onChange={(e) =>
                      handleExportSettingChange("pageRange", e.target.value)
                    }
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">All pages</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="pageRange"
                    value="current"
                    checked={exportSettings.pageRange === "current"}
                    onChange={(e) =>
                      handleExportSettingChange("pageRange", e.target.value)
                    }
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Current page only
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="pageRange"
                    value="custom"
                    checked={exportSettings.pageRange === "custom"}
                    onChange={(e) =>
                      handleExportSettingChange("pageRange", e.target.value)
                    }
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Custom range:
                  </span>
                  {exportSettings.pageRange === "custom" && (
                    <input
                      type="text"
                      value={exportSettings.customRange}
                      onChange={(e) =>
                        handleExportSettingChange("customRange", e.target.value)
                      }
                      placeholder="e.g., 1-3, 5, 7-9"
                      className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  )}
                </label>
              </div>
            </div>

            {/* Quality Setting (for images) */}
            {exportSettings.format !== "pdf" && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-900 block">
                  Quality: {exportSettings.quality}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={exportSettings.quality}
                  onChange={(e) =>
                    handleExportSettingChange(
                      "quality",
                      parseInt(e.target.value)
                    )
                  }
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "preview" && (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Preview how your document will look after export
              </p>
              {onPreviewToggle && (
                <Button
                  onClick={onPreviewToggle}
                  variant="outline"
                  className="mb-4"
                >
                  {isPreviewMode ? (
                    <EyeOff className="w-4 h-4 mr-2" />
                  ) : (
                    <Eye className="w-4 h-4 mr-2" />
                  )}
                  {isPreviewMode ? "Exit Preview" : "Enter Preview Mode"}
                </Button>
              )}
            </div>

            {/* Snapshot Gallery */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">
                Document Snapshots
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {capturedSnapshots.map((snapshot, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-3"
                  >
                    <div className="text-xs text-gray-500 mb-2">
                      Page {index + 1}
                    </div>
                    <div className="bg-gray-100 aspect-[8.5/11] rounded flex items-center justify-center">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="p-6 space-y-6">
            <div className="text-center">
              <Layout className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Layout Settings
              </h3>
              <p className="text-sm text-gray-600">
                Advanced layout configuration options will be available here.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Layout Grid
                </h4>
                <p className="text-sm text-gray-600">
                  Configure grid settings for element alignment.
                </p>
                <Button variant="outline" size="sm" className="mt-2" disabled>
                  <Grid className="w-4 h-4 mr-2" />
                  Coming Soon
                </Button>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Color Scheme
                </h4>
                <p className="text-sm text-gray-600">
                  Adjust document color scheme and themes.
                </p>
                <Button variant="outline" size="sm" className="mt-2" disabled>
                  <Palette className="w-4 h-4 mr-2" />
                  Coming Soon
                </Button>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Canvas Settings
                </h4>
                <p className="text-sm text-gray-600">
                  Configure canvas size and margins.
                </p>
                <Button variant="outline" size="sm" className="mt-2" disabled>
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Coming Soon
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {capturedSnapshots.length} page
            {capturedSnapshots.length !== 1 ? "s" : ""} ready for export
          </div>
          <div className="flex space-x-3">
            <Button onClick={onSaveProject} variant="outline" size="sm">
              <Save className="w-4 h-4 mr-2" />
              Save Project
            </Button>
            <Button
              onClick={() => {
                switch (exportSettings.format) {
                  case "pdf":
                    onExportPDF();
                    break;
                  case "png":
                    onExportPNG();
                    break;
                  case "jpg":
                    onExportJPEG();
                    break;
                  default:
                    onExportPDF();
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export {exportSettings.format.toUpperCase()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
