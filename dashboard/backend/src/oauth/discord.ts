import axios from 'axios';
import { config } from '../../../src/config/index.js';

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_CDN = 'https://cdn.discordapp.com';

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
  bot?: boolean;
  email?: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/**
 * Build the Discord OAuth2 authorization URL.
 * Includes state parameter for CSRF protection.
 */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.CLIENT_ID,
    redirect_uri: config.OAUTH2_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state,
    prompt: 'consent',
  });
  return `${DISCORD_API}/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens.
 * All token exchange happens server-side — never in the browser.
 */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: config.CLIENT_ID,
    client_secret: config.CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.OAUTH2_REDIRECT_URI,
  });

  const response = await axios.post<TokenResponse>(
    `${DISCORD_API}/oauth2/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data;
}

/**
 * Refresh an access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: config.CLIENT_ID,
    client_secret: config.CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await axios.post<TokenResponse>(
    `${DISCORD_API}/oauth2/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data;
}

/**
 * Fetch the authenticated user's Discord profile.
 */
export async function fetchCurrentUser(accessToken: string): Promise<DiscordUser> {
  const response = await axios.get<DiscordUser>(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

/**
 * Fetch the guilds the authenticated user is a member of.
 */
export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const response = await axios.get<DiscordGuild[]>(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

/**
 * Revoke an OAuth2 access token (logout).
 */
export async function revokeToken(token: string): Promise<void> {
  const params = new URLSearchParams({
    client_id: config.CLIENT_ID,
    client_secret: config.CLIENT_SECRET,
    token,
  });

  await axios.post(
    `${DISCORD_API}/oauth2/token/revoke`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  ).catch(() => { /* Ignore revoke errors */ });
}

/**
 * Get avatar URL for a Discord user.
 */
export function getAvatarUrl(user: DiscordUser): string {
  if (!user.avatar) {
    const index = user.discriminator === '0'
      ? Number(BigInt(user.id) >> 22n) % 6
      : parseInt(user.discriminator) % 5;
    return `${DISCORD_CDN}/embed/avatars/${index}.png`;
  }
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `${DISCORD_CDN}/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
}

/**
 * Get guild icon URL.
 */
export function getGuildIconUrl(guild: DiscordGuild): string | null {
  if (!guild.icon) return null;
  const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `${DISCORD_CDN}/icons/${guild.id}/${guild.icon}.${ext}?size=128`;
}

/**
 * Check if a user has Manage Guild permission on a guild.
 * Permission bit 0x20 = MANAGE_GUILD
 */
export function hasManageGuild(guild: DiscordGuild): boolean {
  const perms = BigInt(guild.permissions);
  const ADMINISTRATOR = BigInt(0x8);
  const MANAGE_GUILD = BigInt(0x20);
  return guild.owner || (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & MANAGE_GUILD) === MANAGE_GUILD;
}
