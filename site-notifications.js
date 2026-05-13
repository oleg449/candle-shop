(function () {
  const ICONS = {
    success: '✓',
    error: '!',
    warning: '!',
    info: 'i'
  };

  const DEFAULTS = {
    type: 'info',
    duration: 4200
  };

  let container;

  function injectStyles() {
    if (document.getElementById('site-notification-styles')) return;

    const style = document.createElement('style');
    style.id = 'site-notification-styles';
    style.textContent = `
      .site-toast-region {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 2147483000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: min(390px, calc(100vw - 28px));
        pointer-events: none;
      }

      .site-toast {
        display: grid;
        grid-template-columns: 34px 1fr 28px;
        gap: 12px;
        align-items: start;
        padding: 14px 14px 14px 13px;
        color: #3f2a1c;
        background:
          linear-gradient(135deg, rgba(255, 250, 243, 0.98), rgba(255, 246, 232, 0.98));
        border: 1px solid rgba(185, 130, 90, 0.28);
        border-left: 4px solid #c58b5f;
        border-radius: 8px;
        box-shadow: 0 18px 45px rgba(69, 43, 26, 0.18), 0 4px 14px rgba(69, 43, 26, 0.10);
        opacity: 0;
        transform: translate3d(18px, -10px, 0) scale(0.98);
        transition: opacity 240ms ease, transform 240ms ease;
        pointer-events: auto;
        overflow: hidden;
      }

      .site-toast.is-visible {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
      }

      .site-toast.is-leaving {
        opacity: 0;
        transform: translate3d(18px, -8px, 0) scale(0.98);
      }

      .site-toast__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        color: #fff;
        background: #c58b5f;
        font-family: Arial, sans-serif;
        font-size: 17px;
        font-weight: 700;
        line-height: 1;
      }

      .site-toast__body {
        min-width: 0;
        padding-top: 1px;
      }

      .site-toast__message {
        margin: 0;
        color: #3f2a1c;
        font-family: "Open Sans", Arial, sans-serif;
        font-size: 14px;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .site-toast__close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        margin: -4px -4px 0 0;
        border: 0;
        border-radius: 50%;
        color: #7b5a43;
        background: transparent;
        cursor: pointer;
        font-size: 22px;
        line-height: 1;
        transition: background-color 180ms ease, color 180ms ease;
      }

      .site-toast__close:hover {
        color: #3f2a1c;
        background: rgba(185, 130, 90, 0.14);
      }

      .site-toast--success {
        border-left-color: #58a66a;
      }

      .site-toast--success .site-toast__icon {
        background: #58a66a;
      }

      .site-toast--error {
        border-left-color: #d86957;
      }

      .site-toast--error .site-toast__icon {
        background: #d86957;
      }

      .site-toast--warning {
        border-left-color: #d89b37;
      }

      .site-toast--warning .site-toast__icon {
        background: #d89b37;
      }

      @media (max-width: 640px) {
        .site-toast-region {
          top: 12px;
          right: 12px;
          left: 12px;
          width: auto;
        }

        .site-toast {
          grid-template-columns: 32px 1fr 26px;
          padding: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureContainer() {
    injectStyles();

    container = document.querySelector('.site-toast-region');
    if (!container) {
      container = document.createElement('div');
      container.className = 'site-toast-region';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'false');
      document.body.appendChild(container);
    }

    return container;
  }

  function normalizeOptions(options) {
    if (typeof options === 'string') {
      return { ...DEFAULTS, type: options };
    }
    return { ...DEFAULTS, ...(options || {}) };
  }

  function cp1251Byte(char) {
    const code = char.charCodeAt(0);
    if (code <= 0x7f) return code;
    if (code >= 0x00a0 && code <= 0x00bf) return code;
    if (code >= 0x0410 && code <= 0x044f) return code - 0x0350;

    const map = {
      0x0402: 0x80, 0x0403: 0x81, 0x201a: 0x82, 0x0453: 0x83,
      0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
      0x20ac: 0x88, 0x2030: 0x89, 0x0409: 0x8a, 0x2039: 0x8b,
      0x040a: 0x8c, 0x040c: 0x8d, 0x040b: 0x8e, 0x040f: 0x8f,
      0x0452: 0x90, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
      0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
      0x2122: 0x99, 0x0459: 0x9a, 0x203a: 0x9b, 0x045a: 0x9c,
      0x045c: 0x9d, 0x045b: 0x9e, 0x045f: 0x9f, 0x040e: 0xa1,
      0x045e: 0xa2, 0x0408: 0xa3, 0x0490: 0xa5, 0x0401: 0xa8,
      0x0404: 0xaa, 0x0407: 0xaf, 0x0406: 0xb2, 0x0456: 0xb3, 0x0491: 0xb4,
      0x0451: 0xb8, 0x2116: 0xb9, 0x0454: 0xba, 0x0458: 0xbc,
      0x0405: 0xbd, 0x0455: 0xbe, 0x0457: 0xbf
    };

    return map[code] || null;
  }

  function fixMojibake(value) {
    const text = String(value || '');
    if (!/[РС][\u00a0-\u04ff]/.test(text) || typeof TextDecoder === 'undefined') {
      return text;
    }

    const bytes = [];
    for (const char of text) {
      const byte = cp1251Byte(char);
      if (byte === null) return text;
      bytes.push(byte);
    }

    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
      return /[А-Яа-яІіЇїЄєҐґ]/.test(decoded) ? decoded : text;
    } catch (_) {
      return text;
    }
  }

  function siteNotify(message, options) {
    const settings = normalizeOptions(options);
    const type = ICONS[settings.type] ? settings.type : DEFAULTS.type;
    const text = fixMojibake(message).trim();
    if (!text) return null;

    const host = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `site-toast site-toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    toast.innerHTML = `
      <span class="site-toast__icon" aria-hidden="true">${ICONS[type]}</span>
      <div class="site-toast__body">
        <p class="site-toast__message"></p>
      </div>
      <button class="site-toast__close" type="button" aria-label="Закрити">&times;</button>
    `;

    toast.querySelector('.site-toast__message').textContent = text;
    host.appendChild(toast);

    let removeTimer;
    let closeTimer;
    const close = () => {
      window.clearTimeout(removeTimer);
      window.clearTimeout(closeTimer);
      toast.classList.add('is-leaving');
      toast.classList.remove('is-visible');
      removeTimer = window.setTimeout(() => toast.remove(), 260);
    };

    toast.querySelector('.site-toast__close').addEventListener('click', close);
    window.requestAnimationFrame(() => toast.classList.add('is-visible'));

    if (settings.duration !== 0) {
      closeTimer = window.setTimeout(close, Number(settings.duration) || DEFAULTS.duration);
    }

    return { element: toast, close };
  }

  window.fixSiteMojibake = fixMojibake;

  function inferType(message) {
    const text = fixMojibake(message).toLowerCase();
    if (text.includes('помилка') || text.includes('ошибка') || text.includes('error') || text.includes('невірн')) {
      return 'error';
    }
    if (text.includes('успіш') || text.includes('дяку') || text.includes('додано') || text.includes('відправлено') || text.includes('підтверджено') || text.includes('оплату')) {
      return 'success';
    }
    if (text.includes('потрібно') || text.includes('увага') || text.includes('максимум') || text.includes('недостат')) {
      return 'warning';
    }
    return 'info';
  }

  window.siteNotify = siteNotify;
  window.showBonusNotification = function (message, options) {
    return siteNotify(message, { type: inferType(message), ...(options || {}) });
  };

  const nativeAlert = window.alert ? window.alert.bind(window) : null;
  window.nativeAlert = window.nativeAlert || nativeAlert;
  window.alert = function (message) {
    if (!document.body) {
      window.addEventListener('DOMContentLoaded', () => siteNotify(message, { type: inferType(message) }), { once: true });
      return;
    }
    siteNotify(message, { type: inferType(message) });
  };

  if (/\/(?:messages|admin)\.html$/i.test(window.location.pathname)) {
    try {
      localStorage.removeItem('siteNoticeIndicatorCount');
      localStorage.removeItem('siteNoticeIndicatorTarget');
    } catch (_) {}
  }
})();
