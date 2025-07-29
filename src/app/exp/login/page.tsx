'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, ArrowRight, Building2, Languages } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { teamMembers, setCurrentUser } = useTranslationStore();

  const handleUserLogin = (user: any) => {
    setCurrentUser(user);
    
    // Redirect based on role
    if (user.role === 'project-manager') {
      router.push('/exp/project-manager');
    } else if (user.role === 'translator') {
      router.push('/exp/translator');
    }
  };

  const projectManagers = teamMembers.filter(user => user.role === 'project-manager');
  const translators = teamMembers.filter(user => user.role === 'translator');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-2">
            Translation Management System
          </h1>
          <p className="text-gray-600">Select a user to continue</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Project Managers */}
          <Card className="border-blue-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Building2 className="h-5 w-5 text-blue-600" />
                Project Managers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {projectManagers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-4 p-4 border border-blue-100 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200 cursor-pointer"
                    onClick={() => handleUserLogin(user)}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{user.name}</h3>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <Badge variant="secondary" className="mt-1 bg-blue-100 text-blue-700">
                        Project Manager
                      </Badge>
                    </div>
                    
                    <ArrowRight className="h-5 w-5 text-blue-600" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Translators */}
          <Card className="border-green-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-white border-b border-green-100">
              <CardTitle className="flex items-center gap-2 text-green-900">
                <Languages className="h-5 w-5 text-green-600" />
                Translators
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {translators.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-4 p-4 border border-green-100 rounded-lg hover:border-green-300 hover:bg-green-50/50 transition-all duration-200 cursor-pointer"
                    onClick={() => handleUserLogin(user)}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="bg-green-100 text-green-700">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{user.name}</h3>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <Badge variant="secondary" className="mt-1 bg-green-100 text-green-700">
                        Translator
                      </Badge>
                    </div>
                    
                    <ArrowRight className="h-5 w-5 text-green-600" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Select any user to test the system with different roles and permissions
          </p>
        </div>
      </div>
    </div>
  );
} 