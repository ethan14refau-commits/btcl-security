import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { guildsApi } from '../api/client';
import axios from 'axios';

interface GuildConfig {
  guildId: string;
  antiraidEnabled: boolean;
  antiraidLevel: string;
  antinukeEnabled: boolean;
  logChannelId: string | null;
  lockdownActive: boolean;
  raidThresholds: {
    joins10s: number;
    joins30s: number;
    joins2m: number;
    newAccountAgeDays: number;
    mentionSpamCount: number;
  };
  antinukeThresholds: {
    channelDelete: number;
    roleDelete: number;
    banCount: number;
    windowSeconds: number;
  };
}

const RAID_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'] as const;

const GuildConfig: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!guildId) return;
      try {
        const res = await guildsApi.getConfig(guildId);
        setConfig(res.data as GuildConfig);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error as string ?? 'Failed to load config');
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [guildId]);

  const save = async (updates: Partial<GuildConfig>): Promise<void> => {
    if (!guildId) return;
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      await guildsApi.updateConfig(guildId, updates);
      setConfig((prev) => prev ? { ...prev, ...updates } : prev);
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error as string ?? 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading configuration...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400">Failed to load configuration. Is the bot in this server?</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white">Server Configuration</h1>

        {error && <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-lg">{error}</div>}
        {success && <div className="bg-green-900 border border-green-700 text-green-300 px-4 py-3 rounded-lg">{success}</div>}

        {/* Anti-Raid */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">🛡️ Anti-Raid</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Enable Anti-Raid</span>
              <button
                onClick={() => void save({ antiraidEnabled: !config.antiraidEnabled })}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.antiraidEnabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.antiraidEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-2">Action Level</label>
              <select
                value={config.antiraidLevel}
                onChange={(e) => void save({ antiraidLevel: e.target.value })}
                disabled={saving}
                className="bg-gray-700 text-white rounded-lg px-3 py-2 w-full border border-gray-600"
              >
                {RAID_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(['joins10s', 'joins30s', 'joins2m'] as const).map((key) => (
                <div key={key}>
                  <label className="text-gray-400 text-xs block mb-1">
                    {key === 'joins10s' ? 'Joins/10s' : key === 'joins30s' ? 'Joins/30s' : 'Joins/2m'}
                  </label>
                  <input
                    type="number"
                    value={config.raidThresholds[key]}
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev ? {
                          ...prev,
                          raidThresholds: { ...prev.raidThresholds, [key]: parseInt(e.target.value) },
                        } : prev
                      )
                    }
                    onBlur={() => void save({ raidThresholds: config.raidThresholds })}
                    className="bg-gray-700 text-white rounded-lg px-3 py-2 w-full border border-gray-600 text-sm"
                    min={1}
                    max={500}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Anti-Nuke */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">☢️ Anti-Nuke</h2>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Enable Anti-Nuke</span>
            <button
              onClick={() => void save({ antinukeEnabled: !config.antinukeEnabled })}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.antinukeEnabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.antinukeEnabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {(['channelDelete', 'roleDelete', 'banCount', 'windowSeconds'] as const).map((key) => (
              <div key={key}>
                <label className="text-gray-400 text-xs block mb-1 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </label>
                <input
                  type="number"
                  value={config.antinukeThresholds[key]}
                  onChange={(e) =>
                    setConfig((prev) =>
                      prev ? {
                        ...prev,
                        antinukeThresholds: { ...prev.antinukeThresholds, [key]: parseInt(e.target.value) },
                      } : prev
                    )
                  }
                  onBlur={() => void save({ antinukeThresholds: config.antinukeThresholds as unknown as Partial<GuildConfig>['antinukeThresholds'] })}
                  className="bg-gray-700 text-white rounded-lg px-3 py-2 w-full border border-gray-600 text-sm"
                  min={1}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Log Channel */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">📜 Logging</h2>
          <div>
            <label className="text-gray-300 text-sm block mb-2">Log Channel ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                defaultValue={config.logChannelId ?? ''}
                onBlur={(e) => void save({ logChannelId: e.target.value || null })}
                placeholder="Paste channel ID here"
                className="bg-gray-700 text-white rounded-lg px-3 py-2 flex-1 border border-gray-600 text-sm"
              />
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Tip: Use <code className="bg-gray-700 px-1 rounded">/logs channel #channel</code> in Discord for easier setup.
            </p>
          </div>
        </div>

        {/* Status */}
        {config.lockdownActive && (
          <div className="bg-red-900 border border-red-700 rounded-xl p-4">
            <span className="text-red-300 font-semibold">🔒 Server is currently in LOCKDOWN</span>
            <p className="text-red-400 text-sm mt-1">Use <code>/lockdown end</code> in Discord to lift it.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuildConfig;
