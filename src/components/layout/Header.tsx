
import React from 'react';

const Header = () => {
  return (
    <header className="bg-white border-b border-gray-100 py-3 px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full wally-gradient flex items-center justify-center text-white font-bold">
            W
          </div>
          <h1 className="text-lg font-medium">Document Understanding with Wally</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="text-sm text-gray-600 px-3 py-1 rounded-md hover:bg-gray-100 transition-colors">
            Help
          </button>
          <button className="bg-wally text-white text-sm px-4 py-1.5 rounded-md hover:bg-wally-dark transition-colors">
            Upgrade
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
