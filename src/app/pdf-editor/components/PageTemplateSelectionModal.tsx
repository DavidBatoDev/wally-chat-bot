import React, { useEffect, useMemo, useState } from "react";
import { TextField } from "../types/pdf-editor.types";

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
  onConfirm: (pages: PageInfo[]) => Promise<void> | void;
}

export const PageTemplateSelectionModal: React.FC<
  PageTemplateSelectionModalProps
> = ({ open, onClose, totalPages, initialPages, onConfirm }) => {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm(pages);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-md shadow-xl w-[880px] max-h-[80vh] overflow-auto p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Select Page Types and Templates
          </h2>
          <button
            className="text-gray-500 hover:text-gray-800"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        <div className="mt-4 grid grid-cols-1 gap-3">
          {pages.map((p) => {
            const type = p.pageType || "dynamic_content";
            const typeOptions: Array<{ value: PageType; label: string }> = [
              { value: "dynamic_content", label: "Dynamic Content" },
              { value: "birth_cert", label: "Birth Certificate" },
              { value: "nbi_clearance", label: "NBI Clearance" },
              { value: "apostille", label: "Apostille" },
            ];
            const templateList = templatesByType[type] || [];
            return (
              <div
                key={p.pageNumber}
                className="flex items-center gap-3 border rounded p-3"
              >
                <div className="w-16 text-sm text-gray-600">
                  Page {p.pageNumber}
                </div>
                <select
                  className="border rounded px-2 py-1"
                  value={p.pageType || ""}
                  onChange={(e) =>
                    handleChangeType(
                      p.pageNumber,
                      (e.target.value as PageType) || ""
                    )
                  }
                >
                  <option value="">Select type…</option>
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  className="border rounded px-2 py-1 min-w-[280px]"
                  value={p.templateId || ""}
                  onChange={(e) =>
                    handleChangeTemplate(p.pageNumber, e.target.value)
                  }
                  disabled={!p.pageType || p.pageType === "dynamic_content"}
                >
                  <option value="">
                    {!p.pageType || p.pageType === "dynamic_content"
                      ? "(No template required)"
                      : "Select template…"}
                  </option>
                  {templateList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.variation} ({t.doc_type})
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="px-3 py-1 border rounded"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-60"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Processing…" : "Run OCR and Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
