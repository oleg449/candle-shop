document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chatMessages');
  const messageInput = document.getElementById('messageInput');
  const sendMessageBtn = document.getElementById('sendMessage');
  const closeChatBtn = document.getElementById('closeChat');
  const supportButton = document.getElementById('supportButton');
  const supportChat = document.getElementById('supportChat');
  const supportBadge = document.getElementById('supportBadge');
  const supportChatBackdrop = document.getElementById('supportChatBackdrop');

  let threadId = null;
  let pollTimer = null;

  const apiBase = () => (
    typeof API_BASE_URL === 'string' && API_BASE_URL
      ? API_BASE_URL
      : ((window.API_BASE_URL || '/api'))
  );

  function isLoggedIn() {
    try {
      return !!(localStorage.getItem('authToken') || localStorage.getItem('userData'));
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fixText(value) {
    return typeof window.fixSiteMojibake === 'function'
      ? window.fixSiteMojibake(value)
      : String(value || '');
  }

  async function apiFetch(path, options = {}) {
    const response = await fetch(`${apiBase()}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  function setBadge(count) {
    if (!supportBadge || !supportButton) return;
    if (count > 0) {
      supportBadge.textContent = String(count);
      supportBadge.style.display = 'inline-block';
      supportButton.classList.add('has-unread');
    } else {
      supportBadge.style.display = 'none';
      supportButton.classList.remove('has-unread');
    }
  }

  function addLocalMessage(text, own = true) {
    if (!chatMessages) return;
    const row = document.createElement('div');
    row.className = `message ${own ? 'user' : 'admin'}`;
    row.innerHTML = escapeHtml(fixText(text));
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function renderMessages(items = []) {
    if (!chatMessages) return;
    if (!items.length) {
      chatMessages.innerHTML = '<div class="empty-dialog">Напишіть повідомлення, і ми відповімо тут.</div>';
      return;
    }
    chatMessages.innerHTML = items.map(item => {
      const own = item.sender_role === 'user';
      return `<div class="message ${own ? 'user' : 'admin'}">${escapeHtml(fixText(item.message))}</div>`;
    }).join('');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function ensureThread() {
    const data = await apiFetch('/support/threads');
    const thread = Array.isArray(data) ? data[0] : data;
    threadId = thread && thread.id ? thread.id : threadId;
    return threadId;
  }

  async function loadMessages() {
    if (!isLoggedIn()) return;
    const id = threadId || await ensureThread();
    if (!id) return;
    const data = await apiFetch(`/support/threads/${encodeURIComponent(id)}/messages`);
    renderMessages(data.messages || []);
  }

  async function sendMessage() {
    const text = (messageInput && messageInput.value ? messageInput.value : '').trim();
    if (!text) return;
    if (!isLoggedIn()) {
      window.location.href = 'auth.html';
      return;
    }
    const id = threadId || await ensureThread();
    if (!id) return;
    if (sendMessageBtn) sendMessageBtn.disabled = true;
    try {
      messageInput.value = '';
      addLocalMessage(text, true);
      await apiFetch(`/support/threads/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: text })
      });
      await loadMessages();
      setBadge(0);
    } catch (error) {
      console.error('Support message failed:', error);
      addLocalMessage('Не вдалося надіслати повідомлення. Спробуйте ще раз.', false);
    } finally {
      if (sendMessageBtn) sendMessageBtn.disabled = false;
    }
  }

  function openChat() {
    window.location.href = 'messages.html';
  }

  function closeChat() {
    supportChat?.classList.remove('active');
    if (supportChat) supportChat.style.display = 'none';
    supportChatBackdrop?.classList.remove('active');
    clearInterval(pollTimer);
  }

  async function refreshUnread() {
    if (!isLoggedIn()) return setBadge(0);
    try {
      const data = await apiFetch('/support/unread-indicator');
      setBadge(Number(data.unread || data.count || 0) || 0);
    } catch (_) {
      setBadge(0);
    }
  }

  supportButton?.addEventListener('click', openChat);
  closeChatBtn?.addEventListener('click', closeChat);
  supportChatBackdrop?.addEventListener('click', closeChat);
  sendMessageBtn?.addEventListener('click', () => sendMessage().catch(console.error));
  messageInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage().catch(console.error);
    }
  });

  if (supportChat) supportChat.style.display = 'none';
  refreshUnread();
  setInterval(refreshUnread, 30000);
});
