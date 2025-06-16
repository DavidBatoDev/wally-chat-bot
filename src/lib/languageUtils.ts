// Language mapping from full names to ISO 639-1 codes
const languageNameToCode: Record<string, string> = {
  'greek': 'el',
  'english': 'en',
  'spanish': 'es',
  'french': 'fr',
  'german': 'de',
  'italian': 'it',
  'japanese': 'ja',
  'korean': 'ko',
  'chinese': 'zh',
  'arabic': 'ar',
  'hindi': 'hi',
  'vietnamese': 'vi',
  'thai': 'th',
  'russian': 'ru',
  'portuguese': 'pt',
  'dutch': 'nl',
  // Add more mappings as needed
};

/**
 * Convert a language name to its ISO 639-1 code
 * @param languageName The full name of the language (case-insensitive)
 * @returns ISO 639-1 code, or 'en' if not found
 */
export const getLanguageCode = (languageName: string | undefined): string => {
  if (!languageName) return 'en';
  const normalized = languageName.toLowerCase().trim();
  return languageNameToCode[normalized] || 'en';
};