import React from "react";

const LanguageSelectionModal: React.FC<{
  open: boolean;
  sourceLanguage: string;
  desiredLanguage: string;
  onSourceLanguageChange: (language: string) => void;
  onDesiredLanguageChange: (language: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSettings?: boolean;
  onSave?: () => void;
  onBack?: () => void;
}> = ({
  open,
  sourceLanguage,
  desiredLanguage,
  onSourceLanguageChange,
  onDesiredLanguageChange,
  onConfirm,
  onCancel,
  isSettings = false,
  onSave,
  onBack,
}) => {
  if (!open) return null;

  // Language options from the translation service
  const languageOptions = [
    { code: "auto", name: "Auto detect" },
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "pt", name: "Portuguese" },
    { code: "ru", name: "Russian" },
    { code: "zh-CN", name: "Chinese (Simplified)" },
    { code: "zh-TW", name: "Chinese (Traditional)" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "ar", name: "Arabic" },
    { code: "hi", name: "Hindi" },
    { code: "nl", name: "Dutch" },
    { code: "sv", name: "Swedish" },
    { code: "no", name: "Norwegian" },
    { code: "da", name: "Danish" },
    { code: "fi", name: "Finnish" },
    { code: "pl", name: "Polish" },
    { code: "tr", name: "Turkish" },
    { code: "el", name: "Greek" },
    { code: "he", name: "Hebrew" },
    { code: "hu", name: "Hungarian" },
    { code: "cs", name: "Czech" },
    { code: "sk", name: "Slovak" },
    { code: "ro", name: "Romanian" },
    { code: "bg", name: "Bulgarian" },
    { code: "hr", name: "Croatian" },
    { code: "sr", name: "Serbian" },
    { code: "sl", name: "Slovenian" },
    { code: "et", name: "Estonian" },
    { code: "lv", name: "Latvian" },
    { code: "lt", name: "Lithuanian" },
    { code: "uk", name: "Ukrainian" },
    { code: "be", name: "Belarusian" },
    { code: "th", name: "Thai" },
    { code: "vi", name: "Vietnamese" },
    { code: "id", name: "Indonesian" },
    { code: "ms", name: "Malay" },
    { code: "tl", name: "Filipino" },
    { code: "bn", name: "Bengali" },
    { code: "ur", name: "Urdu" },
    { code: "pa", name: "Punjabi" },
    { code: "gu", name: "Gujarati" },
    { code: "mr", name: "Marathi" },
    { code: "kn", name: "Kannada" },
    { code: "ta", name: "Tamil" },
    { code: "te", name: "Telugu" },
    { code: "ml", name: "Malayalam" },
    { code: "si", name: "Sinhala" },
    { code: "my", name: "Burmese" },
    { code: "km", name: "Khmer" },
    { code: "lo", name: "Lao" },
    { code: "ne", name: "Nepali" },
    { code: "bo", name: "Tibetan" },
    { code: "mn", name: "Mongolian" },
    { code: "kk", name: "Kazakh" },
    { code: "uz", name: "Uzbek" },
    { code: "ky", name: "Kyrgyz" },
    { code: "tg", name: "Tajik" },
    { code: "tk", name: "Turkmen" },
    { code: "az", name: "Azerbaijani" },
    { code: "ka", name: "Georgian" },
    { code: "hy", name: "Armenian" },
    { code: "fa", name: "Persian" },
    { code: "ku", name: "Kurdish" },
    { code: "ps", name: "Pashto" },
    { code: "prs", name: "Dari" },
    { code: "ug", name: "Uyghur" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-blue-50 via-white to-blue-100 rounded-2xl shadow-2xl p-8 min-w-[450px] max-w-[90vw] border border-blue-100">
        {/* Header with icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-400 rounded-full flex items-center justify-center shadow-lg mr-4">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isSettings ? "Language Settings" : "Select Languages"}
            </h2>
            <p className="text-blue-600 font-medium">
              {isSettings
                ? "Configure Translation Languages"
                : "Document Translation Setup"}
            </p>
          </div>
        </div>

        <p className="text-gray-600 mb-8 text-center leading-relaxed">
          {isSettings
            ? "Configure your preferred source and target languages for document translation."
            : "Choose the source and target languages for your document processing and translation workflow."}
        </p>

        <div className="space-y-8">
          <div className="relative">
            <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
              Source Language
            </label>
            <div className="relative">
              <select
                value={sourceLanguage}
                onChange={(e) => onSourceLanguageChange(e.target.value)}
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 bg-white shadow-sm hover:border-blue-300 appearance-none cursor-pointer"
              >
                <option value="">Select source language...</option>
                {languageOptions.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg
                  className="w-5 h-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="relative">
            <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
              Target Language
            </label>
            <div className="relative">
              <select
                value={desiredLanguage}
                onChange={(e) => onDesiredLanguageChange(e.target.value)}
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 bg-white shadow-sm hover:border-blue-300 appearance-none cursor-pointer"
              >
                <option value="">Select target language...</option>
                {languageOptions.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg
                  className="w-5 h-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-blue-100">
          {isSettings ? (
            <>
              <button
                className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-blue-50 text-gray-700 font-semibold"
                onClick={onBack}
              >
                Back
              </button>
              <button
                className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onSave}
                disabled={
                  !sourceLanguage ||
                  !desiredLanguage ||
                  sourceLanguage === desiredLanguage
                }
              >
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save Settings
                </div>
              </button>
            </>
          ) : (
            <>
              <button
                className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-blue-50 text-gray-700 font-semibold"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onConfirm}
                disabled={
                  !sourceLanguage ||
                  !desiredLanguage ||
                  sourceLanguage === desiredLanguage
                }
              >
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Translate Document
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LanguageSelectionModal;
