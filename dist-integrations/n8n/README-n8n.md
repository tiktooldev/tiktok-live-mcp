# n8n-nodes-tiktok-live

An n8n community node package that wraps the TikTok LIVE API (https://api.tik.tools). It lets you check whether creators are live, pull room and profile data, read rankings and earnings, and fetch regional live and eligibility feeds directly inside an n8n workflow.

Get a free API key at https://tik.tools/pricing. Some resources (creator profile, live feed, popular ranklist, eligible creators) require a paid tier. Premium data is unlocked at https://tik.tools/pricing.

## Package structure

```
n8n-nodes-tiktok-live/
  package.json
  tsconfig.json
  index.ts
  credentials/
    TikTokLiveApi.credentials.ts
  nodes/
    TikTokLive/
      TikTokLive.node.ts
      TikTokLive.node.json
      tiktok-live.svg
```

## package.json

The `n8n` block is what n8n reads to discover credentials and nodes. Point the paths at the compiled files under `dist/`.

```json
{
  "name": "n8n-nodes-tiktok-live",
  "version": "1.0.0",
  "description": "n8n community node for the TikTok LIVE API (api.tik.tools)",
  "keywords": [
    "n8n-community-node-package",
    "tiktok",
    "live",
    "livestream",
    "creator"
  ],
  "license": "MIT",
  "homepage": "https://tik.tools/pricing",
  "main": "index.js",
  "scripts": {
    "build": "tsc && gulp build:icons",
    "dev": "tsc --watch",
    "lint": "eslint nodes credentials package.json",
    "prepublishOnly": "npm run build && npm run lint"
  },
  "files": [
    "dist"
  ],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "dist/credentials/TikTokLiveApi.credentials.js"
    ],
    "nodes": [
      "dist/nodes/TikTokLive/TikTokLive.node.js"
    ]
  },
  "devDependencies": {
    "n8n-workflow": "*",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0"
  },
  "peerDependencies": {
    "n8n-workflow": "*"
  }
}
```

## credentials/TikTokLiveApi.credentials.ts

The credential holds the API key and injects it as the `x-api-key` header on every request. The `test` block validates the key against a lightweight endpoint so users get a green check when the key is valid.

```ts
import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class TikTokLiveApi implements ICredentialType {
  name = 'tikTokLiveApi';

  displayName = 'TikTok LIVE API';

  documentationUrl = 'https://tik.tools/pricing';

  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your TikTok LIVE API key. Get a free key at https://tik.tools/pricing.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'x-api-key': '={{ $credentials.apiKey }}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://api.tik.tools',
      url: '/webcast/check_alive',
      qs: { unique_id: 'tiktok' },
    },
  };
}
```

## nodes/TikTokLive/TikTokLive.node.ts

A single programmatic node exposing the core endpoints as resource plus operation pairs. It uses `this.helpers.httpRequestWithAuthentication` so the credential header is applied automatically.

```ts
import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

const BASE_URL = 'https://api.tik.tools';

export class TikTokLive implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'TikTok LIVE',
    name: 'tikTokLive',
    icon: 'file:tiktok-live.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
    description: 'Query the TikTok LIVE API (api.tik.tools)',
    defaults: { name: 'TikTok LIVE' },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    credentials: [
      { name: 'tikTokLiveApi', required: true },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Creator', value: 'creator' },
          { name: 'Room', value: 'room' },
          { name: 'Discovery', value: 'discovery' },
        ],
        default: 'creator',
      },

      // Creator operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['creator'] } },
        options: [
          {
            name: 'Check Alive',
            value: 'checkAlive',
            action: 'Check whether a creator is live',
            description: 'GET /webcast/check_alive',
          },
          {
            name: 'Live Status',
            value: 'liveStatus',
            action: 'Get detailed live status',
            description: 'GET /webcast/live_status',
          },
          {
            name: 'User Profile',
            value: 'userProfile',
            action: 'Get a creator profile (Pro tier)',
            description: 'GET /webcast/user_profile',
          },
          {
            name: 'User Earnings',
            value: 'userEarnings',
            action: 'Get creator earnings',
            description: 'GET /webcast/user_earnings',
          },
          {
            name: 'Rankings',
            value: 'rankings',
            action: 'Get creator rankings',
            description: 'GET /webcast/rankings',
          },
        ],
        default: 'checkAlive',
      },

      // Room operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['room'] } },
        options: [
          {
            name: 'Room Info',
            value: 'roomInfo',
            action: 'Get live room info',
            description: 'POST /webcast/room_info',
          },
          {
            name: 'Gift Info',
            value: 'giftInfo',
            action: 'Get the gift catalog',
            description: 'GET /webcast/gift_info',
          },
        ],
        default: 'roomInfo',
      },

      // Discovery operations
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['discovery'] } },
        options: [
          {
            name: 'Popular Live',
            value: 'popularLive',
            action: 'Get the popular live ranklist (Agency tier)',
            description: 'GET /webcast/ranklist/popular',
          },
          {
            name: 'Eligible Creators',
            value: 'eligibleCreators',
            action: 'Get eligible creators for a region (Agency tier)',
            description: 'GET /webcast/eligible_creators',
          },
          {
            name: 'Live Feed',
            value: 'feed',
            action: 'Get the regional live feed (Pro tier)',
            description: 'GET /webcast/feed',
          },
          {
            name: 'Hashtag List',
            value: 'hashtagList',
            action: 'Get trending hashtags',
            description: 'GET /webcast/hashtag_list',
          },
        ],
        default: 'popularLive',
      },

      // Shared input: creator handle
      {
        displayName: 'Username',
        name: 'uniqueId',
        type: 'string',
        default: '',
        placeholder: 'tiktok',
        description: 'Creator handle without the leading @',
        displayOptions: {
          show: {
            resource: ['creator', 'room'],
            operation: [
              'checkAlive',
              'liveStatus',
              'userProfile',
              'userEarnings',
              'rankings',
              'roomInfo',
            ],
          },
        },
        required: true,
      },

      // Shared input: region
      {
        displayName: 'Region',
        name: 'region',
        type: 'string',
        default: 'US',
        description: 'Two-letter region code, for example US, GB, DE',
        displayOptions: {
          show: {
            resource: ['discovery'],
            operation: ['popularLive', 'eligibleCreators', 'feed'],
          },
        },
      },

      // Shared input: count
      {
        displayName: 'Count',
        name: 'count',
        type: 'number',
        default: 20,
        description: 'Number of items to return',
        displayOptions: {
          show: {
            resource: ['discovery'],
            operation: ['feed', 'hashtagList'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;

      let method: 'GET' | 'POST' = 'GET';
      let path = '';
      const qs: Record<string, string | number> = {};
      let body: Record<string, unknown> | undefined;

      if (resource === 'creator') {
        const uniqueId = (this.getNodeParameter('uniqueId', i) as string).replace(/^@/, '');
        const map: Record<string, string> = {
          checkAlive: '/webcast/check_alive',
          liveStatus: '/webcast/live_status',
          userProfile: '/webcast/user_profile',
          userEarnings: '/webcast/user_earnings',
          rankings: '/webcast/rankings',
        };
        path = map[operation];
        // live_status expects uniqueId, the rest expect unique_id
        if (operation === 'liveStatus') qs.uniqueId = uniqueId;
        else qs.unique_id = uniqueId;
      } else if (resource === 'room') {
        if (operation === 'roomInfo') {
          const uniqueId = (this.getNodeParameter('uniqueId', i) as string).replace(/^@/, '');
          method = 'POST';
          path = '/webcast/room_info';
          body = { unique_id: uniqueId };
        } else if (operation === 'giftInfo') {
          path = '/webcast/gift_info';
        }
      } else if (resource === 'discovery') {
        if (operation === 'popularLive') {
          path = '/webcast/ranklist/popular';
          qs.region = this.getNodeParameter('region', i) as string;
        } else if (operation === 'eligibleCreators') {
          path = '/webcast/eligible_creators';
          qs.region = this.getNodeParameter('region', i) as string;
        } else if (operation === 'feed') {
          path = '/webcast/feed';
          qs.region = this.getNodeParameter('region', i) as string;
          qs.count = this.getNodeParameter('count', i) as number;
        } else if (operation === 'hashtagList') {
          path = '/webcast/hashtag_list';
          qs.count = this.getNodeParameter('count', i) as number;
        }
      }

      const response = await this.helpers.httpRequestWithAuthentication.call(
        this,
        'tikTokLiveApi',
        {
          method,
          baseURL: BASE_URL,
          url: path,
          qs,
          body,
          json: true,
        },
      );

      returnData.push({ json: response, pairedItem: { item: i } });
    }

    return [returnData];
  }
}
```

## index.ts

```ts
export {};
```

n8n loads the credential and node classes from the compiled paths declared in the `n8n` block of `package.json`, so `index.ts` can stay empty. The file exists only so `main` resolves.

## Tier notes

- Free tier: check_alive, live_status, room_info, user_earnings, rankings, gift_info, hashtag_list.
- Pro tier: user_profile, feed. Upgrade at https://tik.tools/pricing.
- Agency tier: ranklist/popular, eligible_creators. Upgrade at https://tik.tools/pricing.

When a request returns 401 or 403 the endpoint is above your current plan. Review plans at https://tik.tools/pricing.

## Build and publish

```bash
npm install
npm run build
npm run lint
npm publish --access public
```

The package name must keep the `n8n-nodes-` prefix and the `n8n-community-node-package` keyword so n8n can discover it.

## Install as an n8n community node

1. In n8n open Settings, then Community Nodes.
2. Select Install.
3. Enter the package name `n8n-nodes-tiktok-live` and confirm.
4. After install, add the TikTok LIVE node to a workflow.
5. Create a new TikTok LIVE API credential and paste your key from https://tik.tools/pricing.

For self-hosted n8n you can also install directly:

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-tiktok-live
```

Restart n8n after installing so the new node and credential are registered.
