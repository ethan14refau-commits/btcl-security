import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * OAuth2 callback page.
 * The actual token exchange is done server-side.
 * This page just shows a loading state while the backend sets the session cookie
 * and redirects to /dashboard.
 */
const Callback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check for error params
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (error) {
      void navigate('/login?error=auth_failed', { replace: true });
    } else {
      // Backend will redirect here after setting cookie
      // If we reach this component, navigation should go to dashboard
      void navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-white text-xl mb-4">Authenticating...</div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
      </div>
    </div>
  );
};

export default Callback;
