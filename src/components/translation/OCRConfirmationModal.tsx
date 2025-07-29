'use client';

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { CheckCircle, FileText, BarChart, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '@/types/translation';
import { cn } from '@/lib/utils';

interface OCRConfirmationModalProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const languages = [
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 
  'Korean', 'Portuguese', 'Italian', 'Russian', 'Arabic', 'Hindi'
];

export function OCRConfirmationModal({ project, open, onOpenChange }: OCRConfirmationModalProps) {
  const { updateProject } = useTranslationStore();
  const [detectedSourceLanguage, setDetectedSourceLanguage] = useState(project.detectedSourceLanguage || '');
  const [pageDocumentTypes, setPageDocumentTypes] = useState<Record<string, string>>(
    project.document.reduce((acc, page) => ({
      ...acc,
      [page.id]: page.documentType || 'Technical Manual'
    }), {})
  );
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    
    try {
      // Update project with source language and document types per page
      const updatedDocument = project.document.map(page => ({
        ...page,
        documentType: pageDocumentTypes[page.id] || 'Technical Manual'
      }));
      
      updateProject(project.id, {
        detectedSourceLanguage,
        sourceLanguage: detectedSourceLanguage, // Set the source language
        document: updatedDocument,
        actionType: undefined,
        status: 'assigning-translator', // Trigger translator assignment
      });
      
      // Auto-assign translator
      const { autoAssignTranslator } = useTranslationStore.getState();
      autoAssignTranslator(project.id);
      
      toast.success('Document types and source language confirmed! AI Agent is now finding the best translator match...');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to confirm OCR results');
    } finally {
      setIsConfirming(false);
    }
  };

  const averageConfidence = project.document.length > 0 
    ? project.document.reduce((sum, page) => sum + page.confidence, 0) / project.document.length 
    : 0;

  return (
                    <Dialog open={open} onOpenChange={onOpenChange}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            OCR Results Confirmation
          </DialogTitle>
          <DialogDescription>
            Review and confirm the detected document type and source language from the OCR processing.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Project Info Card */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{project.qCode}</CardTitle>
              <CardDescription>{project.clientName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-medium">File:</span>
                <span>{project.fileName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BarChart className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Pages:</span>
                <span>{project.document.length}</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Document Types Per Page */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Document Types Per Page</CardTitle>
              <CardDescription>
                Review and confirm the document type for each page
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {project.document.map((page, index) => (
                  <div key={page.id} className="space-y-2">
                    <Label htmlFor={`documentType-${page.id}`}>
                      Page {page.pageNumber} Document Type
                    </Label>
                    <Input
                      id={`documentType-${page.id}`}
                      value={pageDocumentTypes[page.id] || 'Technical Manual'}
                      onChange={(e) => setPageDocumentTypes(prev => ({
                        ...prev,
                        [page.id]: e.target.value
                      }))}
                      placeholder="e.g., Technical Manual, Legal Document, Marketing Material"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Source Language Detection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detected Source Language</CardTitle>
              <CardDescription>
                Review and confirm the source language detected by OCR
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="sourceLanguage">Source Language</Label>
                <Select
                  value={detectedSourceLanguage}
                  onValueChange={setDetectedSourceLanguage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(lang => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          {/* OCR Processing Summary */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-blue-600" />
              <span className="font-medium">OCR Processing Complete</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm text-muted-foreground">
                {project.document.length} pages processed successfully
              </span>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isConfirming} className="bg-blue-600 hover:bg-blue-700">
            {isConfirming ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirm & Assign Translator
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 