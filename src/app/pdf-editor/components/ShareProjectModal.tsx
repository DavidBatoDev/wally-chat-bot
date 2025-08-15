import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Copy,
  Globe,
  Lock,
  Link2,
  UserPlus,
  Mail,
  Check,
  Loader2,
  Eye,
  Edit,
  Shield,
  Users,
} from "lucide-react";

export interface ShareSettings {
  isPublic: boolean;
  shareLink: string;
  shareId?: string;
  permissions: "viewer" | "editor";
  expiresAt?: Date;
  requiresAuth?: boolean;
}

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName: string;
  currentShareSettings?: ShareSettings;
  onUpdateShareSettings: (settings: ShareSettings) => Promise<void>;
}

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  currentShareSettings,
  onUpdateShareSettings,
}) => {
  const [isPublic, setIsPublic] = useState(currentShareSettings?.isPublic || false);
  const [permissions, setPermissions] = useState<"viewer" | "editor">(
    currentShareSettings?.permissions || "viewer"
  );
  const [requiresAuth, setRequiresAuth] = useState(
    currentShareSettings?.requiresAuth || false
  );
  const [shareLink, setShareLink] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitedUsers, setInvitedUsers] = useState<
    Array<{ email: string; role: "viewer" | "editor"; addedAt: Date }>
  >([]);

  // Generate share link (public link using projectId query param)
  useEffect(() => {
    if (projectId && isPublic) {
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/pdf-editor?projectId=${projectId}`;
      setShareLink(link);
    } else {
      setShareLink("");
    }
  }, [projectId, isPublic]);

  // Generate a unique share ID
  const generateShareId = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };

  // Handle copying share link
  const handleCopyLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setIsCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  // Handle public/private toggle
  const handlePublicToggle = async (checked: boolean) => {
    setIsLoading(true);
    try {
      const newSettings: ShareSettings = {
        isPublic: checked,
        shareLink: checked ? shareLink : "",
        shareId: undefined,
        permissions,
        requiresAuth,
      };

      await onUpdateShareSettings(newSettings);
      setIsPublic(checked);
      
      if (checked) {
        toast.success("Project is now publicly accessible via link");
      } else {
        toast.success("Project is now private");
      }
    } catch (error) {
      toast.error("Failed to update sharing settings");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle permission change
  const handlePermissionChange = async (value: "viewer" | "editor") => {
    setIsLoading(true);
    try {
      const newSettings: ShareSettings = {
        isPublic,
        shareLink,
        shareId: currentShareSettings?.shareId,
        permissions: value,
        requiresAuth,
      };

      await onUpdateShareSettings(newSettings);
      setPermissions(value);
      toast.success(`Default permission updated to ${value}`);
    } catch (error) {
      toast.error("Failed to update permissions");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle authentication requirement toggle
  const handleAuthToggle = async (checked: boolean) => {
    setIsLoading(true);
    try {
      const newSettings: ShareSettings = {
        isPublic,
        shareLink,
        shareId: currentShareSettings?.shareId,
        permissions,
        requiresAuth: checked,
      };

      await onUpdateShareSettings(newSettings);
      setRequiresAuth(checked);
      toast.success(
        checked
          ? "Authentication is now required to access"
          : "Anyone with the link can access"
      );
    } catch (error) {
      toast.error("Failed to update authentication settings");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle email invitation (placeholder - needs backend implementation)
  const handleInviteUser = () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Add to invited users list (local state only for now)
    setInvitedUsers([
      ...invitedUsers,
      {
        email: inviteEmail,
        role: permissions,
        addedAt: new Date(),
      },
    ]);

    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteEmail("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Link2 className="w-5 h-5" />
            <span>Share "{projectName}"</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General Access</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-6">
            {/* Public/Private Toggle */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">General Access</Label>
                  <p className="text-sm text-gray-600">
                    {isPublic
                      ? "Anyone with the link can access this project"
                      : "Only specific people can access this project"}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {isPublic ? (
                    <Globe className="w-4 h-4 text-green-600" />
                  ) : (
                    <Lock className="w-4 h-4 text-gray-600" />
                  )}
                  <Checkbox
                    checked={isPublic}
                    onCheckedChange={handlePublicToggle}
                    disabled={isLoading || !projectId}
                  />
                </div>
              </div>

              {/* Share Link Section */}
              {isPublic && shareLink && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <Label>Share Link</Label>
                  <div className="flex space-x-2">
                    <Input
                      value={shareLink}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      onClick={handleCopyLink}
                      variant="outline"
                      className="shrink-0"
                      disabled={isLoading}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Permission Settings */}
              {isPublic && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Default Permission</Label>
                      <p className="text-sm text-gray-600">
                        What can people do with this shared project?
                      </p>
                    </div>
                    <Select
                      value={permissions}
                      onValueChange={handlePermissionChange}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">
                          <div className="flex items-center space-x-2">
                            <Eye className="w-4 h-4" />
                            <span>Viewer</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="editor">
                          <div className="flex items-center space-x-2">
                            <Edit className="w-4 h-4" />
                            <span>Editor</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Require Authentication</Label>
                      <p className="text-sm text-gray-600">
                        Users must sign in to access the project
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-gray-600" />
                      <Checkbox
                        checked={requiresAuth}
                        onCheckedChange={handleAuthToggle}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="people" className="space-y-6 mt-6">
            {/* Invite People Section */}
            <div className="space-y-4">
              <Label>Invite People</Label>
              <div className="flex space-x-2">
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleInviteUser()}
                />
                <Button onClick={handleInviteUser} disabled={isLoading}>
                  <Mail className="w-4 h-4 mr-2" />
                  Invite
                </Button>
              </div>
            </div>

            {/* Invited Users List */}
            {invitedUsers.length > 0 && (
              <div className="space-y-2">
                <Label>People with Access</Label>
                <div className="border rounded-lg divide-y">
                  {invitedUsers.map((user, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.email}</p>
                          <p className="text-xs text-gray-500">
                            Added {user.addedAt.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 capitalize">
                          {user.role}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setInvitedUsers(
                              invitedUsers.filter((_, i) => i !== index)
                            );
                            toast.success("Access removed");
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};