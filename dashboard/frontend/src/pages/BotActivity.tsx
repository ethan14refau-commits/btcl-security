import React, { useEffect, useState } from 'react';
import { botApi } from '../api/client';
import axios from 'axios';

interface Activity {
  type: string;
  name: string;
  url?: string;
}

const ACTIVITY_TYPES = [
  { value: 'WATCHING', label: '👁️ Watching' },
  { value: 'PLAYING', label: '🎮 Playing' },
  { value: 'LISTENING', label: '🎵 Listening to' },
  { value: 'STREAMING', label: '📡 Streaming' },
  { value: 'COMPETING', label: '🏆 Competing in' },
];

const BotActivity: React.FC = () => {
  const [activity, setActivity] = useState<Activity>({ type: 'WATCHING', name: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const res = await botApi.getActivity();
        const data = (res.data as { activity: Activity | null }).activity;
        if (data) setActivity(data);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          setError('Only Bot Owners can manage bot activity.');
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSave = async (): Promise<void> => {
    if (!activity.name.trim()) {
      setError('Activity name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await botApi.updateActivity(activity);
      setSuccess('Bot activity updated!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error as string ?? 'Failed to update activity');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-10">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">🎮 Bot Activity</h1>
        <p className="text-gray-400 mb-6 text-sm">
          Configure what status the bot displays in Discord.
          <br />
          <strong className="text-gray-300">Note:</strong> This changes the <em>bot's own</em> activity, not a user account.
          Discord's API does not allow setting user account activities via OAuth2.
        </p>

        {error && <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-4">{error}</div>}
        {success && <div className="bg-green-900 border border-green-700 text-green-300 px-4 py-3 rounded-lg mb-4">{success}</div>}

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-gray-300 text-sm block mb-2">Activity Type</label>
            <select
              value={activity.type}
              onChange={(e) => setActivity((prev) => ({ ...prev, type: e.target.value }))}
              className="bg-gray-700 text-white rounded-lg px-3 py-2 w-full border border-gray-600"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-gray-300 text-sm block mb-2">Activity Name</label>
            <input
              type="text"
              value={activity.name}
              onChange={(e) => setActivity((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. your server 🛡️"
              maxLength={128}
              className="bg-gray-700 text-white rounded-lg px-3 py-2 w-full border border-gray-600"
            />
          </div>

          {activity.type === 'STREAMING' && (
            <div>
              <label className="text-gray-300 text-sm block mb-2">Stream URL (Twitch or YouTube)</label>
              <input
                type="url"
                value={activity.url ?? ''}
                onChange={(e) => setActivity((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://twitch.tv/..."
                className="bg-gray-700 text-white rounded-lg px-3 py-2 w-full border border-gray-600"
              />
            </div>
          )}

          {/* Preview */}
          <div className="bg-gray-750 rounded-lg p-3 border border-gray-600">
            <div className="text-gray-400 text-xs mb-1">Preview</div>
            <div className="text-white text-sm">
              {ACTIVITY_TYPES.find((t) => t.value === activity.type)?.label} <strong>{activity.name || 'your server 🛡️'}</strong>
            </div>
          </div>

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {saving ? 'Saving...' : 'Save Activity'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BotActivity;
