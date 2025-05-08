import React, { useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth";
import { supabase } from "@/lib/supabase/client";

const Header = () => {
  const { user, profile, syncAuth } = useAuthStore();

  useEffect(() => {
    // Initial sync
    syncAuth();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        await syncAuth();
      }
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [syncAuth]);

  return (
    <header className="bg-white border-b border-gray-100 py-3 px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full wally-gradient flex items-center justify-center text-white font-bold">
            W
          </div>
          <h1 className="text-lg font-medium">
            Document Understanding with Wally
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          <button className="text-sm text-gray-600 px-3 py-1 rounded-md hover:bg-gray-100 transition-colors">
            Help
          </button>
          {user ? (
            <div className="relative group">
              <button className="w-8 h-8 rounded-full bg-wally text-white flex items-center justify-center hover:bg-wally-dark transition-colors">
                {profile?.full_name?.[0] || user.email?.[0] || "U"}
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 hidden group-hover:block">
                <div className="px-4 py-2 text-sm text-gray-700 border-b">
                  {profile?.full_name || user.email}
                </div>
                <Link
                  href="/dashboard"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Dashboard
                </Link>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    await syncAuth();
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="bg-wally text-white text-sm px-4 py-1.5 rounded-md hover:bg-wally-dark transition-colors"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
