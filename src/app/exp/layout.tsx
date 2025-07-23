'use client';

import React, { useEffect } from 'react';
import { useTranslationStore } from '@/lib/store/TranslationStore';

export default function ExpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initializeSampleData, projects } = useTranslationStore();
  
  useEffect(() => {
    // Initialize sample data if no projects exist
    if (projects.length === 0) {
      console.log('No projects found, initializing sample data...');
      initializeSampleData();
    } else {
      console.log('Found existing projects:', projects.length);
    }
  }, [projects.length, initializeSampleData]);
  
  useEffect(() => {
    // Load data from localStorage on app startup
    const { loadFromStorage, resumeProcessing } = useTranslationStore.getState();
    loadFromStorage();
    resumeProcessing();
    console.log('App loaded, data loaded from localStorage');
  }, []);
  
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
} 