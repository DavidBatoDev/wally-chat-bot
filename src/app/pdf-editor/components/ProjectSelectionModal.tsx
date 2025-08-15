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
import { Trash2, Download, FolderOpen, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

interface SavedProject {
  id: string;
  name: string;
  createdAt: string;
  storageKey: string;
  source?: "database" | "localStorage";
}

interface ProjectSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadProject: (projectId?: string) => Promise<boolean>;
  onSaveProject: (projectName?: string) => Promise<any>;
  onExportToJson: (projectName?: string) => any;
  onImportFromJson: (file: File) => Promise<boolean>;
  onDeleteProject: (projectId: string) => Promise<boolean>;
  getSavedProjects: () => Promise<SavedProject[]>;
}

export const ProjectSelectionModal: React.FC<ProjectSelectionModalProps> = ({
  open,
  onOpenChange,
  onLoadProject,
  onSaveProject,
  onExportToJson,
  onImportFromJson,
  onDeleteProject,
  getSavedProjects,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [exportProjectName, setExportProjectName] = useState("");
  const [activeTab, setActiveTab] = useState<
    "load" | "save" | "export" | "import"
  >("load");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Refresh projects list when modal opens
  useEffect(() => {
    if (open) {
      const loadProjects = async () => {
        try {
          const projects = await getSavedProjects();
          setSavedProjects(projects);
        } catch (error) {
          console.error("Failed to load projects:", error);
          setSavedProjects([]);
        }
      };
      loadProjects();
    }
  }, [open, getSavedProjects]);

  const handleLoadProject = async (projectId: string) => {
    try {
      // Close the modal first
      onOpenChange(false);

      // Call the onLoadProject callback to load the project internally
      const success = await onLoadProject(projectId);

      if (success) {
        // Update the URL after successful project load
        const params = new URLSearchParams(searchParams.toString());
        params.set("projectId", projectId);
        const newUrl = `/pdf-editor?${params.toString()}`;
        window.history.replaceState({}, "", newUrl);

        toast.success(`Project loaded successfully: ${projectId}`);
      } else {
        toast.error("Failed to load project");
      }
    } catch (error) {
      console.error("Failed to change project:", error);
      toast.error("Failed to change project");
    }
  };

  const handleSaveProject = async () => {
    try {
      const projectName = newProjectName.trim() || undefined;
      const result = await onSaveProject(projectName);
      if (result) {
        setNewProjectName("");
        // Refresh list
        const projects = await getSavedProjects();
        setSavedProjects(projects);
      }
    } catch (error) {
      console.error("Failed to save project:", error);
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        setSelectedFile(file);
      } else {
        toast.error("Please select a valid JSON file");
        event.target.value = "";
      }
    }
  };

  const handleImportProject = async () => {
    if (!selectedFile) {
      toast.error("Please select a JSON file to import");
      return;
    }

    try {
      const success = await onImportFromJson(selectedFile);
      if (success) {
        setSelectedFile(null);
        onOpenChange(false);
        toast.success("Project imported successfully!");
      }
    } catch (error) {
      console.error("Failed to import project:", error);
      toast.error("Failed to import project");
    }
  };

  const handleDeleteProject = async (
    projectId: string,
    projectName: string
  ) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${projectName}"? This action cannot be undone.`
      )
    ) {
      try {
        const success = await onDeleteProject(projectId);
        if (success) {
          // Refresh list
          const projects = await getSavedProjects();
          setSavedProjects(projects);
        }
      } catch (error) {
        console.error("Failed to delete project:", error);
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
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === "import"
                ? "border-b-2 border-primary text-primary"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setActiveTab("import")}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Import JSON
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

          {/* Import JSON Tab */}
          {activeTab === "import" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Import Project from JSON
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select JSON File
                  </label>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileSelect}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {selectedFile && (
                    <div className="mt-2 p-2 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-700">
                        Selected:{" "}
                        <span className="font-medium">{selectedFile.name}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Size: {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  )}
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-2">
                    Import will restore:
                  </h4>
                  <ul className="text-sm text-orange-800 space-y-1">
                    <li>• All pages and document settings</li>
                    <li>• Original and translated text boxes</li>
                    <li>• Shapes, images, and deletion rectangles</li>
                    <li>• Layer ordering and element positioning</li>
                    <li>• Workflow step and view settings</li>
                    <li>• Language settings (source and target)</li>
                    <li>• Editor state and preferences</li>
                  </ul>
                  <div className="mt-2 p-2 bg-orange-100 rounded text-xs text-orange-700">
                    <strong>Warning:</strong> This will replace your current
                    project state.
                  </div>
                </div>
                <Button
                  onClick={handleImportProject}
                  className="w-full"
                  disabled={!selectedFile}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Project
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
