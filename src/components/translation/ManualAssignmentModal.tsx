'use client';

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { CheckCircle, FileText, AlertTriangle, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { Project, TeamMember, UserRole } from '@/types/translation';
import { cn } from '@/lib/utils';

interface ManualAssignmentModalProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualAssignmentModal({ project, open, onOpenChange }: ManualAssignmentModalProps) {
  const { updateProject, teamMembers, userRoles, projects } = useTranslationStore();
  const [selectedTranslatorId, setSelectedTranslatorId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Get all translators from teamMembers only (no more userRoles duplication)
  const allTranslators = teamMembers.filter(m => m.role === 'translator');

  // Calculate workload for each translator
  const translatorsWithWorkload = allTranslators.map(translator => {
    const activeProjects = projects.filter(p => 
      p.assignedTranslator === translator.id && 
      !['completed', 'cancelled'].includes(p.status)
    );

    const workloadStatus = activeProjects.length >= 3 ? 'busy' : 
                          activeProjects.length >= 2 ? 'moderate' : 'light';

    return {
      ...translator,
      activeProjects: activeProjects.length,
      workloadStatus,
      canHandleLanguage: !translator.specialtyLanguages?.length || 
        translator.specialtyLanguages.includes(project.detectedSourceLanguage || '') ||
        project.targetLanguages.some(lang => translator.specialtyLanguages?.includes(lang))
    };
  });

  const handleAssign = async () => {
    if (!selectedTranslatorId) {
      toast.error('Please select a translator');
      return;
    }

    setIsAssigning(true);
    
    try {
      const selectedTranslator = translatorsWithWorkload.find(t => t.id === selectedTranslatorId);
      
      updateProject(project.id, {
        status: 'assigned',
        actionType: undefined,
        assignedTranslator: selectedTranslatorId,
        translatorAssignedAt: new Date().toISOString(),
        assignmentReason: undefined, // Clear the reason since it's now assigned
      });
      
      toast.success(`Project ${project.qCode} has been assigned to ${selectedTranslator?.name}!`);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to assign translator');
    } finally {
      setIsAssigning(false);
    }
  };

  const getWorkloadBadgeColor = (status: string) => {
    switch (status) {
      case 'light': return 'bg-green-100 text-green-800';
      case 'moderate': return 'bg-yellow-100 text-yellow-800';
      case 'busy': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Manual Translator Assignment
          </DialogTitle>
          <DialogDescription>
            Select a translator for this project. Auto-assignment failed: {project.assignmentReason}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Project Info Card */}
          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{project.qCode}</CardTitle>
                  <CardDescription>{project.clientName}</CardDescription>
                </div>
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Manual Assignment Required
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Source:</span>
                <span>{project.detectedSourceLanguage || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Target:</span>
                <span>{project.targetLanguages.join(', ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Deadline:</span>
                <span>{new Date(project.deadline).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Pages:</span>
                <span>{project.document.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Assignment Reason */}
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Assignment Issue:</span>
            </div>
            <p className="text-sm text-orange-700 mt-1">{project.assignmentReason}</p>
          </div>
          
          {/* Translator Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Translator</CardTitle>
              <CardDescription>
                Choose a translator to assign to this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Select value={selectedTranslatorId} onValueChange={setSelectedTranslatorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a translator" />
                  </SelectTrigger>
                  <SelectContent>
                    {translatorsWithWorkload.map(translator => (
                      <SelectItem key={translator.id} value={translator.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{translator.name}</span>
                          <div className="flex items-center gap-2 ml-4">
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", getWorkloadBadgeColor(translator.workloadStatus))}
                            >
                              {translator.activeProjects} active
                            </Badge>
                            {!translator.canHandleLanguage && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                                No lang match
                              </Badge>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Translator Details */}
                {selectedTranslatorId && (
                  <div className="mt-4">
                    {(() => {
                      const selected = translatorsWithWorkload.find(t => t.id === selectedTranslatorId);
                      if (!selected) return null;
                      
                      return (
                        <Card className="bg-gray-50">
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                                {selected.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium">{selected.name}</p>
                                <p className="text-sm text-gray-600">{selected.email}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Current Workload:</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant="outline" 
                                    className={getWorkloadBadgeColor(selected.workloadStatus)}
                                  >
                                    {selected.activeProjects} active projects
                                  </Badge>
                                </div>
                              </div>
                              <div>
                                <span className="font-medium">Language Match:</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant="outline" 
                                    className={selected.canHandleLanguage ? 
                                      "text-green-600 border-green-600" : 
                                      "text-amber-600 border-amber-600"
                                    }
                                  >
                                    {selected.canHandleLanguage ? 'Compatible' : 'No specialty match'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAssigning}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={isAssigning || !selectedTranslatorId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isAssigning ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Assign Translator
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 