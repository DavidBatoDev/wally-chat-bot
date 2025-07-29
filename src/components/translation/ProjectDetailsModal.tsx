'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useTranslationStore } from '@/lib/store/TranslationStore';
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
} from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '@/types/translation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

interface ProjectDetailsModalProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailsModal({ project, open, onOpenChange }: ProjectDetailsModalProps) {
  const { 
    updateProject, 
    approveTranslation, 
    sendBackToTranslator, 
    teamMembers,
    currentUser 
  } = useTranslationStore();
  
  const [pmNotes, setPmNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showSendBackDialog, setShowSendBackDialog] = useState(false);
  const router = useRouter();

  // Get assigned translator name
  const getAssignedTranslatorName = () => {
    if (project.assignedTranslator) {
      const translator = teamMembers.find(member => member.id === project.assignedTranslator);
      return translator ? translator.name : project.assignedTranslator;
    }
    return null;
  };

  // Get created by name
  const getCreatedByName = () => {
    if (project.createdBy) {
      const creator = teamMembers.find(member => member.id === project.createdBy || member.name === project.createdBy);
      return creator ? creator.name : project.createdBy;
    }
    return null;
  };

  // Get approved by name  
  const getApprovedByName = () => {
    if (project.finalApprovalBy) {
      const approver = teamMembers.find(member => member.id === project.finalApprovalBy || member.name === project.finalApprovalBy);
      return approver ? approver.name : project.finalApprovalBy;
    }
    return null;
  };

  const assignedTranslatorName = getAssignedTranslatorName();
  const createdByName = getCreatedByName();
  const approvedByName = getApprovedByName();

  const statusConfig = {
    'ocr-processing': { label: 'OCR Processing', color: 'bg-blue-500' },
    'pending-confirmation': { label: 'Pending Confirmation', color: 'bg-yellow-500' },
    'assigning-translator': { label: 'Assigning Translator', color: 'bg-orange-500' },
    'assigned': { label: 'Assigned', color: 'bg-purple-500' },
    'in-progress': { label: 'In Progress', color: 'bg-indigo-500' },
    'pm-review': { label: 'PM Review', color: 'bg-pink-500' },
    'sent-back': { label: 'Sent Back', color: 'bg-red-500' },
    'completed': { label: 'Completed', color: 'bg-green-500' },
  };
  
  const handleTranslationSubmit = () => {
    if (currentUser?.role !== 'translator') {
      toast.error('Only translators can submit translations');
      return;
    }
    
    // Create mock translations for all document pages
    const translations: Record<string, string> = {};
    if (project.document) {
      project.document.forEach(page => {
        translations[page.id] = page.translatedText || `Translated: ${page.originalText}`;
      });
    }
    
    // Submit translation and proofreading using the new workflow function
    const { submitTranslation } = useTranslationStore.getState();
    submitTranslation(project.id, translations);
    
    toast.success('Translation and proofreading submitted! Awaiting PM review.');
    onOpenChange(false);
  };
  
  const handleFinalApproval = () => {
    if (currentUser?.role !== 'project-manager') {
      toast.error('Only project managers can give final approval');
      return;
    }
    
    // Give final approval using the correct workflow function
    const { approveTranslation } = useTranslationStore.getState();
    approveTranslation(project.id);
    
    toast.success('Project completed successfully!');
    onOpenChange(false);
  };

  const handleOpenInPDFEditor = () => {
    // Navigate to PDF editor with project data
    router.push(`/pdf-editor?projectId=${project.id}`);
    onOpenChange(false);
  };

  const handleSendBackToTranslator = () => {
    if (currentUser?.role !== 'project-manager') {
      toast.error('Only project managers can send projects back');
      return;
    }
    
    if (!pmNotes.trim()) {
      toast.error('Please provide notes for the translator');
      return;
    }
    
    sendBackToTranslator(project.id, pmNotes);
    toast.success('Project sent back to translator with notes');
    setPmNotes('');
    setShowSendBackDialog(false);
    onOpenChange(false);
  };

  const getDocTypeColor = (docType: string) => {
    const colors: Record<string, string> = {
      'Contract': 'bg-blue-100 text-blue-800',
      'Manual': 'bg-green-100 text-green-800',
      'Website': 'bg-purple-100 text-purple-800',
      'Marketing': 'bg-pink-100 text-pink-800',
      'Legal': 'bg-red-100 text-red-800',
      'Technical': 'bg-indigo-100 text-indigo-800',
      'Medical': 'bg-teal-100 text-teal-800',
      'Financial': 'bg-yellow-100 text-yellow-800',
    };
    return colors[docType] || 'bg-gray-100 text-gray-800';
  };

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), 'MMM dd, yyyy HH:mm');
  };

  // Helper function to get all chronological events
  const getChronologicalEvents = () => {
    const events: Array<{
      type: string;
      timestamp: string;
      data: any;
      order: number;
    }> = [];

    // Project Created
    events.push({
      type: 'created',
      timestamp: project.createdAt,
      data: { qCode: project.qCode, clientName: project.clientName },
      order: 1
    });

    // OCR Completed
    if (project.ocrCompletedAt) {
      events.push({
        type: 'ocr-completed',
        timestamp: project.ocrCompletedAt,
        data: { documentLength: project.document.length, sourceLanguage: project.sourceLanguage, targetLanguages: project.targetLanguages },
        order: 2
      });
    }

    // Translator Assigned
    if (project.translatorAssignedAt) {
      events.push({
        type: 'translator-assigned',
        timestamp: project.translatorAssignedAt,
        data: { translator: project.assignedTranslator },
        order: 3
      });
    }

    // Translation Started
    if (project.translationStartedAt) {
      events.push({
        type: 'translation-started',
        timestamp: project.translationStartedAt,
        data: { translator: project.assignedTranslator, deadline: project.deadline },
        order: 4
      });
    }

    // Translation Submissions
    if (project.translationSubmissions && project.translationSubmissions.length > 0) {
      project.translationSubmissions.forEach((submission, index) => {
        events.push({
          type: 'translation-submitted',
          timestamp: submission.submittedAt,
          data: { 
            translator: project.assignedTranslator, 
            revisionNumber: submission.revisionNumber,
            submittedBy: submission.submittedBy
          },
          order: 5 + index * 2
        });
      });
    } else if (project.translationSubmittedAt) {
      // Fallback for backward compatibility
      events.push({
        type: 'translation-submitted',
        timestamp: project.translationSubmittedAt,
        data: { 
          translator: project.assignedTranslator, 
          revisionNumber: 1,
          submittedBy: project.assignedTranslator
        },
        order: 5
      });
    }

    // Sent Back Events
    if (project.sentBackEvents && project.sentBackEvents.length > 0) {
      project.sentBackEvents.forEach((sentBackEvent, index) => {
        events.push({
          type: 'sent-back',
          timestamp: sentBackEvent.sentBackAt,
          data: { 
            sentBackBy: sentBackEvent.sentBackBy, 
            pmNotes: sentBackEvent.pmNotes,
            revisionNumber: sentBackEvent.revisionNumber,
            translator: project.assignedTranslator
          },
          order: 6 + index * 2
        });
      });
    } else if (project.sentBackAt) {
      // Fallback for backward compatibility
      events.push({
        type: 'sent-back',
        timestamp: project.sentBackAt,
        data: { 
          sentBackBy: project.sentBackBy || 'Project Manager', 
          pmNotes: project.pmNotes,
          revisionNumber: project.sentBackCount || 1,
          translator: project.assignedTranslator
        },
        order: 6
      });
    }

    // Project Completed
    if (project.finalApprovalAt) {
      events.push({
        type: 'completed',
        timestamp: project.finalApprovalAt,
        data: { 
          approvedBy: project.finalApprovalBy || 'Project Manager',
          translator: project.assignedTranslator,
          deliveryDate: project.deliveryDate
        },
        order: 999
      });
    }

    // Sort by timestamp and then by order for events with same timestamp
    return events.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.order - b.order;
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold">{project.qCode}</DialogTitle>
                <DialogDescription>{project.clientName}</DialogDescription>
              </div>
              <Badge className={cn("px-3 py-1", statusConfig[project.status].color)}>
                {statusConfig[project.status].label}
              </Badge>
            </div>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
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
                        <p className="text-sm text-muted-foreground">{project.clientName}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Languages</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {project.sourceLanguage} → {project.targetLanguages.join(', ')}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Deadline</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(project.deadline), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Delivery Date</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(project.deliveryDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                    
                    {assignedTranslatorName && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Assigned Translator</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{assignedTranslatorName}</p>
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
                        <div key={page.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                              <span className="text-sm font-medium">{page.pageNumber}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Page {page.pageNumber}</p>
                              <p className="text-xs text-muted-foreground">
                                Confidence: {Math.round(page.confidence * 100)}%
                              </p>
                            </div>
                          </div>
                          <Badge className={getDocTypeColor(page.documentType || 'Unknown')}>
                            {page.documentType || 'Unknown'}
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
                      {getChronologicalEvents().map((event, index) => {
                        const getEventColor = (type: string) => {
                          switch (type) {
                            case 'created': return 'bg-gray-500';
                            case 'ocr-completed': return 'bg-blue-500';
                            case 'translator-assigned': return 'bg-purple-500';
                            case 'translation-started': return 'bg-indigo-500';
                            case 'translation-submitted': return 'bg-orange-500';
                            case 'sent-back': return 'bg-red-500';
                            case 'completed': return 'bg-green-500';
                            default: return 'bg-gray-500';
                          }
                        };

                        const getEventTitle = (type: string, data: any) => {
                          switch (type) {
                            case 'created':
                              return `Project Created`;
                            case 'ocr-completed':
                              return `OCR Processing Completed`;
                            case 'translator-assigned':
                              return `Translator Assigned`;
                            case 'translation-started':
                              return `Translation Started`;
                            case 'translation-submitted':
                              return data.revisionNumber > 1 
                                ? `Translation & Proofreading Submitted (Revision ${data.revisionNumber})`
                                : `Translation & Proofreading Submitted`;
                            case 'sent-back':
                              return data.revisionNumber > 1
                                ? `Project Sent Back to Translator (Revision ${data.revisionNumber})`
                                : `Project Sent Back to Translator`;
                            case 'completed':
                              return `Project Completed`;
                            default:
                              return 'Unknown Event';
                          }
                        };

                        const getEventDescription = (type: string, data: any) => {
                          switch (type) {
                            case 'created':
                              return `Project ${data.qCode} created for ${data.clientName}`;
                            case 'ocr-completed':
                              return `Document processed with ${data.documentLength} pages`;
                            case 'translator-assigned':
                              return `Project moved to translation phase`;
                            case 'translation-started':
                              return `Translator began working on document`;
                            case 'translation-submitted':
                              return `Awaiting PM review and final approval`;
                            case 'sent-back':
                              return `PM requested revisions`;
                            case 'completed':
                              return `Final approval given by Project Manager`;
                            default:
                              return '';
                          }
                        };

                        const getEventDetails = (type: string, data: any) => {
                          const details = [];
                          
                          switch (type) {
                            case 'ocr-completed':
                              details.push(`Source: ${data.sourceLanguage} → Target: ${data.targetLanguages.join(', ')}`);
                              details.push(`Average confidence: ${Math.round(project.document.reduce((acc, page) => acc + page.confidence, 0) / project.document.length)}%`);
                              break;
                            case 'translator-assigned':
                              details.push(`Translator: ${data.translator}`);
                              break;
                            case 'translation-started':
                              details.push(`Translator: ${data.translator}`);
                              details.push(`Deadline: ${format(new Date(data.deadline), 'MMM dd, yyyy')}`);
                              break;
                            case 'translation-submitted':
                              details.push(`Translator: ${data.translator}`);
                              details.push(`Translator completed initial proofreading`);
                              if (data.revisionNumber > 1) {
                                details.push(`Submitted by: ${data.submittedBy}`);
                              }
                              break;
                            case 'sent-back':
                              details.push(`Sent by: ${data.sentBackBy}`);
                              details.push(`Sent to: ${data.translator}`);
                              details.push(`Notes: ${data.pmNotes}`);
                              break;
                            case 'completed':
                              details.push(`Approved by: ${data.approvedBy}`);
                              details.push(`Translator: ${data.translator}`);
                              details.push(`Delivery Date: ${format(new Date(data.deliveryDate), 'MMM dd, yyyy')}`);
                              break;
                          }
                          
                          return details;
                        };

                        return (
                          <div key={`${event.type}-${event.timestamp}`} className="flex items-start gap-3">
                            <div className={`h-2 w-2 rounded-full ${getEventColor(event.type)} mt-1.5`} />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{getEventTitle(event.type, event.data)}</p>
                              <p className="text-xs text-muted-foreground">
                                {getEventDescription(event.type, event.data)}
                              </p>
                              {getEventDetails(event.type, event.data).map((detail, detailIndex) => (
                                <p key={detailIndex} className="text-xs text-muted-foreground mt-1">
                                  {detail}
                                </p>
                              ))}
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatTimestamp(event.timestamp)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Project Statistics */}
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Project Statistics</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Total Pages:</span>
                          <span className="ml-2 font-medium">{project.document.length}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Document Types:</span>
                          <span className="ml-2 font-medium">
                            {[...new Set(project.document.map(p => p.documentType))].join(', ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span>
                          <span className="ml-2 font-medium">
                            {format(new Date(project.createdAt), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Updated:</span>
                          <span className="ml-2 font-medium">
                            {format(new Date(project.updatedAt), 'MMM dd, yyyy')}
                          </span>
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
                            <span className="text-sm font-medium text-red-800">PM Revision Notes</span>
                          </div>
                          <p className="text-sm text-red-700 whitespace-pre-wrap">{project.pmNotes}</p>
                          {project.sentBackAt && (
                            <p className="text-xs text-red-600 mt-2">
                              Sent back: {formatTimestamp(project.sentBackAt)}
                            </p>
                          )}
                          {project.sentBackCount && project.sentBackCount > 1 && (
                            <p className="text-xs text-red-600">
                              Revision #{project.sentBackCount}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">No notes available for this project</p>
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
            {currentUser?.role === 'project-manager' && project.status === 'pm-review' && (
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
            {((currentUser?.role === 'translator' && (project.status === 'in-progress' || project.status === 'sent-back')) ||
              (currentUser?.role === 'project-manager' && (project.status === 'pm-review' || project.status === 'in-progress'))) && (
              <Button 
                onClick={handleOpenInPDFEditor}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open in PDF Editor
              </Button>
            )}
            
            {currentUser?.role === 'translator' && (project.status === 'in-progress' || project.status === 'sent-back') && (
              <Button onClick={handleTranslationSubmit} className="bg-indigo-600 hover:bg-indigo-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Submit Translation & Proofreading
              </Button>
            )}
            {currentUser?.role === 'project-manager' && project.status === 'pm-review' && (
              <Button onClick={handleFinalApproval} className="bg-green-600 hover:bg-green-700">
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
            <Button variant="outline" onClick={() => setShowSendBackDialog(false)}>
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