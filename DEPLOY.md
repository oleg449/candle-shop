# Deploy

## Recommended: Render

Build command:

```bash
npm ci
```

Start command:

```bash
node server.js
```

Production environment:

```env
NODE_ENV=production
JWT_SECRET=<generate long random secret>
ADMIN_PROMO_CODE=<generate one first-admin code and save it>
AUTH_COOKIE_NAME=auth_token
DB_PATH=/var/data/users.db
UPLOADS_DIR=/var/data/uploads
CONTENT_DIR=/var/data/content
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

Persistent Disk is required. Without it, Render redeploys can remove uploaded photos, edited catalog content, orders, reviews, chats, users, and certificates. Attach a persistent disk:

```text
Mount path: /var/data
Size: 1 GB or more
```

Production data layout:

```text
/var/data/users.db         SQLite users, chats, certificates, notifications
/var/data/uploads          Admin-uploaded photos, served as /uploads/...
/var/data/content          Editable JSON content: products, masterclasses, sets, orders, reviews, admins, history
```

If frontend and backend are served from the same Render service and same domain, `CORS_ALLOWED_ORIGINS` may stay empty. Add domains if you later split frontend and API.

## Optional: Docker

```bash
docker build -t candle-shop .
docker run -d --name candle-shop -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=<secret> \
  -e ADMIN_PROMO_CODE=<admin-code> \
  -e DB_PATH=/var/data/users.db \
  -e UPLOADS_DIR=/var/data/uploads \
  -e CONTENT_DIR=/var/data/content \
  -v candle-shop-data:/var/data \
  candle-shop
```

## Optional: VPS with nginx

Use `deploy/nginx/candle-shop.conf` as a template, replace `example.com`, then enable HTTPS with Certbot.
