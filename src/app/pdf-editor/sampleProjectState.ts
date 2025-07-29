export interface ProjectState {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  documentState: {
    url: string;
    currentPage: number;
    numPages: number;
    scale: number;
    pageWidth: number;
    pageHeight: number;
    fileType: string | null;
    imageDimensions: { width: number; height: number } | null;
    pdfBackgroundColor: string;
    detectedPageBackgrounds: Record<string, string>;
    pages: PageData[];
    deletedPages: number[];
    isTransforming: boolean;
  };
  viewState: {
    currentView: "original" | "translated" | "split";
    currentWorkflowStep: string;
    activeSidebarTab: string;
    isSidebarCollapsed: boolean;
    isCtrlPressed: boolean;
  };
  elementCollections: {
    originalTextBoxes: TextBoxType[];
    originalShapes: ShapeType[];
    originalDeletionRectangles: DeletionRectangleType[];
    originalImages: ImageType[];
    translatedTextBoxes: TextBoxType[];
    translatedShapes: ShapeType[];
    translatedDeletionRectangles: DeletionRectangleType[];
    translatedImages: ImageType[];
    untranslatedTexts: UntranslatedTextType[];
  };
  layerState: {
    originalLayerOrder: string[];
    translatedLayerOrder: string[];
  };
  editorState: {
    selectedFieldId: string | null;
    selectedShapeId: string | null;
    isEditMode: boolean;
    isAddTextBoxMode: boolean;
    isTextSelectionMode: boolean;
    showDeletionRectangles: boolean;
    isImageUploadMode: boolean;
    isSelectionMode: boolean;
    multiSelection: any;
  };
  sourceLanguage: string;
  desiredLanguage: string;
  originalDocumentFile?: {
    name: string;
    size: number;
    type: string;
    data: string; 
  };
}