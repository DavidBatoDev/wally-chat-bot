'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/translation/Sidebar';
import { LayoutView } from '@/components/translation/LayoutView';
import { ProjectUploadModal } from '@/components/translation/ProjectUploadModal';
import { OCRConfirmationModal } from '@/components/translation/OCRConfirmationModal';
import { ProjectDetailsModal } from '@/components/translation/ProjectDetailsModal';
import { ManualAssignmentModal } from '@/components/translation/ManualAssignmentModal';
import { AgentProcessingIndicator } from '@/components/translation/AgentProcessingIndicator';
import { TranslatorAssignmentIndicator } from '@/components/translation/TranslatorAssignmentIndicator';

import { DashboardStatsSkeleton, ProjectCardSkeleton } from '@/components/translation/LoadingSkeletons';
import { StaggeredList, FadeIn } from '@/components/ui/animations';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Users, BarChart3, Settings } from 'lucide-react';
import type { Project } from '@/types/translation';

// Import new components
import { 
  MetricCard, 
  ActivityFeed, 
  TeamStatusWidget, 
  DeadlineTracker 
} from '@/components/dashboard/DashboardWidgets';
import { SmartNotificationCenter } from '@/components/notifications/SmartNotificationCenter';
import { InAppMessaging } from '@/components/messaging/InAppMessaging';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { FloatingMessageButton } from '@/components/messaging/FloatingMessageButton';
import { useMessagingStore } from '@/lib/store/MessagingStore';

export default function ProjectManagerPage() {
  const router = useRouter();
  const { currentUser, projects, teamMembers, userRoles, notifications } = useTranslationStore();
  const { unreadCount } = useMessagingStore();
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showManualAssignmentModal, setShowManualAssignmentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [activeTab, setActiveTab] = useState('projects');
  
  // Check for projects being processed
  const processingProjects = projects.filter(p => 
    p.status === 'ocr-processing' || 
    p.status === 'assigning-translator'
  );
  
  const getProcessingMessage = () => {
    const ocrProject = projects.find(p => p.status === 'ocr-processing');
    if (ocrProject) {
      return `Processing OCR for ${ocrProject.clientName} - ${ocrProject.ocrProgress || 0}%`;
    }
    const assigningProject = projects.find(p => p.status === 'assigning-translator');
    if (assigningProject) {
      return `Finding translator for ${assigningProject.qCode}...`;
    }
    return '';
  };
  
  // Initialize data and set current user if not set
  useEffect(() => {
    const timer = setTimeout(() => {
      // Just set loading to false, initialization is handled in the layout
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);
  
  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    
    if (project.status === 'pending-confirmation' && project.actionType === 'confirmation') {
      setShowOCRModal(true);
    } else if (project.status === 'assigning-translator' && project.actionType === 'manual-assignment') {
      setShowManualAssignmentModal(true);
    } else {
      setShowDetailsModal(true);
    }
  };

  // Calculate dashboard metrics
  const metrics = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => !['completed', 'cancelled'].includes(p.status)).length,
    completedToday: projects.filter(p => {
      const today = new Date().toDateString();
      return p.status === 'completed' && 
        p.finalApprovalAt && 
        new Date(p.finalApprovalAt).toDateString() === today;
    }).length,
    pendingReview: projects.filter(p => p.status === 'pm-review').length,
  };

  // Prepare comprehensive activity feed data from all projects
  const activities = React.useMemo(() => {
    const allActivities: Array<{
      id: string;
      user: { name: string; avatar?: string };
      action: string;
      target: string;
      timestamp: string;
      type: 'success' | 'warning' | 'info' | 'error';
    }> = [];

    // Helper function to get user name and role
    const getUserInfo = (userId: string | undefined) => {
      if (!userId) return { name: 'System', role: 'system' };
      
      const teamMember = teamMembers.find(member => member.id === userId || member.name === userId);
      if (teamMember) {
        const roleLabel = teamMember.role === 'project-manager' ? 'Project Manager' : 'Translator';
        return { name: `${teamMember.name} (${roleLabel})`, role: teamMember.role };
      }
      
      const userRole = userRoles.find(user => user.id === userId || user.name === userId);
      if (userRole) {
        const roleLabel = userRole.role === 'project-manager' ? 'Project Manager' : 'Translator';
        return { name: `${userRole.name} (${roleLabel})`, role: userRole.role };
      }
      
      return { name: userId, role: 'unknown' };
    };

    projects.forEach(project => {
      // Project Created
      if (project.createdAt) {
        const creatorInfo = getUserInfo(project.createdBy);
        allActivities.push({
          id: `${project.id}-created`,
          user: { name: creatorInfo.name },
          action: 'created project',
          target: project.qCode,
          timestamp: project.createdAt,
          type: 'info'
        });
      }

      // OCR Completed
      if (project.ocrCompletedAt) {
        allActivities.push({
          id: `${project.id}-ocr-completed`,
          user: { name: 'System (OCR Agent)' },
          action: 'completed OCR processing for project',
          target: project.qCode,
          timestamp: project.ocrCompletedAt,
          type: 'info'
        });
      }

      // Translator Assigned
      if (project.translatorAssignedAt && project.assignedTranslator) {
        const translatorInfo = getUserInfo(project.assignedTranslator);
        allActivities.push({
          id: `${project.id}-translator-assigned`,
          user: { name: 'System (Assignment Agent)' },
          action: `assigned project to ${translatorInfo.name}`,
          target: project.qCode,
          timestamp: project.translatorAssignedAt,
          type: 'info'
        });
      }

      // Translation Started
      if (project.translationStartedAt && project.assignedTranslator) {
        const translatorInfo = getUserInfo(project.assignedTranslator);
        allActivities.push({
          id: `${project.id}-translation-started`,
          user: { name: translatorInfo.name },
          action: 'started working on project',
          target: project.qCode,
          timestamp: project.translationStartedAt,
          type: 'info'
        });
      }

      // Translation Submissions (with revision support)
      if (project.translationSubmissions && project.translationSubmissions.length > 0) {
        project.translationSubmissions.forEach((submission, index) => {
          const submitterInfo = getUserInfo(submission.submittedBy);
          const revisionText = submission.revisionNumber > 1 ? ` (Revision ${submission.revisionNumber})` : '';
          allActivities.push({
            id: `${project.id}-translation-submitted-${index}`,
            user: { name: submitterInfo.name },
            action: `submitted translation & proofreading for project${revisionText}`,
            target: project.qCode,
            timestamp: submission.submittedAt,
            type: 'success'
          });
        });
      } else if (project.translationSubmittedAt && project.assignedTranslator) {
        // Fallback for backward compatibility
        const translatorInfo = getUserInfo(project.assignedTranslator);
        allActivities.push({
          id: `${project.id}-translation-submitted`,
          user: { name: translatorInfo.name },
          action: 'submitted translation & proofreading for project',
          target: project.qCode,
          timestamp: project.translationSubmittedAt,
          type: 'success'
        });
      }

      // Sent Back Events (with revision support)
      if (project.sentBackEvents && project.sentBackEvents.length > 0) {
        project.sentBackEvents.forEach((sentBackEvent, index) => {
          const pmInfo = getUserInfo(sentBackEvent.sentBackBy);
          const revisionText = sentBackEvent.revisionNumber > 1 ? ` (Revision ${sentBackEvent.revisionNumber})` : '';
          allActivities.push({
            id: `${project.id}-sent-back-${index}`,
            user: { name: pmInfo.name },
            action: `sent project back to translator for revisions${revisionText}`,
            target: project.qCode,
            timestamp: sentBackEvent.sentBackAt,
            type: 'warning'
          });
        });
      } else if (project.sentBackAt && project.sentBackBy) {
        // Fallback for backward compatibility
        const pmInfo = getUserInfo(project.sentBackBy);
        allActivities.push({
          id: `${project.id}-sent-back`,
          user: { name: pmInfo.name },
          action: 'sent project back to translator for revisions',
          target: project.qCode,
          timestamp: project.sentBackAt,
          type: 'warning'
        });
      }

      // Project Completed
      if (project.finalApprovalAt && project.finalApprovalBy) {
        const approverInfo = getUserInfo(project.finalApprovalBy);
        allActivities.push({
          id: `${project.id}-completed`,
          user: { name: approverInfo.name },
          action: 'gave final approval and completed project',
          target: project.qCode,
          timestamp: project.finalApprovalAt,
          type: 'success'
        });
      }
    });

    // Sort by timestamp (most recent first)
    return allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [projects, teamMembers, userRoles]);

  // Prepare team status data - use only teamMembers
  const teamStatus = teamMembers.map(member => {
    const activeProjects = projects.filter(p => 
      p.assignedTranslator === member.id && !['completed', 'cancelled'].includes(p.status)
    ).length;
    
    return {
      id: member.id,
      name: member.name,
      avatar: member.avatar,
      role: member.role,
      status: activeProjects > 3 ? 'busy' as const : member.availability || 'available' as const,
      currentProjects: activeProjects,
      completedToday: projects.filter(p => {
        const today = new Date().toDateString();
        return p.assignedTranslator === member.id &&
          p.status === 'completed' && 
          p.finalApprovalAt && 
          new Date(p.finalApprovalAt).toDateString() === today;
      }).length
    };
  });

  // Prepare deadline data
  const deadlines = projects
    .filter(p => p.deadline && !['completed', 'cancelled'].includes(p.status))
    .map(p => {
      const daysUntilDeadline = Math.floor((new Date(p.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: p.id,
        projectName: p.qCode,
        clientName: p.clientName,
        deadline: new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        status: daysUntilDeadline < 0 ? 'overdue' as const : daysUntilDeadline < 3 ? 'at-risk' as const : 'on-track' as const,
        progress: getProjectProgress(p)
      };
    })
    .sort((a, b) => {
      const statusOrder = { overdue: 0, 'at-risk': 1, 'on-track': 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    })
    .slice(0, 5);

  function getProjectProgress(project: Project): number {
    const statusProgress: Record<string, number> = {
      'ocr-processing': 10,
      'pending-confirmation': 20,
      'assigning-translator': 30,
      'assigned': 40,
      'in-progress': 60,
      'pm-review': 80,
      'sent-back': 70,
      'completed': 100
    };
    return statusProgress[project.status] || 0;
  }
  
  if (isLoading) {
    return (
      <div className="flex h-screen">
        <div className="w-80 bg-gradient-to-b from-blue-50 to-white border-r border-blue-200">
          <div className="p-4">
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6 bg-gradient-to-br from-blue-50 via-white to-blue-50">
          <DashboardStatsSkeleton />
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <ProjectCardSkeleton key={index} animationDelay={index * 100} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'project-manager') {
    return null;
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-gray-50">
        <Sidebar
          onNewProject={() => setShowUploadModal(true)}
          onNotificationClick={() => setShowNotifications(true)}
        />

        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Project Dashboard</h1>
                  <p className="text-sm text-gray-600">Welcome back, {currentUser.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={() => setShowUploadModal(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Project
                  </Button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-6">
                {/* Processing Indicators */}
                {processingProjects.length > 0 && (
                  <FadeIn>
                    <div className="space-y-3">
                      {processingProjects.map(project => (
                        <div key={project.id}>
                          {project.status === 'ocr-processing' && (
                            <AgentProcessingIndicator message={`Processing OCR for ${project.clientName}`} />
                          )}
                          {project.status === 'assigning-translator' && (
                            <TranslatorAssignmentIndicator projectId={project.id} />
                          )}
                        </div>
                      ))}
                    </div>
                  </FadeIn>
                )}

                {/* Kanban Board - Prioritized at top */}
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">Project Workflow</h2>
                  </div>
                  <LayoutView onProjectClick={handleProjectClick} />
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard title="Total Projects" value={metrics.totalProjects} icon={Plus} trend="up" change={12} />
                  <MetricCard title="Active Projects" value={metrics.activeProjects} icon={Plus} />
                  <MetricCard title="Completed Today" value={metrics.completedToday} icon={Plus} trend={metrics.completedToday > 0 ? 'up' : 'neutral'} />
                  <MetricCard title="Pending Review" value={metrics.pendingReview} icon={Plus} onClick={() => console.log('View pending reviews')} />
                </div>

                {/* Dashboard Widgets */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TeamStatusWidget members={teamStatus} onMemberClick={(member) => console.log('Member clicked:', member)} />
                  <DeadlineTracker deadlines={deadlines} onDeadlineClick={(deadline) => { const project = projects.find(p => p.id === deadline.id); if (project) handleProjectClick(project); }} />
                </div>

                {/* Activity Feed */}
                <ActivityFeed activities={activities} maxItems={5} onViewAll={() => console.log('View all activities')} />
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        <ProjectUploadModal open={showUploadModal} onOpenChange={setShowUploadModal} />
        {selectedProject && showOCRModal && (
          <OCRConfirmationModal open={showOCRModal} onOpenChange={(open) => { setShowOCRModal(open); if (!open) setSelectedProject(null); }} project={selectedProject} />
        )}
        {selectedProject && showDetailsModal && (
          <ProjectDetailsModal open={showDetailsModal} onOpenChange={(open) => { setShowDetailsModal(open); if (!open) setSelectedProject(null); }} project={selectedProject} />
        )}
        {selectedProject && showManualAssignmentModal && (
          <ManualAssignmentModal open={showManualAssignmentModal} onOpenChange={(open) => { setShowManualAssignmentModal(open); if (!open) setSelectedProject(null); }} project={selectedProject} />
        )}

        {/* Smart Notification Center */}
        <SmartNotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

        {/* In-App Messaging */}
        <InAppMessaging isOpen={showMessaging} onClose={() => setShowMessaging(false)} />

        {/* Floating Message Button */}
        <FloatingMessageButton 
          unreadCount={unreadCount} 
          onClick={() => setShowMessaging(true)} 
        />
      </div>
    </ErrorBoundary>
  );
} 