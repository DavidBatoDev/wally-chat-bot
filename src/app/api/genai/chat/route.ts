// src/app/api/genai/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { processTextChat } from "@/lib/genai/text";
import { ChatRequest, ChatResponse, ChatMessage } from "@/lib/genai/types";

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const requestData: ChatRequest = await request.json();

    if (!requestData.messages || requestData.messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      );
    }

    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      console.error(
        "API Error: Gemini API key is missing in environment variables"
      );
      return NextResponse.json(
        {
          error: "API configuration error",
          message:
            "The service is not properly configured. Please check server environment variables.",
        },
        { status: 500 }
      );
    }

    // Process the chat messages
    const result = await processTextChat(requestData.messages, {
      temperature: requestData.options?.temperature,
      maxOutputTokens: requestData.options?.maxOutputTokens,
      retrievalOptions: requestData.options?.retrievalOptions,
      streaming: false, // Ensure we're not using streaming in this handler
    });

    // Check if the result is a tool call (JSON string)
    if (
      typeof result === "string" &&
      result.startsWith("{") &&
      (result.includes('"name"') || result.includes('"function"'))
    ) {
      try {
        // Parse the tool call response
        const toolCallData = JSON.parse(result);

        // Convert tool call to appropriate message format
        const messages: ChatMessage[] = [];

        if (toolCallData.name === "ui.buttons") {
          messages.push({
            role: "model",
            kind: "buttons",
            content: "", // Legacy field
            body: JSON.stringify({
              prompt: toolCallData.args.prompt,
              buttons: toolCallData.args.buttons,
            }),
          });
        } else if (toolCallData.name === "ui.request_inputs") {
          messages.push({
            role: "model",
            kind: "inputs",
            content: "",
            body: JSON.stringify({
              prompt: toolCallData.args.prompt,
              inputs: toolCallData.args.inputs,
            }),
          });
        } else if (toolCallData.name === "backend.translate_doc") {
          messages.push({
            role: "model",
            kind: "text",
            content: `I'll translate your document (ID: ${toolCallData.args.file_id}) to ${toolCallData.args.target_lang}. This may take a moment.`,
          });
        }

        return NextResponse.json({ messages });
      } catch (parseError) {
        console.error("Error parsing tool call:", parseError);
        // Fallback if JSON parsing fails
        return NextResponse.json({
          messages: [
            {
              role: "model",
              kind: "text",
              content:
                "I had trouble processing your request. Please try again.",
            },
          ],
        });
      }
    } else {
      // Regular text response
      return NextResponse.json({
        messages: [
          {
            role: "model",
            kind: "text",
            content: result,
          },
        ],
      });
    }
  } catch (error) {
    console.error("Error in chat API:", error);

    return NextResponse.json(
      {
        error: "Failed to process your request",
        message:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
