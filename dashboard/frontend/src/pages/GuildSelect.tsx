import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { guildsApi } from '../api/client';
import axios from 'axios';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  isOwner: boolean;
}

const GuildSelect: React.FC = () => {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const res = await guildsApi.getGuilds();
        setGuilds(res.data as Guild[]);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error as string ?? 'Failed to load guilds');
        } else {
          setError('Unexpected error');
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading your servers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Select a Server</h1>
        <p className="text-gray-400 mb-8">
          Showing servers where you have <strong>Manage Server</strong> permission and the bot is present.
        </p>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {guilds.length === 0 && !error && (
          <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
            <div className="text-4xl mb-4">😕</div>
            <p>No servers found where you have Manage Server permission and the bot is present.</p>
            <p className="text-sm mt-2">
              <a
                href={`https://discord.com/oauth2/authorize?client_id=${import.meta.env.VITE_CLIENT_ID ?? 'YOUR_CLIENT_ID'}&permissions=8&scope=bot%20applications.commands`}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:underline"
              >
                Invite the bot to a server
              </a>
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {guilds.map((guild) => (
            <button
              key={guild.id}
              onClick={() => navigate(`/guild/${guild.id}`)}
              className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-indigo-500 rounded-xl p-5 flex items-center gap-4 transition-all duration-200 text-left"
            >
              {guild.icon ? (
                <img
                  src={guild.icon}
                  alt={guild.name}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                  {guild.name.charAt(0)}
                </div>
              )}
              <div>
                <div className="text-white font-semibold truncate max-w-[140px]">{guild.name}</div>
                {guild.isOwner && (
                  <span className="text-xs text-yellow-400">👑 Owner</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GuildSelect;
