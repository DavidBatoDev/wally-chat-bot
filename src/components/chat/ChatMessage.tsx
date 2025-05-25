// client/src/components/chat/ChatMessage.tsx
"use client";
import React from "react";
import { User, Bot, CheckCheck, Check, AlertCircle, FileText, Download } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { MessageStatus } from "./ChatContainer";

/* ------------------------------------------------------------------ */
/* Types for chat messages                                            */
export interface ChatMessageProps {
  isUser: boolean;
  timestamp: string;
  status?: MessageStatus;
  kind?: string;
  body?: any; // This is now already parsed JSON from the hook
  onButtonClick?: (action: string, values: Record<string, any>) => void;
}

/* ------------------------------------------------------------------ */
/* Status Indicator component                                         */
const StatusIndicator: React.FC<{ status?: MessageStatus }> = ({ status }) => {
  if (!status || status === "delivered") {
    return <CheckCheck size={14} className="text-gray-400" />;
  } else if (status === "sent") {
    return <Check size={14} className="text-gray-400" />;
  } else if (status === "sending") {
    return <div className="w-3 h-3 rounded-full bg-gray-300 animate-pulse" />;
  } else if (status === "error") {
    return <AlertCircle size={14} className="text-red-500" />;
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Bubble component                                                   */
const Bubble: React.FC<{
  children: React.ReactNode;
  isUser: boolean;
}> = ({ children, isUser }) => (
  <div
    className={`rounded-2xl px-4 py-3 ${
      isUser
        ? "bg-wally text-white rounded-tr-none shadow-md"
        : "bg-white text-gray-800 rounded-tl-none shadow-sm border border-gray-100"
    }`}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/* Message content renderers based on kind                           */
const TextMessage: React.FC<{ body: any; isUser: boolean }> = ({ body, isUser }) => {
  const text = body?.text || (typeof body === 'string' ? body : JSON.stringify(body));
  
  return (
    <div className={`prose prose-sm max-w-none ${isUser ? "text-white" : "text-gray-800"}`}>
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
};

const ButtonsMessage: React.FC<{ 
  body: any; 
  onButtonClick?: (action: string, values: Record<string, any>) => void;
}> = ({ body, onButtonClick }) => {
  const { prompt, buttons = [] } = body;
  
  return (
    <div className="space-y-3">
      {prompt && (
        <div className="text-gray-800 mb-3">
          <ReactMarkdown>{prompt}</ReactMarkdown>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {buttons.map((button: any, index: number) => (
          <button
            key={index}
            onClick={() => onButtonClick?.(button.action, {})}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              button.style === 'secondary'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-wally text-white hover:bg-wally/90'
            }`}
          >
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const InputsMessage: React.FC<{ 
  body: any; 
  onButtonClick?: (action: string, values: Record<string, any>) => void;
}> = ({ body, onButtonClick }) => {
  const { prompt, inputs = [], submit_label = "Submit" } = body;
  const [formValues, setFormValues] = React.useState<Record<string, any>>({});
  
  const handleInputChange = (name: string, value: any) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onButtonClick?.('submit_form', formValues);
  };
  
  return (
    <div className="space-y-3">
      {prompt && (
        <div className="text-gray-800 mb-3">
          <ReactMarkdown>{prompt}</ReactMarkdown>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        {inputs.map((input: any, index: number) => (
          <div key={index} className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {input.label}
            </label>
            {input.type === 'select' ? (
              <select
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wally focus:border-transparent"
                onChange={(e) => handleInputChange(input.name, e.target.value)}
                defaultValue={input.default}
              >
                {input.options?.map((option: string) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : input.type === 'radio' ? (
              <div className="space-y-2">
                {input.options?.map((option: string) => (
                  <label key={option} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name={input.name}
                      value={option}
                      defaultChecked={option === input.default}
                      onChange={(e) => handleInputChange(input.name, e.target.value)}
                      className="text-wally focus:ring-wally"
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type={input.type || 'text'}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wally focus:border-transparent"
                onChange={(e) => handleInputChange(input.name, e.target.value)}
                defaultValue={input.default}
              />
            )}
          </div>
        ))}
        <button
          type="submit"
          className="px-4 py-2 bg-wally text-white rounded-lg hover:bg-wally/90 transition-colors"
        >
          {submit_label}
        </button>
      </form>
    </div>
  );
};

const FileCardMessage: React.FC<{ body: any; onButtonClick?: (action: string, values: Record<string, any>) => void }> = ({ body, onButtonClick }) => {
  const { title, summary, thumbnail, status, actions = [] } = body;
  
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {thumbnail ? (
            <img src={thumbnail} alt="File thumbnail" className="w-12 h-12 rounded object-cover" />
          ) : (
            <FileText className="w-12 h-12 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900">{title}</h4>
          {summary && <p className="text-sm text-gray-500 mt-1">{summary}</p>}
          {status && (
            <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${
              status === 'ready' ? 'bg-green-100 text-green-800' :
              status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {status}
            </span>
          )}
        </div>
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          {actions.map((action: any, index: number) => (
            <button
              key={index}
              onClick={() => onButtonClick?.(action.action, {})}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ActionMessage: React.FC<{ body: any }> = ({ body }) => {
  const { action, values } = body;
  
  return (
    <div className="text-sm text-gray-600 italic">
      Action: {action} {values && Object.keys(values).length > 0 && `(${JSON.stringify(values)})`}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main component                                                     */
const ChatMessage: React.FC<ChatMessageProps> = (props) => {
  const { isUser, timestamp, status, kind, body, onButtonClick } = props;
  
  // Render content based on message kind
  const renderContent = () => {
    switch (kind) {
      case 'text':
        return <TextMessage body={body} isUser={isUser} />;
      case 'buttons':
        return <ButtonsMessage body={body} onButtonClick={onButtonClick} />;
      case 'inputs':
        return <InputsMessage body={body} onButtonClick={onButtonClick} />;
      case 'file_card':
        return <FileCardMessage body={body} onButtonClick={onButtonClick} />;
      case 'action':
        return <ActionMessage body={body} />;
      default:
        // Fallback for unknown kinds - treat as text
        return <TextMessage body={body} isUser={isUser} />;
    }
  };

  // Avatar component
  const Avatar = (
    <div
      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? "bg-wally text-white shadow-md" : "bg-gray-100 text-gray-600"
      }`}
    >
      {isUser ? <User size={16} /> : <Bot size={16} />}
    </div>
  );

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      data-status={status}
    >
      <div
        className={`flex ${
          isUser ? "flex-row-reverse" : "flex-row"
        } items-start max-w-[85%] md:max-w-[75%] gap-2`}
      >
        {Avatar}
        <div
          className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
        >
          <Bubble isUser={isUser}>
            {renderContent()}
          </Bubble>
          
          <div className="flex items-center space-x-1 mt-1 text-xs text-gray-400">
            <span suppressHydrationWarning>{timestamp}</span>
            {isUser && <StatusIndicator status={status} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;