# syntax=docker/dockerfile:1
FROM node:22-alpine
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
