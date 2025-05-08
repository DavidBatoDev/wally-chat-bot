"use client";

import SignupForm from "@/components/auth/SignupForm";
import DemoUI from "@/components/auth/DemoUI";

export default function SignUpPage() {
  return (
    <div className="h-screen flex">
      {/* Left side - Demo UI */}
      <div className="hidden lg:block lg:w-1/2 bg-gradient-to-br from-wally-50 to-wally-100">
        <DemoUI />
      </div>

      {/* Right side - Form */}
      <SignupForm />
    </div>
  );
}
