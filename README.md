# TikTok LIVE MCP

An MCP (Model Context Protocol) server that gives Claude, Cursor, VSCode and any MCP client live access to TikTok LIVE data: detect who is live, pull room and creator data, gifts, and regional leaderboards - straight from a chat prompt.

Powered by the [tik.tools](https://tik.tools) platform. Free tier included. Full unmasked leaderboards, league and gaming boards, creator and gifter earnings, the eligible-creator recruiting feed, and the real-time event WebSocket are available direct at [tik.tools/pricing](https://tik.tools/pricing).

## Quick install

Get a free API key at [tik.tools/pricing](https://tik.tools/pricing), then add the server to your client.

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

## Tools

| Tool | What it does |
|---|---|
| `check_live` | Is one or more creators live now (status, room id, viewers) |
| `get_live_status` | Fast single-creator liveness check |
| `get_room_info` | Full room info: host, title, viewers, start time |
| `get_creator_profile` | Reverse-lookup a creator profile (Pro) |
| `get_creator_earnings` | Diamonds and coin earnings for a creator |
| `get_room_rankings` | In-room top gifters and audience ranking |
| `get_popular_live` | TikTok's real-time Popular LIVE board per region (Agency) |
| `find_eligible_creators` | Score-ranked creators to recruit per region (Agency) |
| `get_gift_catalog` | Global gift catalog: names, diamond cost, icons |
| `get_gift_gallery` | A creator's pre-live gift wishlist |
| `get_live_feed` | Discover live streams in a region (Pro) |
| `get_trending_hashtags` | Trending live hashtags with viewer counts |
| `get_rate_limits` | Your key's tier, limits and remaining quota |

## Configuration

| Env var | Default | Notes |
|---|---|---|
| `TIKTOOLS_API_KEY` | - | Required. Free key at https://tik.tools/pricing |
| `TIKTOOLS_API_BASE` | `https://api.tik.tools` | Override only for testing |

## Real-time events

For live chat, gift, battle and caption streams, connect a WebSocket:

```
wss://api.tik.tools/?uniqueId=<username>&apiKey=YOUR_KEY
```

Full docs: [tik.tools/docs](https://tik.tools/docs)

## License

MIT
