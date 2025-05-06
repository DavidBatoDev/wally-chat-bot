import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';

// Configuration for the Gemini API
interface GeminiConfig {
  apiKey: string;
  modelName: string;
  maxOutputTokens: number;
  temperature: number;
}

// Default configuration
const defaultConfig: GeminiConfig = {
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
  modelName: 'gemini-2.0-flash', // Using the Gemini 2.0 Flash model
  maxOutputTokens: 2048,
  temperature: 0.7, // Controls randomness: 0 = deterministic, 1 = creative
};

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private chatHistory: { role: string; parts: { text: string }[] }[] = [];
  private initialPrompt = "Hi there! I'm Wally, your document assistant. Upload a document and I can help you understand it, translate it, or extract information from it.";

  constructor(config: Partial<GeminiConfig> = {}) {
    // Merge default config with provided config
    const finalConfig = { ...defaultConfig, ...config };
    
    if (!finalConfig.apiKey) {
      console.error('Gemini API key is missing. Please provide it in your environment variables as NEXT_PUBLIC_GEMINI_API_KEY.');
    }
    
    // Initialize the API
    this.genAI = new GoogleGenerativeAI(finalConfig.apiKey);
    
    // Get the generative model
    this.model = this.genAI.getGenerativeModel({
      model: finalConfig.modelName,
      generationConfig: {
        maxOutputTokens: finalConfig.maxOutputTokens,
        temperature: finalConfig.temperature,
      },
    });
    
    // Initialize chat - but don't store any history initially
    this.chatHistory = [];
  }

  /**
   * Send a message to the Gemini API and get a response
   * @param message User's message
   * @returns The AI's response
   */
  async sendMessage(message: string): Promise<string> {
    try {
      // Create a chat session without history first time
      const chat = this.model.startChat();
      
      // If this is the first message, use a special system prompt
      if (this.chatHistory.length === 0) {
        // Add context about the assistant's role
        const systemPrompt = `You are Wally, a helpful document assistant. You help users with their documents, including understanding, 
        translating, or extracting information from documents. Be concise, friendly, and helpful.`;
        
        // Send system prompt as the first message to set the context
        await chat.sendMessage(systemPrompt);
        
        // Immediately return the initial welcome message
        this.chatHistory.push({
          role: 'user',
          parts: [{ text: "Hello" }]
        });
        
        this.chatHistory.push({
          role: 'model',
          parts: [{ text: this.initialPrompt }]
        });
        
        return this.initialPrompt;
      }
      
      // Add user message to history
      this.chatHistory.push({
        role: 'user',
        parts: [{ text: message }]
      });
      
      // Generate a response
      const result = await chat.sendMessage(message);
      const response = result.response;
      const responseText = response.text();
      
      // Add model response to history
      this.chatHistory.push({
        role: 'model',
        parts: [{ text: responseText }]
      });
      
      return responseText;
    } catch (error) {
      console.error('Error generating AI response:', error);
      return "I'm sorry, I encountered an error processing your request. Please try again later.";
    }
  }

  /**
   * Clear the chat history
   */
  clearHistory() {
    this.chatHistory = [];
  }
}

// Create a singleton instance
let geminiService: GeminiService | null = null;

/**
 * Get the GeminiService instance
 */
export const getGeminiService = (): GeminiService => {
  if (!geminiService) {
    geminiService = new GeminiService();
  }
  return geminiService;
};