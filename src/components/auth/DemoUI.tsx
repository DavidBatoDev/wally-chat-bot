import { useState, useEffect } from "react";
import NBIIDMockup from "@/assets/images/nbi-id-mockup.png";

// Animation states for the demo sequence
export const DEMO_STATES = {
  CHAT: "chat",
  UPLOAD: "upload",
  SCANNING: "scanning",
  ID_CARD: "id_card",
};

export default function DemoUI() {
  const [demoState, setDemoState] = useState(DEMO_STATES.CHAT);

  // Control the animation sequence
  useEffect(() => {
    const interval = setInterval(() => {
      setDemoState((current) => {
        switch (current) {
          case DEMO_STATES.CHAT:
            return DEMO_STATES.UPLOAD;
          case DEMO_STATES.UPLOAD:
            return DEMO_STATES.SCANNING;
          case DEMO_STATES.SCANNING:
            return DEMO_STATES.ID_CARD;
          case DEMO_STATES.ID_CARD:
            return DEMO_STATES.CHAT;
          default:
            return DEMO_STATES.CHAT;
        }
      });
    }, 3000); // Change state every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col justify-center p-6">
      <div className="max-w-lg mx-auto w-full">
        {/* Wally Chat Component */}
        {demoState === DEMO_STATES.CHAT && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-wally flex items-center justify-center shadow-md">
                  <span className="text-white text-sm font-bold">W</span>
                </div>
              </div>
              <div className="flex-1 bg-white rounded-lg p-3 shadow-sm">
                <p className="text-gray-700 text-sm">
                  Welcome to Wally! I'm your AI document assistant that can
                  translate, process, and extract information from your
                  documents instantly.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-1 bg-wally-dark rounded-lg p-3 shadow-sm">
                <p className="text-white text-sm">
                  Can you help me translate my ID card from Spanish to English?
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center shadow-md">
                  <span className="text-gray-600 text-sm font-bold">U</span>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-wally flex items-center justify-center shadow-md">
                  <span className="text-white text-sm font-bold">W</span>
                </div>
              </div>
              <div className="flex-1 bg-white rounded-lg p-3 shadow-sm">
                <p className="text-gray-700 text-sm">
                  Absolutely! Just upload your ID card and I'll translate it for
                  you. Let me show you how it works.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Document UI */}
        {demoState === DEMO_STATES.UPLOAD && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-wally flex items-center justify-center shadow-md">
                  <span className="text-white text-sm font-bold">W</span>
                </div>
              </div>
              <div className="flex-1 bg-white rounded-lg p-3 shadow-sm">
                <p className="text-gray-700 text-sm">
                  Please upload your document now.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 animate-fade-in">
              <div className="flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-wally-50 flex items-center justify-center mb-4">
                  <svg
                    className="h-8 w-8 text-wally"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  Upload your ID document
                </h3>
                <p className="text-sm text-gray-500 text-center mb-4">
                  Drag and drop your file here, or click to browse
                </p>
                <button className="px-4 py-2 bg-wally text-white rounded-md hover:bg-wally-dark focus:outline-none focus:ring-2 focus:ring-wally focus:ring-offset-2 transition-colors animate-pulse">
                  Select Document
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Supported formats: JPG, PNG, PDF (max 10MB)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scanning Document UI */}
        {demoState === DEMO_STATES.SCANNING && (
          <div className="bg-white rounded-lg shadow-lg p-3 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900">
                Document Processing
              </h3>
              <span className="px-2 py-0.5 text-xs font-medium text-white bg-wally rounded-full">
                Scanning...
              </span>
            </div>
            <div className="relative aspect-[1.6/1] bg-gray-50 rounded-md overflow-hidden">
              <div className="absolute inset-0">
                <div className="h-full w-full flex items-center justify-center">
                  <div className="animate-pulse bg-white/80 absolute inset-0 z-10"></div>
                  <img
                    className="object-cover w-full h-full"
                    src={NBIIDMockup.src}
                    alt="ID Card Scan"
                  />
                  <div className="absolute inset-0 border-2 border-wally animate-scan"></div>
                </div>
              </div>
              <div className="absolute bottom-3 left-3 right-3 z-20">
                <div className="flex items-center space-x-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded-full">
                  <svg
                    className="h-3 w-3 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>Analyzing document structure...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ID Card with Detection Boxes */}
        {demoState === DEMO_STATES.ID_CARD && (
          <div className="bg-white rounded-lg shadow-lg p-3 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900">
                ID Card Translation
              </h3>
              <span className="px-2 py-0.5 text-xs font-medium text-white bg-green-500 rounded-full">
                Fields Detected
              </span>
            </div>
            <div className="relative aspect-[1.6/1] bg-gray-50 rounded-md overflow-hidden">
              <div className="absolute inset-0">
                <img
                  className="object-cover w-full h-full"
                  src={NBIIDMockup.src}
                  alt="ID Card Scan"
                />
              </div>
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center justify-center space-x-2 text-xs text-white bg-wally/90 px-3 py-1 rounded-full">
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span>All fields detected and ready for translation</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
