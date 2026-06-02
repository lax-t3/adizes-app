FROM node:20-alpine
RUN apk add --no-cache postgresql-client wget
WORKDIR /app
COPY medusa-backend/package*.json ./
RUN npm install
COPY medusa-backend/ .
COPY seed/ /seed
RUN chmod +x start.sh
EXPOSE 9000
CMD ["./start.sh"]
