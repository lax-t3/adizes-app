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
RUN chmod +x start.sh
EXPOSE 9000
CMD ["./start.sh"]
