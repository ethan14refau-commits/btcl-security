import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Send cookies with every request
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor — redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  getMe: () => api.get('/auth/me'.replace('/api', '')),
  logout: () => api.get('/auth/logout'.replace('/api', '')),
};

// Use bare /auth prefix (not /api)
const authInstance = axios.create({
  baseURL: '/',
  withCredentials: true,
});

export const auth = {
  getMe: () => authInstance.get('/auth/me'),
  logout: () => authInstance.get('/auth/logout'),
};

// ─── Guilds ───────────────────────────────────────────────────────────────────

export const guildsApi = {
  getGuilds: () => api.get('/guilds'),
  getConfig: (guildId: string) => api.get(`/guilds/${guildId}/config`),
  updateConfig: (guildId: string, data: object) => api.patch(`/guilds/${guildId}/config`, data),
  getWhitelist: (guildId: string) => api.get(`/guilds/${guildId}/whitelist`),
  addWhitelist: (guildId: string, targetId: string, type: string) =>
    api.post(`/guilds/${guildId}/whitelist`, { targetId, type }),
  removeWhitelist: (guildId: string, targetId: string) =>
    api.delete(`/guilds/${guildId}/whitelist`, { data: { targetId } }),
};

// ─── Security ─────────────────────────────────────────────────────────────────

export const securityApi = {
  getEvents: (guildId: string, limit = 50, offset = 0) =>
    api.get(`/security/${guildId}/events?limit=${limit}&offset=${offset}`),
  getStats: (guildId: string) => api.get(`/security/${guildId}/stats`),
};

// ─── Bot ─────────────────────────────────────────────────────────────────────

export const botApi = {
  getStatus: () => api.get('/bot/status'),
  getActivity: () => api.get('/bot/activity'),
  updateActivity: (data: { type: string; name: string; url?: string }) =>
    api.patch('/bot/activity', data),
};
