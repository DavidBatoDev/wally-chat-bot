import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, TeamMember, UserRole, Notification, ProcessingState, ProjectStatus, DocumentPage } from '@/types/translation';

// Helper functions for Set/Map serialization
const serializeProcessingState = (state: ProcessingState): any => {
  if (!state) {
    return {
      activeProcessing: [],
      processingProgress: {},
    };
  }
  return {
    activeProcessing: Array.from(state.activeProcessing || []),
    processingProgress: Object.fromEntries(state.processingProgress || new Map()),
  };
};

const deserializeProcessingState = (state: any): ProcessingState => {
  const defaultState: ProcessingState = {
    activeProcessing: new Set<string>(),
    processingProgress: new Map<string, number>(),
  };

  if (!state) {
    return defaultState;
  }

  try {
    return {
      activeProcessing: new Set(Array.isArray(state.activeProcessing) ? state.activeProcessing : []),
      processingProgress: new Map(
        Object.entries(typeof state.processingProgress === 'object' ? state.processingProgress : {})
      ),
    };
  } catch (error) {
    console.error('Error deserializing processing state:', error);
    return defaultState;
  }
};

interface TranslationState {
  // State
  projects: Project[];
  teamMembers: TeamMember[];
  userRoles: UserRole[];
  currentUser: UserRole | null;
  processingState: ProcessingState;
  selectedProject: Project | null;
  notifications: Notification[];
  dataLoaded: boolean; // Track when data has been loaded from storage
  
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
  addTeamMember: (member: Partial<Pick<TeamMember, 'id'>> & Omit<TeamMember, 'id'>) => void;
  updateTeamMember: (id: string, updates: Partial<TeamMember>) => void;
  addUserRole: (user: Partial<Pick<UserRole, 'id'>> & Omit<UserRole, 'id'>) => void;
  
  // Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  
  // Utility
  clearAllData: () => void;
  initializeSampleData: () => void;
  saveToStorage: () => void;
  loadFromStorage: () => void;
  
  // Auto-assignment
  autoAssignTranslator: (projectId: string) => void;
  createManualAssignmentRequest: (projectId: string, reason: string) => void;
  
  // Workflow actions
  acceptAssignment: (projectId: string) => void;
  submitTranslation: (projectId: string, translations: Record<string, string>) => void;
  approveTranslation: (projectId: string) => void;
  sendBackToTranslator: (projectId: string, notes: string) => void;

  resumeProcessing: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const generateQCode = () => `Q${Date.now().toString(36).toUpperCase()}`;

const useTranslationStore = create<TranslationState>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      teamMembers: [],
      userRoles: [],
      currentUser: null,
      processingState: {
        activeProcessing: new Set<string>(),
        processingProgress: new Map<string, number>(),
      },
      selectedProject: null,
      notifications: [],
      dataLoaded: false,

      // Actions
      setCurrentUser: (user) => {
        set({ currentUser: user });
        get().saveToStorage();
      },

      addProject: (projectData) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;

        const qCode = `Q${new Date().getFullYear()}-${String(get().projects.length + 1).padStart(3, '0')}`;
        const timestamp = new Date().toISOString();
        
        const newProject: Project = {
          ...projectData,
          id: `project_${Date.now()}_${generateId()}`,
          qCode,
          createdBy: currentUser.id,
          createdAt: timestamp,
          updatedAt: timestamp,
          status: 'ocr-processing',
          ocrProgress: 0,
          document: [],
        };

        set((state) => ({
          projects: [...state.projects, newProject]
        }));

        get().addNotification({
          type: 'info',
          title: 'Project Created',
          message: `Project ${qCode} has been created successfully`,
          priority: 'medium',
          read: false,
        });

        // Automatically start OCR processing
        setTimeout(() => {
          get().startOCRProcessing(newProject.id);
        }, 100);

        get().saveToStorage();
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map(p => 
            p.id === id 
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          )
        }));
        get().saveToStorage();
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter(p => p.id !== id)
        }));
        get().saveToStorage();
      },

      selectProject: (project) => {
        set({ selectedProject: project });
      },

      // OCR Processing
      startOCRProcessing: (projectId) => {
        set((state) => {
          const newActiveProcessing = new Set(state.processingState.activeProcessing);
          newActiveProcessing.add(projectId);
          const newProcessingProgress = new Map(state.processingState.processingProgress);
          newProcessingProgress.set(projectId, 0);

          return {
            processingState: {
              activeProcessing: newActiveProcessing,
              processingProgress: newProcessingProgress,
            },
          };
        });
        
        // Simulate OCR processing with progress updates
        const interval = setInterval(() => {
          const state = get();
          const currentProgress = state.processingState.processingProgress.get(projectId) || 0;
          
          if (currentProgress >= 100) {
            clearInterval(interval);
            get().completeOCRProcessing(projectId);
          } else {
            const newProgress = Math.min(currentProgress + 8, 100);
            set((state) => {
              const newProcessingProgress = new Map(state.processingState.processingProgress);
              newProcessingProgress.set(projectId, newProgress);
              return {
                processingState: {
                  ...state.processingState,
                  processingProgress: newProcessingProgress,
                },
                projects: state.projects.map(p => 
                  p.id === projectId ? { ...p, ocrProgress: newProgress } : p
                ),
              };
            });
          }
        }, 200); // Update every 200ms for smooth progress
        
        get().saveToStorage();
      },

      continueOCRProcessing: (projectId) => {
        // Implementation for continuing OCR
        get().saveToStorage();
      },

      updateOCRProgress: (projectId, progress) => {
        set((state) => {
          const newProcessingProgress = new Map(state.processingState.processingProgress);
          newProcessingProgress.set(projectId, progress);
          
          return {
            processingState: {
              ...state.processingState,
              processingProgress: newProcessingProgress,
            },
            projects: state.projects.map(p => 
              p.id === projectId ? { ...p, ocrProgress: progress } : p
            ),
          };
        });
      },

      completeOCRProcessing: (projectId) => {
        // Generate mock OCR results
        const mockPages = [
          {
            id: `page_${Date.now()}_1`,
            pageNumber: 1,
            originalText: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            confidence: 0.98,
            imageUrl: undefined,
            documentType: 'document',
          },
          {
            id: `page_${Date.now()}_2`,
            pageNumber: 2,
            originalText: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
            confidence: 0.95,
            imageUrl: undefined,
            documentType: 'document',
          },
        ];

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
            projects: state.projects.map(p => 
              p.id === projectId 
                ? { 
                    ...p, 
                    status: 'pending-confirmation' as ProjectStatus, 
                    actionType: 'confirmation',
                    updatedAt: new Date().toISOString(),
                    ocrProgress: 100,
                    document: mockPages,
                    ocrCompletedAt: new Date().toISOString(),
                    detectedSourceLanguage: 'English',
                  }
                : p
            )
          };
        });

        // Add notification
        get().addNotification({
          type: 'success',
          title: 'OCR Processing Complete',
          message: `Document processing has been completed for project. Please review the results.`,
          priority: 'medium',
          read: false,
          userId: get().currentUser?.id || '',
        });

        get().saveToStorage();
      },

      // Team Management
      addTeamMember: (memberData) => {
        // If memberData already has an id, use it directly without wrapping
        if ('id' in memberData && memberData.id) {
          const member = memberData as TeamMember;
          set((state) => ({
            teamMembers: [...state.teamMembers, member]
          }));
        } else {
          // Only create new member with generated ID if none provided
          const newMember: TeamMember = {
            ...memberData as Omit<TeamMember, 'id'>,
            id: `team_${Date.now()}_${generateId()}`,
          };
          set((state) => ({
            teamMembers: [...state.teamMembers, newMember]
          }));
        }
        get().saveToStorage();
      },

      updateTeamMember: (id, updates) => {
        set((state) => ({
          teamMembers: state.teamMembers.map(m => 
            m.id === id ? { ...m, ...updates } : m
          )
        }));
        get().saveToStorage();
      },

      addUserRole: (userData) => {
        // If userData already has an id, use it directly without wrapping
        if ('id' in userData && userData.id) {
          const user = userData as UserRole;
          set((state) => ({
            userRoles: [...state.userRoles, user]
          }));
        } else {
          // Only create new user with generated ID if none provided
          const newUser: UserRole = {
            ...userData as Omit<UserRole, 'id'>,
            id: `user_${Date.now()}_${generateId()}`,
          };
          set((state) => ({
            userRoles: [...state.userRoles, newUser]
          }));
        }
        get().saveToStorage();
      },

      // Notifications
      addNotification: (notificationData) => {
        const newNotification: Notification = {
          ...notificationData,
          id: `notif_${Date.now()}_${generateId()}`,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 50) // Keep only last 50
        }));
        get().saveToStorage();
      },

      markNotificationAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map(n => 
            n.id === id ? { ...n, read: true } : n
          )
        }));
        get().saveToStorage();
      },

      clearNotifications: () => {
        set({ notifications: [] });
        get().saveToStorage();
      },

      // Utility
      clearAllData: () => {
        set({
          projects: [],
          teamMembers: [],
          userRoles: [],
          currentUser: null,
          processingState: {
            activeProcessing: new Set<string>(),
            processingProgress: new Map<string, number>(),
          },
          selectedProject: null,
          notifications: [],
          dataLoaded: false, // Reset dataLoaded on clearAllData
        });
        localStorage.removeItem('translation-storage');
      },

      resumeProcessing: () => {
        const state = get();
        const { projects, processingState } = state;

        // Handle stuck OCR processes
        projects.forEach(project => {
          if (project.status === 'ocr-processing') {
            // If project is in processing state but not in activeProcessing, restart it
            if (!processingState.activeProcessing.has(project.id)) {
              get().startOCRProcessing(project.id);
            }
            // If project has progress but is stuck, continue from there
            else {
              const currentProgress = processingState.processingProgress.get(project.id) || 0;
              if (currentProgress < 100) {
                get().updateOCRProgress(project.id, currentProgress);
              } else {
                get().completeOCRProcessing(project.id);
              }
            }
          }
        });

        // Clean up any orphaned processing states
        const activeProcessingArray = Array.from(processingState.activeProcessing);
        activeProcessingArray.forEach(projectId => {
          const project = projects.find(p => p.id === projectId);
          if (!project || project.status !== 'ocr-processing') {
            set(state => {
              const newActiveProcessing = new Set(state.processingState.activeProcessing);
              newActiveProcessing.delete(projectId);
              const newProcessingProgress = new Map(state.processingState.processingProgress);
              newProcessingProgress.delete(projectId);
              return {
                processingState: {
                  activeProcessing: newActiveProcessing,
                  processingProgress: newProcessingProgress,
                },
              };
            });
          }
        });
      },

      initializeSampleData: () => {
        // Only initialize if no data exists (don't clear existing data)
        const state = get();
        if (state.teamMembers.length > 0 || state.userRoles.length > 0) {
          console.log('Data already exists, skipping initialization');
          return;
        }
        
        console.log('No existing data found, initializing with PM...');
        
        // Create initial PM user with unique ID
        const pmId = `pm_${Date.now()}_${generateId()}`;
        
        const initialPM: TeamMember = {
          id: pmId,
          name: 'Project Manager',
          email: 'pm@company.com',
          role: 'project-manager',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ProjectManager',
          specialtyLanguages: [],
          availability: 'available',
        };

        const initialUserRole: UserRole = {
          id: pmId, // Same ID for consistency
          name: 'Project Manager',
          email: 'pm@company.com',
          role: 'project-manager',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ProjectManager',
        };

        set({
          projects: state.projects, // Keep existing projects
          teamMembers: [initialPM],
          userRoles: [initialUserRole],
          currentUser: initialUserRole,
          notifications: state.notifications, // Keep existing notifications
          selectedProject: state.selectedProject,
          processingState: state.processingState, // Keep processing state
          dataLoaded: true, // Set dataLoaded to true after initialization
        });
        
        get().saveToStorage();
      },

      saveToStorage: () => {
        const state = get();
        const dataToSave = {
          projects: state.projects,
          teamMembers: state.teamMembers,
          userRoles: state.userRoles,
          currentUser: state.currentUser,
          selectedProject: state.selectedProject,
          notifications: state.notifications,
          processingState: serializeProcessingState(state.processingState),
        };
        localStorage.setItem('translation-storage', JSON.stringify(dataToSave));
      },

      loadFromStorage: () => {
        try {
          const stored = localStorage.getItem('translation-storage');
          if (stored) {
            const parsed = JSON.parse(stored);
            
            // Initialize with default processing state
            const defaultProcessingState = {
              activeProcessing: new Set<string>(),
              processingProgress: new Map<string, number>(),
            };

            // Merge stored state with defaults
            set({
              projects: parsed.projects || [],
              teamMembers: parsed.teamMembers || [],
              userRoles: parsed.userRoles || [],
              currentUser: parsed.currentUser || null,
              selectedProject: parsed.selectedProject || null,
              notifications: parsed.notifications || [],
              processingState: deserializeProcessingState(parsed.processingState) || defaultProcessingState,
              dataLoaded: true, // Mark as loaded
            });

            // Resume any interrupted processing
            get().resumeProcessing();
          } else {
            // No stored data found, mark as loaded anyway
            set({ dataLoaded: true });
          }
        } catch (error) {
          console.error('Error loading from storage:', error);
          // Initialize with clean state on error and mark as loaded
          set({
            projects: [],
            teamMembers: [],
            userRoles: [],
            currentUser: null,
            processingState: {
              activeProcessing: new Set<string>(),
              processingProgress: new Map<string, number>(),
            },
            selectedProject: null,
            notifications: [],
            dataLoaded: true, // Mark as loaded even on error
          });
        }
      },

      // Auto-assignment with language matching and availability checking
      autoAssignTranslator: (projectId) => {
        const state = get();
        const project = state.projects.find(p => p.id === projectId);
        if (!project) {
          console.log(`Project ${projectId} not found for assignment`);
          return;
        }

        console.log(`Starting assignment process for project ${project.qCode}...`);

        // Add 2-3 second delay to simulate assignment process
        setTimeout(() => {
          const currentState = get(); // Get fresh state after delay
          const currentProject = currentState.projects.find(p => p.id === projectId);
          
          if (!currentProject || currentProject.status !== 'assigning-translator') {
            console.log(`Project ${projectId} no longer needs assignment`);
            return;
          }

          // Get all translators from teamMembers only (no more userRoles duplication)
          const allTranslators = currentState.teamMembers.filter(m => m.role === 'translator');

          console.log(`Found ${allTranslators.length} translators for project ${currentProject.qCode}`);
          console.log('Available translators:', allTranslators.map(t => ({ id: t.id, name: t.name, specialtyLanguages: t.specialtyLanguages })));

          if (allTranslators.length === 0) {
            console.log('No translators available, creating manual assignment request');
            get().createManualAssignmentRequest(projectId, 'No translators found in the system');
            return;
          }

          // Find translators who can handle the source language
          const sourceLanguage = currentProject.detectedSourceLanguage || currentProject.sourceLanguage;
          let compatibleTranslators = allTranslators;

          if (sourceLanguage) {
            compatibleTranslators = allTranslators.filter(translator => {
              // If no specialty languages defined, assume they can handle any language
              if (!translator.specialtyLanguages || translator.specialtyLanguages.length === 0) {
                return true;
              }
              // Check if they specialize in the source language or target languages
              const hasSourceLanguage = translator.specialtyLanguages.includes(sourceLanguage);
              const hasTargetLanguage = currentProject.targetLanguages.some(lang => 
                translator.specialtyLanguages?.includes(lang)
              );
              return hasSourceLanguage || hasTargetLanguage;
            });
          }

          console.log(`Found ${compatibleTranslators.length} language-compatible translators`);

          if (compatibleTranslators.length === 0) {
            console.log('No language-compatible translators, creating manual assignment request');
            get().createManualAssignmentRequest(
              projectId, 
              `No translators available for ${sourceLanguage} → ${currentProject.targetLanguages.join(', ')} translation`
            );
            return;
          }

          // Check availability (not overloaded with projects)
          const availableTranslators = compatibleTranslators.filter(translator => {
            const activeProjects = currentState.projects.filter(p => 
              p.assignedTranslator === translator.id && 
              !['completed', 'cancelled'].includes(p.status)
            ).length;
            
            // Consider translator unavailable if they have 3+ active projects
            return translator.availability === 'available' && activeProjects < 3;
          });

          console.log(`Found ${availableTranslators.length} available translators`);

          if (availableTranslators.length === 0) {
            console.log('No available translators, creating manual assignment request');
            get().createManualAssignmentRequest(
              projectId, 
              'All compatible translators are currently busy (3+ active projects)'
            );
            return;
          }

          // Auto-assign to the translator with the least active projects
          const bestTranslator = availableTranslators.reduce((best, current) => {
            const bestActiveCount = currentState.projects.filter(p => 
              p.assignedTranslator === best.id && 
              !['completed', 'cancelled'].includes(p.status)
            ).length;
            
            const currentActiveCount = currentState.projects.filter(p => 
              p.assignedTranslator === current.id && 
              !['completed', 'cancelled'].includes(p.status)
            ).length;
            
            return currentActiveCount < bestActiveCount ? current : best;
          });

          console.log(`Auto-assigning project ${currentProject.qCode} to ${bestTranslator.name} (ID: ${bestTranslator.id})`);

          get().updateProject(projectId, {
            status: 'assigned' as ProjectStatus,
            assignedTranslator: bestTranslator.id,
            translatorAssignedAt: new Date().toISOString(),
          });

          // Add success notification
          get().addNotification({
            title: 'Translator Assigned',
            message: `Project ${currentProject.qCode} has been assigned to ${bestTranslator.name}`,
            type: 'success',
            priority: 'low',
            read: false,
            userId: currentState.currentUser?.id || '',
          });
        }, 2000 + Math.random() * 1000); // 2-3 second delay
      },

      // Create manual assignment request when auto-assignment fails
      createManualAssignmentRequest: (projectId, reason) => {
        const state = get();
        const project = state.projects.find(p => p.id === projectId);
        if (!project) return;

        console.log(`Creating manual assignment request for ${project.qCode}: ${reason}`);

        get().updateProject(projectId, {
          status: 'assigning-translator' as ProjectStatus,
          actionType: 'manual-assignment',
          assignmentReason: reason,
        });

        // Add notification for PM to manually assign
        get().addNotification({
          title: 'Manual Assignment Required',
          message: `Project ${project.qCode} requires manual translator assignment: ${reason}`,
          type: 'warning',
          priority: 'high',
          read: false,
          userId: state.currentUser?.id || '',
        });
      },

      // Workflow actions
      acceptAssignment: (projectId) => {
        get().updateProject(projectId, {
          status: 'in-progress' as ProjectStatus,
          translationStartedAt: new Date().toISOString(),
        });
      },

      submitTranslation: (projectId, translations) => {
        get().updateProject(projectId, {
          status: 'pm-review' as ProjectStatus,
          translationSubmittedAt: new Date().toISOString(),
        });
      },

      approveTranslation: (projectId) => {
        const currentUser = get().currentUser;
        get().updateProject(projectId, {
          status: 'completed' as ProjectStatus,
          finalApprovalAt: new Date().toISOString(),
          finalApprovalBy: currentUser?.id,
        });
      },

      sendBackToTranslator: (projectId, notes) => {
        const currentUser = get().currentUser;
        get().updateProject(projectId, {
          status: 'sent-back' as ProjectStatus,
          sentBackAt: new Date().toISOString(),
          sentBackBy: currentUser?.id,
          pmNotes: notes,
        });
      },
    }),
    {
      name: 'translation-storage',
      partialize: (state) => {
        // Ensure we only serialize what we need and handle undefined gracefully
        const { processingState, dataLoaded, ...rest } = state;
        return {
          ...rest,
          processingState: serializeProcessingState(processingState),
        };
      },
      merge: (persistedState: any, currentState) => {
        // Ensure we properly merge states and handle undefined values
        const mergedState = {
          ...currentState,
          ...persistedState,
        };

        // Always ensure processingState is properly initialized
        mergedState.processingState = deserializeProcessingState(
          persistedState?.processingState || currentState.processingState
        );

        // Always ensure dataLoaded is properly initialized
        mergedState.dataLoaded = persistedState?.dataLoaded || currentState.dataLoaded;

        return mergedState;
      },
      // Add version control for future migrations if needed
      version: 1,
    }
  )
);

export { useTranslationStore }; 