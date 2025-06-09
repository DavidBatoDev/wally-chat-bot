// client/src/components/chat/messages/ActionMessage.tsx
"use client";
import React from "react";

interface ActionMessageProps {
  body: any;
}

const ActionMessage: React.FC<ActionMessageProps> = ({ body }) => {
  const { action, values } = body;
  
  return (
    <div className="text-sm text-gray-600 italic p-3">
      Action: {action} {values && Object.keys(values).length > 0 && `(${JSON.stringify(values)})`}
    </div>
  );
};

export default ActionMessage;