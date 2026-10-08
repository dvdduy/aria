FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY . .

EXPOSE 5173
ENTRYPOINT ["/docker-entrypoint.sh"]
