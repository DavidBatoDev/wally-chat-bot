"use client";

import { ReactNode, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useAuthStore } from "@/lib/store/AuthStore";

function AuthSync() {
  // const syncAuth = useAuthStore((state) => state.syncAuth);

  // useEffect(() => {
  //   syncAuth();
  // }, [syncAuth]);

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthSync />
        {children}
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
