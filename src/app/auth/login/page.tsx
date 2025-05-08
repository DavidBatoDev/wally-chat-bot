"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import NBIIDMockup from "@/assets/images/nbi-id-mockup.png";

// Animation states for the demo sequence - match signup page
const DEMO_STATES = {
  CHAT: "chat",
  UPLOAD: "upload",
  SCANNING: "scanning",
  ID_CARD: "id_card"
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoState, setDemoState] = useState(DEMO_STATES.CHAT);

  // Control the animation sequence - match signup page
  useEffect(() => {
    const interval = setInterval(() => {
      setDemoState(current => {
        switch (current) {
          case DEMO_STATES.CHAT:
            return DEMO_STATES.UPLOAD;
          case DEMO_STATES.UPLOAD:
            return DEMO_STATES.SCANNING;
          case DEMO_STATES.SCANNING:
            return DEMO_STATES.ID_CARD;
          case DEMO_STATES.ID_CARD:
            return DEMO_STATES.CHAT;
          default:
            return DEMO_STATES.CHAT;
        }
      });
    }, 3000); // Change state every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast.success("Logged in successfully!");
      router.push("/dashboard");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred during login";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex">
      {/* Left side - Mockup */}
      <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-4">
          <div>
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-wally flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">W</span>
              </div>
            </div>
            <h2 className="mt-4 text-center text-2xl font-bold text-gray-900">
              Welcome back
            </h2>
            <p className="mt-1 text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link
                href="/auth/signup"
                className="font-medium text-wally hover:text-wally-dark"
              >
                Sign up
              </Link>
            </p>
          </div>
          <form className="mt-4 space-y-4" onSubmit={handleLogin}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-wally focus:border-wally focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-wally focus:border-wally focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-wally focus:ring-wally border-gray-300 rounded"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a
                  href="#"
                  className="font-medium text-wally hover:text-wally-dark"
                >
                  Forgot password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-wally hover:bg-wally-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wally disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </span>
                ) : (
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <svg
                      className="h-5 w-5 text-wally-light group-hover:text-wally-50"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                )}
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>

          <div className="text-center text-xs text-gray-500">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="text-wally hover:text-wally-dark">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-wally hover:text-wally-dark">
              Privacy
            </Link>
          </div>
        </div>
      </div>

      {/* Right side - Form*/}
      <div className="hidden lg:block lg:w-1/2 bg-gradient-to-br from-wally-50 to-wally-100">
        <div className="h-full flex flex-col justify-center p-6">
          <div className="max-w-lg mx-auto w-full">
            {/* Wally Chat Component */}
            {demoState === DEMO_STATES.CHAT && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-wally flex items-center justify-center shadow-md">
                      <span className="text-white text-sm font-bold">W</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-gray-700 text-sm">
                      Welcome to Wally! I'm your AI document assistant that can translate, process, and extract information from your documents instantly.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-1 bg-wally-dark rounded-lg p-3 shadow-sm">
                    <p className="text-white text-sm">
                      Can you help me translate my ID card from Spanish to English?
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center shadow-md">
                      <span className="text-gray-600 text-sm font-bold">U</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-wally flex items-center justify-center shadow-md">
                      <span className="text-white text-sm font-bold">W</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-gray-700 text-sm">
                      Absolutely! Just upload your ID card and I'll translate it for you. Let me show you how it works.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Document UI - appears after chat */}
            {demoState === DEMO_STATES.UPLOAD && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-wally flex items-center justify-center shadow-md">
                      <span className="text-white text-sm font-bold">W</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-gray-700 text-sm">
                      Please upload your document now.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6 animate-fade-in">
                  <div className="flex flex-col items-center">
                    <div className="h-16 w-16 rounded-full bg-wally-50 flex items-center justify-center mb-4">
                      <svg className="h-8 w-8 text-wally" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Upload your ID document</h3>
                    <p className="text-sm text-gray-500 text-center mb-4">
                      Drag and drop your file here, or click to browse
                    </p>
                    <button className="px-4 py-2 bg-wally text-white rounded-md hover:bg-wally-dark focus:outline-none focus:ring-2 focus:ring-wally focus:ring-offset-2 transition-colors animate-pulse">
                      Select Document
                    </button>
                    <p className="text-xs text-gray-400 mt-4">
                      Supported formats: JPG, PNG, PDF (max 10MB)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Scanning Document UI */}
            {demoState === DEMO_STATES.SCANNING && (
              <div className="bg-white rounded-lg shadow-lg p-3 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900">
                    Document Processing
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-medium text-white bg-wally rounded-full">
                    Scanning...
                  </span>
                </div>
                <div className="relative aspect-video bg-gray-50 rounded-md overflow-hidden">
                  <div className="absolute inset-0">
                    <div className="h-full w-full flex items-center justify-center">
                      <div className="animate-pulse bg-white/80 absolute inset-0 z-10"></div>
                      <img 
                        className="object-cover w-full h-full" 
                        src={NBIIDMockup.src} 
                        alt="ID Card Scan" 
                      />
                      <div className="absolute inset-0 border-2 border-wally animate-scan"></div>
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 z-20">
                    <div className="flex items-center space-x-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded-full">
                      <svg
                        className="h-3 w-3 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      <span>Analyzing document structure...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ID Card with Detection Boxes */}
            {demoState === DEMO_STATES.ID_CARD && (
              <div className="bg-white rounded-lg shadow-lg p-3 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900">
                    ID Card Translation
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-medium text-white bg-green-500 rounded-full">
                    Fields Detected
                  </span>
                </div>
                <div className="relative aspect-[1.6/1] bg-gray-50 rounded-md overflow-hidden">
                  <div className="absolute inset-0">
                    {/* Realistic ID Card */}
                    <img 
                        className="object-cover w-full h-full" 
                        src={NBIIDMockup.src} 
                        alt="ID Card Scan" 
                      />
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="flex items-center justify-center space-x-2 text-xs text-white bg-wally/90 px-3 py-1 rounded-full">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      <span>All fields detected and ready for translation</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}