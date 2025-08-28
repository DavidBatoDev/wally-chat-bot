import { useState, useEffect, useCallback } from "react";
import { TourStep } from "../components/SpotlightTour";

const TOUR_STORAGE_KEY = "tutorial-translate";

export const useSpotlightTour = (
  onWorkflowStepChange?: (
    step: "translate" | "layout" | "final-layout"
  ) => void,
  onViewChange?: (
    view: "original" | "translated" | "split" | "final-layout"
  ) => void,
  currentWorkflowStep?: "translate" | "layout" | "final-layout"
) => {
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const [wasManuallyClosed, setWasManuallyClosed] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const tourCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    if (tourCompleted === "true") {
      setHasCompletedTour(true);
    }
  }, []);

  // Auto-start tutorial when in translate workflow and tutorial hasn't been completed
  useEffect(() => {
    if (
      currentWorkflowStep === "translate" &&
      !hasCompletedTour &&
      !isTourOpen &&
      !wasManuallyClosed &&
      !localStorage.getItem(TOUR_STORAGE_KEY)
    ) {
      // Small delay to ensure the component is fully mounted
      const timer = setTimeout(() => {
        startTour();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentWorkflowStep, hasCompletedTour, isTourOpen, wasManuallyClosed]);

  // Tour steps configuration
  const tourSteps: TourStep[] = [
    {
      id: "welcome",
      title: "Welcome to PDF Editor!",
      description:
        "This guided tour will help you get started with the PDF Editor. You'll learn about the key features and how to use them effectively.",
      position: "center",
      showSpotlight: true,
    },
    {
      id: "workflow-overview",
      title: "Workflow Overview",
      description:
        "The PDF Editor has three main workflow steps: Translate, Layout, and Final Layout. Each step focuses on different aspects of document processing.",
      position: "center",
      showSpotlight: true,
    },
    {
      id: "sidebar-pages",
      title: "Pages Section",
      description:
        "Here in the sidebar, you can see all the pages of your document. Each page is displayed as a preview, and you can click on any page to navigate to it. This makes it easy to jump between different sections of your document.",
      targetId: "sidebar-pages-section",
      position: "right",
      showSpotlight: true,
    },
    {
      id: "header-overview",
      title: "Header Overview",
      description:
        "The header contains all the important controls and navigation for your PDF editor. Here you'll find workflow management, project controls, and essential tools to manage your document editing session.",
      targetId: "pdf-editor-header",
      position: "bottom",
      showSpotlight: true,
    },
    {
      id: "workflow-steps",
      title: "Workflow Steps",
      description:
        "The workflow follows three main steps: Translate, Layout, and Final Layout. You can click on any step to navigate between them. The current step is highlighted in blue, and completed steps show a checkmark.",
      targetId: "workflow-steps",
      position: "bottom",
      showSpotlight: true,
    },
    {
      id: "save-button",
      title: "Save Project",
      description:
        "Use this button to save your project. The button will show an orange indicator when you have unsaved changes. Always save your work regularly to avoid losing progress.",
      targetId: "save-project-button",
      position: "bottom",
      showSpotlight: true,
    },
    {
      id: "share-button",
      title: "Share Project",
      description:
        "Click here to share your project with others. You can collaborate with team members or share your work with clients and stakeholders.",
      targetId: "share-project-button",
      position: "bottom",
      showSpotlight: true,
    },
    {
      id: "tutorial-button",
      title: "Start Tutorial",
      description:
        "This button allows you to start the tutorial for the current workflow step anytime. Use it if you need a refresher on how to use the PDF editor features.",
      targetId: "start-tutorial-button",
      position: "bottom",
      showSpotlight: true,
    },
    {
      id: "next-workflow-button",
      title: "Next Workflow Step",
      description:
        "When you're finished with the current workflow step, click this button to move to the next phase. It will guide you through the complete document processing workflow.",
      targetId: "next-workflow-step-button",
      position: "bottom",
      showSpotlight: true,
    },
    {
      id: "translate-step",
      title: "Translation Step",
      description:
        "In the Translate step, you'll be working on translating all the elements detected by our OCR to the desired language. This is where you can review, edit, and translate text content before moving to the layout phase.",
      targetId: "translation-table-view",
      position: "center",
      showSpotlight: true,
    },
    {
      id: "first-original-text",
      title: "Original Text Area",
      description:
        "Try to translate this text and put the original text here if none exists. This is where you'll see the text that was detected by our OCR system.",
      position: "left",
      showSpotlight: true,
    },
    {
      id: "first-translated-text",
      title: "Translation Area",
      description:
        "Try translating the original text to your desired language here. This is where you'll input your translation of the detected text.",
      position: "right",
      showSpotlight: true,
    },
    {
      id: "first-action-buttons",
      title: "Action Buttons",
      description:
        "Click the checkmark (✓) to approve if you've already finished translating the original text, or click the delete button (🗑️) if you think the original text doesn't exist in the document.",
      position: "right",
      showSpotlight: true,
    },
    {
      id: "floating-toolbar",
      title: "Floating Toolbar",
      description:
        "In this workflow step, you can switch between different view modes. Use the view switcher to toggle between 'Original Document' view and 'Split Screen View'. The split view shows both original and translated content side by side, which is perfect for translation work.",
      targetId: "floating-toolbar",
      position: "left",
      showSpotlight: true,
    },
    {
      id: "original-view",
      title: "Original Document View",
      description:
        "This is the original view where you can inspect the document contents without the translation table. It's useful for getting a clear view of the source material.",
      targetId: "document-viewer",
      position: "left",
      showSpotlight: true,
    },

    {
      id: "getting-started",
      title: "Ready to Start!",
      description:
        "You're all set! Start by uploading a PDF document or creating a new project. The editor will guide you through each step of the process.",
      position: "center",
      showSpotlight: true,
    },
  ];

  const startTour = useCallback(() => {
    // Automatically switch to translate workflow step when tour starts
    if (onWorkflowStepChange) {
      onWorkflowStepChange("translate");
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
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setHasCompletedTour(true);
    setWasManuallyClosed(true);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setHasCompletedTour(true);
    setWasManuallyClosed(false); // Reset manual close flag when properly completed
    closeTour();
  }, [closeTour]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setHasCompletedTour(false);
    setWasManuallyClosed(false);
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < tourSteps.length) {
        const targetStep = tourSteps[index];

        // Handle view switching for specific steps
        if (targetStep.id === "original-view" && onViewChange) {
          // Switch to original view when going to original-view step
          onViewChange("original");
        } else if (targetStep.id === "getting-started" && onViewChange) {
          // Switch back to split view when going to getting-started step
          onViewChange("split");
        }

        setCurrentStepIndex(index);
      }
    },
    [tourSteps.length, onViewChange, tourSteps]
  );

  const nextStep = useCallback(() => {
    if (currentStepIndex < tourSteps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      const nextStep = tourSteps[nextIndex];

      // Handle view switching for specific steps
      if (nextStep.id === "original-view" && onViewChange) {
        // Switch to original view when entering original-view step
        onViewChange("original");
      } else if (nextStep.id === "getting-started" && onViewChange) {
        // Switch back to split view when entering getting-started step
        onViewChange("split");
      }

      setCurrentStepIndex(nextIndex);
    } else {
      completeTour();
    }
  }, [
    currentStepIndex,
    tourSteps.length,
    completeTour,
    onViewChange,
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
