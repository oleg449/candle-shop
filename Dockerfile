FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/var/data/users.db
ENV UPLOADS_DIR=/var/data/uploads
ENV CONTENT_DIR=/var/data/content

RUN mkdir -p /var/data /var/data/uploads /var/data/content

EXPOSE 3000

CMD ["node", "server.js"]
