/**
 * Translation Service Usage Guide
 * 
 * This guide shows how to use all the translation functions with real examples
 */

import { TranslationService, translateWord, translateWords, getSupportedLanguages, LANGUAGE_CODES } from './translation-service';

// ================================
// 1. SETUP - Setting up the service
// ================================

// Method 1: Using environment variable (recommended)
// Set GOOGLE_TRANSLATE_API_KEY in your .env file
const translator = new TranslationService();

// Method 2: Pass API key directly
const translatorWithKey = new TranslationService('your-api-key-here');

// ================================
// 2. TRANSLATE SINGLE TEXT/WORD
// ================================

async function translateSingleExamples() {
  // Example 1: Translate a single word
  const word = await translator.translateText("hello", "es");
  console.log(word); // { translatedText: "hola", detectedSourceLanguage: "en" }

  // Example 2: Translate a sentence
  const sentence = await translator.translateText("How are you today?", "fr");
  console.log(sentence); // { translatedText: "Comment allez-vous aujourd'hui?", detectedSourceLanguage: "en" }

  // Example 3: Translate with source language specified
  const withSource = await translator.translateText("Bonjour", "en", { sourceLanguage: "fr" });
  console.log(withSource); // { translatedText: "Hello", detectedSourceLanguage: "fr" }

  // Example 4: Translate HTML content
  const htmlText = await translator.translateText("<p>Hello world</p>", "es", { format: "html" });
  console.log(htmlText); // { translatedText: "<p>Hola mundo</p>", detectedSourceLanguage: "en" }

  // Example 5: Using legacy function
  const legacyResult = await translateWord("goodbye", "de");
  console.log(legacyResult); // "auf Wiedersehen"
}

// ================================
// 3. TRANSLATE MULTIPLE TEXTS
// ================================

async function translateMultipleExamples() {
  // Example 1: Translate multiple words
  const words = ["hello", "world", "goodbye", "friend"];
  const translatedWords = await translator.translateTexts(words, "es");
  console.log(translatedWords);
  // [
  //   { translatedText: "hola", detectedSourceLanguage: "en" },
  //   { translatedText: "mundo", detectedSourceLanguage: "en" },
  //   { translatedText: "adiós", detectedSourceLanguage: "en" },
  //   { translatedText: "amigo", detectedSourceLanguage: "en" }
  // ]

  // Example 2: Translate multiple sentences
  const sentences = [
    "How are you?",
    "What time is it?",
    "Where is the bathroom?",
    "Thank you very much"
  ];
  const translatedSentences = await translator.translateTexts(sentences, "ja");
  console.log(translatedSentences);
  // [
  //   { translatedText: "元気ですか？", detectedSourceLanguage: "en" },
  //   { translatedText: "今何時ですか？", detectedSourceLanguage: "en" },
  //   { translatedText: "トイレはどこですか？", detectedSourceLanguage: "en" },
  //   { translatedText: "どうもありがとうございます", detectedSourceLanguage: "en" }
  // ]

  // Example 3: Mixed content (words and sentences)
  const mixedContent = [
    "apple",
    "I love programming",
    "computer",
    "The weather is nice today"
  ];
  const translatedMixed = await translator.translateTexts(mixedContent, "ko");
  console.log(translatedMixed);

  // Example 4: Using legacy function for multiple words
  const legacyWords = await translateWords(["cat", "dog", "bird"], "fr");
  console.log(legacyWords); // ["chat", "chien", "oiseau"]

  // Example 5: Translate with specific source language
  const frenchTexts = ["Bonjour", "Comment ça va?", "Au revoir"];
  const translatedFromFrench = await translator.translateTexts(frenchTexts, "en", { sourceLanguage: "fr" });
  console.log(translatedFromFrench);
}

// ================================
// 4. LANGUAGE DETECTION
// ================================

async function languageDetectionExamples() {
  // Example 1: Detect language of a word
  const language1 = await translator.detectLanguage("Hola");
  console.log(language1); // "es"

  // Example 2: Detect language of a sentence
  const language2 = await translator.detectLanguage("Je suis très content");
  console.log(language2); // "fr"

  // Example 3: Detect language of mixed script
  const language3 = await translator.detectLanguage("こんにちは");
  console.log(language3); // "ja"

  // Example 4: Detect language of longer text
  const language4 = await translator.detectLanguage("The quick brown fox jumps over the lazy dog");
  console.log(language4); // "en"
}

// ================================
// 5. SUPPORTED LANGUAGES
// ================================

async function supportedLanguagesExamples() {
  // Example 1: Get all supported languages (names in English)
  const languages = await translator.getSupportedLanguages("en");
  console.log(languages.slice(0, 5)); // First 5 languages
  // [
  //   { code: "af", name: "Afrikaans" },
  //   { code: "sq", name: "Albanian" },
  //   { code: "am", name: "Amharic" },
  //   { code: "ar", name: "Arabic" },
  //   { code: "hy", name: "Armenian" }
  // ]

  // Example 2: Get language names in Spanish
  const languagesInSpanish = await translator.getSupportedLanguages("es");
  console.log(languagesInSpanish.slice(0, 3));
  // [
  //   { code: "af", name: "afrikáans" },
  //   { code: "sq", name: "albanés" },
  //   { code: "am", name: "amárico" }
  // ]

  // Example 3: Check if a language is supported
  const isSupported = await translator.isLanguageSupported("zh-CN");
  console.log(isSupported); // true

  // Example 4: Using legacy function
  const legacyLanguages = await getSupportedLanguages("fr");
  console.log(legacyLanguages.slice(0, 2));
}

// ================================
// 6. USING LANGUAGE CODES
// ================================

function languageCodeExamples() {
  // Example 1: Using predefined language codes
  console.log(LANGUAGE_CODES.SPANISH); // "es"
  console.log(LANGUAGE_CODES.FRENCH); // "fr"
  console.log(LANGUAGE_CODES.CHINESE_SIMPLIFIED); // "zh-CN"

  // Example 2: Common language codes
  const commonLanguages = {
    english: LANGUAGE_CODES.ENGLISH,      // "en"
    spanish: LANGUAGE_CODES.SPANISH,      // "es"
    french: LANGUAGE_CODES.FRENCH,        // "fr"
    german: LANGUAGE_CODES.GERMAN,        // "de"
    italian: LANGUAGE_CODES.ITALIAN,      // "it"
    portuguese: LANGUAGE_CODES.PORTUGUESE, // "pt"
    russian: LANGUAGE_CODES.RUSSIAN,      // "ru"
    japanese: LANGUAGE_CODES.JAPANESE,    // "ja"
    korean: LANGUAGE_CODES.KOREAN,        // "ko"
    chinese: LANGUAGE_CODES.CHINESE_SIMPLIFIED, // "zh-CN"
    arabic: LANGUAGE_CODES.ARABIC,        // "ar"
    hindi: LANGUAGE_CODES.HINDI,          // "hi"
  };

  console.log(commonLanguages);
}

// ================================
// 7. REAL-WORLD USAGE EXAMPLES
// ================================

async function realWorldExamples() {
  // Example 1: Website content translation
  const websiteContent = [
    "Welcome to our website",
    "About Us",
    "Contact Information",
    "Privacy Policy",
    "Terms of Service"
  ];
  const translatedWebsite = await translator.translateTexts(websiteContent, "es");
  console.log("Website in Spanish:", translatedWebsite);

  // Example 2: User messages in a chat app
  const userMessages = [
    "Hello, how can I help you?",
    "Please wait a moment",
    "Thank you for your patience",
    "Have a great day!"
  ];
  const translatedMessages = await translator.translateTexts(userMessages, "fr");
  console.log("Chat messages in French:", translatedMessages);

  // Example 3: Product descriptions
  const products = [
    "High-quality wireless headphones",
    "Professional camera lens",
    "Comfortable running shoes",
    "Organic cotton t-shirt"
  ];
  const translatedProducts = await translator.translateTexts(products, "de");
  console.log("Products in German:", translatedProducts);

  // Example 4: Error messages
  const errorMessages = [
    "Invalid username or password",
    "Connection timeout",
    "File not found",
    "Access denied"
  ];
  const translatedErrors = await translator.translateTexts(errorMessages, "ja");
  console.log("Error messages in Japanese:", translatedErrors);
}

// ================================
// 8. ERROR HANDLING EXAMPLES
// ================================

async function errorHandlingExamples() {
  try {
    // Example 1: Handle empty text
    await translator.translateText("", "es");
  } catch (error) {
    console.log("Empty text error:", error.message);
  }

  try {
    // Example 2: Handle invalid language code
    await translator.translateText("Hello", "invalid-code");
  } catch (error) {
    console.log("Invalid language error:", error.message);
  }

  try {
    // Example 3: Handle network errors gracefully
    const result = await translator.translateText("Hello", "es");
    console.log("Translation successful:", result);
  } catch (error) {
    console.log("Network error:", error.message);
    // Fallback: return original text or cached translation
  }
}

// ================================
// 9. BATCH PROCESSING LARGE DATASETS
// ================================

async function batchProcessingExample() {
  // Example: Translate a large dataset in chunks
  const largeDataset = [
    "Item 1", "Item 2", "Item 3", /* ... many more items ... */
  ];

  const chunkSize = 10;
  const allTranslations = [];

  for (let i = 0; i < largeDataset.length; i += chunkSize) {
    const chunk = largeDataset.slice(i, i + chunkSize);
    const translatedChunk = await translator.translateTexts(chunk, "es");
    allTranslations.push(...translatedChunk);
    
    // Add delay between chunks to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("All translations completed:", allTranslations.length);
}

// ================================
// 10. RUNNING THE EXAMPLES
// ================================

async function runAllExamples() {
  try {
    console.log("=== Single Text Translation ===");
    await translateSingleExamples();

    console.log("\n=== Multiple Text Translation ===");
    await translateMultipleExamples();

    console.log("\n=== Language Detection ===");
    await languageDetectionExamples();

    console.log("\n=== Supported Languages ===");
    await supportedLanguagesExamples();

    console.log("\n=== Language Codes ===");
    languageCodeExamples();

    console.log("\n=== Real World Examples ===");
    await realWorldExamples();

    console.log("\n=== Error Handling ===");
    await errorHandlingExamples();

    console.log("\n=== Batch Processing ===");
    await batchProcessingExample();

  } catch (error) {
    console.error("Error running examples:", error);
  }
}

// Export examples for use
export {
  translateSingleExamples,
  translateMultipleExamples,
  languageDetectionExamples,
  supportedLanguagesExamples,
  languageCodeExamples,
  realWorldExamples,
  errorHandlingExamples,
  batchProcessingExample,
  runAllExamples
};

// Uncomment the line below to run all examples
// runAllExamples();