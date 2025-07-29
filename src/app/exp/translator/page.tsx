'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/translation/Sidebar';
import { ProjectCard } from '@/components/translation/ProjectCard';
import { ProjectDetailsModal } from '@/components/translation/ProjectDetailsModal';
import { CompactCalendar } from '@/components/translation/CompactCalendar';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Clock, AlertTriangle, User, Calendar, FileText, X, Check, AlertCircle } from 'lucide-react';
import { EnhancedNotifications } from '@/components/translation/EnhancedNotifications';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Project } from '@/types/translation';
import { InAppMessaging } from '@/components/messaging/InAppMessaging';
import { FloatingMessageButton } from '@/components/messaging/FloatingMessageButton';
import { useMessagingStore } from '@/lib/store/MessagingStore';

export default function TranslatorPage() {
  const router = useRouter();
  const { 
    currentUser, 
    projects, 
    teamMembers, 
    userRoles, 
    notifications,
    submitTranslation,
    updateProject
  } = useTranslationStore();
  
  const { unreadCount } = useMessagingStore();

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showMessaging, setShowMessaging] = useState(false);

  useEffect(() => {
    // Add a small delay to allow localStorage to load
    const timer = setTimeout(() => {
      if (!currentUser || currentUser.role !== 'translator') {
        router.push('/exp');
      } else {
        setIsLoading(false);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [currentUser, router]);
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'translator') {
    return null;
  }
  
  // Filter projects assigned to current translator
  const myProjects = projects.filter(p => p.assignedTranslator === currentUser.id);
  const assignedProjects = myProjects.filter(p => p.status === 'assigned');
  const inProgressProjects = myProjects.filter(p => ['in-progress', 'sent-back'].includes(p.status));
  const completedProjects = myProjects.filter(p => ['pm-review', 'completed'].includes(p.status));
  const sentBackProjects = myProjects.filter(p => p.status === 'sent-back');
  
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
  
  const handleSubmitTranslation = (project: Project) => {
    // Create mock translations for all document pages
    const translations: Record<string, string> = {};
    if (project.document) {
      project.document.forEach(page => {
        translations[page.id] = page.translatedText || `Translated: ${page.originalText}`;
      });
    }
    
    // Submit the translation
    submitTranslation(project.id, translations);
    toast.success('Translation submitted successfully! Awaiting PM review.');
  };
  
  const handleRequestHelp = (project: Project) => {
    toast.info('Help request sent to project manager');
    // Could add actual help request functionality here
  };
  
  const handleOpenPDFEditor = (project: Project) => {
    // Redirect to PDF editor with project context
    window.open(`/pdf-editor?projectId=${project.id}`, '_blank');
  };
  
  const handleCalendarDayClick = (date: Date, projects: Project[]) => {
    if (projects.length > 0) {
      // setSelectedDay(date); // This state was removed
      // setShowDayModal(true); // This state was removed
    }
  };

  // Get projects for a specific day
  const getProjectsForDay = (date: Date) => {
    return myProjects.filter(project => {
      if (!project.deadline) return false;
      const projectDate = new Date(project.deadline);
      return projectDate.toDateString() === date.toDateString();
    });
  };

  // Get status color for project
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ocr-processing':
        return 'bg-purple-500 hover:bg-purple-600';
      case 'pending-confirmation':
        return 'bg-orange-500 hover:bg-orange-600';
      case 'assigning-translator':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'assigned':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'in-progress':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'pm-review':
        return 'bg-pink-500 hover:bg-pink-600';
      case 'sent-back':
        return 'bg-red-500 hover:bg-red-600';
      case 'completed':
        return 'bg-green-500 hover:bg-green-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ocr-processing':
        return 'OCR';
      case 'pending-confirmation':
        return 'Confirm';
      case 'assigning-translator':
        return 'Assigning';
      case 'assigned':
        return 'Assigned';
      case 'in-progress':
        return 'In Progress';
      case 'pm-review':
        return 'PM Review';
      case 'sent-back':
        return 'Sent Back';
      case 'completed':
        return 'Completed';
      default:
        return 'Unknown';
    }
  };
  
  const stats = {
    assigned: assignedProjects.length,
    inProgress: inProgressProjects.length,
    completed: completedProjects.length,
    overdue: myProjects.filter(p => new Date(p.deadline) < new Date()).length,
  };
  
  // Helper component for project grids
  const ProjectGrid: React.FC<{ 
    projects: Project[]; 
    onProjectClick: (project: Project) => void;
  }> = ({ projects, onProjectClick }) => {
    if (projects.length === 0) {
      return (
        <div className="text-center py-12 bg-white/70 backdrop-blur-sm rounded-lg border">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No projects in this category</p>
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => onProjectClick(project)}
            showAssignmentActions={project.status === 'assigned' || project.status === 'in-progress' || project.status === 'sent-back'}
            onAcceptAssignment={project.status === 'assigned' ? () => handleAcceptAssignment(project) : undefined}
            onDeclineAssignment={project.status === 'assigned' ? () => handleDeclineAssignment(project) : undefined}
            onSubmitTranslation={project.status === 'in-progress' || project.status === 'sent-back' ? () => handleSubmitTranslation(project) : undefined}
            onOpenPDFEditor={project.status === 'in-progress' || project.status === 'sent-back' ? () => handleOpenPDFEditor(project) : undefined}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-sm border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Welcome back, {currentUser?.name}
                  </h1>
                  <p className="text-sm text-gray-600">
                    You have {assignedProjects.length + inProgressProjects.length + sentBackProjects.length} active projects
                  </p>
                </div>
                <EnhancedNotifications 
                  isOpen={false} 
                  onClose={() => {}} 
                />
              </div>
            </div>

            {/* Stats Cards */}
            <div className="p-6 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Assigned</p>
                        <p className="text-2xl font-bold text-blue-600">{assignedProjects.length}</p>
                      </div>
                      <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">In Progress</p>
                        <p className="text-2xl font-bold text-yellow-600">{inProgressProjects.length}</p>
                      </div>
                      <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Clock className="h-4 w-4 text-yellow-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Sent Back</p>
                        <p className="text-2xl font-bold text-red-600">{sentBackProjects.length}</p>
                      </div>
                      <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Completed</p>
                        <p className="text-2xl font-bold text-green-600">{completedProjects.length}</p>
                      </div>
                      <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Project Tabs */}
            <div className="flex-1 px-6 pb-6">
              <Tabs defaultValue="assigned" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-4 bg-white/70 backdrop-blur-sm">
                  <TabsTrigger value="assigned" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    Assigned ({assignedProjects.length})
                  </TabsTrigger>
                  <TabsTrigger value="in-progress" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white">
                    In Progress ({inProgressProjects.length})
                  </TabsTrigger>
                  <TabsTrigger value="sent-back" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
                    Sent Back ({sentBackProjects.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
                    Completed ({completedProjects.length})
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 mt-4">
                  <TabsContent value="assigned" className="h-full">
                    <ProjectGrid projects={assignedProjects} onProjectClick={handleProjectClick} />
                  </TabsContent>
                  
                  <TabsContent value="in-progress" className="h-full">
                    <ProjectGrid projects={inProgressProjects} onProjectClick={handleProjectClick} />
                  </TabsContent>
                  
                  <TabsContent value="sent-back" className="h-full">
                    <ProjectGrid projects={sentBackProjects} onProjectClick={handleProjectClick} />
                  </TabsContent>
                  
                  <TabsContent value="completed" className="h-full">
                    <ProjectGrid projects={completedProjects} onProjectClick={handleProjectClick} />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>

          {/* Calendar Sidebar */}
          <div className="w-1/2 border-l bg-white/50 backdrop-blur-sm">
            <CompactCalendar 
              projects={myProjects}
              onDayClick={handleCalendarDayClick}
              title="My Project Calendar"
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedProject && (
        <ProjectDetailsModal
          open={showDetailsModal}
          onOpenChange={(open) => {
            setShowDetailsModal(open);
            if (!open) setSelectedProject(null);
          }}
          project={selectedProject}
        />
      )}

      {/* In-App Messaging */}
      <InAppMessaging isOpen={showMessaging} onClose={() => setShowMessaging(false)} />

      {/* Floating Message Button */}
      <FloatingMessageButton 
        unreadCount={unreadCount} 
        onClick={() => setShowMessaging(true)} 
      />
    </div>
  );
} 