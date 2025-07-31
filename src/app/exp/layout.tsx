'use client';

import React, { useEffect } from 'react';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { GlobalNotificationProvider } from '@/components/translation/GlobalNotificationProvider';

export default function ExpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initializeSampleData, projects, teamMembers, dataLoaded, loadFromStorage, resumeProcessing } = useTranslationStore();
  
  useEffect(() => {
    // Load data from localStorage on app startup first
    loadFromStorage();
    
    // Resume any stuck OCR processing after a short delay
    setTimeout(() => {
      resumeProcessing();
    }, 500);
    
    console.log('App loaded, data loaded from localStorage');
  }, [loadFromStorage, resumeProcessing]);
  
  useEffect(() => {
    // Only initialize sample data after we've loaded from storage and found no data
    if (dataLoaded && projects.length === 0 && teamMembers.length === 0) {
      console.log('No existing data found after loading from storage, initializing sample data...');
      initializeSampleData();
    } else if (dataLoaded) {
      console.log('Found existing data - Projects:', projects.length, 'Team Members:', teamMembers.length);
    }
  }, [dataLoaded, projects.length, teamMembers.length, initializeSampleData]);
  
  return (
    <GlobalNotificationProvider>
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </GlobalNotificationProvider>
  );
} 