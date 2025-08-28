import { useState, useEffect, useCallback } from "react";
import { TourStep } from "../components/SpotlightTour";

const LAYOUT_TOUR_STORAGE_KEY = "pdfEditorLayoutTourCompleted";

export const useLayoutTour = (
  onWorkflowStepChange?: (
    step: "translate" | "layout" | "final-layout"
  ) => void,
  onViewChange?: (
    view: "original" | "translated" | "split" | "final-layout"
  ) => void
) => {
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const tourCompleted = localStorage.getItem(LAYOUT_TOUR_STORAGE_KEY);
    if (tourCompleted === "true") {
      setHasCompletedTour(true);
    }
  }, []);

  // Layout tour steps configuration
  const tourSteps: TourStep[] = [
    {
      id: "layout-welcome",
      title: "Welcome to Layout Mode!",
      description:
        "You're now in Layout mode where you can edit and arrange elements on your document. This tutorial will show you the key editing tools and features available in this workflow step.",
      position: "center",
      showSpotlight: true,
    },
    {
      id: "edit-mode-toggle",
      title: "Edit Mode Toggle",
      description:
        "This button toggles Edit Mode on and off. When Edit Mode is active, you can see and use all the editing tools. Click it to enable editing capabilities.",
      targetId: "edit-mode-tools",
      position: "left",
      showSpotlight: true,
    },
    {
      id: "selection-tool",
      title: "Selection Tool",
      description:
        "Use the Selection Tool to select and move elements on your document. Click and drag to select multiple elements, or click individual elements to select them.",
      targetId: "selection",
      position: "left",
      showSpotlight: true,
    },
    {
      id: "textbox-tool",
      title: "Add Text Field",
      description:
        "The Text Field tool allows you to add new text boxes to your document. Click this tool, then click anywhere on the document to place a new text field.",
      targetId: "textbox",
      position: "left",
      showSpotlight: true,
    },
    {
      id: "shape-tool",
      title: "Draw Shapes",
      description:
        "Use the Shape tool to draw rectangles, circles, and other geometric shapes on your document. Perfect for creating visual elements and annotations.",
      targetId: "shapes",
      position: "left",
      showSpotlight: true,
    },
    {
      id: "eraser-tool",
      title: "Eraser Tool",
      description:
        "The Eraser tool lets you remove or hide parts of your document. You can adjust the opacity and choose what gets erased - perfect for cleaning up documents.",
      targetId: "eraser",
      position: "left",
      showSpotlight: true,
    },
    {
      id: "image-upload",
      title: "Add Images",
      description:
        "Upload and add images to your document. Click this button to select image files from your computer. Images will be placed on the current page.",
      targetId: "image",
      position: "left",
      showSpotlight: true,
    },
    {
      id: "view-switcher",
      title: "View Switcher",
      description:
        "Switch between different document views. In Layout mode, you can view the original document, translated version, or split view to see both side by side.",
      targetId: "floating-toolbar",
      position: "left",
      showSpotlight: true,
    },
    {
      id: "layout-complete",
      title: "Layout Complete!",
      description:
        "You've learned the key layout tools! You can now edit, arrange, and customize your document elements. When you're ready, move to the Final Layout step to prepare your document for export.",
      position: "center",
      showSpotlight: true,
    },
  ];

  const startTour = useCallback(() => {
    // Automatically switch to layout workflow step when tour starts
    if (onWorkflowStepChange) {
      onWorkflowStepChange("layout");
    }
    // Automatically switch to split view when tour starts
    if (onViewChange) {
      onViewChange("split");
    }
    setCurrentStepIndex(0);
    setIsTourOpen(true);
  }, [onWorkflowStepChange, onViewChange]);

  const closeTour = useCallback(() => {
    setIsTourOpen(false);
    setCurrentStepIndex(0);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(LAYOUT_TOUR_STORAGE_KEY, "true");
    setHasCompletedTour(true);
    closeTour();
  }, [closeTour]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(LAYOUT_TOUR_STORAGE_KEY);
    setHasCompletedTour(false);
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < tourSteps.length) {
        setCurrentStepIndex(index);
      }
    },
    [tourSteps.length]
  );

  const nextStep = useCallback(() => {
    if (currentStepIndex < tourSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      completeTour();
    }
  }, [currentStepIndex, tourSteps.length, completeTour]);

  return {
    // State
    isTourOpen,
    currentStepIndex,
    hasCompletedTour,
    tourSteps,

    // Actions
    startTour,
    closeTour,
    completeTour,
    resetTour,
    goToStep,
    nextStep,

    // Computed
    currentStep: tourSteps[currentStepIndex],
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === tourSteps.length - 1,
    totalSteps: tourSteps.length,
  };
};
