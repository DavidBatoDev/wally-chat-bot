'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { 
  LayoutDashboard, 
  Languages, 
  CheckCircle, 
  ArrowRight,
  Users,
  FileText,
  TrendingUp
} from 'lucide-react';

export default function ExpPage() {
  const router = useRouter();
  const { userRoles, setCurrentUser } = useTranslationStore();
  
  const roles = [
    {
      role: 'project-manager',
      title: 'Project Manager',
      description: 'Upload projects, manage workflow, and oversee team assignments',
      icon: '👨‍💼',
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      role: 'translator',
      title: 'Translator',
      description: 'Translate and proofread assigned projects',
      icon: '🌐',
      color: 'bg-green-500 hover:bg-green-600',
    },
  ];
  
  const handleRoleSelect = (roleType: string) => {
    const user = userRoles.find(u => u.role === roleType);
    if (user) {
      setCurrentUser(user);
      router.push(`/exp/${roleType}`);
    }
  };
  
  return (
    <div className="container mx-auto py-12 px-4 max-w-6xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Translation Management System</h1>
        <p className="text-xl text-muted-foreground">
          Select your role to access the platform
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {roles.map((option) => {
          return (
            <Card 
              key={option.role} 
              className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              onClick={() => handleRoleSelect(option.role)}
            >
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${option.color} flex items-center justify-center mb-4`}>
                  <span className="text-2xl">{option.icon}</span>
                </div>
                <CardTitle>{option.title}</CardTitle>
                <CardDescription>{option.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-4">
                  {/* Removed features as they are no longer applicable */}
                </ul>
                <Button className="w-full" variant="outline">
                  Enter as {option.title}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-2xl font-bold">12</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-2xl font-bold">8</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Languages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-muted-foreground" />
              <p className="text-2xl font-bold">15</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-2xl font-bold">95%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 