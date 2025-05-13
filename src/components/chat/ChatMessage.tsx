// src/components/chat/ChatMessage.tsx
import React, { useState } from "react";
import { User, Bot, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/* Type for any chat row                                              */
export interface ChatMessageProps {
  kind: "text" | "file_card" | "buttons" | "inputs" | "file";
  isUser: boolean;
  timestamp: string;

  /** TEXT  */
  text?: string;

  /** FILE CARD */
  fileCard?: {
    fileId: string;
    versionId: string;
    rev: number;
    title: string;
    thumbUrl?: string;
  };
  onOpenFileCard?: (fileId: string, versionId: string) => void;

  /** BUTTONS  */
  prompt?: string;
  buttons?: { label: string; action: string }[];
  onButton?: (action: string) => void;

  /** INPUTS */
  inputs?: { key: string; label: string; type?: string }[];
  onInputs?: (values: Record<string, string>) => void;

  /** FILE bubble (raw attachment) */
  file?: { fileId: string; displayName?: string };

  /** Special Drop-zone you were already passing for first-turn */
  dropzone?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */

const Bubble: React.FC<{
  children: React.ReactNode;
  isUser: boolean;
}> = ({ children, isUser }) => (
  <div
    className={`rounded-lg px-4 py-2 ${
      isUser
        ? "bg-wally text-white rounded-tr-none"
        : " text-gray-800 rounded-tl-none"
    }`}
  >
    {children}
  </div>
);

const TextMessage: React.FC<ChatMessageProps> = ({ text, isUser }) => (
  <Bubble isUser={isUser}>{text}</Bubble>
);

const ButtonsMessage: React.FC<ChatMessageProps> = ({
  prompt,
  buttons = [],
  onButton,
  isUser,
}) => (
  <Bubble isUser={isUser}>
    <p className="mb-2">{prompt}</p>
    <div className="flex flex-wrap gap-2">
      {buttons.map((b) => (
        <Button
          key={b.action}
          size="sm"
          onClick={() => onButton?.(b.action)}
          className="whitespace-nowrap"
        >
          {b.label}
        </Button>
      ))}
    </div>
  </Bubble>
);

const InputsMessage: React.FC<ChatMessageProps> = ({
  prompt,
  inputs = [],
  onInputs,
  isUser,
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const submit = () => onInputs?.(values);

  return (
    <Bubble isUser={isUser}>
      <p className="mb-2">{prompt}</p>
      {inputs.map((inp) => (
        <input
          key={inp.key}
          type={inp.type ?? "text"}
          placeholder={inp.label}
          className="w-full border p-1 mb-2 text-sm"
          onChange={(e) =>
            setValues((v) => ({ ...v, [inp.key]: e.target.value }))
          }
        />
      ))}
      <Button size="sm" onClick={submit}>
        Submit
      </Button>
    </Bubble>
  );
};

const FileCardMessage: React.FC<ChatMessageProps> = ({
  fileCard,
  onOpenFileCard,
}) => {
  if (!fileCard) return null;
  return (
    <Card
      className="cursor-pointer w-60"
      onClick={() => onOpenFileCard?.(fileCard.fileId, fileCard.versionId)}
    >
      <CardHeader className="flex flex-row items-center gap-2">
        <File size={16} />{" "}
        <CardTitle className="text-sm">{fileCard.title}</CardTitle>
      </CardHeader>
      {fileCard.thumbUrl && (
        <img src={fileCard.thumbUrl} className="w-full h-28 object-cover" />
      )}
      <CardContent className="text-xs text-gray-500">
        Revision {fileCard.rev}
      </CardContent>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* Main switch                                                         */

const ChatMessage: React.FC<ChatMessageProps> = (props) => {
  const { isUser, timestamp, dropzone } = props;

  // Avatar bubble
  const Avatar = (
    <div
      className={`flex-shrink-0 hidden w-8 h-8 rounded-full items-center justify-center ${
        isUser ? "bg-wally text-white" : "bg-gray-100 text-gray-600"
      }`}
    >
      {isUser ? <User size={16} /> : <Bot size={16} />}
    </div>
  );

  // Choose renderer
  let body: React.ReactNode;
  switch (props.kind) {
    case "text":
      body = <TextMessage {...props} />;
      break;
    case "buttons":
      body = <ButtonsMessage {...props} />;
      break;
    case "inputs":
      body = <InputsMessage {...props} />;
      break;
    case "file_card":
      body = <FileCardMessage {...props} />;
      break;
    case "file":
      body = (
        <Bubble isUser={isUser}>
          <File size={16} className="inline mr-1" />
          {props.file?.displayName ?? "Attachment"}
        </Bubble>
      );
      break;
    default:
      body = <Bubble isUser={isUser}>Unsupported message</Bubble>;
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`flex ${
          isUser ? "flex-row-reverse" : "flex-row"
        } items-start max-w-[80%]`}
      >
        {Avatar}
        <div
          className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
        >
          {body}
          {dropzone && <div className="mt-2 w-full max-w-md">{dropzone}</div>}
          <span className="text-xs text-gray-500 mt-1" suppressHydrationWarning>
            {timestamp}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
