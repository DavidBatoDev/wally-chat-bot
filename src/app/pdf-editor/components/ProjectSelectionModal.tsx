import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Download, FolderOpen, Plus } from "lucide-react";
import { toast } from "sonner";

interface SavedProject {
  id: string;
  name: string;
  createdAt: string;
  storageKey: string;
}

interface ProjectSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadProject: (projectId: string) => boolean;
  onSaveProject: (projectName?: string) => any;
  onExportToJson: (projectName?: string) => any;
  onDeleteProject: (projectId: string) => boolean;
  getSavedProjects: () => SavedProject[];
}

export const ProjectSelectionModal: React.FC<ProjectSelectionModalProps> = ({
  open,
  onOpenChange,
  onLoadProject,
  onSaveProject,
  onExportToJson,
  onDeleteProject,
  getSavedProjects,
}) => {
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [exportProjectName, setExportProjectName] = useState("");
  const [activeTab, setActiveTab] = useState<"load" | "save" | "export">(
    "load"
  );

  // Refresh projects list when modal opens
  useEffect(() => {
    if (open) {
      setSavedProjects(getSavedProjects());
    }
  }, [open, getSavedProjects]);

  const handleLoadProject = (projectId: string) => {
    const success = onLoadProject(projectId);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleSaveProject = () => {
    const projectName = newProjectName.trim() || undefined;
    const result = onSaveProject(projectName);
    if (result) {
      setNewProjectName("");
      setSavedProjects(getSavedProjects()); // Refresh list
      toast.success("Project saved successfully!");
    }
  };

  const handleExportProject = () => {
    const projectName = exportProjectName.trim() || undefined;
    const result = onExportToJson(projectName);
    if (result) {
      setExportProjectName("");
      toast.success("Project exported successfully!");
    }
  };

  const handleDeleteProject = (projectId: string, projectName: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${projectName}"? This action cannot be undone.`
      )
    ) {
      const success = onDeleteProject(projectId);
      if (success) {
        setSavedProjects(getSavedProjects()); // Refresh list
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Project Management</DialogTitle>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === "load"
                ? "border-b-2 border-primary text-primary"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setActiveTab("load")}
          >
            <FolderOpen className="w-4 h-4 inline mr-2" />
            Load Project
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === "save"
                ? "border-b-2 border-primary text-primary"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setActiveTab("save")}
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Save Project
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === "export"
                ? "border-b-2 border-primary text-primary"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setActiveTab("export")}
          >
            <Download className="w-4 h-4 inline mr-2" />
            Export JSON
          </button>
        </div>

        <div className="mt-4">
          {/* Load Project Tab */}
          {activeTab === "load" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Load Saved Project</h3>
              {savedProjects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No saved projects found</p>
                  <p className="text-sm">
                    Create your first project by saving your current work
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {savedProjects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <h4 className="font-medium">{project.name}</h4>
                          <p className="text-sm text-gray-500">
                            Created: {formatDate(project.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleLoadProject(project.id)}
                          >
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleDeleteProject(project.id, project.name)
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Save Project Tab */}
          {activeTab === "save" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Save Current Project
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Project Name (optional)
                  </label>
                  <Input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name or leave empty for auto-generated name"
                    className="w-full"
                  />
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">
                    What will be saved:
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• All pages and document settings</li>
                    <li>• Original and translated text boxes</li>
                    <li>• Shapes, images, and deletion rectangles</li>
                    <li>• Layer ordering and element positioning</li>
                    <li>• Workflow step and view settings</li>
                    <li>• Language settings (source and target)</li>
                    <li>• Editor state and preferences</li>
                  </ul>
                </div>
                <Button onClick={handleSaveProject} className="w-full">
                  Save Project
                </Button>
              </div>
            </div>
          )}

          {/* Export JSON Tab */}
          {activeTab === "export" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Export Project as JSON
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Export Name (optional)
                  </label>
                  <Input
                    value={exportProjectName}
                    onChange={(e) => setExportProjectName(e.target.value)}
                    placeholder="Enter export name or leave empty for auto-generated name"
                    className="w-full"
                  />
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">
                    Export includes:
                  </h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Complete project state as JSON file</li>
                    <li>• All elements, pages, and workflow data</li>
                    <li>• Suitable for backup or sharing</li>
                    <li>• Can be imported into other instances</li>
                  </ul>
                </div>
                <Button onClick={handleExportProject} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Export as JSON
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
