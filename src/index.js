#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const VERSION = '0.2.1';
const DEFAULT_BASE = 'https://api.tik.tools';
const UPGRADE = 'https://tik.tools/pricing';
const TIMEOUT_MS = 20000;
const MAX_BYTES = 2 * 1024 * 1024;

// The package is named tiktok-live-mcp (singular) while the platform env var is
// TIKTOOLS_API_KEY (plural). Users guess the singular form from the package name
// and then see "no API key" on every call, so both spellings are accepted.
const KEY =
  process.env.TIKTOOLS_API_KEY ||
  process.env.TIKTOOL_API_KEY ||
  process.env.TIKTOK_LIVE_API_KEY ||
  '';

// Only ever send the API key to https tik.tools hosts. A tampered
// TIKTOOLS_API_BASE (a classic "paste this into your config" attack) must not
// be able to exfiltrate the key to an arbitrary or plaintext host.
function safeBase(raw) {
  if (!raw) return DEFAULT_BASE;
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' && /(^|\.)tik\.tools$/.test(u.hostname)) return raw.replace(/\/+$/, '');
  } catch { /* fall through */ }
  console.error(`Refusing untrusted API base "${raw}"; using ${DEFAULT_BASE}`);
  return DEFAULT_BASE;
}
const BASE = safeBase(process.env.TIKTOOLS_API_BASE || process.env.TIKTOOL_API_BASE);

const server = new McpServer({ name: 'tiktok-live-mcp', version: VERSION });

const NO_KEY = {
  error: 'No API key configured.',
  how_to_fix:
    'Get a free API key at https://tik.tools/pricing and set TIKTOOLS_API_KEY (or TIKTOOL_API_KEY) in your MCP client config.',
};

// Single transport to the TikTok LIVE API. The key, timeout, size cap, upgrade
// nudge and error redaction are all handled here so no tool can bypass them.
async function api(method, path, body) {
  if (!KEY) return NO_KEY;
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
      return {
        gated: true,
        httpStatus: 403,
        message: json.error || json.message || 'This data requires a higher tier.',
        required_tier: json.required_tier,
        current_tier: json.current_tier,
        upgrade: UPGRADE,
      };
    }
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

// Several upstream endpoints answer with a pre-signed webcast.tiktok.com URL
// instead of data, because the signature is bound to the caller's IP. An MCP
// client cannot perform that second hop, so the server completes it here.
// The API key is never attached to this request and the host is allow-listed.
async function followSigned(sig) {
  let u;
  try { u = new URL(sig.signed_url); } catch { return { error: 'Upstream returned an unusable signed URL.' }; }
  if (u.protocol !== 'https:' || !/(^|\.)tiktok\.com$/.test(u.hostname)) {
    return { error: `Refusing to follow signed URL to untrusted host "${u.hostname}".` };
  }
  const headers = { ...(sig.headers || {}) };
  if (sig.cookies && typeof sig.cookies === 'object') {
    headers.cookie = Object.entries(sig.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(sig.signed_url, { method: sig.method || 'GET', headers, signal: controller.signal });
    const text = await res.text();
    if (!text) return { error: 'Upstream returned an empty response. The room may have ended.' };
    if (text.length > MAX_BYTES) return { error: 'Response too large', upgrade: UPGRADE };
    try { return JSON.parse(text); } catch { return { error: 'non-json upstream response', httpStatus: res.status }; }
  } catch (err) {
    return { error: String((err && err.message) || err) };
  } finally {
    clearTimeout(timer);
  }
}

// Signed endpoints only accept a numeric room_id. Passing unique_id makes the
// upstream reply "resolve_required", which is useless to an MCP client, so every
// username is turned into a room_id here first.
async function resolveRoom(username) {
  const r = await api('GET', `/webcast/live_status?unique_id=${encodeURIComponent(username)}`);
  if (r && r.error) return { error: r.error, how_to_fix: r.how_to_fix };
  const d = (r && r.data) || {};
  if (!d.room_id) {
    return { error: `Could not resolve a live room for @${username}. The creator may have never gone live.` };
  }
  return { room_id: String(d.room_id), is_live: !!d.is_live };
}

// A tier block or transport failure must stop a multi-step tool. Upstream also
// sets its own `gated` flag on successful masked payloads (leaderboards), which
// is real data and must NOT be treated as a failure, so only errors and 403s
// count here.
const isBlocked = (r) => !!(r && (r.error || r.httpStatus === 403));

const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

function tool(name, description, shape, handler) {
  server.registerTool(name, { description, inputSchema: shape }, async (args) => ok(await handler(args || {})));
}

// Bounded input primitives - tool args come from the LLM (possibly from
// untrusted document content), so every field is length/charset/range capped.
const username = z.string().min(1).max(30).regex(/^[A-Za-z0-9._]+$/, 'letters, digits, dot and underscore only');
const region = z.string().min(1).max(8).regex(/^[A-Za-z+]+$/, 'region code, e.g. US or KR+');
const smallCount = z.number().int().min(1).max(50).optional();

// Live detection

tool(
  'check_live',
  'Check whether one or more TikTok creators are currently live streaming. Returns live status and room id for each. Requires Basic tier or above; on the free Sandbox tier use get_live_status instead, which checks one creator at a time.',
  { usernames: z.array(username).min(1).max(50).describe('TikTok usernames without the @') },
  async ({ usernames }) => {
    const r = await api('POST', '/webcast/bulk_live_check', { unique_ids: usernames });
    if (isBlocked(r)) return r;
    const rows = Array.isArray(r && r.data) ? r.data : [];
    return {
      checked: rows.length,
      live_now: rows.filter((x) => x.is_live).map((x) => x.unique_id),
      results: rows.map((x) => ({
        username: x.unique_id,
        is_live: !!x.is_live,
        room_id: x.room_id || null,
        viewers: x.user_count ?? null,
      })),
    };
  }
);

tool(
  'get_live_status',
  'Fast liveness check for a single creator. Returns is_live plus the room id. Available on every tier.',
  { username },
  async ({ username: u }) => {
    const r = await api('GET', `/webcast/live_status?unique_id=${encodeURIComponent(u)}`);
    if (isBlocked(r)) return r;
    return { username: u, ...(r.data || {}) };
  }
);

// Room and creator data

tool(
  'get_room_info',
  'Get full live room details for a creator: stream title, current viewer count, how long they have been live, and host profile. Only returns data while the creator is live. Requires Basic tier or above.',
  { username },
  async ({ username: u }) => {
    const room = await resolveRoom(u);
    if (room.error) return room;
    const r = await api('POST', '/webcast/room_info?mode=fetch', { room_id: room.room_id });
    if (isBlocked(r)) return r;
    const d = r.data || {};
    if (!room.is_live && !d.title) {
      return { username: u, is_live: false, room_id: room.room_id, note: `@${u} is not currently live.` };
    }
    return {
      username: u,
      is_live: room.is_live,
      room_id: d.room_id || room.room_id,
      title: d.title ?? null,
      viewers: d.user_count ?? null,
      like_count: d.like_count ?? null,
      started_at: d.create_time_iso ?? null,
      live_duration_seconds: d.live_duration_seconds ?? null,
      owner: d.owner ?? null,
      is_game: d.is_game ?? null,
    };
  }
);

tool(
  'get_creator_profile',
  'Reverse-lookup a full TikTok creator profile by username: nickname, bio, verification, avatar, follower and video counts. Requires Pro tier or above.',
  { username },
  ({ username: u }) => api('GET', `/webcast/user_profile?unique_id=${encodeURIComponent(u)}`)
);

// Gifts

tool(
  'get_gift_catalog',
  'Get the TikTok LIVE gift catalog: gift id, display name, diamond cost and icon. Works with no arguments and returns the global catalog. Pass a username to include gifts unlocked only in that creator\'s live room. Available on every tier; Sandbox and Basic receive a 50-gift sample, Pro and above receive the full catalog.',
  {
    username: username.optional().describe('Optional creator whose live room the catalog is scoped to'),
    search: z.string().max(40).optional().describe('Optional case-insensitive filter on the gift name'),
    limit: z.number().int().min(1).max(1000).optional().describe('Maximum gifts to return (default 100)'),
  },
  async ({ username: u, search, limit }) => {
    // The catalog is global, so a placeholder room id returns the full list when
    // no creator is given. The upstream requires the parameter to be present.
    let roomId = '1';
    if (u) {
      const room = await resolveRoom(u);
      if (room.error) return room;
      roomId = room.room_id;
    }
    const r = await api('GET', `/webcast/gift_info?room_id=${encodeURIComponent(roomId)}&mode=fetch`);
    if (isBlocked(r)) return r;
    let gifts = (r.data && r.data.gifts) || [];
    if (search) {
      const needle = search.toLowerCase();
      gifts = gifts.filter((g) => String(g.name || '').toLowerCase().includes(needle));
    }
    const total = gifts.length;
    const cap = limit || 100;
    return {
      scope: u ? `@${u} live room` : 'global catalog',
      total_matching: total,
      returned: Math.min(total, cap),
      // Sandbox and Basic return the icon under icon_url, Pro and above under
      // icon, so both spellings are normalised to one field for the client.
      gifts: gifts.slice(0, cap).map((g) => ({
        id: g.id,
        name: g.name,
        diamond_count: g.diamond_count ?? null,
        icon: g.icon || g.icon_url || null,
      })),
    };
  }
);

tool(
  'get_gift_gallery',
  'Get a creator\'s live gift wishlist: the gifts they selected as goals, with progress. The creator must be live right now. Available on every tier.',
  { username },
  async ({ username: u }) => {
    const r = await api('GET', `/webcast/gift_gallery?unique_id=${encodeURIComponent(u)}`);
    if (r && r.status_code === -1 && r.error === 'creator_not_live') {
      return { username: u, is_live: false, note: `@${u} is not currently live, so there is no gift wishlist to read.` };
    }
    return r;
  }
);

// Discovery, rankings and recruiting

tool(
  'get_live_feed',
  'Discover TikTok streams that are live right now in a region, with title, host and viewer count. Requires Pro tier or above.',
  { region, count: smallCount },
  async ({ region: r, count }) => {
    const sig = await api('GET', `/webcast/feed?region=${encodeURIComponent(r)}&count=${count || 20}`);
    if (isBlocked(sig)) return sig;
    if (!sig || !sig.signed_url) return sig;
    const d = await followSigned(sig);
    if (d && d.error) return d;
    // The upstream feed ignores the count hint, so the cap is applied here to
    // keep the tool result predictable and the client context bounded.
    const rows = (Array.isArray(d.data) ? d.data : []).slice(0, count || 20);
    return {
      region: sig.region || r,
      returned: rows.length,
      daily_feed_remaining: sig.feed_remaining ?? null,
      streams: rows.map((e) => {
        const room = e.data || {};
        return {
          username: room.owner?.display_id ?? null,
          nickname: room.owner?.nickname ?? null,
          title: room.title ?? null,
          viewers: room.user_count ?? null,
          room_id: room.id_str ?? null,
          followers: room.owner?.follow_info?.follower_count ?? null,
        };
      }),
    };
  }
);

tool(
  'get_leaderboard',
  'Get the TikTok LIVE creator leaderboard for a region, ranked by diamonds earned. type=daily works on every tier but creator identifiers stay masked below Pro. type=league requires Ultra tier. type=weekly, type=gaming and type=shopping require Agency tier.',
  {
    region,
    type: z.enum(['daily', 'weekly', 'league', 'gaming', 'shopping']).optional().describe('Board type, default daily'),
  },
  async ({ region: r, type }) => {
    const t = type || 'daily';
    return api('GET', `/webcast/leaderboard?region=${encodeURIComponent(r)}&type=${encodeURIComponent(t)}`);
  }
);

tool(
  'get_popular_live',
  'Get TikTok\'s real-time Popular LIVE board for a region, the creators TikTok is actively featuring. Available on every tier, but creator identifiers stay masked until Global Agency tier.',
  { region },
  ({ region: r }) => api('GET', `/webcast/ranklist/popular?region=${encodeURIComponent(r)}`)
);

tool(
  'find_eligible_creators',
  'Find creators eligible to recruit in a region, score-ranked. This is the feed behind an agency recruiting dashboard. Requires Global Agency tier; lower tiers receive an upgrade message.',
  { region, min_score: z.number().min(0).max(1000000).optional(), limit: z.number().int().min(1).max(100).optional() },
  ({ region: r, min_score, limit }) =>
    api(
      'GET',
      `/webcast/eligible_creators?region=${encodeURIComponent(r)}` +
        (min_score != null ? `&min_score=${min_score}` : '') +
        (limit != null ? `&limit=${limit}` : '')
    )
);

// Account

tool(
  'get_rate_limits',
  'Check the current API key\'s tier, request limits, remaining quota and WebSocket allowance. Available on every tier.',
  {},
  () => api('GET', '/webcast/rate_limits')
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`tiktok-live-mcp ${VERSION} running. Full data and realtime WebSocket at https://tik.tools`);
}
main().catch((err) => { console.error('fatal:', err); process.exit(1); });
