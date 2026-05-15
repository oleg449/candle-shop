const API_ROOT = (() => {
  if (window.API_BASE_URL) return String(window.API_BASE_URL).replace(/\/$/, '');
  if (window.location.hostname === 'localhost' && window.location.port && window.location.port !== '3000') {
    return 'http://localhost:3000/api';
  }
  return '/api';
})();
const API = `${API_ROOT}/admin`;

const sections = {
  info: { title: 'Інформація' },
  products: { title: 'Товари', resource: 'products', listTitle: 'Товари' },
  masterclasses: { title: 'Майстер-класи', resource: 'masterclasses', listTitle: 'Майстер-класи' },
  admins: { title: 'Адміністратори', resource: 'admins', listTitle: 'Адміністратори' },
  orders: { title: 'Замовлення' },
  users: { title: 'Користувачі' },
  reviews: { title: 'Управління відгуками' },
  certificates: { title: 'Сертифікати' }
};

const fieldSets = {
  products: [
    { key: 'title', label: 'Назва' },
    { key: 'category', label: 'Категорія' },
    {
      key: 'availability',
      label: 'Статус товару',
      type: 'select',
      defaultValue: 'in_stock',
      options: [
        { value: 'in_stock', label: 'Є в наявності' },
        { value: 'preorder', label: 'Під замовлення' }
      ]
    },
    { key: 'price', label: 'Ціна', type: 'number' },
    { key: 'discount', label: 'Знижка %', type: 'number' },
    { key: 'description', label: 'Опис', type: 'textarea', full: true },
    { key: 'specs', label: 'Характеристики, кожна з нового рядка', type: 'lines', full: true }
  ],
  masterclasses: [
    { key: 'title', label: 'Назва' },
    { key: 'price', label: 'Ціна', type: 'number' },
    { key: 'duration', label: 'Тривалість' },
    {
      key: 'level',
      label: 'Рівень',
      type: 'select',
      defaultValue: 'Початковий',
      options: [
        { value: 'Початковий', label: 'Початковий' },
        { value: 'Середній', label: 'Середній' },
        { value: 'Просунутий', label: 'Просунутий' }
      ]
    },
    { key: 'video_url', label: 'Відео URL' },
    { key: 'description', label: 'Опис', type: 'textarea', full: true }
  ],
  admins: [
    { key: 'id', label: 'ID запису' },
    { key: 'site_user_id', label: 'ID акаунта сайту', type: 'number' },
    { key: 'name', label: 'Ім’я' },
    { key: 'email', label: 'Email акаунта' }
  ]
};

const ADMIN_PERMISSION_GROUPS = [
  {
    title: 'Контент',
    items: [
      { id: 'products', label: 'Редагування товарів' },
      { id: 'masterclasses', label: 'Майстер-класи' }
    ]
  },
  {
    title: 'Клієнти',
    items: [
      { id: 'users', label: 'Керування користувачами' },
      { id: 'reviews', label: 'Відгуки' }
    ]
  },
  {
    title: 'Фінанси',
    items: [
      { id: 'orders', label: 'Перегляд замовлень' },
      { id: 'revenue', label: 'Статистика виручки' }
    ]
  },
  {
    title: 'Система',
    items: [
      { id: 'admins', label: 'Управління іншими адмінами' }
    ]
  }
];

const ADMIN_ROLE_LABELS = {
  super_admin: 'Супер-адмін',
  moderator: 'Модератор',
  order_manager: 'Менеджер замовлень'
};

const ADMIN_ROLE_DEFAULTS = {
  super_admin: ADMIN_PERMISSION_GROUPS.flatMap(group => group.items.map(item => item.id)),
  moderator: ['products', 'masterclasses', 'reviews'],
  order_manager: ['orders']
};

const SECTION_PERMISSIONS = {
  info: null,
  products: 'products',
  masterclasses: 'masterclasses',
  certificates: 'revenue',
  orders: 'orders',
  users: 'users',
  reviews: 'reviews',
  admins: 'admins'
};

const ADMIN_TAB_EMOJI = {
  info: '📊',
  products: '🕯️',
  masterclasses: '🎨',
  orders: '📦',
  certificates: '🎫',
  reviews: '💬',
  users: '👥',
  admins: '🔐'
};

let currentSection = 'info';
let currentResource = null;
let currentItems = [];
let currentItem = null;
let currentItemId = null;
let ordersData = {};
let orderHistoryData = {};
let ordersViewMode = 'active';
let orderStatusFilter = '';
let orderKindFilter = '';
let currentOrderId = null;
let usersData = [];
let currentUserId = null;
let currentAdminProfile = null;
let reviewsData = {};
let reviewProducts = [];
let reviewMasterclasses = [];
let reviewFilter = 'all';
let reviewProductFilter = '';
let selectedReviewRef = null;
let reviewEditorRating = 5;
let replaceImageIndex = null;
let adminGateVisible = false;
let overviewActivity = [];
let overviewActivityFilter = 'all';
let overviewActivityQuery = '';
let overviewActivityVisible = 10;
let overviewAnalytics = {};
const ADMIN_SEEN_ACTIVITY_KEY = 'adminSeenActivityKeys';
const ADMIN_HIDDEN_ACTIVITY_KEY = 'adminHiddenActivityKeys';
let newOverviewActivityKeys = new Set();
let imageLightboxIndex = 0;
let certificateRows = [];
let certificateSearchQuery = '';

const $ = (id) => document.getElementById(id);

function setStatus(message, isError = false) {
  const el = $('adminStatus');
  el.textContent = normalizeUiMessage(message);
  el.style.color = isError ? '#b64b4b' : '#786d62';
}

function normalizeUiMessage(message) {
  return typeof window.fixSiteMojibake === 'function'
    ? window.fixSiteMojibake(message)
    : String(message || '');
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  if (response.status === 401) {
    window.location.href = 'auth.html';
    throw new Error('Not authenticated');
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (response.status === 403) {
    showAdminGate((data && data.error) || 'Потрібен промокод адміністратора');
    throw new Error('Admin access required');
  }
  if (!response.ok) {
    throw new Error((data && data.error) || 'Request failed');
  }
  return data;
}

function showAdminGate(message = '') {
  adminGateVisible = true;
  document.body.classList.add('admin-locked');
  if ($('adminGate')) $('adminGate').hidden = false;
  if ($('adminGateMessage')) {
    $('adminGateMessage').textContent = message === 'Admin access required'
      ? 'Введіть промокод адміністратора'
      : normalizeUiMessage(message);
    $('adminGateMessage').style.color = '#8B7667';
  }
  setTimeout(() => $('adminGateCode')?.focus(), 50);
}

function hideAdminGate() {
  adminGateVisible = false;
  document.body.classList.remove('admin-locked');
  if ($('adminGate')) $('adminGate').hidden = true;
}

async function activateAdminGate(event) {
  event.preventDefault();
  const input = $('adminGateCode');
  const message = $('adminGateMessage');
  const code = String(input?.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) {
    if (message) {
      message.textContent = 'Введіть промокод';
      message.style.color = '#b64b4b';
    }
    return;
  }

  try {
    if (message) {
      message.textContent = 'Перевіряємо промокод...';
      message.style.color = '#8B7667';
    }
    const response = await fetch(`${API_ROOT}/certificates/redeem`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await response.json();
    if (!response.ok || !data.success || !data.adminGranted) {
      throw new Error((data && (data.error || data.message)) || 'Промокод не підходить');
    }
    if (message) {
      message.textContent = 'Доступ активовано';
      message.style.color = '#4c8f52';
    }
    hideAdminGate();
    await showSection(currentSection || 'info');
  } catch (error) {
    if (message) {
      message.textContent = normalizeUiMessage(error.message || 'Не вдалося активувати доступ');
      message.style.color = '#b64b4b';
    }
  }
}

function showSection(name) {
  if (currentAdminProfile && !currentAdminHasPermission(SECTION_PERMISSIONS[name])) {
    const fallback = firstAllowedSection();
    if (fallback !== name) return showSection(fallback);
  }
  currentSection = name;
  const meta = sections[name];
  $('sectionTitle').textContent = meta.title;
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === name);
  });
  const mobileSectionSelect = $('mobileAdminSection');
  if (mobileSectionSelect && mobileSectionSelect.value !== name) {
    mobileSectionSelect.value = name;
  }
  document.querySelectorAll('.admin-section').forEach(section => section.classList.remove('active'));

  if (name === 'info') $('infoSection').classList.add('active');
  else if (name === 'orders') $('ordersSection').classList.add('active');
  else if (name === 'users') $('usersSection').classList.add('active');
  else if (name === 'reviews') $('reviewsSection').classList.add('active');
  else if (name === 'certificates') $('certificatesSection').classList.add('active');
  else $('entitySection').classList.add('active');

  return loadCurrentSection();
}

async function loadCurrentSection() {
  if (adminGateVisible) return;
  try {
    setStatus('Завантаження...');
    if (!currentAdminProfile) {
      currentAdminProfile = await apiFetch(`${API}/me`);
      applyAdminAccessUI();
      updateSharedStoreHeaderAuth();
      if (!currentAdminHasPermission(SECTION_PERMISSIONS[currentSection])) {
        currentSection = firstAllowedSection();
      }
    }
    if (currentSection === 'info') await loadOverview();
    else if (currentSection === 'orders') await loadOrders();
    else if (currentSection === 'users') await loadUsers();
    else if (currentSection === 'reviews') await loadReviewsAdmin();
    else if (currentSection === 'certificates') await loadCertificates();
    else await loadEntity(sections[currentSection].resource);
    setStatus('Готово');
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  }
}

function currentAdminHasPermission(permission) {
  if (!permission) return true;
  return currentAdminProfile && (
    currentAdminProfile.role === 'super_admin' ||
    (Array.isArray(currentAdminProfile.permissions) && currentAdminProfile.permissions.includes(permission))
  );
}

function firstAllowedSection() {
  return Object.keys(sections).find(section => currentAdminHasPermission(SECTION_PERMISSIONS[section])) || 'info';
}

function applyAdminAccessUI() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    const section = tab.dataset.section;
    const allowed = currentAdminHasPermission(SECTION_PERMISSIONS[section]);
    tab.hidden = !allowed;
    tab.disabled = !allowed;
  });
  const mobileSectionSelect = $('mobileAdminSection');
  if (mobileSectionSelect) {
    Array.from(mobileSectionSelect.options).forEach(option => {
      const allowed = currentAdminHasPermission(SECTION_PERMISSIONS[option.value]);
      option.hidden = !allowed;
      option.disabled = !allowed;
    });
  }
}

function decorateAdminTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    if (tab.querySelector('.admin-tab-emoji')) return;
    const section = tab.dataset.section;
    const emoji = ADMIN_TAB_EMOJI[section];
    if (!emoji) return;
    const label = tab.textContent.trim();
    tab.innerHTML = `
      <span class="admin-tab-emoji" aria-hidden="true">${emoji}</span>
      <span class="admin-tab-label">${escapeHtml(label)}</span>
    `;
  });
}

async function initSharedStoreHeader() {
  if (document.getElementById('adminStoreHeaderHost')) return;

  document.body.classList.add('has-store-header');
  const host = document.createElement('div');
  host.id = 'adminStoreHeaderHost';
  document.body.prepend(host);

  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <link rel="stylesheet" href="style.css">
    <style>
      :host {
        --accent: #f28c3d;
        --accent-dark: #cc6c20;
        --coffee: #6a4b3c;
        --sand: #f6ede3;
        --text: #2e1e17;
        --muted: #9c8a7f;
        --card-shadow: 0 18px 45px rgba(42,24,18,0.08);
        --radius-xl: 32px;
        font-family: 'Open Sans', Arial, sans-serif;
      }

      .admin-store-backdrop {
        position: fixed;
        inset: 0;
        z-index: 998;
        background: rgba(0, 0, 0, 0.4);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.3s ease, visibility 0s linear 0.3s;
      }

      .admin-store-backdrop.open {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transition: opacity 0.3s ease, visibility 0s linear 0s;
      }

      @media (max-width: 768px) {
        #cartIcon {
          display: none !important;
        }
      }
    </style>
    <div class="admin-store-backdrop" aria-hidden="true"></div>
  `;

  try {
    const response = await fetch(`index.html?t=${Date.now()}`, { cache: 'no-store' });
    const html = await response.text();
    const source = new DOMParser().parseFromString(html, 'text/html');
    const nodes = [
      source.getElementById('categoryPanel'),
      source.querySelector('.floating-header'),
      source.getElementById('mobileSearch'),
      source.getElementById('searchBackdrop'),
      source.getElementById('cartIcon')
    ].filter(Boolean);

    nodes.forEach(node => {
      const clone = node.cloneNode(true);
      if (clone.id === 'cartIcon') clone.removeAttribute('onclick');
      root.appendChild(clone);
    });
  } catch (error) {
    console.error('Failed to load shared store header', error);
    host.remove();
    document.body.classList.remove('has-store-header');
    return;
  }

  const panel = root.getElementById('categoryPanel');
  const backdrop = root.querySelector('.admin-store-backdrop');
  const openButtons = [root.getElementById('openMenu'), root.getElementById('openMenuMobile')].filter(Boolean);
  const closeButton = root.getElementById('closeCategories');
  const header = root.querySelector('.floating-header');
  const searchInput = root.getElementById('searchInput');
  const searchButton = root.getElementById('headerSearchBtn');
  const cartIcon = root.getElementById('cartIcon');

  const openPanel = (event) => {
    event?.preventDefault();
    panel?.classList.add('open');
    panel?.setAttribute('aria-hidden', 'false');
    backdrop?.classList.add('open');
  };
  const closePanel = () => {
    panel?.classList.remove('open');
    panel?.setAttribute('aria-hidden', 'true');
    backdrop?.classList.remove('open');
  };

  openButtons.forEach(button => button.addEventListener('click', openPanel));
  closeButton?.addEventListener('click', closePanel);
  backdrop?.addEventListener('click', closePanel);
  document.addEventListener('click', (event) => {
    if (!panel?.classList.contains('open')) return;
    const path = event.composedPath ? event.composedPath() : [];
    const clickedMenu = openButtons.some(button => path.includes(button));
    if (!clickedMenu && !path.includes(panel)) closePanel();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });

  let lastY = window.scrollY || 0;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking || !header) return;
    ticking = true;
    requestAnimationFrame(() => {
      const currentY = window.scrollY || 0;
      const delta = currentY - lastY;
      if (currentY > 120 && delta > 8) header.classList.add('header-hidden');
      if (delta < -8 || currentY < 80) header.classList.remove('header-hidden');
      lastY = currentY;
      ticking = false;
    });
  }, { passive: true });

  const runSearch = () => {
    const query = (searchInput?.value || '').trim();
    const suffix = query ? `?search=${encodeURIComponent(query)}` : '';
    window.location.href = `index.html${suffix}`;
  };
  searchButton?.addEventListener('click', runSearch);
  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch();
  });

  const openCartFromAdmin = () => {
    window.location.href = 'index.html';
  };
  cartIcon?.addEventListener('click', openCartFromAdmin);
  cartIcon?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCartFromAdmin();
    }
  });

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || 'null') || {};
    const stars = Number(userData.stars || userData.bonusStars || localStorage.getItem('bonusStars') || 0) || 0;
    const name = userData.name || userData.first_name || currentAdminProfile?.name || 'Адміністратор';
    ['bonusStars', 'bonusStarsMobile', 'userStarsSide'].forEach(id => {
      const element = root.getElementById(id);
      if (element) element.textContent = String(stars);
    });
    const nameElement = root.getElementById('userNameSide');
    if (nameElement) nameElement.textContent = name;
  } catch (_) {}

  fetch(`products.json?t=${Date.now()}`, { cache: 'no-store' })
    .then(response => response.ok ? response.json() : [])
    .then(products => {
      const categories = uniqueProductCategories(products);
      const list = panel?.querySelector('ul');
      if (!list) return;
      list.innerHTML = [
        '<li><a href="index.html">Усі товари</a></li>',
        ...categories.map(category => `<li><a href="index.html?category=${encodeURIComponent(category)}">${escapeHtml(category)}</a></li>`)
      ].join('');
    })
    .catch(() => {});

  root.querySelectorAll('a[href^="#"]').forEach(link => {
    link.setAttribute('href', `index.html${link.getAttribute('href')}`);
  });

  updateSharedStoreHeaderAuth();
}

function updateSharedStoreHeaderAuth() {
  const root = document.getElementById('adminStoreHeaderHost')?.shadowRoot;
  if (!root) return;

  let userData = {};
  try {
    userData = JSON.parse(localStorage.getItem('userData') || 'null') || {};
  } catch (_) {}

  const isAdminSession = !!currentAdminProfile || !!userData.id || !!userData.email || !!userData.username;
  const guestSection = root.getElementById('guestSideSection');
  const userSection = root.getElementById('userSideSection');
  if (guestSection) guestSection.style.display = isAdminSession ? 'none' : '';
  if (userSection) userSection.style.display = isAdminSession ? '' : 'none';

  const stars = Number(userData.stars || userData.bonusStars || localStorage.getItem('bonusStars') || 0) || 0;
  const name = userData.name || userData.first_name || userData.firstName || userData.username || 'Адміністратор';
  ['bonusStars', 'bonusStarsMobile', 'userStarsSide'].forEach(id => {
    const element = root.getElementById(id);
    if (element) element.textContent = String(stars);
  });
  const nameElement = root.getElementById('userNameSide');
  if (nameElement) nameElement.textContent = name;
}

function decorateSidebarHeader() {
  const sidebar = document.querySelector('.admin-sidebar');
  const backLink = sidebar?.querySelector('.back-link');
  const title = sidebar?.querySelector('h1');
  if (!sidebar || !backLink || !title || sidebar.querySelector('.admin-sidebar-head')) return;
  const header = document.createElement('div');
  header.className = 'admin-sidebar-head';
  backLink.textContent = '';
  backLink.innerHTML = `
    <span class="back-link-icon" aria-hidden="true">⌂</span>
    <span>У магазин</span>
  `;
  title.innerHTML = `
    <span class="admin-brand-logo" aria-label="Art Light">
      <svg class="admin-brand-candle" viewBox="0 0 48 48" role="img" aria-hidden="true">
        <path d="M24 6c4 4.2 5.8 7.2 5.8 10.2A5.8 5.8 0 0 1 18.2 16.2C18.2 13.2 20 10.2 24 6Z"/>
        <path d="M18 24h12c2.2 0 4 1.8 4 4v8c0 3.3-2.7 6-6 6h-8c-3.3 0-6-2.7-6-6v-8c0-2.2 1.8-4 4-4Z"/>
        <path d="M18 30h12"/>
      </svg>
      <span>Art Light</span>
    </span>
  `;
  sidebar.insertBefore(header, sidebar.firstChild);
  header.appendChild(title);
  header.appendChild(backLink);
}

async function loadOverview() {
  const data = await apiFetch(`${API}/overview`);
  const labels = {
    products: 'Товари',
    masterclasses: 'Майстер-класи',
    orders: 'Замовлення',
    users: 'Користувачі',
    onlineVisitors: 'Онлайн зараз',
    visitors: 'Відвідувачі',
    reviews: 'Відгуки',
    admins: 'Адміни',
    certificates: 'Сертифікати'
  };
  const statTargets = {
    products: 'products',
    masterclasses: 'masterclasses',
    orders: 'orders',
    users: 'users',
    onlineVisitors: 'info',
    visitors: 'info',
    reviews: 'reviews',
    admins: 'admins',
    certificates: 'certificates'
  };
  const statIcons = {
    products: 'package',
    masterclasses: 'graduation',
    orders: 'clipboard',
    users: 'shield',
    onlineVisitors: 'online',
    visitors: 'users',
    reviews: 'star',
    admins: 'shield',
    certificates: 'gift'
  };
  $('statsGrid').innerHTML = Object.entries(data.counts || {}).filter(([key]) => key !== 'sets').map(([key, value]) => `
      <button class="stat-card stat-link" type="button" data-target-section="${escapeHtml(statTargets[key] || 'info')}">
        <div class="stats-info">
          <span>${escapeHtml(labels[key] || key)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
        <span class="stat-icon" aria-hidden="true">${adminStatIcon(statIcons[key] || 'circle')}</span>
      </button>
    `).join('') + renderRevenueCard(data.revenue, data.analytics);
  overviewActivity = Array.isArray(data.recentActivity) ? data.recentActivity : [];
  const seenActivity = getSeenActivityKeys();
  newOverviewActivityKeys = new Set(
    overviewActivity
      .map(activityStorageKey)
      .filter(key => key && !seenActivity.has(key))
  );
  overviewActivity.forEach(event => {
    const key = activityStorageKey(event);
    if (key) seenActivity.add(key);
  });
  storeSeenActivityKeys(seenActivity);
  overviewAnalytics = data.analytics || {};
  overviewActivityVisible = 10;
  renderActivityPanel();
  document.querySelectorAll('[data-target-section]').forEach(button => {
    button.addEventListener('click', () => showSection(button.dataset.targetSection));
  });
}

function formatMoney(value) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function adminStatIcon(name) {
  const icons = {
    package: '<svg viewBox="0 0 24 24"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
    graduation: '<svg viewBox="0 0 24 24"><path d="m22 10-10-5-10 5 10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24"><path d="M9 4h6l1 2h3v15H5V6h3l1-2Z"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-5"/></svg>',
    online: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/><path d="M4 4l3 3"/><path d="M20 4l-3 3"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    gift: '<svg viewBox="0 0 24 24"><path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 7v14"/><path d="M12 7H8.5A2.5 2.5 0 1 1 12 4.5V7Z"/><path d="M12 7h3.5A2.5 2.5 0 1 0 12 4.5V7Z"/></svg>',
    revenue: '<svg viewBox="0 0 24 24"><path d="M3 17 9 11l4 4 8-9"/><path d="M14 6h7v7"/></svg>',
    circle: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>'
  };
  return icons[name] || icons.circle;
}

function revenueTrendFromAnalytics(revenue, analytics) {
  const monthly = Array.isArray(analytics && analytics.monthlySales) ? analytics.monthlySales : [];
  const currentRevenue = Number(revenue && revenue.monthlyRevenue || 0);
  const currentIndex = monthly.length - 1;
  const current = currentIndex >= 0 ? Number(monthly[currentIndex].revenue || currentRevenue) : currentRevenue;
  const previous = currentIndex > 0 ? Number(monthly[currentIndex - 1].revenue || 0) : 0;
  if (!previous && !current) return '+0% по сравнению с прошлым месяцем';
  if (!previous) return '+100% по сравнению с прошлым месяцем';
  const percent = Math.round(((current - previous) / previous) * 100);
  return `${percent >= 0 ? '+' : ''}${percent}% по сравнению с прошлым месяцем`;
}

function renderRevenueCard(revenue, analytics) {
  const data = revenue || {};
  const trend = revenueTrendFromAnalytics(data, analytics);
  return `
    <div class="stat-card revenue-card">
      <div class="stats-info">
        <span>Виручка за місяць</span>
        <strong>${escapeHtml(formatMoney(data.monthlyRevenue || 0))}</strong>
        <em>${escapeHtml(trend)}</em>
        <small>${escapeHtml(data.monthLabel || '')}${data.monthlyOrderCount ? ` · ${escapeHtml(data.monthlyOrderCount)} замовл.` : ''}</small>
      </div>
      <span class="stat-icon" aria-hidden="true">${adminStatIcon('revenue')}</span>
    </div>
  `;
}

function statusActionText(status) {
  const normalized = repairText(status || '').toLowerCase();
  if (normalized.includes('відправ') || normalized.includes('отправ') || normalized.includes('shipped')) return 'вже відправляється';
  if (normalized.includes('викон') || normalized.includes('completed')) return 'вже виконано';
  if (normalized.includes('скас') || normalized.includes('cancel')) return 'скасовано';
  if (normalized.includes('виготов') || normalized.includes('process')) return 'вже виготовляється';
  if (normalized.includes('оплач') || normalized.includes('paid')) return 'оплачено';
  return `отримало статус "${repairText(status || 'нове')}"`;
}

function paymentStateFromStatus(status) {
  const normalized = repairText(status || '').toLowerCase();
  if (normalized.includes('скас') || normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('оплач') || normalized.includes('paid') || normalized.includes('shipped') || normalized.includes('відправ') || normalized.includes('викон') || normalized.includes('completed')) return 'paid';
  return 'pending';
}

function paymentActivityText(event, itemTitle, orderId) {
  const state = paymentStateFromStatus(event.status);
  if (state === 'paid') return `Оплату підтверджено: ${itemTitle} у замовленні #${orderId}`;
  if (state === 'cancelled') return `Оплату скасовано: ${itemTitle} у замовленні #${orderId}`;
  return `${itemTitle} у замовленні #${orderId} ${statusActionText(event.status)}`;
}

function isPaymentStatus(status) {
  return paymentStateFromStatus(status) !== 'pending';
}

function activityFilterOptions() {
  return [
    { id: 'all', label: 'Усі' },
    { id: 'orders', label: 'Замовлення' },
    { id: 'payment', label: 'Оплата' },
    { id: 'admins', label: 'Адміни' }
  ];
}

function activityFilterMatches(event, filter) {
  if (filter === 'orders') return event.type === 'order_created' || event.type === 'order_status';
  if (filter === 'payment') return event.type === 'order_status' && isPaymentStatus(event.status);
  if (filter === 'admins') return event.type === 'admin_added';
  return true;
}

function activitySearchText(event) {
  const values = [
    event.type,
    event.orderId,
    event.itemTitle,
    event.customer,
    event.status,
    event.adminName,
    event.adminId,
    statusActionText(event.status || '')
  ];
  return values.map(value => repairText(value || '').toLowerCase()).join(' ');
}

function filteredOverviewActivity() {
  const query = repairText(overviewActivityQuery || '').trim().toLowerCase();
  const hiddenActivity = getHiddenActivityKeys();
  return overviewActivity.filter(event => {
    const key = activityStorageKey(event);
    if (key && hiddenActivity.has(key)) return false;
    if (!activityFilterMatches(event, overviewActivityFilter)) return false;
    if (!query) return true;
    return activitySearchText(event).includes(query);
  });
}

function formatActivityTime(ts) {
  const value = Number(ts || 0);
  if (!value) return 'Не вказано';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return 'Не вказано';
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  if (!sameDay) return formatOrderDate(ts);
  const diff = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diff < 60) return 'щойно';
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes} хв тому`;
  const hours = Math.floor(minutes / 60);
  return `${hours} год тому`;
}

function renderCustomerLink(customer) {
  const name = repairText(customer || '').trim();
  if (!name) return '';
  return `<a href="#" class="activity-customer-link" data-activity-customer="${escapeHtml(name)}">${escapeHtml(name)}</a>`;
}

function renderActivityPanel() {
  const filtered = filteredOverviewActivity();
  const visible = filtered.slice(0, overviewActivityVisible);
  const emptyText = overviewActivity.length
    ? 'За вашим запитом подій немає'
    : 'Останніх подій поки немає';
  const hasMore = filtered.length > overviewActivityVisible;
  const filters = activityFilterOptions().map(filter => `
    <button class="activity-filter ${overviewActivityFilter === filter.id ? 'active' : ''}" type="button" data-activity-filter="${escapeHtml(filter.id)}">
      ${escapeHtml(filter.label)}
    </button>
  `).join('');

  $('infoDetails').innerHTML = `
    <div class="activity-toolbar">
      <label class="activity-search">
        <span>Пошук подій</span>
        <input id="activitySearch" type="search" placeholder="Клієнт, замовлення, статус..." value="${escapeHtml(overviewActivityQuery)}">
      </label>
      <div class="activity-filters" aria-label="Фільтр подій">
        ${filters}
      </div>
      <button id="activityClear" class="activity-clear" type="button" ${overviewActivity.length ? '' : 'disabled'}>
        Очистити
      </button>
    </div>
    <div class="activity-count">
      Показано ${escapeHtml(Math.min(visible.length, filtered.length))} з ${escapeHtml(filtered.length)}
    </div>
    <div class="activity-feed">
      ${visible.map(renderActivityEvent).join('') || `<div class="muted">${escapeHtml(emptyText)}</div>`}
    </div>
    ${hasMore ? `
      <button id="activityShowMore" class="activity-more" type="button" aria-label="Показати ще події">
        <span>Показати ще</span>
        <strong>↓</strong>
      </button>
    ` : ''}
    ${renderOverviewAnalytics(overviewAnalytics)}
  `;
  bindActivityPanelEvents();
}

function percentOf(value, max) {
  const number = Number(value || 0);
  if (number <= 0) return 0;
  if (!max) return 0;
  return Math.max(4, Math.min(100, Math.round((number / max) * 100)));
}

function renderAnalyticsEmpty() {
  return `
    <div class="analytics-empty analytics-empty-soft">
      <span aria-hidden="true">${adminStatIcon('clipboard')}</span>
      <p>Здесь появится статистика после первых заказов</p>
    </div>
  `;
}

function renderMiniBars(items, options) {
  const rows = Array.isArray(items) ? items : [];
  const valueKey = options.valueKey;
  const max = Math.max(...rows.map(item => Number(item[valueKey] || 0)), 0);
  if (!rows.length) return renderAnalyticsEmpty();
  return rows.map((item, index) => `
    <div class="analytics-row">
      <div class="analytics-row-head">
        <strong>${escapeHtml(repairText(item[options.labelKey] || options.fallback || 'Позиція'))}</strong>
        <span>${escapeHtml(options.valueLabel(item))}</span>
      </div>
      <div class="analytics-bar" aria-hidden="true">
        <i class="${Number(item[valueKey] || 0) <= 0 ? 'is-zero' : ''}" style="width:${percentOf(item[valueKey], max)}%"></i>
      </div>
      ${options.subLabel ? `<small>${escapeHtml(options.subLabel(item, index))}</small>` : ''}
    </div>
  `).join('');
}

function renderMonthlyChart(monthlySales) {
  const rows = Array.isArray(monthlySales) ? monthlySales : [];
  const max = Math.max(...rows.map(item => Number(item.revenue || 0)), 0);
  if (!rows.length) return '<div class="analytics-empty">Немає даних за місяцями</div>';
  return `
    <div class="monthly-chart">
      ${rows.map(item => `
        <div class="month-column">
          <div class="month-bar" data-tooltip="${escapeHtml(formatMoney(item.revenue || 0))}">
            <i class="${Number(item.revenue || 0) <= 0 ? 'is-zero' : ''}" style="height:${percentOf(item.revenue, max)}%"></i>
          </div>
          <strong>${escapeHtml(repairText(item.label || ''))}</strong>
          <span>${escapeHtml(item.orders || 0)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderStatusDonut(statusBreakdown) {
  const rows = Array.isArray(statusBreakdown) ? statusBreakdown : [];
  const total = rows.reduce((sum, item) => sum + Number(item.count || 0), 0);
  if (!rows.length || !total) return '<div class="analytics-empty">Статуси ще не накопичились</div>';
  const primary = rows[0];
  return `
    <div class="status-donut">
      <div class="donut-ring" style="--paid-angle:${Math.round((Number(primary.count || 0) / total) * 100)}%">
        <strong>${escapeHtml(total)}</strong>
        <span>усі</span>
      </div>
      <div class="donut-legend">
        ${rows.map(item => `
          <div>
            <i></i>
            <span>${escapeHtml(repairText(item.status || 'нове'))}</span>
            <strong>${escapeHtml(item.count || 0)}</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderOverviewAnalytics(analytics) {
  if (!currentAdminHasPermission('revenue')) return '';
  const data = analytics || {};
  const topProducts = Array.isArray(data.topProducts) ? data.topProducts : [];
  const topCustomers = Array.isArray(data.topCustomers) ? data.topCustomers : [];
  const totals = data.totals || {};
  return `
    <div class="analytics-section">
      <div class="analytics-head">
        <div>
          <span>Аналітика продажів</span>
          <h4>Що купують найчастіше</h4>
        </div>
        <div class="analytics-pills">
          <strong>${escapeHtml(totals.productsSold || 0)} продано</strong>
          <strong>${escapeHtml(totals.activeCustomers || 0)} покупців</strong>
          <strong>${escapeHtml(formatMoney(totals.averageOrder || 0))} середній чек</strong>
        </div>
      </div>
      <div class="analytics-grid">
        <article class="analytics-card analytics-card-wide">
          <h5>Популярні товари</h5>
          ${renderMiniBars(topProducts, {
            labelKey: 'title',
            valueKey: 'quantity',
            fallback: 'Товар',
            valueLabel: item => `${item.quantity || 0} шт.`,
            subLabel: item => `${formatMoney(item.revenue || 0)} виручки`
          })}
        </article>
        <article class="analytics-card">
          <h5>Найчастіші покупці</h5>
          ${renderMiniBars(topCustomers, {
            labelKey: 'name',
            valueKey: 'orders',
            fallback: 'Клієнт',
            valueLabel: item => `${item.orders || 0} замовл.`,
            subLabel: item => `${formatMoney(item.total || 0)} загалом`
          })}
        </article>
        <article class="analytics-card">
          <h5>Продажі за 6 місяців</h5>
          ${renderMonthlyChart(data.monthlySales)}
        </article>
        <article class="analytics-card">
          <h5>Статуси замовлень</h5>
          ${renderStatusDonut(data.statusBreakdown)}
        </article>
      </div>
    </div>
  `;
}

function bindActivityPanelEvents() {
  const search = $('activitySearch');
  search?.addEventListener('input', (event) => {
    overviewActivityQuery = event.target.value;
    overviewActivityVisible = 10;
    renderActivityPanel();
    const nextSearch = $('activitySearch');
    if (nextSearch) {
      nextSearch.focus();
      nextSearch.setSelectionRange(nextSearch.value.length, nextSearch.value.length);
    }
  });
  document.querySelectorAll('[data-activity-filter]').forEach(button => {
    button.addEventListener('click', () => {
      overviewActivityFilter = button.dataset.activityFilter || 'all';
      overviewActivityVisible = 10;
      renderActivityPanel();
    });
  });
  $('activityShowMore')?.addEventListener('click', () => {
    overviewActivityVisible += 10;
    renderActivityPanel();
  });
  $('activityClear')?.addEventListener('click', clearOverviewActivity);
  document.querySelectorAll('[data-open-order]').forEach(item => {
    item.addEventListener('click', (event) => {
      if (event.target.closest('[data-activity-customer]')) return;
      openOrderFromActivity(item.dataset.openOrder);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openOrderFromActivity(item.dataset.openOrder);
      }
    });
  });
  document.querySelectorAll('[data-activity-customer]').forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openCustomerFromActivity(link.dataset.activityCustomer || '');
    });
  });
}

function renderActivityEvent(event) {
  const orderId = event.orderId || '';
  const itemTitle = repairText(event.itemTitle || 'Товар').replace(/\s+—\s+.*$/, '');
  const customer = repairText(event.customer || '');
  const admin = repairText(event.adminName || 'Адміністратор');
  const date = formatActivityTime(event.ts);
  const customerLink = renderCustomerLink(customer);
  const newClass = isNewActivity(event) ? ' activity-new' : '';
  const newBadge = isNewActivity(event) ? '<span class="activity-new-badge">Нове</span>' : '';

  if (event.type === 'admin_added') {
    return `
      <div class="activity-item${newClass}">
        <div class="activity-icon">A</div>
        <div>
          <strong>Додано адміністратора${newBadge}</strong>
          <p>${escapeHtml(admin)}${event.adminId ? ` · ID ${escapeHtml(event.adminId)}` : ''}</p>
          <span>${escapeHtml(date)}</span>
        </div>
      </div>
    `;
  }

  if (event.type === 'order_status') {
    const paymentEvent = isPaymentStatus(event.status);
    return `
      <div class="activity-item activity-button${newClass} ${paymentEvent ? `activity-payment activity-payment-${paymentStateFromStatus(event.status)}` : ''}" data-open-order="${escapeHtml(orderId)}" role="button" tabindex="0">
        <div class="activity-icon">${paymentEvent ? '₴' : '#'}</div>
        <div>
          <strong>${escapeHtml(paymentEvent ? paymentActivityText(event, itemTitle, orderId) : `${itemTitle} у замовленні #${orderId} ${statusActionText(event.status)}`)}${newBadge}</strong>
          <p>${customerLink ? `${customerLink} · ` : ''}Натисніть, щоб відкрити деталі замовлення</p>
          <span>${escapeHtml(date)}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="activity-item activity-button${newClass}" data-open-order="${escapeHtml(orderId)}" role="button" tabindex="0">
      <div class="activity-icon">+</div>
      <div>
        <strong>Нове замовлення #${escapeHtml(orderId)}${newBadge}</strong>
        <p>${escapeHtml(itemTitle)}${customerLink ? ` · ${customerLink}` : ''}</p>
        <span>${escapeHtml(date)}</span>
      </div>
    </div>
  `;
}

async function openCustomerFromActivity(customer) {
  const name = repairText(customer || '').trim();
  if (!name) return;
  await showSection('orders');
  const search = $('orderSearch');
  if (search) search.value = name;
  ordersViewMode = 'active';
  renderOrders();
  if (!document.querySelector('#ordersList .entity-item')) {
    ordersViewMode = 'history';
    renderOrders();
  }
  setStatus(`Показано замовлення клієнта: ${name}`);
}

async function openOrderFromActivity(orderId) {
  if (!orderId) return;
  await showSection('orders');
  ordersViewMode = ordersData && ordersData[orderId] ? 'active' : 'history';
  renderOrders();
  showOrder(orderId);
  const button = document.querySelector(`#ordersList .entity-item[data-id="${CSS.escape(orderId)}"]`);
  if (button) {
    button.classList.add('active');
    button.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

async function loadEntity(resource) {
  currentResource = resource;
  currentItems = await apiFetch(`${API}/data/${resource}`);
  if (!Array.isArray(currentItems)) currentItems = [];
  $('entitySection').classList.toggle('products-entity-section', resource === 'products');
  $('entityListTitle').textContent = sections[currentSection].listTitle;
  if ($('adminPromoPanel')) {
    $('adminPromoPanel').style.display = resource === 'admins' ? '' : 'none';
  }
  renderEntityList();
  selectItem(currentItems[0] || null, currentItems[0] ? itemId(currentItems[0], 0) : null);
  if (resource === 'admins') await loadAdminPromoCodes();
}

function itemId(item, index) {
  return String((item && (item.id || item.code || item.title)) || index);
}

function itemTitle(item, index) {
  if (!item) return 'Новий запис';
  return item.title || item.name || item.id || item.code || `Запис ${index + 1}`;
}

function normalizeCategoryLabel(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function categoryCompareKey(value) {
  return normalizeCategoryLabel(value).toLocaleLowerCase('uk-UA').normalize('NFKC');
}

function uniqueProductCategories(products) {
  const byKey = new Map();
  (Array.isArray(products) ? products : []).forEach(product => {
    const category = normalizeCategoryLabel(product && product.category);
    if (!category) return;
    const key = categoryCompareKey(category);
    if (!byKey.has(key)) byKey.set(key, category);
  });
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
}

function canonicalProductCategory(value, products = currentItems) {
  const category = normalizeCategoryLabel(value);
  if (!category) return '';
  const key = categoryCompareKey(category);
  const existing = uniqueProductCategories(products).find(item => categoryCompareKey(item) === key);
  return existing || category;
}

function itemSubtitle(item) {
  if (!item) return '';
  if (currentResource === 'admins') return item.email || `ID акаунта: ${item.site_user_id || 'не вказано'}`;
  if (item.price) return `₴${item.price}`;
  if (item.email) return item.email;
  if (item.status) return item.status;
  if (item.id) return `ID: ${item.id}`;
  return '';
}

function adminRoleBadge(item) {
  const role = normalizeAdminRole(item);
  return `<span class="admin-role-badge admin-role-${escapeHtml(role)}">${escapeHtml(ADMIN_ROLE_LABELS[role] || 'Адмін')}</span>`;
}

function productPreview(item) {
  const images = Array.isArray(item && item.images) ? item.images : [];
  return images[0] || item.image || 'images/reklama.png';
}

function productAvailabilityMeta(item) {
  const raw = repairText(item && item.availability || item && item.status || '').toLowerCase();
  const inStock = raw.includes('in_stock') || raw.includes('наяв') || raw.includes('налич') || (!raw && Number(item && item.price || 0) >= 0);
  return {
    className: inStock ? 'is-available' : 'is-preorder',
    label: inStock ? 'Є в наявності' : 'Під замовлення'
  };
}

function masterclassPreview(item) {
  return item && item.image ? item.image : 'images/reklama.png';
}

function masterclassSubtitle(item) {
  const price = Number(item && item.price || 0) ? `₴${Number(item.price || 0)}` : 'Без ціни';
  const duration = repairText(item && item.duration || 'Тривалість не вказана');
  const level = repairText(item && item.level || 'Рівень не вказано');
  return `${price} | ${duration} | ${level}`;
}

function parseYouTubeId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = /^(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\//i.test(raw)
    ? `https://${raw}`
    : raw;
  try {
    const url = new URL(normalized, window.location.origin);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') return (url.pathname.split('/').filter(Boolean)[0] || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (host.endsWith('youtube.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      const id = url.searchParams.get('v') || (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : '');
      return String(id || '').replace(/[^A-Za-z0-9_-]/g, '');
    }
  } catch (_) {}
  return '';
}

function updateMasterclassVideoPreview(data = getEditorData()) {
  const preview = document.getElementById('masterclassVideoPreview');
  if (!preview) return;
  const id = parseYouTubeId(data && (data.video_url || data.videoUrl || data.youtube_url || data.youtubeUrl || data.video));
  if (!id) {
    preview.innerHTML = '<span>Вставте посилання YouTube, щоб побачити превью</span>';
    preview.classList.remove('has-video');
    return;
  }
  preview.classList.add('has-video');
  preview.innerHTML = `
    <button class="masterclass-video-preview-btn" type="button" data-youtube-id="${escapeHtml(id)}">
      <img src="https://img.youtube.com/vi/${escapeHtml(id)}/mqdefault.jpg" alt="">
      <span>Переглянути відео YouTube</span>
    </button>
  `;
  preview.querySelector('.masterclass-video-preview-btn').addEventListener('click', () => openMasterclassVideoPlayer(id));
}

function ensureMasterclassVideoPlayer() {
  let modal = document.getElementById('masterclassVideoPlayer');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'masterclassVideoPlayer';
  modal.className = 'masterclass-video-player';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="masterclass-video-dialog" role="dialog" aria-modal="true" aria-labelledby="masterclassVideoTitle">
      <header class="masterclass-video-head">
        <h3 id="masterclassVideoTitle">Перегляд відео</h3>
        <button class="masterclass-video-close" type="button" aria-label="Закрити">&times;</button>
      </header>
      <div class="masterclass-video-frame"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.masterclass-video-close').addEventListener('click', closeMasterclassVideoPlayer);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeMasterclassVideoPlayer();
  });
  return modal;
}

function openMasterclassVideoPlayer(id) {
  if (!id) return;
  const modal = ensureMasterclassVideoPlayer();
  const frame = modal.querySelector('.masterclass-video-frame');
  const origin = window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : window.location.href.split('/').slice(0, 3).join('/');
  const embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&origin=${encodeURIComponent(origin)}`;
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  frame.innerHTML = `
    <iframe
      src="${escapeHtml(embedUrl)}"
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen
    ></iframe>
    <a class="masterclass-video-fallback" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener">
      Відкрити відео на YouTube
    </a>
  `;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('video-player-open');
}

function closeMasterclassVideoPlayer() {
  const modal = document.getElementById('masterclassVideoPlayer');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.querySelector('.masterclass-video-frame').innerHTML = '';
  document.body.classList.remove('video-player-open');
}

function renderEntityList() {
  const query = $('entitySearch').value.trim().toLowerCase();
  const rows = currentItems
    .map((item, index) => ({ item, index, id: itemId(item, index) }))
    .filter(row => JSON.stringify(row.item).toLowerCase().includes(query));

  $('entityList').innerHTML = rows.map(row => {
    if (currentResource === 'products') {
      const availability = productAvailabilityMeta(row.item);
      return `
        <button class="entity-item product-entity-item ${row.id === currentItemId ? 'active' : ''}" data-id="${escapeHtml(row.id)}" type="button">
          <img class="product-entity-thumb" src="${escapeHtml(productPreview(row.item))}" alt="" onerror="this.src='images/reklama.png'">
          <span class="product-entity-copy">
            <strong>${escapeHtml(itemTitle(row.item, row.index))}</strong>
            <small>${escapeHtml(itemSubtitle(row.item) || '₴0')}</small>
          </span>
          <span class="product-status-dot ${availability.className}" title="${escapeHtml(availability.label)}" aria-label="${escapeHtml(availability.label)}"></span>
        </button>
      `;
    }
    if (currentResource === 'masterclasses') {
      return `
        <button class="entity-item masterclass-entity-item ${row.id === currentItemId ? 'active' : ''}" data-id="${escapeHtml(row.id)}" type="button">
          <img class="product-entity-thumb" src="${escapeHtml(masterclassPreview(row.item))}" alt="" onerror="this.src='images/reklama.png'">
          <span class="product-entity-copy">
            <strong>${escapeHtml(itemTitle(row.item, row.index))}</strong>
            <small>${escapeHtml(masterclassSubtitle(row.item))}</small>
          </span>
        </button>
      `;
    }
    if (currentResource === 'admins') {
      return `
        <button class="entity-item admin-entity-item ${row.id === currentItemId ? 'active' : ''}" data-id="${escapeHtml(row.id)}" type="button">
          <strong>${escapeHtml(itemTitle(row.item, row.index))}</strong>
          <small>${escapeHtml(itemSubtitle(row.item))}</small>
          ${adminRoleBadge(row.item)}
        </button>
      `;
    }
    return `
      <button class="entity-item ${row.id === currentItemId ? 'active' : ''}" data-id="${escapeHtml(row.id)}" type="button">
        <strong>${escapeHtml(itemTitle(row.item, row.index))}</strong>
        <small>${escapeHtml(itemSubtitle(row.item))}</small>
      </button>
    `;
  }).join('') || '<div class="muted">Нічого не знайдено</div>';

  document.querySelectorAll('#entityList .entity-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const found = currentItems.find((item, index) => itemId(item, index) === btn.dataset.id);
      selectItem(found, btn.dataset.id);
    });
  });
}

function selectItem(item, id) {
  currentItem = item ? structuredClone(item) : null;
  currentItemId = id;
  $('entityForm').classList.toggle('product-editor', currentResource === 'products');
  $('entityForm').classList.toggle('masterclass-editor', currentResource === 'masterclasses');
  $('deleteItemBtn').style.display = item ? 'inline-block' : 'none';
  $('editorTitle').textContent = item ? 'Редагування' : 'Новий запис';
  $('jsonEditor').value = JSON.stringify(currentItem || getEmptyItem(), null, 2);
  renderFieldEditor(currentItem || getEmptyItem());
  renderEntityList();
}

function getEmptyItem() {
  if (currentResource === 'products') return { title: '', category: '', availability: 'in_stock', description: '', price: 0, discount: 0, images: [], specs: [] };
  if (currentResource === 'masterclasses') return { title: '', description: '', duration: '', level: '', price: 0, image: '', video_url: '', id: String(Date.now()) };
  if (currentResource === 'admins') return { id: '', site_user_id: 0, name: '', email: '', role: 'moderator', permissions: [...ADMIN_ROLE_DEFAULTS.moderator] };
  return {};
}

function adminPermissionIds() {
  return ADMIN_PERMISSION_GROUPS.flatMap(group => group.items.map(item => item.id));
}

function normalizeAdminRole(item = {}) {
  if (item.role && ADMIN_ROLE_LABELS[item.role]) return item.role;
  const permissions = Array.isArray(item.permissions) ? item.permissions : [];
  return adminPermissionIds().every(permission => permissions.includes(permission)) || permissions.includes('admins')
    ? 'super_admin'
    : 'moderator';
}

function adminPermissionsFor(item = {}) {
  const role = normalizeAdminRole(item);
  if (role === 'super_admin') return [...ADMIN_ROLE_DEFAULTS.super_admin];
  const permissions = Array.isArray(item.permissions) ? item.permissions : ADMIN_ROLE_DEFAULTS[role] || [];
  return permissions.filter(permission => adminPermissionIds().includes(permission));
}

function isEditingOwnAdmin(item = getEditorData()) {
  return currentAdminProfile && Number(item.site_user_id || 0) === Number(currentAdminProfile.userId || 0);
}

function canEditAdminAccess(item = getEditorData()) {
  if (!isEditingOwnAdmin(item)) return true;
  return currentAdminProfile && currentAdminProfile.role === 'super_admin';
}

function renderFieldEditor(item, galleryAnimation = null) {
  const fields = fieldSets[currentResource] || [];
  const renderField = (field) => {
    const value = formatFieldValue(item[field.key] == null ? field.defaultValue : item[field.key], field.type);
    const cls = `${field.full ? 'field full' : 'field'} field-${field.key}`;
    const hint = field.key === 'specs'
      ? '<small class="field-hint">Введите каждую характеристику с новой строки</small>'
      : '';
    const videoPreview = currentResource === 'masterclasses' && field.key === 'video_url'
      ? '<div id="masterclassVideoPreview" class="masterclass-video-preview"></div>'
      : '';
    if (field.type === 'textarea' || field.type === 'lines') {
      return `<label class="${cls}"><span>${field.label}</span>${hint}<textarea data-key="${field.key}" data-type="${field.type}">${escapeHtml(value)}</textarea></label>`;
    }
    if (field.type === 'select') {
      const options = (field.options || []).map(option => `
        <option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>
      `).join('');
      return `<label class="${cls}"><span>${field.label}</span>${hint}<select data-key="${field.key}" data-type="select">${options}</select></label>`;
    }
    const categoryListAttr = currentResource === 'products' && field.key === 'category' ? ' list="productCategoryOptions" autocomplete="off"' : '';
    return `<label class="${cls}"><span>${field.label}</span>${hint}<input data-key="${field.key}" data-type="${field.type || 'text'}" type="${field.type === 'number' ? 'number' : 'text'}" value="${escapeHtml(value)}"${categoryListAttr}>${videoPreview}</label>`;
  };

  if (currentResource === 'products') {
    const byKey = Object.fromEntries(fields.map(field => [field.key, field]));
    $('fieldEditor').innerHTML = `
      <section class="editor-block editor-block-main">
        <h4>Основна інформація</h4>
        <div class="editor-block-grid">
          ${renderField(byKey.title)}
          ${renderField(byKey.category)}
          ${renderField(byKey.description)}
        </div>
        <datalist id="productCategoryOptions">
          ${uniqueProductCategories(currentItems).map(category => `<option value="${escapeHtml(category)}"></option>`).join('')}
        </datalist>
      </section>
      <section class="editor-block editor-block-pricing">
        <h4>Ціноутворення</h4>
        <div class="editor-block-grid">
          ${renderField(byKey.price)}
          ${renderField(byKey.discount)}
          ${renderField(byKey.availability)}
          ${renderField(byKey.specs)}
        </div>
      </section>
    `;
  } else if (currentResource === 'masterclasses') {
    const byKey = Object.fromEntries(fields.map(field => [field.key, field]));
    $('fieldEditor').innerHTML = `
      <section class="editor-block editor-block-main">
        <h4>Інформація</h4>
        <div class="editor-block-grid">
          ${renderField(byKey.title)}
          ${renderField(byKey.description)}
        </div>
      </section>
      <section class="editor-block editor-block-pricing">
        <h4>Параметри</h4>
        <div class="editor-block-grid">
          ${renderField(byKey.price)}
          ${renderField(byKey.duration)}
          ${renderField(byKey.level)}
        </div>
      </section>
      <section class="editor-block editor-block-video">
        <h4>Відео</h4>
        <div class="editor-block-grid">
          ${renderField(byKey.video_url)}
        </div>
      </section>
    `;
  } else if (currentResource === 'admins') {
    const role = normalizeAdminRole(item);
    const permissions = adminPermissionsFor(item);
    const locked = !canEditAdminAccess(item);
    $('fieldEditor').innerHTML = `
      <section class="editor-block editor-block-main admin-rbac-main">
        <h4>Основна інформація</h4>
        <div class="editor-block-grid">
          ${renderField(fields.find(field => field.key === 'id'))}
          ${renderField(fields.find(field => field.key === 'site_user_id'))}
          ${renderField(fields.find(field => field.key === 'name'))}
          ${renderField(fields.find(field => field.key === 'email'))}
        </div>
      </section>
      <section class="editor-block admin-rbac-panel">
        <h4>Роль</h4>
        ${locked ? '<p class="admin-rbac-warning">Ви не можете змінювати власні права без ролі Супер-адмін.</p>' : ''}
        <label class="field">
          <span>Роль</span>
          <select id="adminRoleSelect" data-key="role" data-type="text" ${locked ? 'disabled' : ''}>
            ${Object.entries(ADMIN_ROLE_LABELS).map(([value, label]) => `
              <option value="${escapeHtml(value)}" ${value === role ? 'selected' : ''}>${escapeHtml(label)}</option>
            `).join('')}
          </select>
        </label>
      </section>
      <section class="editor-block admin-rbac-panel admin-permissions-panel">
        <h4>Конкретні дозволи</h4>
        <div class="admin-permission-grid">
          ${ADMIN_PERMISSION_GROUPS.map(group => `
            <fieldset class="admin-permission-group">
              <legend>${escapeHtml(group.title)}</legend>
              ${group.items.map(permission => `
                <label class="admin-permission-check">
                  <input type="checkbox" data-admin-permission="${escapeHtml(permission.id)}" ${permissions.includes(permission.id) ? 'checked' : ''} ${(role === 'super_admin' || locked) ? 'disabled' : ''}>
                  <span>${escapeHtml(permission.label)}</span>
                </label>
              `).join('')}
            </fieldset>
          `).join('')}
        </div>
      </section>
    `;
  } else {
    $('fieldEditor').innerHTML = fields.map(renderField).join('');
  }

  $('fieldEditor').querySelectorAll('input, textarea, select').forEach(input => {
    input.addEventListener('input', syncJsonFromFields);
    input.addEventListener('change', syncJsonFromFields);
  });
  if (currentResource === 'products') {
    const categoryInput = $('fieldEditor').querySelector('[data-key="category"]');
    categoryInput?.addEventListener('blur', () => {
      categoryInput.value = canonicalProductCategory(categoryInput.value);
      syncJsonFromFields();
    });
  }
  if (currentResource === 'admins') {
    $('adminRoleSelect')?.addEventListener('change', () => {
      syncJsonFromFields();
      renderFieldEditor(getEditorData());
    });
    document.querySelectorAll('[data-admin-permission]').forEach(input => {
      input.addEventListener('change', syncJsonFromFields);
    });
    syncJsonFromFields();
  }

  updateUploadVisibility();
  renderImageGallery(getEditorData(), galleryAnimation);
  if (currentResource === 'masterclasses') updateMasterclassVideoPreview(getEditorData());
}

function formatFieldValue(value, type) {
  if (type === 'lines') return Array.isArray(value) ? value.join('\n') : (value || '');
  return value == null ? '' : String(value);
}

function syncJsonFromFields() {
  let data;
  try {
    data = JSON.parse($('jsonEditor').value || '{}');
  } catch (_) {
    data = currentItem || getEmptyItem();
  }

  $('fieldEditor').querySelectorAll('input, textarea, select').forEach(input => {
    const key = input.dataset.key;
    const type = input.dataset.type;
    if (!key) return;
    if (type === 'number') data[key] = Number(input.value) || 0;
    else if (type === 'lines') data[key] = input.value.split('\n').map(v => v.trim()).filter(Boolean);
    else if (currentResource === 'products' && key === 'category') data[key] = canonicalProductCategory(input.value);
    else data[key] = input.value;
  });
  if (currentResource === 'admins') {
    const role = $('adminRoleSelect')?.value || normalizeAdminRole(data);
    data.role = role;
    data.permissions = role === 'super_admin'
      ? [...ADMIN_ROLE_DEFAULTS.super_admin]
      : Array.from(document.querySelectorAll('[data-admin-permission]:checked')).map(input => input.dataset.adminPermission);
  }

  $('jsonEditor').value = JSON.stringify(data, null, 2);
  renderImageGallery(data);
  if (currentResource === 'masterclasses') updateMasterclassVideoPreview(data);
}

function updateUploadVisibility() {
  const box = $('imageUploadBox');
  const gallery = $('imageGallery');
  const canUpload = ['products', 'sets', 'masterclasses'].includes(currentResource);
  box.style.display = canUpload ? 'flex' : 'none';
  gallery.style.display = canUpload ? 'grid' : 'none';
}

function getEditorData() {
  try {
    return JSON.parse($('jsonEditor').value || '{}');
  } catch (_) {
    return currentItem || getEmptyItem();
  }
}

function getImagePaths(data = getEditorData()) {
  if (currentResource === 'masterclasses') {
    return data.image ? [data.image] : [];
  }
  return Array.isArray(data.images) ? data.images : [];
}

function setImagePaths(paths, options = {}) {
  const data = getEditorData();
  if (currentResource === 'masterclasses') {
    data.image = paths[0] || '';
  } else {
    data.images = paths;
  }
  $('jsonEditor').value = JSON.stringify(data, null, 2);
  renderFieldEditor(data, options.galleryAnimation || null);
}

function renderImageGalleryFromEditor() {
  renderImageGallery(getEditorData());
}

function getImageAnimationKey(paths, index) {
  const src = paths[index] || '';
  let occurrence = 0;
  for (let i = 0; i <= index; i += 1) {
    if (paths[i] === src) occurrence += 1;
  }
  return `${src}::${occurrence}`;
}

function collectImageCardRects(gallery) {
  const rects = new Map();
  gallery.querySelectorAll('.image-card').forEach(card => {
    if (card.dataset.imageKey) {
      rects.set(card.dataset.imageKey, card.getBoundingClientRect());
    }
  });
  return rects;
}

function animateImageGalleryFrom(gallery, firstRects) {
  if (!firstRects || !firstRects.size) return;
  gallery.querySelectorAll('.image-card').forEach(card => {
    const first = firstRects.get(card.dataset.imageKey);
    if (!first) return;
    const last = card.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    card.classList.add('is-reordered');
    card.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(0.985)`, boxShadow: '0 18px 34px rgba(74, 54, 40, 0.12)' },
        { transform: 'translate(0, 0) scale(1)', boxShadow: '0 20px 38px rgba(74, 54, 40, 0.14)' }
      ],
      { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' }
    ).addEventListener('finish', () => card.classList.remove('is-reordered'), { once: true });
  });
}

function getImageDropSlot(card, event) {
  const rect = card.getBoundingClientRect();
  const index = Number(card.dataset.index);
  const isAfter = event.clientY > rect.top + rect.height / 2 || event.clientX > rect.left + rect.width * 0.62;
  return index + (isAfter ? 1 : 0);
}

function markImageDropSlot(gallery, card, event) {
  const slot = getImageDropSlot(card, event);
  gallery.querySelectorAll('.image-card.is-drag-over, .image-card.is-drop-after').forEach(item => {
    if (item !== card) item.classList.remove('is-drag-over', 'is-drop-after');
  });
  card.classList.add('is-drag-over');
  card.classList.toggle('is-drop-after', slot > Number(card.dataset.index));
  return slot;
}

function renderImageGallery(data, animation = null) {
  const gallery = $('imageGallery');
  if (!['products', 'sets', 'masterclasses'].includes(currentResource)) {
    gallery.style.display = 'none';
    gallery.innerHTML = '';
    return;
  }

  const paths = getImagePaths(data);
  gallery.style.display = 'grid';
  gallery.innerHTML = paths.length ? paths.map((src, index) => `
    <figure class="image-card" draggable="true" data-index="${index}" data-image-key="${escapeHtml(getImageAnimationKey(paths, index))}">
      ${index === 0 ? '<span class="image-main-badge">Головне фото</span>' : ''}
      <button class="image-preview-button" data-index="${index}" type="button" aria-label="Відкрити фото ${index + 1}">
        <img src="${escapeHtml(src)}" alt="Фото ${index + 1}" onerror="this.src='images/reklama.png'">
      </button>
      <figcaption title="${escapeHtml(src)}">${escapeHtml(src)}</figcaption>
      <div class="image-actions">
        <button class="icon-action-btn replace-image" data-index="${index}" type="button" title="Замінити" aria-label="Замінити фото ${index + 1}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.5V21h3.5L18 9.5 14.5 6 3 17.5Z"/><path d="m13.5 7 3.5 3.5"/><path d="M15 4h5v5"/></svg>
        </button>
        <button class="icon-action-btn danger remove-image" data-index="${index}" type="button" title="Видалити" aria-label="Видалити фото ${index + 1}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/></svg>
        </button>
      </div>
    </figure>
  `).join('') : '<div class="muted">Фото ще не додані. Завантажте хоча б одне зображення.</div>';

  gallery.querySelectorAll('.remove-image').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = getImagePaths().filter((_, index) => index !== Number(btn.dataset.index));
      setImagePaths(next);
      setStatus('Фото видалено');
    });
  });

  gallery.querySelectorAll('.replace-image').forEach(btn => {
    btn.addEventListener('click', () => {
      replaceImageIndex = Number(btn.dataset.index);
      $('replaceImageInput').click();
    });
  });

  gallery.querySelectorAll('.image-preview-button').forEach(btn => {
    btn.addEventListener('click', () => openImageLightbox(Number(btn.dataset.index) || 0));
  });

  gallery.querySelectorAll('.image-card').forEach(card => {
    card.addEventListener('dragstart', (event) => {
      card.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.index || '0');
      if (event.dataTransfer.setDragImage) {
        event.dataTransfer.setDragImage(card, card.offsetWidth / 2, 28);
      }
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      gallery.querySelectorAll('.image-card.is-drag-over, .image-card.is-drop-after').forEach(item => item.classList.remove('is-drag-over', 'is-drop-after'));
    });
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      markImageDropSlot(gallery, card, event);
    });
    card.addEventListener('dragleave', () => {
      card.classList.remove('is-drag-over', 'is-drop-after');
    });
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      const fromIndex = Number(event.dataTransfer.getData('text/plain'));
      const insertIndex = getImageDropSlot(card, event);
      card.classList.remove('is-drag-over', 'is-drop-after');
      reorderImagePaths(fromIndex, insertIndex);
    });
  });

  if (animation && animation.firstRects) {
    requestAnimationFrame(() => animateImageGalleryFrom(gallery, animation.firstRects));
  }
}

function reorderImagePaths(fromIndex, insertIndex) {
  const paths = getImagePaths();
  if (
    fromIndex < 0 ||
    insertIndex < 0 ||
    fromIndex >= paths.length ||
    insertIndex > paths.length
  ) return;

  const normalizedInsertIndex = fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
  if (fromIndex === normalizedInsertIndex) return;

  const gallery = $('imageGallery');
  const firstRects = collectImageCardRects(gallery);
  const next = [...paths];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(normalizedInsertIndex, 0, moved);
  setImagePaths(next, { galleryAnimation: { firstRects } });
  setStatus('Порядок фото оновлено');
}

function ensureImageLightbox() {
  let lightbox = document.getElementById('adminImageLightbox');
  if (lightbox) return lightbox;

  lightbox = document.createElement('div');
  lightbox.id = 'adminImageLightbox';
  lightbox.className = 'admin-image-lightbox';
  lightbox.setAttribute('aria-hidden', 'true');
  lightbox.innerHTML = `
    <div class="image-lightbox-dialog" role="dialog" aria-modal="true" aria-labelledby="imageLightboxTitle">
      <header class="image-lightbox-head">
        <h3 id="imageLightboxTitle">Перегляд зображення</h3>
        <button class="image-lightbox-close" type="button" aria-label="Закрити">&times;</button>
      </header>
      <figure class="image-lightbox-frame">
        <img class="image-lightbox-img" alt="Фото товару">
        <figcaption class="image-lightbox-caption"></figcaption>
      </figure>
      <div class="image-lightbox-actions">
        <button class="image-lightbox-nav image-lightbox-prev" type="button" aria-label="Попереднє фото">‹</button>
        <button class="image-lightbox-main" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>
          <span>Зробити головною</span>
        </button>
        <button class="image-lightbox-delete" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/></svg>
          <span>Видалити</span>
        </button>
        <button class="image-lightbox-nav image-lightbox-next" type="button" aria-label="Наступне фото">›</button>
      </div>
    </div>
  `;
  document.body.appendChild(lightbox);

  lightbox.querySelector('.image-lightbox-close').addEventListener('click', closeImageLightbox);
  lightbox.querySelector('.image-lightbox-prev').addEventListener('click', () => shiftImageLightbox(-1));
  lightbox.querySelector('.image-lightbox-next').addEventListener('click', () => shiftImageLightbox(1));
  lightbox.querySelector('.image-lightbox-main').addEventListener('click', makeLightboxImageMain);
  lightbox.querySelector('.image-lightbox-delete').addEventListener('click', deleteLightboxImage);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeImageLightbox();
  });

  return lightbox;
}

function updateImageLightbox() {
  const lightbox = ensureImageLightbox();
  const paths = getImagePaths();
  if (!paths.length) return closeImageLightbox();
  imageLightboxIndex = (imageLightboxIndex + paths.length) % paths.length;
  const src = paths[imageLightboxIndex];
  const image = lightbox.querySelector('.image-lightbox-img');
  const caption = lightbox.querySelector('.image-lightbox-caption');
  const prev = lightbox.querySelector('.image-lightbox-prev');
  const next = lightbox.querySelector('.image-lightbox-next');
  const main = lightbox.querySelector('.image-lightbox-main');

  image.src = src;
  image.alt = `Фото товару ${imageLightboxIndex + 1}`;
  caption.textContent = `Фото ${imageLightboxIndex + 1} з ${paths.length}`;
  prev.hidden = paths.length < 2;
  next.hidden = paths.length < 2;
  main.disabled = imageLightboxIndex === 0;
}

function openImageLightbox(index = 0) {
  const paths = getImagePaths();
  if (!paths.length) return;
  imageLightboxIndex = Math.min(Math.max(index, 0), paths.length - 1);
  const lightbox = ensureImageLightbox();
  updateImageLightbox();
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('image-lightbox-open');
}

function closeImageLightbox() {
  const lightbox = document.getElementById('adminImageLightbox');
  if (!lightbox) return;
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('image-lightbox-open');
}

function shiftImageLightbox(direction) {
  const paths = getImagePaths();
  if (paths.length < 2) return;
  imageLightboxIndex = (imageLightboxIndex + direction + paths.length) % paths.length;
  updateImageLightbox();
}

function makeLightboxImageMain() {
  const paths = getImagePaths();
  if (imageLightboxIndex <= 0 || imageLightboxIndex >= paths.length) return;
  const next = [...paths];
  const [selected] = next.splice(imageLightboxIndex, 1);
  next.unshift(selected);
  imageLightboxIndex = 0;
  setImagePaths(next);
  updateImageLightbox();
  setStatus('Фото зроблено головним');
}

function deleteLightboxImage() {
  const paths = getImagePaths();
  if (!paths.length) return closeImageLightbox();
  const next = paths.filter((_, index) => index !== imageLightboxIndex);
  setImagePaths(next);
  setStatus('Фото видалено');
  if (!next.length) {
    closeImageLightbox();
    return;
  }
  imageLightboxIndex = Math.min(imageLightboxIndex, next.length - 1);
  updateImageLightbox();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImageFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  return apiFetch(`${API}/upload-image`, {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      resource: currentResource,
      dataUrl
    })
  });
}

function appendImagePathToEditor(imagePath) {
  const paths = getImagePaths();
  if (currentResource === 'masterclasses') {
    setImagePaths([imagePath]);
  } else {
    setImagePaths([...paths, imagePath]);
  }
}

async function replaceImageFile(file, index) {
  try {
    setStatus('Заміна фото...');
    const result = await uploadImageFile(file);
    const paths = getImagePaths();
    paths[index] = result.path;
    setImagePaths(paths);
    setStatus('Фото замінено');
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  } finally {
    replaceImageIndex = null;
    $('replaceImageInput').value = '';
  }
}

async function handleImageFiles(files) {
  const imageFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'));
  if (!imageFiles.length) return;

  try {
    setStatus('Завантаження фото...');
    for (const file of imageFiles) {
      const result = await uploadImageFile(file);
      appendImagePathToEditor(result.path);
    }
    setStatus('Фото додано');
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  } finally {
    $('imageFileInput').value = '';
  }
}

async function saveEntity(event) {
  event.preventDefault();
  try {
    syncJsonFromFields();
    const payload = JSON.parse($('jsonEditor').value || '{}');
    if (currentResource === 'admins' && !canEditAdminAccess(payload)) {
      setStatus('Ви не можете змінювати власні права без ролі Супер-адмін', true);
      return;
    }
    if (['products', 'sets', 'masterclasses'].includes(currentResource) && getImagePaths(payload).length === 0) {
      setStatus('Додайте хоча б одне фото перед збереженням', true);
      alert('Щоб додати або зберегти цей запис на сайті, потрібно завантажити хоча б одну фотографію.');
      return;
    }
    if (currentItemId) {
      await apiFetch(`${API}/data/${currentResource}/${encodeURIComponent(currentItemId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetch(`${API}/data/${currentResource}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    await loadEntity(currentResource);
    setStatus('Збережено');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function deleteEntity() {
  if (!currentItemId) return;
  if (!confirm('Видалити цей запис?')) return;
  try {
    await apiFetch(`${API}/data/${currentResource}/${encodeURIComponent(currentItemId)}`, { method: 'DELETE' });
    await loadEntity(currentResource);
    setStatus('Видалено');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadOrders() {
  const [activeOrders, historyOrders] = await Promise.all([
    apiFetch(`${API}/data/orders`),
    apiFetch(`${API}/orders/history`)
  ]);
  ordersData = activeOrders || {};
  orderHistoryData = historyOrders || {};
  renderOrders();
}

function orderStatusTone(status) {
  const raw = repairText(status || '').toLowerCase();
  if (raw.includes('викон') || raw.includes('completed')) return 'done';
  if (raw.includes('скас') || raw.includes('cancel')) return 'cancelled';
  if (raw.includes('відправ') || raw.includes('shipped')) return 'shipped';
  if (raw.includes('виготов') || raw.includes('process')) return 'process';
  if (raw.includes('оплач') || raw.includes('paid')) return 'paid';
  return 'new';
}

function orderListTypeLabel(order) {
  if (isDigitalOrder(order)) return 'Цифровий';
  if (isCertificateOrder(order)) return 'Сертифікат';
  return 'Фізичний';
}

function orderListMatchesKind(order, payment) {
  if (orderKindFilter === 'digital') return isDigitalOrder(order);
  if (orderKindFilter === 'physical') return !isDigitalOrder(order);
  if (orderKindFilter === 'urgent') return payment.state === 'pending';
  return true;
}

function renderOrderListItem(order) {
  const summary = getOrderSummary(order);
  const payment = getPaymentInfo(order);
  const statusTone = orderStatusTone(summary.status);
  const isUrgent = ordersViewMode === 'active' && payment.state === 'pending';
  const typeLabel = orderListTypeLabel(order);
  const savedAt = order.history_saved_at || order.archived_at || order.created_at;
  return `
    <button class="entity-item order-list-card ${String(order.id) === String(currentOrderId) ? 'active' : ''} ${isUrgent ? 'order-payment-urgent' : ''}" data-id="${escapeHtml(order.id)}" type="button">
      <span class="order-list-icon ${isDigitalOrder(order) ? 'is-digital' : ''}" aria-hidden="true">${isDigitalOrder(order) ? 'D' : '#'}</span>
      <span class="order-list-body">
        <span class="order-list-top">
          <strong>#${escapeHtml(summary.id || '')}</strong>
          <span class="order-status-badge order-status-${statusTone}">${escapeHtml(summary.status)}</span>
        </span>
        <span class="order-list-customer">${escapeHtml(summary.customer || 'Клієнт')}</span>
        <span class="order-list-meta">
          <span>${escapeHtml(typeLabel)}</span>
          <span>${escapeHtml(formatOrderDate(savedAt))}</span>
          <span>${escapeHtml(formatMoney(summary.finalTotal || 0))}</span>
        </span>
        <span class="order-payment-chip order-payment-${payment.state}">${escapeHtml(payment.label)}</span>
        ${isUrgent ? '<span class="order-urgent-label">Терміново підтвердити оплату</span>' : ''}
        ${ordersViewMode === 'history' ? `<span class="order-list-badge ${order.active ? 'is-active' : ''}">${order.active ? 'Активне' : 'Архів'}</span>` : ''}
      </span>
    </button>
  `;
}

function renderOrders() {
  const query = $('orderSearch').value.trim().toLowerCase();
  const source = ordersViewMode === 'history' ? orderHistoryData : ordersData;
  const pendingPaymentCount = Object.values(ordersData || {}).filter(order => getPaymentInfo(order).state === 'pending').length;
  const rows = Object.values(source || {})
    .sort((a, b) => Number(b.history_saved_at || b.archived_at || b.created_at || 0) - Number(a.history_saved_at || a.archived_at || a.created_at || 0))
    .filter(order => {
      const payment = getPaymentInfo(order);
      const status = repairText(order.status || 'нове').toLowerCase();
      const matchesQuery = !query || JSON.stringify(order).toLowerCase().includes(query) || getOrderSummary(order).customer.toLowerCase().includes(query);
      const matchesStatus = !orderStatusFilter || status.includes(orderStatusFilter);
      return matchesQuery && matchesStatus && orderListMatchesKind(order, payment);
    });
  $('activeOrdersTab').classList.toggle('active', ordersViewMode === 'active');
  $('orderHistoryTab').classList.toggle('active', ordersViewMode === 'history');
  $('activeOrdersTab').classList.toggle('has-urgent-payment', pendingPaymentCount > 0);
  if ($('ordersUrgentBadge')) {
    $('ordersUrgentBadge').textContent = pendingPaymentCount;
    $('ordersUrgentBadge').hidden = pendingPaymentCount === 0;
  }
  if ($('ordersListMeta')) {
    const total = Object.keys(source || {}).length;
    $('ordersListMeta').textContent = `${ordersViewMode === 'history' ? 'Історія' : 'Активні'}: ${rows.length} з ${total}`;
  }
  document.querySelectorAll('[data-section="orders"]').forEach(tab => {
    tab.classList.toggle('has-urgent-payment', pendingPaymentCount > 0);
    let badge = tab.querySelector('[data-urgent-payment-badge]');
    if (!badge && pendingPaymentCount > 0) {
      badge = document.createElement('span');
      badge.className = 'urgent-payment-badge';
      badge.dataset.urgentPaymentBadge = 'true';
      tab.appendChild(badge);
    }
    if (badge) {
      badge.textContent = pendingPaymentCount;
      badge.hidden = pendingPaymentCount === 0;
    }
  });
  $('deleteAllOrdersBtn').disabled = !Object.keys(ordersData || {}).length;
  $('clearOrderHistoryBtn').disabled = !Object.keys(orderHistoryData || {}).length;
  $('ordersList').innerHTML = rows.map(renderOrderListItem).join('') || `<div class="orders-empty-state muted">${ordersViewMode === 'history' ? 'Історія замовлень порожня' : 'Замовлень немає'}</div>`;
  document.querySelectorAll('#ordersList .entity-item').forEach(btn => {
    btn.addEventListener('click', () => showOrder(btn.dataset.id));
  });
}

function setOrdersViewMode(mode) {
  ordersViewMode = mode === 'history' ? 'history' : 'active';
  currentOrderId = null;
  $('orderDetails').textContent = ordersViewMode === 'history' ? 'Оберіть запис з історії' : 'Оберіть замовлення';
  renderOrders();
}

async function deleteAllOrders() {
  const count = Object.keys(ordersData || {}).length;
  if (!count) return;
  if (!confirm(`Видалити всі активні замовлення (${count})? Вони залишаться в історії.`)) return;
  const result = await apiFetch(`${API}/orders`, { method: 'DELETE' });
  currentOrderId = null;
  $('orderDetails').textContent = 'Оберіть замовлення';
  await loadOrders();
  setStatus(`Активні замовлення видалено: ${result.removed || count}. Історію збережено.`);
}

async function clearOrderHistory() {
  const count = Object.keys(orderHistoryData || {}).length;
  if (!count) return;
  if (!confirm(`Очистити всю історію замовлень (${count})? Активні замовлення не будуть видалені.`)) return;
  const result = await apiFetch(`${API}/orders/history`, { method: 'DELETE' });
  currentOrderId = null;
  $('orderDetails').textContent = ordersViewMode === 'history' ? 'Оберіть запис з історії' : 'Оберіть замовлення';
  await loadOrders();
  setStatus(`Історію замовлень очищено: ${result.removed || count}`);
}

const CP1251_CHARS = 'ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕїАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя';

function cp1251Byte(char) {
  const code = char.charCodeAt(0);
  if (code < 128) return code;
  const index = CP1251_CHARS.indexOf(char);
  return index >= 0 ? index + 128 : null;
}

function repairText(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[РС]\p{Script=Cyrillic}|в‚|вЂ|рџ/u.test(text)) return text;

  const bytes = [];
  for (const char of text) {
    const byte = cp1251Byte(char);
    if (byte === null) return text;
    bytes.push(byte);
  }

  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    return decoded.includes('\uFFFD') ? text : decoded;
  } catch (error) {
    return text;
  }
}

function formatOrderDate(value) {
  const number = Number(value);
  if (!number) return 'Не вказано';
  const date = new Date(number > 1000000000000 ? number : number * 1000);
  return Number.isNaN(date.getTime()) ? 'Не вказано' : date.toLocaleString('uk-UA');
}

function activityStorageKey(event) {
  if (!event) return '';
  return [
    event.type || 'event',
    event.orderId || '',
    event.status || '',
    event.adminId || '',
    event.ts || ''
  ].map(part => String(part).trim()).join('|');
}

function getSeenActivityKeys() {
  try {
    const list = JSON.parse(localStorage.getItem(ADMIN_SEEN_ACTIVITY_KEY) || '[]');
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch (_) {
    return new Set();
  }
}

function storeSeenActivityKeys(keys) {
  localStorage.setItem(ADMIN_SEEN_ACTIVITY_KEY, JSON.stringify(Array.from(keys).slice(-180)));
}

function getHiddenActivityKeys() {
  try {
    const list = JSON.parse(localStorage.getItem(ADMIN_HIDDEN_ACTIVITY_KEY) || '[]');
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch (_) {
    return new Set();
  }
}

function storeHiddenActivityKeys(keys) {
  localStorage.setItem(ADMIN_HIDDEN_ACTIVITY_KEY, JSON.stringify(Array.from(keys).slice(-300)));
}

function clearOverviewActivity() {
  const hidden = getHiddenActivityKeys();
  overviewActivity.forEach(event => {
    const key = activityStorageKey(event);
    if (key) hidden.add(key);
  });
  storeHiddenActivityKeys(hidden);
  newOverviewActivityKeys.clear();
  overviewActivityVisible = 10;
  renderActivityPanel();
  setStatus('Швидкий стан очищено');
}

function isNewActivity(event) {
  return newOverviewActivityKeys.has(activityStorageKey(event));
}

function orderRawText(order) {
  return repairText(order.raw || order.summary?.raw || '');
}

function getOrderGrossTotal(order) {
  return Number(order.total ?? order.summary?.total ?? 0) || 0;
}

function getOrderStarsUsed(order) {
  return Number(order.stars_used ?? order.summary?.stars_used ?? 0) || 0;
}

function getOrderPayableTotal(order) {
  const explicitValue = order.final_total != null ? order.final_total : order.summary?.final_total;
  const explicit = Number(explicitValue);
  if (explicitValue != null && Number.isFinite(explicit)) return explicit;
  return Math.max(0, getOrderGrossTotal(order) - getOrderStarsUsed(order));
}

function extractOrderLine(raw, pattern) {
  const line = raw.split('\n').find(row => pattern.test(row));
  if (!line) return '';
  const parts = line.split(':');
  return parts.length > 1 ? parts.slice(1).join(':').trim() : line.trim();
}

function getOrderSummary(order) {
  const raw = orderRawText(order);
  const total = getOrderGrossTotal(order);
  const starsUsed = getOrderStarsUsed(order);
  const finalTotal = getOrderPayableTotal(order);
  return {
    id: repairText(order.id || ''),
    status: repairText(order.status || 'нове'),
    created: formatOrderDate(order.created_at),
    customer: repairText(order.customer || order.summary?.customer || extractOrderLine(raw, /ПІБ|ПІБ|Имя|Ім'я/i) || 'Не вказано'),
    telegram: extractOrderLine(raw, /Telegram/i),
    city: repairText(order.summary?.city || extractOrderLine(raw, /Місто|Город/i) || 'Не вказано'),
    delivery: repairText(order.summary?.delivery || extractOrderLine(raw, /Пошта|Почта|Доставка/i) || 'Не вказано'),
    department: extractOrderLine(raw, /Відділення|Отделение/i),
    payment: extractOrderLine(raw, /Тип оплати|Оплата|Payment/i),
    total,
    finalTotal,
    starsUsed
  };
}

function getOrderItems(order) {
  if (Array.isArray(order.items) && order.items.length) {
    return order.items.map((item, index) => {
      const isCustom = item.isCustomOrder || repairText(item.title || '').toLowerCase().includes('свічка під замовлення');
      const materialLabels = {
        massage: 'Масажний',
        soy: 'Соєвий',
        paraffin: 'Парафін',
        beeswax: 'Бджолиний'
      };
      const colorLabels = {
        white: 'Білий',
        yellow: 'Жовтий',
        red: 'Червоний',
        green: 'Зелений',
        blue: 'Блакитний',
        violet: 'Фіолетовий',
        standard: 'Білий стандарт',
        pastel: 'Пастельний',
        custom: 'Індивідуальний'
      };
      const material = materialLabels[item.material] || item.material;
      const color = colorLabels[item.color] || item.color;
      const composition = [
        material ? `Матеріал: ${repairText(material)}` : '',
        color ? `Колір: ${repairText(color)}` : '',
        item.volume ? `Обʼєм: ${repairText(item.volume)}` : '',
        item.aroma ? `Аромат: ${repairText(item.aroma)}` : '',
        item.notes ? `Побажання: ${repairText(item.notes)}` : ''
      ].filter(Boolean);
      const setItems = Array.isArray(item.setItems) && item.setItems.length
        ? item.setItems.map(setItem => `- ${repairText(setItem.title || setItem.name || 'Позиція')} × ${setItem.qty || setItem.quantity || 1}`)
        : [];
      return {
        title: repairText(item.title || item.name || `Товар ${index + 1}`),
        details: [
        isCustom && composition.length ? 'Склад замовлення:' : '',
        ...composition,
        setItems.length ? 'Склад набору:' : '',
        ...setItems,
        item.price ? `Ціна: ₴${item.price}` : '',
        item.quantity ? `Кількість: ${item.quantity}` : '',
        item.total ? `Сума: ₴${item.total}` : ''
      ].filter(Boolean)
      };
    });
  }

  const lines = orderRawText(order).split('\n').map(line => line.trim()).filter(Boolean);
  const items = [];
  lines.forEach(line => {
    if (/^\d+\)/.test(line)) {
      items.push({ title: line.replace(/^\d+\)\s*/, ''), details: [] });
      return;
    }
    if (/^\S+\s+/.test(line) && items.length && !line.includes(':')) return;
    if (items.length && /:/.test(line) && !/ПІБ|Telegram|Місто|Відділення|Пошта|Тип оплати|Разом/i.test(line)) {
      items[items.length - 1].details.push(line);
    }
  });
  return items;
}

function isCertificateOrder(order) {
  const items = Array.isArray(order && order.items) ? order.items : [];
  return items.some(item => {
    const title = repairText(item && (item.title || item.name) || '').toLowerCase();
    return item && (item.isCertificate || Number(item.certificateStars) > 0 || title.includes('сертифікат') || title.includes('сертификат'));
  });
}

function isMasterclassItem(item) {
  const title = repairText(item && (item.title || item.name) || '').toLowerCase();
  return !!(item && (
    item.isMasterclass ||
    item.masterclass_id ||
    item.masterclassId ||
    title.includes('майстер') ||
    title.includes('мастер') ||
    title.includes('masterclass')
  ));
}

function isDigitalOrder(order) {
  const items = Array.isArray(order && order.items) ? order.items : [];
  if (!items.length) return false;
  return items.every(item => {
    const title = repairText(item && (item.title || item.name) || '').toLowerCase();
    return item && (
      item.isCertificate ||
      Number(item.certificateStars) > 0 ||
      title.includes('сертифікат') ||
      title.includes('сертификат') ||
      isMasterclassItem(item)
    );
  });
}

function getPaymentInfo(order) {
  const history = Array.isArray(order.history) ? order.history : [];
  const paymentEntry = [...history].reverse().find(entry => isPaymentStatus(entry.status));
  const state = paymentStateFromStatus(paymentEntry?.status || order.status);
  const labels = {
    paid: 'Оплату підтверджено',
    cancelled: 'Оплату скасовано',
    pending: 'Очікує підтвердження'
  };
  const descriptions = {
    paid: 'Замовлення можна готувати до виконання або відправлення.',
    cancelled: 'Оплата не підтверджена, замовлення потребує уваги.',
    pending: 'Підтвердіть оплату після перевірки платежу.'
  };

  return {
    state,
    label: labels[state],
    description: descriptions[state],
    date: paymentEntry ? formatOrderDate(paymentEntry.ts) : '',
    by: paymentEntry?.by || ''
  };
}

function renderPaymentPanel(payment) {
  return `
    <div class="order-section payment-section payment-${payment.state}">
      ${payment.state === 'pending' ? `
        <div class="payment-urgent-alert">
          <strong>Терміново підтвердіть оплату</strong>
          <span>Замовлення очікує вашого рішення. Після підтвердження покупець отримає повідомлення.</span>
        </div>
      ` : ''}
      <div class="payment-head">
        <div>
          <h4>Оплата</h4>
          <p>${escapeHtml(payment.description)}</p>
        </div>
        <span class="payment-badge">${escapeHtml(payment.label)}</span>
      </div>
      <div class="payment-meta">
        <span>${payment.date ? `Оновлено: ${escapeHtml(payment.date)}` : 'Підтвердження ще не було'}</span>
        ${payment.by ? `<span>Адмін: ${escapeHtml(payment.by)}</span>` : ''}
      </div>
      <div class="payment-actions">
        <button id="confirmPayment" class="primary-btn" type="button">Підтвердити оплату</button>
        <button id="cancelPayment" class="danger-btn" type="button">Скасувати оплату</button>
      </div>
    </div>
  `;
}

function renderInfoTile(label, value) {
  return `
    <div class="order-info-tile">
      <span>${label}</span>
      <strong>${escapeHtml(value || 'Не вказано')}</strong>
    </div>
  `;
}

function showOrder(id) {
  const canEditOrder = ordersViewMode === 'active' && ordersData[id];
  const order = canEditOrder ? ordersData[id] : orderHistoryData[id];
  if (!order) return;
  currentOrderId = id;
  document.querySelectorAll('#ordersList .entity-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === String(id));
  });
  const summary = getOrderSummary(order);
  const items = getOrderItems(order);
  const history = Array.isArray(order.history) ? order.history : [];
  const payment = getPaymentInfo(order);
  const digitalOrder = isDigitalOrder(order);
  const statusOptions = digitalOrder
    ? ['виконано', 'скасовано']
    : ['нове','оплачено','виготовляється','відправлено','виконано','скасовано'];
  const archivedMeta = !canEditOrder
    ? `
      <div class="order-archive-note">
        <strong>${order.active ? 'Запис з історії' : 'Архівне замовлення'}</strong>
        <span>${order.archived_at ? `В архіві з ${escapeHtml(formatOrderDate(order.archived_at))}` : 'Цей запис відкрито з історії замовлень.'}</span>
      </div>
    `
    : '';

  $('orderDetails').innerHTML = `
    <div class="order-card">
      ${archivedMeta}
      <div class="order-card-head">
        <div>
          <span class="order-label">Замовлення</span>
          <h3>#${escapeHtml(summary.id)}</h3>
        </div>
        <span class="order-status-pill">${escapeHtml(summary.status)}</span>
      </div>

      <div class="order-summary-grid">
        ${renderInfoTile('Клієнт', summary.customer)}
        ${renderInfoTile('Сума товарів', `₴${summary.total || 0}`)}
        ${renderInfoTile('Використано бонусів', `${summary.starsUsed || 0} ⭐`)}
        ${renderInfoTile('До сплати', `₴${summary.finalTotal || 0}`)}
        ${renderInfoTile('Дата', summary.created)}
        ${renderInfoTile('Telegram', summary.telegram)}
        ${renderInfoTile('Місто', summary.city)}
        ${renderInfoTile('Доставка', summary.delivery)}
        ${summary.department ? renderInfoTile('Відділення', summary.department) : ''}
        ${summary.payment ? renderInfoTile('Оплата', summary.payment) : ''}
      </div>

      <div class="order-section">
        <h4>Товари</h4>
        <div class="order-items-list">
          ${items.map((item, index) => `
            <div class="order-item-row">
              <div class="order-item-index">${index + 1}</div>
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                ${item.details.length ? `<small>${item.details.map(detail => escapeHtml(detail)).join('<br>')}</small>` : ''}
              </div>
            </div>
          `).join('') || '<div class="muted">Товари не вказані</div>'}
        </div>
      </div>

      ${canEditOrder && payment.state === 'pending' ? renderPaymentPanel(payment) : ''}

      ${canEditOrder ? `
        <div class="order-section">
          <h4>Статус замовлення</h4>
          <div class="field order-status-control">
            <span>Поточний статус</span>
            <select id="orderStatus">
              ${statusOptions.map(status =>
                `<option value="${status}" ${status === order.status || status === summary.status ? 'selected' : ''}>${status}</option>`
              ).join('')}
            </select>
            ${digitalOrder ? '<small>Для цифрових товарів доступні лише два стани: виконано або скасовано.</small>' : ''}
          </div>
          <div class="form-actions">
            <button id="saveOrderStatus" class="primary-btn" type="button">Зберегти статус</button>
            <button id="deleteOrder" class="danger-btn" type="button">Видалити</button>
          </div>
        </div>
      ` : ''}

      <div class="order-section">
        <h4>Історія</h4>
        <div class="order-history">
          ${history.map(entry => `
            <div class="order-history-row">
              <span>${escapeHtml(formatOrderDate(entry.ts))}</span>
              <strong>${escapeHtml(repairText(entry.status || ''))}</strong>
              ${entry.by ? `<small>Адмін: ${escapeHtml(entry.by)}</small>` : ''}
            </div>
          `).join('') || '<div class="muted">Історії поки немає</div>'}
        </div>
      </div>

      <details class="order-raw">
        <summary>Показати технічні дані</summary>
        <pre>${escapeHtml(JSON.stringify(order, null, 2))}</pre>
      </details>
    </div>
  `;
  if (!canEditOrder) return;
  const updateOrderStatus = async (status) => {
    const updated = await apiFetch(`${API}/orders/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    if (updated && updated.bonus && updated.bonus.starsAdded > 0) {
      setStatus(`Оплату підтверджено. Покупцю нараховано +${updated.bonus.starsAdded} зірок`);
      if (typeof window.siteNotify === 'function') {
        window.siteNotify(`Оплату підтверджено. Покупець отримає повідомлення, нараховано +${updated.bonus.starsAdded} зірок.`, { type: 'success' });
      }
    } else if (updated && updated.bonus && updated.bonus.alreadyConfirmed) {
      setStatus('Оплату підтверджено. Бонуси вже були нараховані раніше');
      if (typeof window.siteNotify === 'function') {
        window.siteNotify('Оплату підтверджено. Покупець отримає повідомлення.', { type: 'success' });
      }
    } else if (updated && updated.bonus && updated.bonus.reason) {
      setStatus('Статус збережено. Не знайшов привʼязане бонусне підтвердження для цього замовлення');
    } else {
      setStatus('Статус замовлення збережено');
      if (paymentStateFromStatus(status) === 'paid' && typeof window.siteNotify === 'function') {
        window.siteNotify('Оплату підтверджено. Покупець отримає повідомлення.', { type: 'success' });
      }
    }
    await loadOrders();
    if (updated && updated.archived) {
      ordersViewMode = 'history';
      renderOrders();
      showOrder(id);
      return;
    }
    showOrder(id);
  };
  if ($('confirmPayment')) $('confirmPayment').addEventListener('click', () => updateOrderStatus(digitalOrder ? 'виконано' : 'оплачено'));
  if ($('cancelPayment')) {
    $('cancelPayment').addEventListener('click', async () => {
      if (!confirm('Скасувати оплату і видалити це замовлення зі списку?')) return;
      await apiFetch(`${API}/orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
      $('orderDetails').textContent = 'Оберіть замовлення';
      currentOrderId = null;
      await loadOrders();
      setStatus('Оплату скасовано, замовлення перенесено в історію');
    });
  }
  $('saveOrderStatus').addEventListener('click', async () => {
    await updateOrderStatus($('orderStatus').value);
  });
  $('deleteOrder').addEventListener('click', async () => {
    if (!confirm('Видалити замовлення?')) return;
    await apiFetch(`${API}/orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
    $('orderDetails').textContent = 'Оберіть замовлення';
    currentOrderId = null;
    await loadOrders();
    setStatus('Замовлення перенесено в історію');
  });
}

function userDisplayName(user) {
  return repairText([user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.email || `User ${user.id}`);
}

function userInitial(user) {
  return (userDisplayName(user).trim()[0] || 'U').toUpperCase();
}

function userGradient(name) {
  const palettes = [
    ['#FFD8C2', '#FFF2B8'],
    ['#D9F2E6', '#BEE3F8'],
    ['#F9D5E5', '#E6D8FF'],
    ['#FFE4B8', '#D8F3DC'],
    ['#DCEBFF', '#FFE0E0'],
    ['#F6E6C8', '#CDE7D8']
  ];
  let hash = 0;
  for (const char of String(name || 'user')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const pair = palettes[Math.abs(hash) % palettes.length];
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

function userTelegramValue(user) {
  return repairText(user.telegram || '').trim();
}

function userTelegramHref(value) {
  const text = repairText(value || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  const handle = text.replace(/^@/, '').replace(/^t\.me\//i, '').replace(/^https?:\/\/t\.me\//i, '').trim();
  return handle ? `https://t.me/${encodeURIComponent(handle)}` : '';
}

function userRoleBadge(user) {
  return user.isAdmin ? '<span class="user-role-badge is-admin">Адмін</span>' : '<span class="user-role-badge">Клієнт</span>';
}

async function loadUsers() {
  usersData = await apiFetch(`${API}/users`);
  usersData = Array.isArray(usersData) ? usersData : [];
  renderUsersList();
  if (currentUserId && usersData.some(user => String(user.id) === String(currentUserId))) {
    showUser(currentUserId);
  } else {
    currentUserId = null;
    $('userDetails').textContent = 'Оберіть користувача';
  }
}

function renderUsersList() {
  const query = repairText($('userSearch')?.value || '').trim().toLowerCase();
  const rows = usersData.filter(user => {
    const text = [user.id, user.username, user.email, user.firstName, user.lastName, user.phone, user.telegram]
      .map(value => repairText(value || '').toLowerCase()).join(' ');
    return !query || text.includes(query);
  });
  if ($('usersListMeta')) $('usersListMeta').textContent = `${rows.length} з ${usersData.length} користувачів`;
  $('usersList').innerHTML = rows.map(user => {
    const name = userDisplayName(user);
    return `
      <button class="entity-item user-list-card ${String(user.id) === String(currentUserId) ? 'active' : ''}" data-id="${escapeHtml(user.id)}" type="button">
        <span class="user-mini-avatar" style="background:${escapeHtml(userGradient(name))}">${escapeHtml(userInitial(user))}</span>
        <span class="user-list-copy">
          <strong>${escapeHtml(name)}</strong>
          <small>${escapeHtml(user.email || user.username || '')}</small>
          <span class="user-role-row">${userRoleBadge(user)}</span>
        </span>
      </button>
    `;
  }).join('') || '<div class="orders-empty-state muted">Користувачів не знайдено</div>';
  document.querySelectorAll('#usersList .user-list-card').forEach(btn => {
    btn.addEventListener('click', () => showUser(btn.dataset.id));
  });
}

function showUser(id) {
  const user = usersData.find(item => String(item.id) === String(id));
  if (!user) return;
  currentUserId = user.id;
  document.querySelectorAll('#usersList .user-list-card').forEach(btn => {
    btn.classList.toggle('active', String(btn.dataset.id) === String(id));
  });
  const name = userDisplayName(user);
  const telegram = userTelegramValue(user);
  const telegramHref = userTelegramHref(telegram);
  $('userEditorTitle').textContent = `Користувач #${user.id}`;
  $('userDetails').innerHTML = `
    <div class="user-profile-card">
      <div class="user-profile-head">
        <span class="user-big-avatar" style="background:${escapeHtml(userGradient(name))}">${escapeHtml(userInitial(user))}</span>
        <div>
          <h4>${escapeHtml(name)}</h4>
          <div class="user-role-row">${userRoleBadge(user)}</div>
        </div>
      </div>
      <div class="field-grid user-field-grid">
        <label class="field"><span>Логін</span><input data-user-key="username" value="${escapeHtml(user.username || '')}"></label>
        <label class="field"><span>Email</span><input data-user-key="email" type="email" value="${escapeHtml(user.email || '')}"></label>
        <label class="field"><span>Імʼя</span><input data-user-key="firstName" value="${escapeHtml(user.firstName || '')}"></label>
        <label class="field"><span>Прізвище</span><input data-user-key="lastName" value="${escapeHtml(user.lastName || '')}"></label>
        <label class="field"><span>Телефон</span><input data-user-key="phone" value="${escapeHtml(user.phone || '')}"></label>
        <label class="field"><span>Telegram</span><input data-user-key="telegram" value="${escapeHtml(telegram)}" placeholder="@username"></label>
        <label class="field full"><span>Адреса</span><input data-user-key="address" value="${escapeHtml(user.address || '')}"></label>
        <label class="field"><span>Пароль</span><input type="text" value="••••••••" disabled></label>
        <div class="field user-stars-field">
          <span>Зірок</span>
          <div class="user-stars-control">
            <button class="ghost-btn quick-stars" data-delta="-10" type="button">-10</button>
            <input data-user-key="bonusStars" type="number" min="0" value="${escapeHtml(user.bonusStars || 0)}">
            <button class="ghost-btn quick-stars" data-delta="10" type="button">+10</button>
          </div>
        </div>
      </div>
      <div class="user-meta-grid">
        <div>${telegramHref ? `<a href="${escapeHtml(telegramHref)}" target="_blank" rel="noopener">Відкрити Telegram</a>` : '<span class="muted">Telegram не вказано</span>'}</div>
        <div><span>Остання активність:</span> <strong>${escapeHtml(formatCertificateDate(user.last_activity || user.created_at))}</strong></div>
        <div><span>Створено:</span> <strong>${escapeHtml(formatCertificateDate(user.created_at))}</strong></div>
      </div>
      <div class="form-actions user-actions">
        <button id="saveUserBtn" class="primary-btn" type="button">Зберегти</button>
        <button id="resetUserPasswordBtn" class="ghost-btn" type="button">Скинути/Змінити пароль</button>
        <button id="userOrderHistoryBtn" class="ghost-btn" type="button">Історія замовлень</button>
      </div>
    </div>
  `;
  $('saveUserBtn').addEventListener('click', saveCurrentUser);
  $('resetUserPasswordBtn').addEventListener('click', resetCurrentUserPassword);
  $('userOrderHistoryBtn').addEventListener('click', openUserOrderHistory);
  document.querySelectorAll('.quick-stars').forEach(btn => {
    btn.addEventListener('click', () => adjustCurrentUserStars(Number(btn.dataset.delta) || 0));
  });
}

function collectUserFormData() {
  const data = {};
  document.querySelectorAll('#userDetails [data-user-key]').forEach(input => {
    data[input.dataset.userKey] = input.type === 'number' ? Number(input.value || 0) : input.value.trim();
  });
  data.bonusStars = Math.max(0, Number(data.bonusStars || 0));
  return data;
}

async function saveCurrentUser() {
  if (!currentUserId) return;
  await apiFetch(`${API}/users/${encodeURIComponent(currentUserId)}`, {
    method: 'PUT',
    body: JSON.stringify(collectUserFormData())
  });
  await loadUsers();
  setStatus('Користувача збережено');
}

async function resetCurrentUserPassword() {
  if (!currentUserId) return;
  const nextPassword = prompt('Введіть новий пароль мінімум 6 символів');
  if (nextPassword === null) return;
  if (nextPassword.trim().length < 6) {
    setStatus('Пароль має містити мінімум 6 символів', true);
    return;
  }
  await apiFetch(`${API}/users/${encodeURIComponent(currentUserId)}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password: nextPassword.trim() })
  });
  setStatus('Пароль змінено');
}

async function adjustCurrentUserStars(delta) {
  if (!currentUserId || !delta) return;
  const input = document.querySelector('#userDetails [data-user-key="bonusStars"]');
  const next = Math.max(0, (Number(input?.value || 0) || 0) + delta);
  if (input) input.value = next;
  await saveCurrentUser();
}

async function openUserOrderHistory() {
  if (!currentUserId) return;
  const user = usersData.find(item => String(item.id) === String(currentUserId));
  await showSection('orders');
  ordersViewMode = 'history';
  await loadOrders();
  const searchValue = user ? (user.email || userDisplayName(user) || String(user.id)) : String(currentUserId);
  if ($('orderSearch')) $('orderSearch').value = searchValue;
  renderOrders();
  setStatus(`Показано історію замовлень: ${searchValue}`);
}

async function deleteCurrentUser() {
  if (!currentUserId) return;
  const user = usersData.find(item => String(item.id) === String(currentUserId));
  if (!confirm(`Are you sure? Видалити користувача ${userDisplayName(user || {})}?`)) return;
  await apiFetch(`${API}/users/${encodeURIComponent(currentUserId)}`, { method: 'DELETE' });
  currentUserId = null;
  await loadUsers();
  setStatus('Користувача видалено');
}

async function loadReviewsAdmin() {
  const [reviews, products, masterclasses] = await Promise.all([
    apiFetch(`${API}/data/reviews`),
    apiFetch(`${API}/data/products`),
    apiFetch(`${API}/data/masterclasses`)
  ]);
  reviewsData = reviews || {};
  reviewProducts = Array.isArray(products) ? products : [];
  reviewMasterclasses = Array.isArray(masterclasses) ? masterclasses : [];
  renderReviewProductOptions();
  resetReviewEditor(false);
  renderReviewsAdmin();
}

function reviewProductOptions() {
  const rows = [
    ...reviewProducts.map((item, index) => ({
      title: repairText(item.title || `Товар ${index + 1}`),
      type: 'product',
      image: productPreview(item),
      meta: [repairText(item.category || ''), item.price ? `₴${item.price}` : ''].filter(Boolean).join(' · ') || 'Товар'
    })),
    ...reviewMasterclasses.map((item, index) => ({
      title: repairText(item.title || `Майстер-клас ${index + 1}`),
      type: 'masterclass',
      image: masterclassPreview(item),
      meta: [item.price ? `₴${item.price}` : '', repairText(item.duration || ''), repairText(item.level || '')].filter(Boolean).join(' · ') || 'Майстер-клас'
    }))
  ];
  Object.keys(reviewsData || {}).forEach(title => {
    const clean = repairText(title || '').trim();
    if (clean && !rows.some(item => item.title === clean)) {
      rows.push({ title: clean, type: 'reviewed', image: 'images/reklama.png', meta: 'Є відгуки' });
    }
  });
  return rows;
}

function renderReviewProductOptions() {
  const select = $('reviewProductSelect');
  const options = reviewProductOptions();
  const optionMarkup = options.map(item => `
    <option value="${escapeHtml(item.title)}">${escapeHtml(item.type === 'masterclass' ? 'Майстер-клас' : 'Товар')}: ${escapeHtml(item.title)}</option>
  `).join('');
  if (select) {
    const currentValue = selectedReviewRef?.title || reviewProductFilter || select.value;
    select.innerHTML = optionMarkup || '<option value="">Немає товарів</option>';
    if (currentValue && Array.from(select.options).some(option => option.value === currentValue)) {
      select.value = currentValue;
    }
  }
  const filterSelect = $('reviewProductFilterSelect');
  if (filterSelect) {
    filterSelect.value = reviewProductFilter;
    renderReviewComboboxMenu(filterSelect.value || '');
  }
}

function findReviewProduct(title) {
  const clean = repairText(title || '');
  return reviewProductOptions().find(item => item.title === clean) || { title: clean, image: 'images/reklama.png', type: 'product' };
}

function flattenReviews() {
  return Object.entries(reviewsData || {}).flatMap(([title, list]) =>
    (Array.isArray(list) ? list : []).map((review, index) => ({ title, review, index }))
  );
}

function resolveReviewTitleKey(value) {
  const clean = repairText(value || '').trim();
  if (!clean) return '';
  const keys = Object.keys(reviewsData || {});
  return keys.find(title => title === value || repairText(title) === clean) || clean;
}

function ensureReviewProductTools() {
  if ($('reviewProductTools')) return;
  const panel = document.querySelector('#reviewsSection .reviews-panel');
  if (!panel) return;
  const tools = document.createElement('div');
  tools.id = 'reviewProductTools';
  tools.className = 'review-product-tools';
  tools.innerHTML = `
    <label class="review-product-search">
      <span>Оберіть товар для перегляду відгуків</span>
      <div id="reviewProductCombobox" class="review-combobox">
        <span class="review-combobox-search" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>
        </span>
        <input id="reviewProductFilterSelect" class="review-combobox-input" type="text" placeholder="Оберіть товар для перегляду відгуків" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="reviewProductComboboxMenu">
        <button id="reviewProductComboboxToggle" class="review-combobox-toggle" type="button" aria-label="Відкрити список">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div id="reviewProductComboboxMenu" class="review-combobox-menu" role="listbox"></div>
      </div>
    </label>
    <button id="deleteLowRatingReviewsBtn" class="danger-btn" type="button">Видалити всі відгуки нижче 4 зірок</button>
  `;
  const filters = document.querySelector('#reviewsSection .review-filters');
  (filters || panel.querySelector('.reviews-admin-head')).insertAdjacentElement('afterend', tools);
  $('reviewProductFilterSelect').addEventListener('input', (event) => {
    renderReviewComboboxMenu(event.target.value || '');
    openReviewCombobox();
  });
  $('reviewProductFilterSelect').addEventListener('focus', () => {
    renderReviewComboboxMenu($('reviewProductFilterSelect').value || '');
    openReviewCombobox();
  });
  $('reviewProductComboboxToggle').addEventListener('click', () => {
    if ($('reviewProductCombobox').classList.contains('is-open')) closeReviewCombobox();
    else {
      $('reviewProductFilterSelect').focus();
      renderReviewComboboxMenu($('reviewProductFilterSelect').value || '');
      openReviewCombobox();
    }
  });
  document.addEventListener('click', (event) => {
    if (!$('reviewProductCombobox')?.contains(event.target)) closeReviewCombobox();
  });
  $('deleteLowRatingReviewsBtn').addEventListener('click', deleteLowRatingReviews);
}

function openReviewCombobox() {
  $('reviewProductCombobox')?.classList.add('is-open');
  $('reviewProductFilterSelect')?.setAttribute('aria-expanded', 'true');
}

function closeReviewCombobox() {
  $('reviewProductCombobox')?.classList.remove('is-open');
  $('reviewProductFilterSelect')?.setAttribute('aria-expanded', 'false');
}

function selectReviewProductFromCombobox(title) {
  reviewProductFilter = title;
  selectedReviewRef = null;
  if ($('reviewProductFilterSelect')) $('reviewProductFilterSelect').value = title;
  closeReviewCombobox();
  resetReviewEditor(false);
  renderReviewsAdmin();
}

function renderReviewComboboxMenu(query = '') {
  const menu = $('reviewProductComboboxMenu');
  if (!menu) return;
  const normalized = repairText(query).trim().toLowerCase();
  const options = reviewProductOptions().filter(item => {
    const text = `${item.title} ${item.meta || ''}`.toLowerCase();
    return !normalized || text.includes(normalized);
  });
  menu.innerHTML = options.map(item => `
    <button class="review-combobox-option ${item.title === reviewProductFilter ? 'active' : ''}" type="button" role="option" data-title="${encodeURIComponent(item.title)}">
      <img src="${escapeHtml(item.image)}" alt="" onerror="this.src='images/reklama.png'">
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.meta || (item.type === 'masterclass' ? 'Майстер-клас' : 'Товар'))}</small>
      </span>
    </button>
  `).join('') || '<div class="review-combobox-empty">Нічого не знайдено</div>';
  menu.querySelectorAll('.review-combobox-option').forEach(option => {
    option.addEventListener('click', () => selectReviewProductFromCombobox(decodeURIComponent(option.dataset.title || '')));
  });
}

function isReviewPublished(review) {
  return review && review.published !== false;
}

function reviewStarsMarkup(rating) {
  const value = Math.max(1, Math.min(5, Number(rating) || 0));
  return Array.from({ length: 5 }, (_, index) => `<span class="${index < value ? 'is-filled' : ''}">★</span>`).join('');
}

function reviewExcerpt(text) {
  return repairText(text || '').split(/\s+/).slice(0, 22).join(' ');
}

function renderReviewsAdmin() {
  $('reviewsSection')?.classList.add('reviews-moderation-section');
  ensureReviewProductTools();
  renderReviewProductOptions();
  const selectedTitle = reviewProductFilter || '';
  const selectedTitleKey = resolveReviewTitleKey(selectedTitle);
  const rows = selectedTitle
    ? flattenReviews().filter(({ title }) => title === selectedTitleKey)
      .sort((a, b) => new Date(b.review.date || 0) - new Date(a.review.date || 0))
    : [];
  if ($('reviewsListMeta')) {
    $('reviewsListMeta').textContent = selectedTitle ? `${rows.length} відгуків` : 'Оберіть товар';
  }
  if ($('deleteLowRatingReviewsBtn')) {
    const lowCount = rows.filter(({ review }) => Number(review.rating || 0) < 4).length;
    $('deleteLowRatingReviewsBtn').disabled = !selectedTitle || lowCount === 0;
    $('deleteLowRatingReviewsBtn').textContent = `Видалити всі відгуки нижче 4 зірок${lowCount ? ` (${lowCount})` : ''}`;
  }

  if (!selectedTitle) {
    $('reviewsList').innerHTML = `
      <div class="reviews-empty-state">
        <span aria-hidden="true">★</span>
        <strong>Оберіть товар для перегляду відгуків</strong>
        <p>Після вибору тут одразу зʼявляться всі відгуки на нього.</p>
      </div>
    `;
    return;
  }

  $('reviewsList').innerHTML = rows.map(renderReviewModerationCard).join('') || `
    <div class="reviews-empty-state">
      <span aria-hidden="true">✉</span>
      <strong>На цей товар ще немає відгуків</strong>
    </div>
  `;

  bindReviewModerationCards();
}

function formatReviewDate(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderReviewModerationCard({ title, review, index }) {
  const product = findReviewProduct(title);
  const reply = repairText(review.adminReply || review.reply || '');
  return `
    <article class="review-moderation-card" data-title="${encodeURIComponent(title)}" data-index="${index}">
      <div class="review-moderation-media">
        <img src="${escapeHtml(product.image)}" alt="" onerror="this.src='images/reklama.png'">
      </div>
      <div class="review-moderation-body">
        <header class="review-moderation-head">
          <div>
            <strong>${escapeHtml(repairText(review.user || 'Користувач'))}</strong>
            <span>${escapeHtml(formatReviewDate(review.date))}</span>
          </div>
          <div class="review-admin-stars">${reviewStarsMarkup(review.rating)}</div>
          <button class="icon-action-btn danger delete-review-inline" type="button" title="Видалити" aria-label="Видалити відгук">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/></svg>
          </button>
        </header>
        <label class="review-inline-field">
          <span>Текст відгуку</span>
          <textarea class="review-inline-comment" rows="3">${escapeHtml(repairText(review.comment || ''))}</textarea>
        </label>
        <div class="review-inline-row">
          <button class="ghost-btn save-review-text" type="button">Змінити текст</button>
        </div>
        <label class="review-inline-field">
          <span>Ваша відповідь адміністратора</span>
          <textarea class="review-inline-reply" rows="3" placeholder="Ваша відповідь адміністратора">${escapeHtml(reply)}</textarea>
        </label>
        <div class="review-inline-row">
          <button class="primary-btn send-review-reply" type="button">Надіслати</button>
        </div>
      </div>
    </article>
  `;
}

function reviewModerationCardRef(card) {
  return {
    title: decodeURIComponent(card.dataset.title || ''),
    index: Number(card.dataset.index)
  };
}

async function updateReviewInline(title, index, patch, statusMessage) {
  const review = reviewsData?.[title]?.[index];
  if (!review) return;
  await apiFetch(`${API}/reviews/${encodeURIComponent(title)}/${index}`, {
    method: 'PUT',
    body: JSON.stringify({ ...review, title, ...patch })
  });
  await loadReviewsAdmin();
  setStatus(statusMessage);
}

function bindReviewModerationCards() {
  document.querySelectorAll('.review-moderation-card').forEach(card => {
    card.querySelector('.save-review-text')?.addEventListener('click', async () => {
      const { title, index } = reviewModerationCardRef(card);
      const comment = card.querySelector('.review-inline-comment')?.value.trim() || '';
      if (!comment) {
        setStatus('Текст відгуку не може бути порожнім', true);
        return;
      }
      await updateReviewInline(title, index, { comment }, 'Текст відгуку оновлено');
    });
    card.querySelector('.send-review-reply')?.addEventListener('click', async () => {
      const { title, index } = reviewModerationCardRef(card);
      const adminReply = card.querySelector('.review-inline-reply')?.value.trim() || '';
      await updateReviewInline(title, index, { adminReply }, adminReply ? 'Відповідь надіслано' : 'Відповідь очищено');
    });
    card.querySelector('.delete-review-inline')?.addEventListener('click', async () => {
      const { title, index } = reviewModerationCardRef(card);
      if (!confirm('Видалити цей відгук?')) return;
      await apiFetch(`${API}/reviews/${encodeURIComponent(title)}/${index}`, { method: 'DELETE' });
      selectedReviewRef = null;
      resetReviewEditor(false);
      await loadReviewsAdmin();
      setStatus('Відгук видалено');
    });
  });
}

function renderReviewStarsInput() {
  const root = $('reviewRatingStars');
  if (!root) return;
  root.innerHTML = Array.from({ length: 5 }, (_, index) => {
    const value = index + 1;
    return `<button class="${value <= reviewEditorRating ? 'active' : ''}" data-rating="${value}" type="button" aria-label="${value} з 5">★</button>`;
  }).join('');
  root.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      reviewEditorRating = Number(btn.dataset.rating) || 5;
      renderReviewStarsInput();
    });
  });
}

function resetReviewEditor(clearSelection = true) {
  if (clearSelection) selectedReviewRef = null;
  reviewEditorRating = 5;
  if ($('reviewEditorTitle')) $('reviewEditorTitle').textContent = 'Додати відгук';
  if ($('reviewProductSelect') && $('reviewProductSelect').options.length) $('reviewProductSelect').selectedIndex = 0;
  if ($('reviewProductSelect') && reviewProductFilter) $('reviewProductSelect').value = reviewProductFilter;
  if ($('reviewUserInput')) $('reviewUserInput').value = '';
  if ($('reviewCommentInput')) $('reviewCommentInput').value = '';
  if ($('reviewReplyInput')) $('reviewReplyInput').value = '';
  if ($('toggleReviewPublishBtn')) $('toggleReviewPublishBtn').textContent = 'Опублікувати';
  if ($('deleteSelectedReviewBtn')) $('deleteSelectedReviewBtn').disabled = true;
  renderReviewStarsInput();
}

function selectReview(title, index) {
  const review = reviewsData?.[title]?.[index];
  if (!review) return;
  selectedReviewRef = { title, index };
  reviewProductFilter = repairText(title);
  reviewEditorRating = Math.max(1, Math.min(5, Number(review.rating) || 5));
  $('reviewEditorTitle').textContent = 'Редагувати відгук';
  $('reviewProductSelect').value = title;
  $('reviewUserInput').value = repairText(review.user || '');
  $('reviewCommentInput').value = repairText(review.comment || '');
  $('reviewReplyInput').value = repairText(review.adminReply || review.reply || '');
  $('toggleReviewPublishBtn').textContent = isReviewPublished(review) ? 'Приховати' : 'Опублікувати';
  $('deleteSelectedReviewBtn').disabled = false;
  if ($('reviewProductFilterSelect')) $('reviewProductFilterSelect').value = reviewProductFilter;
  renderReviewStarsInput();
  renderReviewsAdmin();
}

function reviewPayloadFromForm() {
  return {
    title: $('reviewProductSelect').value,
    user: $('reviewUserInput').value.trim() || 'Користувач',
    rating: reviewEditorRating,
    comment: $('reviewCommentInput').value.trim(),
    adminReply: $('reviewReplyInput').value.trim(),
    published: selectedReviewRef ? isReviewPublished(reviewsData?.[selectedReviewRef.title]?.[selectedReviewRef.index]) : true
  };
}

async function saveAdminReview(event) {
  event.preventDefault();
  const payload = reviewPayloadFromForm();
  if (!payload.title || !payload.comment) return;
  if (selectedReviewRef) {
    const updated = await apiFetch(`${API}/reviews/${encodeURIComponent(selectedReviewRef.title)}/${selectedReviewRef.index}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    selectedReviewRef = { title: updated.title || payload.title, index: Number(updated.index || 0) };
  } else {
    await apiFetch(`${API}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
  await loadReviewsAdmin();
  setStatus('Відгук збережено');
}

async function toggleSelectedReviewPublish() {
  if (!selectedReviewRef) return;
  const review = reviewsData?.[selectedReviewRef.title]?.[selectedReviewRef.index];
  if (!review) return;
  await apiFetch(`${API}/reviews/${encodeURIComponent(selectedReviewRef.title)}/${selectedReviewRef.index}`, {
    method: 'PUT',
    body: JSON.stringify({ ...review, title: selectedReviewRef.title, published: !isReviewPublished(review) })
  });
  await loadReviewsAdmin();
  setStatus(isReviewPublished(review) ? 'Відгук приховано' : 'Відгук опубліковано');
}

async function deleteSelectedReview() {
  if (!selectedReviewRef) return;
  if (!confirm('Видалити відгук?')) return;
  await apiFetch(`${API}/reviews/${encodeURIComponent(selectedReviewRef.title)}/${selectedReviewRef.index}`, { method: 'DELETE' });
  resetReviewEditor();
  await loadReviewsAdmin();
  setStatus('Відгук видалено');
}

async function deleteLowRatingReviews() {
  const title = resolveReviewTitleKey(reviewProductFilter || $('reviewProductSelect')?.value || '');
  if (!title) {
    setStatus('Оберіть товар або майстер-клас', true);
    return;
  }
  const rows = flattenReviews().filter(({ title: rowTitle, review }) => rowTitle === title && Number(review.rating || 0) < 4);
  if (!rows.length) {
    setStatus('Немає відгуків нижче 4 зірок');
    return;
  }
  if (!confirm(`Видалити ${rows.length} відгук(и) нижче 4★ для "${repairText(title)}"?`)) return;
  const result = await apiFetch(`${API}/reviews/low-rating?title=${encodeURIComponent(title)}&threshold=4`, { method: 'DELETE' });
  selectedReviewRef = null;
  resetReviewEditor(false);
  await loadReviewsAdmin();
  setStatus(`Видалено ${result.removed || rows.length} відгук(и) нижче 4★`);
}

async function loadCertificates() {
  certificateRows = await apiFetch(`${API}/certificates`);
  renderCertificatesList();
}

function certificateRedeemerName(row) {
  return repairText(
    [row.redeemed_first_name, row.redeemed_last_name].filter(Boolean).join(' ') ||
    row.redeemed_username ||
    row.redeemed_email ||
    (row.redeemed_by_user ? `#${row.redeemed_by_user}` : '')
  );
}

function formatCertificateDate(value) {
  if (!value) return 'Не вказано';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? repairText(value) : date.toLocaleString('uk-UA');
}

function renderCertificatesList() {
  const query = repairText(certificateSearchQuery || '').trim().toLowerCase();
  const rows = (Array.isArray(certificateRows) ? certificateRows : []).filter(row => {
    if (!query) return true;
    return [
      row.code,
      row.title,
      row.redeemed_username,
      row.redeemed_email,
      row.redeemed_first_name,
      row.redeemed_last_name
    ].map(value => repairText(value || '').toLowerCase()).join(' ').includes(query);
  });
  $('certificatesList').innerHTML = rows.map(row => {
    const redeemed = !!row.redeemed_by_user;
    const active = Number(row.active == null ? 1 : row.active) === 1;
    return `
      <div class="entity-item certificate-item ${active ? '' : 'is-disabled'}">
        <div class="certificate-row-head">
          <div>
            <strong>${escapeHtml(row.code)}</strong>
            <small>${escapeHtml(row.title || 'Сертифікат')} · ${escapeHtml(row.stars)} зірок${row.expires_at ? ` · до ${escapeHtml(row.expires_at)}` : ''}</small>
          </div>
          <span class="cert-badge ${redeemed ? 'is-redeemed' : 'is-unused'}">${redeemed ? 'активовано' : 'не активовано'}</span>
        </div>
        ${redeemed ? `<p class="cert-redeem-info">Ким: ${escapeHtml(certificateRedeemerName(row))} | ${escapeHtml(formatCertificateDate(row.redeemed_at))}</p>` : ''}
        <div class="certificate-actions">
          <label class="cert-toggle">
            <input class="toggle-cert-active" data-code="${escapeHtml(row.code)}" type="checkbox" ${active ? 'checked' : ''}>
            <span></span>
            <b>${active ? 'Активний' : 'Заморожено'}</b>
          </label>
          <button class="danger-btn delete-cert" data-code="${escapeHtml(row.code)}" type="button">Видалити</button>
        </div>
      </div>
    `;
  }).join('') || '<div class="muted">Сертифікатів немає</div>';
  document.querySelectorAll('.delete-cert').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Видалити сертифікат?')) return;
      await apiFetch(`${API}/certificates/${encodeURIComponent(btn.dataset.code)}`, { method: 'DELETE' });
      await loadCertificates();
    });
  });
  document.querySelectorAll('.toggle-cert-active').forEach(input => {
    input.addEventListener('change', async () => {
      await apiFetch(`${API}/certificates/${encodeURIComponent(input.dataset.code)}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: input.checked })
      });
      await loadCertificates();
      setStatus(input.checked ? 'Сертифікат активовано' : 'Сертифікат деактивовано');
    });
  });
}

async function createCertificate(event) {
  event.preventDefault();
  const payload = {
    code: $('certCode').value,
    stars: Number($('certStars').value) || 0,
    title: $('certTitle').value,
    expires_at: $('certExpiresAt')?.value || ''
  };
  try {
    await apiFetch(`${API}/certificates`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    $('certificateForm').reset();
    $('certStars').value = 10;
    await loadCertificates();
    setStatus('Сертифікат створено');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function generateCertificateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const parts = [];
  for (let group = 0; group < 3; group += 1) {
    let part = '';
    for (let i = 0; i < 4; i += 1) {
      part += chars[Math.floor(Math.random() * chars.length)];
    }
    parts.push(part);
  }
  $('certCode').value = parts.join('-');
}

async function loadAdminPromoCodes() {
  if (!$('adminPromoList')) return;
  const rows = await apiFetch(`${API}/admin-promo-codes`);
  $('adminPromoList').innerHTML = rows.map(row => `
    <div class="entity-item">
      <strong>${escapeHtml(row.code)}</strong>
      <small>${escapeHtml(row.title || 'Admin access')} · ${row.redeemed_by_user ? `активовано користувачем #${escapeHtml(row.redeemed_by_user)}` : 'не активовано'}</small>
      <div class="form-actions">
        <button class="ghost-btn copy-admin-promo" data-code="${escapeHtml(row.code)}" type="button">Копіювати</button>
        <button class="danger-btn delete-admin-promo" data-code="${escapeHtml(row.code)}" type="button">Видалити</button>
      </div>
    </div>
  `).join('') || '<div class="muted">Промокодів ще немає</div>';

  document.querySelectorAll('.copy-admin-promo').forEach(btn => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.code || '');
      setStatus('Промокод скопійовано');
    });
  });

  document.querySelectorAll('.delete-admin-promo').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Видалити промокод адміністратора?')) return;
      await apiFetch(`${API}/admin-promo-codes/${encodeURIComponent(btn.dataset.code)}`, { method: 'DELETE' });
      await loadAdminPromoCodes();
    });
  });
}

async function createAdminPromoCode() {
  try {
    const row = await apiFetch(`${API}/admin-promo-codes`, {
      method: 'POST',
      body: JSON.stringify({ title: 'Admin access' })
    });
    await loadAdminPromoCodes();
    if (row && row.code) {
      await navigator.clipboard.writeText(row.code);
      setStatus('Промокод адміністратора створено і скопійовано');
    }
  } catch (error) {
    setStatus(error.message, true);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  initSharedStoreHeader();
  decorateSidebarHeader();
  decorateAdminTabs();
  $('adminGateForm')?.addEventListener('submit', activateAdminGate);
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
  });
  $('mobileAdminSection')?.addEventListener('change', event => showSection(event.target.value));
  $('refreshBtn').addEventListener('click', loadCurrentSection);
  $('newItemBtn').addEventListener('click', () => selectItem(null, null));
  $('deleteItemBtn').addEventListener('click', deleteEntity);
  $('resetEditorBtn').addEventListener('click', () => selectItem(currentItem, currentItemId));
  $('entityForm').addEventListener('submit', saveEntity);
  $('entitySearch').addEventListener('input', renderEntityList);
  $('orderSearch').addEventListener('input', renderOrders);
  $('orderStatusFilter')?.addEventListener('change', (event) => {
    orderStatusFilter = repairText(event.target.value || '').toLowerCase();
    currentOrderId = null;
    $('orderDetails').textContent = ordersViewMode === 'history' ? 'Оберіть запис з історії' : 'Оберіть замовлення';
    renderOrders();
  });
  $('orderKindFilter')?.addEventListener('change', (event) => {
    orderKindFilter = event.target.value || '';
    currentOrderId = null;
    $('orderDetails').textContent = ordersViewMode === 'history' ? 'Оберіть запис з історії' : 'Оберіть замовлення';
    renderOrders();
  });
  $('userSearch')?.addEventListener('input', renderUsersList);
  $('userForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveCurrentUser();
  });
  $('deleteUserBtn')?.addEventListener('click', deleteCurrentUser);
  $('activeOrdersTab').addEventListener('click', () => setOrdersViewMode('active'));
  $('orderHistoryTab').addEventListener('click', () => setOrdersViewMode('history'));
  $('deleteAllOrdersBtn').addEventListener('click', deleteAllOrders);
  $('clearOrderHistoryBtn').addEventListener('click', clearOrderHistory);
  $('reviewAdminForm')?.addEventListener('submit', saveAdminReview);
  $('newReviewBtn')?.addEventListener('click', () => {
    resetReviewEditor();
    renderReviewsAdmin();
  });
  $('toggleReviewPublishBtn')?.addEventListener('click', toggleSelectedReviewPublish);
  $('deleteSelectedReviewBtn')?.addEventListener('click', deleteSelectedReview);
  $('reviewProductSelect')?.addEventListener('change', (event) => {
    reviewProductFilter = event.target.value || '';
    selectedReviewRef = null;
    renderReviewsAdmin();
  });
  document.querySelectorAll('.review-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      reviewFilter = btn.dataset.reviewFilter || 'all';
      renderReviewsAdmin();
    });
  });
  $('certificateForm').addEventListener('submit', createCertificate);
  $('generateCertCodeBtn')?.addEventListener('click', generateCertificateCode);
  $('certificateSearch')?.addEventListener('input', (event) => {
    certificateSearchQuery = event.target.value;
    renderCertificatesList();
  });
  if ($('createAdminPromoBtn')) {
    $('createAdminPromoBtn').addEventListener('click', createAdminPromoCode);
  }
  $('chooseImageBtn').addEventListener('click', () => $('imageFileInput').click());
  $('imageFileInput').addEventListener('change', (event) => handleImageFiles(event.target.files));
  $('replaceImageInput').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (file && replaceImageIndex !== null) replaceImageFile(file, replaceImageIndex);
  });
  document.addEventListener('keydown', (event) => {
    const videoPlayer = document.getElementById('masterclassVideoPlayer');
    if (videoPlayer && videoPlayer.classList.contains('open')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMasterclassVideoPlayer();
      }
      return;
    }
    const lightbox = document.getElementById('adminImageLightbox');
    if (!lightbox || !lightbox.classList.contains('open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeImageLightbox();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      shiftImageLightbox(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      shiftImageLightbox(1);
    }
  });
  $('imageUploadBox').addEventListener('dragover', (event) => {
    event.preventDefault();
    $('imageUploadBox').classList.add('is-dragover');
  });
  $('imageUploadBox').addEventListener('dragleave', () => {
    $('imageUploadBox').classList.remove('is-dragover');
  });
  $('imageUploadBox').addEventListener('drop', (event) => {
    event.preventDefault();
    $('imageUploadBox').classList.remove('is-dragover');
    handleImageFiles(event.dataTransfer.files);
  });
  showSection('info');
});

