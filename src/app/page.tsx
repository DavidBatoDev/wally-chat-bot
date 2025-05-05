"use client";
import React, { useState } from 'react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import ChatContainer from '../components/chat/ChatContainer';
import DocumentCanvas from '../components/document/DocumentCanvas';

const Page = () => {
  const [documentActive, setDocumentActive] = useState(false);
  
  const handleDocumentStateChange = (isActive: boolean) => {
    setDocumentActive(isActive);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <div className="flex flex-1 overflow-hidden">
          {/* Left side: Chat Section */}
          <div className={`${documentActive ? 'w-full md:w-2/5 lg:w-1/3' : 'w-full'} border-r border-gray-100 overflow-hidden transition-all duration-300`}>
            <ChatContainer onDocumentStateChange={handleDocumentStateChange} />
          </div>
          
          {/* Right side: Document Canvas - only visible when documentActive is true */}
          {documentActive && (
            <div className="hidden md:block md:w-3/5 lg:w-2/3 overflow-hidden">
              <DocumentCanvas />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Page;
