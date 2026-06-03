# syntax=docker/dockerfile:1
# Node 20 (not 22): Medusa v2 officially targets Node 20. On Node 22 the
# db:migrate runner hangs after creating the migrations table. The Payload/app
# container stays on Node 22 (it needs it for undici); these are separate images.
FROM node:20-alpine
RUN apk add --no-cache postgresql-client wget
WORKDIR /app
COPY medusa-backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline
COPY medusa-backend/ .
COPY seed/ /seed
# Build the production app (backend + admin dashboard) into .medusa/server.
# Requires @medusajs/admin-sdk (a Medusa module's admin extension imports
# defineRouteConfig from it). Without a build, `medusa start` serves the admin
# via a Vite dev server on a random port → ERR_CONNECTION_REFUSED in the browser.
RUN npx medusa build
# Install production deps inside the built server (it has its own package.json)
RUN --mount=type=cache,target=/root/.npm \
    cd .medusa/server && npm install --prefer-offline
RUN chmod +x start.sh
EXPOSE 9000
CMD ["./start.sh"]
