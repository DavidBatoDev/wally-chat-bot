'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/translation/Sidebar';
import { LayoutView } from '@/components/translation/LayoutView';
import { ProjectUploadModal } from '@/components/translation/ProjectUploadModal';
import { OCRConfirmationModal } from '@/components/translation/OCRConfirmationModal';
import { ProjectDetailsModal } from '@/components/translation/ProjectDetailsModal';
import { AgentProcessingIndicator } from '@/components/translation/AgentProcessingIndicator';
import { NotificationPanel } from '@/components/translation/NotificationPanel';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { Project } from '@/types/translation';

export default function ProjectManagerPage() {
  const router = useRouter();
  const { currentUser, projects } = useTranslationStore();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
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
  
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'project-manager') {
      router.push('/exp');
    }
  }, [currentUser, router]);
  
  // Removed auto-opening of OCR modal - users will click on project cards instead
  
  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    
    if (project.status === 'pending-confirmation' && project.actionType === 'confirmation') {
      setShowOCRModal(true);
    } else {
      setShowDetailsModal(true);
    }
  };
  
  if (!currentUser || currentUser.role !== 'project-manager') {
    return null;
  }
  
  return (
    <div className="flex h-screen">
      <Sidebar 
        onNewProject={() => setShowUploadModal(true)}
        onBulkUpload={() => {/* Implement bulk upload */}}
        onAssignTeam={() => {/* Implement team assignment */}}
        onGenerateReport={() => {/* Implement report generation */}}
        onNotificationClick={() => setShowNotifications(!showNotifications)}
      />
      
      <main className="flex-1 overflow-auto">
        <div className="min-h-full p-6 bg-gray-50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Project Dashboard</h1>
              <p className="text-muted-foreground">Manage translation projects and team assignments</p>
            </div>
            <Button onClick={() => setShowUploadModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>
          
          <LayoutView onProjectClick={handleProjectClick} />
        </div>
      </main>
      
      {/* Modals */}
      <ProjectUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
      />
      
      {selectedProject && (
        <>
          <OCRConfirmationModal
            project={selectedProject}
            open={showOCRModal}
            onOpenChange={(open) => {
              setShowOCRModal(open);
              if (!open) setSelectedProject(null);
            }}
          />
          
          <ProjectDetailsModal
            project={selectedProject}
            open={showDetailsModal}
            onOpenChange={(open) => {
              setShowDetailsModal(open);
              if (!open) setSelectedProject(null);
            }}
          />
        </>
      )}
      
      {/* Agent Processing Indicator */}
      {processingProjects.length > 0 && (
        <AgentProcessingIndicator message={getProcessingMessage()} />
      )}
      
      {/* Notifications */}
      <NotificationPanel 
        open={showNotifications} 
        onOpenChange={setShowNotifications}
      />
    </div>
  );
} 