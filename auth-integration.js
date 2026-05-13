// Authentication Integration for Main Site
// Use dynamic API base for Render or any host. If the static site runs on port 8000,
// the Node API still lives on port 3000.
const API_BASE_URL = (() => {
    if (typeof window === 'undefined') return '/api';
    if (window.API_BASE_URL) return window.API_BASE_URL;
    if (window.location.protocol === 'file:' || window.location.port === '8000') {
        return 'http://localhost:3000/api';
    }
    return '/api';
})();
const SESSION_FLAG_KEY = 'sessionActive';
const NOTICE_INDICATOR_COUNT_KEY = 'siteNoticeIndicatorCount';
const NOTICE_INDICATOR_TARGET_KEY = 'siteNoticeIndicatorTarget';
const NOTICE_INDICATOR_SEEN_KEY = 'siteNoticeIndicatorSeenIds';
const SUPPORT_CHAT_SEEN_KEY = 'siteSupportChatSeenIds';

function storeUserData(user) {
    if (!user) {
        localStorage.removeItem('userData');
        return;
    }
    localStorage.setItem('userData', JSON.stringify(user));
}

function getUserData() {
    const data = localStorage.getItem('userData');
    if (!data) return null;
    try {
        return { user: JSON.parse(data) };
    } catch (_) {
        localStorage.removeItem('userData');
        return null;
    }
}

function setSessionActive(isActive) {
    if (isActive) {
        localStorage.setItem(SESSION_FLAG_KEY, 'true');
    } else {
        localStorage.removeItem(SESSION_FLAG_KEY);
    }
}

function clearUserData() {
    localStorage.removeItem('userData');
    localStorage.removeItem('authToken'); // legacy cleanup
    setSessionActive(false);
}

function isLoggedIn() {
    return localStorage.getItem(SESSION_FLAG_KEY) === 'true' && !!getUserData();
}

function getNoticeTarget() {
    const stored = getUserData();
    return stored && stored.user && stored.user.isAdmin ? 'admin' : 'messages';
}

function getNoticeTargetHref(target = getNoticeTarget()) {
    return target === 'admin' ? 'admin.html' : 'messages.html';
}

function accountAvatarHash(value) {
    const text = String(value || 'Art Light');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function accountAvatarGradient(seed) {
    const palettes = [
        ['#f7b7a3', '#f6d7a7'],
        ['#b8d8ba', '#d7ecd9'],
        ['#b8c7f7', '#d8c8f4'],
        ['#f5c4df', '#f8d8c5'],
        ['#a9d6e5', '#d3f0ee'],
        ['#dcc7aa', '#f3e5c8'],
        ['#c7d9b7', '#f0d7a7'],
        ['#c9b8f5', '#f2c1d1']
    ];
    const pair = palettes[accountAvatarHash(seed) % palettes.length];
    return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

function getAccountDisplayName(user = {}) {
    const firstName = user.firstName || user.given_name || (user.name ? user.name.split(' ')[0] : '');
    const lastName = user.lastName || user.family_name || (user.name ? user.name.split(' ').slice(1).join(' ') : '');
    return [firstName, lastName].filter(Boolean).join(' ') || user.username || user.email || user.name || 'Користувач';
}

function updateSideAvatar(user) {
    const userSideSection = document.getElementById('userSideSection');
    if (!userSideSection) return;
    const userInfo = userSideSection.querySelector('.user-info-side');
    if (!userInfo) return;

    userInfo.classList.add('has-side-avatar');
    let avatar = userInfo.querySelector('[data-side-account-avatar]');
    if (!avatar) {
        avatar = document.createElement('div');
        avatar.className = 'side-account-avatar';
        avatar.dataset.sideAccountAvatar = 'true';
        avatar.setAttribute('aria-hidden', 'true');
        userInfo.insertBefore(avatar, userInfo.firstChild);
    }

    const displayName = getAccountDisplayName(user || {});
    const photo = user && (user.avatar || user.avatarUrl || user.photoURL || user.picture || user.image);
    avatar.innerHTML = '';
    avatar.style.background = accountAvatarGradient(displayName || 'Art Light');

    if (photo) {
        const img = document.createElement('img');
        img.src = photo;
        img.alt = displayName;
        avatar.appendChild(img);
        return;
    }

    avatar.textContent = String(displayName || 'A').trim().charAt(0).toUpperCase() || 'A';
}

function getStoredNoticeCount() {
    return Math.max(0, parseInt(localStorage.getItem(NOTICE_INDICATOR_COUNT_KEY) || '0', 10) || 0);
}

function getSeenNoticeIds() {
    try {
        const list = JSON.parse(localStorage.getItem(NOTICE_INDICATOR_SEEN_KEY) || '[]');
        return Array.isArray(list) ? list.map(String) : [];
    } catch (_) {
        return [];
    }
}

function storeSeenNoticeIds(ids) {
    localStorage.setItem(NOTICE_INDICATOR_SEEN_KEY, JSON.stringify(ids.slice(-80)));
}

function getSeenSupportChatIds() {
    try {
        const list = JSON.parse(localStorage.getItem(SUPPORT_CHAT_SEEN_KEY) || '[]');
        return Array.isArray(list) ? list.map(String) : [];
    } catch (_) {
        return [];
    }
}

function storeSeenSupportChatIds(ids) {
    localStorage.setItem(SUPPORT_CHAT_SEEN_KEY, JSON.stringify(ids.slice(-120)));
}

function ensureNoticeBadge(element) {
    if (!element) return null;
    let badge = element.querySelector('[data-notice-badge]');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notice-badge';
        badge.dataset.noticeBadge = 'true';
        element.appendChild(badge);
    }
    return badge;
}

function getNoticeLinks(target = getNoticeTarget()) {
    const href = getNoticeTargetHref(target);
    return Array.from(document.querySelectorAll(`a[href="${href}"]`));
}

function ensureAdminMenuLink(user) {
    if (!user || !user.isAdmin) return;
    const userSideSection = document.getElementById('userSideSection');
    if (!userSideSection) return;
    const linksWrap = userSideSection.querySelector('.auth-links');
    if (!linksWrap || linksWrap.querySelector('[data-account-admin-link]') || linksWrap.querySelector('a[href="admin.html"]')) return;

    const adminLink = document.createElement('a');
    adminLink.href = 'admin.html';
    adminLink.className = 'auth-menu-link';
    adminLink.dataset.accountAdminLink = 'true';
    adminLink.textContent = 'Адмін-панель';
    linksWrap.appendChild(adminLink);
}

function clearNoticeIndicators() {
    localStorage.removeItem(NOTICE_INDICATOR_COUNT_KEY);
    localStorage.removeItem(NOTICE_INDICATOR_TARGET_KEY);
    updateNoticeIndicators();
}

function updateNoticeIndicators() {
    const count = getStoredNoticeCount();
    const target = localStorage.getItem(NOTICE_INDICATOR_TARGET_KEY) || getNoticeTarget();
    const hasCount = count > 0;
    const label = count > 99 ? '99+' : String(count);
    const menuButtons = [
        document.getElementById('openMenu'),
        document.getElementById('openMenuMobile')
    ].filter(Boolean);

    menuButtons.forEach(button => {
        button.classList.toggle('has-notice-alert', hasCount);
        const badge = ensureNoticeBadge(button);
        if (badge) {
            badge.textContent = label;
            badge.hidden = !hasCount;
        }
    });

    document.querySelectorAll('.auth-menu-link.has-notice-alert').forEach(link => {
        link.classList.remove('has-notice-alert');
        const badge = link.querySelector('[data-notice-badge]');
        if (badge) badge.hidden = true;
    });

    if (hasCount) {
        getNoticeLinks(target).forEach(link => {
            link.classList.add('has-notice-alert');
            const badge = ensureNoticeBadge(link);
            if (badge) {
                badge.textContent = label;
                badge.hidden = false;
            }
        });
    }
}

function registerIncomingNotifications(items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return;
    const target = getNoticeTarget();
    const targetHref = getNoticeTargetHref(target);
    if (window.location.pathname.toLowerCase().endsWith(`/${targetHref}`)) {
        clearNoticeIndicators();
        return;
    }

    const seen = new Set(getSeenNoticeIds());
    let freshCount = 0;
    list.forEach(item => {
        const id = item && item.id ? String(item.id) : '';
        if (id && seen.has(id)) return;
        if (id) seen.add(id);
        freshCount += 1;
    });
    if (!freshCount) return;

    localStorage.setItem(NOTICE_INDICATOR_COUNT_KEY, String(getStoredNoticeCount() + freshCount));
    localStorage.setItem(NOTICE_INDICATOR_TARGET_KEY, target);
    storeSeenNoticeIds(Array.from(seen));
    updateNoticeIndicators();
}

async function fetchSupportChatIndicators() {
    const response = await fetch(`${API_BASE_URL}/support/unread-indicator`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('authToken') ? { Authorization: `Bearer ${localStorage.getItem('authToken')}` } : {})
        }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
}

async function markSupportChatIndicatorsSeen() {
    try {
        const items = await fetchSupportChatIndicators();
        const seen = new Set(getSeenSupportChatIds());
        items.forEach(item => {
            if (item && item.id) seen.add(String(item.id));
        });
        storeSeenSupportChatIds(Array.from(seen));
    } catch (_) {}
}

async function pollSupportChatIndicators() {
    if (!isLoggedIn()) return;
    try {
        const items = await fetchSupportChatIndicators();
        if (!items.length) return;
        const onMessagesPage = window.location.pathname.toLowerCase().endsWith('/messages.html');
        const seen = new Set(getSeenSupportChatIds());
        let freshCount = 0;
        items.forEach(item => {
            const id = item && item.id ? String(item.id) : '';
            if (!id || seen.has(id)) return;
            seen.add(id);
            freshCount += 1;
        });
        storeSeenSupportChatIds(Array.from(seen));
        if (!freshCount || onMessagesPage) {
            if (onMessagesPage) clearNoticeIndicators();
            return;
        }
        localStorage.setItem(NOTICE_INDICATOR_COUNT_KEY, String(getStoredNoticeCount() + freshCount));
        localStorage.setItem(NOTICE_INDICATOR_TARGET_KEY, 'messages');
        updateNoticeIndicators();
    } catch (_) {}
}

window.registerIncomingNotifications = registerIncomingNotifications;
window.clearNoticeIndicators = clearNoticeIndicators;

function ensureAccountMenuLinks() {
    const userSideSection = document.getElementById('userSideSection');
    if (!userSideSection) return;
    const linksWrap = userSideSection.querySelector('.auth-links');
    if (!linksWrap) return;

    const path = String(window.location.pathname || '').toLowerCase();
    const isMainPage = path.endsWith('/index.html') || path === '/' || path === '';
    if (!isMainPage && !linksWrap.querySelector('[data-account-home-link]')) {
        const profileLink = linksWrap.querySelector('a[href="profile.html"]');
        const homeLink = document.createElement('a');
        homeLink.href = 'index.html';
        homeLink.className = 'auth-menu-link';
        homeLink.dataset.accountHomeLink = 'true';
        homeLink.textContent = '🏠 Головна';
        if (profileLink) {
            linksWrap.insertBefore(homeLink, profileLink);
        } else {
            linksWrap.insertBefore(homeLink, linksWrap.firstChild);
        }
    }
    if (linksWrap.querySelector('[data-account-messages-link]')) return;

    const profileLink = linksWrap.querySelector('a[href="profile.html"]');
    const messagesLink = document.createElement('a');
    messagesLink.href = 'messages.html';
    messagesLink.className = 'auth-menu-link';
    messagesLink.dataset.accountMessagesLink = 'true';
    messagesLink.textContent = '💬 Чати і повідомлення';
    if (window.location.pathname.toLowerCase().endsWith('/messages.html')) {
        messagesLink.classList.add('active');
    }

    if (profileLink && profileLink.nextSibling) {
        linksWrap.insertBefore(messagesLink, profileLink.nextSibling);
    } else if (profileLink) {
        linksWrap.appendChild(messagesLink);
    } else {
        linksWrap.insertBefore(messagesLink, linksWrap.firstChild);
    }
    updateNoticeIndicators();
}

function updateSideAdminBadge(user) {
    const userSideSection = document.getElementById('userSideSection');
    if (!userSideSection) return;
    const userInfo = userSideSection.querySelector('.user-info-side');
    if (!userInfo) return;
    let badge = userInfo.querySelector('[data-side-admin-badge]');
    if (!badge) {
        badge = document.createElement('p');
        badge.className = 'user-admin-side';
        badge.dataset.sideAdminBadge = 'true';
        badge.textContent = 'Адміністратор';
        userInfo.appendChild(badge);
    }
    badge.style.display = user && user.isAdmin ? 'block' : 'none';
}

async function fetchCurrentUser(silent = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/profile`, { credentials: 'include' });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        storeUserData(data.user);
        setSessionActive(true);
        return data.user;
    } catch (error) {
        if (!silent) console.warn('fetchCurrentUser error:', error);
        clearUserData();
        return null;
    }
}

async function ensureAuthenticated() {
    if (isLoggedIn()) return true;
    const user = await fetchCurrentUser(true);
    return !!user;
}

// Update UI based on authentication status
function updateAuthUI() {
    const guestSideSection = document.getElementById('guestSideSection');
    const userSideSection = document.getElementById('userSideSection');
    const guestHeaderSection = document.getElementById('guestHeaderSection');
    const userHeaderInfo = document.getElementById('userHeaderInfo');
    const userNameHeader = document.getElementById('userNameHeader');
    const userNameSide = document.getElementById('userNameSide');
    const userStarsSide = document.getElementById('userStarsSide');
    const bonusStars = document.getElementById('bonusStars');
    const bonusStarsMobile = document.getElementById('bonusStarsMobile');

    const data = getUserData();
    const loggedIn = !!data && !!data.user;

    if (loggedIn) {
        const user = data.user || {};
        if (guestSideSection) guestSideSection.style.display = 'none';
        if (userSideSection) userSideSection.style.display = 'block';
        ensureAccountMenuLinks();
        if (userHeaderInfo) userHeaderInfo.style.display = 'block';
        if (guestHeaderSection) guestHeaderSection.style.display = 'none';

        if (userNameHeader && user.firstName) userNameHeader.textContent = user.firstName;
        if (userNameSide && user.firstName) userNameSide.textContent = user.firstName;
        updateSideAvatar(user);
        ensureAdminMenuLink(user);
        updateSideAdminBadge(user);

        if (typeof user.bonusStars === 'number') {
            window.bonusStars = user.bonusStars;
            if (bonusStars) bonusStars.textContent = user.bonusStars;
            if (bonusStarsMobile) bonusStarsMobile.textContent = user.bonusStars;
            if (userStarsSide) userStarsSide.textContent = user.bonusStars;
        }

        syncBonusStars();
        updateNoticeIndicators();
    } else {
        if (guestSideSection) guestSideSection.style.display = 'block';
        if (userSideSection) userSideSection.style.display = 'none';
        if (userHeaderInfo) userHeaderInfo.style.display = 'none';
        if (guestHeaderSection) guestHeaderSection.style.display = 'flex';
        updateSideAdminBadge(null);
        clearNoticeIndicators();
        window.bonusStars = 0;
        if (bonusStars) bonusStars.textContent = '0';
        if (bonusStarsMobile) bonusStarsMobile.textContent = '0';
        updateNoticeIndicators();
    }
}

async function logoutUser() {
    if (!confirm('Ви впевнені, що хочете вийти?')) return;
    try {
        await fetch(`${API_BASE_URL}/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (_) { /* ignore */ }
    clearUserData();
    updateAuthUI();
    if (typeof showBonusNotification === 'function') {
        showBonusNotification('Ви успішно вийшли з системи');
    }
}

// Make authenticated API request
async function makeAuthenticatedRequest(url, options = {}) {
    const loggedIn = await ensureAuthenticated();
    if (!loggedIn) {
        throw new Error('Not authenticated');
    }

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    return fetch(url, {
        ...options,
        headers,
        credentials: 'include'
    });
}

// Sync bonus stars with server (for logged in users)
async function syncBonusStars() {
    if (!(await ensureAuthenticated())) {
        window.bonusStars = 0;
        const bonusElement = document.getElementById('bonusStars');
        if (bonusElement) bonusElement.textContent = '0';
        const bonusElementMobile = document.getElementById('bonusStarsMobile');
        if (bonusElementMobile) bonusElementMobile.textContent = '0';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/user/stars`, { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            const stars = data.bonusStars || 0;
            window.bonusStars = stars;
            const bonusElement = document.getElementById('bonusStars');
            const bonusElementMobile = document.getElementById('bonusStarsMobile');
            const userStarsSide = document.getElementById('userStarsSide');
            if (bonusElement) bonusElement.textContent = stars;
            if (bonusElementMobile) bonusElementMobile.textContent = stars;
            if (userStarsSide) userStarsSide.textContent = stars;

            const stored = getUserData();
            if (stored && stored.user) {
                stored.user.bonusStars = stars;
                storeUserData(stored.user);
            }
        }
    } catch (error) {
        console.error('Error syncing bonus stars:', error);
    }
}

// Add bonus stars for purchase (integrate with existing system)
async function addBonusStarsForPurchase(stars = 10) {
    console.warn('Direct purchase star awarding is disabled. Stars are added only after admin payment confirmation.');
    return false;
}

// Use bonus stars for discount (integrate with existing system)
async function useBonusStarsForDiscount(stars) {
    if (stars <= 0) {
        alert('Невірна кількість зірок');
        return false;
    }

    if (!(await ensureAuthenticated())) {
        alert('Для використання бонусних зірок потрібно увійти в акаунт');
        return false;
    }

    try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/user/stars`, {
            method: 'POST',
            body: JSON.stringify({ action: 'subtract', amount: stars })
        });

        if (response.ok) {
            const data = await response.json();
            window.bonusStars = data.bonusStars;
            const bonusElement = document.getElementById('bonusStars');
            const bonusElementMobile = document.getElementById('bonusStarsMobile');
            const userStarsSide = document.getElementById('userStarsSide');
            if (bonusElement) bonusElement.textContent = data.bonusStars;
            if (bonusElementMobile) bonusElementMobile.textContent = data.bonusStars;
            if (userStarsSide) userStarsSide.textContent = data.bonusStars;

            const stored = getUserData();
            if (stored && stored.user) {
                stored.user.bonusStars = data.bonusStars;
                storeUserData(stored.user);
            }

            if (typeof showBonusNotification === 'function') {
                showBonusNotification(data.message);
            } else {
                alert(data.message);
            }
            return stars;
        } else {
            const errorData = await response.json();
            alert(errorData.error || 'Не вдалося використати бонусні зірки');
            return false;
        }
    } catch (error) {
        console.error('Error using bonus stars:', error);
        alert('Помилка при використанні бонусних зірок');
        return false;
    }
}

// Simple wrapper function for compatibility
async function subtractBonusStars(stars) {
    return await useBonusStarsForDiscount(stars);
}

// Override existing functions to require authentication for checkout
async function initializeAuthIntegration() {
    await fetchCurrentUser(true);
    updateAuthUI();
    
    if (typeof window.updateStarDiscount === 'function') {
        const originalUpdateStarDiscount = window.updateStarDiscount;
        window.updateStarDiscount = function(starsToUse, subtotal) {
            if (isLoggedIn()) {
                const availableStars = (typeof window.bonusStars === 'number') ? window.bonusBars : 0;
                if (starsToUse > availableStars) {
                    starsToUse = availableStars;
                    if (typeof showBonusNotification === 'function') {
                        showBonusNotification('У вас недостатньо бонусних зірок');
                    }
                }
            }
            return originalUpdateStarDiscount(starsToUse, subtotal);
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAuthIntegration();
    if (window.location.pathname.toLowerCase().endsWith('/messages.html')) {
        clearNoticeIndicators();
        markSupportChatIndicatorsSeen();
    }
    updateNoticeIndicators();
    document.addEventListener('click', (event) => {
        const targetLink = event.target && event.target.closest && event.target.closest('a[href="messages.html"], a[href="admin.html"]');
        if (targetLink && targetLink.classList.contains('has-notice-alert')) {
            clearNoticeIndicators();
            if (targetLink.getAttribute('href') === 'messages.html') {
                markSupportChatIndicatorsSeen();
            }
        }
    });
    setTimeout(pollSupportChatIndicators, 1200);
    setInterval(pollSupportChatIndicators, 8000);
});

// Periodically sync bonus stars for logged in users
setInterval(() => {
    syncBonusStars();
}, 300000); // Every 5 minutes

// ================= Notifications polling =================
async function fetchNotificationsOnce() {
    if (!(await ensureAuthenticated())) return;
    try {
        const res = await makeAuthenticatedRequest(`${API_BASE_URL}/notifications`);
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) return;
        registerIncomingNotifications(items);
        const handledIds = [];
        for (const n of items) {
            try {
                if (n.type === 'certificate_issued') {
                    const p = n.payload || {};
                    const codeNoDash = String(p.code || '');
                    const codePretty = codeNoDash.replace(/(.{4})/g, '$1-').replace(/-$/,'');
                    // Save to localStorage inactive list
                    const entry = { code: codePretty, stars: p.stars || 0, title: p.title || 'Сертифікат', issuedAt: new Date().toISOString(), redeemed: false };
                    try {
                        const list = JSON.parse(localStorage.getItem('certCodes') || '[]');
                        list.push(entry);
                        localStorage.setItem('certCodes', JSON.stringify(list));
                    } catch(_) {}
                    // Message to user
                    const msg = n.message || `Оплату підтверджено. Видано промокод: ${codePretty}`;
                    if (typeof showBonusNotification === 'function') showBonusNotification(msg); else alert(msg);
                    // Show quick-copy modal
                    try { showCertificateModal(codePretty, p.stars || 0, p.title || 'Сертифікат'); } catch(_) {}
                } else if (n.type === 'masterclass_granted') {
                    const msg = n.message || 'Оплату підтверджено. Доступ до майстер-класу надано.';
                    if (typeof showBonusNotification === 'function') showBonusNotification(msg); else alert(msg);
                } else if (n.type === 'stars_added') {
                    const msg = n.message || 'Оплату підтверджено. Бонусні зірки нараховано.';
                    if (typeof showBonusNotification === 'function') showBonusNotification(msg); else alert(msg);
                    // Immediately sync stars to update header/profile counters
                    try { await syncBonusStars(); } catch(_) {}
                } else if (n.type === 'payment_confirmed') {
                    const msg = 'Оплату підтверджено. Дякуємо, ми вже готуємо ваше замовлення до виконання.';
                    if (typeof window.siteNotify === 'function') {
                        window.siteNotify(msg, { type: 'success', duration: 6500 });
                    } else if (typeof showBonusNotification === 'function') {
                        showBonusNotification(msg, { type: 'success' });
                    } else {
                        alert(msg);
                    }
                } else {
                    // Generic
                    const msg = n.message || 'Нове повідомлення';
                    if (typeof showBonusNotification === 'function') showBonusNotification(msg); else alert(msg);
                }
                handledIds.push(n.id);
            } catch(_) {}
        }
        if (handledIds.length) {
            try {
                await makeAuthenticatedRequest(`${API_BASE_URL}/notifications/ack`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: handledIds })
                });
            } catch(_) {}
        }
    } catch (e) {
        // ignore
    }
}

// Poll every 10 seconds
setInterval(() => { fetchNotificationsOnce().catch(() => {}); }, 10000);

// ======= Global Certificate Modal (created on demand) =======
function ensureCertificateModal() {
    let modal = document.getElementById('globalCertModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'globalCertModal';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.4)';
    modal.style.display = 'none';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '24px';
    modal.style.zIndex = '9999';
    modal.innerHTML = `
      <div id=\"globalCertModalContent\" style=\"max-width:560px; width:100%; background:#ffffff; border-radius:16px; padding:22px 22px 18px; box-shadow:0 20px 40px rgba(0,0,0,0.25); font-family:inherit; border:1px solid #eee;\">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="margin:0; color:#2c3e50; font-weight:800; letter-spacing:0.2px;">Ваш промокод</h3>
          <button id="globalCertClose" aria-label="Закрити" style="background:#f3f3f3; border:1px solid #e0e0e0; width:32px; height:32px; border-radius:8px; font-size:18px; cursor:pointer; line-height:30px;">×</button>
        </div>
        <div id="globalCertTitle" style="color:#7a6a5a; margin-bottom:8px; font-weight:600;"></div>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <code id="globalCertCode" style="font-size:1.25rem; color:#8b5e3c; user-select:all; background:#f7efe9; padding:6px 10px; border-radius:8px; border:1px dashed #e3cdbd;">—</code>
          <button id="globalCertCopy" class="profile-btn" style="padding:8px 12px; cursor:pointer; border-radius:8px; border:1px solid #d9c2ae; background:#fff;">Копіювати</button>
          <a id="globalCertProfileBtn" href="profile.html" style="margin-left:auto; text-decoration:none; background:linear-gradient(135deg, #d4a574, #c19660); color:#fff; padding:8px 12px; border-radius:8px; border:1px solid #b88a58;">Перейти в профіль</a>
        </div>
        <div style="margin-top:12px; font-size:0.95rem; color:#555;">Активуйте цей промокод у розділі <a href="profile.html" style="color:#b9825a; text-decoration:underline;">профілю</a>, щоб перетворити його на зірки.</div>
      </div>`;
    document.body.appendChild(modal);
    const closeBtn = modal.querySelector('#globalCertClose');
    closeBtn.onclick = () => modal.style.display = 'none';
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    return modal;
}

function showCertificateModal(code, stars, title) {
    const modal = ensureCertificateModal();
    const tEl = modal.querySelector('#globalCertTitle');
    const cEl = modal.querySelector('#globalCertCode');
    const copyBtn = modal.querySelector('#globalCertCopy');
    const ctaBtn = modal.querySelector('#globalCertCTA');
    if (tEl) tEl.textContent = `${title || 'Сертифікат'} · ⭐ ${stars || 0}`;
    if (cEl) cEl.textContent = code;
    if (copyBtn) {
      copyBtn.textContent = 'Копіювати';
      copyBtn.onclick = () => navigator.clipboard.writeText(code).then(()=>{
          copyBtn.textContent = 'Скопійовано!'; setTimeout(()=> copyBtn.textContent = 'Копіювати', 1400);
      });
    }
    if (ctaBtn) {
      ctaBtn.onclick = () => {
        modal.style.display = 'none';
        window.location.href = 'profile.html';
      };
    }
    modal.style.display = 'flex';
}
