#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = process.env.TIKTOOLS_API_BASE || 'https://api.tik.tools';
const KEY = process.env.TIKTOOLS_API_KEY || '';
const UPGRADE = 'https://tik.tools/pricing';

const server = new McpServer({ name: 'tiktok-live-mcp', version: '0.1.0' });

// Single transport to the TikTok LIVE API. Every tool funnels through here so
// the API key, upgrade nudge, and error shape are handled in one place.
async function api(method, path, body) {
  if (!KEY) {
    return {
      error: 'No API key configured.',
      how_to_fix: 'Get a free API key at https://tik.tools/pricing and set the TIKTOOLS_API_KEY environment variable in your MCP client config.',
    };
  }
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'x-api-key': KEY, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({ error: 'non-json response', httpStatus: res.status }));
    if (res.status === 403) {
      return { gated: true, httpStatus: 403, message: json.error || json.message || 'This data requires a higher tier.', upgrade: UPGRADE, data: json };
    }
    if (!json._upgrade) json._upgrade = UPGRADE;
    return json;
  } catch (err) {
    return { error: String((err && err.message) || err), upgrade: UPGRADE };
  }
}

const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

function tool(name, description, shape, handler) {
  server.registerTool(name, { description, inputSchema: shape }, async (args) => ok(await handler(args || {})));
}

// ── Live detection ───────────────────────────────────────────────
tool('check_live', 'Check whether one or more TikTok creators are currently live streaming. Returns live status, room id, viewer count and title.',
  { usernames: z.array(z.string()).describe('TikTok usernames without the @') },
  async ({ usernames }) => {
    const out = [];
    for (const u of usernames || []) out.push({ username: u, ...(await api('GET', `/webcast/check_alive?unique_id=${encodeURIComponent(u)}`)) });
    return out;
  });

tool('get_live_status', 'Fast zero-latency liveness check for a single creator.',
  { username: z.string().describe('TikTok username without the @') },
  ({ username }) => api('GET', `/webcast/live_status?uniqueId=${encodeURIComponent(username)}`));

// ── Room and creator data ────────────────────────────────────────
tool('get_room_info', 'Get full live room info for a creator: host profile, stream title, viewer count, start time.',
  { username: z.string() },
  ({ username }) => api('POST', '/webcast/room_info', { unique_id: username }));

tool('get_creator_profile', 'Reverse-lookup a full TikTok creator profile by username. (Pro tier)',
  { username: z.string() },
  ({ username }) => api('GET', `/webcast/user_profile?unique_id=${encodeURIComponent(username)}`));

tool('get_creator_earnings', 'Get a creator\'s TikTok LIVE earnings: diamonds received and coin equivalent, with period breakdown.',
  { username: z.string(), period: z.string().optional().describe('Optional period, e.g. week or month') },
  ({ username, period }) => api('GET', `/webcast/user_earnings?unique_id=${encodeURIComponent(username)}${period ? `&period=${encodeURIComponent(period)}` : ''}`));

// ── Rankings and recruiting ──────────────────────────────────────
tool('get_room_rankings', 'Get the real-time in-room leaderboard for a live creator: top gifters and audience ranking.',
  { username: z.string() },
  ({ username }) => api('GET', `/webcast/rankings?unique_id=${encodeURIComponent(username)}`));

tool('get_popular_live', 'Get TikTok\'s real-time Popular LIVE board for a region - the creators TikTok is actively featuring. (Global Agency tier for the full unmasked board)',
  { region: z.string().describe('Region code, e.g. US, KR, DE') },
  ({ region }) => api('GET', `/webcast/ranklist/popular?region=${encodeURIComponent(region)}`));

tool('find_eligible_creators', 'Find creators eligible to recruit in a region, score-ranked - the feed behind an agency recruiting dashboard. (Global Agency tier)',
  { region: z.string(), min_score: z.number().optional(), limit: z.number().optional() },
  ({ region, min_score, limit }) => api('GET', `/webcast/eligible_creators?region=${encodeURIComponent(region)}${min_score != null ? `&min_score=${min_score}` : ''}${limit != null ? `&limit=${limit}` : ''}`));

// ── Gifts and discovery ──────────────────────────────────────────
tool('get_gift_catalog', 'Get the global TikTok gift catalog: every gift name, diamond cost, icon and id.',
  {},
  () => api('GET', '/webcast/gift_info'));

tool('get_gift_gallery', 'Get a creator\'s pre-live gift wishlist (the gifts they picked before going live).',
  { username: z.string() },
  ({ username }) => api('GET', `/webcast/gift_gallery?unique_id=${encodeURIComponent(username)}`));

tool('get_live_feed', 'Discover currently live TikTok streams in a region. (Pro tier)',
  { region: z.string(), count: z.number().optional() },
  ({ region, count }) => api('GET', `/webcast/feed?region=${encodeURIComponent(region)}&count=${count || 20}`));

tool('get_trending_hashtags', 'Get currently trending TikTok LIVE hashtags with viewer counts.',
  { count: z.number().optional() },
  ({ count }) => api('GET', `/webcast/hashtag_list?count=${count || 20}`));

tool('get_rate_limits', 'Check the current API key\'s tier, rate limits and remaining quota.',
  {},
  () => api('GET', '/webcast/rate_limits'));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('tiktok-live-mcp running. Full data + realtime WebSocket at https://tik.tools');
}
main().catch((err) => { console.error('fatal:', err); process.exit(1); });
