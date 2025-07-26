import React, { useState, useEffect, useRef } from "react";
import { Document, Page } from "react-pdf";
import { X, Search, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BirthCertTemplate } from "../types/pdf-editor.types";

interface BirthCertificateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  sourceLanguage?: string;
  desiredLanguage?: string;
  pageNumber?: number; // The page number this template is being applied to
  currentTemplate?: BirthCertTemplate | null; // Current template for this page
  onTemplateSelect?: (template: BirthCertTemplate, pageNumber: number) => void;
}

export const BirthCertificateSelectionModal: React.FC<
  BirthCertificateSelectionModalProps
> = ({
  isOpen,
  onClose,
  documentUrl,
  currentPage,
  pageWidth,
  pageHeight,
  sourceLanguage = "English",
  desiredLanguage = "Spanish",
  pageNumber,
  currentTemplate,
  onTemplateSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<"below" | "above">(
    "below"
  );
  const [templates, setTemplates] = useState<BirthCertTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<BirthCertTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch templates from API and initialize selected template
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      // Initialize with current template if available
      if (currentTemplate) {
        setSelectedTemplate(currentTemplate);
        setSearchTerm(currentTemplate.variation);
      } else {
        setSelectedTemplate(null);
        setSearchTerm("");
      }
    }
  }, [isOpen, currentTemplate]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/proxy/templates/");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      // Filter to only show birth certificate templates
      const birthCertTemplates = data.filter(
        (template: BirthCertTemplate) =>
          template.doc_type.toLowerCase().includes("birth") ||
          template.doc_type.toLowerCase().includes("certificate")
      );

      setTemplates(birthCertTemplates);
      console.log("Fetched birth certificate templates:", birthCertTemplates);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch templates"
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(
    (template) =>
      template.variation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.doc_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    setShowDropdown(true);
    checkDropdownPosition();
  };

  const checkDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // If there's less than 200px space below, show dropdown above
      if (spaceBelow < 200 && spaceAbove > spaceBelow) {
        setDropdownPosition("above");
      } else {
        setDropdownPosition("below");
      }
    }
  };

  const handleTemplateSelect = (template: BirthCertTemplate) => {
    setSelectedTemplate(template);
    setSearchTerm(template.variation);
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
    if (!showDropdown) {
      inputRef.current?.focus();
      checkDropdownPosition();
    }
  };

  const handleApplyTemplate = () => {
    if (selectedTemplate && onTemplateSelect) {
      onTemplateSelect(selectedTemplate, pageNumber || currentPage);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[75vh] overflow-hidden bg-white border-0 shadow-2xl">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-gray-100">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold text-gray-900">
              Select Template for Page {pageNumber || currentPage}
            </h2>
            <p className="text-gray-600 text-sm">
              {currentTemplate
                ? `Current: ${currentTemplate.variation}`
                : "Choose a prebuilt template for your birth certificate translation"}
            </p>
          </div>
        </div>

        {/* Language Info - Top Left */}
        {sourceLanguage && desiredLanguage && (
          <div className="absolute top-4 left-4">
            <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-3 text-xs">
                <div className="text-gray-700">
                  <span className="font-medium text-gray-900">Source:</span>{" "}
                  <span className="text-gray-600">{sourceLanguage}</span>
                </div>
                <div className="w-px h-3 bg-gray-300"></div>
                <div className="text-gray-700">
                  <span className="font-medium text-gray-900">Target:</span>{" "}
                  <span className="text-gray-600">{desiredLanguage}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Preview Row */}
        <div className="px-4 py-2">
          <div className="flex items-center justify-center gap-6">
            {/* Original Document */}
            <div className="flex flex-col items-center space-y-2">
              <h3 className="text-sm font-medium text-gray-800">
                Original Document
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                {documentUrl ? (
                  <div className="p-2">
                    <Document
                      file={documentUrl}
                      loading={
                        <div className="flex items-center justify-center h-24 w-36">
                          <div className="text-gray-400 text-xs">
                            Loading...
                          </div>
                        </div>
                      }
                    >
                      <Page
                        pageNumber={currentPage}
                        width={pageWidth * 0.8}
                        height={pageHeight * 0.8}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </Document>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24 w-36 text-gray-400">
                    <div className="text-center space-y-1">
                      <FileText className="w-4 h-4 mx-auto text-gray-300" />
                      <p className="text-xs">No document</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center space-y-1">
              <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center shadow-lg">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </div>
              <div className="text-xs font-medium text-gray-500">Apply</div>
            </div>

            {/* Template Preview */}
            <div className="flex flex-col items-center space-y-2">
              <h3 className="text-sm font-medium text-gray-800">
                Template Preview
                {selectedTemplate &&
                  currentTemplate &&
                  selectedTemplate.id === currentTemplate.id && (
                    <span className="ml-2 text-xs text-green-600 font-normal">
                      (Current)
                    </span>
                  )}
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                {selectedTemplate?.file_url ? (
                  <div className="p-2">
                    <Document
                      file={selectedTemplate.file_url}
                      loading={
                        <div className="flex items-center justify-center h-24 w-36">
                          <div className="text-gray-400 text-xs">
                            Loading...
                          </div>
                        </div>
                      }
                    >
                      <Page
                        pageNumber={1}
                        width={pageWidth * 0.8}
                        height={pageHeight * 0.8}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </Document>
                  </div>
                ) : (
                  <div className="p-2">
                    <div
                      className="flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded"
                      style={{
                        width: pageWidth * 0.8,
                        height: pageHeight * 0.8,
                      }}
                    >
                      <div className="text-center space-y-1">
                        <FileText className="w-4 h-4 mx-auto text-gray-300" />
                        <p className="text-xs">Select a template</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Template Selection */}
        <div className="px-4 py-2">
          <div className="flex justify-center">
            <div className="relative w-72" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder={
                    loading ? "Loading templates..." : "Search templates..."
                  }
                  value={searchTerm}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => {
                    setShowDropdown(true);
                    checkDropdownPosition();
                  }}
                  disabled={loading}
                  className="pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white shadow-sm hover:border-gray-400 transition-colors disabled:bg-gray-50"
                />
                <button
                  onClick={toggleDropdown}
                  disabled={loading}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      showDropdown ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-2 text-red-500 text-xs text-center">
                  {error}
                </div>
              )}

              {/* Dropdown */}
              {showDropdown && (
                <div
                  className={`absolute left-0 right-0 ${
                    dropdownPosition === "above"
                      ? "bottom-full mb-1"
                      : "top-full mt-1"
                  } bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto z-[99999]`}
                >
                  {loading ? (
                    <div className="px-3 py-3 text-gray-500 text-xs text-center">
                      Loading templates...
                    </div>
                  ) : filteredTemplates.length > 0 ? (
                    <div className="py-1">
                      {filteredTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateSelect(template)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors group"
                        >
                          <div className="flex items-center space-x-2">
                            <FileText className="w-3 h-3 text-gray-400 group-hover:text-gray-600" />
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-700 group-hover:text-gray-900 font-medium">
                                {template.variation}
                              </span>
                              <span className="text-xs text-gray-500">
                                {template.doc_type}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-3 text-gray-500 text-xs text-center">
                      {searchTerm
                        ? "No templates found"
                        : "No templates available"}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex justify-end gap-2">
            <button
              className="px-4 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium text-sm transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-5 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleApplyTemplate}
              disabled={!selectedTemplate}
            >
              <div className="flex items-center space-x-1">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span>
                  {selectedTemplate &&
                  currentTemplate &&
                  selectedTemplate.id === currentTemplate.id
                    ? "Keep Current"
                    : "Apply"}
                </span>
              </div>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
