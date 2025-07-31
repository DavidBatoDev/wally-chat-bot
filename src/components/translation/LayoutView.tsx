'use client';

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProjectCard } from './ProjectCard';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import type { Project, ProjectStatus, TeamMember } from '@/types/translation';
import { cn } from '@/lib/utils';
import { Loader2, Bot, AlertCircle, Users, User } from 'lucide-react';
import { StaggeredList } from '@/components/ui/animations';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';

interface KanbanColumn {
  id: string;
  title: string;
  statuses: ProjectStatus[];
  row: 'agent' | 'user';
  color: string;
}

const kanbanColumns: KanbanColumn[] = [
  // Row 1: Agent Processing
  {
    id: 'new-projects',
    title: 'New Projects',
    statuses: ['ocr-processing'],
    row: 'agent',
    color: 'border-blue-600',
  },
  {
    id: 'assigned',
    title: 'Assigned',
    statuses: ['assigned', 'assigning-translator'],
    row: 'agent',
    color: 'border-blue-500',
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    statuses: ['in-progress', 'sent-back'],
    row: 'agent',
    color: 'border-yellow-500',
  },
  {
    id: 'completed',
    title: 'Completed',
    statuses: ['completed'],
    row: 'agent',
    color: 'border-green-500',
  },
];

interface LayoutViewProps {
  onProjectClick?: (project: Project) => void;
}

interface TranslatorModalProps {
  translator: TeamMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
}

function TranslatorModal({ translator, open, onOpenChange, projects }: TranslatorModalProps) {
  const translatorProjects = projects.filter(p => p.assignedTranslator === translator.id);
  
  // Group projects by status
  const projectsByStatus = {
    assigned: translatorProjects.filter(p => p.status === 'assigned'),
    'in-progress': translatorProjects.filter(p => ['in-progress', 'sent-back'].includes(p.status)),
    'pm-review': translatorProjects.filter(p => p.status === 'pm-review'),
    completed: translatorProjects.filter(p => p.status === 'completed'),
  };

  // Status configuration for color coding
  const statusConfig = {
    assigned: { label: 'Assigned', color: 'bg-blue-500', borderColor: 'border-l-blue-500' },
    'in-progress': { label: 'In Progress', color: 'bg-yellow-500', borderColor: 'border-l-yellow-500' },
    'pm-review': { label: 'PM Review', color: 'bg-orange-500', borderColor: 'border-l-orange-500' },
    completed: { label: 'Completed', color: 'bg-green-500', borderColor: 'border-l-green-500' },
  };

  // Compact Project Card Component
  const CompactProjectCard = ({ project }: { project: Project }) => {
    const getStatusInfo = () => {
      if (project.status === 'assigned') return statusConfig.assigned;
      if (['in-progress', 'sent-back'].includes(project.status)) return statusConfig['in-progress'];
      if (project.status === 'pm-review') return statusConfig['pm-review'];
      if (project.status === 'completed') return statusConfig.completed;
      return statusConfig.assigned;
    };

    const statusInfo = getStatusInfo();

    return (
      <div className={cn(
        "p-3 border rounded-lg bg-white hover:shadow-sm transition-all border-l-4",
        statusInfo.borderColor
      )}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-sm text-gray-900 truncate">{project.qCode}</p>
              <Badge className={cn("text-xs px-2 py-0.5 text-white", statusInfo.color)}>
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-xs text-gray-600 truncate mb-2">{project.clientName}</p>
            <div className="flex items-center gap-1 flex-wrap">
              {project.targetLanguages.slice(0, 2).map((lang) => (
                <Badge key={lang} variant="outline" className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
                  {lang}
                </Badge>
              ))}
              {project.targetLanguages.length > 2 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-gray-50 text-gray-600">
                  +{project.targetLanguages.length - 2}
                </Badge>
              )}
            </div>
          </div>
          {project.deadline && (
            <div className="text-right ml-3">
              <p className="text-xs text-gray-500">Due</p>
              <p className="text-xs font-medium text-gray-700">
                {format(new Date(project.deadline), 'MMM d')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={translator.avatar} />
              <AvatarFallback className="bg-blue-100 text-blue-700 text-lg">
                {translator.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl font-bold text-gray-900">{translator.name}</span>
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  translator.availability === 'available' && 'bg-green-500',
                  translator.availability === 'busy' && 'bg-yellow-500',
                  translator.availability === 'offline' && 'bg-gray-500'
                )} />
                <span className="text-sm text-gray-600 capitalize">{translator.availability}</span>
              </div>
              
              {/* Translator Stats */}
              <div className="grid grid-cols-4 gap-4 mb-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{translator.score || 4.8}</div>
                  <div className="text-xs text-gray-500">Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{translatorProjects.length}</div>
                  <div className="text-xs text-gray-500">Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">
                    {translatorProjects.filter(p => ['in-progress', 'sent-back'].includes(p.status)).length}
                  </div>
                  <div className="text-xs text-gray-500">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {translator.availableTime || '09:00-17:00'}
                  </div>
                  <div className="text-xs text-gray-500">Available (UTC)</div>
                </div>
              </div>

              {/* Specialty Languages */}
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Specialty Languages:</p>
                <div className="flex flex-wrap gap-1">
                  {(translator.specialtyLanguages || ['English', 'Spanish', 'French']).map((lang: string) => (
                    <Badge key={lang} className="text-xs px-2 py-1 bg-blue-600 text-white">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-6">
            {Object.entries(projectsByStatus).map(([status, statusProjects]) => (
              statusProjects.length > 0 && (
                <div key={status} className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 capitalize">
                      {status.replace('-', ' ')}
                    </h3>
                    <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                      {statusProjects.length}
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {statusProjects.map((project) => (
                      <CompactProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                </div>
              )
            ))}
            
            {translatorProjects.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No projects assigned</p>
                <p className="text-sm text-gray-500 mt-1">This translator is available for new assignments</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function LayoutView({ onProjectClick }: LayoutViewProps) {
  const { projects, teamMembers } = useTranslationStore();
  const [selectedTranslator, setSelectedTranslator] = useState<TeamMember | null>(null);
  const [showTranslatorModal, setShowTranslatorModal] = useState(false);
  
  const getProjectsForColumn = (column: KanbanColumn): Project[] => {
    return projects.filter(p => {
      // Include projects that match the column status
      const matchesStatus = column.statuses.includes(p.status);
      
      // Exclude manual assignment projects from regular kanban columns
      // They should only appear in the User Action Request section
      const isManualAssignment = p.status === 'assigning-translator' && p.actionType === 'manual-assignment';
      
      return matchesStatus && !isManualAssignment;
    });
  };
  
  const agentColumns = kanbanColumns.filter(col => col.row === 'agent');
  const userActionProjects = projects.filter(p => 
    p.status === 'pending-confirmation' || 
    p.status === 'pm-review' ||
    (p.status === 'assigning-translator' && p.actionType === 'manual-assignment')
  );

  // Get translator stats
  const translators = teamMembers.filter(member => member.role === 'translator');
  const translatorStats = translators.map(translator => {
    const translatorProjects = projects.filter(p => p.assignedTranslator === translator.id);
    return {
      ...translator,
      assigned: translatorProjects.filter(p => p.status === 'assigned').length,
      inProgress: translatorProjects.filter(p => ['in-progress', 'sent-back'].includes(p.status)).length,
      total: translatorProjects.length,
    };
  });

  const handleTranslatorClick = (translator: TeamMember) => {
    setSelectedTranslator(translator);
    setShowTranslatorModal(true);
  };
  
  const renderColumn = (column: KanbanColumn) => {
    const columnProjects = getProjectsForColumn(column);
    const hasProcessing = column.id === 'new-projects' && columnProjects.some(p => p.status === 'ocr-processing');
    const hasAssigning = column.id === 'assigned' && columnProjects.some(p => p.status === 'assigning-translator');
    
    return (
      <Card
        key={column.id}
        className={cn(
          "flex-1 min-w-[280px] border-t-4 transition-all bg-white shadow-sm",
          column.color,
          (hasProcessing || hasAssigning) && "border-t-8"
        )}
      >
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-gray-900">{column.title}</CardTitle>
              {hasProcessing && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs font-medium">Processing</span>
                </div>
              )}
              {hasAssigning && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs font-medium">Assigning</span>
                </div>
              )}
            </div>
            <Badge 
              variant="secondary" 
              className="bg-gray-100 text-gray-700 text-sm px-2 py-1"
            >
              {columnProjects.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              <StaggeredList staggerDelay={100}>
                {columnProjects.map((project, index) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => onProjectClick?.(project)}
                    animationDelay={index * 100}
                  />
                ))}
              </StaggeredList>
              
              {columnProjects.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                  <p className="text-sm text-center">No projects in this stage</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Agent Processing Row */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Bot className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-blue-900">Automated Processing</h2>
          <div className="flex-1 h-px bg-blue-200" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {agentColumns.map(renderColumn)}
        </div>
      </div>

      {/* Bottom Row: User Action Request + Translator Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Action Request - Smaller */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-orange-900">Requires Attention</h2>
            <div className="flex-1 h-px bg-orange-200" />
          </div>
          <Card className="border-t-4 border-orange-500 bg-white shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-gray-900">User Action Request</CardTitle>
                <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-sm px-2 py-1">
                  {userActionProjects.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {userActionProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onClick={() => onProjectClick?.(project)}
                    />
                  ))}
                  
                  {userActionProjects.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                        <AlertCircle className="h-6 w-6 text-orange-400" />
                      </div>
                      <p className="text-sm text-center">No pending actions</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Translator Management */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Users className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-blue-900">Translator Workload</h2>
            <div className="flex-1 h-px bg-blue-200" />
          </div>
          <Card className="border-t-4 border-blue-500 bg-white shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-gray-900">Team Overview</CardTitle>
                <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-sm px-2 py-1">
                  {translators.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {translatorStats.map((translator) => (
                    <div
                      key={translator.id}
                      className="p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => handleTranslatorClick(translator)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={translator.avatar} />
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                            {translator.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {translator.name}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-600">
                            <span>Assigned: {translator.assigned}</span>
                            <span>In Progress: {translator.inProgress}</span>
                            <span>Total: {translator.total}</span>
                          </div>
                        </div>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          translator.availability === 'available' && 'bg-green-500',
                          translator.availability === 'busy' && 'bg-yellow-500',
                          translator.availability === 'offline' && 'bg-gray-500'
                        )} />
                      </div>
                    </div>
                  ))}
                  
                  {translators.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                        <User className="h-6 w-6 text-blue-400" />
                      </div>
                      <p className="text-sm text-center">No translators available</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Translator Detail Modal */}
      {selectedTranslator && (
        <TranslatorModal
          translator={selectedTranslator}
          open={showTranslatorModal}
          onOpenChange={(open) => {
            setShowTranslatorModal(open);
            if (!open) setSelectedTranslator(null);
          }}
          projects={projects}
        />
      )}
    </div>
  );
} 