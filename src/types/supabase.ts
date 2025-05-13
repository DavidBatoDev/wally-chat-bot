export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender: "user" | "assistant" | "model";
          kind: "text" | "file" | "file_card" | "buttons" | "inputs" | "action";
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender: "user" | "assistant" | "model";
          kind: "text" | "file" | "file_card" | "buttons" | "inputs" | "action";
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender?: "user" | "assistant" | "model";
          kind?:
            | "text"
            | "file"
            | "file_card"
            | "buttons"
            | "inputs"
            | "action";
          body?: string;
          created_at?: string;
        };
      };
    };
  };
}
