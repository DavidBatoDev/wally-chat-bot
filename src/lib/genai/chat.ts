import { ChatMessage, ChatOptions } from "@/lib/genai/types";
import { GoogleGenerativeAI } from "@google/generative-ai";

function mapToGemini(
  messages: ChatMessage[]
): { role: "user" | "model"; parts: { text: string }[] }[] {
  return messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));
}

export async function processTextChat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing Google API key");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Non-streaming simple generate
  const history = mapToGemini(messages);
  const prompt =
    history.length > 0 ? history[history.length - 1].parts[0].text : "";

  // If caller requests streaming, emulate by chunking on sentences for now
  if (options.streaming && options.onStreamChunk) {
    const res = await model.generateContent({ contents: history });
    const text = res.response.text();
    // naive chunking
    const chunks = text.split(/(?<=[.!?])\s+/);
    for (const chunk of chunks) {
      if (chunk) await options.onStreamChunk(chunk);
    }
    return text;
  }

  const res = await model.generateContent({ contents: history });
  return res.response.text();
}
