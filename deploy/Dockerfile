# Coursewright web app and tutor runtime, as two targets of one build (the agent service has its own
# image: agent/Dockerfile). Build from the repo root:
#   docker build -f deploy/Dockerfile --target web .
#   docker build -f deploy/Dockerfile --target runtime .
# compose.ts-deploy.yml builds both.

# ---- build: install once, build the SPA, bundle the runtime ------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /src
# The npm that wrote package-lock.json: an older npm resolves peer dependencies differently and
# `npm ci` then reports the lock as out of sync.
RUN npm install -g npm@11.12.1 --no-audit --no-fund
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --no-audit --no-fund
COPY . .
# The production build calls /api on its own origin (nginx below routes it); no mock layer.
RUN npm run build
# The tutor runtime as one file, so its image needs no node_modules.
RUN npx esbuild runtime-dev/server.ts --bundle --platform=node --format=esm --target=node20 \
      --outfile=/out/runtime/server.mjs --log-level=warning \
      --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"

# ---- web: the SPA behind nginx, which also routes /api to the agent and the tutor runtime ------------
FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080

# ---- runtime: the CopilotKit runtime that connects the tutor chat to the agent service ---------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /out/runtime/server.mjs ./server.mjs
ENV NODE_ENV=production RUNTIME_PORT=4000 COPILOTKIT_TELEMETRY_DISABLED=true
USER node
EXPOSE 4000
CMD ["node", "server.mjs"]
