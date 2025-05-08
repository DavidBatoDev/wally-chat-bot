"use client";

import LoginForm from "@/components/auth/LoginForm";
import DemoUI from "@/components/auth/DemoUI";

export default function LoginPage() {
  return (
    <div className="h-screen flex">
      {/* Left side - Form */}
      <LoginForm />

      {/* Right side - Demo UI */}
      <div className="hidden lg:block lg:w-1/2 bg-gradient-to-br from-wally-50 to-wally-100">
        <DemoUI />
      </div>
    </div>
  );
}
