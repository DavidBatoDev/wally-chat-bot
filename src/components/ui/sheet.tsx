"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SheetContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextType | null>(null);

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const Sheet: React.FC<SheetProps> = ({ open = false, onOpenChange, children }) => {
  return (
    <SheetContext.Provider value={{ open, onOpenChange: onOpenChange || (() => {}) }}>
      {children}
    </SheetContext.Provider>
  );
};

// Simplified trigger and close components
const SheetTrigger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const context = React.useContext(SheetContext);
  return (
    <div onClick={() => context?.onOpenChange(true)}>
      {children}
    </div>
  );
};

const SheetClose: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const context = React.useContext(SheetContext);
  return (
    <div onClick={() => context?.onOpenChange(false)}>
      {children}
    </div>
  );
};

interface SheetContentProps {
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

const SheetContent: React.FC<SheetContentProps> = ({ 
  side = "right", 
  className, 
  children 
}) => {
  const context = React.useContext(SheetContext);
  
  if (!context?.open) return null;
  
  const sideClasses = {
    top: "inset-x-0 top-0 border-b",
    bottom: "inset-x-0 bottom-0 border-t",
    left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
    right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => context.onOpenChange(false)}
      />
      
      {/* Sheet Content */}
      <div
        className={cn(
          "fixed z-50 gap-4 bg-background p-6 shadow-lg transition-all duration-300",
          sideClasses[side],
          className
        )}
      >
        {children}
        <button
          onClick={() => context.onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </>
  );
};

const SheetHeader: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
  >
    {children}
  </div>
);

const SheetFooter: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
  >
    {children}
  </div>
);

const SheetTitle: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => (
  <h2 className={cn("text-lg font-semibold text-foreground", className)}>
    {children}
  </h2>
);

const SheetDescription: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => (
  <p className={cn("text-sm text-muted-foreground", className)}>
    {children}
  </p>
);

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}; 