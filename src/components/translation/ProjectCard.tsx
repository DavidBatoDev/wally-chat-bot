'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  Eye,
  Edit,
  Download,
  Share2,
  Star,
  TrendingUp,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import type { Project, TeamMember } from '@/types/translation';
import { format, formatDistanceToNow, isAfter, isBefore } from 'date-fns';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Button } from '@/components/ui/button';

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  animationDelay?: number;
  showActions?: boolean;
  hideActionBadge?: boolean; // New prop to hide action required badge
  showAssignmentActions?: boolean; // Show accept/decline buttons for assigned projects
  onAcceptAssignment?: () => void; // Handler for accepting assignment
  onDeclineAssignment?: () => void; // Handler for declining assignment
  onRequestHelp?: () => void; // Handler for requesting help
  onSubmitTranslation?: () => void; // Handler for submitting translation
  onOpenPDFEditor?: () => void; // Handler for opening PDF editor
}

const statusConfig = {
  'ocr-processing': { label: 'OCR Processing', color: 'bg-blue-600', borderColor: 'border-l-blue-600', icon: Loader2 },
  'pending-confirmation': { label: 'Pending Confirmation', color: 'bg-orange-500', borderColor: 'border-l-orange-500', icon: AlertCircle },
  'assigning-translator': { label: 'Assigning Translator', color: 'bg-blue-500', borderColor: 'border-l-blue-500', icon: User },
  'manual-assignment': { label: 'Manual Assignment Required', color: 'bg-red-500', borderColor: 'border-l-red-500', icon: AlertTriangle },
  'assigned': { label: 'Assigned', color: 'bg-blue-500', borderColor: 'border-l-blue-500', icon: User },
  'in-progress': { label: 'In Progress', color: 'bg-yellow-500', borderColor: 'border-l-yellow-500', icon: Loader2 },
  'sent-back': { label: 'Sent Back', color: 'bg-red-500', borderColor: 'border-l-red-500', icon: AlertCircle },
  'pm-review': { label: 'PM Review', color: 'bg-orange-500', borderColor: 'border-l-orange-500', icon: CheckCircle },
  'completed': { label: 'Completed', color: 'bg-green-500', borderColor: 'border-l-green-500', icon: CheckCircle },
};

export function ProjectCard({ 
  project, 
  onClick, 
  animationDelay = 0, 
  showActions = true, 
  hideActionBadge = false,
  showAssignmentActions = false,
  onAcceptAssignment,
  onDeclineAssignment,
  onRequestHelp,
  onSubmitTranslation,
  onOpenPDFEditor
}: ProjectCardProps) {
  const { teamMembers, userRoles } = useTranslationStore();
  
  // Determine the effective status for styling
  const getEffectiveStatus = () => {
    if (project.status === 'assigning-translator' && project.actionType === 'manual-assignment') {
      return 'manual-assignment';
    }
    return project.status;
  };
  
  const effectiveStatus = getEffectiveStatus();
  const statusInfo = statusConfig[effectiveStatus];
  const isProcessing = project.status === 'ocr-processing';
  const StatusIcon = statusInfo.icon;
  
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getMemberById = (id: string): TeamMember | undefined => {
    return teamMembers.find(member => member.id === id);
  };

  const getMemberByIdOrName = (idOrName: string): TeamMember | undefined => {
    return teamMembers.find(member => member.id === idOrName || member.name === idOrName);
  };

  const getAssignedMember = (): TeamMember | undefined => {
    if (project.assignedTranslator) {
      return getMemberById(project.assignedTranslator);
    }
    return undefined;
  };

  const getCreatedByMember = (): TeamMember | undefined => {
    if (project.createdBy) {
      // Try to find by ID first, then by name for backward compatibility
      return getMemberByIdOrName(project.createdBy);
    }
    return undefined;
  };

  const getApprovedByMember = (): TeamMember | undefined => {
    if (project.finalApprovalBy) {
      // Try to find by ID first, then by name for backward compatibility
      return getMemberByIdOrName(project.finalApprovalBy);
    }
    return undefined;
  };

  const assignedMember = getAssignedMember();
  const createdByMember = getCreatedByMember();
  const approvedByMember = getApprovedByMember();
  
  const isOverdue = project.deadline && isAfter(new Date(), new Date(project.deadline));
  const isDueSoon = project.deadline && isBefore(new Date(), new Date(project.deadline)) && 
    isAfter(new Date(), new Date(Date.now() - 24 * 60 * 60 * 1000));
  
  const getPageCount = () => project.document?.length || 0;
  const getWordCount = () => {
    if (!project.document?.length) return 0;
    return project.document.reduce((total, page) => {
      return total + (page.originalText?.split(' ').length || 0);
    }, 0);
  };
  
  return (
    <TooltipProvider>
      <Card
        className={cn(
          "group relative cursor-pointer overflow-hidden transition-all duration-300",
          "hover:shadow-lg hover:-translate-y-1 border-l-4 bg-white",
          "animate-in fade-in-50 slide-in-from-bottom-4",
          statusInfo.borderColor
        )}
        style={{ animationDelay: `${animationDelay}ms` }}
        onClick={onClick}
      >
        {/* Status Badge */}
        <div className="absolute right-2 top-2 z-10">
          <Badge
            variant="secondary"
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 text-xs font-medium",
              statusInfo.color,
              "text-white border-0"
            )}
          >
            <StatusIcon className={cn("h-3 w-3", isProcessing && "animate-spin")} />
            <span>{statusInfo.label}</span>
          </Badge>
        </div>
        
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1 min-w-0 pr-16">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold line-clamp-1 text-gray-900">
                  {project.qCode}
                </CardTitle>
                {/* Action Badge - Only show for PM review status and not hidden */}
                {project.status === 'pm-review' && !hideActionBadge && (
                  <Badge 
                    variant="outline" 
                    className="bg-blue-50 border-blue-200 text-blue-700 text-xs px-1.5 py-0.5"
                  >
                    Action Required
                  </Badge>
                )}
              </div>
              <CardDescription className="text-sm font-medium text-gray-600">
                {project.clientName}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3 px-4 pb-4">
          {/* Target Languages - Limit to 2 */}
          <div className="flex flex-wrap gap-1">
            {project.targetLanguages.slice(0, 2).map((lang) => (
              <Badge key={lang} variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                {lang}
              </Badge>
            ))}
            {project.targetLanguages.length > 2 && (
              <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                +{project.targetLanguages.length - 2} more
              </Badge>
            )}
          </div>

          {/* Deadline */}
          {project.deadline && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className={cn(
                "font-medium",
                isOverdue ? "text-red-600" : isDueSoon ? "text-orange-600" : "text-gray-700"
              )}>
                Due {format(new Date(project.deadline), 'MMM d, yyyy')}
              </span>
            </div>
          )}

          {/* Assigned Translator */}
          {assignedMember && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Assigned to:</span>
              <Avatar className="h-6 w-6">
                <AvatarImage src={assignedMember.avatar} />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                  {assignedMember.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-gray-700 font-medium">{assignedMember.name}</span>
            </div>
          )}

          {/* Created by PM */}
          {createdByMember && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500">Created by:</span>
              <Avatar className="h-5 w-5">
                <AvatarImage src={createdByMember.avatar} />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                  {createdByMember.name.split(' ').map((n: string) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-gray-600 font-medium">{createdByMember.name}</span>
            </div>
          )}

          {/* Approved by PM - Only for completed projects */}
          {project.status === 'completed' && approvedByMember && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Approved by:</span>
              <Avatar className="h-5 w-5">
                <AvatarImage src={approvedByMember.avatar} />
                <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                  {approvedByMember.name.split(' ').map((n: string) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-gray-600 font-medium">{approvedByMember.name}</span>
            </div>
          )}

          {/* Assignment Actions - Only for assigned projects */}
          {showAssignmentActions && project.status === 'assigned' && (
            <div className="flex gap-2 pt-3 border-t border-gray-100 justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeclineAssignment?.();
                }}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 h-7 px-3 text-xs"
              >
                <X className="mr-1 h-3 w-3" />
                Decline
              </Button>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAcceptAssignment?.();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white h-7 px-3 text-xs"
              >
                <Check className="mr-1 h-3 w-3" />
                Accept
              </Button>
            </div>
          )}

          {/* Quick Actions - For in-progress and sent-back projects */}
          {showAssignmentActions && ['in-progress', 'sent-back'].includes(project.status) && (
            <div className="flex gap-2 pt-3 border-t border-gray-100 justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPDFEditor?.();
                }}
                className="text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300 h-7 px-3 text-xs"
              >
                <FileText className="mr-1 h-3 w-3" />
                Open in PDF Editor
              </Button>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSubmitTranslation?.();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white h-7 px-3 text-xs"
              >
                <CheckCircle className="mr-1 h-3 w-3" />
                Submit Translation & Proofreading
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
} 