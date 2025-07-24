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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Upload, FileText, Calendar, Languages, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProjectStatus } from '@/types/translation';

interface ProjectUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const languages = [
  'English',
  'Spanish',
  'French',
  'German',
  'Chinese',
  'Japanese',
  'Korean',
  'Portuguese',
  'Italian',
  'Russian',
  'Arabic',
  'Hindi',
];

export function ProjectUploadModal({ open, onOpenChange }: ProjectUploadModalProps) {
  const { addProject } = useTranslationStore();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    clientName: '',
    targetLanguages: [] as string[],
    deadline: '',
    deliveryDate: '',
    fileName: '',
    fileSize: 0,
    notes: '',
  });
  
  const [selectedTargetLanguages, setSelectedTargetLanguages] = useState<string[]>([]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientName || selectedTargetLanguages.length === 0 || !formData.deadline) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Simulate file upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addProject({
        ...formData,
        targetLanguages: selectedTargetLanguages,
        fileSize: formData.fileSize || Math.floor(Math.random() * 5000000) + 500000, // Random file size if not provided
        document: [],
        status: 'ocr-processing' as ProjectStatus,
      });
      
      toast.success('Project uploaded successfully!');
      onOpenChange(false);
      
      // Reset form
      setFormData({
        clientName: '',
        targetLanguages: [],
        deadline: '',
        deliveryDate: '',
        fileName: '',
        fileSize: 0,
        notes: '',
      });
      setSelectedTargetLanguages([]);
    } catch (error) {
      toast.error('Failed to upload project');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        fileName: file.name,
        fileSize: file.size,
      }));
    }
  };
  
  const toggleTargetLanguage = (language: string) => {
    setSelectedTargetLanguages(prev =>
      prev.includes(language)
        ? prev.filter(lang => lang !== language)
        : [...prev, language]
    );
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload New Project
          </DialogTitle>
          <DialogDescription>
            Fill in the project details and upload the document for translation.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Name */}
          <div className="space-y-2">
            <Label htmlFor="clientName" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Client Name *
            </Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
              placeholder="Enter client name"
              required
            />
          </div>
          
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document File *
            </Label>
            <Input
              id="file"
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt"
              required
            />
            {formData.fileName && (
              <p className="text-sm text-muted-foreground">
                Selected: {formData.fileName} ({(formData.fileSize / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
          

          
          {/* Target Language */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              Target Language *
            </Label>
            <Select
              value={selectedTargetLanguages[0] || ''}
              onValueChange={(value) => setSelectedTargetLanguages([value])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select target language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map(lang => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Deadline *
              </Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="deliveryDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Delivery Date
              </Label>
              <Input
                id="deliveryDate"
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData(prev => ({ ...prev, deliveryDate: e.target.value }))}
              />
            </div>
          </div>
          
          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any special instructions or requirements..."
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Project
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 