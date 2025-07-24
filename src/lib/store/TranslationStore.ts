import { create } from 'zustand';
import type { Project, TeamMember, UserRole, Notification, ProcessingState, ProjectStatus, DocumentPage } from '@/types/translation';

interface TranslationState {
  // State
  projects: Project[];
  teamMembers: TeamMember[];
  userRoles: UserRole[];
  currentUser: UserRole | null;
  processingState: ProcessingState;
  selectedProject: Project | null;
  notifications: Notification[];
  
  // Actions
  setCurrentUser: (user: UserRole | null) => void;
  addProject: (project: Omit<Project, 'id' | 'qCode' | 'createdAt' | 'updatedAt'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  selectProject: (project: Project | null) => void;
  
  // OCR Processing
  startOCRProcessing: (projectId: string) => void;
  continueOCRProcessing: (projectId: string) => void;
  updateOCRProgress: (projectId: string, progress: number) => void;
  completeOCRProcessing: (projectId: string) => void;
  
  // Team Management
  addTeamMember: (member: Omit<TeamMember, 'id'>) => void;
  updateTeamMember: (id: string, updates: Partial<TeamMember>) => void;
  
  // Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  
  // Utility
  clearAllData: () => void;
  initializeSampleData: () => void;
  
  // Auto-assignment
  autoAssignTranslator: (projectId: string) => void;
  
  // Workflow actions
  acceptAssignment: (projectId: string) => void;
  submitTranslation: (projectId: string, translations: Record<string, string>) => void;
  giveFinalApproval: (projectId: string) => void;
  sendBackToTranslator: (projectId: string, notes: string) => void;
  
  // PDF Editor Integration
  savePDFEditorState: (projectId: string, pdfState: any) => void;
  
  // Debug
  debugStorage: () => void;
  
  // Resume processing
  resumeProcessing: () => void;
  
  // Manual persistence
  saveToStorage: () => void;
  loadFromStorage: () => void;
}

// Helper function to generate unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper function to generate Q-Code
const generateQCode = () => `Q${Date.now().toString(36).toUpperCase()}`;

export const useTranslationStore = create<TranslationState>()((set, get) => ({
  // Initial State
  projects: [],
  teamMembers: [],
  userRoles: [],
  currentUser: null,
  processingState: {
    activeProcessing: new Set(),
    processingProgress: new Map(),
  },
  selectedProject: null,
  notifications: [],
  
  // Actions
  setCurrentUser: (user) => set({ currentUser: user }),
  
  addProject: (project) => {
    const newProject: Project = {
      ...project,
      id: generateId(),
      qCode: generateQCode(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "ocr-processing",
      ocrProgress: 0,
      document: [],
    };
    
    set((state) => {
      const newState = {
        projects: [...state.projects, newProject],
      };
      // Save immediately after state change
      setTimeout(() => {
        get().saveToStorage();
      }, 0);
      return newState;
    });
    
    // Automatically start OCR processing
    setTimeout(() => {
      get().startOCRProcessing(newProject.id);
    }, 100);
  },
  
  updateProject: (id, updates) => {
    set((state) => {
      const newState = {
        projects: state.projects.map((p) =>
          p.id === id
            ? { ...p, ...updates, updatedAt: new Date().toISOString() }
            : p
        ),
      };
      // Save immediately after state change
      setTimeout(() => {
        get().saveToStorage();
      }, 0);
      return newState;
    });
  },
  
  deleteProject: (id) => {
    set((state) => {
      const newState = {
        projects: state.projects.filter((p) => p.id !== id),
      };
      // Save immediately after state change
      setTimeout(() => {
        get().saveToStorage();
      }, 0);
      return newState;
    });
  },
  
  selectProject: (project) => set({ selectedProject: project }),
  
  // OCR Processing
  startOCRProcessing: (projectId) => {
    set((state) => ({
      processingState: {
        activeProcessing: new Set([...state.processingState.activeProcessing, projectId]),
        processingProgress: new Map(state.processingState.processingProgress).set(projectId, 0),
      },
    }));
    setTimeout(() => {
      get().continueOCRProcessing(projectId);
    }, 150);
  },
  
  continueOCRProcessing: (projectId) => {
    const currentProgress = get().processingState.processingProgress.get(projectId) || 0;
    if (currentProgress >= 100) {
      get().completeOCRProcessing(projectId);
    } else {
      get().updateOCRProgress(projectId, Math.min(currentProgress + 5, 100));
      setTimeout(() => {
        get().continueOCRProcessing(projectId);
      }, 150);
    }
  },
  
  updateOCRProgress: (projectId, progress) => {
    set((state) => {
      const newProgress = new Map(state.processingState.processingProgress);
      newProgress.set(projectId, progress);
      
      return {
        processingState: {
          ...state.processingState,
          processingProgress: newProgress,
        },
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, ocrProgress: progress } : p
        ),
      };
    });
    
    // Save immediately after state change
    setTimeout(() => {
      get().saveToStorage();
    }, 0);
  },
  
  completeOCRProcessing: (projectId) => {
    // Generate mock OCR results with document types per page
    const documentTypes = ["Technical Manual", "Legal Document", "Marketing Material", "User Guide", "Contract"];
    const mockPages: DocumentPage[] = [
      {
        id: generateId(),
        pageNumber: 1,
        originalText: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        confidence: 0.98,
        documentType: documentTypes[Math.floor(Math.random() * documentTypes.length)],
      },
      {
        id: generateId(),
        pageNumber: 2,
        originalText: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
        confidence: 0.95,
        documentType: documentTypes[Math.floor(Math.random() * documentTypes.length)],
      },
      {
        id: generateId(),
        pageNumber: 3,
        originalText: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
        confidence: 0.97,
        documentType: documentTypes[Math.floor(Math.random() * documentTypes.length)],
      },
    ];
    
    // Mock detected source language
    const detectedSourceLanguage = "English";
    
    set((state) => {
      const newActiveProcessing = new Set(state.processingState.activeProcessing);
      newActiveProcessing.delete(projectId);
      
      const newProgress = new Map(state.processingState.processingProgress);
      newProgress.delete(projectId);
      
      return {
        processingState: {
          activeProcessing: newActiveProcessing,
          processingProgress: newProgress,
        },
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                status: "pending-confirmation" as ProjectStatus,
                actionType: "confirmation",
                ocrProgress: 100,
                document: mockPages,
                detectedSourceLanguage,
                ocrCompletedAt: new Date().toISOString(),
              }
            : p
        ),
      };
    });
    
    // Save immediately after state change
    setTimeout(() => {
      get().saveToStorage();
    }, 0);
    
    // Add notification
    get().addNotification({
      title: "OCR Processing Complete",
      message: "Document processing has been completed. Please review the detected document type and source language.",
      type: "success",
      read: false,
      userId: get().currentUser?.id || "",
    });
  },
  
  // Team Management
  addTeamMember: (member) => {
    const newMember: TeamMember = {
      ...member,
      id: generateId(),
    };
    
    set((state) => {
      const newState = {
        teamMembers: [...state.teamMembers, newMember],
      };
      // Save immediately after state change
      setTimeout(() => {
        get().saveToStorage();
      }, 0);
      return newState;
    });
  },
  
  updateTeamMember: (id, updates) => {
    set((state) => {
      const newState = {
        teamMembers: state.teamMembers.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
      };
      // Save immediately after state change
      setTimeout(() => {
        get().saveToStorage();
      }, 0);
      return newState;
    });
  },
  
  // Notifications
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    
    set((state) => {
      const newState = {
        notifications: [newNotification, ...state.notifications],
      };
      // Save immediately after state change
      setTimeout(() => {
        get().saveToStorage();
      }, 0);
      return newState;
    });
  },
  
  markNotificationAsRead: (id) => {
    set((state) => {
      const newState = {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      };
      // Save immediately after state change
      setTimeout(() => {
        get().saveToStorage();
      }, 0);
      return newState;
    });
  },
  
  clearNotifications: () => {
    set({ notifications: [] });
    // Save immediately after state change
    setTimeout(() => {
      get().saveToStorage();
    }, 0);
  },
  
  // Utility
  clearAllData: () => {
    set({
      projects: [],
      teamMembers: [],
      userRoles: [],
      currentUser: null,
      processingState: {
        activeProcessing: new Set(),
        processingProgress: new Map(),
      },
      selectedProject: null,
      notifications: [],
    });
    localStorage.removeItem('translation-storage');
  },
  
  initializeSampleData: () => {
    const sampleUserRoles: UserRole[] = [
      {
        id: "pm1",
        name: "Sarah Johnson",
        email: "sarah@translation.com",
        role: "project-manager",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
      },
      {
        id: "tr1",
        name: "John Smith",
        email: "john@translation.com",
        role: "translator",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
      },
    ];
    
    const sampleTeamMembers: TeamMember[] = [
      {
        id: "tm1",
        name: "John Smith",
        email: "john@translation.com",
        role: "translator",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
        languages: ["English", "Spanish", "French"],
        availability: "available",
        currentProjects: 2,
        completedProjects: 45,
      },
      {
        id: "tm2",
        name: "Maria Garcia",
        email: "maria@translation.com",
        role: "translator",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
        languages: ["Spanish", "English", "Portuguese"],
        availability: "busy",
        currentProjects: 3,
        completedProjects: 67,
      },
    ];
    
    set({
      userRoles: sampleUserRoles,
      teamMembers: sampleTeamMembers,
      currentUser: sampleUserRoles[0], // Set PM as current user
    });
    
    // Save immediately after state change
    setTimeout(() => {
      get().saveToStorage();
    }, 0);
  },
  
  // Auto-assignment
  autoAssignTranslator: (projectId) => {
    setTimeout(() => {
      set((state) => {
        const availableTranslators = state.teamMembers.filter(
          (m) => m.role === "translator" && m.availability === "available"
        );
        
        if (availableTranslators.length > 0) {
          const selectedTranslator = availableTranslators[0];
          return {
            projects: state.projects.map((p) =>
              p.id === projectId
                ? {
                    ...p,
                    status: "assigned" as ProjectStatus,
                    assignedTranslator: selectedTranslator.name,
                    translatorAssignedAt: new Date().toISOString(),
                  }
                : p
            ),
          };
        }
        return state;
      });
      
      // Save immediately after state change
      setTimeout(() => {
        get().saveToStorage();
      }, 0);
      
      get().addNotification({
        title: "Translator Assigned",
        message: "A translator has been automatically assigned to the project",
        type: "success",
        read: false,
        userId: get().currentUser?.id || "",
      });
    }, 1000);
  },
  
  // Workflow actions
  acceptAssignment: (projectId) => {
    set((state) => ({
      projects: state.projects.map(p =>
        p.id === projectId
          ? { 
              ...p, 
              status: "in-progress" as ProjectStatus,
              translationStartedAt: new Date().toISOString(),
            }
          : p
      ),
    }));
    
    // Save immediately after state change
    setTimeout(() => {
      get().saveToStorage();
    }, 0);
    
    get().addNotification({
      title: "Assignment Accepted",
      message: "You have accepted the translation assignment",
      type: "success",
      read: false,
      userId: get().currentUser?.id || "",
    });
  },
  
  submitTranslation: (projectId, translations) => {
    set((state) => ({
      projects: state.projects.map(p =>
        p.id === projectId
          ? {
              ...p,
              document: p.document.map(page => ({
                ...page,
                translatedText: translations[page.id] || page.translatedText,
              })),
              status: "pm-review" as ProjectStatus,
              actionType: "final-approval",
              translationSubmittedAt: new Date().toISOString(),
            }
          : p
      ),
    }));
    
    // Save immediately after state change
    setTimeout(() => {
      get().saveToStorage();
    }, 0);
    
    get().addNotification({
      title: "Translation & Proofreading Complete",
      message: "Translation and initial proofreading have been completed. Awaiting PM review.",
      type: "success",
      read: false,
      userId: get().currentUser?.id || "",
    });
  },
  
  giveFinalApproval: (projectId) => {
    set((state) => ({
      projects: state.projects.map(p =>
        p.id === projectId
          ? { 
              ...p, 
              status: "completed" as ProjectStatus,
              actionType: undefined, // Remove action type when completed
              finalApprovalAt: new Date().toISOString(),
              finalApprovalBy: state.currentUser?.name || 'Project Manager',
            }
          : p
      ),
    }));
    
    // Save immediately after state change
    setTimeout(() => {
      get().saveToStorage();
    }, 0);
    
    get().addNotification({
      title: "Project Completed",
      message: "Project has been approved and marked as completed",
      type: "success",
      read: false,
      userId: get().currentUser?.id || "",
    });
  },
  
  sendBackToTranslator: (projectId, notes) => {
    set((state) => ({
      projects: state.projects.map(p =>
        p.id === projectId
          ? { 
              ...p, 
              status: "sent-back" as ProjectStatus,
              actionType: undefined,
              pmNotes: notes,
              sentBackAt: new Date().toISOString(),
              sentBackCount: (p.sentBackCount || 0) + 1,
              sentBackBy: state.currentUser?.name || 'Project Manager',
            }
          : p
      ),
    }));
    
    // Save immediately after state change
    setTimeout(() => {
      get().saveToStorage();
    }, 0);
    
    get().addNotification({
      title: "Project Sent Back",
      message: "Project has been sent back to translator for revisions",
      type: "warning",
      read: false,
      userId: get().currentUser?.id || "",
    });
  },
  
  // PDF Editor Integration
  savePDFEditorState: (projectId, pdfState) => {
    set((state) => ({
      projects: state.projects.map(p =>
        p.id === projectId
          ? {
              ...p,
              pdfEditorState: pdfState,
            }
          : p
      ),
    }));
    
    // Save immediately after state change
    setTimeout(() => {
      get().saveToStorage();
    }, 0);
  },
  
  // Debug
  debugStorage: () => {
    const stored = localStorage.getItem('translation-storage');
    console.log('Raw localStorage:', stored);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('Parsed localStorage:', parsed);
      console.log('Projects count:', parsed.projects?.length || 0);
      console.log('Team Members count:', parsed.teamMembers?.length || 0);
      console.log('User Roles count:', parsed.userRoles?.length || 0);
    }
  },
  
  // Resume processing
  resumeProcessing: () => {
    const state = get();
    const activeProcessing = Array.from(state.processingState.activeProcessing);
    activeProcessing.forEach(projectId => {
      const project = state.projects.find(p => p.id === projectId);
      if (project && project.status === 'ocr-processing') {
        setTimeout(() => {
          get().continueOCRProcessing(projectId);
        }, 150);
      }
    });
  },
  
  // Manual persistence functions
  saveToStorage: () => {
    const state = get();
    const dataToSave = {
      projects: state.projects,
      teamMembers: state.teamMembers,
      userRoles: state.userRoles,
      currentUser: state.currentUser,
      notifications: state.notifications,
      processingState: {
        activeProcessing: Array.from(state.processingState.activeProcessing),
        processingProgress: Object.fromEntries(state.processingState.processingProgress),
      },
      selectedProject: state.selectedProject,
    };
    localStorage.setItem('translation-storage', JSON.stringify(dataToSave));
    console.log('Manually saved to localStorage:', dataToSave);
  },
  
  loadFromStorage: () => {
    try {
      const stored = localStorage.getItem('translation-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('Manually loading from localStorage:', parsed);
        
        set({
          projects: parsed.projects || [],
          teamMembers: parsed.teamMembers || [],
          userRoles: parsed.userRoles || [],
          currentUser: parsed.currentUser || null,
          processingState: {
            activeProcessing: new Set(parsed.processingState?.activeProcessing || []),
            processingProgress: new Map(Object.entries(parsed.processingState?.processingProgress || {})),
          },
          selectedProject: parsed.selectedProject || null,
          notifications: parsed.notifications || [],
        });
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  },
})); 