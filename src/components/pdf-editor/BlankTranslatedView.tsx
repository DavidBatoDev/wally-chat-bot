import React from 'react';

interface BlankTranslatedViewProps {
  currentPage: number;
  numPages: number;
  isPageTranslated: boolean;
  isTransforming: boolean;
  isTranslating: boolean;
  onRunOcr: () => void;
}

const BlankTranslatedView: React.FC<BlankTranslatedViewProps> = ({
  currentPage,
  numPages,
  isPageTranslated,
  isTransforming,
  isTranslating,
  onRunOcr,
}) => {
  return (
    <>
      {/* Page number indicator */}
      <div className="absolute bottom-4 right-4 bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
        Page {currentPage} of {numPages}
      </div>

      {/* Transform JSON Button - centered overlay if not translated */}
      {!isPageTranslated && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 20000 }}
        >
          <button
            onClick={onRunOcr}
            disabled={isTransforming || isTranslating}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100 flex items-center space-x-2"
            title="Transform current page to textboxes using OCR"
          >
            {isTransforming || isTranslating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>
                  {isTransforming ? "Transforming..." : "Translating..."}
                </span>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                  />
                </svg>
                <span>RUN OCR</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
};

export default BlankTranslatedView;
