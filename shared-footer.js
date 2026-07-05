/**
 * Art Light — shared responsive footer.
 * The module injects isolated footer markup and styles on pages that include it.
 */
(function () {
  'use strict';

  var CONFIG = {
    logo: 'logo.png',
    logoAlt: 'Art Light',
    tagline: 'Ароматичні свічки ручної роботи, створені з любов’ю.',
    nav: [
      { label: 'Головна', href: 'index.html' },
      { label: 'Про нас', href: 'about.html' },
      { label: 'Контакти', href: 'contacts.html' },
      { label: 'Корисна інформація', href: 'info.html' },
      { label: 'Майстер-класи', href: 'index.html#homeMasterclasses' },
      { label: 'Подарункові сертифікати', href: 'index.html#homeCertificates' }
    ],
    social: [
      {
        label: 'Instagram',
        href: 'https://www.instagram.com/art_candel_light?utm_source=qr&igsh=cTR4Z3JzNmV5NjV5',
        external: true,
        icon: '<path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s0-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2Zm0 3.05A6.75 6.75 0 1 0 18.75 12 6.75 6.75 0 0 0 12 5.25Zm0 11.13A4.38 4.38 0 1 1 16.38 12 4.38 4.38 0 0 1 12 16.38Zm6.99-11.4a1.58 1.58 0 1 1-1.57-1.58 1.58 1.58 0 0 1 1.57 1.58Z"/>'
      },
      {
        label: 'Telegram',
        href: 'https://t.me/artlight',
        external: true,
        icon: '<path d="M21.94 4.9 18.9 19.2c-.23 1.02-.84 1.27-1.7.79l-4.7-3.46-2.27 2.18c-.25.25-.46.46-.94.46l.33-4.77 8.68-7.84c.38-.34-.08-.53-.59-.19L6.66 13.6l-4.62-1.45c-1-.31-1.02-1 .21-1.48l18.06-6.96c.83-.31 1.56.2 1.29 1.19Z"/>'
      },
      {
        label: 'Viber',
        href: 'viber://chat?number=%2B380972926197',
        external: true,
        icon: '<path d="M12 2C6.9 2 2.75 5.3 2.75 9.9c0 2.02.82 3.86 2.18 5.28-.2 1.3-.72 2.5-1.28 3.42-.2.32.06.72.43.64 1.6-.35 2.9-.94 3.9-1.55.98.28 2.02.43 3.02.43 5.1 0 9.25-3.3 9.25-7.9S17.1 2 12 2Zm0 14.3c-.9 0-1.82-.14-2.66-.4l-.5-.16-.45.27c-.55.33-1.2.66-1.92.9.26-.56.48-1.17.58-1.78l.1-.6-.44-.42C5.5 12.8 4.85 11.4 4.85 9.9c0-3.4 3.3-5.9 7.15-5.9s7.15 2.5 7.15 5.9-3.3 6.4-7.15 6.4Z"/>'
      },
      {
        label: 'Email',
        href: 'mailto:info@artlight.ua',
        external: false,
        icon: '<path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.24-8 5-8-5V6l8 5 8-5Z"/>'
      },
      {
        label: 'Телефон',
        href: 'tel:+380972926197',
        external: false,
        icon: '<path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z"/>'
      }
    ],
    contacts: [
      { label: 'info@artlight.ua', href: 'mailto:info@artlight.ua' },
      { label: '+38 (097) 292-61-97', href: 'tel:+380972926197' }
    ],
    legal: [
      { label: 'Політика конфіденційності', href: 'info.html#privacy' },
      { label: 'Публічна оферта', href: 'info.html#offer' },
      { label: 'Умови повернення', href: 'info.html#returns' }
    ],
    qr: [
      { img: 'QR1.jpg', label: 'Instagram QR' },
      { img: '', label: 'Telegram QR' },
      { img: '', label: 'Оплата QR' }
    ]
  };

  var CSS = [
    '.al-footer{',
    '  --footer-bg:#fff3e6;',
    '  --footer-bg-soft:#fff8f1;',
    '  --footer-text:#2e1e17;',
    '  --footer-muted:#7d6655;',
    '  --footer-accent:#b9825a;',
    '  --footer-accent-strong:#8b5e3c;',
    '  --footer-border:rgba(139,94,60,.2);',
    '  margin-top:64px;',
    '  padding:46px 20px 24px;',
    '  background:linear-gradient(180deg,var(--footer-bg-soft),var(--footer-bg));',
    '  border-top:1px solid rgba(139,94,60,.16);',
    '  color:var(--footer-text);',
    "  font-family:'Open Sans',Arial,sans-serif;",
    '  line-height:1.55;',
    '}',
    '.al-footer *{box-sizing:border-box;}',
    '.al-footer__inner{',
    '  width:min(1180px,100%);',
    '  margin:0 auto;',
    '  display:grid;',
    '  grid-template-columns:minmax(210px,1.15fr) repeat(4,minmax(160px,1fr));',
    '  gap:28px;',
    '  align-items:start;',
    '}',
    '.al-footer__col{',
    '  min-width:0;',
    '  display:flex;',
    '  flex-direction:column;',
    '  align-items:flex-start;',
    '  gap:12px;',
    '}',
    '.al-footer__logo{',
    '  display:block;',
    '  max-width:170px;',
    '  max-height:60px;',
    '  width:auto;',
    '  height:auto;',
    '  object-fit:contain;',
    '}',
    '.al-footer__tagline{',
    '  max-width:290px;',
    '  margin:0;',
    '  color:var(--footer-muted);',
    '  font-size:14px;',
    '}',
    '.al-footer h3{',
    '  margin:0;',
    '  color:var(--footer-text)!important;',
    "  font-family:'Open Sans',Arial,sans-serif!important;",
    '  font-size:13px;',
    '  font-weight:800;',
    '  line-height:1.2;',
    '  letter-spacing:.08em;',
    '  text-transform:uppercase;',
    '}',
    '.al-footer ul{',
    '  list-style:none;',
    '  margin:0;',
    '  padding:0;',
    '  display:flex;',
    '  flex-direction:column;',
    '  align-items:flex-start;',
    '  gap:8px;',
    '}',
    '.al-footer a{',
    '  color:var(--footer-muted);',
    '  text-decoration:none;',
    '  transition:color .2s ease,transform .2s ease,background .2s ease,border-color .2s ease;',
    '}',
    '.al-footer__col a:hover{',
    '  color:var(--footer-accent-strong);',
    '  transform:translateX(2px);',
    '}',
    '.al-footer__socials{',
    '  display:flex;',
    '  flex-wrap:wrap;',
    '  gap:10px;',
    '}',
    '.al-footer__social{',
    '  width:40px;',
    '  height:40px;',
    '  border-radius:50%;',
    '  border:1px solid var(--footer-border);',
    '  background:rgba(255,255,255,.55);',
    '  color:var(--footer-accent-strong);',
    '  display:inline-flex;',
    '  align-items:center;',
    '  justify-content:center;',
    '}',
    '.al-footer__social:hover{',
    '  border-color:rgba(185,130,90,.55);',
    '  background:#fff;',
    '  color:var(--footer-accent);',
    '  transform:translateY(-2px);',
    '  box-shadow:0 10px 22px rgba(139,94,60,.12);',
    '}',
    '.al-footer__social svg{',
    '  width:19px;',
    '  height:19px;',
    '  fill:currentColor;',
    '}',
    '.al-footer__contacts{',
    '  display:flex;',
    '  flex-direction:column;',
    '  align-items:flex-start;',
    '  gap:6px;',
    '  font-size:14px;',
    '}',
    '.al-footer__qr-grid{',
    '  width:100%;',
    '  display:grid;',
    '  grid-template-columns:repeat(auto-fill,minmax(82px,1fr));',
    '  gap:10px;',
    '}',
    '.al-footer__qr{',
    '  appearance:none;',
    '  aspect-ratio:1/1;',
    '  min-height:82px;',
    '  border:1px dashed rgba(139,94,60,.34);',
    '  border-radius:14px;',
    '  background:rgba(255,255,255,.45);',
    '  color:var(--footer-muted);',
    '  display:flex;',
    '  align-items:center;',
    '  justify-content:center;',
    '  overflow:hidden;',
    '  padding:8px;',
    '  text-align:center;',
    '  font:inherit;',
    '}',
    '.al-footer__qr:hover{',
    '  border-color:var(--footer-accent);',
    '  background:#fff;',
    '}',
    'button.al-footer__qr{',
    '  cursor:pointer;',
    '  transition:transform .2s ease, border-color .2s ease, background .2s ease, box-shadow .2s ease;',
    '}',
    'button.al-footer__qr:hover{',
    '  transform:translateY(-2px);',
    '  box-shadow:0 12px 26px rgba(139,94,60,.14);',
    '}',
    'button.al-footer__qr:focus-visible{',
    '  outline:3px solid rgba(185,130,90,.35);',
    '  outline-offset:3px;',
    '}',
    '.al-footer__qr img{',
    '  width:100%;',
    '  height:100%;',
    '  object-fit:contain;',
    '  border-radius:10px;',
    '  background:#fff;',
    '  padding:4px;',
    '}',
    '.al-footer__qr-ph{',
    '  display:flex;',
    '  flex-direction:column;',
    '  align-items:center;',
    '  gap:6px;',
    '  font-size:11px;',
    '}',
    '.al-footer__qr-ph svg{',
    '  width:30px;',
    '  height:30px;',
    '  stroke:rgba(139,94,60,.52);',
    '  fill:none;',
    '  stroke-width:1.6;',
    '}',
    'body.al-footer-modal-open{',
    '  overflow:hidden;',
    '}',
    '.al-footer-qr-modal[hidden]{',
    '  display:none!important;',
    '}',
    '.al-footer-qr-modal{',
    '  position:fixed;',
    '  inset:0;',
    '  z-index:9999;',
    '  display:grid;',
    '  place-items:center;',
    '  padding:clamp(18px,4vw,48px);',
    '  background:rgba(46,30,23,.78);',
    '  backdrop-filter:blur(12px);',
    '  -webkit-backdrop-filter:blur(12px);',
    '}',
    '.al-footer-qr-modal__panel{',
    '  position:relative;',
    '  width:min(720px,100%);',
    '  max-height:100%;',
    '  display:flex;',
    '  flex-direction:column;',
    '  align-items:center;',
    '  gap:18px;',
    '  padding:clamp(18px,4vw,34px);',
    '  border:1px solid rgba(255,255,255,.45);',
    '  border-radius:28px;',
    '  background:linear-gradient(180deg,#fffaf4,#fff);',
    '  box-shadow:0 30px 90px rgba(0,0,0,.38);',
    '}',
    '.al-footer-qr-modal__image{',
    '  width:min(560px,100%);',
    '  max-height:min(70vh,620px);',
    '  object-fit:contain;',
    '  border-radius:20px;',
    '  background:#fff;',
    '  padding:14px;',
    '  box-shadow:inset 0 0 0 1px rgba(139,94,60,.12),0 16px 42px rgba(139,94,60,.18);',
    '}',
    '.al-footer-qr-modal__title{',
    '  margin:0;',
    '  padding:0 56px;',
    '  color:var(--footer-text);',
    '  font-size:clamp(18px,2.8vw,28px);',
    '  font-weight:700;',
    '  text-align:center;',
    '}',
    '.al-footer-qr-modal__close{',
    '  position:absolute;',
    '  top:16px;',
    '  right:16px;',
    '  z-index:10;',
    '  width:46px;',
    '  height:46px;',
    '  border:1px solid rgba(255,255,255,.55);',
    '  border-radius:50%;',
    '  background:rgba(255,255,255,.92);',
    '  color:#2e1e17;',
    '  cursor:pointer;',
    '  display:grid;',
    '  place-items:center;',
    '  font-size:0;',
    '  line-height:0;',
    '  padding:0;',
    '  box-shadow:0 12px 30px rgba(0,0,0,.25);',
    '}',
    '.al-footer-qr-modal__close::before,',
    '.al-footer-qr-modal__close::after{',
    '  content:"";',
    '  grid-area:1/1;',
    '  width:18px;',
    '  height:2.5px;',
    '  border-radius:999px;',
    '  background:currentColor;',
    '}',
    '.al-footer-qr-modal__close::before{',
    '  transform:rotate(45deg);',
    '}',
    '.al-footer-qr-modal__close::after{',
    '  transform:rotate(-45deg);',
    '}',
    '.al-footer-qr-modal__close:focus-visible{',
    '  outline:3px solid rgba(255,255,255,.7);',
    '  outline-offset:3px;',
    '}',
    '.al-footer__bottom{',
    '  width:min(1180px,100%);',
    '  margin:34px auto 0;',
    '  padding-top:18px;',
    '  border-top:1px solid var(--footer-border);',
    '  display:flex;',
    '  flex-wrap:wrap;',
    '  align-items:center;',
    '  justify-content:space-between;',
    '  gap:8px 20px;',
    '  color:var(--footer-muted);',
    '  font-size:13px;',
    '}',
    '@media (max-width:980px){',
    '  .al-footer__inner{',
    '    grid-template-columns:repeat(2,minmax(0,1fr));',
    '  }',
    '}',
    '@media (max-width:600px){',
    '  .al-footer{',
    '    margin-top:44px;',
    '    padding:36px 18px 22px;',
    '    text-align:center;',
    '  }',
    '  .al-footer__inner{',
    '    grid-template-columns:1fr;',
    '    gap:26px;',
    '  }',
    '  .al-footer__col{',
    '    align-items:center;',
    '  }',
    '  .al-footer ul,',
    '  .al-footer__contacts{',
    '    align-items:center;',
    '  }',
    '  .al-footer__tagline{',
    '    margin:0 auto;',
    '  }',
    '  .al-footer__qr-grid{',
    '    max-width:330px;',
    '    margin:0 auto;',
    '  }',
    '  .al-footer__col a:hover{',
    '    transform:none;',
    '  }',
    '  .al-footer__bottom{',
    '    flex-direction:column;',
    '    justify-content:center;',
    '    text-align:center;',
    '  }',
    '  .al-footer-qr-modal__panel{',
    '    border-radius:22px;',
    '  }',
    '  .al-footer-qr-modal__image{',
    '    max-height:64vh;',
    '  }',
    '}'
  ].join('');

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function externalAttrs(item) {
    return item && item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
  }

  function listItems(items) {
    return items.map(function (item) {
      return '<li><a href="' + esc(item.href) + '"' + externalAttrs(item) + '>' + esc(item.label) + '</a></li>';
    }).join('');
  }

  function buildSocials() {
    return CONFIG.social.map(function (item) {
      return '<a class="al-footer__social" href="' + esc(item.href) + '"' + externalAttrs(item) +
        ' aria-label="' + esc(item.label) + '" title="' + esc(item.label) + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + item.icon + '</svg></a>';
    }).join('');
  }

  function buildContacts() {
    return CONFIG.contacts.map(function (item) {
      return '<a href="' + esc(item.href) + '">' + esc(item.label) + '</a>';
    }).join('');
  }

  function buildQr() {
    var placeholder = '<span class="al-footer__qr-ph">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/>' +
      '<rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>' +
      '<path d="M14 14h3v3M21 14v7M17 21h4M14 19v2"/></svg><span>QR-код</span></span>';

    return CONFIG.qr.map(function (item) {
      var content = item && item.img
        ? '<img src="' + esc(item.img) + '" alt="' + esc(item.label || 'QR-код') + '" loading="lazy">'
        : placeholder;
      if (item && item.img) {
        return '<button class="al-footer__qr" type="button" data-qr-src="' + esc(item.img) +
          '" data-qr-label="' + esc(item.label || 'QR') + '" aria-label="Open ' +
          esc(item.label || 'QR') + '">' + content + '</button>';
      }
      return '<div class="al-footer__qr">' + content + '</div>';
    }).join('');
  }

  function buildQrModal() {
    return '' +
      '<div class="al-footer-qr-modal" hidden role="dialog" aria-modal="true" aria-labelledby="al-footer-qr-modal-title">' +
        '<div class="al-footer-qr-modal__panel">' +
          '<button class="al-footer-qr-modal__close" type="button" aria-label="Close QR">&times;</button>' +
          '<p class="al-footer-qr-modal__title" id="al-footer-qr-modal-title">QR</p>' +
          '<img class="al-footer-qr-modal__image" src="" alt="QR" loading="eager">' +
        '</div>' +
      '</div>';
  }

  function buildFooter() {
    var year = new Date().getFullYear();

    return '' +
      '<footer class="al-footer" role="contentinfo">' +
        '<div class="al-footer__inner">' +
          '<div class="al-footer__col al-footer__brand">' +
            '<img class="al-footer__logo" src="' + esc(CONFIG.logo) + '" alt="' + esc(CONFIG.logoAlt) + '" loading="lazy">' +
            '<p class="al-footer__tagline">' + esc(CONFIG.tagline) + '</p>' +
          '</div>' +
          '<div class="al-footer__col" role="navigation" aria-label="Навігація сайту">' +
            '<h3>Навігація</h3>' +
            '<ul>' + listItems(CONFIG.nav) + '</ul>' +
          '</div>' +
          '<div class="al-footer__col">' +
            '<h3>Контакти</h3>' +
            '<div class="al-footer__socials">' + buildSocials() + '</div>' +
            '<div class="al-footer__contacts">' + buildContacts() + '</div>' +
          '</div>' +
          '<div class="al-footer__col" role="navigation" aria-label="Юридична інформація">' +
            '<h3>Інформація</h3>' +
            '<ul>' + listItems(CONFIG.legal) + '</ul>' +
          '</div>' +
          '<div class="al-footer__col">' +
            '<h3>QR-коди</h3>' +
            '<div class="al-footer__qr-grid">' + buildQr() + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="al-footer__bottom">' +
          '<span>&copy; ' + year + ' Art Light — Всі права захищені</span>' +
          '<span>Зроблено з любов’ю в Україні</span>' +
        '</div>' +
      '</footer>';
  }

  function injectStyles() {
    if (document.getElementById('al-footer-styles')) return;

    var style = document.createElement('style');
    style.id = 'al-footer-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function bindQrModal() {
    var footer = document.querySelector('.al-footer');
    if (!footer || footer.getAttribute('data-qr-modal-ready') === 'true') return;

    footer.setAttribute('data-qr-modal-ready', 'true');

    var modalWrap = document.createElement('div');
    modalWrap.innerHTML = buildQrModal();
    var modal = modalWrap.firstChild;
    var image = modal.querySelector('.al-footer-qr-modal__image');
    var title = modal.querySelector('.al-footer-qr-modal__title');
    var close = modal.querySelector('.al-footer-qr-modal__close');
    var activeTrigger = null;

    document.body.appendChild(modal);

    function openModal(trigger) {
      activeTrigger = trigger;
      var src = trigger.getAttribute('data-qr-src');
      var label = trigger.getAttribute('data-qr-label') || 'QR';

      image.src = src;
      image.alt = label;
      title.textContent = label;
      modal.hidden = false;
      document.body.classList.add('al-footer-modal-open');
      close.focus();
    }

    function closeModal() {
      if (modal.hidden) return;

      modal.hidden = true;
      image.removeAttribute('src');
      document.body.classList.remove('al-footer-modal-open');
      if (activeTrigger) activeTrigger.focus();
      activeTrigger = null;
    }

    footer.addEventListener('click', function (event) {
      var trigger = event.target.closest ? event.target.closest('button.al-footer__qr[data-qr-src]') : null;
      if (!trigger || !footer.contains(trigger)) return;
      openModal(trigger);
    });

    modal.addEventListener('click', function (event) {
      if (event.target === modal || event.target === close) closeModal();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeModal();
    });
  }

  function render() {
    if (document.querySelector('.al-footer')) return;

    injectStyles();

    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildFooter();
    document.body.appendChild(wrapper.firstChild);
    bindQrModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
