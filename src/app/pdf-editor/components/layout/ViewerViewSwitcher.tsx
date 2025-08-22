import React from "react";
import { Button } from "@/components/ui/button";
import { Eye, Split, FileText } from "lucide-react";
import { ViewMode } from "../../types/pdf-editor.types";

interface ViewerViewSwitcherProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export const ViewerViewSwitcher: React.FC<ViewerViewSwitcherProps> = ({
  currentView,
  onViewChange,
}) => {
  return (
    <div className="absolute z-50 flex flex-col space-y-2 floating-toolbar transition-all duration-300" style={{ right: `${8}px`, top: `${140}px` }}>
      <div className="bg-white rounded-lg shadow-lg border border-yellow-200 p-2 flex flex-col space-y-1 backdrop-blur-sm bg-white/95">
        <div className="text-xs font-medium text-yellow-800 mb-2 px-2">
          View Mode
        </div>
        
        <Button
          onClick={() => onViewChange("original")}
          variant={currentView === "original" ? "default" : "ghost"}
          size="sm"
          className={`justify-start ${
            currentView === "original"
              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
              : "text-gray-700 hover:text-yellow-800 hover:bg-yellow-50"
          }`}
        >
          <FileText className="w-4 h-4 mr-2" />
          Original
        </Button>

        <Button
          onClick={() => onViewChange("translated")}
          variant={currentView === "translated" ? "default" : "ghost"}
          size="sm"
          className={`justify-start ${
            currentView === "translated"
              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
              : "text-gray-700 hover:text-yellow-800 hover:bg-yellow-50"
          }`}
        >
          <Eye className="w-4 h-4 mr-2" />
          Translated
        </Button>

        <Button
          onClick={() => onViewChange("split")}
          variant={currentView === "split" ? "default" : "ghost"}
          size="sm"
          className={`justify-start ${
            currentView === "split"
              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
              : "text-gray-700 hover:text-yellow-800 hover:bg-yellow-50"
          }`}
        >
          <Split className="w-4 h-4 mr-2" />
          Split View
        </Button>
      </div>
    </div>
  );
};