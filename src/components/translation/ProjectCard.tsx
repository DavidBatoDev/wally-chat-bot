'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Calendar,
  FileText,
  Languages,
  User,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import type { Project } from '@/types/translation';
import { format } from 'date-fns';

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  animationDelay?: number;
}

const statusConfig = {
  'ocr-processing': { label: 'OCR Processing', color: 'bg-blue-500', icon: Loader2 },
  'pending-confirmation': { label: 'Pending Confirmation', color: 'bg-yellow-500', icon: AlertCircle },
  'assigning-translator': { label: 'Assigning Translator', color: 'bg-orange-500', icon: User },
  'assigned': { label: 'Assigned', color: 'bg-purple-500', icon: User },
  'in-progress': { label: 'In Progress', color: 'bg-indigo-500', icon: Loader2 },
  'pm-review': { label: 'PM Review', color: 'bg-orange-500', icon: CheckCircle },
  'completed': { label: 'Completed', color: 'bg-green-500', icon: CheckCircle },
};

export function ProjectCard({ project, onClick, animationDelay = 0 }: ProjectCardProps) {
  const statusInfo = statusConfig[project.status];
  const isProcessing = project.status === 'ocr-processing';
  const StatusIcon = statusInfo.icon;
  
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };
  
  return (
    <Card
      className={cn(
        "group relative cursor-pointer overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-1",
        "animate-in fade-in-50 slide-in-from-bottom-4"
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={onClick}
    >
      {/* Status Badge */}
      <div className="absolute right-4 top-4 z-10">
        <Badge
          variant="secondary"
          className={cn(
            "flex items-center gap-1 px-2 py-1",
            statusInfo.color,
            "text-white"
          )}
        >
          <StatusIcon className={cn("h-3 w-3", isProcessing && "animate-spin")} />
          <span className="text-xs">{statusInfo.label}</span>
        </Badge>
      </div>
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold line-clamp-1 pr-20">
              {project.qCode}
            </CardTitle>
            <CardDescription className="text-sm">
              {project.clientName}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* OCR Processing Progress */}
        {isProcessing && project.ocrProgress !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Agent OCR Processing</span>
              <span className="font-medium">{project.ocrProgress}%</span>
            </div>
            <Progress value={project.ocrProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Extracting text from document pages...
            </p>
          </div>
        )}
        
        {/* Project Details */}
        <div className="space-y-3">
          {/* Languages */}
          <div className="flex items-center gap-2 text-sm">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {project.sourceLanguage} → {project.targetLanguages.join(', ')}
            </span>
          </div>
          
          {/* File Info */}
          {project.fileName && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground line-clamp-1">
                {project.fileName} ({formatFileSize(project.fileSize)})
              </span>
            </div>
          )}
          
          {/* Deadline */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Deadline: {format(new Date(project.deadline), 'MMM dd, yyyy')}
            </span>
          </div>
          
          {/* Team Members */}
          {(project.assignedTranslator) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>
                Translator: {project.assignedTranslator}
              </span>
            </div>
          )}
        </div>
        
        {/* Action Required Badge */}
        {project.actionType && project.status !== 'completed' && (
          <div className="pt-2">
            <Badge variant="outline" className="w-full justify-center">
              {project.actionType === 'confirmation' ? 'OCR Confirmation Required' : 'Final Approval Required'}
            </Badge>
          </div>
        )}
        
        {/* View Details Indicator */}
        <div className="absolute bottom-4 right-4 opacity-0 transition-opacity group-hover:opacity-100">
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
} 