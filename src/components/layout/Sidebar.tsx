
import React from 'react';
import { MessageSquare, History, Settings } from 'lucide-react';

const Sidebar = () => {
  // Navigation items for sidebar
  const navItems = [
    { icon: MessageSquare, label: 'Chat', active: true },
    { icon: History, label: 'History', active: false },
    { icon: Settings, label: 'Settings', active: false },
  ];

  return (
    <aside className="w-16 md:w-20 h-full bg-gray-50 border-r border-gray-100 flex flex-col items-center py-6">
      {navItems.map((item, index) => (
        <button
          key={index}
          className={`flex flex-col items-center justify-center w-12 h-12 mb-6 rounded-xl transition-all ${
            item.active
              ? 'bg-wally-50 text-wally'
              : 'text-gray-500 hover:text-wally hover:bg-wally-50'
          }`}
        >
          <item.icon size={20} />
          <span className="text-xs mt-1">{item.label}</span>
        </button>
      ))}
    </aside>
  );
};

export default Sidebar;
