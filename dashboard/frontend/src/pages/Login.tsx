import React from 'react';

const Login: React.FC = () => {
  const handleLogin = (): void => {
    // Redirect to backend OAuth2 flow — never handle tokens in frontend
    window.location.href = '/auth/discord';
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-gray-800 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl border border-gray-700">
        {/* Bot Logo */}
        <div className="text-6xl mb-4">🛡️</div>
        <h1 className="text-3xl font-bold text-white mb-2">Security Bot</h1>
        <p className="text-gray-400 mb-8 text-sm">
          Professional Discord Security Dashboard
        </p>

        {/* Feature list */}
        <div className="text-left mb-8 space-y-2">
          {[
            '🛡️ Anti-Raid Protection',
            '☢️ Anti-Nuke Detection',
            '🔨 Advanced Moderation',
            '📝 Whitelist Management',
            '📜 Complete Audit Logs',
            '🔒 Server Lockdown',
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-gray-300 text-sm">
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* Login button */}
        <button
          onClick={handleLogin}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center gap-3"
        >
          <svg width="24" height="24" viewBox="0 0 127.14 96.36" fill="currentColor">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
          </svg>
          Login with Discord
        </button>

        <p className="text-gray-500 text-xs mt-6">
          We only request <strong className="text-gray-400">identify</strong> and <strong className="text-gray-400">guilds</strong> scopes.
          <br />We never store your password or Discord token.
        </p>
      </div>
    </div>
  );
};

export default Login;
