const SUPPORT_API = '/api/support';

const state = {
  isAdmin: false,
  threads: [],
  activeThreadId: null,
  pollTimer: null,
  user: null
};

const els = {
  chatsPanel: document.getElementById('chatsPanel'),
  chatMessages: document.getElementById('chatMessages'),
  messageInput: document.getElementById('messageInput'),
  sendMessage: document.getElementById('sendMessage'),
  dialogTitle: document.getElementById('dialogTitle'),
  dialogSubtitle: document.getElementById('dialogSubtitle'),
  dialogAvatar: document.getElementById('dialogAvatar'),
  clearNotifications: document.getElementById('clearNotificationsBtn')
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function threadName(thread) {
  if (!thread) return 'Клієнт';
  return [thread.firstName, thread.lastName].filter(Boolean).join(' ')
    || thread.username
    || thread.email
    || `Клієнт #${thread.user_id}`;
}

function initials(name) {
  return String(name || 'AL')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'AL';
}

function firstInitial(name) {
  return String(name || 'К').trim().charAt(0).toUpperCase() || 'К';
}

function clientGradient(seed) {
  const palettes = [
    ['#F2994A', '#F2C94C'],
    ['#8B5CF6', '#EC4899'],
    ['#14B8A6', '#84CC16'],
    ['#3B82F6', '#06B6D4'],
    ['#EF4444', '#F97316'],
    ['#A855F7', '#6366F1'],
    ['#10B981', '#22C55E'],
    ['#F59E0B', '#D946EF']
  ];
  const raw = String(seed || '');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  const pair = palettes[Math.abs(hash) % palettes.length];
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function renderThreads() {
  if (!els.chatsPanel) return;

  if (!state.isAdmin) {
    els.chatsPanel.innerHTML = `
      <button class="chat-item active" type="button" data-thread-id="${escapeHtml(state.activeThreadId || '')}">
        <img class="chat-avatar-img" src="images/avatar.png" alt="Art Light">
        <span>
          <strong>Служба підтримки Art Light</strong>
          <span>Питання щодо замовлень, оплат і товарів</span>
        </span>
      </button>
    `;
    return;
  }

  els.chatsPanel.innerHTML = state.threads.map(thread => {
    const name = threadName(thread);
    const active = Number(thread.id) === Number(state.activeThreadId);
    return `
      <button class="chat-item ${active ? 'active' : ''}" type="button" data-thread-id="${thread.id}">
        <span class="chat-avatar" style="background:${clientGradient(thread.user_id || thread.id)}">${escapeHtml(firstInitial(name))}</span>
        <span>
          <span class="chat-meta">
            <strong>${escapeHtml(name)}</strong>
            <span class="chat-time">${escapeHtml(formatTime(thread.last_message_at))}</span>
          </span>
          <span>${escapeHtml(thread.last_message || 'Новий діалог')}</span>
        </span>
      </button>
    `;
  }).join('') || '<div class="notice-empty">Поки немає клієнтських чатів.</div>';

  els.chatsPanel.querySelectorAll('[data-thread-id]').forEach(button => {
    button.addEventListener('click', () => selectThread(Number(button.dataset.threadId)));
  });
}

function renderMessages(messages) {
  if (!els.chatMessages) return;
  if (!messages.length) {
    els.chatMessages.innerHTML = '<div class="empty-dialog">Напишіть перше повідомлення, і тут зʼявиться історія діалогу.</div>';
    return;
  }

  els.chatMessages.innerHTML = messages.map(item => {
    const own = state.isAdmin ? item.sender_role === 'admin' : item.sender_role === 'user';
    return `
      <div class="message ${own ? 'user' : 'admin'}">
        ${escapeHtml(item.message)}
        <div class="message-info">${escapeHtml(formatTime(item.created_at))}</div>
      </div>
    `;
  }).join('');
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function notificationIcon(type) {
  if (type === 'order_created') return '#';
  if (type === 'payment_confirmed') return '₴';
  if (type === 'order_status') return '✓';
  if (type === 'bonus_added' || type === 'stars_added') return '⭐';
  if (type === 'certificate_issued') return '%';
  return '!';
}

function notificationTitle(item) {
  if (item.title) return fixNoticeText(item.title);
  if (item.payload && item.payload.title) return fixNoticeText(item.payload.title);
  if (item.type === 'payment_confirmed') return 'Оплату підтверджено';
  if (item.type === 'order_created') return state.isAdmin ? 'Нове замовлення' : 'Ви оформили замовлення!';
  if (item.type === 'order_status') return 'Статус замовлення оновлено';
  if (item.type === 'stars_added' || item.type === 'bonus_added') return 'Бонуси нараховано';
  if (item.type === 'certificate_issued') return 'Сертифікат готовий';
  return 'Повідомлення';
}

function fixNoticeText(value) {
  return typeof window.fixSiteMojibake === 'function'
    ? window.fixSiteMojibake(value)
    : String(value || '');
}

function normalizeNoticeText(item) {
  const payload = item.payload || {};
  if (item.type === 'order_created') {
    return state.isAdmin
      ? fixNoticeText(item.text || item.message || '')
      : 'Ми отримали його і скоро опрацюємо.';
  }
  if (item.type === 'payment_confirmed') {
    return 'Оплату підтверджено. Дякуємо, ми вже готуємо ваше замовлення до виконання.';
  }
  if (item.type === 'order_status') {
    return 'Статус вашого замовлення оновлено.';
  }
  if (item.type === 'certificate_issued' && payload.code) {
    const code = String(payload.code || '').replace(/(.{4})/g, '$1-').replace(/-$/, '');
    return `Ваш промокод: ${code}. Активуйте його у профілі, щоб отримати ${payload.stars || ''} зірок.`;
  }
  if ((item.type === 'stars_added' || item.type === 'bonus_added') && payload.stars) {
    return state.isAdmin
      ? `Клієнту нараховано +${payload.stars} бонусних зірок${payload.orderId ? ` за замовлення #${payload.orderId}` : ''}.`
      : `Вам нараховано +${payload.stars} бонусних зірок.`;
  }
  return fixNoticeText(item.text || item.message || '');
}

function eventTime(value) {
  if (!value) return '';
  if (Number(value)) return formatTime(Number(value) * 1000);
  return formatTime(value);
}

function renderNotifications(items) {
  const panel = document.getElementById('notificationsPanel');
  if (!panel) return;
  const tools = '<div class="notice-tools"><button id="clearNotificationsBtn" class="clear-notices-btn" type="button">Очистити повідомлення</button></div>';
  if (!items.length) {
    panel.innerHTML = `${tools}<div class="notice-empty">Поки немає повідомлень.</div>`;
    bindClearNotifications();
    return;
  }

  panel.innerHTML = tools + items.map(item => `
    <article class="notice-item notice-${escapeHtml(item.type || 'generic')}">
      <div class="notice-icon">${escapeHtml(notificationIcon(item.type))}</div>
      <div>
        <strong>${escapeHtml(notificationTitle(item))}</strong>
        <p>${escapeHtml(normalizeNoticeText(item))}</p>
        <time>${escapeHtml(eventTime(item.ts || item.created_at))}</time>
      </div>
    </article>
  `).join('');
  bindClearNotifications();
}

async function loadNotifications() {
  const data = await apiFetch(`${SUPPORT_API}/notifications`);
  renderNotifications(data.items || []);
}

function bindClearNotifications() {
  const button = document.getElementById('clearNotificationsBtn');
  if (!button) return;
  button.addEventListener('click', async () => {
    await apiFetch(`${SUPPORT_API}/notifications`, { method: 'DELETE' });
    await loadNotifications();
  }, { once: true });
}

function updateDialogTitle() {
  const thread = state.threads.find(item => Number(item.id) === Number(state.activeThreadId));
  if (!state.isAdmin) {
    els.dialogTitle.textContent = 'Служба підтримки Art Light';
    els.dialogSubtitle.textContent = 'Ваш діалог з адміністратором магазину.';
    if (els.dialogAvatar) {
      els.dialogAvatar.outerHTML = '<img id="dialogAvatar" class="chat-avatar-img" src="images/avatar.png" alt="Art Light">';
      els.dialogAvatar = document.getElementById('dialogAvatar');
    }
    return;
  }
  const name = threadName(thread);
  els.dialogTitle.textContent = name;
  els.dialogSubtitle.textContent = thread && thread.email ? thread.email : 'Клієнтський діалог';
  if (els.dialogAvatar) {
    els.dialogAvatar.outerHTML = `<span id="dialogAvatar" class="chat-avatar" style="background:${clientGradient(thread && (thread.user_id || thread.id))}">${escapeHtml(firstInitial(name))}</span>`;
    els.dialogAvatar = document.getElementById('dialogAvatar');
  }
}

async function loadMessages() {
  if (!state.activeThreadId) return;
  const data = await apiFetch(`${SUPPORT_API}/threads/${state.activeThreadId}/messages`);
  renderMessages(data.messages || []);
}

async function loadThreads(keepActive = false) {
  const data = await apiFetch(`${SUPPORT_API}/threads`);
  state.isAdmin = !!data.isAdmin;
  state.threads = data.threads || [];
  if (!keepActive || !state.threads.some(item => Number(item.id) === Number(state.activeThreadId))) {
    state.activeThreadId = state.threads[0] ? state.threads[0].id : null;
  }
  renderThreads();
  updateDialogTitle();
  await loadMessages();
}

async function selectThread(threadId) {
  state.activeThreadId = threadId;
  renderThreads();
  updateDialogTitle();
  await loadMessages();
}

async function sendActiveMessage() {
  const text = els.messageInput.value.trim();
  if (!text || !state.activeThreadId) return;
  els.messageInput.value = '';
  await apiFetch(`${SUPPORT_API}/threads/${state.activeThreadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message: text })
  });
  await loadThreads(true);
}

function setupTabs() {
  document.querySelectorAll('.messenger-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const panel = tab.dataset.panel;
      document.querySelectorAll('.messenger-tab').forEach((item) => {
        item.classList.toggle('active', item === tab);
      });
      document.getElementById('chatsPanel').classList.toggle('active', panel === 'chats');
      document.getElementById('notificationsPanel').classList.toggle('active', panel === 'notifications');
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof ensureAuthenticated === 'function') {
    const ok = await ensureAuthenticated();
    if (!ok) {
      window.location.href = 'auth.html';
      return;
    }
  }

  setupTabs();
  els.sendMessage.addEventListener('click', () => sendActiveMessage().catch(console.error));
  els.messageInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendActiveMessage().catch(console.error);
    }
  });

  await loadThreads();
  await loadNotifications();
  state.pollTimer = setInterval(() => loadThreads(true).catch(() => {}), 5000);
  setInterval(() => loadNotifications().catch(() => {}), 10000);
});
