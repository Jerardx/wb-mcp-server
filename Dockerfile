# Wildberries MCP server — stdio. No browser; talks to WB's public JSON API via system curl
# (curl passes WB's TLS fingerprint filter, Node's fetch gets 403).
FROM node:20-slim

# curl is required by the client and is not in node:20-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY src/ ./src/

ENV NODE_ENV=production

# stdio transport: the MCP client spawns the container with -i. No port exposed.
# Run with:  docker run -i --rm --init eduard256/wb-mcp-server:latest
ENTRYPOINT ["node", "src/index.js"]
