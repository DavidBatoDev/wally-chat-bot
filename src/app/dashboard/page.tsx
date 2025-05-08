"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffect } from "react";

export default function DashboardPage() {


  useEffect(() => {
    // navigate to "/"
    window.location.href = "/";
  }
  , []);

  const { user, signOut, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button onClick={signOut} disabled={isLoading} variant="outline">
            {isLoading ? "Signing out..." : "Sign out"}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Welcome back!</CardTitle>
              <CardDescription>{user?.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                You are signed in as {user?.email}
              </p>
            </CardContent>
          </Card>

          {/* Add more dashboard cards here */}
        </div>
      </div>
    </div>
  );
}
