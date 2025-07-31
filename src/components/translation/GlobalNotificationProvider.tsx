'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { EnhancedNotifications } from './EnhancedNotifications';

interface GlobalNotificationContextType {
  isOpen: boolean;
  openNotifications: () => void;
  closeNotifications: () => void;
  toggleNotifications: () => void;
}

const GlobalNotificationContext = createContext<GlobalNotificationContextType | undefined>(undefined);

export function useGlobalNotifications() {
  const context = useContext(GlobalNotificationContext);
  if (context === undefined) {
    throw new Error('useGlobalNotifications must be used within a GlobalNotificationProvider');
  }
  return context;
}

interface GlobalNotificationProviderProps {
  children: ReactNode;
}

export function GlobalNotificationProvider({ children }: GlobalNotificationProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openNotifications = () => setIsOpen(true);
  const closeNotifications = () => setIsOpen(false);
  const toggleNotifications = () => setIsOpen(!isOpen);

  const value = {
    isOpen,
    openNotifications,
    closeNotifications,
    toggleNotifications,
  };

  return (
    <GlobalNotificationContext.Provider value={value}>
      {children}
      <EnhancedNotifications 
        isOpen={isOpen} 
        onClose={closeNotifications}
      />
    </GlobalNotificationContext.Provider>
  );
} 