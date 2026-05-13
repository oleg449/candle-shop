(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function openPanel(event) {
    event?.preventDefault();
    const panel = $('categoryPanel');
    if (!panel) return;
    panel.classList.add('open');
    document.body.classList.add('category-open');
  }

  function closePanel() {
    const panel = $('categoryPanel');
    if (!panel) return;
    panel.classList.remove('open');
    document.body.classList.remove('category-open');
  }

  function updateHeaderAuth() {
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('userData') || 'null');
    } catch (_) {}

    const guest = $('guestSideSection');
    const account = $('userSideSection');
    const isLoggedIn = !!(user && (user.id || user.email || user.username));
    if (guest) guest.style.display = isLoggedIn ? 'none' : '';
    if (account) account.style.display = isLoggedIn ? '' : 'none';

    const stars = Number(user?.stars || user?.bonusStars || localStorage.getItem('bonusStars') || 0) || 0;
    const name = user?.name || user?.firstName || user?.first_name || user?.username || 'Користувач';
    ['bonusStars', 'bonusStarsMobile', 'userStarsSide'].forEach(id => {
      const el = $(id);
      if (el) el.textContent = String(stars);
    });
    const nameEl = $('userNameSide');
    if (nameEl) nameEl.textContent = name;

    if (account) {
      const linksWrap = account.querySelector('.auth-links');
      if (linksWrap) {
        const path = String(window.location.pathname || '').toLowerCase();
        const isMainPage = path.endsWith('/index.html') || path === '/' || path === '';
        const existing = linksWrap.querySelector('[data-account-home-link]');
        if (!isMainPage && !existing) {
          const homeLink = document.createElement('a');
          homeLink.href = 'index.html';
          homeLink.className = 'auth-menu-link';
          homeLink.dataset.accountHomeLink = 'true';
          homeLink.textContent = '🏠 Головна';
          const profileLink = linksWrap.querySelector('a[href="profile.html"]');
          if (profileLink) {
            linksWrap.insertBefore(homeLink, profileLink);
          } else {
            linksWrap.insertBefore(homeLink, linksWrap.firstChild);
          }
        }
        if (isMainPage && existing) existing.remove();
      }
    }
  }

  function syncHeaderProfile() {
    fetch('/api/profile', { credentials: 'include' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data || !data.user) return;
        try {
          localStorage.setItem('userData', JSON.stringify(data.user));
        } catch (_) {}
        updateHeaderAuth();
      })
      .catch(() => {});
  }

  function populateCategories() {
    const panel = $('categoryPanel');
    const list = panel?.querySelector('h3 + ul');
    if (!list) return;

    fetch(`products.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : [])
      .then(products => {
        const categories = [...new Set((Array.isArray(products) ? products : [])
          .map(product => product && product.category)
          .filter(Boolean))];
        if (!categories.length) return;
        list.innerHTML = [
          '<li><a href="index.html">Усі товари</a></li>',
          ...categories.map(category => `<li><a href="index.html?category=${encodeURIComponent(category)}">${category}</a></li>`)
        ].join('');
      })
      .catch(() => {});
  }

  function redirectToSearch() {
    const query = ($('searchInput')?.value || '').trim();
    window.location.href = query ? `index.html?search=${encodeURIComponent(query)}` : 'index.html';
  }

  function initHeaderVisibility() {
    const header = document.querySelector('.floating-header');
    if (!header) return;

    let lastY = window.scrollY || 0;
    let ticking = false;
    const minDelta = 8;
    const revealZone = 80;
    const hideAfter = 120;

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY || 0;
        const delta = currentY - lastY;

        if (currentY <= revealZone || delta < -minDelta) {
          header.classList.remove('header-hidden');
        } else if (currentY > hideAfter && delta > minDelta) {
          header.classList.add('header-hidden');
        }

        lastY = currentY;
        ticking = false;
      });
    }, { passive: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
      .floating-header .nav-links,
      .floating-header .bonus-counter {
        font-family: Arial, sans-serif;
      }
    `;
    document.head.appendChild(style);

    const panel = $('categoryPanel');
    const openButtons = [$('openMenu'), $('openMenuMobile')].filter(Boolean);

    openButtons.forEach(button => button.addEventListener('click', openPanel));
    $('closeCategories')?.addEventListener('click', closePanel);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closePanel();
    });
    document.addEventListener('click', event => {
      if (!panel?.classList.contains('open')) return;
      const clickedButton = openButtons.some(button => button.contains(event.target));
      if (!clickedButton && !panel.contains(event.target)) closePanel();
    });

    $('headerSearchBtn')?.addEventListener('click', redirectToSearch);
    $('searchInput')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') redirectToSearch();
    });

    const cartIcon = $('cartIcon');
    if (cartIcon && typeof window.openCart !== 'function') {
      cartIcon.removeAttribute('onclick');
      cartIcon.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    if (typeof window.logoutUser !== 'function' && typeof window.logout === 'function') {
      window.logoutUser = window.logout;
    }

    updateHeaderAuth();
    syncHeaderProfile();
    populateCategories();
    initHeaderVisibility();
  });
})();
