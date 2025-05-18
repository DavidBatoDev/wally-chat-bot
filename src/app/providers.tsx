
// client/src/app/providers.tsx
"use client";

import { ReactNode, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useAuthStore } from "@/lib/store/AuthStore";
import { usePathname, useRouter } from "next/navigation";
import { AuthInitializer } from '@/components/auth/AuthInitializer';

// function AuthSync() {
//   const { user, session } = useAuthStore();
//   const router = useRouter();
//   const pathname = usePathname();
  
//   // List of paths that don't require authentication
//   const publicPaths = [
//     '/auth/login',
//     '/auth/signup',
//     '/auth/forgot-password',
//     '/auth/reset-password',
//   ];
  
//   useEffect(() => {
//     // Skip redirect if we're already on a public path
//     const isPublicPath = publicPaths.some(path => pathname?.startsWith(path));

//     // If no user and we're not on a public path, redirect to login
//     if (!user && !session && pathname && !isPublicPath) {
//       router.push('/auth/login');
//     }
    
//   }, [user, session, pathname, router]);

//   return null;
// }

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthInitializer />
        {children}
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}