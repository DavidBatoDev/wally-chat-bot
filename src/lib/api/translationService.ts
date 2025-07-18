/**
 * Enhanced Translation service using Google Translate API
 * Environment Variables Required:
 * - GOOGLE_TRANSLATE_API_KEY: Your Google Translate API key
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
    format?: 'text' | 'html';
    model?: 'nmt' | 'pbmt';
  }
  
  interface TranslationResult {
    translatedText: string;
    detectedSourceLanguage?: string;
    confidence?: number;
  }
  
  /**
   * Translation service class with enhanced features
   */
  export class TranslationService {
    private readonly apiKey: string;
    private readonly baseUrl = 'https://translation.googleapis.com/language/translate/v2';
    private readonly languagesUrl = 'https://translation.googleapis.com/language/translate/v2/languages';
  
    constructor(apiKey?: string) {
      this.apiKey = apiKey || process.env.GOOGLE_TRANSLATE_API_KEY || 'AIzaSyDKNM0imbSFYjOKhpP0qj8ZMaJuyXg-EI8';
      
      if (!this.apiKey) {
        throw new Error(
          'Google Translate API key is required. Please set GOOGLE_TRANSLATE_API_KEY environment variable or pass it to the constructor.'
        );
      }
    }
  
    /**
     * Validate API key format
     */
    private validateApiKey(): void {
      if (!this.apiKey || this.apiKey.length < 10) {
        throw new Error('Invalid Google Translate API key format');
      }
    }
  
    /**
     * Handle API errors with detailed information
     */
    private handleApiError(error: any, context: string): never {
      if (error.response) {
        throw new Error(`${context}: ${error.response.status} - ${error.response.data?.error?.message || 'Unknown error'}`);
      } else if (error.request) {
        throw new Error(`${context}: Network error - ${error.message}`);
      } else {
        throw new Error(`${context}: ${error.message}`);
      }
    }
  
    /**
     * Make HTTP request with error handling
     */
    private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TranslationService/1.0',
            ...options.headers,
          },
        });
  
        if (!response.ok) {
          const errorData: TranslationError = await response.json();
          throw new Error(`API Error ${response.status}: ${errorData.error.message}`);
        }
  
        return response;
      } catch (error) {
        this.handleApiError(error, 'API Request failed');
      }
    }
  
    /**
     * Translate a single text to the target language
     * @param text - The text to translate
     * @param targetLanguage - The target language code (e.g., 'es', 'fr', 'de')
     * @param options - Translation options
     * @returns Promise<TranslationResult> - The translation result
     */
    async translateText(
      text: string,
      targetLanguage: string,
      options: TranslationOptions = {}
    ): Promise<TranslationResult> {
      this.validateApiKey();
  
      if (!text || !text.trim()) {
        throw new Error('Text to translate cannot be empty');
      }
  
      if (!targetLanguage) {
        throw new Error('Target language is required');
      }
  
      try {
        const params = new URLSearchParams({
          key: this.apiKey,
          q: text.trim(),
          target: targetLanguage,
          format: options.format || 'text',
        });
  
        if (options.sourceLanguage) {
          params.append('source', options.sourceLanguage);
        }
  
        if (options.model) {
          params.append('model', options.model);
        }
  
        const response = await this.makeRequest(`${this.baseUrl}?${params.toString()}`, {
          method: 'POST',
        });
  
        const data: TranslationResponse = await response.json();
  
        if (data.data.translations && data.data.translations.length > 0) {
          const translation = data.data.translations[0];
          return {
            translatedText: translation.translatedText,
            detectedSourceLanguage: translation.detectedSourceLanguage,
          };
        } else {
          throw new Error('No translation received from API');
        }
      } catch (error) {
        console.error('Translation error:', error);
        throw error;
      }
    }
  
    /**
     * Translate a single word to the target language (legacy method)
     * @param word - The word to translate
     * @param targetLanguage - The target language code
     * @param sourceLanguage - Optional source language code
     * @returns Promise<string> - The translated word
     */
    async translateWord(
      word: string,
      targetLanguage: string,
      sourceLanguage?: string
    ): Promise<string> {
      const result = await this.translateText(word, targetLanguage, { sourceLanguage });
      return result.translatedText;
    }
  
    /**
     * Translate multiple texts to the target language
     * @param texts - Array of texts/sentences to translate
     * @param targetLanguage - The target language code
     * @param options - Translation options
     * @returns Promise<TranslationResult[]> - Array of translation results in the same order
     */
    async translateTexts(
      texts: string[],
      targetLanguage: string,
      options: TranslationOptions = {}
    ): Promise<TranslationResult[]> {
      this.validateApiKey();
  
      if (!texts || texts.length === 0) {
        throw new Error('Texts array cannot be empty');
      }
  
      if (!targetLanguage) {
        throw new Error('Target language is required');
      }
  
      try {
        const validTexts = texts.filter(text => text && text.trim());
        if (validTexts.length === 0) {
          throw new Error('No valid texts to translate');
        }
  
        // Translate each text individually to maintain accuracy and order
        const results: TranslationResult[] = [];
        
        for (const text of validTexts) {
          const params = new URLSearchParams({
            key: this.apiKey,
            q: text.trim(),
            target: targetLanguage,
            format: options.format || 'text',
          });
  
          if (options.sourceLanguage) {
            params.append('source', options.sourceLanguage);
          }
  
          if (options.model) {
            params.append('model', options.model);
          }
  
          const response = await this.makeRequest(`${this.baseUrl}?${params.toString()}`, {
            method: 'POST',
          });
  
          const data: TranslationResponse = await response.json();
  
          if (data.data.translations && data.data.translations.length > 0) {
            const translation = data.data.translations[0];
            results.push({
              translatedText: translation.translatedText,
              detectedSourceLanguage: translation.detectedSourceLanguage,
            });
          } else {
            throw new Error(`No translation received for text: "${text}"`);
          }
  
          // Add a small delay to avoid hitting rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        }
  
        return results;
      } catch (error) {
        console.error('Batch translation error:', error);
        throw error;
      }
    }
  
    /**
     * Translate multiple words to the target language (legacy method)
     * @param words - Array of words to translate
     * @param targetLanguage - The target language code
     * @param sourceLanguage - Optional source language code
     * @returns Promise<string[]> - Array of translated words
     */
    async translateWords(
      words: string[],
      targetLanguage: string,
      sourceLanguage?: string
    ): Promise<string[]> {
      const results = await this.translateTexts(words, targetLanguage, { sourceLanguage });
      return results.map(result => result.translatedText);
    }
  
    /**
     * Get supported languages from Google Translate API
     * @param targetLanguage - The language code to get language names in
     * @returns Promise<Language[]> - Array of supported languages
     */
    async getSupportedLanguages(targetLanguage: string = 'en'): Promise<Language[]> {
      this.validateApiKey();
  
      try {
        const params = new URLSearchParams({
          key: this.apiKey,
          target: targetLanguage,
        });
  
        const response = await this.makeRequest(`${this.languagesUrl}?${params.toString()}`);
        const data = await response.json();
  
        if (data.data && data.data.languages) {
          return data.data.languages.map((lang: any) => ({
            code: lang.language,
            name: lang.name,
          }));
        } else {
          throw new Error('No languages received from API');
        }
      } catch (error) {
        console.error('Get languages error:', error);
        throw error;
      }
    }
  
    /**
     * Detect the language of a text
     * @param text - The text to detect language for
     * @returns Promise<string> - The detected language code
     */
    async detectLanguage(text: string): Promise<string> {
      this.validateApiKey();
  
      if (!text || !text.trim()) {
        throw new Error('Text for language detection cannot be empty');
      }
  
      try {
        const params = new URLSearchParams({
          key: this.apiKey,
          q: text.trim(),
        });
  
        const response = await this.makeRequest(
          `https://translation.googleapis.com/language/translate/v2/detect?${params.toString()}`,
          { method: 'POST' }
        );
  
        const data = await response.json();
  
        if (data.data && data.data.detections && data.data.detections[0]) {
          return data.data.detections[0][0].language;
        } else {
          throw new Error('No language detection result received from API');
        }
      } catch (error) {
        console.error('Language detection error:', error);
        throw error;
      }
    }
  
    /**
     * Check if a language code is supported
     * @param languageCode - The language code to check
     * @returns Promise<boolean> - Whether the language is supported
     */
    async isLanguageSupported(languageCode: string): Promise<boolean> {
      try {
        const languages = await this.getSupportedLanguages();
        return languages.some(lang => lang.code === languageCode);
      } catch (error) {
        console.error('Error checking language support:', error);
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
    return getTranslationService().translateWord(word, targetLanguage, sourceLanguage);
  };
  
  export const translateWords = async (
    words: string[],
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<string[]> => {
    return getTranslationService().translateWords(words, targetLanguage, sourceLanguage);
  };
  
  export const getSupportedLanguages = async (
    targetLanguage: string = 'en'
  ): Promise<Language[]> => {
    return getTranslationService().getSupportedLanguages(targetLanguage);
  };
  
  // Enhanced language codes with better organization
  export const LANGUAGE_CODES = {
    // Major languages
    ENGLISH: 'en',
    SPANISH: 'es',
    FRENCH: 'fr',
    GERMAN: 'de',
    ITALIAN: 'it',
    PORTUGUESE: 'pt',
    RUSSIAN: 'ru',
    CHINESE_SIMPLIFIED: 'zh-CN',
    CHINESE_TRADITIONAL: 'zh-TW',
    JAPANESE: 'ja',
    KOREAN: 'ko',
    ARABIC: 'ar',
    HINDI: 'hi',
    
    // European languages
    DUTCH: 'nl',
    SWEDISH: 'sv',
    NORWEGIAN: 'no',
    DANISH: 'da',
    FINNISH: 'fi',
    POLISH: 'pl',
    TURKISH: 'tr',
    GREEK: 'el',
    HEBREW: 'he',
    HUNGARIAN: 'hu',
    CZECH: 'cs',
    SLOVAK: 'sk',
    ROMANIAN: 'ro',
    BULGARIAN: 'bg',
    CROATIAN: 'hr',
    SERBIAN: 'sr',
    SLOVENIAN: 'sl',
    ESTONIAN: 'et',
    LATVIAN: 'lv',
    LITHUANIAN: 'lt',
    UKRAINIAN: 'uk',
    BELARUSIAN: 'be',
    
    // Asian languages
    THAI: 'th',
    VIETNAMESE: 'vi',
    INDONESIAN: 'id',
    MALAY: 'ms',
    FILIPINO: 'tl',
    BENGALI: 'bn',
    URDU: 'ur',
    PUNJABI: 'pa',
    GUJARATI: 'gu',
    MARATHI: 'mr',
    KANNADA: 'kn',
    TAMIL: 'ta',
    TELUGU: 'te',
    MALAYALAM: 'ml',
    SINHALA: 'si',
    BURMESE: 'my',
    KHMER: 'km',
    LAO: 'lo',
    NEPALI: 'ne',
    TIBETAN: 'bo',
    MONGOLIAN: 'mn',
    
    // Central Asian languages
    KAZAKH: 'kk',
    UZBEK: 'uz',
    KYRGYZ: 'ky',
    TAJIK: 'tg',
    TURKMEN: 'tk',
    AZERBAIJANI: 'az',
    GEORGIAN: 'ka',
    ARMENIAN: 'hy',
    PERSIAN: 'fa',
    KURDISH: 'ku',
    PASHTO: 'ps',
    DARI: 'prs',
    UYGHUR: 'ug',
    
    // Special
    AUTO_DETECT: 'auto',
  } as const;
  
  // Export types for better TypeScript support
  export type LanguageCode = typeof LANGUAGE_CODES[keyof typeof LANGUAGE_CODES];
  export type { TranslationOptions, TranslationResult, Language };
  
  // Utility functions
  export const isValidLanguageCode = (code: string): code is LanguageCode => {
    return Object.values(LANGUAGE_CODES).includes(code as LanguageCode);
  };
  
  export const getLanguageName = (code: LanguageCode): string => {
    const entry = Object.entries(LANGUAGE_CODES).find(([_, value]) => value === code);
    return entry ? entry[0].replace(/_/g, ' ').toLowerCase() : code;
  };