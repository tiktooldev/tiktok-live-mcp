# TikTok LIVE MCP

An MCP (Model Context Protocol) server that gives Claude, Cursor, VSCode and any MCP client live access to TikTok LIVE data: detect who is live, pull room and creator data, gift catalogs and regional leaderboards, straight from a chat prompt.

Powered by the [tik.tools](https://tik.tools) platform. Free tier included. Full unmasked leaderboards, league and gaming boards, the eligible-creator recruiting feed, and the real-time event WebSocket are available at [tik.tools/pricing](https://tik.tools/pricing).

## Quick install

Get an API key at [tik.tools/pricing](https://tik.tools/pricing), then add the server to your client.

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tiktok-live": {
      "command": "npx",
      "args": ["-y", "tiktok-live-mcp"],
      "env": { "TIKTOOLS_API_KEY": "YOUR_KEY" }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (or the project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "tiktok-live": {
      "command": "npx",
      "args": ["-y", "tiktok-live-mcp"],
      "env": { "TIKTOOLS_API_KEY": "YOUR_KEY" }
    }
  }
}
```

### VSCode

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "tiktok-live": {
      "command": "npx",
      "args": ["-y", "tiktok-live-mcp"],
      "env": { "TIKTOOLS_API_KEY": "YOUR_KEY" }
    }
  }
}
```

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `TIKTOOLS_API_KEY` | - | API key. Get one at https://tik.tools/pricing |
| `TIKTOOL_API_KEY` | - | Accepted alias for `TIKTOOLS_API_KEY` |
| `TIKTOK_LIVE_API_KEY` | - | Accepted alias for `TIKTOOLS_API_KEY` |
| `TIKTOOLS_API_BASE` | `https://api.tik.tools` | Override only for testing. Non tik.tools hosts are refused so the key cannot be redirected |
| `TIKTOOL_API_BASE` | - | Accepted alias for `TIKTOOLS_API_BASE` |

Set any one of the three key variables. They are read in the order listed above.

## Tools

Eleven tools. Tier requirements are stated on every tool that is gated; when your key is below the required tier the tool returns a clear upgrade message instead of failing.

| Tool | What it does | Minimum tier |
|---|---|---|
| `get_live_status` | Is a single creator live now, plus room id | Any |
| `check_live` | Live check for a batch of creators in one call | Basic |
| `get_room_info` | Title, viewers, uptime and host for a live room | Basic |
| `get_creator_profile` | Full creator profile by username | Pro |
| `get_gift_catalog` | Gift id, name, diamond cost and icon | Any (full catalog from Pro) |
| `get_gift_gallery` | A creator's live gift wishlist and progress | Any |
| `get_live_feed` | Discover streams live right now in a region | Pro |
| `get_leaderboard` | Regional creator leaderboard by diamonds | Any for daily (masked below Pro), Ultra for league, Agency for weekly, gaming, shopping |
| `get_popular_live` | TikTok's Popular LIVE board per region | Any (unmasked at Global Agency) |
| `find_eligible_creators` | Score-ranked creators to recruit in a region | Global Agency |
| `get_rate_limits` | Your key's tier, quota and WebSocket allowance | Any |

### Worked examples

Ask your MCP client in plain language; it selects the tool and arguments. The arguments each tool receives are shown below.

**`get_live_status`** - "Is zzingwoo live right now?"

```json
{ "username": "zzingwoo" }
```

```json
{ "username": "zzingwoo", "unique_id": "zzingwoo", "is_live": true, "room_id": "7669351857706339092", "cached": true }
```

**`check_live`** - "Which of these creators are live: zzingwoo, tv_asahi_news?"

```json
{ "usernames": ["zzingwoo", "tv_asahi_news"] }
```

```json
{
  "checked": 2,
  "live_now": ["zzingwoo"],
  "results": [
    { "username": "zzingwoo", "is_live": true, "room_id": "7669351857706339092", "viewers": null },
    { "username": "tv_asahi_news", "is_live": false, "room_id": "7667403943404358407", "viewers": null }
  ]
}
```

**`get_room_info`** - "What is zzingwoo streaming and how many viewers?"

```json
{ "username": "zzingwoo" }
```

```json
{
  "username": "zzingwoo",
  "is_live": true,
  "room_id": "7669351857706339092",
  "title": "Lets Go LIVE!",
  "viewers": 47,
  "started_at": "2026-08-02T08:42:28.000Z",
  "live_duration_seconds": 14041,
  "owner": { "id_str": "7410115547105379344", "nickname": "Jungwoo", "display_id": "zzingwoo" }
}
```

**`get_creator_profile`** - "Show me the TikTok profile for zzingwoo." (Pro)

```json
{ "username": "zzingwoo" }
```

Returns nickname, bio, verification flag, avatar, follower and video counts.

**`get_gift_catalog`** - "What TikTok gifts cost the most diamonds?" Callable with no arguments.

```json
{}
```

```json
{
  "scope": "global catalog",
  "total_matching": 646,
  "returned": 100,
  "gifts": [{ "id": 5655, "name": "Rose", "diamond_count": 1, "icon": "https://..." }]
}
```

Filter and scope it: `{ "search": "rose", "limit": 3 }` returns only matching gifts. Passing `{ "username": "zzingwoo" }` scopes the catalog to that creator's live room.

**`get_gift_gallery`** - "What gift goals has zzingwoo set for this stream?"

```json
{ "username": "zzingwoo" }
```

Returns the wishlist with per-gift progress. If the creator is offline the tool answers with `is_live: false` and an explanatory note rather than an error.

**`get_live_feed`** - "Show me 3 TikTok streams live in the US right now." (Pro)

```json
{ "region": "US", "count": 3 }
```

```json
{
  "region": "US",
  "returned": 3,
  "daily_feed_remaining": 91,
  "streams": [
    { "username": "athens.metal.taxi", "nickname": "Athens Metal Taxi", "title": "DARK ART RADIO", "viewers": 1, "room_id": "7669409576596392726", "followers": 812 }
  ]
}
```

**`get_leaderboard`** - "Who are the top TikTok LIVE creators in Korea today?"

```json
{ "region": "KR", "type": "daily" }
```

```json
{ "type": "daily", "region": "KR", "region_label": "South Korea", "tier": "pro", "count": 99,
  "entries": [{ "rank": 1, "unique_id": "choi_wooon", "nickname": "woon", "score": 1667836, "is_live": false }] }
```

`type` accepts `daily`, `weekly`, `league`, `gaming` and `shopping`. Requesting a board above your tier returns the requirement:

```json
{ "gated": true, "httpStatus": 403, "message": "The league leaderboard is a Ultra-tier feature.", "required_tier": "ultra", "current_tier": "pro", "upgrade": "https://tik.tools/pricing" }
```

**`get_popular_live`** - "What is TikTok featuring on the Popular LIVE board in Korea?"

```json
{ "region": "KR" }
```

Returns the ranked board. Below Global Agency the creator identifiers come back masked, with `_upgrade_required` on each masked row.

**`find_eligible_creators`** - "Find creators worth recruiting in the US." (Global Agency)

```json
{ "region": "US", "min_score": 1000, "limit": 10 }
```

**`get_rate_limits`** - "How much API quota do I have left?"

```json
{}
```

```json
{ "status_code": 0, "data": { "tier": "pro", "api": { "limit": 300, "remaining": 287 }, "websocket": { "limit": 50, "current": 0 }, "bulk_check_limit": 50 } }
```

## Real-time events

The REST tools above answer point-in-time questions. For live chat, gift and battle streams, connect a WebSocket:

```
wss://api.tik.tools/?uniqueId=<username>&apiKey=YOUR_KEY
```

Full docs: [tik.tools/docs](https://tik.tools/docs)

## Changes in 0.2.0

- `get_gift_catalog` now works when called with no arguments and returns the parsed catalog, with optional `search` and `limit`.
- `get_live_status`, `get_room_info` and `check_live` now return a real live answer. Previously they returned an instruction to go fetch tiktok.com, which an MCP client cannot do.
- `get_live_feed` now returns parsed stream listings instead of a signed URL, and honours `count`.
- Added `get_leaderboard` with a `type` parameter so daily, weekly, league, gaming and shopping boards are reachable.
- `TIKTOOL_API_KEY` and `TIKTOK_LIVE_API_KEY` are accepted alongside `TIKTOOLS_API_KEY`.
- Every gated tool now states its minimum tier in its description.
- Removed `get_creator_earnings`, `get_room_rankings` and `get_trending_hashtags`. The first two need an authenticated TikTok session that an MCP client cannot supply, and the third had no working data source. They are gone rather than shipped broken.

## License

MIT
