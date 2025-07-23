export type ProjectStatus = 
  | "ocr-processing"
  | "pending-confirmation"
  | "assigning-translator"
  | "assigned"
  | "in-progress"
  | "pm-review"
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
  actionType?: "confirmation" | "final-approval";
  createdAt: string;
  updatedAt: string;
  fileName?: string;
  fileSize?: number;
  ocrProgress?: number; // For real-time OCR progress
  detectedDocumentType?: string; // Detected by OCR
  detectedSourceLanguage?: string; // Detected by OCR
  pdfEditorState?: any; // PDF editor state for seamless integration
  
  // Workflow timestamps
  ocrCompletedAt?: string;
  translatorAssignedAt?: string;
  translationStartedAt?: string;
  translationSubmittedAt?: string;
  finalApprovalAt?: string;
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
  read: boolean;
  createdAt: string;
  userId: string;
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