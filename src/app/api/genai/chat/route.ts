// src/app/api/genai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processTextChat } from '@/lib/genai/text';
import { ChatRequest, ChatResponse } from '@/lib/genai/types';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const requestData: ChatRequest = await request.json();
    
    if (!requestData.messages || requestData.messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 }
      );
    }
    
    // Check if API key is available
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      console.error('API Error: Gemini API key is missing in environment variables');
      return NextResponse.json(
        { 
          error: 'API configuration error',
          message: 'The service is not properly configured. Please check server environment variables.'
        },
        { status: 500 }
      );
    }
    
    // Process the chat messages
    const responseText = await processTextChat(
      requestData.messages,
      requestData.options
    );
    
    // Construct the response
    const responseData: ChatResponse = {
      message: responseText
    };
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in chat API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process your request',
        message: 'I encountered an error processing your request. Please try again later.'
      },
      { status: 500 }
    );
  }
}