"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  ReactNode,
} from "react";
import { TextField } from "../types";

interface TextFormatContextType {
  // Drawer state
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;

  // Selected element
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;

  // Current format
  currentFormat: TextField | null;
  setCurrentFormat: (format: TextField | null) => void;

  // Format change handler
  onFormatChange: (format: Partial<TextField>) => void;
  setOnFormatChange: (handler: (format: Partial<TextField>) => void) => void;

  // Padding popup state for visual indicator
  showPaddingPopup: boolean;
  setShowPaddingPopup: (show: boolean) => void;
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null
  );
  const [currentFormat, setCurrentFormat] = useState<TextField | null>(null);
  const [showPaddingPopup, setShowPaddingPopup] = useState(false);

  // Use ref to store the format change handler to avoid useState issues
  const onFormatChangeRef = useRef<(format: Partial<TextField>) => void>(
    (format: Partial<TextField>) => {
      console.log("Default onFormatChange called with:", format);
    }
  );

  const setOnFormatChange = (handler: (format: Partial<TextField>) => void) => {
    onFormatChangeRef.current = handler;
  };

  const onFormatChange = (format: Partial<TextField>) => {
    if (typeof onFormatChangeRef.current === "function") {
      onFormatChangeRef.current(format);
    } else {
      console.warn(
        "onFormatChange is not a function:",
        onFormatChangeRef.current
      );
    }
  };

  const value: TextFormatContextType = {
    isDrawerOpen,
    setIsDrawerOpen,
    selectedElementId,
    setSelectedElementId,
    currentFormat,
    setCurrentFormat,
    onFormatChange,
    setOnFormatChange,
    showPaddingPopup,
    setShowPaddingPopup,
  };

  return (
    <TextFormatContext.Provider value={value}>
      {children}
    </TextFormatContext.Provider>
  );
};
