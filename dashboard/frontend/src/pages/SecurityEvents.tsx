import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { securityApi } from '../api/client';

interface SecurityEvent {
  id: string;
  type: string;
  severity: string;
  actorId: string | null;
  action: string;
  createdAt: string;
}

interface Stats {
  total: number;
  last24h: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

const SEVERITY_COLORS: Record<string, string> = {
  INFO: 'text-blue-400 bg-blue-900',
  LOW: 'text-yellow-400 bg-yellow-900',
  MEDIUM: 'text-orange-400 bg-orange-900',
  HIGH: 'text-red-400 bg-red-900',
  CRITICAL: 'text-red-300 bg-red-950 font-bold',
};

const SecurityEvents: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guildId) return;
    const load = async (): Promise<void> => {
      try {
        const [eventsRes, statsRes] = await Promise.all([
          securityApi.getEvents(guildId, 50),
          securityApi.getStats(guildId),
        ]);
        setEvents(eventsRes.data as SecurityEvent[]);
        setStats(statsRes.data as Stats);
      } catch { /* handle gracefully */ }
      finally { setLoading(false); }
    };
    void load();
  }, [guildId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading security events...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">🔒 Security Events</h1>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-gray-400 text-sm">Total Events</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="text-2xl font-bold text-white">{stats.last24h}</div>
              <div className="text-gray-400 text-sm">Last 24h</div>
            </div>
            <div className="bg-red-950 rounded-xl p-4 border border-red-800">
              <div className="text-2xl font-bold text-red-300">{stats.bySeverity['CRITICAL'] ?? 0}</div>
              <div className="text-red-400 text-sm">Critical</div>
            </div>
            <div className="bg-orange-950 rounded-xl p-4 border border-orange-800">
              <div className="text-2xl font-bold text-orange-300">{stats.bySeverity['HIGH'] ?? 0}</div>
              <div className="text-orange-400 text-sm">High Severity</div>
            </div>
          </div>
        )}

        {/* Events table */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No security events recorded yet.
                  </td>
                </tr>
              )}
              {events.map((event) => (
                <tr key={event.id} className="border-b border-gray-750 hover:bg-gray-750">
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${SEVERITY_COLORS[event.severity] ?? 'text-gray-400 bg-gray-700'}`}>
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{event.type}</td>
                  <td className="px-4 py-3 text-gray-300 truncate max-w-xs">{event.action}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SecurityEvents;
