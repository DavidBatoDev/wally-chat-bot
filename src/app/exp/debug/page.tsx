'use client';

import React from 'react';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DebugPage() {
  const store = useTranslationStore();
  
  const handleClearStorage = () => {
    store.clearAllData();
    window.location.reload();
  };
  
  const handleInitSampleData = () => {
    store.initializeSampleData();
    window.location.reload();
  };
  
  const handleDebugStorage = () => {
    store.debugStorage();
  };
  
  const handleTestPersistence = () => {
    // Test manual save
    const testData = {
      projects: [{ id: 'test', qCode: 'TEST123', clientName: 'Test Client' }],
      teamMembers: [],
      userRoles: [],
      currentUser: null,
      notifications: [],
      processingState: { activeProcessing: [], processingProgress: {} },
      selectedProject: null,
    };
    localStorage.setItem('translation-storage', JSON.stringify(testData));
    console.log('Manually saved test data to localStorage');
    
    // Test manual load
    const loaded = localStorage.getItem('translation-storage');
    console.log('Manually loaded from localStorage:', loaded);
  };
  
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Debug - LocalStorage State</h1>
      
      <div className="space-x-4">
        <Button onClick={handleClearStorage} variant="destructive">
          Clear All Data
        </Button>
        <Button onClick={handleInitSampleData}>
          Initialize Sample Data
        </Button>
        <Button onClick={handleDebugStorage} variant="outline">
          Debug Storage
        </Button>
        <Button onClick={handleTestPersistence} variant="outline">
          Test Persistence
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Current User</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(store.currentUser, null, 2)}
          </pre>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Projects ({store.projects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto max-h-96">
            {JSON.stringify(store.projects, null, 2)}
          </pre>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Team Members ({store.teamMembers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto max-h-96">
            {JSON.stringify(store.teamMembers, null, 2)}
          </pre>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Notifications ({store.notifications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto max-h-96">
            {JSON.stringify(store.notifications, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
} 