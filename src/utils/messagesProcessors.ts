// client/src/lib/utils/messageProcessor.ts

import { Message } from "@/components/chat/ChatContainer";

export interface ProcessedMessage extends Message {
  displayText?: string;
  processedBody?: any;
  messageVersion?: number;
  referredMessageId?: string;
  clientId?: string;
}

/**
 * Safely parses message body JSON
 */
function parseMessageBody(body: any): any {
  if (!body) return null;
  
  try {
    return typeof body === 'string' ? JSON.parse(body) : body;
  } catch (error) {
    console.warn('Failed to parse message body:', error);
    return null;
  }
}

/**
 * Attempts to parse a string that might contain JSON
 */
function tryParseJsonString(str: string): any {
  if (!str || typeof str !== 'string') return null;
  
  // Check if string looks like JSON (starts with { or [)
  const trimmed = str.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Extracts display text from message body or falls back to original text
 */
function extractDisplayText(message: Message, parsedBody: any): string {
  // Priority order for extracting display text:
  // 1. parsedBody.text (for kind="text")
  // 2. parsedBody.prompt (for buttons/inputs)
  // 3. Parse message.text if it's JSON and extract text
  // 4. message.text (fallback)
  // 5. Generate based on message type
  
  if (parsedBody) {
    // For text messages, use body.text
    if (parsedBody.text) {
      return parsedBody.text;
    }
    
    // For interactive messages, use prompt
    if (parsedBody.prompt) {
      return parsedBody.prompt;
    }
    
    // For file messages, generate description
    if (parsedBody.name && parsedBody.mime) {
      return `File: ${parsedBody.name} (${parsedBody.mime})`;
    }
    
    // For file cards, use title
    if (parsedBody.title) {
      return parsedBody.title;
    }
    
    // For actions, describe the action
    if (parsedBody.action) {
      return `Action: ${parsedBody.action}`;
    }
  }
  
  // Try to parse message.text if it looks like JSON
  if (message.text) {
    const parsedText = tryParseJsonString(message.text);
    if (parsedText && parsedText.text) {
      return parsedText.text;
    }
  }
  
  // Fallback to original text
  return message.text || 'No content';
}

/**
 * Determines the message kind based on body content if not explicitly set
 */
function inferMessageKind(body: any, originalKind?: string, messageText?: string): string {
  if (originalKind) return originalKind;
  
  // Check if messageText contains JSON that we should parse
  if (messageText) {
    const parsedText = tryParseJsonString(messageText);
    if (parsedText) {
      body = parsedText; // Use parsed text as body for inference
    }
  }
  
  if (!body) return 'text';
  
  // Infer kind from body structure
  if (body.text) return 'text';
  if (body.file_id && body.name) return 'file';
  if (body.file_id && body.title && body.status) return 'file_card';
  if (body.buttons && Array.isArray(body.buttons)) return 'buttons';
  if (body.inputs && Array.isArray(body.inputs)) return 'inputs';
  if (body.action) return 'action';
  
  return 'text';
}

/**
 * Processes and normalizes message data for consistent display
 */
export function processMessage(message: Message): ProcessedMessage {
  const processed: ProcessedMessage = { ...message };

  // Parse the body
  let parsedBody = parseMessageBody(message.body);
  
  // If body is null but text looks like JSON, try parsing text as body
  if (!parsedBody && message.text) {
    const parsedText = tryParseJsonString(message.text);
    if (parsedText) {
      parsedBody = parsedText;
    }
  }
  
  processed.processedBody = parsedBody;

  // Determine the correct kind
  processed.kind = inferMessageKind(parsedBody, message.kind, message.text);

  if (parsedBody) {
    // Extract envelope metadata
    processed.messageVersion = parsedBody.v;
    processed.clientId = parsedBody.id;
    processed.referredMessageId = parsedBody.refers_to;
  }

  // Extract display text
  processed.displayText = extractDisplayText(message, parsedBody);

  return processed;
}

/**
 * Validates and provides defaults for message structure
 */
export function validateMessage(message: Partial<Message>): Message {
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  return {
    id: message.id || generateMessageId(),
    isUser: message.isUser ?? false,
    text: message.text || '',
    timestamp: message.timestamp || now,
    status: message.status || (message.isUser ? 'delivered' : undefined),
    kind: message.kind || 'text',
    body: message.body || null,
    sender: message.sender || (message.isUser ? 'user' : 'assistant')
  };
}

/**
 * Generates a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitizes message content for safe display
 */
export function sanitizeMessage(message: ProcessedMessage): ProcessedMessage {
  const sanitized = { ...message };

  // Basic XSS prevention - strip potentially dangerous content
  if (sanitized.displayText) {
    sanitized.displayText = sanitized.displayText
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  return sanitized;
}

/**
 * Main processing function that combines all steps
 */
export function prepareMessageForDisplay(message: Message): ProcessedMessage {
  try {
    const validated = validateMessage(message);
    const processed = processMessage(validated);
    const sanitized = sanitizeMessage(processed);
    
    return sanitized;
  } catch (error) {
    console.error('Error processing message:', error);
    // Return a fallback message that won't break the UI
    return {
      ...message,
      displayText: message.text || 'Error processing message',
      processedBody: null,
      kind: 'text'
    };
  }
}

/**
 * Batch process messages for display
 */
export function prepareMessagesForDisplay(messages: Message[]): ProcessedMessage[] {
  return messages.map(prepareMessageForDisplay);
}