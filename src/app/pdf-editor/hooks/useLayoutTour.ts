import { useState, useEffect, useCallback } from "react";
import { TourStep } from "../components/SpotlightTour";

const LAYOUT_TOUR_STORAGE_KEY = "tutorial-layout";

export const useLayoutTour = (
  onWorkflowStepChange?: (
    step: "translate" | "layout" | "final-layout"
  ) => void,
  onViewChange?: (
    view: "original" | "translated" | "split" | "final-layout"
  ) => void,
  onEditModeToggle?: () => void,
  onSelectFirstTextBox?: () => void,
  onMoveToFirstPage?: () => void,
  currentWorkflowStep?: "translate" | "layout" | "final-layout"
) => {
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const [wasManuallyClosed, setWasManuallyClosed] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const tourCompleted = localStorage.getItem(LAYOUT_TOUR_STORAGE_KEY);
    if (tourCompleted === "true") {
      setHasCompletedTour(true);
    }
  }, []);

  // Auto-start tutorial when in layout workflow and tutorial hasn't been completed
  useEffect(() => {
    if (
      currentWorkflowStep === "layout" &&
      !hasCompletedTour &&
      !isTourOpen &&
      !wasManuallyClosed &&
      !localStorage.getItem(LAYOUT_TOUR_STORAGE_KEY)
    ) {
      // Small delay to ensure the component is fully mounted
      const timer = setTimeout(() => {
        startTour();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentWorkflowStep, hasCompletedTour, isTourOpen, wasManuallyClosed]);

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
        "This button toggles Edit Mode on and off. When Edit Mode is active, you can see and use all the editing tools. Let's open it to see what's available!",
      targetId: "edit-mode-tools",
      position: "left",
      showSpotlight: true,
    },
    {
      id: "edit-mode-opened",
      title: "Edit Mode Active!",
      description:
        "Great! Now you can see all the editing tools. These tools appear when Edit Mode is enabled and give you full control over your document layout.",
      targetId: "floating-toolbar",
      position: "screen-right-200",
      showSpotlight: true,
    },
    {
      id: "selection-tool",
      title: "Selection Tool",
      description:
        "Use the Selection Tool to select and move elements on your document. Click and drag to select multiple elements, or click individual elements to select them.",
      position: "screen-right-200",
      showSpotlight: true,
    },
    {
      id: "textbox-tool",
      title: "Add Text Field",
      description:
        "The Text Field tool allows you to add new text boxes to your document. Click this tool, then click anywhere on the document to place a new text field.",
      position: "screen-right-200",
      showSpotlight: true,
    },
    {
      id: "shape-tool",
      title: "Draw Shapes",
      description:
        "Use the Shape tool to draw rectangles, circles, and other geometric shapes on your document. Perfect for creating visual elements and annotations.",
      position: "screen-right-200",
      showSpotlight: true,
    },
    {
      id: "eraser-tool",
      title: "Eraser Tool",
      description:
        "The Eraser tool lets you remove or hide parts of your document. You can adjust the opacity and choose what gets erased - perfect for cleaning up documents.",
      position: "screen-right-200",
      showSpotlight: true,
    },
    {
      id: "image-upload",
      title: "Add Images",
      description:
        "Upload and add images to your document. Click this button to select image files from your computer. Images will be placed on the current page.",
      position: "screen-right-200",
      showSpotlight: true,
    },
    {
      id: "element-format-drawer",
      title: "Element Format Drawer",
      description:
        "When you select an element, the Element Format Drawer appears on the right side. Here you can adjust text properties, colors, fonts, positioning, and other formatting options for the selected element.",
      targetId: "element-format-drawer",
      position: "left",
      showSpotlight: true,
    },
    {
      id: "view-switcher",
      title: "View Switcher",
      description:
        "Switch between different document views. In Layout mode, you can view the original document, translated version, or split view to see both side by side.",
      targetId: "floating-toolbar",
      position: "screen-right-200",
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
    // Mark tour as completed when closed to prevent infinite loops
    localStorage.setItem(LAYOUT_TOUR_STORAGE_KEY, "true");
    setHasCompletedTour(true);
    setWasManuallyClosed(true);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(LAYOUT_TOUR_STORAGE_KEY, "true");
    setHasCompletedTour(true);
    setWasManuallyClosed(false); // Reset manual close flag when properly completed

    // Move to first non-deleted page after tutorial completion
    if (onMoveToFirstPage) {
      onMoveToFirstPage();
    }

    closeTour();
  }, [closeTour, onMoveToFirstPage]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(LAYOUT_TOUR_STORAGE_KEY);
    setHasCompletedTour(false);
    setWasManuallyClosed(false);
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < tourSteps.length) {
        const targetStep = tourSteps[index];

        // Automatically open edit mode when going to the edit mode toggle step
        if (targetStep.id === "edit-mode-toggle" && onEditModeToggle) {
          onEditModeToggle();
        }

        // Automatically select first textbox when going to the element format drawer step
        if (targetStep.id === "element-format-drawer" && onSelectFirstTextBox) {
          onSelectFirstTextBox();
        }

        setCurrentStepIndex(index);
      }
    },
    [tourSteps.length, onEditModeToggle, onSelectFirstTextBox, tourSteps]
  );

  const nextStep = useCallback(() => {
    if (currentStepIndex < tourSteps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      const nextStep = tourSteps[nextIndex];

      // Automatically open edit mode when reaching the edit mode toggle step
      if (nextStep.id === "edit-mode-toggle" && onEditModeToggle) {
        onEditModeToggle();
      }

      // Automatically select first textbox when reaching the element format drawer step
      if (nextStep.id === "element-format-drawer" && onSelectFirstTextBox) {
        onSelectFirstTextBox();
      }

      setCurrentStepIndex(nextIndex);
    } else {
      completeTour();
    }
  }, [
    currentStepIndex,
    tourSteps.length,
    completeTour,
    onEditModeToggle,
    onSelectFirstTextBox,
    tourSteps,
  ]);

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
