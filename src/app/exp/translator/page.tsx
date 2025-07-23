'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/translation/Sidebar';
import { ProjectCard } from '@/components/translation/ProjectCard';
import { ProjectDetailsModal } from '@/components/translation/ProjectDetailsModal';
import { NotificationPanel } from '@/components/translation/NotificationPanel';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '@/types/translation';

export default function TranslatorPage() {
  const router = useRouter();
  const { currentUser, projects, updateProject } = useTranslationStore();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'translator') {
      router.push('/exp');
    }
  }, [currentUser, router]);
  
  if (!currentUser || currentUser.role !== 'translator') {
    return null;
  }
  
  // Filter projects assigned to current translator
  const myProjects = projects.filter(p => p.assignedTranslator === currentUser.name);
  const assignedProjects = myProjects.filter(p => p.status === 'assigned');
  const inProgressProjects = myProjects.filter(p => p.status === 'in-progress');
  const completedProjects = myProjects.filter(p => ['pm-review', 'completed'].includes(p.status));
  
  const handleAcceptAssignment = (project: Project) => {
    const { acceptAssignment } = useTranslationStore.getState();
    acceptAssignment(project.id);
    toast.success('Assignment accepted! You can now start translating.');
  };
  
  const handleDeclineAssignment = (project: Project) => {
    updateProject(project.id, { 
      status: 'assigning-translator',
      assignedTranslator: undefined 
    });
    toast.info('Assignment declined. The project will be reassigned.');
  };
  
  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setShowDetailsModal(true);
  };
  
  const stats = {
    assigned: assignedProjects.length,
    inProgress: inProgressProjects.length,
    completed: completedProjects.length,
    overdue: myProjects.filter(p => new Date(p.deadline) < new Date()).length,
  };
  
  return (
    <div className="flex h-screen">
      <Sidebar 
        onAcceptAssignment={() => {
          const project = assignedProjects[0];
          if (project) handleAcceptAssignment(project);
        }}
        onDeclineAssignment={() => {
          const project = assignedProjects[0];
          if (project) handleDeclineAssignment(project);
        }}
        onMarkComplete={() => toast.info('Submit translation through project details')}
        onRequestHelp={() => toast.info('Help request feature coming soon')}
        onNotificationClick={() => setShowNotifications(!showNotifications)}
      />
      
                        <main className="flex-1 overflow-auto">
                    <div className="min-h-full p-6 bg-gray-50">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">My Translation Projects</h1>
            <p className="text-muted-foreground">Manage your assigned translation work</p>
          </div>
          
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Assigned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.assigned}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Overdue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Projects Tabs */}
          <Tabs defaultValue="assigned" className="space-y-4">
            <TabsList>
              <TabsTrigger value="assigned">
                Assigned
                {assignedProjects.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {assignedProjects.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="in-progress">
                In Progress
                {inProgressProjects.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {inProgressProjects.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed
                {completedProjects.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {completedProjects.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="assigned" className="space-y-4">
              {assignedProjects.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">No new assignments</p>
                  </CardContent>
                </Card>
              ) : (
                assignedProjects.map((project) => (
                  <div key={project.id} className="space-y-3">
                    <ProjectCard 
                      project={project} 
                      onClick={() => handleProjectClick(project)}
                    />
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => handleDeclineAssignment(project)}
                        className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAcceptAssignment(project)}
                        className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                      >
                        Accept Assignment
                      </button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
            
            <TabsContent value="in-progress" className="space-y-4">
              {inProgressProjects.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">No projects in progress</p>
                  </CardContent>
                </Card>
              ) : (
                inProgressProjects.map((project) => (
                  <ProjectCard 
                    key={project.id}
                    project={project} 
                    onClick={() => handleProjectClick(project)}
                  />
                ))
              )}
            </TabsContent>
            
            <TabsContent value="completed" className="space-y-4">
              {completedProjects.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">No completed projects</p>
                  </CardContent>
                </Card>
              ) : (
                completedProjects.map((project) => (
                  <ProjectCard 
                    key={project.id}
                    project={project} 
                    onClick={() => handleProjectClick(project)}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      {selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          open={showDetailsModal}
          onOpenChange={(open) => {
            setShowDetailsModal(open);
            if (!open) setSelectedProject(null);
          }}
        />
      )}
      
      {/* Notifications */}
      <NotificationPanel 
        open={showNotifications} 
        onOpenChange={setShowNotifications}
      />
    </div>
  );
} 