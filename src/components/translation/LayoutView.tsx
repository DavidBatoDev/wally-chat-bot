'use client';

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProjectCard } from './ProjectCard';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import type { Project, ProjectStatus } from '@/types/translation';
import { cn } from '@/lib/utils';
import { Loader2, Bot } from 'lucide-react';

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
    color: 'border-blue-500',
  },
  {
    id: 'assigned',
    title: 'Assigned',
    statuses: ['assigned', 'assigning-translator'],
    row: 'agent',
    color: 'border-purple-500',
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    statuses: ['in-progress'],
    row: 'agent',
    color: 'border-indigo-500',
  },
  {
    id: 'completed',
    title: 'Completed',
    statuses: ['completed'],
    row: 'agent',
    color: 'border-green-500',
  },
  // Row 2: User Action Request (Single holder)
  {
    id: 'user-action-request',
    title: 'User Action Request',
    statuses: ['pending-confirmation', 'pm-review'],
    row: 'user',
    color: 'border-orange-500',
  },
];

interface LayoutViewProps {
  onProjectClick?: (project: Project) => void;
}

export function LayoutView({ onProjectClick }: LayoutViewProps) {
  const { projects } = useTranslationStore();
  
  const getProjectsForColumn = (column: KanbanColumn): Project[] => {
    if (column.id === 'user-action-request') {
      // Include both OCR confirmation and PM review projects
      return projects.filter(p => 
        p.status === 'pending-confirmation' || p.status === 'pm-review'
      );
    }
    return projects.filter(p => column.statuses.includes(p.status));
  };
  
  const agentColumns = kanbanColumns.filter(col => col.row === 'agent');
  const userColumns = kanbanColumns.filter(col => col.row === 'user');
  
  const renderColumn = (column: KanbanColumn) => {
    const columnProjects = getProjectsForColumn(column);
    const hasProcessing = column.id === 'new-projects' && columnProjects.some(p => p.status === 'ocr-processing');
    const hasAssigning = column.id === 'assigned' && columnProjects.some(p => p.status === 'assigning-translator');
    
    return (
      <Card
        key={column.id}
        className={cn(
          "flex-1 min-w-[300px] border-t-4 transition-all",
          column.color,
          (hasProcessing || hasAssigning) && "border-t-8 animate-pulse"
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold">{column.title}</CardTitle>
              {hasProcessing && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Bot className="h-4 w-4" />
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {hasAssigning && (
                <div className="flex items-center gap-1 text-purple-600">
                  <Bot className="h-4 w-4" />
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </div>
            <Badge variant="secondary" className="ml-2">
              {columnProjects.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-3 pr-4">
              {columnProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No projects</p>
                </div>
              ) : (
                columnProjects.map((project, index) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => onProjectClick?.(project)}
                    animationDelay={index * 100}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };
  
    return (
    <div className="space-y-6 pb-8">
      {/* Row 1: Agent Processing */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          Agent Processing
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {agentColumns.map(column => renderColumn(column))}
        </div>
      </div>

      {/* Row 2: User Action Request */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          User Action Request
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {userColumns.map(column => renderColumn(column))}
        </div>
      </div>
    </div>
  );
} 