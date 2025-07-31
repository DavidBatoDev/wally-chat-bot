'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Sidebar } from '@/components/translation/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Clock, 
  Star, 
  Activity, 
  Languages,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
  Crown,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import type { TeamMember, UserRole, UserRoleType } from '@/types/translation';
import { InAppMessaging } from '@/components/messaging/InAppMessaging';
import { FloatingMessageButton } from '@/components/messaging/FloatingMessageButton';
import { useMessagingStore } from '@/lib/store/MessagingStore';

// Unified member type for display
type DisplayMember = TeamMember | (UserRole & { 
  availability?: 'available' | 'busy' | 'offline';
  languages?: string[];
  specialtyLanguages?: string[];
  availableTime?: string;
  currentProjects?: number;
  completedProjects?: number;
  score?: number;
});

export default function TeamManagementPage() {
  const router = useRouter();
  const { currentUser, userRoles, teamMembers, addTeamMember, updateTeamMember, addUserRole } = useTranslationStore();
  const { unreadCount } = useMessagingStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [editingMember, setEditingMember] = useState<DisplayMember | null>(null);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    role: 'translator' as UserRoleType,
    languages: '',
    specialtyLanguages: '',
    availableTime: '09:00-17:00',
    availability: 'available' as 'available' | 'busy' | 'offline'
  });

  useEffect(() => {
    if (userRoles.length > 0) {
      if (!currentUser) {
        router.push('/exp/login');
        return;
      }
      
      if (currentUser.role !== 'project-manager') {
        router.push('/exp/translator');
        return;
      }
      
      setIsLoading(false);
    }
  }, [currentUser, userRoles, router]);

  const handleAddMember = () => {
    console.log('handleAddMember called', newMember);
    
    if (!newMember.name || !newMember.email) {
      console.log('Validation failed - missing name or email');
      toast.error('Please fill in all required fields');
      return;
    }

    console.log('Adding member with role:', newMember.role);

    // Generate unique ID
    const memberId = `${newMember.role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${newMember.name.replace(/\s+/g, '')}`;

    // Create ONLY TeamMember (which includes all UserRole properties)
    const teamMemberData = {
      id: memberId,
      name: newMember.name,
      email: newMember.email,
      role: newMember.role,
      avatar: avatarUrl,
      languages: newMember.languages.split(',').map(l => l.trim()).filter(l => l),
      specialtyLanguages: newMember.specialtyLanguages.split(',').map(l => l.trim()).filter(l => l),
      availability: newMember.availability,
      availableTime: newMember.availableTime,
      currentProjects: 0,
      completedProjects: 0,
      score: 5.0
    };
    console.log('Adding TeamMember (includes login access):', teamMemberData);

    // Add only to TeamMembers - this will serve both purposes
    addTeamMember(teamMemberData);

    toast.success(`${newMember.name} has been added to the team and can now log in`);
    
    // Reset form
    setNewMember({
      name: '',
      email: '',
      role: 'translator',
      languages: '',
      specialtyLanguages: '',
      availableTime: '09:00-17:00',
      availability: 'available'
    });
    setShowAddMemberDialog(false);
    console.log('Member added successfully, dialog closed');
  };

  const handleUpdateMember = (member: DisplayMember) => {
    setEditingMember(member);
  };

  const saveEditingMember = () => {
    if (!editingMember) return;
    
    updateTeamMember(editingMember.id, editingMember);
    toast.success('Team member updated successfully');
    setEditingMember(null);
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAvailabilityLabel = (availability: string) => {
    switch (availability) {
      case 'available': return 'Available';
      case 'busy': return 'Busy';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  // Use only TeamMembers - they contain all necessary data for both display and login
  const allMembers = teamMembers; // No need for Map or merging since we only have TeamMembers
  
  const projectManagers = allMembers.filter(m => m.role === 'project-manager');
  const translators = allMembers.filter(m => m.role === 'translator');

  // Helper function to check if member is a TeamMember
  const isTeamMember = (member: DisplayMember): member is TeamMember => {
    return 'availability' in member && member.availability !== undefined;
  };

  // Calculate available members
  const availableMembers = [...projectManagers, ...translators].filter(m => 
    isTeamMember(m) ? m.availability === 'available' : false
  ).length;

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
              <p className="text-gray-600">Manage your translation team members and their roles</p>
            </div>
            <div className="flex gap-2">
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  console.log('Add Team Member button clicked');
                  setShowAddMemberDialog(true);
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Team Member
              </Button>
            </div>
          </div>

          {/* Team Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectManagers.length + translators.length}</div>
                <p className="text-xs text-muted-foreground">Active team members</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Project Managers</CardTitle>
                <Crown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectManagers.length}</div>
                <p className="text-xs text-muted-foreground">Managing projects</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Translators</CardTitle>
                <Languages className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{translators.length}</div>
                <p className="text-xs text-muted-foreground">Ready for assignments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{availableMembers}</div>
                <p className="text-xs text-muted-foreground">Ready to work</p>
              </CardContent>
            </Card>
          </div>

          {/* Team Members Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Members</TabsTrigger>
              <TabsTrigger value="project-managers">Project Managers</TabsTrigger>
              <TabsTrigger value="translators">Translators</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...projectManagers, ...translators].map((member) => (
                  <Card key={member.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={member.avatar} alt={member.name} />
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{member.name}</h3>
                            <p className="text-sm text-gray-600 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {member.email}
                            </p>
                            <div className="flex items-center mt-1">
                              <Badge variant={member.role === 'project-manager' ? 'default' : 'secondary'}>
                                {member.role === 'project-manager' ? 'PM' : 'Translator'}
                              </Badge>
                              {isTeamMember(member) && (
                                <div className={`ml-2 h-2 w-2 rounded-full ${getAvailabilityColor(member.availability)}`} />
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateMember(member)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {isTeamMember(member) && member.specialtyLanguages && member.specialtyLanguages.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-gray-500 mb-1">Specialty Languages:</p>
                          <div className="flex flex-wrap gap-1">
                            {member.specialtyLanguages.slice(0, 3).map((lang) => (
                              <Badge key={lang} variant="outline" className="text-xs">
                                {lang}
                              </Badge>
                            ))}
                            {member.specialtyLanguages.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{member.specialtyLanguages.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="project-managers" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectManagers.map((member) => (
                  <Card key={member.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={member.avatar} alt={member.name} />
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{member.name}</h3>
                            <p className="text-sm text-gray-600 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {member.email}
                            </p>
                            <Badge variant="default" className="mt-1">Project Manager</Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateMember(member)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="translators" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {translators.map((member) => (
                  <Card key={member.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={member.avatar} alt={member.name} />
                            <AvatarFallback className="bg-green-100 text-green-600">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{member.name}</h3>
                            <p className="text-sm text-gray-600 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {member.email}
                            </p>
                            <div className="flex items-center mt-1">
                              <Badge variant="secondary">Translator</Badge>
                              <div className={`ml-2 h-2 w-2 rounded-full ${getAvailabilityColor(member.availability)}`} />
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateMember(member)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {member.specialtyLanguages && member.specialtyLanguages.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-gray-500 mb-1">Specialty Languages:</p>
                          <div className="flex flex-wrap gap-1">
                            {member.specialtyLanguages.slice(0, 3).map((lang) => (
                              <Badge key={lang} variant="outline" className="text-xs">
                                {lang}
                              </Badge>
                            ))}
                            {member.specialtyLanguages.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{member.specialtyLanguages.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Edit Member Dialog */}
      {editingMember && (
        <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Team Member</DialogTitle>
              <DialogDescription>
                Update {editingMember.name}'s information and settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input
                    id="edit-name"
                    value={editingMember.name}
                    onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingMember.email}
                    onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                  />
                </div>
              </div>
              
              {isTeamMember(editingMember) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-availability">Availability</Label>
                    <Select 
                      value={editingMember.availability} 
                      onValueChange={(value: 'available' | 'busy' | 'offline') => 
                        setEditingMember({ ...editingMember, availability: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-languages">Languages</Label>
                    <Input
                      id="edit-languages"
                      value={editingMember.languages?.join(', ') || ''}
                      onChange={(e) => setEditingMember({ 
                        ...editingMember, 
                        languages: e.target.value.split(',').map(l => l.trim()).filter(l => l)
                      })}
                      placeholder="English, Spanish, French"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-specialty">Specialty Languages</Label>
                    <Input
                      id="edit-specialty"
                      value={editingMember.specialtyLanguages?.join(', ') || ''}
                      onChange={(e) => setEditingMember({ 
                        ...editingMember, 
                        specialtyLanguages: e.target.value.split(',').map(l => l.trim()).filter(l => l)
                      })}
                      placeholder="Spanish, Portuguese"
                    />
                  </div>
                </>
              )}
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingMember(null)}>
                  Cancel
                </Button>
                <Button onClick={saveEditingMember}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Team Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Team Member</DialogTitle>
            <DialogDescription>
              Add a new project manager or translator to your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  placeholder="john@company.com"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newMember.role} onValueChange={(value: UserRoleType) => setNewMember({ ...newMember, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project-manager">Project Manager</SelectItem>
                    <SelectItem value="translator">Translator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="availability">Availability</Label>
                <Select value={newMember.availability} onValueChange={(value: 'available' | 'busy' | 'offline') => setNewMember({ ...newMember, availability: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newMember.role === 'translator' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="languages">Languages (comma-separated)</Label>
                  <Input
                    id="languages"
                    value={newMember.languages}
                    onChange={(e) => setNewMember({ ...newMember, languages: e.target.value })}
                    placeholder="English, Spanish, French"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="specialtyLanguages">Specialty Languages (comma-separated)</Label>
                  <Input
                    id="specialtyLanguages"
                    value={newMember.specialtyLanguages}
                    onChange={(e) => setNewMember({ ...newMember, specialtyLanguages: e.target.value })}
                    placeholder="Spanish, Portuguese"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="availableTime">Available Time (UTC)</Label>
                  <Input
                    id="availableTime"
                    value={newMember.availableTime}
                    onChange={(e) => setNewMember({ ...newMember, availableTime: e.target.value })}
                    placeholder="09:00-17:00"
                  />
                </div>
              </>
            )}
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  console.log('Add Member button clicked in dialog');
                  handleAddMember();
                }}
              >
                Add Member
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* In-App Messaging */}
      <InAppMessaging isOpen={showMessaging} onClose={() => setShowMessaging(false)} />

      {/* Floating Message Button */}
      <FloatingMessageButton 
        unreadCount={unreadCount} 
        onClick={() => setShowMessaging(true)} 
      />
    </div>
  );
} 