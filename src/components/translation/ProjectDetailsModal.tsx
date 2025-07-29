"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useTranslationStore } from "@/lib/store/TranslationStore";
import {
  FileText,
  Clock,
  Calendar,
  Languages,
  User,
  CheckCircle,
  Download,
  Edit,
  MessageSquare,
  History,
  AlertCircle,
  BarChart,
  FileEdit,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/types/translation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

interface ProjectDetailsModalProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailsModal({
  project,
  open,
  onOpenChange,
}: ProjectDetailsModalProps) {
  const { currentUser, updateProject, sendBackToTranslator } =
    useTranslationStore();
  const [activeTab, setActiveTab] = useState("overview");
  const [translationText, setTranslationText] = useState<
    Record<string, string>
  >({});
  const [comments, setComments] = useState("");
  const [pmNotes, setPmNotes] = useState("");
  const [showSendBackDialog, setShowSendBackDialog] = useState(false);
  const router = useRouter();

  const statusConfig = {
    "ocr-processing": { label: "OCR Processing", color: "bg-primary" },
    "pending-confirmation": {
      label: "Pending Confirmation",
      color: "bg-yellow-500",
    },
    "assigning-translator": {
      label: "Assigning Translator",
      color: "bg-orange-500",
    },
    assigned: { label: "Assigned", color: "bg-purple-500" },
    "in-progress": { label: "In Progress", color: "bg-indigo-500" },
    "pm-review": { label: "PM Review", color: "bg-orange-500" },
    "sent-back": { label: "Sent Back", color: "bg-red-500" },
    completed: { label: "Completed", color: "bg-green-500" },
  };

  const handleTranslationSubmit = () => {
    if (currentUser?.role !== "translator") {
      toast.error("Only translators can submit translations");
      return;
    }

    // Submit translation and proofreading using the new workflow function
    const { submitTranslation } = useTranslationStore.getState();
    submitTranslation(project.id, translationText);

    toast.success(
      "Translation and proofreading submitted! Awaiting PM review."
    );
    onOpenChange(false);
  };

  const handleFinalApproval = () => {
    if (currentUser?.role !== "project-manager") {
      toast.error("Only project managers can give final approval");
      return;
    }

    // Give final approval using the new workflow function
    const { giveFinalApproval } = useTranslationStore.getState();
    giveFinalApproval(project.id);

    toast.success("Project completed successfully!");
    onOpenChange(false);
  };

  const handleOpenInPDFEditor = () => {
    // Navigate to PDF editor with project data
    router.push(`/pdf-editor?projectId=${project.id}`);
    onOpenChange(false);
  };

  const handleSendBackToTranslator = () => {
    if (currentUser?.role !== "project-manager") {
      toast.error("Only project managers can send projects back");
      return;
    }

    if (!pmNotes.trim()) {
      toast.error("Please provide notes for the translator");
      return;
    }

    sendBackToTranslator(project.id, pmNotes);
    toast.success("Project sent back to translator with notes");
    setPmNotes("");
    setShowSendBackDialog(false);
    onOpenChange(false);
  };

  const getDocTypeColor = (docType: string) => {
    const colors: Record<string, string> = {
      Contract: "bg-primary/20 text-primary",
      Manual: "bg-green-100 text-green-800",
      Website: "bg-purple-100 text-purple-800",
      Marketing: "bg-pink-100 text-pink-800",
      Legal: "bg-red-100 text-red-800",
      Technical: "bg-indigo-100 text-indigo-800",
      Medical: "bg-teal-100 text-teal-800",
      Financial: "bg-yellow-100 text-yellow-800",
    };
    return colors[docType] || "bg-gray-100 text-gray-800";
  };

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), "MMM dd, yyyy HH:mm");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold">
                  {project.qCode}
                </DialogTitle>
                <DialogDescription>{project.clientName}</DialogDescription>
              </div>
              <Badge
                className={cn("px-3 py-1", statusConfig[project.status].color)}
              >
                {statusConfig[project.status].label}
              </Badge>
            </div>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[60vh] pr-4">
              <TabsContent value="overview" className="space-y-4 mt-4">
                {/* Project Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Project Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Client</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {project.clientName}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Languages</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {project.sourceLanguage} →{" "}
                          {project.targetLanguages.join(", ")}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Deadline</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(project.deadline), "MMM dd, yyyy")}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            Delivery Date
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(
                            new Date(project.deliveryDate),
                            "MMM dd, yyyy"
                          )}
                        </p>
                      </div>
                    </div>

                    {project.assignedTranslator && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            Assigned Translator
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {project.assignedTranslator}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Document Pages */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileEdit className="h-4 w-4" />
                      Document Pages ({project.document.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {project.document.map((page) => (
                        <div
                          key={page.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                              <span className="text-sm font-medium">
                                {page.pageNumber}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                Page {page.pageNumber}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Confidence: {Math.round(page.confidence * 100)}%
                              </p>
                            </div>
                          </div>
                          <Badge
                            className={getDocTypeColor(
                              page.documentType || "Unknown"
                            )}
                          >
                            {page.documentType || "Unknown"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Project History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Project Created */}
                      <div className="flex items-start gap-3">
                        <div className="h-2 w-2 rounded-full bg-gray-500 mt-1.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Project Created</p>
                          <p className="text-xs text-muted-foreground">
                            Project {project.qCode} created for{" "}
                            {project.clientName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Created: {formatTimestamp(project.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* OCR Processing */}
                      {project.ocrCompletedAt && (
                        <div className="flex items-start gap-3">
                                                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              OCR Processing Completed
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Document processed with {project.document.length}{" "}
                              pages
                            </p>
                            <div className="mt-1 space-y-1">
                              <p className="text-xs text-muted-foreground">
                                Source: {project.sourceLanguage} → Target:{" "}
                                {project.targetLanguages.join(", ")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Average confidence:{" "}
                                {Math.round(
                                  project.document.reduce(
                                    (acc, page) => acc + page.confidence,
                                    0
                                  ) / project.document.length
                                )}
                                %
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Completed:{" "}
                                {formatTimestamp(project.ocrCompletedAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Translator Assignment */}
                      {project.translatorAssignedAt && (
                        <div className="flex items-start gap-3">
                          <div className="h-2 w-2 rounded-full bg-purple-500 mt-1.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Translator Assigned
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {project.assignedTranslator}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Project moved to translation phase
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Assigned:{" "}
                              {formatTimestamp(project.translatorAssignedAt)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Translation Started */}
                      {project.translationStartedAt && (
                        <div className="flex items-start gap-3">
                          <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Translation Started
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Translator began working on document
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Translator: {project.assignedTranslator}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Deadline:{" "}
                              {format(
                                new Date(project.deadline),
                                "MMM dd, yyyy"
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Started:{" "}
                              {formatTimestamp(project.translationStartedAt)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Translation Submitted */}
                      {project.translationSubmittedAt && (
                        <div className="flex items-start gap-3">
                          <div className="h-2 w-2 rounded-full bg-orange-500 mt-1.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Translation & Proofreading Submitted
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Awaiting PM review and final approval
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Translator: {project.assignedTranslator}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Translator completed initial proofreading
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Submitted:{" "}
                              {formatTimestamp(project.translationSubmittedAt)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Project Sent Back */}
                      {project.sentBackAt && (
                        <div className="flex items-start gap-3">
                          <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Project Sent Back to Translator
                            </p>
                            <p className="text-xs text-muted-foreground">
                              PM requested revisions
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Sent by: {project.sentBackBy || "Project Manager"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Sent to: {project.assignedTranslator}
                            </p>
                            {project.pmNotes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Notes: {project.pmNotes}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Sent back: {formatTimestamp(project.sentBackAt)}
                            </p>
                            {project.sentBackCount &&
                              project.sentBackCount > 1 && (
                                <p className="text-xs text-muted-foreground">
                                  Revision #{project.sentBackCount}
                                </p>
                              )}
                          </div>
                        </div>
                      )}

                      {/* Project Completed */}
                      {project.finalApprovalAt && (
                        <div className="flex items-start gap-3">
                          <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Project Completed
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Final approval given by Project Manager
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Approved by:{" "}
                              {project.finalApprovalBy || "Project Manager"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Translator: {project.assignedTranslator}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Delivery Date:{" "}
                              {format(
                                new Date(project.deliveryDate),
                                "MMM dd, yyyy"
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Completed:{" "}
                              {formatTimestamp(project.finalApprovalAt)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Project Statistics */}
                      <Separator className="my-4" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          Project Statistics
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground">
                              Total Pages:
                            </span>
                            <span className="ml-2 font-medium">
                              {project.document.length}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Document Types:
                            </span>
                            <span className="ml-2 font-medium">
                              {[
                                ...new Set(
                                  project.document.map((p) => p.documentType)
                                ),
                              ].join(", ")}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Created:
                            </span>
                            <span className="ml-2 font-medium">
                              {format(
                                new Date(project.createdAt),
                                "MMM dd, yyyy"
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Last Updated:
                            </span>
                            <span className="ml-2 font-medium">
                              {format(
                                new Date(project.updatedAt),
                                "MMM dd, yyyy"
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Project Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {project.pmNotesHistory && project.pmNotesHistory.length > 0 ? (
                      <div className="space-y-4">
                        {project.pmNotesHistory.map((note, idx) => (
                          <div key={note.sentBackAt + note.revisionNumber} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="h-4 w-4 text-red-600" />
                              <span className="text-sm font-medium text-red-800">
                                PM Revision Notes (Revision {note.revisionNumber})
                              </span>
                            </div>
                            <p className="text-sm text-red-700 whitespace-pre-wrap">{note.note}</p>
                            <p className="text-xs text-red-600 mt-2">
                              Sent back: {formatTimestamp(note.sentBackAt)}
                            </p>
                            <p className="text-xs text-red-600">
                              Sent by: {note.sentBackBy}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : project.pmNotes ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm font-medium text-red-800">
                              PM Revision Notes
                            </span>
                          </div>
                          <p className="text-sm text-red-700 whitespace-pre-wrap">
                            {project.pmNotes}
                          </p>
                          {project.sentBackAt && (
                            <p className="text-xs text-red-600 mt-2">
                              Sent back: {formatTimestamp(project.sentBackAt)}
                            </p>
                          )}
                          {project.sentBackCount &&
                            project.sentBackCount > 1 && (
                              <p className="text-xs text-red-600">
                                Revision #{project.sentBackCount}
                              </p>
                            )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">
                          No notes available for this project
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>

            {/* Send Back to Translator Button - Only for PMs reviewing projects */}
            {currentUser?.role === "project-manager" &&
              project.status === "pm-review" && (
                <Button
                  onClick={() => setShowSendBackDialog(true)}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Send Back to Translator
                </Button>
              )}

            {/* PDF Editor Button - Show for translators and PMs */}
            {((currentUser?.role === "translator" &&
              (project.status === "in-progress" ||
                project.status === "sent-back")) ||
              (currentUser?.role === "project-manager" &&
                (project.status === "pm-review" ||
                  project.status === "in-progress"))) && (
              <Button
                onClick={handleOpenInPDFEditor}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open in PDF Editor
              </Button>
            )}

            {currentUser?.role === "translator" &&
              (project.status === "in-progress" ||
                project.status === "sent-back") && (
                <Button
                  onClick={handleTranslationSubmit}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Submit Translation & Proofreading
                </Button>
              )}
            {currentUser?.role === "project-manager" &&
              project.status === "pm-review" && (
                <Button
                  onClick={handleFinalApproval}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Give Final Approval
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Back to Translator Dialog */}
      <Dialog open={showSendBackDialog} onOpenChange={setShowSendBackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Back to Translator</DialogTitle>
            <DialogDescription>
              Provide notes for the translator about what needs to be revised.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pm-notes">Revision Notes</Label>
              <Textarea
                id="pm-notes"
                placeholder="Enter detailed notes for the translator about what needs to be revised..."
                value={pmNotes}
                onChange={(e) => setPmNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSendBackDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSendBackToTranslator} variant="destructive">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Send Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
