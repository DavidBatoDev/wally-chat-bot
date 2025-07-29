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
  const { currentUser } = useTranslationStore();
  
  // Redirect to login if no user is selected
  React.useEffect(() => {
    if (!currentUser) {
      router.push('/exp/login');
    }
  }, [currentUser, router]);
  
  // If user is logged in, redirect to their dashboard
  React.useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'project-manager') {
        router.push('/exp/project-manager');
      } else if (currentUser.role === 'translator') {
        router.push('/exp/translator');
      }
    }
  }, [currentUser, router]);
  
  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
  
 