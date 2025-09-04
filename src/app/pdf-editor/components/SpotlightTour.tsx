import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, HelpCircle } from "lucide-react";

export interface TourStep {
  id: string;
  targetId?: string; // Element ID to highlight
  title: string;
  description: string;
  position?:
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "center"
    | "screen-right-200";
  showSpotlight?: boolean; // Whether to show the dark overlay
}

interface SpotlightTourProps {
  isOpen: boolean;
  onClose: () => void;
  steps: TourStep[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
}

export const SpotlightTour: React.FC<SpotlightTourProps> = ({
  isOpen,
  onClose,
  steps,
  currentStepIndex,
  onStepChange,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  // Get current step info
  const currentStep = steps[currentStepIndex];

  // Helper function to calculate modal position near the target element
  const getModalPosition = (position: string, element: HTMLElement | null) => {
    // Define common variables first
    const modalWidth = 400; // Approximate modal width
    const modalHeight = 300; // Approximate modal height
    const padding = 20;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Handle screen-based positioning even when no target element
    if (!element) {
      if (position === "screen-right-200") {
        return {
          top: Math.max(padding, 100), // Fixed top position
          left: Math.max(padding, viewportWidth - 200 - modalWidth),
        };
      }
      return {};
    }

    // Special handling for translation table steps
    if (
      currentStep.id === "first-original-text" ||
      currentStep.id === "first-translated-text" ||
      currentStep.id === "first-action-buttons" ||
      currentStep.id === "floating-toolbar"
    ) {
      const translationTable = document.getElementById(
        "translation-table-view"
      );
      if (translationTable) {
        const rect = translationTable.getBoundingClientRect();

        switch (position) {
          case "left":
            // Position modal to the left of the translation table
            return {
              top: Math.max(
                padding,
                Math.min(
                  rect.top + 200, // Lower position - 150px from top of table
                  viewportHeight - modalHeight - padding
                )
              ),
              left: Math.max(padding, rect.left - modalWidth - padding),
            };
          case "right":
            // Position modal to the right of the translation table
            return {
              top: Math.max(
                padding,
                Math.min(
                  rect.top + 200, // Lower position - 150px from top of table
                  viewportHeight - modalHeight - padding
                )
              ),
              left: Math.min(
                rect.right + padding,
                viewportWidth - modalWidth - padding
              ),
            };
          default:
            return {};
        }
      }

      // Special handling for floating toolbar step
      if (currentStep.id === "floating-toolbar") {
        // Position modal to the left of the floating toolbar
        return {
          top: Math.max(
            padding,
            Math.min(
              80 + 150, // 80px (toolbar top) + 150px offset for better positioning
              viewportHeight - modalHeight - padding
            )
          ),
          left: Math.max(
            padding,
            viewportWidth - 76 - modalWidth - padding + 50
          ), // 76px = 60px (toolbar width) + 16px (right margin) + 50px extra right offset
        };
      }
    }

    // Special handling for element format drawer step
    if (currentStep.id === "element-format-drawer") {
      // Position modal to the left side with lower positioning
      return {
        top: Math.max(
          padding,
          Math.min(
            200, // Fixed lower position for better visibility
            viewportHeight - modalHeight - padding
          )
        ),
        left: Math.max(padding, 50), // 50px from left edge
      };
    }

    const elementRect = element.getBoundingClientRect();

    switch (position) {
      case "right":
        // Position modal to the right of the element
        return {
          top: Math.max(
            padding,
            Math.min(
              elementRect.top - 50,
              viewportHeight - modalHeight - padding
            )
          ),
          left: Math.min(
            elementRect.right + padding,
            viewportWidth - modalWidth - padding
          ),
        };
      case "left":
        // Position modal to the left of the element
        return {
          top: Math.max(
            padding,
            Math.min(
              elementRect.top - 50,
              viewportHeight - modalHeight - padding
            )
          ),
          left: Math.max(padding, elementRect.left - modalWidth - padding),
        };
      case "top":
        // Position modal above the element
        return {
          top: Math.max(padding, elementRect.top - modalHeight - padding),
          left: Math.max(
            padding,
            Math.min(
              elementRect.left + elementRect.width / 2 - modalWidth / 2,
              viewportWidth - modalWidth - padding
            )
          ),
        };
      case "bottom":
        // Position modal below the element
        return {
          top: Math.min(
            elementRect.bottom + padding,
            viewportHeight - modalHeight - padding
          ),
          left: Math.max(
            padding,
            Math.min(
              elementRect.left + elementRect.width / 2 - modalWidth / 2,
              viewportWidth - modalWidth - padding
            )
          ),
        };
      case "screen-right-200":
        // Position modal 200px from the right edge of the screen
        return {
          top: Math.max(
            padding,
            Math.min(
              elementRect.top - 50,
              viewportHeight - modalHeight - padding
            )
          ),
          left: Math.max(padding, viewportWidth - 200 - modalWidth),
        };
      default:
        return {};
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure smooth animation
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Update target element when step changes
  useEffect(() => {
    if (isOpen && currentStep?.targetId) {
      const element = document.getElementById(currentStep.targetId);
      console.log(
        "Tour step:",
        currentStep.id,
        "Target element:",
        element,
        "Target ID:",
        currentStep.targetId
      );
      if (element) {
        const rect = element.getBoundingClientRect();
        console.log("Element rect:", rect);
      }
      setTargetElement(element);
    } else {
      setTargetElement(null);
    }
  }, [isOpen, currentStep?.targetId, currentStepIndex]);

  // If the target element doesn't exist yet (e.g., created after step side-effects), observe DOM until it appears
  useEffect(() => {
    if (!isOpen || !currentStep?.targetId || targetElement) return;

    let cancelled = false;
    const tryFind = () => {
      const el = document.getElementById(currentStep.targetId!);
      if (el && !cancelled) {
        setTargetElement(el);
        return true;
      }
      return false;
    };

    // Immediate retry
    if (tryFind()) return;

    const observer = new MutationObserver(() => {
      if (tryFind()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Fallback polling in case mutations don't catch attribute changes
    const intervalId = window.setInterval(() => {
      if (tryFind()) {
        window.clearInterval(intervalId);
        observer.disconnect();
      }
    }, 100);

    // Safety timeout to stop observing after a while
    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      observer.disconnect();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [isOpen, currentStep?.targetId, currentStepIndex, targetElement]);

  if (!isOpen) return null;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (!isLastStep) {
      onStepChange(currentStepIndex + 1);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <>
      {/* Dark overlay - only show when no specific element is highlighted */}
      {(!targetElement || !currentStep.showSpotlight) && (
        <div
          className={`fixed inset-0 bg-black/40 transition-opacity duration-300 z-50 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={handleSkip}
        />
      )}

      {/* Spotlight highlight for target element */}
      {targetElement && currentStep.showSpotlight && (
        <div
          className="fixed z-40 pointer-events-none"
          style={{
            top: targetElement.getBoundingClientRect().top,
            left: targetElement.getBoundingClientRect().left,
            width: targetElement.getBoundingClientRect().width,
            height: targetElement.getBoundingClientRect().height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
            borderRadius: "8px",
            border: "3px solid #3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
          }}
        />
      )}

      {/* Estimated spotlight highlights for translation table elements */}
      {!targetElement && currentStep.showSpotlight && (
        <>
          {/* First Original Text Area - estimated position */}
          {currentStep.id === "first-original-text" &&
            (() => {
              const translationTable = document.getElementById(
                "translation-table-view"
              );
              if (!translationTable) return null;

              const rect = translationTable.getBoundingClientRect();
              return (
                <div
                  className="fixed z-40 pointer-events-none"
                  style={{
                    top: rect.top + 80, // 80px from top of table (header + some padding)
                    left: rect.left + 20, // 20px from left of table
                    width: rect.width * 0.5, // 40% of table width for original column
                    height: 80, // Estimated height for textarea
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
                    borderRadius: "8px",
                    border: "3px solid #3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                  }}
                />
              );
            })()}

          {/* First Translated Text Area - estimated position */}
          {currentStep.id === "first-translated-text" &&
            (() => {
              const translationTable = document.getElementById(
                "translation-table-view"
              );
              if (!translationTable) return null;

              const rect = translationTable.getBoundingClientRect();
              return (
                <div
                  className="fixed z-40 pointer-events-none"
                  style={{
                    top: rect.top + 80, // 120px from top of table (header + some padding)
                    left: rect.left + rect.width * 0.4 + 20, // Right of original column + padding
                    width: rect.width * 0.5, // 55% of table width for translation column
                    height: 80, // Estimated height for textarea
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
                    borderRadius: "8px",
                    border: "3px solid #3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                  }}
                />
              );
            })()}

          {/* First Action Buttons - estimated position */}
          {currentStep.id === "first-action-buttons" &&
            (() => {
              const translationTable = document.getElementById(
                "translation-table-view"
              );
              if (!translationTable) return null;

              const rect = translationTable.getBoundingClientRect();
              return (
                <div
                  className="fixed z-40 pointer-events-none"
                  style={{
                    top: rect.top + 80, // 125px from top of table (slightly below textarea)
                    left: rect.left + rect.width - 80, // Right side of table - button width
                    width: 70, // Fixed width for action buttons
                    height: 40, // Estimated height for action buttons
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
                    borderRadius: "8px",
                    border: "3px solid #3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                  }}
                />
              );
            })()}
          {/* Floating Toolbar - estimated position */}
          {currentStep.id === "floating-toolbar" &&
            (() => {
              // Use viewport dimensions to position the floating toolbar highlight
              const viewportWidth = window.innerWidth;
              const viewportHeight = window.innerHeight;
              return (
                <div
                  className="fixed z-40 pointer-events-none"
                  style={{
                    top: 80, // Fixed position from top
                    right: 16, // Fixed position from right
                    width: 60, // Estimated width for the toolbar
                    height: 300, // Estimated height for the toolbar
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
                    borderRadius: "8px",
                    border: "3px solid #3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                  }}
                />
              );
            })()}
        </>
      )}

      {/* Tour modal */}
      <div
        className={`fixed bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 transition-all duration-300 z-50
          ${isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
        style={{
          ...(currentStep.position === "center" && {
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }),
          ...(currentStep.position !== "center" &&
            getModalPosition(currentStep.position || "center", targetElement)),
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-500">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {currentStep.title}
          </h3>
          <p className="text-gray-600 leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t bg-gray-50 rounded-b-lg">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSkip}>
              Skip Tour
            </Button>
            <Button
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLastStep ? "Finish" : "Next"}
              {!isLastStep && <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
