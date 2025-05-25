// client/user-diagnostic/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store/AuthStore';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; details: any } | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<{
    timestamp: string;
    hasSession: boolean;
    hasUser: boolean;
    hasToken: boolean;
    tokenPreview: string | null;
    sessionExpiry: string | null;
  } | null>(null);
  
  // Get auth data from store
  const { user: authUser, session, getAuthToken, refreshSession } = useAuthStore();
  
  useEffect(() => {
    // Try refreshing the session first
    async function initializeAuth() {
      console.log('Initializing auth...');
      if (!session) {
        console.log('No session found, attempting to refresh...');
        await refreshSession();
      } else {
        console.log('Session exists:', session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'unknown expiry');
      }
    }
    
    initializeAuth();
  }, [refreshSession, session]);
  
  useEffect(() => {
    async function fetchUser() {
      setLoading(true);
      
      // Create diagnostic information
      const diagnostics = {
        timestamp: new Date().toISOString(),
        hasSession: !!session,
        hasUser: !!authUser,
        hasToken: !!getAuthToken(),
        tokenPreview: getAuthToken() ? `${getAuthToken()?.substring(0, 10) || ''}...` : null,
        sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : null
      };
      
      setDiagnosticInfo(diagnostics);
      console.log('Auth diagnostics:', diagnostics);
      
      try {
        console.log('Attempting to fetch user profile...');
        const response = await api.get('/api/user/users/me');
        console.log('User profile response:', response);
        setUser(response.data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching user profile:', err);
        
        // Extract useful error information
        let errorMessage = 'Unknown error';
        let errorDetails = {};
        
        if (err.response) {
          errorMessage = `Error ${err.response.status}: ${err.response.statusText}`;
          errorDetails = {
            status: err.response.status,
            statusText: err.response.statusText,
            data: err.response.data || 'No response data',
            url: err.config?.url,
            method: err.config?.method
          };
        } else if (err.request) {
          errorMessage = 'No response received from server';
          errorDetails = {
            request: 'Request was made but no response was received',
            url: err.config?.url,
            method: err.config?.method
          };
        } else {
          errorMessage = err.message || 'Request setup error';
        }
        
        setError({ message: errorMessage, details: errorDetails });
      } finally {
        setLoading(false);
      }
    }
    
    // Small delay to allow session refresh to complete
    const timer = setTimeout(() => {
      fetchUser();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [authUser, session, getAuthToken, refreshSession]);


  
  // Render functions for different sections
  const renderDiagnostics = () => (
    <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">Authentication Diagnostics</h2>
      <div className="grid grid-cols-2 gap-2">
        <div className="font-medium">Session Available:</div>
        <div>{diagnosticInfo?.hasSession ? '✅ Yes' : '❌ No'}</div>
        
        <div className="font-medium">User Object Available:</div>
        <div>{diagnosticInfo?.hasUser ? '✅ Yes' : '❌ No'}</div>
        
        <div className="font-medium">Auth Token Available:</div>
        <div>{diagnosticInfo?.hasToken ? '✅ Yes' : '❌ No'}</div>
        
        <div className="font-medium">Token Preview:</div>
        <div className="font-mono text-sm">{diagnosticInfo?.tokenPreview || 'None'}</div>
        
        <div className="font-medium">Session Expiry:</div>
        <div>{diagnosticInfo?.sessionExpiry || 'No expiry info'}</div>
        
        <div className="font-medium">Timestamp:</div>
        <div>{diagnosticInfo?.timestamp}</div>
      </div>
      
      {authUser && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Auth User Info:</h3>
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
            {JSON.stringify(authUser, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
  
  const renderError = () => (
    <div className="mt-8 p-4 bg-red-50 rounded-lg border border-red-200">
      <h2 className="text-lg font-semibold text-red-700 mb-2">Error Details</h2>
      <p className="mb-2 text-red-600">{error?.message}</p>
      
      <div className="mt-4">
        <h3 className="font-medium mb-2">Technical Details:</h3>
        <pre className="bg-red-100 p-2 rounded text-xs overflow-auto">
          {JSON.stringify(error?.details, null, 2)}
        </pre>
      </div>
      
      <div className="mt-4">
        <h3 className="font-medium mb-2">Possible Solutions:</h3>
        <ul className="list-disc pl-5">
          {error?.details?.status === 401 && (
            <>
              <li>Your authentication token may have expired - try logging out and back in</li>
              <li>The token format might be incorrect</li>
            </>
          )}
          {error?.details?.status === 403 && (
            <>
              <li>You may not have permission to access this resource</li>
              <li>Check that your user account has the correct roles/permissions</li>
              <li>The API endpoint path may be incorrect</li>
            </>
          )}
          {!error?.details?.status && (
            <>
              <li>Check your internet connection</li>
              <li>The API server might be down or unreachable</li>
              <li>Check the API URL configuration</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">User Profile Diagnostics</h1>
      
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="text-center">
            <p className="mb-4">Loading...</p>
            <p className="text-sm text-gray-500">Fetching user data and running diagnostics...</p>
          </div>
        </div>
      ) : (
        <>
          {/* User data if available */}
          {user && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Profile Data (Success!)</h2>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Error information if available */}
          {error && renderError()}
          
          {/* Always show diagnostics */}
          {diagnosticInfo && renderDiagnostics()}
          
          {/* Helpful buttons */}
          <div className="mt-6 flex space-x-4">
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh Page
            </button>
            
            <button 
              onClick={() => refreshSession().then(() => window.location.reload())}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Refresh Session & Reload
            </button>
          </div>
        </>
      )}
    </div>
  );
}