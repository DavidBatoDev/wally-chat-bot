import React from 'react';
import { Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  isConnected: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected }) => {
  return (
    <div className="flex items-center space-x-2">
      {isConnected ? (
        <div className="flex items-center space-x-1 text-green-600">
          <Wifi className="h-4 w-4" />
          <span className="text-xs font-medium">Live</span>
        </div>
      ) : (
        <div className="flex items-center space-x-1 text-gray-400">
          <WifiOff className="h-4 w-4" />
          <span className="text-xs font-medium">Connecting...</span>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
