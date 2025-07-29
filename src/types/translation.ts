export type ProjectStatus = 
  | "ocr-processing"
  | "pending-confirmation"
  | "assigning-translator"
  | "assigned"
  | "in-progress"
  | "pm-review"
  | "sent-back"
  | "completed";

export type UserRoleType = "project-manager" | "translator";

export interface DocumentPage {
  id: string;
  pageNumber: number;
  originalText: string;
  translatedText?: string;
  confidence: number;
  imageUrl?: string;
  documentType?: string;
}

export interface Project {
  id: string;
  qCode: string; // Auto-generated unique code
  clientName: string;
  sourceLanguage?: string; // Optional since it's detected by OCR
  targetLanguages: string[];
  deadline: string;
  deliveryDate: string;
  document: DocumentPage[];
  status: ProjectStatus;
  assignedTranslator?: string;
  assignedProofreader?: string;
  actionType?: "confirmation" | "final-approval" | "manual-assignment";
  createdBy?: string; // PM who created/uploaded the project
  createdAt: string;
  updatedAt: string;
  fileName?: string;
  fileSize?: number;
  ocrProgress?: number; // For real-time OCR progress
  detectedDocumentType?: string; // Detected by OCR
  detectedSourceLanguage?: string; // Detected by OCR
  pdfEditorState?: any; // PDF editor state for seamless integration
  assignmentReason?: string; // Reason for manual assignment
  
  // Workflow timestamps
  ocrCompletedAt?: string;
  translatorAssignedAt?: string;
  translationStartedAt?: string;
  translationSubmittedAt?: string;
  finalApprovalAt?: string;
  sentBackAt?: string;
  
  // Multiple submission tracking
  translationSubmissions?: Array<{
    submittedAt: string;
    submittedBy: string;
    revisionNumber: number;
  }>;
  
  // Multiple sent-back tracking
  sentBackEvents?: Array<{
    sentBackAt: string;
    sentBackBy: string;
    pmNotes: string;
    revisionNumber: number;
  }>;

  // PM notes history
  pmNotesHistory?: Array<{
    note: string;
    revisionNumber: number;
    sentBackAt: string;
    sentBackBy: string;
  }>;
  
  // PM Review functionality
  pmNotes?: string;
  sentBackCount?: number;
  sentBackBy?: string;
  finalApprovalBy?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRoleType;
  avatar?: string;
  languages?: string[];
  availability: "available" | "busy" | "offline";
  currentProjects?: number;
  completedProjects?: number;
  score?: number; // Translator rating/score
  availableTime?: string; // Available time in UTC format (e.g., "09:00-17:00")
  specialtyLanguages?: string[]; // Specialty languages
}

export interface UserRole {
  id: string;
  name: string;
  email: string;
  role: UserRoleType;
  avatar?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  priority: "low" | "medium" | "high";
  read: boolean;
  createdAt: string;
  userId?: string;
}

export interface ProcessingState {
  activeProcessing: Set<string>;
  processingProgress: Map<string, number>;
}

export interface SidebarNavItem {
  title: string;
  href: string;
  icon: any;
  badge?: number;
}

export interface QuickAction {
  title: string;
  icon: any;
  action: () => void;
}

export interface ProjectStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue?: number;
} 