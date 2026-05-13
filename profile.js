// Profile JavaScript
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

// Get stored user data
function getUserData() {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (userData) {
        return {
            token: token,
            user: JSON.parse(userData)
        };
    }
    return null;
}

// Clear stored user data
function clearUserData() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('sessionActive');
}

// Check if user is logged in
function isLoggedIn() {
    return localStorage.getItem('sessionActive') === 'true' && getUserData() !== null;
}

// Make authenticated API request
async function makeAuthenticatedRequest(url, options = {}) {
    if (!isLoggedIn()) {
        throw new Error('Not authenticated');
    }

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    return fetch(url, {
        ...options,
        headers,
        credentials: 'include'
    });
}

function removeUnactivatedCode(normalizedCode) {
  let codes = [];
  try { codes = JSON.parse(localStorage.getItem('certCodes') || '[]'); } catch (_) { codes = []; }
  const before = codes.length;
  const filtered = codes.filter(c => {
    if (!c) return false;
    const norm = String(c.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return norm !== normalizedCode;
  });
  if (filtered.length !== before) {
    try { localStorage.setItem('certCodes', JSON.stringify(filtered)); } catch (_) {}
  }
  renderUnactivatedCodes();
}

function profileHash(value) {
    const text = String(value || 'Art Light');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function profileAvatarGradient(seed) {
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
    const pair = palettes[profileHash(seed) % palettes.length];
    return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

function firstProfileLetter(user, fallbackName) {
    const source = [
        user && (user.firstName || user.given_name),
        fallbackName,
        user && (user.username || user.email || user.name)
    ].find(Boolean) || 'A';
    return String(source).trim().charAt(0).toUpperCase() || 'A';
}

function updateProfileAvatar(user, displayName) {
    const avatar = document.getElementById('profileAvatar');
    if (!avatar) return;
    const photo = user && (user.avatar || user.avatarUrl || user.photoURL || user.picture || user.image);
    avatar.innerHTML = '';
    avatar.style.background = profileAvatarGradient(displayName || user?.email || user?.username || 'Art Light');
    if (photo) {
        const img = document.createElement('img');
        img.src = photo;
        img.alt = displayName || 'Avatar';
        avatar.appendChild(img);
        return;
    }
    avatar.textContent = firstProfileLetter(user, displayName);
}

function showClipboardNotice(message = 'Скопировано!') {
    if (typeof window.siteNotify === 'function') {
        window.siteNotify(message, { type: 'success', duration: 1800 });
        return;
    }
    const existing = document.querySelector('.clipboard-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'clipboard-toast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483000;background:#2e1e17;color:#fff;padding:10px 14px;border-radius:999px;font-weight:800;box-shadow:0 14px 30px rgba(0,0,0,.18);';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
}

async function loadProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/profile`, { credentials: 'include' });
        const data = await response.json();

        if (response.ok) {
            displayProfile(data.user);
            localStorage.setItem('userData', JSON.stringify(data.user));
            localStorage.setItem('sessionActive', 'true');
            return data.user;
        } else {
            throw new Error(data.error || 'Failed to load profile');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showMessage('editMessage', 'Помилка завантаження профілю. Відображаю локальні дані.', 'error');

        // Fallback to localStorage user data (e.g., after Google login without backend)
        const local = getUserData();
        if (local && local.user) {
            displayProfile(local.user);
            return local.user;
        }

        // If no local data either, redirect to login
        if (!getUserData()) {
            logout();
        }
    }
}

// Display profile data
function displayProfile(user) {
    // Map possible Google fields
    const firstName = user.firstName || user.given_name || user.name?.split(' ')[0] || '-';
    const lastName = user.lastName || user.family_name || user.name?.split(' ').slice(1).join(' ') || '-';
    const username = user.username || user.email || user.name || '-';
    const email = user.email || user.emailAddress || '-';
    const displayName = [firstName, lastName].filter(part => part && part !== '-').join(' ') || username || email || 'Користувач';

    document.getElementById('displayFirstName').textContent = firstName;
    document.getElementById('displayLastName').textContent = lastName;
    document.getElementById('displayUsername').textContent = username;
    document.getElementById('displayEmail').textContent = email;
    document.getElementById('displayPhone').textContent = user.phone || 'Не вказано';
    document.getElementById('displayAddress').textContent = user.address || 'Не вказано';
    document.getElementById('bonusStarsCount').textContent = `${user.bonusStars || 0} ⭐`;
    const profileName = document.getElementById('profileDisplayName');
    const profileEmail = document.getElementById('profileDisplayEmail');
    if (profileName) profileName.textContent = displayName;
    if (profileEmail) profileEmail.textContent = email;
    updateProfileAvatar(user, displayName);
    const adminBadge = document.getElementById('adminStatusBadge');
    if (adminBadge) {
        adminBadge.classList.toggle('visible', !!user.isAdmin);
    }

    // Fill edit form
    document.getElementById('editFirstName').value = user.firstName || '';
    document.getElementById('editLastName').value = user.lastName || '';
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editPhone').value = user.phone || '';
    document.getElementById('editAddress').value = user.address || '';
}

// Toggle edit form
function toggleEditForm() {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) return;

    profileForm.classList.toggle('is-editing');
    
    if (profileForm.classList.contains('is-editing')) {
        // Clear any previous messages
        document.getElementById('editMessage').innerHTML = '';
    }
}

// Cancel edit
function cancelEdit() {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) return;

    profileForm.classList.remove('is-editing');
    document.getElementById('editMessage').innerHTML = '';
    
    // Reload original data
    loadProfile();
}

// Update profile
async function updateProfile(profileData) {
    try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });

        const data = await response.json();

        if (response.ok) {
            // Reload profile to get updated data
            await loadProfile();
            
            // Update stored user data
            const userData = getUserData();
            if (userData) {
                const updatedUser = { ...userData.user, ...profileData };
                localStorage.setItem('userData', JSON.stringify(updatedUser));
            }
            
            return { success: true, message: data.message };
        } else {
            let errorMessage = 'Помилка оновлення профілю';
            if (data.errors && data.errors.length > 0) {
                errorMessage = data.errors.map(err => err.msg).join(', ');
            } else if (data.error) {
                errorMessage = data.error;
            }
            return { success: false, error: errorMessage };
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        return { success: false, error: 'Помилка з\'єднання з сервером' };
    }
}

// Show message
function showMessage(elementId, message, type = 'success') {
    const element = document.getElementById(elementId);
    const className = type === 'error' ? 'error-message' : 'success-message';
    element.innerHTML = `<div class="message ${className}">${message}</div>`;
}

// Logout function
function logout() {
    clearUserData();
    window.location.href = 'auth.html';
}

// Handle profile form submission
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        firstName: document.getElementById('editFirstName').value.trim(),
        lastName: document.getElementById('editLastName').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        phone: document.getElementById('editPhone').value.trim(),
        address: document.getElementById('editAddress').value.trim()
    };

    // Client-side validation
    if (!formData.firstName || !formData.lastName || !formData.email) {
        showMessage('editMessage', 'Будь ласка, заповніть всі обов\'язкові поля', 'error');
        return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        showMessage('editMessage', 'Будь ласка, введіть коректний email', 'error');
        return;
    }

    // Show loading state
    const submitBtn = document.querySelector('#profileForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Збереження...';

    const result = await updateProfile(formData);

    // Reset button
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;

    if (result.success) {
        showMessage('editMessage', 'Профіль успішно оновлено!', 'success');
        setTimeout(() => {
            const profileForm = document.getElementById('profileForm');
            if (profileForm) profileForm.classList.remove('is-editing');
        }, 2000);
    } else {
        showMessage('editMessage', result.error, 'error');
    }
});

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    const profileEditBtn = document.getElementById('profileEditBtn');
    if (profileEditBtn && !profileEditBtn.getAttribute('onclick')) {
        profileEditBtn.addEventListener('click', toggleEditForm);
    }

    const user = await loadProfile();
    if (!user && !getUserData()) {
        window.location.href = 'auth.html';
        return;
    }

    // Wire up promo code redemption
    const redeemBtn = document.getElementById('redeemPromoBtn');
    const promoInput = document.getElementById('promoCodeInput');
    if (redeemBtn && promoInput) {
        redeemBtn.addEventListener('click', redeemCertificateCode);
        promoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); redeemCertificateCode(); } });
    }

    // Render unactivated codes list
    renderUnactivatedCodes();
});

// Redeem certificate promo code
async function redeemCertificateCode() {
    const input = document.getElementById('promoCodeInput');
    const msgEl = document.getElementById('promoMessage');
    if (!input || !msgEl) return;

    const raw = (input.value || '').toUpperCase().trim();
    if (!raw) { showMessageInline(msgEl, 'Введіть промокод', 'error'); return; }

    // Normalize: allow with or without dashes
    const normalized = raw.replace(/[^A-Z0-9]/g, '');
    if (normalized.length < 8) { showMessageInline(msgEl, 'Некоректний формат промокоду', 'error'); return; }

    // Redeem via server so код працює на будь-якому акаунті
    try {
        const res = await makeAuthenticatedRequest(`${API_BASE_URL}/certificates/redeem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: normalized })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            const err = data && (data.error || data.message) || 'Не вдалося активувати промокод';
            showMessageInline(msgEl, err, 'error');
            return;
        }

        if (data.adminGranted) {
            const ud = getUserData();
            if (ud && ud.user) {
                ud.user.isAdmin = true;
                localStorage.setItem('userData', JSON.stringify(ud.user));
                displayProfile(ud.user);
            }
            input.value = '';
            showMessageInline(msgEl, 'Акаунт адміністратора активовано. Тепер можна відкрити адмін-панель.', 'success');
            renderUnactivatedCodes();
            return;
        }

        // Update displayed stars and stored userData
        const countEl = document.getElementById('bonusStarsCount');
        if (countEl) countEl.textContent = `${data.bonusStars || 0} ⭐`;
        const ud = getUserData();
        if (ud && ud.user) {
            ud.user.bonusStars = data.bonusStars || (ud.user.bonusStars || 0) + (data.starsAdded || 0);
            localStorage.setItem('userData', JSON.stringify(ud.user));
        }

        // Mark this promo code as redeemed in localStorage so it disappears from the inactive list
        try {
            const normCode = normalized; // already uppercase and stripped
            let codes = [];
            try { codes = JSON.parse(localStorage.getItem('certCodes') || '[]'); } catch (_) { codes = []; }
            let changed = false;
            const updated = codes.map(c => {
                if (!c) return c;
                const cNorm = String(c.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (cNorm === normCode) {
                    changed = true;
                    return { ...c, redeemed: true, redeemedAt: new Date().toISOString() };
                }
                return c;
            });
            if (changed) {
                localStorage.setItem('certCodes', JSON.stringify(updated));
            }
        } catch (_) { /* ignore localStorage errors */ }

        // Clear input and show success
        input.value = '';
        showMessageInline(msgEl, `Успішно активовано! Зараховано ${data.starsAdded || 0} ⭐.`, 'success');

        // Re-render unactivated list (local list may still exist, we keep UI helper)
        renderUnactivatedCodes();
    } catch (e) {
        console.error('Redeem error', e);
        showMessageInline(msgEl, 'Сталася помилка. Спробуйте пізніше.', 'error');
    }
}

function showMessageInline(container, message, type = 'success') {
    const className = type === 'error' ? 'error-message' : 'success-message';
    container.innerHTML = `<div class="message ${className}">${message}</div>`;
}

function renderUnactivatedCodes() {
    const wrap = document.getElementById('unactivatedCodesList');
    if (!wrap) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem('certCodes') || '[]'); } catch(_) { list = []; }
    const unredeemed = list.filter(c => c && !c.redeemed);
    if (unredeemed.length === 0) {
        wrap.innerHTML = '<div class="promo-empty">Немає неактивованих промокодів</div>';
        return;
    }
    wrap.innerHTML = '';
    unredeemed.forEach(c => {
      const pill = document.createElement('div');
      pill.className = 'promo-code-item';
      pill.innerHTML = `
        <div class="promo-code-main">
          <strong>${c.title || 'Сертифікат'}</strong>
          <code>${c.code}</code>
        </div>
        <span class="promo-stars">⭐ ${c.stars || 0}</span>
      `;
      const btn = document.createElement('button');
      btn.className = 'icon-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Копіювати промокод');
      btn.title = 'Копіювати';
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 8.5C8 7.12 9.12 6 10.5 6H18c1.38 0 2.5 1.12 2.5 2.5V18c0 1.38-1.12 2.5-2.5 2.5h-7.5A2.5 2.5 0 0 1 8 18V8.5Z" stroke="currentColor" stroke-width="1.8"/><path d="M5 16.5H4.5A2.5 2.5 0 0 1 2 14V6a4 4 0 0 1 4-4h8a2.5 2.5 0 0 1 2.5 2.5V5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      btn.onclick = () => navigator.clipboard.writeText(c.code).then(() => showClipboardNotice('Скопировано!'));
      pill.appendChild(btn);

      const closeBtn = document.createElement('button');
      closeBtn.setAttribute('aria-label', 'Видалити промокод');
      closeBtn.className = 'icon-btn promo-remove-btn';
      closeBtn.type = 'button';
      closeBtn.title = 'Видалити';
      closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const norm = String(c.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        removeUnactivatedCode(norm);
      };
      pill.appendChild(closeBtn);
      wrap.appendChild(pill);
    });
}
