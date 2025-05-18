// utils/clearAuth.js
/**
 * Clears all authentication tokens from both cookies and localStorage
 * Use this function for logout or when troubleshooting auth issues
 */
export function clearAuthTokens() {
  // 1. Clear tokens from localStorage
  localStorage.removeItem('sb-auth-token');
  localStorage.removeItem('sb-zrxymjnbeogqtztsth-auth-token');
  localStorage.removeItem('sb-yjkmwtyyjamecynydwvj-auth-token');
  
  // Clear any auth store data
  localStorage.removeItem('auth-storage');
  
  // 2. Clear cookies (more complex as we need to set expiry in the past)
  const cookiesToClear = [
    'sb-auth-token',
    'sb-zrxymjnbeogqtztsth-auth-token',
    'sb-yjkmwtyyjamecynydwvj-auth-token'
  ];
  
  cookiesToClear.forEach(cookieName => {
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  });
  
  console.log('🧹 Auth tokens cleared from cookies and localStorage');
}