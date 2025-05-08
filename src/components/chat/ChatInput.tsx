import React, { useState } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage }) => {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  return (
    <div className="border-t border-gray-100 p-4 bg-white">
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="flex items-center">
          <div className="relative w-full">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border border-gray-200 rounded-full py-3 px-4 pr-12 outline-none focus:ring-2 focus:ring-wally-200 transition-all shadow-sm"
              placeholder="Can you translate my document?"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 transform -translate-y-1/2 bg-wally text-white p-2 rounded-full hover:bg-wally-dark transition-colors"
              disabled={!message.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInput;
