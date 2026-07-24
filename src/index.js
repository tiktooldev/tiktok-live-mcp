#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const DEFAULT_BASE = 'https://api.tik.tools';
const KEY = process.env.TIKTOOLS_API_KEY || '';
const UPGRADE = 'https://tik.tools/pricing';
const TIMEOUT_MS = 15000;
const MAX_BYTES = 2 * 1024 * 1024;

// Only ever send the API key to https tik.tools hosts. A tampered
// TIKTOOLS_API_BASE (a classic "paste this into your config" attack) must not
// be able to exfiltrate the key to an arbitrary or plaintext host.
function safeBase(raw) {
  if (!raw) return DEFAULT_BASE;
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' && /(^|\.)tik\.tools$/.test(u.hostname)) return raw.replace(/\/+$/, '');
  } catch { /* fall through */ }
  console.error(`Refusing untrusted TIKTOOLS_API_BASE="${raw}"; using ${DEFAULT_BASE}`);
  return DEFAULT_BASE;
}
const BASE = safeBase(process.env.TIKTOOLS_API_BASE);

const server = new McpServer({ name: 'tiktok-live-mcp', version: '0.1.1' });

// Single transport to the TikTok LIVE API. The key, timeout, size cap, upgrade
// nudge and error redaction are all handled here so no tool can bypass them.
async function api(method, path, body) {
  if (!KEY) {
    return {
      error: 'No API key configured.',
      how_to_fix: 'Get a free API key at https://tik.tools/pricing and set the TIKTOOLS_API_KEY environment variable in your MCP client config.',
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'x-api-key': KEY, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) return { error: 'Response too large', upgrade: UPGRADE };
    const text = await res.text();
    if (text.length > MAX_BYTES) return { error: 'Response too large', upgrade: UPGRADE };
    let json;
    try { json = JSON.parse(text); } catch { json = { error: 'non-json response', httpStatus: res.status }; }
    if (res.status === 403) {
      return { gated: true, httpStatus: 403, message: json.error || json.message || 'This data requires a higher tier.', upgrade: UPGRADE, data: json };
    }
    if (json && typeof json === 'object' && !Array.isArray(json) && !json._upgrade) json._upgrade = UPGRADE;
    return json;
  } catch (err) {
    // Redact the key defensively even though it is never interpolated into a
    // throwing path today - keeps the invariant if the code changes later.
    const raw = String((err && err.message) || err);
    return { error: KEY ? raw.split(KEY).join('[redacted]') : raw, upgrade: UPGRADE };
  } finally {
    clearTimeout(timer);
  }
}

const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

function tool(name, description, shape, handler) {
  server.registerTool(name, { description, inputSchema: shape }, async (args) => ok(await handler(args || {})));
}

// Bounded input primitives - tool args come from the LLM (possibly from
// untrusted document content), so every field is length/charset/range capped.
const username = z.string().min(1).max(30).regex(/^[A-Za-z0-9._]+$/, 'letters, digits, dot and underscore only');
const region = z.string().min(1).max(8).regex(/^[A-Za-z+]+$/, 'region code, e.g. US or KR+');
const smallCount = z.number().int().min(1).max(50).optional();

// ── Live detection ───────────────────────────────────────────────
tool('check_live', 'Check whether one or more TikTok creators are currently live streaming. Returns live status, room id, viewer count and title.',
  { usernames: z.array(username).min(1).max(25).describe('TikTok usernames without the @ (max 25)') },
  async ({ usernames }) => {
    const out = [];
    for (const u of usernames) out.push({ username: u, ...(await api('GET', `/webcast/check_alive?unique_id=${encodeURIComponent(u)}`)) });
    return out;
  });

tool('get_live_status', 'Fast zero-latency liveness check for a single creator.',
  { username },
  ({ username: u }) => api('GET', `/webcast/live_status?uniqueId=${encodeURIComponent(u)}`));

// ── Room and creator data ────────────────────────────────────────
tool('get_room_info', 'Get full live room info for a creator: host profile, stream title, viewer count, start time.',
  { username },
  ({ username: u }) => api('POST', '/webcast/room_info', { unique_id: u }));

tool('get_creator_profile', 'Reverse-lookup a full TikTok creator profile by username. (Pro tier)',
  { username },
  ({ username: u }) => api('GET', `/webcast/user_profile?unique_id=${encodeURIComponent(u)}`));

tool('get_creator_earnings', 'Get a creator\'s TikTok LIVE earnings: diamonds received and coin equivalent, with period breakdown.',
  { username, period: z.string().max(16).regex(/^[A-Za-z0-9_-]+$/).optional().describe('Optional period, e.g. week or month') },
  ({ username: u, period }) => api('GET', `/webcast/user_earnings?unique_id=${encodeURIComponent(u)}${period ? `&period=${encodeURIComponent(period)}` : ''}`));

// ── Rankings and recruiting ──────────────────────────────────────
tool('get_room_rankings', 'Get the real-time in-room leaderboard for a live creator: top gifters and audience ranking.',
  { username },
  ({ username: u }) => api('GET', `/webcast/rankings?unique_id=${encodeURIComponent(u)}`));

tool('get_popular_live', 'Get TikTok\'s real-time Popular LIVE board for a region - the creators TikTok is actively featuring. (Global Agency tier for the full unmasked board)',
  { region },
  ({ region: r }) => api('GET', `/webcast/ranklist/popular?region=${encodeURIComponent(r)}`));

tool('find_eligible_creators', 'Find creators eligible to recruit in a region, score-ranked - the feed behind an agency recruiting dashboard. (Global Agency tier)',
  { region, min_score: z.number().min(0).max(1000000).optional(), limit: z.number().int().min(1).max(100).optional() },
  ({ region: r, min_score, limit }) => api('GET', `/webcast/eligible_creators?region=${encodeURIComponent(r)}${min_score != null ? `&min_score=${min_score}` : ''}${limit != null ? `&limit=${limit}` : ''}`));

// ── Gifts and discovery ──────────────────────────────────────────
tool('get_gift_catalog', 'Get the global TikTok gift catalog: every gift name, diamond cost, icon and id.',
  {},
  () => api('GET', '/webcast/gift_info'));

tool('get_gift_gallery', 'Get a creator\'s pre-live gift wishlist (the gifts they picked before going live).',
  { username },
  ({ username: u }) => api('GET', `/webcast/gift_gallery?unique_id=${encodeURIComponent(u)}`));

tool('get_live_feed', 'Discover currently live TikTok streams in a region. (Pro tier)',
  { region, count: smallCount },
  ({ region: r, count }) => api('GET', `/webcast/feed?region=${encodeURIComponent(r)}&count=${count || 20}`));

tool('get_trending_hashtags', 'Get currently trending TikTok LIVE hashtags with viewer counts.',
  { count: smallCount },
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
