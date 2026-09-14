import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Callback from './pages/Callback';
import GuildSelect from './pages/GuildSelect';
import GuildConfig from './pages/GuildConfig';
import SecurityEvents from './pages/SecurityEvents';
import BotActivity from './pages/BotActivity';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div>
      <Navbar />
      <main>{children}</main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<Callback />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedLayout>
              <GuildSelect />
            </ProtectedLayout>
          }
        />
        <Route
          path="/guild/:guildId"
          element={
            <ProtectedLayout>
              <GuildConfig />
            </ProtectedLayout>
          }
        />
        <Route
          path="/guild/:guildId/security"
          element={
            <ProtectedLayout>
              <SecurityEvents />
            </ProtectedLayout>
          }
        />
        <Route
          path="/bot/activity"
          element={
            <ProtectedLayout>
              <BotActivity />
            </ProtectedLayout>
          }
        />

        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
