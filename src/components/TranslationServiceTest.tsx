"use client";

import React, { useState, useEffect } from "react";
import {
  TranslationService,
  LANGUAGE_CODES,
  type TranslationResult,
  type Language,
} from "../lib/api/translationService";

interface TestResult {
  testName: string;
  status: "pending" | "success" | "error";
  result?: any;
  error?: string;
  timestamp: Date;
}

const TranslationServiceTest: React.FC = () => {
  const [translator, setTranslator] = useState<TranslationService | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [supportedLanguages, setSupportedLanguages] = useState<Language[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("es");
  const [testText, setTestText] = useState<string>("Hello, how are you today?");
  const [customTestText, setCustomTestText] = useState<string>("");

  // Initialize translator
  useEffect(() => {
    try {
      const newTranslator = new TranslationService();
      setTranslator(newTranslator);
      addTestResult(
        "Service Initialization",
        "success",
        "Translation service initialized successfully"
      );
    } catch (error) {
      addTestResult(
        "Service Initialization",
        "error",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }, []);

  const addTestResult = (
    testName: string,
    status: "pending" | "success" | "error",
    result?: any,
    error?: string
  ) => {
    setTestResults((prev) => [
      ...prev,
      {
        testName,
        status,
        result,
        error,
        timestamp: new Date(),
      },
    ]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  // Test 1: Single text translation
  const testSingleTranslation = async () => {
    if (!translator) return;

    addTestResult("Single Text Translation", "pending");
    try {
      const result = await translator.translateText(testText, selectedLanguage);
      addTestResult("Single Text Translation", "success", result);
    } catch (error) {
      addTestResult(
        "Single Text Translation",
        "error",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Test 2: Multiple texts translation
  const testMultipleTranslations = async () => {
    if (!translator) return;

    addTestResult("Multiple Texts Translation", "pending");
    try {
      const texts = [
        "Hello world",
        "How are you?",
        "Thank you very much",
        "Goodbye",
      ];
      const results = await translator.translateTexts(texts, selectedLanguage);
      addTestResult("Multiple Texts Translation", "success", results);
    } catch (error) {
      addTestResult(
        "Multiple Texts Translation",
        "error",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Test 3: Language detection
  const testLanguageDetection = async () => {
    if (!translator) return;

    addTestResult("Language Detection", "pending");
    try {
      const testCases = [
        "Hello world",
        "Hola mundo",
        "Bonjour le monde",
        "こんにちは世界",
      ];

      const results = [];
      for (const text of testCases) {
        const detected = await translator.detectLanguage(text);
        results.push({ text, detected });
      }

      addTestResult("Language Detection", "success", results);
    } catch (error) {
      addTestResult(
        "Language Detection",
        "error",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Test 4: Get supported languages
  const testSupportedLanguages = async () => {
    if (!translator) return;

    addTestResult("Get Supported Languages", "pending");
    try {
      const languages = await translator.getSupportedLanguages("en");
      setSupportedLanguages(languages);
      addTestResult(
        "Get Supported Languages",
        "success",
        `${languages.length} languages supported`
      );
    } catch (error) {
      addTestResult(
        "Get Supported Languages",
        "error",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Test 5: Check language support
  const testLanguageSupport = async () => {
    if (!translator) return;

    addTestResult("Language Support Check", "pending");
    try {
      const testLanguages = ["en", "es", "fr", "de", "invalid-code"];
      const results = [];

      for (const lang of testLanguages) {
        const isSupported = await translator.isLanguageSupported(lang);
        results.push({ language: lang, supported: isSupported });
      }

      addTestResult("Language Support Check", "success", results);
    } catch (error) {
      addTestResult(
        "Language Support Check",
        "error",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Test 6: Custom translation
  const testCustomTranslation = async () => {
    if (!translator || !customTestText.trim()) return;

    addTestResult("Custom Translation", "pending");
    try {
      const result = await translator.translateText(
        customTestText,
        selectedLanguage
      );
      addTestResult("Custom Translation", "success", result);
    } catch (error) {
      addTestResult(
        "Custom Translation",
        "error",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Test 7: HTML format translation
  const testHtmlTranslation = async () => {
    if (!translator) return;

    addTestResult("HTML Format Translation", "pending");
    try {
      const htmlText = "<p>Hello <strong>world</strong>!</p>";
      const result = await translator.translateText(
        htmlText,
        selectedLanguage,
        { format: "html" }
      );
      addTestResult("HTML Format Translation", "success", result);
    } catch (error) {
      addTestResult(
        "HTML Format Translation",
        "error",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Test 8: Legacy functions
  const testLegacyFunctions = async () => {
    if (!translator) return;

    addTestResult("Legacy Functions", "pending");
    try {
      const wordResult = await translator.translateWord(
        "hello",
        selectedLanguage
      );
      const wordsResult = await translator.translateWords(
        ["hello", "world"],
        selectedLanguage
      );

      addTestResult("Legacy Functions", "success", {
        translateWord: wordResult,
        translateWords: wordsResult,
      });
    } catch (error) {
      addTestResult(
        "Legacy Functions",
        "error",
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true);
    clearResults();

    await testSingleTranslation();
    await testMultipleTranslations();
    await testLanguageDetection();
    await testSupportedLanguages();
    await testLanguageSupport();
    await testHtmlTranslation();
    await testLegacyFunctions();

    setIsRunning(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-green-600";
      case "error":
        return "text-red-600";
      case "pending":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "pending":
        return "⏳";
      default:
        return "❓";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Translation Service Test Suite
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Configuration Panel */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-700">
              Configuration
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="es">Spanish (es)</option>
                <option value="fr">French (fr)</option>
                <option value="de">German (de)</option>
                <option value="it">Italian (it)</option>
                <option value="pt">Portuguese (pt)</option>
                <option value="ja">Japanese (ja)</option>
                <option value="ko">Korean (ko)</option>
                <option value="zh-CN">Chinese Simplified (zh-CN)</option>
                <option value="ar">Arabic (ar)</option>
                <option value="hi">Hindi (hi)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Text
              </label>
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter text to translate"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Test Text
              </label>
              <textarea
                value={customTestText}
                onChange={(e) => setCustomTestText(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Enter custom text for testing"
              />
            </div>
          </div>

          {/* Test Controls */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-700">
              Test Controls
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={runAllTests}
                disabled={isRunning || !translator}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isRunning ? "Running..." : "Run All Tests"}
              </button>

              <button
                onClick={clearResults}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Clear Results
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={testSingleTranslation}
                disabled={isRunning || !translator}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Test Single Translation
              </button>

              <button
                onClick={testMultipleTranslations}
                disabled={isRunning || !translator}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Test Multiple Translations
              </button>

              <button
                onClick={testLanguageDetection}
                disabled={isRunning || !translator}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Test Language Detection
              </button>

              <button
                onClick={testSupportedLanguages}
                disabled={isRunning || !translator}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Test Supported Languages
              </button>

              <button
                onClick={testCustomTranslation}
                disabled={isRunning || !translator || !customTestText.trim()}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Test Custom Translation
              </button>
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700">Test Results</h2>

          {testResults.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No test results yet. Run some tests to see results here.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-800">
                      {getStatusIcon(result.status)} {result.testName}
                    </h3>
                    <span
                      className={`text-sm font-medium ${getStatusColor(
                        result.status
                      )}`}
                    >
                      {result.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    {result.timestamp.toLocaleTimeString()}
                  </div>

                  {result.error && (
                    <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                      Error: {result.error}
                    </div>
                  )}

                  {result.result && (
                    <div className="text-sm">
                      <details className="cursor-pointer">
                        <summary className="font-medium text-gray-700 hover:text-gray-900">
                          View Result
                        </summary>
                        <pre className="mt-2 p-2 bg-white border rounded text-xs overflow-x-auto">
                          {JSON.stringify(result.result, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Supported Languages Display */}
        {supportedLanguages.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              Supported Languages ({supportedLanguages.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
              {supportedLanguages.slice(0, 50).map((lang, index) => (
                <div
                  key={index}
                  className="text-xs p-2 bg-blue-50 border border-blue-200 rounded"
                >
                  <div className="font-medium">{lang.code}</div>
                  <div className="text-gray-600 truncate">{lang.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Language Codes Reference */}
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Language Codes Reference
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(LANGUAGE_CODES)
              .slice(0, 20)
              .map(([name, code]) => (
                <div
                  key={name}
                  className="text-xs p-2 bg-gray-50 border border-gray-200 rounded"
                >
                  <div className="font-medium">{name}</div>
                  <div className="text-gray-600">{code}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslationServiceTest;
