// src/lib/genai/client.ts
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GenAIConfig } from './types';

// Default configuration
export const defaultConfig: GenAIConfig = {
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
  modelName: 'gemini-2.0-flash',
  maxOutputTokens: 2048,
  temperature: 0.7,
};

// Create and configure the Gemini client
export function createGenAIClient(config: Partial<GenAIConfig> = {}): {
  genAI: GoogleGenerativeAI;
  model: GenerativeModel;
  generativeModel: GenerativeModel; // Alias for backward compatibility
  client: GoogleGenerativeAI;      // Alias for backward compatibility
} {
  // Merge default config with provided config
  const finalConfig = { ...defaultConfig, ...config };
  
  if (!finalConfig.apiKey) {
    console.error('Gemini API key is missing. Please provide it in your environment variables as NEXT_PUBLIC_GEMINI_API_KEY.');
  }
  
  // Initialize the API
  const genAI = new GoogleGenerativeAI(finalConfig.apiKey);
  
  // Get the generative model
  const model = genAI.getGenerativeModel({
    model: finalConfig.modelName,
    generationConfig: {
      maxOutputTokens: finalConfig.maxOutputTokens,
      temperature: finalConfig.temperature,
    },
  });
  
  // Return with aliases for backward compatibility
  return { 
    genAI, 
    model,
    generativeModel: model, // Add alias
    client: genAI          // Add alias
  };
}

// Singleton instance
let clientInstance: ReturnType<typeof createGenAIClient> | null = null;

// Get or create the client instance
export function getGenAIClient(): ReturnType<typeof createGenAIClient> {
  if (!clientInstance) {
    clientInstance = createGenAIClient();
  }
  return clientInstance;
}