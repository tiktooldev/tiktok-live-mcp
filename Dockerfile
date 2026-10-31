FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY src ./src

ENV NODE_ENV=production

# stdio MCP server. Pass the key at run time: docker run -i --rm -e TIKTOOLS_API_KEY=... <image>
ENTRYPOINT ["node", "src/index.js"]
