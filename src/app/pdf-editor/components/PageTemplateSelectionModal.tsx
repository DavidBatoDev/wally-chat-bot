import React, { useEffect, useMemo, useState } from "react";
import { Document, Page } from "react-pdf";
import {
  X,
  Search,
  FileText,
  ChevronDown,
  Eye,
  ArrowRight,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TextField } from "../types/pdf-editor.types";
import { toast } from "sonner";
import { deleteProject as deleteProjectApi } from "../services/projectApiService";

// Configure PDF.js worker
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PageType =
  | "social_media"
  | "birth_cert"
  | "nbi_clearance"
  | "apostille"
  | "dynamic_content";

interface PageInfo {
  pageNumber: number;
  pageType: PageType | null;
  templateId?: string | null;
  deleted?: boolean;
}

interface TemplateItem {
  id: string;
  doc_type: string;
  variation: string;
  file_url: string;
}

interface PageTemplateSelectionModalProps {
  open: boolean;
  onClose: () => void;
  totalPages: number;
  initialPages?: Array<{
    pageNumber: number;
    pageType?: PageType | null;
    templateId?: string | null;
  }>;
  onConfirm: (
    pages: PageInfo[],
    sourceLanguage: string,
    desiredLanguage: string
  ) => Promise<void> | void;
  // New props for PDF preview
  projectId?: string;
  documentUrl?: string;
  pageWidth?: number;
  pageHeight?: number;
  sourceLanguage?: string;
  desiredLanguage?: string;
}

export const PageTemplateSelectionModal: React.FC<
  PageTemplateSelectionModalProps
> = ({
  open,
  onClose,
  totalPages,
  initialPages,
  onConfirm,
  projectId,
  documentUrl,
  pageWidth = 600,
  pageHeight = 800,
  sourceLanguage = "English",
  desiredLanguage = "Spanish",
}) => {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [showDropdowns, setShowDropdowns] = useState<Record<number, boolean>>(
    {}
  );
  const [showPageTypeDropdowns, setShowPageTypeDropdowns] = useState<
    Record<number, boolean>
  >({});

  // Language selection state
  const [currentSourceLanguage, setCurrentSourceLanguage] = useState<string>(
    sourceLanguage || "auto"
  );
  const [currentDesiredLanguage, setCurrentDesiredLanguage] = useState<string>(
    desiredLanguage || "en"
  );
  const [sourceSearch, setSourceSearch] = useState("");
  const [desiredSearch, setDesiredSearch] = useState("");
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [desiredDropdownOpen, setDesiredDropdownOpen] = useState(false);

  // Language options from the translation service
  const languageOptions = [
    { code: "auto", name: "Auto detect" },
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "pt", name: "Portuguese" },
    { code: "ru", name: "Russian" },
    { code: "zh-CN", name: "Chinese (Simplified)" },
    { code: "zh-TW", name: "Chinese (Traditional)" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "ar", name: "Arabic" },
    { code: "hi", name: "Hindi" },
    { code: "nl", name: "Dutch" },
    { code: "sv", name: "Swedish" },
    { code: "no", name: "Norwegian" },
    { code: "da", name: "Danish" },
    { code: "fi", name: "Finnish" },
    { code: "pl", name: "Polish" },
    { code: "tr", name: "Turkish" },
    { code: "el", name: "Greek" },
    { code: "he", name: "Hebrew" },
    { code: "hu", name: "Hungarian" },
    { code: "cs", name: "Czech" },
    { code: "sk", name: "Slovak" },
    { code: "ro", name: "Romanian" },
    { code: "bg", name: "Bulgarian" },
    { code: "hr", name: "Croatian" },
    { code: "sr", name: "Serbian" },
    { code: "sl", name: "Slovenian" },
    { code: "et", name: "Estonian" },
    { code: "lv", name: "Latvian" },
    { code: "lt", name: "Lithuanian" },
    { code: "uk", name: "Ukrainian" },
    { code: "be", name: "Belarusian" },
    { code: "th", name: "Thai" },
    { code: "vi", name: "Vietnamese" },
    { code: "id", name: "Indonesian" },
    { code: "ms", name: "Malay" },
    { code: "tl", name: "Filipino" },
    { code: "bn", name: "Bengali" },
    { code: "ur", name: "Urdu" },
    { code: "pa", name: "Punjabi" },
    { code: "gu", name: "Gujarati" },
    { code: "mr", name: "Marathi" },
    { code: "kn", name: "Kannada" },
    { code: "ta", name: "Tamil" },
    { code: "te", name: "Telugu" },
    { code: "ml", name: "Malayalam" },
    { code: "si", name: "Sinhala" },
    { code: "my", name: "Burmese" },
    { code: "km", name: "Khmer" },
    { code: "lo", name: "Lao" },
    { code: "ne", name: "Nepali" },
    { code: "bo", name: "Tibetan" },
    { code: "mn", name: "Mongolian" },
    { code: "kk", name: "Kazakh" },
    { code: "uz", name: "Uzbek" },
    { code: "ky", name: "Kyrgyz" },
    { code: "tg", name: "Tajik" },
    { code: "tk", name: "Turkmen" },
    { code: "az", name: "Azerbaijani" },
    { code: "ka", name: "Georgian" },
    { code: "hy", name: "Armenian" },
    { code: "fa", name: "Persian" },
    { code: "ku", name: "Kurdish" },
    { code: "ps", name: "Pashto" },
    { code: "prs", name: "Dari" },
    { code: "ug", name: "Uyghur" },
  ];

  // Language options for desired language (excluding "Auto detect")
  const desiredLanguageOptions = languageOptions.filter(
    (lang) => lang.code !== "auto"
  );

  // Filter languages based on search
  const filteredSourceLanguages = useMemo(() => {
    if (!sourceSearch) return languageOptions;
    return languageOptions.filter((lang) =>
      lang.name.toLowerCase().includes(sourceSearch.toLowerCase())
    );
  }, [sourceSearch]);

  const filteredDesiredLanguages = useMemo(() => {
    if (!desiredSearch) return desiredLanguageOptions;
    return desiredLanguageOptions.filter((lang) =>
      lang.name.toLowerCase().includes(desiredSearch.toLowerCase())
    );
  }, [desiredSearch]);

  // Get display name for selected language
  const getLanguageName = (code: string) => {
    const lang = languageOptions.find((l) => l.code === code);
    return lang ? lang.name : "";
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (
        !target.closest(".template-dropdown-container") &&
        !target.closest(".language-dropdown-container") &&
        !target.closest(".page-type-dropdown-container")
      ) {
        setShowDropdowns({});
        setShowPageTypeDropdowns({});
        setSourceDropdownOpen(false);
        setDesiredDropdownOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // initialize pages
    const init: PageInfo[] = Array.from({ length: totalPages }, (_, idx) => {
      const pn = idx + 1;
      const match = initialPages?.find((p) => p.pageNumber === pn);
      return {
        pageNumber: pn,
        pageType: (match?.pageType as PageType) || null,
        templateId: match?.templateId || null,
        deleted: (match as any)?.deleted || false,
      };
    });
    setPages(init);
  }, [open, totalPages, initialPages]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setError(null);
        const res = await fetch("/api/proxy/templates/");
        if (!res.ok)
          throw new Error(`Failed to fetch templates: ${res.status}`);
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load templates");
      }
    })();
  }, [open]);

  const templatesByType = useMemo(() => {
    const lower = (s: string) => (s || "").toLowerCase();
    return {
      birth_cert: templates.filter(
        (t) =>
          lower(t.doc_type).includes("birth") ||
          lower(t.doc_type).includes("certificate")
      ),
      nbi_clearance: templates.filter((t) => lower(t.doc_type).includes("nbi")),
      apostille: templates.filter((t) =>
        lower(t.doc_type).includes("apostille")
      ),
    } as Record<PageType, TemplateItem[]> & { [key: string]: TemplateItem[] };
  }, [templates]);

  const handleChangeType = (pageNumber: number, pageType: PageType | "") => {
    setPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber
          ? { ...p, pageType: (pageType as PageType) || null, templateId: null }
          : p
      )
    );
    // Clear search term when type changes
    setSearchTerms((prev) => ({ ...prev, [pageNumber]: "" }));
  };

  const handleChangeTemplate = (
    pageNumber: number,
    templateId: string | ""
  ) => {
    setPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber
          ? { ...p, templateId: templateId || null }
          : p
      )
    );
  };

  const handleTemplateSelect = (pageNumber: number, template: TemplateItem) => {
    setPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber ? { ...p, templateId: template.id } : p
      )
    );
    setSearchTerms((prev) => ({ ...prev, [pageNumber]: template.variation }));
    setShowDropdowns((prev) => ({ ...prev, [pageNumber]: false }));
  };

  const handleSearchChange = (pageNumber: number, value: string) => {
    setSearchTerms((prev) => ({ ...prev, [pageNumber]: value }));
    setShowDropdowns((prev) => ({ ...prev, [pageNumber]: true }));
  };

  const toggleDropdown = (pageNumber: number) => {
    setShowDropdowns((prev) => ({ ...prev, [pageNumber]: !prev[pageNumber] }));
  };

  const togglePageTypeDropdown = (pageNumber: number) => {
    setShowPageTypeDropdowns((prev) => ({
      ...prev,
      [pageNumber]: !prev[pageNumber],
    }));
  };

  const handlePageTypeSelect = (pageNumber: number, pageType: PageType) => {
    handleChangeType(pageNumber, pageType);
    setShowPageTypeDropdowns((prev) => ({ ...prev, [pageNumber]: false }));
  };

  const toggleDeletePage = (pageNumber: number) => {
    setPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber ? { ...p, deleted: !p.deleted } : p
      )
    );
  };

  // Handle source language selection
  const handleSourceSelect = (code: string) => {
    setCurrentSourceLanguage(code);
    setSourceSearch("");
    setSourceDropdownOpen(false);
  };

  // Handle desired language selection
  const handleDesiredSelect = (code: string) => {
    setCurrentDesiredLanguage(code);
    setDesiredSearch("");
    setDesiredDropdownOpen(false);
  };

  const handleConfirm = () => {
    try {
      // Close immediately to allow background OCR to run while dashboard shows indicator
      onClose();
      // Fire-and-forget OCR flow; parent handles any navigation or errors
      void onConfirm(pages, currentSourceLanguage, currentDesiredLanguage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm");
    }
  };

  const handleCancel = async () => {
    if (isDeleting) return;
    try {
      if (!projectId) {
        onClose();
        return;
      }
      setIsDeleting(true);
      await deleteProjectApi(projectId);
      toast.success("Project deleted");
      onClose();
    } catch (e) {
      console.error("Failed to delete project:", e);
      toast.error("Failed to delete project");
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  if (!open) return null;

  // Debug logging
  const resolvedDocumentUrl =
    documentUrl ||
    (typeof window !== "undefined"
      ? (window as any).__recentDocumentUrl
      : undefined);
  console.log("PageTemplateSelectionModal - documentUrl (prop):", documentUrl);
  console.log(
    "PageTemplateSelectionModal - documentUrl (resolved):",
    resolvedDocumentUrl
  );
  console.log("PageTemplateSelectionModal - totalPages:", totalPages);

  // If documentUrl is missing, we still render the modal and show per-page fallback

  // Consistent A4 preview sizing for both original and template
  const basePageWidth = pageWidth || 595.276;
  const basePageHeight = pageHeight || 841.89;
  const previewWidth = 180;
  const previewHeight = Math.round(
    previewWidth * (basePageHeight / basePageWidth)
  );

  const typeOptions: Array<{ value: PageType; label: string }> = [
    { value: "dynamic_content", label: "Social Media" },
    { value: "birth_cert", label: "Birth Certificate" },
    { value: "nbi_clearance", label: "NBI Clearance" },
    { value: "apostille", label: "Apostille" },
  ];

  const getSelectedTemplate = (pageNumber: number) => {
    const page = pages.find((p) => p.pageNumber === pageNumber);
    if (!page?.templateId) return null;
    return templates.find((t) => t.id === page.templateId);
  };

  const getFilteredTemplates = (pageNumber: number) => {
    const page = pages.find((p) => p.pageNumber === pageNumber);
    const type = page?.pageType || "dynamic_content";
    const templateList = templatesByType[type] || [];
    const searchTerm = searchTerms[pageNumber] || "";

    return templateList.filter(
      (template) =>
        template.variation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.doc_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleCancel();
        }
      }}
    >
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col bg-white border-0 shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Select Page Types and Templates
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Configure each page of your document with appropriate templates
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting || isDeleting}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Language Selection */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-center gap-8">
            {/* Source Language */}
            <div className="flex flex-col items-center">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Source Language
              </h3>
              <div className="relative language-dropdown-container">
                <Input
                  type="text"
                  placeholder={
                    currentSourceLanguage
                      ? getLanguageName(currentSourceLanguage)
                      : "Search or select language..."
                  }
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  onFocus={() => setSourceDropdownOpen(true)}
                  onBlur={() =>
                    setTimeout(() => setSourceDropdownOpen(false), 200)
                  }
                  className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {sourceDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-[9999]">
                    {filteredSourceLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleSourceSelect(lang.code)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
                      >
                        <span className="text-sm text-gray-800">
                          {lang.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center shadow-lg">
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
              <div className="text-xs font-medium text-gray-500 mt-1">
                Translate to
              </div>
            </div>

            {/* Target Language */}
            <div className="flex flex-col items-center">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Target Language
              </h3>
              <div className="relative language-dropdown-container">
                <Input
                  type="text"
                  placeholder={
                    currentDesiredLanguage
                      ? getLanguageName(currentDesiredLanguage)
                      : "Search or select language..."
                  }
                  value={desiredSearch}
                  onChange={(e) => setDesiredSearch(e.target.value)}
                  onFocus={() => setDesiredDropdownOpen(true)}
                  onBlur={() =>
                    setTimeout(() => setDesiredDropdownOpen(false), 200)
                  }
                  className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {desiredDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-[9999]">
                    {filteredDesiredLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleDesiredSelect(lang.code)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
                      >
                        <span className="text-sm text-gray-800">
                          {lang.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200">
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pages.map((page) => {
                const type = page.pageType || "dynamic_content";
                const templateList = templatesByType[type] || [];
                const selectedTemplate = getSelectedTemplate(page.pageNumber);
                const filteredTemplates = getFilteredTemplates(page.pageNumber);
                const isDropdownOpen = showDropdowns[page.pageNumber] || false;

                return (
                  <div
                    key={page.pageNumber}
                    className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Page Header */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Page {page.pageNumber}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={page.pageType ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {page.pageType
                              ? typeOptions.find(
                                  (opt) => opt.value === page.pageType
                                )?.label
                              : "No Type"}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleDeletePage(page.pageNumber)}
                            aria-label={
                              page.deleted ? "Restore page" : "Delete page"
                            }
                            title={
                              page.deleted ? "Restore page" : "Delete page"
                            }
                            className={
                              page.deleted
                                ? "text-green-600 border-green-300 hover:bg-green-50"
                                : "text-red-600 border-red-300 hover:bg-red-50"
                            }
                          >
                            {page.deleted ? (
                              <span className="flex items-center gap-1">
                                <Undo2 className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Trash2 className="w-3 h-3" />
                              </span>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* PDF Preview and Template Selection */}
                      <div className="flex items-center gap-4">
                        {/* PDF Page Preview */}
                        <div className="flex flex-col items-center space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">
                            Original Page
                          </h4>
                          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                            {resolvedDocumentUrl ? (
                              <div className="p-2">
                                <div
                                  style={{
                                    position: "relative",
                                    width: previewWidth,
                                    height: previewHeight,
                                    background: "#ffffff",
                                    overflow: "hidden",
                                  }}
                                >
                                  <Document
                                    file={resolvedDocumentUrl}
                                    loading={
                                      <div
                                        className="flex items-center justify-center"
                                        style={{
                                          width: previewWidth,
                                          height: previewHeight,
                                        }}
                                      >
                                        <div className="text-gray-400 text-xs">
                                          Loading PDF...
                                        </div>
                                      </div>
                                    }
                                    error={
                                      <div
                                        className="flex items-center justify-center"
                                        style={{
                                          width: previewWidth,
                                          height: previewHeight,
                                        }}
                                      >
                                        <div className="text-center space-y-1">
                                          <FileText className="w-4 h-4 mx-auto text-red-300" />
                                          <p className="text-xs text-red-500">
                                            Failed to load
                                          </p>
                                        </div>
                                      </div>
                                    }
                                    onLoadError={(error) => {
                                      console.error("PDF load error:", error);
                                    }}
                                  >
                                    <Page
                                      pageNumber={page.pageNumber}
                                      width={previewWidth}
                                      height={previewHeight}
                                      renderTextLayer={false}
                                      renderAnnotationLayer={false}
                                      onLoadError={(error) => {
                                        console.error(
                                          "Page load error:",
                                          error
                                        );
                                      }}
                                    />
                                  </Document>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded"
                                style={{
                                  width: previewWidth,
                                  height: previewHeight,
                                }}
                              >
                                <div className="text-center space-y-1">
                                  <FileText className="w-4 h-4 mx-auto text-gray-300" />
                                  <p className="text-xs">No document URL</p>
                                  <p className="text-xs text-gray-400">
                                    {documentUrl === undefined
                                      ? "URL undefined"
                                      : "URL empty"}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex flex-col items-center space-y-1">
                          <div className="w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center shadow-lg">
                            <ArrowRight className="w-3 h-3 text-white" />
                          </div>
                        </div>

                        {/* Template Preview */}
                        <div className="flex flex-col items-center space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">
                            Template Preview
                          </h4>
                          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                            {selectedTemplate?.file_url ? (
                              <div className="p-2">
                                <Document
                                  file={selectedTemplate.file_url}
                                  loading={
                                    <div
                                      className="flex items-center justify-center"
                                      style={{
                                        width: previewWidth,
                                        height: previewHeight,
                                      }}
                                    >
                                      <div className="text-gray-400 text-xs">
                                        Loading...
                                      </div>
                                    </div>
                                  }
                                >
                                  <Page
                                    pageNumber={1}
                                    width={previewWidth}
                                    height={previewHeight}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                  />
                                </Document>
                              </div>
                            ) : (
                              <div
                                className="flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded"
                                style={{
                                  width: previewWidth,
                                  height: previewHeight,
                                }}
                              >
                                <div className="text-center space-y-1">
                                  <FileText className="w-4 h-4 mx-auto text-gray-300" />
                                  <p className="text-xs">Select template</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Page Type and Template Selection */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Page Type Selection */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">
                            Page Type
                          </label>
                          <div className="relative page-type-dropdown-container">
                            <div className="relative">
                              <button
                                onClick={() =>
                                  togglePageTypeDropdown(page.pageNumber)
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between"
                              >
                                <span
                                  className={
                                    page.pageType
                                      ? "text-gray-900"
                                      : "text-gray-500"
                                  }
                                >
                                  {page.pageType
                                    ? typeOptions.find(
                                        (opt) => opt.value === page.pageType
                                      )?.label || "Select page type..."
                                    : "Select page type..."}
                                </span>
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform ${
                                    showPageTypeDropdowns[page.pageNumber]
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Page Type Dropdown */}
                            {showPageTypeDropdowns[page.pageNumber] && (
                              <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto z-[9999]">
                                <div className="py-1">
                                  {typeOptions.map((option) => (
                                    <button
                                      key={option.value}
                                      onClick={() =>
                                        handlePageTypeSelect(
                                          page.pageNumber,
                                          option.value
                                        )
                                      }
                                      className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors group"
                                    >
                                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                                        {option.label}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Template Selection */}
                        {page.pageType &&
                          page.pageType !== "dynamic_content" && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Template
                              </label>
                              <div className="relative template-dropdown-container">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                  <Input
                                    type="text"
                                    placeholder="Search templates..."
                                    value={searchTerms[page.pageNumber] || ""}
                                    onChange={(e) =>
                                      handleSearchChange(
                                        page.pageNumber,
                                        e.target.value
                                      )
                                    }
                                    onFocus={() =>
                                      setShowDropdowns((prev) => ({
                                        ...prev,
                                        [page.pageNumber]: true,
                                      }))
                                    }
                                    className="pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  />
                                  <button
                                    onClick={() =>
                                      toggleDropdown(page.pageNumber)
                                    }
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    <ChevronDown
                                      className={`w-4 h-4 transition-transform ${
                                        isDropdownOpen ? "rotate-180" : ""
                                      }`}
                                    />
                                  </button>
                                </div>

                                {/* Template Dropdown */}
                                {isDropdownOpen && (
                                  <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto z-[9999]">
                                    {filteredTemplates.length > 0 ? (
                                      <div className="py-1">
                                        {filteredTemplates.map((template) => (
                                          <button
                                            key={template.id}
                                            onClick={() =>
                                              handleTemplateSelect(
                                                page.pageNumber,
                                                template
                                              )
                                            }
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
                                        {searchTerms[page.pageNumber]
                                          ? "No templates found"
                                          : "No templates available"}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting || isDeleting}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="px-6 bg-gray-900 hover:bg-gray-800"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Run OCR and Save
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
