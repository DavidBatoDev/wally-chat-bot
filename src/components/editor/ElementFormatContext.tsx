"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  ReactNode,
} from "react";
import { TextField, Shape, Image } from "../types";

type ElementType = "textbox" | "shape" | "image";

interface TextFormatContextType {
  // Drawer state
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;

  // Selected element
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;
  selectedElementType: ElementType | null;
  setSelectedElementType: (type: ElementType | null) => void;

  // Current format
  currentFormat: TextField | Shape | Image | null;
  setCurrentFormat: (format: TextField | Shape | Image | null) => void;

  // Format change handler
  onFormatChange: (
    format: Partial<TextField | Shape | Image> & { resetAspectRatio?: boolean }
  ) => void;
  setOnFormatChange: (
    handler: (
      format: Partial<TextField | Shape | Image> & {
        resetAspectRatio?: boolean;
      }
    ) => void
  ) => void;

  // Padding popup state for visual indicator
  showPaddingPopup: boolean;
  setShowPaddingPopup: (show: boolean) => void;

  // Layer ordering functions
  moveToFront: (elementId: string) => void;
  moveToBack: (elementId: string) => void;
  moveForward: (elementId: string) => void;
  moveBackward: (elementId: string) => void;
  setLayerOrderFunctions: (functions: {
    moveToFront: (elementId: string) => void;
    moveToBack: (elementId: string) => void;
    moveForward: (elementId: string) => void;
    moveBackward: (elementId: string) => void;
  }) => void;

  // Layer position helper functions
  isElementAtFront: (elementId: string) => boolean;
  isElementAtBack: (elementId: string) => boolean;
  setLayerPositionHelpers: (functions: {
    isElementAtFront: (elementId: string) => boolean;
    isElementAtBack: (elementId: string) => boolean;
  }) => void;
}

const TextFormatContext = createContext<TextFormatContextType | undefined>(
  undefined
);

export const useTextFormat = () => {
  const context = useContext(TextFormatContext);
  if (!context) {
    throw new Error("useTextFormat must be used within a TextFormatProvider");
  }
  return context;
};

interface TextFormatProviderProps {
  children: ReactNode;
}

export const TextFormatProvider: React.FC<TextFormatProviderProps> = ({
  children,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null
  );
  const [selectedElementType, setSelectedElementType] =
    useState<ElementType | null>(null);
  const [currentFormat, setCurrentFormat] = useState<
    TextField | Shape | Image | null
  >(null);
  const [showPaddingPopup, setShowPaddingPopup] = useState(false);

  // Use ref to store the format change handler to avoid useState issues
  const onFormatChangeRef = useRef<
    (format: Partial<TextField | Shape | Image>) => void
  >((format: Partial<TextField | Shape | Image>) => {
    console.log("Default onFormatChange called with:", format);
  });

  const setOnFormatChange = (
    handler: (format: Partial<TextField | Shape | Image>) => void
  ) => {
    onFormatChangeRef.current = handler;
  };

  const onFormatChange = (
    format: Partial<TextField | Shape | Image> & { resetAspectRatio?: boolean }
  ) => {
    if (typeof onFormatChangeRef.current === "function") {
      onFormatChangeRef.current(format);
    } else {
      console.warn(
        "onFormatChange is not a function:",
        onFormatChangeRef.current
      );
    }
  };

  // Use refs to store layer ordering functions
  const layerOrderFunctionsRef = useRef<{
    moveToFront: (elementId: string) => void;
    moveToBack: (elementId: string) => void;
    moveForward: (elementId: string) => void;
    moveBackward: (elementId: string) => void;
  }>({
    moveToFront: () => console.log("Default moveToFront called"),
    moveToBack: () => console.log("Default moveToBack called"),
    moveForward: () => console.log("Default moveForward called"),
    moveBackward: () => console.log("Default moveBackward called"),
  });

  const setLayerOrderFunctions = (functions: {
    moveToFront: (elementId: string) => void;
    moveToBack: (elementId: string) => void;
    moveForward: (elementId: string) => void;
    moveBackward: (elementId: string) => void;
  }) => {
    layerOrderFunctionsRef.current = functions;
  };

  const moveToFront = (elementId: string) => {
    layerOrderFunctionsRef.current.moveToFront(elementId);
  };

  const moveToBack = (elementId: string) => {
    layerOrderFunctionsRef.current.moveToBack(elementId);
  };

  const moveForward = (elementId: string) => {
    layerOrderFunctionsRef.current.moveForward(elementId);
  };

  const moveBackward = (elementId: string) => {
    layerOrderFunctionsRef.current.moveBackward(elementId);
  };

  // Use refs to store layer position helper functions
  const layerPositionHelpersRef = useRef<{
    isElementAtFront: (elementId: string) => boolean;
    isElementAtBack: (elementId: string) => boolean;
  }>({
    isElementAtFront: () => false,
    isElementAtBack: () => false,
  });

  const setLayerPositionHelpers = (functions: {
    isElementAtFront: (elementId: string) => boolean;
    isElementAtBack: (elementId: string) => boolean;
  }) => {
    layerPositionHelpersRef.current = functions;
  };

  const isElementAtFront = (elementId: string) => {
    return layerPositionHelpersRef.current.isElementAtFront(elementId);
  };

  const isElementAtBack = (elementId: string) => {
    return layerPositionHelpersRef.current.isElementAtBack(elementId);
  };

  const value: TextFormatContextType = {
    isDrawerOpen,
    setIsDrawerOpen,
    selectedElementId,
    setSelectedElementId,
    selectedElementType,
    setSelectedElementType,
    currentFormat,
    setCurrentFormat,
    onFormatChange,
    setOnFormatChange,
    showPaddingPopup,
    setShowPaddingPopup,
    moveToFront,
    moveToBack,
    moveForward,
    moveBackward,
    setLayerOrderFunctions,
    isElementAtFront,
    isElementAtBack,
    setLayerPositionHelpers,
  };

  return (
    <TextFormatContext.Provider value={value}>
      {children}
    </TextFormatContext.Provider>
  );
};
