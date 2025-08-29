// Re-export TextField from components/types

// Universal template interface for all document types
export interface Template {
  id: string;
  doc_type: string;
  variation: string;
  file_url: string;
  info_json: any;
  created_at?: string;
  updated_at?: string;
}

// Page data interface for storing individual pages
export interface PageData {
  pageNumber: number;
  isTranslated: boolean;
  backgroundColor?: string;
  pageType?:
    | "social_media"
    | "birth_cert"
    | "nbi_clearance"
    | "dynamic_content";
  // Universal template data for all document types
  template?: Template | null;
  templateType?: string; // e.g., "English_1993_template", "Spanish_1993_template", "English_template", "Spanish_template"
  translatedTemplateURL?: string; // URL of the template for translated view
  translatedTemplateWidth?: number; // Width of the template for translated view
  translatedTemplateHeight?: number; // Height of the template for translated view
}

// Document and page related types
export interface DocumentState {
  url: string; // This now contains the actual URL (Supabase public URL or blob URL)
  currentPage: number;
  numPages: number;
  scale: number;
  pdfRenderScale: number; // The scale at which PDF is actually rendered (for high quality)
  pageWidth: number;
  pageHeight: number;
  isLoading: boolean;
  error: string;
  fileType: "pdf" | "image" | null;
  imageDimensions: { width: number; height: number } | null;
  isDocumentLoaded: boolean;
  isPageLoading: boolean;
  isScaleChanging: boolean;
  pdfBackgroundColor: string;
  detectedPageBackgrounds: Map<number, string>;
  pages: PageData[];
  deletedPages: Set<number>;
  isTransforming: boolean;
  // Supabase storage fields
  supabaseFilePath?: string; // The internal file path in Supabase storage (for deletion)
  isSupabaseUrl?: boolean;
  // Final layout fields
  finalLayoutUrl?: string;
  finalLayoutCurrentPage?: number;
  finalLayoutNumPages?: number;
  finalLayoutDeletedPages?: Set<number>;
}

export interface TextField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  placeholder?: string; // Placeholder text for the text field
  fontSize: number;
  fontFamily: string;
  page: number;
  type?: "chat_time" | "MessengerTextBox" | string;
  color?: string;
  textOpacity?: number; // Opacity for text color
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: "left" | "center" | "right" | "justify";
  listType?: "none" | "ordered" | "unordered";
  letterSpacing?: number;
  lineHeight?: number;
  rotation?: number;
  backgroundColor: string;
  backgroundOpacity?: number; // Opacity for background color
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  isEditing?: boolean;
  hasBeenManuallyResized?: boolean; // Track if user has manually resized this textbox
  zIndex?: number; // Add z-index support for layering
}

// Shape interface
export interface Shape {
  id: string;
  type: "circle" | "rectangle" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  borderColor: string;
  borderWidth: number;
  fillColor: string;
  fillOpacity: number;
  rotation?: number;
  borderRadius?: number;
  // Line-specific properties
  x1?: number; // Start point x coordinate (for lines)
  y1?: number; // Start point y coordinate (for lines)
  x2?: number; // End point x coordinate (for lines)
  y2?: number; // End point y coordinate (for lines)
}

// Image interface
export interface Image {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  src: string;
  rotation?: number;
  opacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  // Supabase storage metadata
  isSupabaseUrl?: boolean;
  filePath?: string; // Supabase storage path for cleanup/management
  fileName?: string; // Original filename for reference
  fileObjectId?: string; // UUID from file_objects table
}

// Deletion rectangle interface
export interface DeletionRectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  background?: string;
  opacity?: number;
  borderColor?: string;
  borderWidth?: number;
}

// Untranslated text interface for storing original OCR text
export interface UntranslatedText {
  id: string;
  translatedTextboxId: string;
  originalText: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isCustomTextbox?: boolean;
  status: "isEmpty" | "needsChecking" | "checked";
  placeholder?: string; // Placeholder text for the original text field
}

// Editor state types
export interface EditorState {
  selectedFieldId: string | null;
  selectedShapeId: string | null;
  isEditMode: boolean;
  isAddTextBoxMode: boolean;
  isTextSelectionMode: boolean;
  showDeletionRectangles: boolean;
  isImageUploadMode: boolean;
  // Text selection properties
  selectedTextBoxes: SelectedTextBoxes;
  isDrawingSelection: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionEnd: { x: number; y: number } | null;
  selectionRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  // Multi-element selection properties
  multiSelection: MultiSelectionState;
  isSelectionMode: boolean;
}

// Tool state types
export interface ToolState {
  shapeDrawingMode: "circle" | "rectangle" | "line" | null;
  selectedShapeType: "circle" | "rectangle" | "line";
  isDrawingShape: boolean;
  shapeDrawStart: { x: number; y: number } | null;
  shapeDrawEnd: { x: number; y: number } | null;
  isDrawingInProgress: boolean;
  shapeDrawTargetView: "original" | "translated" | "final-layout" | null;
}

// Erasure tool state
export interface ErasureState {
  isErasureMode: boolean;
  isDrawingErasure: boolean;
  erasureDrawStart: { x: number; y: number } | null;
  erasureDrawEnd: { x: number; y: number } | null;
  erasureDrawTargetView: "original" | "translated" | "final-layout" | null;
  erasureSettings: {
    width: number;
    height: number;
    background: string;
    opacity: number;
  };
}

// Text selection types
export interface SelectedTextBoxes {
  textBoxIds: string[];
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SelectionState {
  selectedTextBoxes: SelectedTextBoxes;
  isDrawingSelection: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionEnd: { x: number; y: number } | null;
}

// Multi-element selection types
export interface SelectedElement {
  id: string;
  type: "textbox" | "shape" | "image";
  originalPosition: { x: number; y: number };
}

export interface MultiSelectionState {
  selectedElements: SelectedElement[];
  selectionBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  isDrawingSelection: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionEnd: { x: number; y: number } | null;
  isMovingSelection: boolean;
  moveStart: { x: number; y: number } | null;
  targetView: "original" | "translated" | "final-layout" | null;
  // Drag offsets for transform-based dragging performance optimization
  dragOffsets: Record<string, { x: number; y: number }>;
  isDragging: boolean;
}

// View state types
export type ViewMode = "original" | "translated" | "split" | "final-layout";

export type WorkflowStep = "translate" | "layout" | "final-layout";

export interface ViewState {
  currentView: ViewMode;
  zoomMode: "page" | "width";
  containerWidth: number;
  isCtrlPressed: boolean;
  transformOrigin: string;
  isSidebarCollapsed: boolean;
  activeSidebarTab: "pages" | "tools" | "chat";
  currentWorkflowStep: WorkflowStep;
}

// Layer management types
export interface LayerState {
  originalLayerOrder: string[];
  translatedLayerOrder: string[];
  finalLayoutLayerOrder: string[];
}

// Component Props
export interface SidebarProps {
  viewState: ViewState;
  documentState: DocumentState;
  pageState: PageState;
  elementCollections: ElementCollections;
  onPageChange: (page: number) => void;
  onPageDelete: (page: number) => void;
  onFileUpload: () => void;
  onAppendDocument: () => void;
  onSidebarToggle: () => void;
  onTabChange: (tab: "pages" | "tools" | "chat") => void;
  onPageTypeChange?: (
    pageNumber: number,
    pageType:
      | "social_media"
      | "birth_cert"
      | "nbi_clearance"
      | "dynamic_content"
  ) => void;
  onBirthCertModalOpen?: (pageNumber?: number) => void;
  onNBIClearanceModalOpen?: (pageNumber?: number) => void;
  onResetTour?: () => void;
  documentRef?: React.RefObject<HTMLDivElement | null>;
  sourceLanguage?: string;
  desiredLanguage?: string;
}

export interface StatusBarProps {
  documentState: DocumentState;
  viewState: ViewState;
  elementCollections: ElementCollections;
  pageState: PageState;
  onZoomChange: (scale: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

// Element collections
export interface ElementCollections {
  originalTextBoxes: TextField[];
  originalShapes: Shape[];
  originalDeletionRectangles: DeletionRectangle[];
  originalImages: Image[];
  translatedTextBoxes: TextField[];
  translatedShapes: Shape[];
  translatedDeletionRectangles: DeletionRectangle[];
  translatedImages: Image[];
  untranslatedTexts: UntranslatedText[];
  // Final layout elements
  finalLayoutTextboxes: TextField[];
  finalLayoutShapes: Shape[];
  finalLayoutDeletionRectangles: DeletionRectangle[];
  finalLayoutImages: Image[];
}

// Page management
export interface PageState {
  deletedPages: Set<number>;
  isPageTranslated: Map<number, boolean>;
  isTransforming: boolean;
}

// Event handler types
export interface MousePosition {
  x: number;
  y: number;
}

export interface ElementUpdateHandlers {
  onTextBoxUpdate: (id: string, updates: Partial<TextField>) => void;
  onShapeUpdate: (id: string, updates: Partial<Shape>) => void;
  onImageUpdate: (id: string, updates: Partial<Image>) => void;
  onTextBoxDelete: (id: string) => void;
  onShapeDelete: (id: string) => void;
  onImageDelete: (id: string) => void;
}

// Layer management functions
export interface LayerOrderFunctions {
  moveToFront: (elementId: string) => void;
  moveToBack: (elementId: string) => void;
  moveForward: (elementId: string) => void;
  moveBackward: (elementId: string) => void;
}

export interface LayerPositionHelpers {
  isElementAtFront: (elementId: string) => boolean;
  isElementAtBack: (elementId: string) => boolean;
}

// Sorted element type for rendering
export interface SortedElement {
  type: "textbox" | "shape" | "image";
  element: TextField | Shape | Image;
}

// File handling types
export interface FileUploadHandlers {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAppendDocument: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

// Keyboard shortcut types
export interface KeyboardShortcuts {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

// Tool creation types
export interface ElementCreators {
  addTextBox: (
    x: number,
    y: number,
    targetView?: "original" | "translated"
  ) => void;
  addShape: (
    type: "circle" | "rectangle",
    x: number,
    y: number,
    width: number,
    height: number,
    targetView?: "original" | "translated"
  ) => void;
  addDeletionRectangle: (
    x: number,
    y: number,
    width: number,
    height: number
  ) => void;
}

// Component props types
export interface DocumentViewerProps {
  documentState: DocumentState;
  viewState: ViewState;
  editorState: EditorState;
  toolState: ToolState;
  erasureState: ErasureState;
  selectionState: SelectionState;
  elementCollections: ElementCollections;
  layerState: LayerState;
  pageState: PageState;
  elementHandlers: ElementUpdateHandlers;
  elementCreators: ElementCreators;
  onDocumentClick: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
}

export interface ToolbarProps {
  editorState: EditorState;
  toolState: ToolState;
  erasureState: ErasureState;
  onToolChange: (tool: string, enabled: boolean) => void;
  onShapeTypeChange: (type: "circle" | "rectangle") => void;
  onImageUpload: () => void;
}

export interface StatusBarProps {
  documentState: DocumentState;
  viewState: ViewState;
  elementCollections: ElementCollections;
  pageState: PageState;
  onZoomChange: (scale: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

// Utility function types
export type ColorConverter = (color: string, opacity: number) => string;
export type MeasureTextFunction = (
  text: string,
  fontSize: number,
  fontFamily: string,
  characterSpacing?: number
) => { width: number; height: number };
export type UUIDGenerator = () => string;
