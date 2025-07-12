import { TextField } from "@/components/types";

// Re-export TextField from components/types
export type { TextField } from "@/components/types";

// Document and page related types
export interface DocumentState {
  url: string;
  currentPage: number;
  numPages: number;
  scale: number;
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
}

// Shape interface
export interface Shape {
  id: string;
  type: "circle" | "rectangle";
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
  shapeDrawingMode: "circle" | "rectangle" | null;
  selectedShapeType: "circle" | "rectangle";
  isDrawingShape: boolean;
  shapeDrawStart: { x: number; y: number } | null;
  shapeDrawEnd: { x: number; y: number } | null;
  isDrawingInProgress: boolean;
  shapeDrawTargetView: "original" | "translated" | null;
}

// Erasure tool state
export interface ErasureState {
  isErasureMode: boolean;
  isDrawingErasure: boolean;
  erasureDrawStart: { x: number; y: number } | null;
  erasureDrawEnd: { x: number; y: number } | null;
  erasureDrawTargetView: "original" | "translated" | null;
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
  targetView: "original" | "translated" | null;
}

// View state types
export type ViewMode = "original" | "translated" | "split";

export interface ViewState {
  currentView: ViewMode;
  zoomMode: "page" | "width";
  containerWidth: number;
  isCtrlPressed: boolean;
  transformOrigin: string;
  isSidebarCollapsed: boolean;
  activeSidebarTab: "pages" | "tools";
}

// Layer management types
export interface LayerState {
  originalLayerOrder: string[];
  translatedLayerOrder: string[];
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
  onTabChange: (tab: "pages" | "tools") => void;
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
}

// Page management
export interface PageState {
  deletedPages: Set<number>;
  isPageTranslated: Map<number, boolean>;
  isTransforming: boolean;
  showTransformButton: boolean;
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
  onTabChange: (tab: "pages" | "tools") => void;
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
