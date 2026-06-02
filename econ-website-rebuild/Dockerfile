# syntax=docker/dockerfile:1
FROM node:22-alpine
RUN apk add --no-cache postgresql-client
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline
COPY . .
RUN chmod +x start.sh
EXPOSE 3000
CMD ["./start.sh"]
