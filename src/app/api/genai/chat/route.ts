// src/app/api/genai/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { processTextChat } from "@/lib/langchain";
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
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error(
        "API Error: Google API key is missing in environment variables"
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

    // Process the chat messages using our LangChain implementation
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
        } else {
          // Handle any other tool calls that might be added in the future
          console.log(`Unhandled tool call: ${toolCallData.name}`, toolCallData);
          messages.push({
            role: "model",
            kind: "text",
            content: `I tried to perform an action (${toolCallData.name}), but I'm not sure how to handle it yet.`,
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

/**
 * Streaming API route - creates a streaming response
 * This demonstrates how to use LangChain with streaming responses
 */
export async function POST_streaming(request: NextRequest) {
  try {
    // Parse the request body
    const requestData: ChatRequest = await request.json();

    if (!requestData.messages || requestData.messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      );
    }

    // Create a TransformStream for streaming the response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start processing the chat in the background
    (async () => {
      try {
        await processTextChat(requestData.messages, {
          temperature: requestData.options?.temperature,
          maxOutputTokens: requestData.options?.maxOutputTokens,
          retrievalOptions: requestData.options?.retrievalOptions,
          streaming: true,
          onStreamChunk: async (chunk) => {
            // Encode and write each chunk to the stream
            await writer.write(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          },
        });

        // Signal the end of the stream
        await writer.write(encoder.encode('data: [DONE]\n\n'));
        await writer.close();
      } catch (err) {
        // Handle errors during streaming
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
        );
        await writer.close();
      }
    })();

    // Return the stream as a response
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    // Handle errors in the initial request processing
    return NextResponse.json(
      {
        error: "Failed to start streaming",
        message: error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}