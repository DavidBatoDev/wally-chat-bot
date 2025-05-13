import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/types/supabase";

// Type definitions for message payloads
type TextPayload = string | { text: string };
type FilePayload = { file_id: string; display_name?: string };
type FileCardPayload = {
  file_id: string;
  version_id: string;
  rev: number;
  title: string;
  thumb_url?: string;
};
type ButtonPayload = {
  prompt: string;
  buttons: Array<{ label: string; action: string }>;
};
type InputPayload = {
  prompt: string;
  inputs: Array<{ key: string; label: string }>;
};
type ActionPayload = {
  action: string;
  values?: Record<string, any>;
  status?: "success" | "error" | "pending";
  meta?: Record<string, any>;
};

// Union type for all possible payloads
type MessagePayload =
  | TextPayload
  | FilePayload
  | FileCardPayload
  | ButtonPayload
  | InputPayload
  | ActionPayload;

// Message kind type
type MessageKind =
  | "text"
  | "file"
  | "file_card"
  | "buttons"
  | "inputs"
  | "action";

// Message sender type
type MessageSender = "user" | "assistant" | "model";

interface InsertMessageParams {
  conversation_id: string;
  sender: MessageSender;
  kind: MessageKind;
  body: MessagePayload;
}

/**
 * Inserts a new message into the messages table
 * @param params Message parameters including conversation_id, sender, kind, and body
 * @returns The inserted message or null if there was an error
 */
export async function insertMessage(params: InsertMessageParams) {
  const supabase = createClientComponentClient<Database>();

  // Convert body to string if it's an object
  const bodyString =
    typeof params.body === "string" ? params.body : JSON.stringify(params.body);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversation_id,
      sender: params.sender,
      kind: params.kind,
      body: bodyString,
    })
    .select()
    .single();

  if (error) {
    console.error("Error inserting message:", error);
    return null;
  }

  return data;
}

/**
 * Helper function to insert a text message
 */
export async function insertTextMessage(
  conversation_id: string,
  sender: MessageSender,
  text: string
) {
  return insertMessage({
    conversation_id,
    sender,
    kind: "text",
    body: text,
  });
}

/**
 * Helper function to insert a file message
 */
export async function insertFileMessage(
  conversation_id: string,
  sender: MessageSender,
  file_id: string,
  display_name?: string
) {
  return insertMessage({
    conversation_id,
    sender,
    kind: "file",
    body: { file_id, display_name },
  });
}

/**
 * Helper function to insert a file card message
 */
export async function insertFileCardMessage(
  conversation_id: string,
  sender: MessageSender,
  file_id: string,
  version_id: string,
  rev: number,
  title: string,
  thumb_url?: string
) {
  return insertMessage({
    conversation_id,
    sender,
    kind: "file_card",
    body: { file_id, version_id, rev, title, thumb_url },
  });
}

/**
 * Helper function to insert a buttons message
 */
export async function insertButtonsMessage(
  conversation_id: string,
  sender: MessageSender,
  prompt: string,
  buttons: Array<{ label: string; action: string }>
) {
  return insertMessage({
    conversation_id,
    sender,
    kind: "buttons",
    body: { prompt, buttons },
  });
}

/**
 * Helper function to insert an inputs message
 */
export async function insertInputsMessage(
  conversation_id: string,
  sender: MessageSender,
  prompt: string,
  inputs: Array<{ key: string; label: string }>
) {
  return insertMessage({
    conversation_id,
    sender,
    kind: "inputs",
    body: { prompt, inputs },
  });
}

/**
 * Helper function to insert an action message
 */
export async function insertActionMessage(
  conversation_id: string,
  sender: MessageSender,
  action: string,
  values?: Record<string, any>,
  status?: "success" | "error" | "pending",
  meta?: Record<string, any>
) {
  return insertMessage({
    conversation_id,
    sender,
    kind: "action",
    body: { action, values, status, meta },
  });
}
