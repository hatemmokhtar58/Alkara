# Build context: the repository root (see deploy/docker-compose.yml)
FROM node:22-alpine AS build
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM caddy:2-alpine
COPY deploy/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
