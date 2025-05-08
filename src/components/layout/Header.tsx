import React from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const Header = () => {
  const { user, profile } = useAuthStore();
  const { signOut } = useAuth();

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
              <Button
                variant="ghost"
                className="w-8 h-8 rounded-full bg-wally text-white flex items-center justify-center hover:bg-wally-dark transition-colors p-0"
              >
                {profile?.full_name?.[0] || user.email?.[0] || "U"}
              </Button>
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="px-4 py-2 text-sm text-gray-700 border-b">
                  {profile?.full_name || user.email}
                </div>
                <div className="py-1">
                  <button
                    onClick={signOut}
                    className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </button>
                </div>
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
