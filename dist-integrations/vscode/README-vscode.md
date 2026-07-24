# TikTok LIVE MCP server - editor setup

This runs the TikTok LIVE MCP server (`tiktok-live-mcp`) locally through `npx`, exposing the TikTok LIVE API (https://api.tik.tools) as MCP tools inside your editor or desktop client. Get a free API key at https://tik.tools/pricing. Premium data is unlocked at https://tik.tools/pricing.

The server needs a `TIKTOOLS_API_KEY`. Each client below stores it a little differently. The exact JSON to paste is provided for all four.

## VS Code

VS Code reads MCP servers from a workspace file `.vscode/mcp.json` or from your user `settings.json` under the `mcp` key. The workspace file prompts for the key on first run and never stores it in plain text.

Create `.vscode/mcp.json` in your project:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "tiktools-api-key",
      "description": "TikTok LIVE API key (get a free key at https://tik.tools/pricing)",
      "password": true
    }
  ],
  "servers": {
    "tiktok-live": {
      "command": "npx",
      "args": ["-y", "tiktok-live-mcp"],
      "env": {
        "TIKTOOLS_API_KEY": "${input:tiktools-api-key}"
      }
    }
  }
}
```

The file `mcp.json` in this folder is the same block, ready to copy. If you prefer user settings, wrap it under an `mcp` key in your user `settings.json`:

```json
{
  "mcp": {
    "inputs": [
      {
        "type": "promptString",
        "id": "tiktools-api-key",
        "description": "TikTok LIVE API key (get a free key at https://tik.tools/pricing)",
        "password": true
      }
    ],
    "servers": {
      "tiktok-live": {
        "command": "npx",
        "args": ["-y", "tiktok-live-mcp"],
        "env": {
          "TIKTOOLS_API_KEY": "${input:tiktools-api-key}"
        }
      }
    }
  }
}
```

## Cursor

Cursor reads MCP servers from `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project). Paste your key directly in the `env` block:

```json
{
  "mcpServers": {
    "tiktok-live": {
      "command": "npx",
      "args": ["-y", "tiktok-live-mcp"],
      "env": {
        "TIKTOOLS_API_KEY": "REPLACE_WITH_YOUR_KEY"
      }
    }
  }
}
```

## Windsurf

Windsurf reads MCP servers from `~/.codeium/windsurf/mcp_config.json`. Use the `mcpServers` shape:

```json
{
  "mcpServers": {
    "tiktok-live": {
      "command": "npx",
      "args": ["-y", "tiktok-live-mcp"],
      "env": {
        "TIKTOOLS_API_KEY": "REPLACE_WITH_YOUR_KEY"
      }
    }
  }
}
```

## Claude Desktop

Claude Desktop reads `claude_desktop_config.json`. Open it from Settings, then Developer, then Edit Config, or edit it directly:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tiktok-live": {
      "command": "npx",
      "args": ["-y", "tiktok-live-mcp"],
      "env": {
        "TIKTOOLS_API_KEY": "REPLACE_WITH_YOUR_KEY"
      }
    }
  }
}
```

Restart the client after saving so it picks up the new server.

## Notes

- Node.js 18 or newer is required so `npx` and native fetch are available.
- The first run downloads `tiktok-live-mcp` through `npx`, which can take a few seconds.
- Free-tier keys cover the core live checks. Profile, feed, popular ranklist, and eligible creators need a paid tier. Review plans at https://tik.tools/pricing.
