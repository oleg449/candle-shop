const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const requiredEnvVars = ['JWT_SECRET'];
requiredEnvVars.forEach((name) => {
  const value = process.env[name];
  if (!value || !value.trim() || value.toLowerCase().includes('change')) {
    throw new Error(
      `Environment variable ${name} is required and must not use placeholder values.`
    );
  }
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PROMO_CODE = String(process.env.ADMIN_PROMO_CODE || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const isProduction = process.env.NODE_ENV === 'production';
// SQLite path can be configured via env (e.g., Render persistent disk)
const DB_PATH = process.env.DB_PATH || (isProduction ? '/var/data/users.db' : path.join(__dirname, 'users.db'));
const DATA_DIR = path.dirname(DB_PATH);
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(DATA_DIR, 'uploads');
const CONTENT_DIR = process.env.CONTENT_DIR || path.join(DATA_DIR, 'content');
if (isProduction && path.normalize(DB_PATH) !== path.normalize('/var/data/users.db')) {
  throw new Error('Production DB_PATH must be /var/data/users.db');
}
if (isProduction && path.normalize(UPLOADS_DIR) !== path.normalize('/var/data/uploads')) {
  throw new Error('Production UPLOADS_DIR must be /var/data/uploads');
}
if (isProduction && path.normalize(CONTENT_DIR) !== path.normalize('/var/data/content')) {
  throw new Error('Production CONTENT_DIR must be /var/data/content');
}
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';
const VISITOR_COOKIE_NAME = process.env.VISITOR_COOKIE_NAME || 'site_visitor_id';
const authCookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? 'lax' : 'lax',
  secure: isProduction,
  maxAge: 24 * 60 * 60 * 1000,
  path: '/'
};
const visitorCookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? 'lax' : 'lax',
  secure: isProduction,
  maxAge: 365 * 24 * 60 * 60 * 1000,
  path: '/'
};

// Middleware
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, !isProduction);
  },
  credentials: true
};
const connectSrc = ["'self'"];
if (!isProduction) {
  connectSrc.push(
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5000"
  );
}
app.use(cors({
  ...corsOptions
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcElem: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      connectSrc,
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      frameSrc: [
        "'self'",
        "https://www.youtube.com",
        "https://www.youtube-nocookie.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  }
}));
app.use(express.json({ limit: '25mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

[DATA_DIR, UPLOADS_DIR, CONTENT_DIR].forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

const publicJsonFiles = new Set(['products.json', 'masterclasses.json', 'sets.json']);
const blockedStaticFiles = new Set([
  '.env',
  'admins.json',
  'orders.json',
  'order-history.json',
  'reviews.json',
  'users.db',
  'server.js',
  'package.json',
  'package-lock.json',
  'render.yaml',
  'README_AUTH.md',
  'LICENSE.chromedriver',
  'image_index.txt'
]);
const blockedStaticExtensions = new Set([
  '.db',
  '.sqlite',
  '.sqlite3',
  '.env',
  '.log',
  '.py',
  '.bat',
  '.lnk',
  '.yaml',
  '.yml',
  '.md',
  '.exe'
]);
const blockedStaticDirectories = new Set(['preview', 'previews', 'node_modules']);

function isTrackablePageRequest(req) {
  if (!req || req.method !== 'GET') return false;
  const pathname = String(req.path || '/').toLowerCase();
  if (pathname.startsWith('/api/') || pathname.startsWith('/uploads/')) return false;
  if (pathname === '/admin.html') return false;
  if (pathname === '/' || pathname === '/index.html') return true;
  return pathname.endsWith('.html');
}

function trackSiteVisit(req, res, next) {
  if (!isTrackablePageRequest(req)) return next();
  let visitorId = req.cookies ? req.cookies[VISITOR_COOKIE_NAME] : '';
  if (!visitorId || !/^[a-f0-9-]{16,64}$/i.test(String(visitorId))) {
    visitorId = crypto.randomUUID();
    res.cookie(VISITOR_COOKIE_NAME, visitorId, visitorCookieOptions);
  }
  const ip = req.headers['x-forwarded-for']
    ? String(req.headers['x-forwarded-for']).split(',')[0].trim()
    : (req.ip || '');
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
  const pagePath = String(req.path || '/').slice(0, 250);
  if (typeof db !== 'undefined' && db) {
    db.run(
      'INSERT INTO site_visits (visitor_id, path, user_agent, ip) VALUES (?, ?, ?, ?)',
      [visitorId, pagePath, userAgent, ip],
      () => {}
    );
  }
  next();
}

app.use('/uploads', express.static(UPLOADS_DIR, {
  dotfiles: 'deny',
  index: false,
  maxAge: isProduction ? '1d' : 0
}));

app.get('/:file(products.json|masterclasses.json|sets.json)', (req, res) => {
  const config = adminDataFiles[req.params.file.replace('.json', '')];
  if (!config) return res.status(404).send('Not found');
  let data = readJsonFile(config.file, config.fallback);
  if (req.params.file === 'products.json') data = normalizeProductCategories(data);
  res.json(data);
});

app.use((req, res, next) => {
  const pathname = decodeURIComponent((req.path || '').replace(/^\/+/, ''));
  const firstSegment = pathname.split(/[\\/]/).filter(Boolean)[0] || '';
  const base = path.basename(pathname);
  const ext = path.extname(base).toLowerCase();
  if (blockedStaticDirectories.has(firstSegment)) {
    return res.status(404).send('Not found');
  }
  if (base.endsWith('.json') && !publicJsonFiles.has(base)) {
    return res.status(404).send('Not found');
  }
  if (blockedStaticFiles.has(base) || blockedStaticExtensions.has(ext)) {
    return res.status(404).send('Not found');
  }
  next();
});

app.use(trackSiteVisit);

app.use(express.static('.', {
  dotfiles: 'deny',
  index: ['index.html']
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' }
});

app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

app.get('/api/reviews', (req, res) => {
  try {
    const title = String(req.query.title || '');
    const reviewsByTitle = readJsonFile('reviews.json', {});
    const list = Array.isArray(reviewsByTitle[title]) ? reviewsByTitle[title] : [];
    res.json(list.filter(review => review && review.published !== false));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

app.post('/api/reviews', authenticateToken, (req, res) => {
  try {
    const { title, rating, comment, date } = req.body || {};
    const normalizedTitle = String(title || '').trim();
    if (!normalizedTitle) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const displayName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ').trim()
      || req.user.username
      || 'Користувач';
    const normalizedRating = Math.max(1, Math.min(5, Number(rating) || 0));
    const normalizedComment = String(comment || '').trim();
    if (!normalizedComment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const review = {
      user: displayName,
      rating: normalizedRating,
      comment: normalizedComment,
      date: date || new Date().toISOString(),
      published: false,
      adminReply: ''
    };

    const reviewsByTitle = readJsonFile('reviews.json', {});
    if (!Array.isArray(reviewsByTitle[normalizedTitle])) {
      reviewsByTitle[normalizedTitle] = [];
    }
    reviewsByTitle[normalizedTitle].push(review);
    writeJsonFile('reviews.json', reviewsByTitle);
    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save review' });
  }
});

// Middleware to verify JWT token (must be defined before routes use it)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const cookieToken = req.cookies ? req.cookies[AUTH_COOKIE_NAME] : null;
  const token = headerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

function requireAdminPanelAccess(req, res, next) {
  authenticateToken(req, res, () => {
    if (isSiteAdmin(req.user)) return next();
    return res.status(403).json({ error: 'Admin access required' });
  });
}

function readAdminsFile() {
  try {
    const admins = readJsonFile('admins.json', []);
    return Array.isArray(admins) ? admins : [];
  } catch (err) {
    return [];
  }
}

function writeAdminsFile(admins) {
  writeJsonFile('admins.json', Array.isArray(admins) ? admins : []);
}

const ADMIN_PERMISSION_IDS = ['products', 'masterclasses', 'users', 'reviews', 'orders', 'revenue', 'admins'];
const ADMIN_ROLE_DEFAULTS = {
  super_admin: ADMIN_PERMISSION_IDS,
  moderator: ['products', 'masterclasses', 'reviews'],
  order_manager: ['orders']
};

function normalizeAdminRole(admin = {}) {
  if (admin.role && ADMIN_ROLE_DEFAULTS[admin.role]) return admin.role;
  const permissions = Array.isArray(admin.permissions) ? admin.permissions : [];
  return permissions.includes('admins') || ADMIN_PERMISSION_IDS.every(permission => permissions.includes(permission))
    ? 'super_admin'
    : 'moderator';
}

function normalizeAdminRecord(admin = {}) {
  const role = normalizeAdminRole(admin);
  const permissions = role === 'super_admin'
    ? [...ADMIN_ROLE_DEFAULTS.super_admin]
    : (Array.isArray(admin.permissions) ? admin.permissions : ADMIN_ROLE_DEFAULTS[role] || [])
      .filter(permission => ADMIN_PERMISSION_IDS.includes(permission));
  return {
    ...admin,
    role,
    permissions
  };
}

function currentAdminRecord(user) {
  if (!user || !user.id) return null;
  const userId = Number(user.id);
  const email = String(user.email || '').toLowerCase();
  const admin = readAdminsFile().find(item => {
    if (!item) return false;
    if (Number(item.site_user_id) === userId) return true;
    return email && String(item.email || '').toLowerCase() === email;
  });
  return admin ? normalizeAdminRecord(admin) : null;
}

function isSiteAdmin(user) {
  return !!currentAdminRecord(user);
}

function adminHasPermission(user, permission) {
  const admin = currentAdminRecord(user);
  if (!admin) return false;
  return admin.role === 'super_admin' || admin.permissions.includes(permission);
}

function requireAdminPermission(permission) {
  return (req, res, next) => {
    requireAdminPanelAccess(req, res, () => {
      if (adminHasPermission(req.user, permission)) return next();
      return res.status(403).json({ error: 'Недостатньо прав доступу' });
    });
  };
}

function adminResourcePermission(resource) {
  const map = {
    products: 'products',
    sets: 'products',
    masterclasses: 'masterclasses',
    admins: 'admins',
    reviews: 'reviews',
    orders: 'orders'
  };
  return map[resource] || null;
}

function grantSiteAdmin(userId, source, callback) {
  db.get(
    'SELECT id, username, email, firstName, lastName FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      if (err) return callback(err);
      if (!user) return callback(new Error('User not found'));

      const admins = readAdminsFile();
      const already = admins.some(admin => Number(admin && admin.site_user_id) === Number(user.id));
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.email || `User ${user.id}`;
      if (!already) {
        admins.push({
          id: `site-${user.id}`,
          site_user_id: user.id,
          name,
          email: user.email,
          role: 'super_admin',
          permissions: [...ADMIN_ROLE_DEFAULTS.super_admin],
          source: source || 'promo',
          created_at: Math.floor(Date.now() / 1000)
        });
        writeAdminsFile(admins);
      }
      callback(null, { already, admin: admins.find(admin => Number(admin && admin.site_user_id) === Number(user.id)) });
    }
  );
}

const adminDataFiles = {
  products: { file: 'products.json', fallback: [] },
  masterclasses: { file: 'masterclasses.json', fallback: [] },
  sets: { file: 'sets.json', fallback: [] },
  orders: { file: 'orders.json', fallback: {} },
  reviews: { file: 'reviews.json', fallback: {} },
  admins: { file: 'admins.json', fallback: [] }
};

const ORDER_HISTORY_FILE = 'order-history.json';

function cloneFallback(value) {
  return Array.isArray(value) ? [] : {};
}

function contentFilePath(fileName) {
  return path.join(CONTENT_DIR, path.basename(fileName));
}

function seedContentFile(fileName, fallback) {
  const targetPath = contentFilePath(fileName);
  if (fs.existsSync(targetPath)) return targetPath;
  const sourcePath = path.join(__dirname, fileName);
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    return targetPath;
  }
  fs.writeFileSync(targetPath, JSON.stringify(cloneFallback(fallback), null, 2), 'utf8');
  return targetPath;
}

function readJsonFile(fileName, fallback) {
  const filePath = seedContentFile(fileName, fallback);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(fileName, data) {
  const filePath = contentFilePath(fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function readOrderHistory() {
  return readJsonFile(ORDER_HISTORY_FILE, {});
}

function writeOrderHistory(history) {
  writeJsonFile(ORDER_HISTORY_FILE, history && typeof history === 'object' ? history : {});
}

function orderHistoryKey(order, fallbackId) {
  return String((order && (order.id || order.orderId || order.pendingId)) || fallbackId || '').trim();
}

function archiveOrder(order, reason = 'snapshot', userId = null) {
  const id = orderHistoryKey(order);
  if (!id) return;
  const now = Math.floor(Date.now() / 1000);
  const history = readOrderHistory();
  history[id] = {
    ...(history[id] || {}),
    ...(order || {}),
    id,
    history_saved_at: now,
    history_reason: reason,
    history_by: userId || (history[id] && history[id].history_by) || null
  };
  if (reason === 'deleted' || reason === 'bulk_deleted' || reason === 'completed') {
    history[id].archived_at = now;
    history[id].active = false;
  } else {
    history[id].active = true;
  }
  writeOrderHistory(history);
}

function archiveOrders(orders, reason, userId = null) {
  const history = readOrderHistory();
  const now = Math.floor(Date.now() / 1000);
  Object.entries(orders || {}).forEach(([id, order]) => {
    if (!order) return;
    const key = orderHistoryKey(order, id);
    if (!key) return;
    history[key] = {
      ...(history[key] || {}),
      ...order,
      id: order.id || key,
      history_saved_at: now,
      history_reason: reason,
      history_by: userId || null,
      active: !(reason === 'deleted' || reason === 'bulk_deleted')
    };
    if (reason === 'deleted' || reason === 'bulk_deleted') history[key].archived_at = now;
  });
  writeOrderHistory(history);
}

function safeImageFileName(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const finalExt = allowedExt.includes(ext) ? ext : '.jpg';
  const base = path.basename(String(name || 'image'), ext)
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'image';
  return `${base}_${Date.now()}${finalExt}`;
}

function getAdminFileConfig(resource) {
  return adminDataFiles[resource] || null;
}

function itemKey(item, index) {
  return String((item && (item.id || item.code || item.title)) || index);
}

function findArrayIndex(items, id) {
  return items.findIndex((item, index) => itemKey(item, index) === String(id));
}

function itemHasImage(resource, item) {
  if (!['products', 'sets', 'masterclasses'].includes(resource)) return true;
  if (resource === 'masterclasses') return !!String(item && item.image || '').trim();
  return Array.isArray(item && item.images) && item.images.some(src => String(src || '').trim());
}

function normalizeCategoryText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryKey(value) {
  return normalizeCategoryText(value)
    .toLocaleLowerCase('uk-UA')
    .normalize('NFKC');
}

function canonicalCategoryFor(items, category, skipIndex = -1) {
  const cleaned = normalizeCategoryText(category) || 'Інші товари';
  const key = categoryKey(cleaned);
  const existing = (Array.isArray(items) ? items : []).find((item, index) => (
    index !== skipIndex && categoryKey(item && item.category) === key
  ));
  return existing && normalizeCategoryText(existing.category) ? normalizeCategoryText(existing.category) : cleaned;
}

function normalizeProductCategory(item, items, skipIndex = -1) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    category: canonicalCategoryFor(items, item.category, skipIndex)
  };
}

function normalizeProductCategories(items) {
  if (!Array.isArray(items)) return items;
  const canonicalByKey = new Map();
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const cleaned = normalizeCategoryText(item.category) || 'Інші товари';
    const key = categoryKey(cleaned);
    if (!canonicalByKey.has(key)) canonicalByKey.set(key, cleaned);
    return { ...item, category: canonicalByKey.get(key) };
  });
}

function getFileMtimeSeconds(fileName) {
  try {
    return Math.floor(fs.statSync(contentFilePath(fileName)).mtimeMs / 1000);
  } catch (err) {
    return 0;
  }
}

function rawOrderText(order) {
  return String((order && (order.raw || (order.summary && order.summary.raw))) || '');
}

function firstOrderItemTitle(order) {
  const raw = rawOrderText(order);
  const line = raw.split('\n').map(row => row.trim()).find(row => /^\d+\)/.test(row));
  if (line) return line.replace(/^\d+\)\s*/, '').replace(/\s+вЂ”\s+.*$/, '').trim();
  if (Array.isArray(order && order.items) && order.items[0]) {
    return order.items[0].title || order.items[0].name || '';
  }
  return '';
}

function normalizeMasterclassTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function resolveMasterclassItemsFromOrder(order) {
  const masterclasses = readJsonFile('masterclasses.json', []);
  const byTitle = new Map();
  (Array.isArray(masterclasses) ? masterclasses : []).forEach(mc => {
    const key = normalizeMasterclassTitle(mc && mc.title);
    if (key) byTitle.set(key, mc);
  });

  return (Array.isArray(order && order.items) ? order.items : [])
    .map(item => {
      const itemTitle = String((item && (item.title || item.name)) || '').trim();
      const directId = String(item && (item.masterclass_id || item.masterclassId || item.id) || '').trim();
      const matched = directId
        ? (masterclasses || []).find(mc => String(mc && mc.id) === directId)
        : byTitle.get(normalizeMasterclassTitle(itemTitle));
      if (!matched && !/майстер|мастер|master/i.test(itemTitle)) return null;
      return {
        id: String((matched && matched.id) || directId || '').trim(),
        title: String((matched && matched.title) || itemTitle).trim()
      };
    })
    .filter(item => item && item.id && item.title);
}

function isNewOrderStatus(status) {
  const value = String(status || '').toLowerCase();
  return value.includes('нов') || value.includes('new') || value.includes('рѕр');
}

function buildRecentActivity(orders, admins) {
  const events = [];
  Object.values(orders || {}).forEach(order => {
    if (!order || !order.id) return;
    const orderId = String(order.id);
    const itemTitle = firstOrderItemTitle(order);
    const customer = String(order.customer || (order.summary && order.summary.customer) || '');
    if (order.created_at) {
      events.push({
        type: 'order_created',
        ts: Number(order.created_at),
        orderId,
        itemTitle,
        customer,
        status: order.status || ''
      });
    }
    (Array.isArray(order.history) ? order.history : []).forEach(entry => {
      const status = String(entry.status || order.status || '');
      const isInitialStatus = Math.abs(Number(entry.ts || 0) - Number(order.created_at || 0)) <= 1;
      if (isInitialStatus && isNewOrderStatus(status)) return;
      events.push({
        type: 'order_status',
        ts: Number(entry.ts || order.created_at || 0),
        orderId,
        itemTitle,
        customer,
        status,
        by: entry.by || ''
      });
    });
  });

  const adminsMtime = getFileMtimeSeconds('admins.json');
  (Array.isArray(admins) ? admins : []).forEach(admin => {
    const ts = Number(admin.created_at || adminsMtime || 0);
    if (!ts) return;
    events.push({
      type: 'admin_added',
      ts,
      adminId: admin.id || '',
      adminName: String((admin && (admin.name || admin.id)) || 'Адміністратор')
    });
  });

  return events
    .filter(event => event.ts)
    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
    .slice(0, 30);
}

function buildSupportNotificationFeed(orders) {
  const events = [];
  Object.values(orders || {}).forEach(order => {
    if (!order || !order.id) return;
    const orderId = String(order.id);
    const customer = String(order.customer || (order.summary && order.summary.customer) || 'Клієнт');
    const itemTitle = firstOrderItemTitle(order) || 'Товар';
    const total = orderFinalTotal(order);
    const base = { orderId, customer, itemTitle, total };

    if (order.created_at) {
      events.push({
        ...base,
        type: 'order_created',
        ts: Number(order.created_at),
        title: `Терміново підтвердіть оплату #${orderId}`,
        text: `${customer} оформив(ла) замовлення: ${itemTitle}${total ? ` на суму ₴${total}` : ''}. Оплата очікує підтвердження.`
      });
    }

    (Array.isArray(order.history) ? order.history : []).forEach(entry => {
      const status = String(entry.status || order.status || 'нове');
      const isInitialStatus = Math.abs(Number(entry.ts || 0) - Number(order.created_at || 0)) <= 1;
      if (isInitialStatus && isNewOrderStatus(status)) return;
      events.push({
        ...base,
        type: 'order_status',
        ts: Number(entry.ts || order.created_at || 0),
        status,
        title: `Статус замовлення #${orderId} змінено`,
        text: `${customer}: замовлення "${itemTitle}" тепер має статус "${status}".`
      });
    });

    if (order.bonus_awarded_at && Number(order.bonus_stars_added) > 0) {
      events.push({
        ...base,
        type: 'bonus_added',
        ts: Number(order.bonus_awarded_at),
        stars: Number(order.bonus_stars_added),
        title: `Бонуси нараховано`,
        text: `${customer} отримав(ла) +${Number(order.bonus_stars_added)} бонусних зірок за замовлення #${orderId}.`
      });
    }
  });

  return events
    .filter(event => event.ts)
    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
    .slice(0, 120);
}

function userOrderNotificationText(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('оплач') || normalized.includes('paid')) {
    return {
      title: 'Оплату підтверджено',
      text: 'Оплату підтверджено. Дякуємо, ми вже готуємо ваше замовлення до виконання.'
    };
  }
  if (normalized.includes('виготов') || normalized.includes('process')) {
    return {
      title: 'Ми працюємо над вашим замовленням',
      text: 'Ваше замовлення вже в роботі.'
    };
  }
  if (normalized.includes('відправ') || normalized.includes('shipped')) {
    return {
      title: 'Ваше замовлення в дорозі',
      text: 'Ваше замовлення вже прямує до вас.'
    };
  }
  if (normalized.includes('викон') || normalized.includes('completed')) {
    return {
      title: 'Замовлення виконано',
      text: 'Замовлення виконано. Дякуємо, що обрали Art Light.'
    };
  }
  if (normalized.includes('скас') || normalized.includes('cancel')) {
    return {
      title: 'Замовлення скасовано',
      text: 'Ваше замовлення було скасовано.'
    };
  }
  return {
    title: 'Статус замовлення оновлено',
    text: 'Статус вашого замовлення оновлено.'
  };
}

function paymentConfirmedNotificationText() {
  return {
    title: 'Оплату підтверджено',
    text: 'Оплату підтверджено. Дякуємо, ми вже готуємо ваше замовлення до виконання.'
  };
}

function notifyUser(userId, type, message, payload = {}) {
  if (!userId) return;
  db.run(
    'INSERT INTO notifications (user_id, type, message, payload) VALUES (?, ?, ?, ?)',
    [userId, type, message, JSON.stringify(payload)]
  );
}

function normalizeOrderStatus(status) {
  return String(status || '').toLowerCase();
}

function orderTotal(order) {
  const total = Number(order && (order.total ?? (order.summary && order.summary.total)));
  return Number.isFinite(total) ? total : 0;
}

function orderStarsUsed(order) {
  const stars = Number(order && (order.stars_used ?? (order.summary && order.summary.stars_used)));
  return Number.isFinite(stars) ? stars : 0;
}

function orderFinalTotal(order) {
  const explicitValue = order && order.final_total != null
    ? order.final_total
    : (order && order.summary && order.summary.final_total != null ? order.summary.final_total : null);
  const explicit = Number(explicitValue);
  if (explicitValue != null && Number.isFinite(explicit)) return explicit;
  return Math.max(0, orderTotal(order) - orderStarsUsed(order));
}

function isCancelledOrder(order) {
  const status = normalizeOrderStatus(order && order.status);
  return ['cancel', 'скас', 'отмен'].some(marker => status.includes(marker));
}

function extractOrderItemsForAnalytics(order) {
  if (Array.isArray(order && order.items) && order.items.length) {
    return order.items.map(item => {
      const quantity = Number(item.quantity || item.qty || 1) || 1;
      const price = Number(item.price || 0) || 0;
      const total = Number(item.total || (price * quantity)) || 0;
      return {
        title: String(item.title || item.name || 'Товар').trim(),
        quantity,
        total
      };
    }).filter(item => item.title);
  }

  return rawOrderText(order).split('\n')
    .map(row => row.trim())
    .filter(row => /^\d+\)/.test(row))
    .map(row => {
      const line = row.replace(/^\d+\)\s*/, '').trim();
      const title = line.split(/\s+(?:—|вЂ”|-)\s+/)[0].trim() || 'Товар';
      const qtyMatch = line.match(/(?:×|x|Г—)\s*(\d+)/i);
      const quantity = qtyMatch ? Number(qtyMatch[1]) || 1 : 1;
      const totalMatch = line.match(/=\s*(?:₴|в‚ґ)?\s*([\d.,]+)/);
      const priceMatch = line.match(/(?:₴|в‚ґ)\s*([\d.,]+)/);
      const parsedTotal = totalMatch ? Number(String(totalMatch[1]).replace(',', '.')) : 0;
      const parsedPrice = priceMatch ? Number(String(priceMatch[1]).replace(',', '.')) : 0;
      return {
        title,
        quantity,
        total: parsedTotal || (parsedPrice * quantity) || 0
      };
    });
}

function buildRevenueStats(orders) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startTs = Math.floor(monthStart.getTime() / 1000);
  const endTs = Math.floor(nextMonthStart.getTime() / 1000);
  const cancelledMarkers = ['cancel', 'скас', 'отмен'];

  const monthlyOrders = Object.values(orders || {}).filter(order => {
    const ts = Number(order && order.created_at);
    if (!ts || ts < startTs || ts >= endTs) return false;
    const status = normalizeOrderStatus(order.status);
    return !cancelledMarkers.some(marker => status.includes(marker));
  });

  const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + orderFinalTotal(order), 0);
  return {
    monthlyRevenue,
    monthlyOrderCount: monthlyOrders.length,
    monthLabel: monthStart.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
  };
}

function buildOrderAnalytics(orders) {
  const productMap = new Map();
  const customerMap = new Map();
  const statusMap = new Map();
  const monthMap = new Map();
  const now = new Date();
  let productsSold = 0;
  let orderCount = 0;
  let totalRevenue = 0;

  for (let i = 5; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, {
      key,
      label: monthDate.toLocaleDateString('uk-UA', { month: 'short' }),
      orders: 0,
      revenue: 0
    });
  }

  Object.values(orders || {}).forEach(order => {
    if (!order || !order.id) return;
    const cancelled = isCancelledOrder(order);
    const created = Number(order.created_at || 0);
    const total = orderFinalTotal(order);
    const customer = String(order.customer || (order.summary && order.summary.customer) || 'Клієнт').trim() || 'Клієнт';
    const status = String(order.status || 'нове').trim() || 'нове';

    statusMap.set(status, (statusMap.get(status) || 0) + 1);

    if (!cancelled) {
      orderCount += 1;
      totalRevenue += total;
      const customerStats = customerMap.get(customer) || { name: customer, orders: 0, total: 0 };
      customerStats.orders += 1;
      customerStats.total += total;
      customerMap.set(customer, customerStats);

      extractOrderItemsForAnalytics(order).forEach(item => {
        const title = item.title || 'Товар';
        productsSold += Number(item.quantity || 1) || 1;
        const stats = productMap.get(title) || { title, quantity: 0, revenue: 0 };
        stats.quantity += Number(item.quantity || 1) || 1;
        stats.revenue += Number(item.total || 0) || 0;
        productMap.set(title, stats);
      });

      if (created) {
        const date = new Date(created * 1000);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const month = monthMap.get(key);
        if (month) {
          month.orders += 1;
          month.revenue += total;
        }
      }
    }
  });

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => (b.quantity - a.quantity) || (b.revenue - a.revenue))
    .slice(0, 6);
  const topCustomers = Array.from(customerMap.values())
    .sort((a, b) => (b.orders - a.orders) || (b.total - a.total))
    .slice(0, 6);
  const statusBreakdown = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    topProducts,
    topCustomers,
    monthlySales: Array.from(monthMap.values()),
    statusBreakdown,
    totals: {
      productsSold,
      activeCustomers: customerMap.size,
      averageOrder: orderCount ? Math.round(totalRevenue / orderCount) : 0
    }
  };
}

function extractOrderLineValue(raw, pattern) {
  const line = String(raw || '').split('\n').find(row => pattern.test(row));
  if (!line) return '';
  const parts = line.split(':');
  return parts.length > 1 ? parts.slice(1).join(':').trim() : line.trim();
}

function latestUserOrderField(userId, pattern) {
  const orders = {
    ...readOrderHistory(),
    ...readJsonFile('orders.json', {})
  };
  const row = Object.values(orders || {})
    .filter(order => Number(order && order.user_id) === Number(userId))
    .sort((a, b) => Number(b.created_at || b.history_saved_at || 0) - Number(a.created_at || a.history_saved_at || 0))[0];
  if (!row) return '';
  return extractOrderLineValue(rawOrderText(row), pattern);
}

function userLastActivity(userId, createdAt) {
  const orders = {
    ...readOrderHistory(),
    ...readJsonFile('orders.json', {})
  };
  const orderTs = Object.values(orders || {})
    .filter(order => Number(order && order.user_id) === Number(userId))
    .reduce((max, order) => Math.max(max, Number(order.created_at || order.history_saved_at || order.archived_at || 0)), 0);
  return new Promise((resolve) => {
    db.get(
      `SELECT MAX(value) AS last_activity FROM (
        SELECT MAX(datetime(created_at)) AS value FROM notifications WHERE user_id = ?
        UNION ALL
        SELECT MAX(datetime(last_message_at)) AS value FROM support_threads WHERE user_id = ?
      )`,
      [userId, userId],
      (err, row) => {
        if (err) return resolve(createdAt);
        const dbDate = row && row.last_activity ? new Date(row.last_activity).getTime() : 0;
        const orderDate = orderTs ? orderTs * 1000 : 0;
        const createdDate = createdAt ? new Date(createdAt).getTime() : 0;
        resolve(new Date(Math.max(dbDate || 0, orderDate || 0, createdDate || 0)).toISOString());
      }
    );
  });
}

app.get('/api/admin/overview', requireAdminPanelAccess, (req, res) => {
  try {
    const products = readJsonFile('products.json', []);
    const masterclasses = readJsonFile('masterclasses.json', []);
    const sets = readJsonFile('sets.json', []);
    const orders = readJsonFile('orders.json', {});
    const orderHistory = readOrderHistory();
    const activityOrders = {
      ...(orderHistory && typeof orderHistory === 'object' ? orderHistory : {}),
      ...(orders && typeof orders === 'object' ? orders : {})
    };
    const reviews = readJsonFile('reviews.json', {});
    const admins = readJsonFile('admins.json', []);
    const revenue = buildRevenueStats(orders);
    db.all('SELECT code, stars, title, issued_at, redeemed_by_user FROM certificate_codes ORDER BY issued_at DESC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load certificate stats' });
      db.get('SELECT COUNT(*) AS count FROM users', [], (usersErr, userRow) => {
        if (usersErr) return res.status(500).json({ error: 'Failed to load user stats' });
        db.get(`SELECT
          COUNT(*) AS total_visits,
          COUNT(DISTINCT visitor_id) AS unique_visitors
          FROM site_visits`, [], (visitsErr, visitRow) => {
          if (visitsErr) visitRow = { total_visits: 0, unique_visitors: 0 };
          res.json({
            counts: {
              products: Array.isArray(products) ? products.length : 0,
              masterclasses: Array.isArray(masterclasses) ? masterclasses.length : 0,
              sets: Array.isArray(sets) ? sets.length : 0,
              orders: orders && typeof orders === 'object' ? Object.keys(orders).length : 0,
              users: Number(userRow && userRow.count) || 0,
              visitors: Number(visitRow && visitRow.unique_visitors) || 0,
              reviews: reviews && typeof reviews === 'object'
                ? Object.values(reviews).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0)
                : 0,
              admins: Array.isArray(admins) ? admins.length : 0,
              certificates: Array.isArray(rows) ? rows.length : 0
            },
            visits: {
              total: Number(visitRow && visitRow.total_visits) || 0,
              unique: Number(visitRow && visitRow.unique_visitors) || 0
            },
            revenue,
            analytics: buildOrderAnalytics(orders),
            recentActivity: buildRecentActivity(activityOrders, admins),
            recentCertificates: rows || []
          });
        });
      });
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

app.get('/api/admin/me', requireAdminPanelAccess, (req, res) => {
  const admin = currentAdminRecord(req.user);
  res.json({
    userId: Number(req.user && req.user.id),
    role: admin ? admin.role : '',
    permissions: admin ? admin.permissions : []
  });
});

app.get('/api/admin/data/:resource', requireAdminPanelAccess, (req, res) => {
  const permission = adminResourcePermission(req.params.resource);
  if (permission && !adminHasPermission(req.user, permission)) return res.status(403).json({ error: 'Недостатньо прав доступу' });
  const config = getAdminFileConfig(req.params.resource);
  if (!config) return res.status(404).json({ error: 'Unknown resource' });
  try {
    let data = readJsonFile(config.file, config.fallback);
    if (req.params.resource === 'products') data = normalizeProductCategories(data);
    res.json(req.params.resource === 'admins' && Array.isArray(data) ? data.map(normalizeAdminRecord) : data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load resource' });
  }
});

app.post('/api/admin/data/:resource', requireAdminPanelAccess, (req, res) => {
  const permission = adminResourcePermission(req.params.resource);
  if (permission && !adminHasPermission(req.user, permission)) return res.status(403).json({ error: 'Недостатньо прав доступу' });
  const config = getAdminFileConfig(req.params.resource);
  if (!config) return res.status(404).json({ error: 'Unknown resource' });
  if (!Array.isArray(config.fallback)) {
    return res.status(400).json({ error: 'Use specialized editor for this resource' });
  }
  try {
    const items = readJsonFile(config.file, []);
    let item = req.body || {};
    if (req.params.resource === 'admins' && !item.created_at) {
      item.created_at = Math.floor(Date.now() / 1000);
      item.created_by = req.user.id;
    }
    if (req.params.resource === 'admins' && !item.id && item.site_user_id) {
      item.id = `site-${item.site_user_id}`;
    }
    if (req.params.resource === 'admins') {
      const currentAdmin = currentAdminRecord(req.user);
      if (Number(item.site_user_id) === Number(req.user.id) && (!currentAdmin || currentAdmin.role !== 'super_admin')) {
        return res.status(403).json({ error: 'Cannot edit own permissions without super admin role' });
      }
      item = normalizeAdminRecord(item);
    } else if (req.params.resource === 'products') {
      item = normalizeProductCategory(item, items);
    }
    if (!itemHasImage(req.params.resource, item)) {
      return res.status(400).json({ error: 'Додайте хоча б одне фото перед збереженням' });
    }
    if (!item.id && ['masterclasses', 'sets'].includes(req.params.resource)) {
      item.id = String(Date.now());
    }
    items.push(item);
    const nextItems = req.params.resource === 'products' ? normalizeProductCategories(items) : items;
    writeJsonFile(config.file, nextItems);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create item' });
  }
});

app.put('/api/admin/data/:resource/:id', requireAdminPanelAccess, (req, res) => {
  const permission = adminResourcePermission(req.params.resource);
  if (permission && !adminHasPermission(req.user, permission)) return res.status(403).json({ error: 'Недостатньо прав доступу' });
  const config = getAdminFileConfig(req.params.resource);
  if (!config) return res.status(404).json({ error: 'Unknown resource' });
  if (!Array.isArray(config.fallback)) {
    return res.status(400).json({ error: 'Use specialized editor for this resource' });
  }
  try {
    const items = readJsonFile(config.file, []);
    const idx = findArrayIndex(items, req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Item not found' });
    let nextItem = { ...items[idx], ...(req.body || {}) };
    if (req.params.resource === 'admins') {
      const currentAdmin = currentAdminRecord(req.user);
      if (Number(items[idx].site_user_id) === Number(req.user.id) && (!currentAdmin || currentAdmin.role !== 'super_admin')) {
        return res.status(403).json({ error: 'Cannot edit own permissions without super admin role' });
      }
      nextItem = normalizeAdminRecord(nextItem);
    } else if (req.params.resource === 'products') {
      nextItem = normalizeProductCategory(nextItem, items, idx);
    }
    if (!itemHasImage(req.params.resource, nextItem)) {
      return res.status(400).json({ error: 'Додайте хоча б одне фото перед збереженням' });
    }
    items[idx] = nextItem;
    const nextItems = req.params.resource === 'products' ? normalizeProductCategories(items) : items;
    writeJsonFile(config.file, nextItems);
    res.json(nextItem);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

app.delete('/api/admin/data/:resource/:id', requireAdminPanelAccess, (req, res) => {
  const permission = adminResourcePermission(req.params.resource);
  if (permission && !adminHasPermission(req.user, permission)) return res.status(403).json({ error: 'Недостатньо прав доступу' });
  const config = getAdminFileConfig(req.params.resource);
  if (!config) return res.status(404).json({ error: 'Unknown resource' });
  if (!Array.isArray(config.fallback)) {
    return res.status(400).json({ error: 'Use specialized editor for this resource' });
  }
  try {
    const items = readJsonFile(config.file, []);
    const idx = findArrayIndex(items, req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Item not found' });
    const removed = items.splice(idx, 1)[0];
    const nextItems = req.params.resource === 'products' ? normalizeProductCategories(items) : items;
    writeJsonFile(config.file, nextItems);
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

function isPaidOrderStatus(status) {
  const value = String(status || '').toLowerCase();
  return [
    'оплач',
    'paid',
    'confirmed',
    'підтвердж',
    'подтверж',
    'викон',
    'completed'
  ].some(part => value.includes(part));
}

function isCompletedOrderStatus(status) {
  const value = String(status || '').toLowerCase();
  return value.includes('викон') || value.includes('completed');
}

function normalizePendingId(id) {
  return String(id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function collectOrderText(value, parts = []) {
  if (value == null || parts.length > 80) return parts;
  if (typeof value === 'string' || typeof value === 'number') {
    parts.push(String(value));
    return parts;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectOrderText(item, parts));
    return parts;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach(key => collectOrderText(value[key], parts));
  }
  return parts;
}

function getOrderPendingCandidates(order, orderId) {
  const candidates = [
    orderId,
    order && order.id,
    order && order.pendingId,
    order && order.pending_id,
    order && order.pendingActionId,
    order && order.pending_action_id,
    order && order.summary && order.summary.pendingId
  ].filter(Boolean).map(String);

  collectOrderText(order).join('\n').replace(/PID\s*:\s*([A-Za-z0-9_-]+)/gi, (_, pid) => {
    candidates.push(pid);
    return _;
  });

  return [...new Set(candidates)];
}

function confirmPendingOrder(row, callback, orderContext = null) {
  if (!row) return callback(null, { success: false, awarded: false, reason: 'pending_not_found' });
  const userId = row.user_id;
  let payload = {};
  try { payload = JSON.parse(row.payload || '{}'); } catch (_) {}
  if (row.status === 'confirmed') {
    return issueMissingCertificateCodes(row, payload, callback);
  }
  if (row.type !== 'order') {
    return callback(null, { success: false, awarded: false, reason: 'not_order_pending', id: row.id });
  }
  const payloadItems = Array.isArray(payload.items) ? payload.items : [];
  const orderItems = resolveMasterclassItemsFromOrder(orderContext);
  const itemMap = new Map();
  [...payloadItems, ...orderItems].forEach(item => {
    const id = String(item && item.id || '').trim();
    if (!id) return;
    itemMap.set(id, { id, title: String(item.title || '').trim() });
  });
  const items = Array.from(itemMap.values());
  const certificates = Array.isArray(payload.certificates) ? payload.certificates : [];
  const stars = Number.isFinite(payload.stars) ? parseInt(payload.stars, 10) : (parseInt(payload.stars || '0', 10) || 0);
  const addStars = stars > 0 ? stars : 0;
  const certificateCodes = [];
  const makeCertificateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let raw = '';
    for (let i = 0; i < 12; i += 1) raw += chars.charAt(Math.floor(Math.random() * chars.length));
    return raw;
  };

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    if (items.length > 0) {
      const stmt = db.prepare('INSERT OR IGNORE INTO user_masterclasses (user_id, masterclass_id, title) VALUES (?, ?, ?)');
      items.forEach(it => stmt.run(userId, String(it.id || '').trim(), (it.title || '')));
      stmt.finalize();
    }
    if (addStars > 0) {
        db.run('UPDATE users SET bonusStars = bonusStars + ? WHERE id = ?', [addStars, userId]);
    }
    certificates.forEach(cert => {
      const starsCount = parseInt(cert.stars, 10) || 0;
      const quantity = Math.max(1, Math.min(parseInt(cert.quantity, 10) || 1, 10));
      if (starsCount <= 0) return;
      for (let i = 0; i < quantity; i += 1) {
        const code = makeCertificateCode();
        certificateCodes.push({ code, stars: starsCount, title: cert.title || `Сертифікат ${starsCount} ⭐` });
        db.run(
          'INSERT OR IGNORE INTO certificate_codes (code, stars, title, issued_at, issued_to_user) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)',
          [code, starsCount, cert.title || `Сертифікат ${starsCount} ⭐`, userId]
        );
      }
    });
    db.run('UPDATE pending_actions SET status = ?, confirmed_at = CURRENT_TIMESTAMP WHERE id = ?', ['confirmed', row.id]);
    payload.items = items;
    payload.issuedCertificateCodes = certificateCodes;
    db.run('UPDATE pending_actions SET payload = ? WHERE id = ?', [JSON.stringify(payload), row.id]);
    db.run('COMMIT', (commitErr) => {
      if (commitErr) return callback(commitErr);
      if (items.length > 0) {
        const msg1 = 'Оплату підтверджено. Надано доступ до майстер-класу(ів).';
        db.run('INSERT INTO notifications (user_id, type, message, payload) VALUES (?, ?, ?, ?)', [userId, 'masterclass_granted', msg1, JSON.stringify({ items })]);
      }
      if (addStars > 0) {
        const msg2 = `Оплату підтверджено. +${addStars} зірок додано на бонусний рахунок.`;
        db.run('INSERT INTO notifications (user_id, type, message, payload) VALUES (?, ?, ?, ?)', [userId, 'stars_added', msg2, JSON.stringify({ stars: addStars })]);
      }
      certificateCodes.forEach(cert => {
        const prettyCode = String(cert.code).replace(/(.{4})/g, '$1-').replace(/-$/, '');
        const msg3 = `Оплату підтверджено. Видано промокод ${prettyCode} на ${cert.stars} зірок.`;
        db.run(
          'INSERT INTO notifications (user_id, type, message, payload) VALUES (?, ?, ?, ?)',
          [userId, 'certificate_issued', msg3, JSON.stringify(cert)]
        );
      });
      callback(null, {
        success: true,
        awarded: addStars > 0,
        starsAdded: addStars,
        certificatesIssued: certificateCodes.length,
        id: row.id,
        userId
      });
    });
  });
}

function issueMissingCertificateCodes(row, payload, callback) {
  if (!row || row.type !== 'order') {
    return callback(null, { success: true, awarded: false, alreadyConfirmed: true, id: row && row.id, userId: row && row.user_id });
  }
  const certificates = Array.isArray(payload && payload.certificates) ? payload.certificates : [];
  const issued = Array.isArray(payload && payload.issuedCertificateCodes) ? payload.issuedCertificateCodes : [];
  if (!certificates.length || issued.length) {
    return callback(null, { success: true, awarded: false, alreadyConfirmed: true, id: row.id, userId: row.user_id });
  }

  const userId = row.user_id;
  const certificateCodes = [];
  const makeCertificateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let raw = '';
    for (let i = 0; i < 12; i += 1) raw += chars.charAt(Math.floor(Math.random() * chars.length));
    return raw;
  };

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    certificates.forEach(cert => {
      const starsCount = parseInt(cert.stars, 10) || 0;
      const quantity = Math.max(1, Math.min(parseInt(cert.quantity, 10) || 1, 10));
      if (starsCount <= 0) return;
      for (let i = 0; i < quantity; i += 1) {
        const code = makeCertificateCode();
        const entry = { code, stars: starsCount, title: cert.title || `Сертифікат ${starsCount} ⭐` };
        certificateCodes.push(entry);
        db.run(
          'INSERT OR IGNORE INTO certificate_codes (code, stars, title, issued_at, issued_to_user) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)',
          [entry.code, entry.stars, entry.title, userId]
        );
      }
    });
    payload.issuedCertificateCodes = certificateCodes;
    db.run('UPDATE pending_actions SET payload = ? WHERE id = ?', [JSON.stringify(payload), row.id]);
    db.run('COMMIT', (commitErr) => {
      if (commitErr) return callback(commitErr);
      certificateCodes.forEach(cert => {
        const prettyCode = String(cert.code).replace(/(.{4})/g, '$1-').replace(/-$/, '');
        const msg = `Оплату підтверджено. Видано промокод ${prettyCode} на ${cert.stars} зірок.`;
        db.run(
          'INSERT INTO notifications (user_id, type, message, payload) VALUES (?, ?, ?, ?)',
          [userId, 'certificate_issued', msg, JSON.stringify(cert)]
        );
      });
      callback(null, {
        success: true,
        awarded: false,
        alreadyConfirmed: true,
        recoveredCertificates: certificateCodes.length,
        certificatesIssued: certificateCodes.length,
        id: row.id,
        userId
      });
    });
  });
}

function confirmPendingOrderForAdmin(order, orderId, callback) {
  const candidates = getOrderPendingCandidates(order, orderId);
  const exact = candidates.find(id => /^p[_-]/i.test(id));
  if (exact) {
    db.get('SELECT * FROM pending_actions WHERE id = ?', [exact], (err, row) => {
      if (err) return callback(err);
      if (row) return confirmPendingOrder(row, callback, order);
      findPendingOrderByNormalized(candidates, callback, order);
    });
    return;
  }
  findPendingOrderByNormalized(candidates, callback, order);
}

function findPendingOrderByNormalized(candidates, callback, orderContext = null) {
  const normalized = new Set(candidates.map(normalizePendingId).filter(Boolean));
  if (!normalized.size) {
    return callback(null, { success: false, awarded: false, reason: 'pending_id_missing' });
  }
  db.all("SELECT * FROM pending_actions WHERE type = 'order' AND status != 'cancelled' ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return callback(err);
    const row = (rows || []).find(item => normalized.has(normalizePendingId(item.id)));
    if (!row) return callback(null, { success: false, awarded: false, reason: 'pending_not_found' });
    confirmPendingOrder(row, callback, orderContext);
  });
}

app.post('/api/orders', authenticateToken, (req, res) => {
  try {
    const orders = readJsonFile('orders.json', {});
    const body = req.body || {};
    const rawOrderId = String(body.orderId || '').replace(/[^A-Za-z0-9_-]/g, '');
    const pendingId = String(body.pendingId || '').replace(/[^A-Za-z0-9_-]/g, '');
    const id = pendingId || (rawOrderId ? `order_${rawOrderId}` : genId());
    const now = Math.floor(Date.now() / 1000);
    const summary = body.summary && typeof body.summary === 'object' ? body.summary : {};
    const items = Array.isArray(body.items) ? body.items : [];
    const total = Number(body.total || summary.total || 0) || 0;
    const bodyStarsUsed = Number(body.stars_used == null ? (summary.stars_used ?? 0) : body.stars_used) || 0;
    const finalTotal = body.final_total == null
      ? (summary.final_total == null ? Math.max(0, total - bodyStarsUsed) : summary.final_total)
      : body.final_total;
    const customer = String(body.customer || summary.customer || '').trim();
    const raw = String(body.raw || summary.raw || '').trim();

    const isNewOrder = !(orders[id] && typeof orders[id] === 'object');
    const previous = isNewOrder ? {} : orders[id];
    const order = {
      ...previous,
      id,
      orderId: rawOrderId || previous.orderId || id,
      pendingId: pendingId || previous.pendingId || '',
      user_id: req.user.id,
      status: previous.status || String(body.status || 'нове'),
      created_at: previous.created_at || now,
      summary: {
        ...summary,
        raw,
        total,
        final_total: finalTotal == null ? null : Number(finalTotal),
        stars_used: bodyStarsUsed,
        customer
      },
      customer,
      total,
      final_total: finalTotal == null ? null : Number(finalTotal),
      stars_used: bodyStarsUsed,
      items,
      raw,
      history: Array.isArray(previous.history) && previous.history.length
        ? previous.history
        : [{ ts: now, status: 'нове', by: req.user.id }]
    };

    orders[id] = order;
    writeJsonFile('orders.json', orders);
    archiveOrder(order, isNewOrder ? 'created' : 'updated', req.user.id);

    if (isNewOrder) {
      notifyUser(req.user.id, 'order_created', 'Ви оформили замовлення. Ми отримали його і скоро опрацюємо.', {
        orderId: id,
        total,
        final_total: finalTotal,
        stars_used: bodyStarsUsed,
        items
      });
      const adminUserIds = readAdminsFile()
        .map(admin => Number(admin && admin.site_user_id))
        .filter(Boolean);
      const uniqueAdminIds = [...new Set(adminUserIds)];
      uniqueAdminIds.forEach(adminId => {
        db.run(
          'INSERT INTO notifications (user_id, type, message, payload) VALUES (?, ?, ?, ?)',
          [
            adminId,
            'order_created',
            `Нове замовлення #${rawOrderId || id} на суму ₴${finalTotal ?? total}`,
            JSON.stringify({ orderId: id, customer, total, final_total: finalTotal, stars_used: bodyStarsUsed, items })
          ]
        );
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save order' });
  }
});

app.put('/api/admin/orders/:id/status', requireAdminPermission('orders'), (req, res) => {
  try {
    const orders = readJsonFile('orders.json', {});
    const order = orders[req.params.id];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const status = String(req.body.status || '').trim();
    if (!status) return res.status(400).json({ error: 'Status is required' });
    order.status = status;
    order.history = Array.isArray(order.history) ? order.history : [];
    order.history.push({ ts: Math.floor(Date.now() / 1000), status, by: req.user.id });
    const paidStatus = isPaidOrderStatus(status);
    const userStatusMessage = paidStatus
      ? paymentConfirmedNotificationText()
      : userOrderNotificationText(status);
    notifyUser(order.user_id, paidStatus ? 'payment_confirmed' : 'order_status', userStatusMessage.text, {
      orderId: req.params.id,
      title: userStatusMessage.title,
      status,
      total: orderFinalTotal(order)
    });
    const finish = (bonus) => {
      const completedStatus = isCompletedOrderStatus(status);
      if (bonus && bonus.success && bonus.id) {
        order.pending_confirmed_id = bonus.id;
        order.bonus_awarded_at = bonus.alreadyConfirmed ? order.bonus_awarded_at : Math.floor(Date.now() / 1000);
        order.bonus_stars_added = bonus.starsAdded || order.bonus_stars_added || 0;
      }
      if (completedStatus) {
        order.active = false;
        archiveOrder(order, 'completed', req.user.id);
        delete orders[req.params.id];
        writeJsonFile('orders.json', orders);
        return res.json({ ...order, bonus, archived: true });
      }
      writeJsonFile('orders.json', orders);
      archiveOrder(order, 'status', req.user.id);
      res.json({ ...order, bonus });
    };
    if (paidStatus) {
      confirmPendingOrderForAdmin(order, req.params.id, (bonusErr, bonus) => {
        if (bonusErr) return res.status(500).json({ error: 'Failed to confirm payment bonus' });
        finish(bonus);
      });
      return;
    }
    finish(null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

app.delete('/api/admin/orders/history', requireAdminPermission('orders'), (req, res) => {
  try {
    const history = readOrderHistory();
    const removed = Object.keys(history || {}).length;
    writeOrderHistory({});
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear order history' });
  }
});

app.delete('/api/admin/orders/:id', requireAdminPermission('orders'), (req, res) => {
  try {
    const orders = readJsonFile('orders.json', {});
    if (!orders[req.params.id]) return res.status(404).json({ error: 'Order not found' });
    const removed = orders[req.params.id];
    archiveOrder({ ...removed, active: false }, 'deleted', req.user.id);
    delete orders[req.params.id];
    writeJsonFile('orders.json', orders);
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

app.get('/api/admin/orders/history', requireAdminPermission('orders'), (req, res) => {
  try {
    res.json(readOrderHistory());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load order history' });
  }
});

app.delete('/api/admin/orders', requireAdminPermission('orders'), (req, res) => {
  try {
    const orders = readJsonFile('orders.json', {});
    const count = Object.keys(orders || {}).length;
    if (count) archiveOrders(orders, 'bulk_deleted', req.user.id);
    writeJsonFile('orders.json', {});
    res.json({ success: true, removed: count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete orders' });
  }
});

app.get('/api/admin/users', requireAdminPermission('users'), (req, res) => {
  const admins = readAdminsFile();
  db.all(
    `SELECT id, username, email, firstName, lastName, phone, telegram, address, bonusStars, certificateBonusStars, created_at
     FROM users
     ORDER BY id DESC`,
    [],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load users' });
      const result = await Promise.all((rows || []).map(async (user) => {
        const isAdmin = admins.some(admin => Number(admin && admin.site_user_id) === Number(user.id));
        const telegram = user.telegram || latestUserOrderField(user.id, /Telegram/i);
        const lastActivity = await userLastActivity(user.id, user.created_at);
        return {
          ...user,
          password: '••••••••',
          telegram,
          isAdmin,
          role: isAdmin ? 'admin' : 'client',
          last_activity: lastActivity
        };
      }));
      res.json(result);
    }
  );
});

app.put('/api/admin/users/:id', requireAdminPermission('users'), (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  const bodyData = req.body || {};
  const fields = ['username', 'email', 'firstName', 'lastName', 'phone', 'telegram', 'address'];
  const updates = [];
  const values = [];
  fields.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(bodyData, field)) {
      updates.push(`${field} = ?`);
      values.push(String(bodyData[field] || '').trim());
    }
  });
  if (Object.prototype.hasOwnProperty.call(bodyData, 'bonusStars')) {
    updates.push('bonusStars = ?');
    values.push(Math.max(0, Number(bodyData.bonusStars) || 0));
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values, function(err) {
    if (err) return res.status(500).json({ error: 'Failed to update user' });
    if (!this.changes) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  });
});

app.put('/api/admin/users/:id/password', requireAdminPermission('users'), async (req, res) => {
  const id = Number(req.params.id);
  const password = String(req.body && req.body.password || '').trim();
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, id], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to update password' });
      if (!this.changes) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true });
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

app.delete('/api/admin/users/:id', requireAdminPermission('users'), (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete user' });
    if (!this.changes) return res.status(404).json({ error: 'User not found' });
    const admins = readAdminsFile().filter(admin => Number(admin && admin.site_user_id) !== id);
    writeAdminsFile(admins);
    res.json({ success: true });
  });
});

function normalizeAdminReviewPayload(body, previous = {}) {
  return {
    ...previous,
    user: String(body.user || previous.user || 'Користувач'),
    rating: Math.max(1, Math.min(5, Number(body.rating || previous.rating || 5))),
    comment: String(body.comment || previous.comment || ''),
    date: previous.date || body.date || new Date().toISOString(),
    adminReply: String(body.adminReply ?? body.reply ?? previous.adminReply ?? previous.reply ?? ''),
    published: body.published === undefined ? previous.published !== false : !!body.published
  };
}

app.post('/api/admin/reviews', requireAdminPermission('reviews'), (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const reviews = readJsonFile('reviews.json', {});
    if (!Array.isArray(reviews[title])) reviews[title] = [];
    const review = normalizeAdminReviewPayload(req.body, { date: new Date().toISOString(), published: true });
    reviews[title].push(review);
    writeJsonFile('reviews.json', reviews);
    res.status(201).json({ title, index: reviews[title].length - 1, review });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save review' });
  }
});

app.put('/api/admin/reviews/:title/:index', requireAdminPermission('reviews'), (req, res) => {
  try {
    const reviews = readJsonFile('reviews.json', {});
    const oldTitle = decodeURIComponent(req.params.title);
    const idx = Number(req.params.index);
    if (!Array.isArray(reviews[oldTitle]) || !Number.isInteger(idx) || idx < 0 || idx >= reviews[oldTitle].length) {
      return res.status(404).json({ error: 'Review not found' });
    }
    const previous = reviews[oldTitle][idx];
    const nextTitle = String(req.body.title || oldTitle).trim() || oldTitle;
    const updated = normalizeAdminReviewPayload(req.body, previous);
    reviews[oldTitle].splice(idx, 1);
    if (!reviews[oldTitle].length) delete reviews[oldTitle];
    if (!Array.isArray(reviews[nextTitle])) reviews[nextTitle] = [];
    reviews[nextTitle].push(updated);
    writeJsonFile('reviews.json', reviews);
    res.json({ success: true, title: nextTitle, index: reviews[nextTitle].length - 1, review: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update review' });
  }
});

app.delete('/api/admin/reviews/low-rating', requireAdminPermission('reviews'), (req, res) => {
  try {
    const title = String(req.query.title || '').trim();
    const threshold = Math.max(1, Math.min(5, Number(req.query.threshold || 4)));
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const reviews = readJsonFile('reviews.json', {});
    if (!Array.isArray(reviews[title])) return res.json({ success: true, removed: 0 });
    const before = reviews[title].length;
    reviews[title] = reviews[title].filter(review => Number(review && review.rating || 0) >= threshold);
    const removed = before - reviews[title].length;
    if (!reviews[title].length) delete reviews[title];
    writeJsonFile('reviews.json', reviews);
    res.json({ success: true, title, removed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete low rating reviews' });
  }
});

app.delete('/api/admin/reviews/:title/:index', requireAdminPermission('reviews'), (req, res) => {
  try {
    const reviews = readJsonFile('reviews.json', {});
    const title = decodeURIComponent(req.params.title);
    const idx = Number(req.params.index);
    if (!Array.isArray(reviews[title]) || !Number.isInteger(idx) || idx < 0 || idx >= reviews[title].length) {
      return res.status(404).json({ error: 'Review not found' });
    }
    const removed = reviews[title].splice(idx, 1)[0];
    writeJsonFile('reviews.json', reviews);
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

app.get('/api/admin/certificates', requireAdminPermission('revenue'), (req, res) => {
  db.all(`
    SELECT
      c.*,
      u.username AS redeemed_username,
      u.firstName AS redeemed_first_name,
      u.lastName AS redeemed_last_name,
      u.email AS redeemed_email
    FROM certificate_codes c
    LEFT JOIN users u ON u.id = c.redeemed_by_user
    ORDER BY c.issued_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load certificates' });
    res.json(rows || []);
  });
});

app.post('/api/admin/certificates', requireAdminPermission('revenue'), (req, res) => {
  const code = String(req.body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const stars = Number(req.body.stars) || 0;
  const title = String(req.body.title || '').trim() || null;
  const expiresAt = String(req.body.expires_at || '').trim() || null;
  if (!code || stars <= 0) return res.status(400).json({ error: 'Code and stars are required' });
  db.run(
    'INSERT INTO certificate_codes (code, stars, title, issued_at, issued_by_user, active, expires_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 1, ?)',
    [code, stars, title, req.user.id, expiresAt],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to create certificate' });
      res.status(201).json({ code, stars, title, active: 1, expires_at: expiresAt });
    }
  );
});

app.patch('/api/admin/certificates/:code', requireAdminPermission('revenue'), (req, res) => {
  const code = String(req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const active = req.body && (req.body.active === true || req.body.active === 1 || req.body.active === '1') ? 1 : 0;
  db.run('UPDATE certificate_codes SET active = ? WHERE code = ?', [active, code], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to update certificate' });
    if (!this.changes) return res.status(404).json({ error: 'Certificate not found' });
    res.json({ success: true, code, active });
  });
});

app.delete('/api/admin/certificates/:code', requireAdminPermission('revenue'), (req, res) => {
  const code = String(req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  db.run('DELETE FROM certificate_codes WHERE code = ?', [code], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete certificate' });
    if (!this.changes) return res.status(404).json({ error: 'Certificate not found' });
    res.json({ success: true });
  });
});

app.get('/api/admin/admin-promo-codes', requireAdminPermission('admins'), (req, res) => {
  db.all(
    'SELECT code, title, issued_at, issued_by_user, redeemed_by_user, redeemed_at, active FROM admin_promo_codes ORDER BY issued_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load admin promo codes' });
      res.json(rows || []);
    }
  );
});

app.post('/api/admin/admin-promo-codes', requireAdminPermission('admins'), (req, res) => {
  const requested = String(req.body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const title = String(req.body.title || '').trim() || 'Admin access';
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'ADMIN';
    for (let i = 0; i < 10; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };
  const code = requested || generateCode();
  if (code.length < 8) return res.status(400).json({ error: 'Code is too short' });

  db.run(
    'INSERT INTO admin_promo_codes (code, title, issued_by_user) VALUES (?, ?, ?)',
    [code, title, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to create admin promo code' });
      res.status(201).json({ code, title, active: 1 });
    }
  );
});

app.delete('/api/admin/admin-promo-codes/:code', requireAdminPermission('admins'), (req, res) => {
  const code = String(req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  db.run('DELETE FROM admin_promo_codes WHERE code = ?', [code], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete admin promo code' });
    if (!this.changes) return res.status(404).json({ error: 'Admin promo code not found' });
    res.json({ success: true });
  });
});

app.post('/api/admin/upload-image', requireAdminPanelAccess, (req, res) => {
  const resource = String(req.body && req.body.resource || '').trim();
  const permission = resource === 'masterclasses' ? 'masterclasses' : 'products';
  if (!adminHasPermission(req.user, permission)) return res.status(403).json({ error: 'Недостатньо прав доступу' });
  try {
    const { fileName, dataUrl } = req.body || {};
    const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });

    const finalName = safeImageFileName(fileName);
    const filePath = path.join(UPLOADS_DIR, finalName);
    fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
    res.status(201).json({ path: `/uploads/${finalName}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    
    // Create users table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      firstName TEXT,
      lastName TEXT,
      phone TEXT,
      telegram TEXT,
      address TEXT,
      bonusStars INTEGER DEFAULT 0,
      certificateBonusStars INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS site_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      path TEXT,
      user_agent TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.all(`PRAGMA table_info(users)`, [], (err, rows) => {
      if (err) { console.warn('PRAGMA users table_info error:', err); return; }
      const hasTelegram = Array.isArray(rows) && rows.some(r => String(r.name) === 'telegram');
      if (!hasTelegram) {
        db.run(`ALTER TABLE users ADD COLUMN telegram TEXT`, (e2) => {
          if (e2) console.warn('ALTER TABLE add users telegram failed (may already exist):', e2.message);
        });
      }
      const hasCertificateBonusStars = Array.isArray(rows) && rows.some(r => String(r.name) === 'certificateBonusStars');
      if (!hasCertificateBonusStars) {
        db.run(`ALTER TABLE users ADD COLUMN certificateBonusStars INTEGER DEFAULT 0`, (e2) => {
          if (e2) console.warn('ALTER TABLE add users certificateBonusStars failed (may already exist):', e2.message);
        });
      }
    });

    // Create table for purchased masterclasses (entitlements)
    db.run(`CREATE TABLE IF NOT EXISTS user_masterclasses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      masterclass_id TEXT NOT NULL,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, masterclass_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Create table for certificate promo codes (issued client-side)
    db.run(`CREATE TABLE IF NOT EXISTS certificate_codes (
      code TEXT PRIMARY KEY,
      stars INTEGER NOT NULL,
      title TEXT,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      issued_by_user INTEGER,
      issued_to_user INTEGER,
      redeemed_by_user INTEGER,
      redeemed_at DATETIME,
      active INTEGER DEFAULT 1,
      expires_at TEXT,
      FOREIGN KEY (issued_by_user) REFERENCES users(id),
      FOREIGN KEY (issued_to_user) REFERENCES users(id),
      FOREIGN KEY (redeemed_by_user) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admin_promo_codes (
      code TEXT PRIMARY KEY,
      title TEXT,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      issued_by_user INTEGER,
      redeemed_by_user INTEGER,
      redeemed_at DATETIME,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (issued_by_user) REFERENCES users(id),
      FOREIGN KEY (redeemed_by_user) REFERENCES users(id)
    )`, () => {
      if (ADMIN_PROMO_CODE) {
        db.run(
          'INSERT OR IGNORE INTO admin_promo_codes (code, title, issued_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [ADMIN_PROMO_CODE, 'Admin access']
        );
      }
    });

    // Migration: add issued_to_user column if missing in existing DB
    db.all(`PRAGMA table_info(certificate_codes)`, [], (err, rows) => {
      if (err) { console.warn('PRAGMA table_info error:', err); return; }
      const hasIssuedTo = Array.isArray(rows) && rows.some(r => String(r.name) === 'issued_to_user');
      if (!hasIssuedTo) {
        db.run(`ALTER TABLE certificate_codes ADD COLUMN issued_to_user INTEGER`, (e2) => {
          if (e2) console.warn('ALTER TABLE add issued_to_user failed (may already exist):', e2.message);
        });
      }
      const hasActive = Array.isArray(rows) && rows.some(r => String(r.name) === 'active');
      if (!hasActive) {
        db.run(`ALTER TABLE certificate_codes ADD COLUMN active INTEGER DEFAULT 1`, (e2) => {
          if (e2) console.warn('ALTER TABLE add certificate active failed (may already exist):', e2.message);
        });
      }
      const hasExpiresAt = Array.isArray(rows) && rows.some(r => String(r.name) === 'expires_at');
      if (!hasExpiresAt) {
        db.run(`ALTER TABLE certificate_codes ADD COLUMN expires_at TEXT`, (e2) => {
          if (e2) console.warn('ALTER TABLE add certificate expires_at failed (may already exist):', e2.message);
        });
      }
    });

    // Pending actions table (grant after bot confirmation)
    db.run(`CREATE TABLE IF NOT EXISTS pending_actions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,              -- 'masterclass' | 'certificate'
      payload TEXT,                    -- JSON string
      status TEXT DEFAULT 'pending',   -- 'pending' | 'confirmed' | 'cancelled'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Notifications table for website to fetch
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS support_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      status TEXT DEFAULT 'open',
      last_message TEXT,
      last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      sender_user_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES support_threads(id),
      FOREIGN KEY (sender_user_id) REFERENCES users(id)
    )`);
  }
});

// ===== Pending actions and notifications =====
function genId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function getSupportThreadForUser(userId, callback) {
  db.run(
    'INSERT OR IGNORE INTO support_threads (user_id) VALUES (?)',
    [userId],
    (insertErr) => {
      if (insertErr) return callback(insertErr);
      db.get(
        `SELECT t.*, u.firstName, u.lastName, u.username, u.email
         FROM support_threads t
         JOIN users u ON u.id = t.user_id
         WHERE t.user_id = ?`,
        [userId],
        callback
      );
    }
  );
}

function canAccessSupportThread(user, thread, isAdmin) {
  return !!thread && (isAdmin || Number(thread.user_id) === Number(user.id));
}

app.get('/api/support/threads', authenticateToken, (req, res) => {
  const admin = isSiteAdmin(req.user);
  if (!admin) {
    return getSupportThreadForUser(req.user.id, (err, thread) => {
      if (err) return res.status(500).json({ error: 'Failed to load chat' });
      res.json({ isAdmin: false, threads: [thread] });
    });
  }

  db.all(
    `SELECT t.*, u.firstName, u.lastName, u.username, u.email,
      (SELECT COUNT(*) FROM support_messages m WHERE m.thread_id = t.id) AS messages_count
     FROM support_threads t
     JOIN users u ON u.id = t.user_id
     ORDER BY datetime(t.last_message_at) DESC, t.id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load chats' });
      res.json({ isAdmin: true, threads: rows || [] });
    }
  );
});

app.get('/api/support/threads/:id/messages', authenticateToken, (req, res) => {
  const threadId = Number(req.params.id);
  const admin = isSiteAdmin(req.user);
  db.get('SELECT * FROM support_threads WHERE id = ?', [threadId], (err, thread) => {
    if (err) return res.status(500).json({ error: 'Failed to load chat' });
    if (!canAccessSupportThread(req.user, thread, admin)) return res.status(403).json({ error: 'Forbidden' });
    db.all(
      'SELECT id, thread_id, sender_user_id, sender_role, message, created_at FROM support_messages WHERE thread_id = ? ORDER BY id ASC',
      [threadId],
      (messagesErr, rows) => {
        if (messagesErr) return res.status(500).json({ error: 'Failed to load messages' });
        res.json({ messages: rows || [] });
      }
    );
  });
});

app.post('/api/support/threads/:id/messages', authenticateToken, (req, res) => {
  const threadId = Number(req.params.id);
  const text = String((req.body && req.body.message) || '').trim();
  if (!text) return res.status(400).json({ error: 'Message is required' });
  if (text.length > 2000) return res.status(400).json({ error: 'Message is too long' });
  const admin = isSiteAdmin(req.user);

  db.get('SELECT * FROM support_threads WHERE id = ?', [threadId], (err, thread) => {
    if (err) return res.status(500).json({ error: 'Failed to load chat' });
    if (!canAccessSupportThread(req.user, thread, admin)) return res.status(403).json({ error: 'Forbidden' });
    const role = admin ? 'admin' : 'user';
    db.run(
      'INSERT INTO support_messages (thread_id, sender_user_id, sender_role, message) VALUES (?, ?, ?, ?)',
      [threadId, req.user.id, role, text],
      function(insertErr) {
        if (insertErr) return res.status(500).json({ error: 'Failed to send message' });
        db.run(
          'UPDATE support_threads SET last_message = ?, last_message_at = CURRENT_TIMESTAMP WHERE id = ?',
          [text, threadId],
          () => {
            db.get(
              'SELECT id, thread_id, sender_user_id, sender_role, message, created_at FROM support_messages WHERE id = ?',
              [this.lastID],
              (messageErr, message) => {
                if (messageErr) return res.status(500).json({ error: 'Failed to load sent message' });
                res.status(201).json({ message });
              }
            );
          }
        );
      }
    );
  });
});

app.get('/api/support/notifications', authenticateToken, (req, res) => {
  if (isSiteAdmin(req.user)) {
    try {
      const orders = readJsonFile('orders.json', {});
      return res.json({ isAdmin: true, items: buildSupportNotificationFeed(orders) });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to load notifications' });
    }
  }

  db.all(
    'SELECT id, type, message, payload, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 80',
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load notifications' });
      const items = (rows || []).map(row => {
        const payload = (() => { try { return JSON.parse(row.payload || '{}'); } catch (_) { return {}; } })();
        return {
          id: row.id,
          type: row.type,
          ts: row.created_at,
          title: row.type === 'certificate_issued'
            ? 'Сертифікат готовий'
            : payload.title || (row.type === 'stars_added'
            ? 'Бонуси нараховано'
            : row.type === 'payment_confirmed'
              ? 'Оплату підтверджено'
              : 'Повідомлення акаунта'),
          text: row.message || '',
          payload
        };
      });
      res.json({ isAdmin: false, items });
    }
  );
});

app.delete('/api/support/notifications', authenticateToken, (req, res) => {
  db.run('DELETE FROM notifications WHERE user_id = ?', [req.user.id], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to clear notifications' });
    res.json({ success: true, cleared: this.changes || 0 });
  });
});

app.get('/api/support/unread-indicator', authenticateToken, (req, res) => {
  const admin = isSiteAdmin(req.user);
  const params = [];
  let sql = `
    SELECT m.id, m.thread_id, m.sender_role, m.message, m.created_at
    FROM support_messages m
    JOIN support_threads t ON t.id = m.thread_id
    WHERE m.sender_role = ?
  `;
  if (admin) {
    params.push('user');
  } else {
    params.push('admin');
    sql += ' AND t.user_id = ?';
    params.push(req.user.id);
  }
  sql += ' ORDER BY m.id DESC LIMIT 20';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load chat indicators' });
    res.json({ items: rows || [] });
  });
});

// Create a pending action (requires auth)
app.post('/api/pending', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { type, payload } = req.body || {};
    const t = String(type || '').trim();
    if (!t || !['masterclass', 'certificate', 'order'].includes(t)) {
      return res.status(400).json({ error: 'Invalid type' });
    }
    const id = genId();
    const json = JSON.stringify(payload || {});
    db.run('INSERT INTO pending_actions (id, user_id, type, payload) VALUES (?, ?, ?, ?)', [id, userId, t, json], function(err){
      if (err) return res.status(500).json({ error: 'Database error' });
      return res.json({ success: true, id });
    });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Fetch unread notifications for current user
app.get('/api/notifications', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all('SELECT id, type, message, payload, created_at FROM notifications WHERE user_id = ? AND read = 0 ORDER BY id ASC', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const items = (rows || []).map(r => ({ id: r.id, type: r.type, message: r.message, payload: (()=>{ try{return JSON.parse(r.payload||'{}');}catch(_){return {};}})(), created_at: r.created_at }));
    res.json({ items });
  });
});

// Acknowledge notifications
app.post('/api/notifications/ack', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs' });
  const placeholders = ids.map(() => '?').join(',');
  db.run(`UPDATE notifications SET read = 1 WHERE user_id = ? AND id IN (${placeholders})`, [userId, ...ids], function(err){
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, updated: this.changes || 0 });
  });
});

// Registration endpoint
app.post('/api/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, firstName, lastName, phone, address } = req.body;

  try {
    // Check if user already exists
    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (row) {
        return res.status(400).json({ error: 'User with this username or email already exists' });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insert new user
      db.run(
        'INSERT INTO users (username, email, password, firstName, lastName, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [username, email, hashedPassword, firstName, lastName, phone || '', address || ''],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating user' });
          }

          // Generate JWT token
          const token = jwt.sign(
            { 
              id: this.lastID, 
              username: username,
              email: email 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions);
          res.status(201).json({
            message: 'User registered successfully',
            user: {
              id: this.lastID,
              username: username,
              email: email,
              firstName: firstName,
              lastName: lastName,
              bonusStars: 0,
              certificateBonusStars: 0,
              regularBonusStars: 0
            }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login endpoint
app.post('/api/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username,
          email: user.email 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions);
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          address: user.address,
          bonusStars: user.bonusStars,
          certificateBonusStars: user.certificateBonusStars || 0,
          regularBonusStars: Math.max(0, (user.bonusStars || 0) - (user.certificateBonusStars || 0))
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { ...authCookieOptions, maxAge: undefined });
  res.json({ success: true });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error'
  });
});

// Certificate codes must be created from the admin panel.
app.post('/api/certificates/issue', (req, res) => {
  return res.status(410).json({
    error: 'Certificate creation is available only in the admin panel.'
  });
});

function redeemAdminPromoCode(userId, code, res) {
  db.get(
    'SELECT code, title, redeemed_by_user, active FROM admin_promo_codes WHERE code = ?',
    [code],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!row || Number(row.active) !== 1) return res.status(404).json({ error: 'Промокод не знайдено' });
      if (row.redeemed_by_user) return res.status(400).json({ error: 'Цей промокод уже активовано' });

      grantSiteAdmin(userId, 'promo', (grantErr, result) => {
        if (grantErr) return res.status(500).json({ error: 'Не вдалося видати права адміністратора' });
        db.run(
          'UPDATE admin_promo_codes SET redeemed_by_user = ?, redeemed_at = CURRENT_TIMESTAMP WHERE code = ?',
          [userId, code],
          (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Database error' });
            db.run(
              'INSERT INTO notifications (user_id, type, message, payload) VALUES (?, ?, ?, ?)',
              [
                userId,
                'admin_granted',
                'Ваш акаунт отримав доступ адміністратора.',
                JSON.stringify({ code, already: !!(result && result.already) })
              ]
            );
            return res.json({
              success: true,
              adminGranted: true,
              alreadyAdmin: !!(result && result.already),
              message: 'Ваш акаунт тепер має доступ адміністратора'
            });
          }
        );
      });
    }
  );
}

// Redeem a promo code: certificate codes add stars, admin codes grant admin access.
app.post('/api/certificates/redeem', authenticateToken, (req, res) => {
  const userId = req.user.id;
  try {
    const raw = String((req.body && req.body.code) || '').toUpperCase();
    const code = raw.replace(/[^A-Z0-9]/g, '');
    if (!code) return res.status(400).json({ error: 'Некоректний промокод' });

    db.get('SELECT code, stars, redeemed_by_user, active, expires_at FROM certificate_codes WHERE code = ?', [code], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!row) return redeemAdminPromoCode(userId, code, res);
      if (Number(row.active) === 0) return res.status(400).json({ error: 'Цей сертифікат тимчасово деактивовано' });
      if (row.expires_at) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expires = new Date(`${row.expires_at}T23:59:59`);
        if (!Number.isNaN(expires.getTime()) && expires < today) {
          return res.status(400).json({ error: 'Термін дії сертифіката минув' });
        }
      }
      if (row.redeemed_by_user) return res.status(400).json({ error: 'Цей промокод уже активовано' });

      const stars = parseInt(row.stars, 10) || 0;
      if (stars <= 0) return res.status(400).json({ error: 'Некоректний номінал сертифіката' });

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('UPDATE certificate_codes SET redeemed_by_user = ?, redeemed_at = CURRENT_TIMESTAMP WHERE code = ?', [userId, code]);
        db.run('UPDATE users SET bonusStars = bonusStars + ?, certificateBonusStars = certificateBonusStars + ? WHERE id = ?', [stars, stars, userId]);
        db.run('COMMIT', (commitErr) => {
          if (commitErr) return res.status(500).json({ error: 'Помилка сервера' });
          db.get('SELECT bonusStars, certificateBonusStars FROM users WHERE id = ?', [userId], (e2, u) => {
            if (e2 || !u) return res.json({ success: true, starsAdded: stars });
            res.json({
              success: true,
              starsAdded: stars,
              bonusStars: u.bonusStars,
              certificateBonusStars: u.certificateBonusStars || 0,
              regularBonusStars: Math.max(0, (u.bonusStars || 0) - (u.certificateBonusStars || 0))
            });
          });
        });
      });
    });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get purchased masterclasses for the logged-in user
app.get('/api/user/masterclasses', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all(
    'SELECT masterclass_id AS id, title, created_at FROM user_masterclasses WHERE user_id = ?',
    [userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ items: rows || [] });
    }
  );
});

// Masterclass access is granted only after admin payment confirmation.
app.post('/api/user/masterclasses/grant', authenticateToken, (req, res) => {
  return res.status(410).json({
    error: 'Masterclass access is granted after admin payment confirmation.'
  });
});

// Get user's bonus stars
app.get('/api/user/stars', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  db.get('SELECT bonusStars, certificateBonusStars FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Користувач не знайдений' });
    }
    
    const bonusStars = user.bonusStars || 0;
    const certificateBonusStars = user.certificateBonusStars || 0;
    res.json({
      bonusStars,
      certificateBonusStars,
      regularBonusStars: Math.max(0, bonusStars - certificateBonusStars)
    });
  });
});

// Update user's bonus stars (spending only)
app.post('/api/user/stars', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { action, amount } = req.body;
  const starsToSpend = Math.max(0, parseInt(amount, 10) || 0);
  
  if (!action || starsToSpend <= 0) {
    return res.status(400).json({ error: 'Невірні параметри' });
  }
  if (action !== 'subtract') {
    return res.status(403).json({
      error: 'Bonus stars can be added only by certificates or confirmed order payments.'
    });
  }
  
  // First get current stars
  db.get('SELECT bonusStars, certificateBonusStars FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Користувач не знайдений' });
    }
    
    const currentStars = user.bonusStars || 0;
    const certificateStars = Math.max(0, user.certificateBonusStars || 0);
    if (currentStars < starsToSpend) {
      return res.status(400).json({ error: 'Недостатньо бонусних зірок' });
    }
    const certificateToUse = Math.min(certificateStars, starsToSpend);
    const regularToUse = starsToSpend - certificateToUse;
    if (regularToUse > 60) {
      return res.status(400).json({ error: 'За одне замовлення можна використати до 60 звичайних бонусних зірок. Зірки з промокоду без ліміту.' });
    }
    const newStars = currentStars - starsToSpend;
    const newCertificateStars = certificateStars - certificateToUse;

    db.run('UPDATE users SET bonusStars = ?, certificateBonusStars = ? WHERE id = ?', [newStars, newCertificateStars, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Помилка сервера' });
      }
      
      res.json({ 
        bonusStars: newStars,
        certificateBonusStars: newCertificateStars,
        regularBonusStars: Math.max(0, newStars - newCertificateStars),
        certificateStarsUsed: certificateToUse,
        regularStarsUsed: regularToUse,
        message: `Використано ${starsToSpend} зірок`
      });
    });
  });
});

// Add stars for purchase (called after successful order)
app.post('/api/user/stars/purchase', authenticateToken, (req, res) => {
  return res.status(410).json({
    error: 'Direct purchase star awarding is disabled. Confirm the order payment from the admin panel.'
  });
});

// Get user profile (protected route)
app.get('/api/profile', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, firstName, lastName, phone, address, bonusStars, certificateBonusStars FROM users WHERE id = ?', 
    [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.certificateBonusStars = user.certificateBonusStars || 0;
    user.regularBonusStars = Math.max(0, (user.bonusStars || 0) - user.certificateBonusStars);
    user.isAdmin = isSiteAdmin(user);
    res.json({ user });
  });
});

// Update user profile (protected route)
app.put('/api/profile', authenticateToken, [
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('phone').optional(),
  body('address').optional()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { firstName, lastName, email, phone, address } = req.body;
  const updates = [];
  const values = [];

  if (firstName) { updates.push('firstName = ?'); values.push(firstName); }
  if (lastName) { updates.push('lastName = ?'); values.push(lastName); }
  if (email) { updates.push('email = ?'); values.push(email); }
  if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
  if (address !== undefined) { updates.push('address = ?'); values.push(address); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.user.id);

  db.run(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating profile' });
      }

      res.json({ message: 'Profile updated successfully' });
    }
  );
});

// Update bonus stars (protected route)
app.post('/api/bonus/add', authenticateToken, [
  body('stars').isInt({ min: 1 }).withMessage('Stars must be a positive integer')
], (req, res) => {
  return res.status(410).json({
    error: 'Direct bonus star adding is disabled. Use certificates or confirmed order payments.'
  });
});

// Use bonus stars (protected route)
app.post('/api/bonus/use', authenticateToken, [
  body('stars').isInt({ min: 1 }).withMessage('Stars must be a positive integer')
], (req, res) => {
  const stars = Math.max(0, parseInt(req.body && req.body.stars, 10) || 0);

  // First check if user has enough stars
  db.get('SELECT bonusStars, certificateBonusStars FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (user.bonusStars < stars) {
      return res.status(400).json({ error: 'Insufficient bonus stars' });
    }

    const certificateStars = Math.max(0, user.certificateBonusStars || 0);
    const certificateToUse = Math.min(certificateStars, stars);
    const regularToUse = stars - certificateToUse;
    if (regularToUse > 60) {
      return res.status(400).json({ error: 'За одне замовлення можна використати до 60 звичайних бонусних зірок. Зірки з промокоду без ліміту.' });
    }

    db.run(
      'UPDATE users SET bonusStars = bonusStars - ?, certificateBonusStars = certificateBonusStars - ? WHERE id = ?',
      [stars, certificateToUse, req.user.id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error using bonus stars' });
        }

        res.json({ 
          message: 'Bonus stars used successfully',
          bonusStars: user.bonusStars - stars,
          certificateBonusStars: certificateStars - certificateToUse,
          regularBonusStars: Math.max(0, (user.bonusStars - stars) - (certificateStars - certificateToUse)),
          certificateStarsUsed: certificateToUse,
          regularStarsUsed: regularToUse
        });
      }
    );
  });
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});

