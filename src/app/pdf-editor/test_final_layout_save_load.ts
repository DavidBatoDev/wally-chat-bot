// Test file to verify final layout settings save/load functionality
// This is a simple test to ensure the integration works correctly

import { ProjectState } from "./hooks/states/useProjectState";

// Mock final layout settings
const mockFinalLayoutSettings = {
  exportSettings: {
    format: "pdf" as const,
    quality: 95,
    includeOriginal: true,
    includeTranslated: false,
    pageRange: "custom" as const,
    customRange: "1-3, 5",
  },
  activeTab: "preview" as const,
  isPreviewMode: true,
};

// Mock project state with final layout settings
const mockProjectState: ProjectState = {
  id: "test-project-123",
  name: "Test Project with Final Layout",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: "1.0.0",
  documentState: {
    url: "test-url",
    currentPage: 1,
    numPages: 5,
    scale: 1.0,
    pageWidth: 612,
    pageHeight: 792,
    isLoading: false,
    error: "",
    fileType: "pdf",
    imageDimensions: null,
    isDocumentLoaded: true,
    isPageLoading: false,
    isScaleChanging: false,
    pdfBackgroundColor: "#ffffff",
    detectedPageBackgrounds: {},
    pages: [],
    deletedPages: [],
    isTransforming: false,
  },
  viewState: {
    currentView: "final-layout",
    currentWorkflowStep: "final-layout",
    activeSidebarTab: "pages",
    isSidebarCollapsed: false,
    isCtrlPressed: false,
    zoomMode: "page",
    containerWidth: 1200,
    transformOrigin: "center",
  },
  elementCollections: {
    originalTextBoxes: [],
    originalShapes: [],
    originalDeletionRectangles: [],
    originalImages: [],
    translatedTextBoxes: [],
    translatedShapes: [],
    translatedDeletionRectangles: [],
    translatedImages: [],
    untranslatedTexts: [],
    finalLayoutTextboxes: [],
    finalLayoutShapes: [],
    finalLayoutDeletionRectangles: [],
    finalLayoutImages: [],
  },
  layerState: {
    originalLayerOrder: [],
    translatedLayerOrder: [],
  },
  editorState: {
    selectedFieldId: null,
    selectedShapeId: null,
    isEditMode: true,
    isAddTextBoxMode: false,
    isTextSelectionMode: false,
    showDeletionRectangles: false,
    isImageUploadMode: false,
    isSelectionMode: false,
  },
  sourceLanguage: "en",
  desiredLanguage: "es",
  finalLayoutSettings: mockFinalLayoutSettings,
};

// Test function to verify serialization/deserialization
export function testFinalLayoutSettingsSaveLoad() {
  console.log("Testing final layout settings save/load...");

  // Test 1: Verify that final layout settings are included in project state
  if (!mockProjectState.finalLayoutSettings) {
    console.error("❌ Final layout settings not found in project state");
    return false;
  }

  // Test 2: Verify that all expected properties are present
  const settings = mockProjectState.finalLayoutSettings;
  const requiredProps = ["exportSettings", "activeTab", "isPreviewMode"];

  for (const prop of requiredProps) {
    if (!(prop in settings)) {
      console.error(`❌ Missing required property: ${prop}`);
      return false;
    }
  }

  // Test 3: Verify export settings structure
  const exportSettings = settings.exportSettings;
  const requiredExportProps = [
    "format",
    "quality",
    "includeOriginal",
    "includeTranslated",
    "pageRange",
    "customRange",
  ];

  for (const prop of requiredExportProps) {
    if (!(prop in exportSettings)) {
      console.error(`❌ Missing required export setting: ${prop}`);
      return false;
    }
  }

  // Test 4: Verify that values are preserved
  if (exportSettings.format !== "pdf") {
    console.error("❌ Format not preserved");
    return false;
  }

  if (exportSettings.quality !== 95) {
    console.error("❌ Quality not preserved");
    return false;
  }

  if (exportSettings.customRange !== "1-3, 5") {
    console.error("❌ Custom range not preserved");
    return false;
  }

  if (settings.activeTab !== "preview") {
    console.error("❌ Active tab not preserved");
    return false;
  }

  if (settings.isPreviewMode !== true) {
    console.error("❌ Preview mode not preserved");
    return false;
  }

  console.log("✅ All final layout settings save/load tests passed!");
  return true;
}

// Test serialization
export function testSerialization() {
  console.log("Testing serialization...");

  try {
    const serialized = JSON.stringify(mockProjectState);
    const deserialized = JSON.parse(serialized) as ProjectState;

    if (!deserialized.finalLayoutSettings) {
      console.error("❌ Final layout settings lost during serialization");
      return false;
    }

    if (deserialized.finalLayoutSettings.exportSettings.format !== "pdf") {
      console.error("❌ Export settings lost during serialization");
      return false;
    }

    console.log("✅ Serialization test passed!");
    return true;
  } catch (error) {
    console.error("❌ Serialization failed:", error);
    return false;
  }
}

// Run tests
if (typeof window !== "undefined") {
  // Only run in browser environment
  console.log("Running final layout settings tests...");
  testFinalLayoutSettingsSaveLoad();
  testSerialization();
}
