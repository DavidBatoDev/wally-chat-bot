/**
 * Enhanced Translation service using Google Translate API + Gemini LLM for verdict
 * Environment Variables Required:
 * - GOOGLE_TRANSLATE_API_KEY: Your Google Translate API key
 * - GEMINI_API_KEY: Your Gemini API key
 */

interface TranslationResponse {
  data: {
    translations: Array<{
      translatedText: string;
      detectedSourceLanguage?: string;
    }>;
  };
}

interface TranslationError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

interface Language {
  code: string;
  name: string;
}

interface TranslationOptions {
  sourceLanguage?: string;
  format?: "text" | "html";
  model?: "nmt" | "pbmt";
  useLLMVerdict?: boolean; // New option to enable LLM verdict
}

interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage?: string;
  confidence?: number;
  llmImproved?: boolean; // Flag to indicate if LLM improved the translation
  originalTranslation?: string; // Store original Google Translate result
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface LLMVerdictRequest {
  originalTexts: string[];
  translations: string[];
  sourceLanguage: string;
  targetLanguage: string;
  detectedLanguage?: string;
}

interface LLMVerdictResponse {
  correctedTranslations: string[];
  languageCorrection?: string;
  improvements: Array<{
    index: number;
    reason: string;
    confidence: number;
  }>;
}

/**
 * Enhanced Translation service class with LLM verdict capability
 */
export class TranslationService {
  private readonly apiKey: string;
  private readonly geminiApiKey: string;
  private readonly baseUrl =
    "https://translation.googleapis.com/language/translate/v2";
  private readonly languagesUrl =
    "https://translation.googleapis.com/language/translate/v2/languages";
  private readonly geminiUrl =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

  constructor(apiKey?: string, geminiApiKey?: string) {
    this.apiKey =
      apiKey ||
      process.env.GOOGLE_TRANSLATE_API_KEY ||
      "AIzaSyD9Sj6b4Ums9is7ZktadDYUgllZ-qxDTTg";
    this.geminiApiKey =
      geminiApiKey ||
      process.env.GEMINI_API_KEY ||
      "AIzaSyBAhXOXwQuk2DHDP7gMDa3EJpZPQIrYzlo";

    if (!this.apiKey) {
      throw new Error(
        "Google Translate API key is required. Please set GOOGLE_TRANSLATE_API_KEY environment variable or pass it to the constructor."
      );
    }

    if (!this.geminiApiKey) {
      throw new Error(
        "Gemini API key is required. Please set GEMINI_API_KEY environment variable or pass it to the constructor."
      );
    }
  }

  /**
   * Validate API key format
   */
  private validateApiKey(): void {
    if (!this.apiKey || this.apiKey.length < 10) {
      throw new Error("Invalid Google Translate API key format");
    }
    if (!this.geminiApiKey || this.geminiApiKey.length < 10) {
      throw new Error("Invalid Gemini API key format");
    }
  }

  /**
   * Handle API errors with detailed information
   */
  private handleApiError(error: any, context: string): never {
    if (error.response) {
      throw new Error(
        `${context}: ${error.response.status} - ${
          error.response.data?.error?.message || "Unknown error"
        }`
      );
    } else if (error.request) {
      throw new Error(`${context}: Network error - ${error.message}`);
    } else {
      throw new Error(`${context}: ${error.message}`);
    }
  }

  /**
   * Make HTTP request with error handling
   */
  private async makeRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "TranslationService/1.0",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData: TranslationError = await response.json();
        throw new Error(
          `API Error ${response.status}: ${errorData.error.message}`
        );
      }

      return response;
    } catch (error) {
      this.handleApiError(error, "API Request failed");
    }
  }

  /**
   * Get LLM verdict on translations using Gemini
   */
  private async getLLMVerdict(
    request: LLMVerdictRequest
  ): Promise<LLMVerdictResponse> {
    try {
      console.log("🤖 [LLM VERDICT] Starting LLM review process...");
      console.log("📝 [LLM VERDICT] Original texts:", request.originalTexts);
      console.log(
        "🔄 [LLM VERDICT] Google translations:",
        request.translations
      );
      console.log(
        "🌐 [LLM VERDICT] Language pair:",
        `${request.sourceLanguage} → ${request.targetLanguage}`
      );

      const prompt = this.buildLLMPrompt(request);
      console.log(
        "💭 [LLM VERDICT] Generated prompt length:",
        prompt.length,
        "characters"
      );

      console.log("🚀 [LLM VERDICT] Sending request to Gemini API...");
      const response = await fetch(
        `${this.geminiUrl}?key=${this.geminiApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              topK: 1,
              topP: 0.8,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (!response.ok) {
        console.error("❌ [LLM VERDICT] Gemini API Error:", response.status);
        throw new Error(`Gemini API Error: ${response.status}`);
      }

      console.log("✅ [LLM VERDICT] Received response from Gemini API");
      const data: GeminiResponse = await response.json();

      if (
        !data.candidates ||
        !data.candidates[0] ||
        !data.candidates[0].content.parts[0]
      ) {
        console.error("❌ [LLM VERDICT] No valid response from Gemini API");
        throw new Error("No response from Gemini API");
      }

      const llmResponse = data.candidates[0].content.parts[0].text;
      console.log("📄 [LLM VERDICT] Raw LLM response:", llmResponse);

      const verdict = this.parseLLMResponse(llmResponse, request);
      console.log("🎯 [LLM VERDICT] Parsed verdict:", verdict);

      return verdict;
    } catch (error) {
      console.error("❌ [LLM VERDICT] LLM Verdict error:", error);
      console.log("🔄 [LLM VERDICT] Falling back to original translations");
      // Fallback to original translations if LLM fails
      return {
        correctedTranslations: request.translations,
        improvements: [],
      };
    }
  }

  /**
   * Build prompt for LLM to evaluate translations
   */
  private buildLLMPrompt(request: LLMVerdictRequest): string {
    const {
      originalTexts,
      translations,
      sourceLanguage,
      targetLanguage,
      detectedLanguage,
    } = request;

    let languageInfo = `Source Language: ${sourceLanguage}`;
    if (detectedLanguage && detectedLanguage !== sourceLanguage) {
      languageInfo += ` (Auto-detected: ${detectedLanguage})`;
    }

    return `You are an expert translator and linguist. Please evaluate the following translations and provide corrections if needed.

${languageInfo}
Target Language: ${targetLanguage}

Instructions:
1. First, verify if the detected/specified source language is correct for the given texts
2. Evaluate each translation for accuracy, naturalness, and cultural appropriateness
3. Provide improved translations only if the original is incorrect or unnatural
4. Maintain the same tone and style as the original text
5. Consider context and cultural nuances

Format your response as a JSON object with this exact structure:
{
  "languageCorrection": "${detectedLanguage || sourceLanguage}",
  "correctedTranslations": [
    "translation1",
    "translation2",
    ...
  ],
  "improvements": [
    {
      "index": 0,
      "reason": "explanation of why this was improved",
      "confidence": 0.9
    }
  ]
}

Original texts and their translations:
${originalTexts
  .map(
    (text, index) => `
${index + 1}. Original: "${text}"
   Translation: "${translations[index]}"`
  )
  .join("\n")}

Provide only the JSON response, no additional text.`;
  }

  /**
   * Parse LLM response and extract verdict
   */
  private parseLLMResponse(
    response: string,
    request: LLMVerdictRequest
  ): LLMVerdictResponse {
    try {
      console.log("🔍 [LLM VERDICT] Parsing LLM response...");

      // Extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("❌ [LLM VERDICT] No JSON found in LLM response");
        throw new Error("No JSON found in LLM response");
      }

      console.log("📊 [LLM VERDICT] Found JSON in response:", jsonMatch[0]);
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate response structure
      if (
        !parsed.correctedTranslations ||
        !Array.isArray(parsed.correctedTranslations)
      ) {
        console.error("❌ [LLM VERDICT] Invalid LLM response structure");
        throw new Error("Invalid LLM response structure");
      }

      // Ensure we have the right number of translations
      if (parsed.correctedTranslations.length !== request.translations.length) {
        console.error(
          "❌ [LLM VERDICT] Mismatch in number of translations:",
          `Expected: ${request.translations.length}, Got: ${parsed.correctedTranslations.length}`
        );
        throw new Error("Mismatch in number of translations");
      }

      console.log("✅ [LLM VERDICT] Successfully parsed LLM response");
      console.log(
        "🔄 [LLM VERDICT] Corrected translations:",
        parsed.correctedTranslations
      );
      console.log(
        "🌐 [LLM VERDICT] Language correction:",
        parsed.languageCorrection
      );
      console.log("📈 [LLM VERDICT] Improvements:", parsed.improvements);

      return {
        correctedTranslations: parsed.correctedTranslations,
        languageCorrection: parsed.languageCorrection || request.sourceLanguage,
        improvements: parsed.improvements || [],
      };
    } catch (error) {
      console.error("❌ [LLM VERDICT] Failed to parse LLM response:", error);
      console.log(
        "🔄 [LLM VERDICT] Returning original translations as fallback"
      );
      // Return original translations as fallback
      return {
        correctedTranslations: request.translations,
        improvements: [],
      };
    }
  }

  /**
   * Translate a single text to the target language
   */
  async translateText(
    text: string,
    targetLanguage: string,
    options: TranslationOptions = {}
  ): Promise<TranslationResult> {
    this.validateApiKey();

    if (!text || !text.trim()) {
      throw new Error("Text to translate cannot be empty");
    }

    if (!targetLanguage) {
      throw new Error("Target language is required");
    }

    console.log("🚀 [TRANSLATE] Starting translation process...");
    console.log("📝 [TRANSLATE] Input text:", text);
    console.log("🌐 [TRANSLATE] Target language:", targetLanguage);
    console.log("⚙️ [TRANSLATE] Options:", options);

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        q: text.trim(),
        target: targetLanguage,
        format: options.format || "text",
      });

      if (options.sourceLanguage) {
        params.append("source", options.sourceLanguage);
        console.log(
          "🔤 [TRANSLATE] Source language specified:",
          options.sourceLanguage
        );
      }

      if (options.model) {
        params.append("model", options.model);
        console.log("🧠 [TRANSLATE] Model specified:", options.model);
      }

      console.log("📡 [TRANSLATE] Sending request to Google Translate API...");
      const response = await this.makeRequest(
        `${this.baseUrl}?${params.toString()}`,
        {
          method: "POST",
        }
      );

      const data: TranslationResponse = await response.json();

      if (data.data.translations && data.data.translations.length > 0) {
        const translation = data.data.translations[0];
        console.log("✅ [TRANSLATE] Google Translate response:", translation);

        let result: TranslationResult = {
          translatedText: translation.translatedText,
          detectedSourceLanguage: translation.detectedSourceLanguage,
        };

        // Apply LLM verdict if requested
        if (options.useLLMVerdict) {
          console.log(
            "🤖 [TRANSLATE] LLM verdict requested, preparing request..."
          );
          const llmRequest: LLMVerdictRequest = {
            originalTexts: [text],
            translations: [translation.translatedText],
            sourceLanguage: options.sourceLanguage || "auto",
            targetLanguage: targetLanguage,
            detectedLanguage: translation.detectedSourceLanguage,
          };

          const llmVerdict = await this.getLLMVerdict(llmRequest);

          if (
            llmVerdict.correctedTranslations[0] !== translation.translatedText
          ) {
            console.log("🔄 [TRANSLATE] LLM improved the translation!");
            console.log("🔄 [TRANSLATE] Original:", translation.translatedText);
            console.log(
              "🔄 [TRANSLATE] Improved:",
              llmVerdict.correctedTranslations[0]
            );

            result.originalTranslation = translation.translatedText;
            result.translatedText = llmVerdict.correctedTranslations[0];
            result.llmImproved = true;
          } else {
            console.log("✅ [TRANSLATE] LLM confirmed the translation is good");
          }

          if (
            llmVerdict.languageCorrection &&
            llmVerdict.languageCorrection !== result.detectedSourceLanguage
          ) {
            console.log("🌐 [TRANSLATE] LLM corrected language detection:");
            console.log(
              "🌐 [TRANSLATE] Original detection:",
              result.detectedSourceLanguage
            );
            console.log(
              "🌐 [TRANSLATE] LLM correction:",
              llmVerdict.languageCorrection
            );
            result.detectedSourceLanguage = llmVerdict.languageCorrection;
          }
        }

        console.log("🎉 [TRANSLATE] Final translation result:", result);
        return result;
      } else {
        console.error("❌ [TRANSLATE] No translation received from API");
        throw new Error("No translation received from API");
      }
    } catch (error) {
      console.error("❌ [TRANSLATE] Translation error:", error);
      throw error;
    }
  }

  /**
   * Translate multiple texts to the target language with LLM verdict
   */
  async translateTexts(
    texts: string[],
    targetLanguage: string,
    options: TranslationOptions = {}
  ): Promise<TranslationResult[]> {
    this.validateApiKey();

    if (!texts || texts.length === 0) {
      throw new Error("Texts array cannot be empty");
    }

    if (!targetLanguage) {
      throw new Error("Target language is required");
    }

    console.log("🚀 [BATCH TRANSLATE] Starting batch translation process...");
    console.log("📝 [BATCH TRANSLATE] Number of texts:", texts.length);
    console.log("📝 [BATCH TRANSLATE] Input texts:", texts);
    console.log("🌐 [BATCH TRANSLATE] Target language:", targetLanguage);
    console.log("⚙️ [BATCH TRANSLATE] Options:", options);

    try {
      const validTexts = texts.filter((text) => text && text.trim());
      if (validTexts.length === 0) {
        console.error("❌ [BATCH TRANSLATE] No valid texts to translate");
        throw new Error("No valid texts to translate");
      }

      console.log("✅ [BATCH TRANSLATE] Valid texts count:", validTexts.length);

      // First, get all translations from Google Translate
      const googleTranslations: TranslationResult[] = [];

      console.log(
        "📡 [BATCH TRANSLATE] Getting translations from Google Translate..."
      );
      for (let i = 0; i < validTexts.length; i++) {
        const text = validTexts[i];
        console.log(
          `🔄 [BATCH TRANSLATE] Translating text ${i + 1}/${
            validTexts.length
          }: "${text}"`
        );

        const params = new URLSearchParams({
          key: this.apiKey,
          q: text.trim(),
          target: targetLanguage,
          format: options.format || "text",
        });

        if (options.sourceLanguage) {
          params.append("source", options.sourceLanguage);
        }

        if (options.model) {
          params.append("model", options.model);
        }

        const response = await this.makeRequest(
          `${this.baseUrl}?${params.toString()}`,
          {
            method: "POST",
          }
        );

        const data: TranslationResponse = await response.json();

        if (data.data.translations && data.data.translations.length > 0) {
          const translation = data.data.translations[0];
          console.log(
            `✅ [BATCH TRANSLATE] Google translation ${i + 1}:`,
            translation.translatedText
          );

          googleTranslations.push({
            translatedText: translation.translatedText,
            detectedSourceLanguage: translation.detectedSourceLanguage,
          });
        } else {
          console.error(
            `❌ [BATCH TRANSLATE] No translation received for text: "${text}"`
          );
          throw new Error(`No translation received for text: "${text}"`);
        }

        // Add a small delay to avoid hitting rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log("✅ [BATCH TRANSLATE] All Google translations completed");

      // Apply LLM verdict if requested
      if (options.useLLMVerdict && googleTranslations.length > 0) {
        console.log(
          "🤖 [BATCH TRANSLATE] LLM verdict requested for batch review..."
        );

        const llmRequest: LLMVerdictRequest = {
          originalTexts: validTexts,
          translations: googleTranslations.map((t) => t.translatedText),
          sourceLanguage: options.sourceLanguage || "auto",
          targetLanguage: targetLanguage,
          detectedLanguage: googleTranslations[0].detectedSourceLanguage,
        };

        const llmVerdict = await this.getLLMVerdict(llmRequest);

        // Update translations with LLM improvements
        console.log("🔄 [BATCH TRANSLATE] Processing LLM improvements...");
        let improvementCount = 0;

        for (let i = 0; i < googleTranslations.length; i++) {
          const original = googleTranslations[i].translatedText;
          const improved = llmVerdict.correctedTranslations[i];

          if (improved !== original) {
            console.log(`🔄 [BATCH TRANSLATE] Text ${i + 1} improved by LLM:`);
            console.log(`🔄 [BATCH TRANSLATE] Original: "${original}"`);
            console.log(`🔄 [BATCH TRANSLATE] Improved: "${improved}"`);

            googleTranslations[i].originalTranslation = original;
            googleTranslations[i].translatedText = improved;
            googleTranslations[i].llmImproved = true;
            improvementCount++;
          }
        }

        console.log(
          `📊 [BATCH TRANSLATE] LLM improved ${improvementCount}/${googleTranslations.length} translations`
        );

        // Update detected language if LLM corrected it
        if (llmVerdict.languageCorrection) {
          console.log(
            "🌐 [BATCH TRANSLATE] LLM language correction applied:",
            llmVerdict.languageCorrection
          );
          googleTranslations.forEach((result) => {
            result.detectedSourceLanguage = llmVerdict.languageCorrection;
          });
        }
      }

      console.log(
        "🎉 [BATCH TRANSLATE] Final batch translation results:",
        googleTranslations
      );
      return googleTranslations;
    } catch (error) {
      console.error("❌ [BATCH TRANSLATE] Batch translation error:", error);
      throw error;
    }
  }

  /**
   * Translate a single word to the target language (legacy method)
   */
  async translateWord(
    word: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<string> {
    const result = await this.translateText(word, targetLanguage, {
      sourceLanguage,
    });
    return result.translatedText;
  }

  /**
   * Translate multiple words to the target language (legacy method)
   */
  async translateWords(
    words: string[],
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<string[]> {
    const results = await this.translateTexts(words, targetLanguage, {
      sourceLanguage,
    });
    return results.map((result) => result.translatedText);
  }

  /**
   * Enhanced batch translation with LLM verdict
   */
  async translateWithLLMVerdict(
    texts: string[],
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranslationResult[]> {
    return this.translateTexts(texts, targetLanguage, {
      sourceLanguage,
      useLLMVerdict: true,
    });
  }

  /**
   * Get supported languages from Google Translate API
   */
  async getSupportedLanguages(
    targetLanguage: string = "en"
  ): Promise<Language[]> {
    this.validateApiKey();

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        target: targetLanguage,
      });

      const response = await this.makeRequest(
        `${this.languagesUrl}?${params.toString()}`
      );
      const data = await response.json();

      if (data.data && data.data.languages) {
        return data.data.languages.map((lang: any) => ({
          code: lang.language,
          name: lang.name,
        }));
      } else {
        throw new Error("No languages received from API");
      }
    } catch (error) {
      console.error("Get languages error:", error);
      throw error;
    }
  }

  /**
   * Detect the language of a text
   */
  async detectLanguage(text: string): Promise<string> {
    this.validateApiKey();

    if (!text || !text.trim()) {
      throw new Error("Text for language detection cannot be empty");
    }

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        q: text.trim(),
      });

      const response = await this.makeRequest(
        `https://translation.googleapis.com/language/translate/v2/detect?${params.toString()}`,
        { method: "POST" }
      );

      const data = await response.json();

      if (data.data && data.data.detections && data.data.detections[0]) {
        return data.data.detections[0][0].language;
      } else {
        throw new Error("No language detection result received from API");
      }
    } catch (error) {
      console.error("Language detection error:", error);
      throw error;
    }
  }

  /**
   * Check if a language code is supported
   */
  async isLanguageSupported(languageCode: string): Promise<boolean> {
    try {
      const languages = await this.getSupportedLanguages();
      return languages.some((lang) => lang.code === languageCode);
    } catch (error) {
      console.error("Error checking language support:", error);
      return false;
    }
  }
}

// Create default instance
let defaultInstance: TranslationService | null = null;

/**
 * Get or create the default translation service instance
 */
export const getTranslationService = (): TranslationService => {
  if (!defaultInstance) {
    defaultInstance = new TranslationService();
  }
  return defaultInstance;
};

// Legacy functions for backward compatibility
export const translateWord = async (
  word: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<string> => {
  return getTranslationService().translateWord(
    word,
    targetLanguage,
    sourceLanguage
  );
};

export const translateWords = async (
  words: string[],
  targetLanguage: string,
  sourceLanguage?: string
): Promise<string[]> => {
  return getTranslationService().translateWords(
    words,
    targetLanguage,
    sourceLanguage
  );
};

export const getSupportedLanguages = async (
  targetLanguage: string = "en"
): Promise<Language[]> => {
  return getTranslationService().getSupportedLanguages(targetLanguage);
};

// New enhanced functions with LLM verdict
export const translateWithLLMVerdict = async (
  texts: string[],
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslationResult[]> => {
  return getTranslationService().translateWithLLMVerdict(
    texts,
    targetLanguage,
    sourceLanguage
  );
};

// Enhanced language codes with better organization
export const LANGUAGE_CODES = {
  // Major languages
  ENGLISH: "en",
  SPANISH: "es",
  FRENCH: "fr",
  GERMAN: "de",
  ITALIAN: "it",
  PORTUGUESE: "pt",
  RUSSIAN: "ru",
  CHINESE_SIMPLIFIED: "zh-CN",
  CHINESE_TRADITIONAL: "zh-TW",
  JAPANESE: "ja",
  KOREAN: "ko",
  ARABIC: "ar",
  HINDI: "hi",

  // European languages
  DUTCH: "nl",
  SWEDISH: "sv",
  NORWEGIAN: "no",
  DANISH: "da",
  FINNISH: "fi",
  POLISH: "pl",
  TURKISH: "tr",
  GREEK: "el",
  HEBREW: "he",
  HUNGARIAN: "hu",
  CZECH: "cs",
  SLOVAK: "sk",
  ROMANIAN: "ro",
  BULGARIAN: "bg",
  CROATIAN: "hr",
  SERBIAN: "sr",
  SLOVENIAN: "sl",
  ESTONIAN: "et",
  LATVIAN: "lv",
  LITHUANIAN: "lt",
  UKRAINIAN: "uk",
  BELARUSIAN: "be",

  // Asian languages
  THAI: "th",
  VIETNAMESE: "vi",
  INDONESIAN: "id",
  MALAY: "ms",
  FILIPINO: "tl",
  BENGALI: "bn",
  URDU: "ur",
  PUNJABI: "pa",
  GUJARATI: "gu",
  MARATHI: "mr",
  KANNADA: "kn",
  TAMIL: "ta",
  TELUGU: "te",
  MALAYALAM: "ml",
  SINHALA: "si",
  BURMESE: "my",
  KHMER: "km",
  LAO: "lo",
  NEPALI: "ne",
  TIBETAN: "bo",
  MONGOLIAN: "mn",

  // Central Asian languages
  KAZAKH: "kk",
  UZBEK: "uz",
  KYRGYZ: "ky",
  TAJIK: "tg",
  TURKMEN: "tk",
  AZERBAIJANI: "az",
  GEORGIAN: "ka",
  ARMENIAN: "hy",
  PERSIAN: "fa",
  KURDISH: "ku",
  PASHTO: "ps",
  DARI: "prs",
  UYGHUR: "ug",

  // Special
  AUTO_DETECT: "auto",
} as const;

// Export types for better TypeScript support
export type LanguageCode = (typeof LANGUAGE_CODES)[keyof typeof LANGUAGE_CODES];
export type {
  TranslationOptions,
  TranslationResult,
  Language,
  LLMVerdictRequest,
  LLMVerdictResponse,
};

// Utility functions
export const isValidLanguageCode = (code: string): code is LanguageCode => {
  return Object.values(LANGUAGE_CODES).includes(code as LanguageCode);
};

export const getLanguageName = (code: LanguageCode): string => {
  const entry = Object.entries(LANGUAGE_CODES).find(
    ([_, value]) => value === code
  );
  return entry ? entry[0].replace(/_/g, " ").toLowerCase() : code;
};
