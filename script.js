/* const productsData = [
  {
    title: "Свічка «Солодкий рай»",
    images: ["1.jpg"],
    description: "Солодкий аромат ванілі та фруктів. Ідеально для затишку.",
    price: 150
  },
  {
    title: "Свічка «Шоколадний мафін»",
    images: ["2.jpg"],
    description: "Аромат свіжої випічки з нотками шоколаду.",
    price: 170
  },
  {
    title: "Свічка «Ягідний десерт»",
    images: ["3.jpg"],
    description: "Ягідна композиція для романтичного вечора.",
    price: 160
  },
  {
    title: "Свічка «Гранатовий сидр»",
    images: ["garnet1.jpg", "garnet2.jpg", "garnet3.jpg"],
    description: "Соковитий гранат із пряними нотами — яскравий аромат сезону.",
    price: 225
  },
  {
    title: "Свічка «Limoncello Crème»",
    images: ["limoncello1.jpg", "limoncello2.jpg", "limoncello3.jpg"],
    description: "Свіжий лимон з вершковим кремом. Літній настрій у банці.",
    price: 350
  },
  {
    title: "Свічка «Coconut»",
    images: ["coconut1.jpg", "coconut2.jpg", "coconut3.jpg"],
    description: "Кокосова ніжність із тропічним ароматом.",
    price: 280
  },
  {
    title: "Свічка «Бавовна та Ірис»",
    images: ["6.jpg"],
    description: "Легкий аромат бавовни з квітковими нотками ірису.",
    price: 225
  },

{
  title: "Свічка «Toskana»",
  images: ["toskana1.jpg", "toskana2.jpg", "toskana3.jpg"],
  description: "Серія ароматичних свічок з італійським шармом Тоскани.",
  price: 265
},
{
  title: "Свічка «Roses»",
  images: ["roses1.jpg", "roses2.jpg", "roses3.jpg"],
  description: "Романтична серія з ароматом троянд. Ідеально для вечора.",
  price: 240
},
{
  title: "Свічка «Heart Collection»",
  images: ["heart1.jpg", "heart2.jpg", "heart3.jpg"],
  description: "Подарункові свічки у формі серця для особливих моментів.",
  price: 220
}

function bindSearchSortHandlers() {
  const sel = document.getElementById('mobileSearchCategory');
  if (!sel) return;
  sel.addEventListener('change', () => {
    currentCategory = sel.value || 'all';
    updateChipsActiveState();
    currentPage = 1;
      resetVisibleProducts();
      renderProductsPage(currentPage);
  });
  const sortSel = document.getElementById('mobileSearchSort');
  if (sortSel) {
    sortSel.addEventListener('change', () => {
      sortOption = sortSel.value || 'relevance';
      currentPage = 1;
      resetVisibleProducts();
      renderProductsPage(currentPage);
    });
  }
}

// Render dropdown to sort/filter by categories in the mobile drawer
function renderSearchSort() {
  const host = document.querySelector('.mobile-search-sort');
  if (!host) return;
  const categories = getCategoriesFromProducts();
  const options = ['<option value="all">Всі категорії</option>']
    .concat(categories.map(c => `<option value="${(c||'').replace(/"/g,'&quot;')}">${c}</option>`))
    .join('');
  host.innerHTML = `
    <div class="sort-row">
      <label for="mobileSearchCategory">Категорія</label>
      <select id="mobileSearchCategory">${options}</select>
    </div>
    <div class="sort-row">
      <label for="mobileSearchSort">Сортування</label>
      <select id="mobileSearchSort">
        <option value="relevance">За релевантністю</option>
        <option value="price_low">Ціна: за зростанням</option>
        <option value="price_high">Ціна: за спаданням</option>
        <option value="discount">Знижка: спочатку більша</option>
        <option value="new">Спочатку новинки</option>
        <option value="name">Назва: A→Я</option>
      </select>
    </div>
  `;
  const sel = host.querySelector('#mobileSearchCategory');
  if (sel) {
    sel.value = currentCategory || 'all';
  }
  const sSel = host.querySelector('#mobileSearchSort');
  if (sSel) sSel.value = sortOption || 'relevance';
}

// Build unique, sorted categories from loaded products
function getCategoriesFromProducts() {
  try {
    const cats = new Set();
    (allProducts || []).forEach(p => {
      if (p && typeof p.category === 'string' && p.category.trim()) {
        cats.add(p.category.trim());
      }
    });
    return Array.from(cats).sort((a,b)=>a.localeCompare(b));
  } catch(_) { return []; }
}

// Render chips inside the mobile drawer: special filters + real categories + clear
function renderSearchChips() {
  const wrap = document.querySelector('.mobile-search-chips');
  if (!wrap) return;
  const categories = getCategoriesFromProducts();
  // Build HTML
  let html = '';
  // Special chips
  html += '<button type="button" class="chip" data-special="new">Новинки</button>';
  html += '<button type="button" class="chip" data-special="discount">Зі знижкою</button>';
  // Category chips
  categories.forEach(cat => {
    const safe = (cat||'').replace(/"/g, '&quot;');
    html += `<button type="button" class="chip" data-category="${safe}">${safe}</button>`;
  });
  // Clear chip
  html += '<button type="button" class="chip clear" data-clear="true">Очистити</button>';
  wrap.innerHTML = html;
  // Apply active states
  updateChipsActiveState();
}

// Toggle .active class on chips according to current filters
function updateChipsActiveState() {
  const wrap = document.querySelector('.mobile-search-chips');
  if (!wrap) return;
  wrap.querySelectorAll('.chip').forEach(btn => {
    btn.classList.remove('active');
  });
  // Special states
  const newChip = wrap.querySelector('.chip[data-special="new"]');
  const discChip = wrap.querySelector('.chip[data-special="discount"]');
  if (newChip && searchByNew) newChip.classList.add('active');
  if (discChip && searchByDiscount) discChip.classList.add('active');
  // Category state
  if (currentCategory && currentCategory !== 'all') {
    const catChip = wrap.querySelector(`.chip[data-category="${CSS.escape(currentCategory)}"]`);
    if (catChip) catChip.classList.add('active');
  }
  // Sync category select if present
  const sel = document.getElementById('mobileSearchCategory');
  if (sel) sel.value = currentCategory || 'all';
}

];

*/


let cart = [];

function hasActiveAccountSession() {
  if (typeof isLoggedIn === 'function') {
    try {
      if (isLoggedIn()) return true;
    } catch (_) {}
  }

  if (localStorage.getItem('authToken') || localStorage.getItem('token')) {
    return true;
  }

  if (localStorage.getItem('sessionActive') === 'true') {
    try {
      return !!JSON.parse(localStorage.getItem('userData') || 'null');
    } catch (_) {
      return false;
    }
  }

  return false;
}

// === Mobile Search (chips + sort) ===
// Build unique, sorted categories from loaded products
function getCategoriesFromProducts() {
  try {
    const cats = new Set();
    (allProducts || []).forEach(p => {
      if (p && typeof p.category === 'string' && p.category.trim()) {
        cats.add(p.category.trim());
      }
    });
    return Array.from(cats).sort((a,b)=>a.localeCompare(b));
  } catch(_) { return []; }
}

// Toggle .active class on chips according to current filters
function updateChipsActiveState() {
  const wrap = document.querySelector('.mobile-search-chips');
  if (!wrap) return;
  wrap.querySelectorAll('.chip').forEach(btn => btn.classList.remove('active'));
  const newChip = wrap.querySelector('.chip[data-special="new"]');
  const discChip = wrap.querySelector('.chip[data-special="discount"]');
  if (newChip && window.searchByNew) newChip.classList.add('active');
  if (discChip && window.searchByDiscount) discChip.classList.add('active');
  if (window.currentCategory && window.currentCategory !== 'all') {
    const esc = (v)=> (window.CSS && CSS.escape) ? CSS.escape(v) : String(v).replace(/"/g,'\\"');
    const catChip = wrap.querySelector(`.chip[data-category="${esc(window.currentCategory)}"]`);
    if (catChip) catChip.classList.add('active');
  }
  const sel = document.getElementById('mobileSearchCategory');
  if (sel) sel.value = window.currentCategory || 'all';
}

// Render chips inside the mobile drawer: special filters + categories + clear
function renderSearchChips() {
  const wrap = document.querySelector('.mobile-search-chips');
  if (!wrap) return;
  const categories = getCategoriesFromProducts();
  let html = '';
  html += '<button type="button" class="chip" data-special="new">Новинки</button>';
  html += '<button type="button" class="chip" data-special="discount">Зі знижкою</button>';
  categories.forEach(cat => {
    const safe = (cat||'').replace(/"/g, '&quot;');
    html += `<button type="button" class="chip" data-category="${safe}">${safe}</button>`;
  });
  html += '<button type="button" class="chip clear" data-clear="true">Очистити</button>';
  wrap.innerHTML = html;
  updateChipsActiveState();
}

// Render dropdowns for mobile sort/filter
function renderSearchSort() {
  const host = document.querySelector('.mobile-search-sort');
  if (!host) return;
  const categories = getCategoriesFromProducts();
  const options = ['<option value="all">Всі категорії</option>']
    .concat(categories.map(c => `<option value="${(c||'').replace(/"/g,'&quot;')}">${c}</option>`))
    .join('');
  host.innerHTML = `
    <div class="sort-row">
      <label for="mobileSearchCategory">Категорія</label>
      <select id="mobileSearchCategory">${options}</select>
    </div>
    <div class="sort-row">
      <label for="mobileSearchSort">Сортування</label>
      <select id="mobileSearchSort">
        <option value="relevance">За релевантністю</option>
        <option value="price_low">Ціна: за зростанням</option>
        <option value="price_high">Ціна: за спаданням</option>
        <option value="discount">Знижка: спочатку більша</option>
        <option value="new">Спочатку новинки</option>
        <option value="name">Назва: A→Я</option>
      </select>
    </div>
  `;
  const sSel = host.querySelector('#mobileSearchSort');
  if (sSel) sSel.value = window.sortOption || 'relevance';
  const cSel = host.querySelector('#mobileSearchCategory');
  if (cSel) cSel.value = window.currentCategory || 'all';
}

// Bind change handlers for mobile search controls
function bindSearchSortHandlers() {
  // defaults
  if (typeof window.searchByNew === 'undefined') window.searchByNew = false;
  if (typeof window.searchByDiscount === 'undefined') window.searchByDiscount = false;
  if (typeof window.currentCategory === 'undefined') window.currentCategory = 'all';
  if (typeof window.sortOption === 'undefined') window.sortOption = 'relevance';

  const chipsWrap = document.querySelector('.mobile-search-chips');
  if (chipsWrap) {
    chipsWrap.addEventListener('click', (ev) => {
      const chip = ev.target.closest('.chip');
      if (!chip) return;
      if (chip.hasAttribute('data-clear')) {
        if (window.mobileInput) mobileInput.value = '';
        if (window.searchInput) searchInput.value = '';
        window.searchQuery = '';
        window.searchByNew = false;
        window.searchByDiscount = false;
        window.currentCategory = 'all';
        updateChipsActiveState();
        window.currentPage = 1;
        resetVisibleProducts();
        renderProductsPage(window.currentPage);
        const hint = document.getElementById('mobileSearchHint');
        if (hint) hint.style.opacity = '1';
        return;
      }
      if (chip.hasAttribute('data-special')) {
        const spec = chip.getAttribute('data-special');
        if (spec === 'new') window.searchByNew = !window.searchByNew;
        if (spec === 'discount') window.searchByDiscount = !window.searchByDiscount;
        updateChipsActiveState();
        window.currentPage = 1;
        resetVisibleProducts();
        renderProductsPage(window.currentPage);
        return;
      }
      if (chip.hasAttribute('data-category')) {
        const cat = chip.getAttribute('data-category');
        window.currentCategory = cat || 'all';
        updateChipsActiveState();
        window.currentPage = 1;
        resetVisibleProducts();
        renderProductsPage(window.currentPage);
        return;
      }
    });
  }

  const sel = document.getElementById('mobileSearchCategory');
  if (sel) sel.addEventListener('change', () => { window.currentCategory = sel.value || 'all'; window.currentPage = 1; resetVisibleProducts(); updateChipsActiveState(); renderProductsPage(window.currentPage); });
  const sortSel = document.getElementById('mobileSearchSort');
  if (sortSel) sortSel.addEventListener('change', () => { window.sortOption = sortSel.value || 'relevance'; window.currentPage = 1; resetVisibleProducts(); renderProductsPage(window.currentPage); });
}

// Helper to safely parse prices from various formats (e.g., "400", "400 ₴", "400.50", "400,50")
function parsePrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    // Keep digits, dot, comma, and minus; convert comma to dot for decimals
    const cleaned = value.replace(/[^0-9,.-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return Number.isNaN(num) ? 0 : num;
  }
  return 0;
}

// --- Dynamic pricing for custom-order candle ---
// You can tune these constants to match your business rules
const CUSTOM_ORDER_MATERIAL_PRICING = {
  // Material adjustments in UAH
  massage: 50,
  soy: 0
};
const CUSTOM_ORDER_COLOR_PRICING = {
  // Color adjustments in UAH
  white: 0,
  yellow: 15,
  red: 15,
  green: 15,
  blue: 15,
  violet: 15
};

function getBasePriceForTitle(title, fallbackPrice) {
  try {
    const p = (window.productsData || []).find(pp => pp && pp.title === title);
    if (p && Number.isFinite(p.price)) return Number(p.price);
  } catch(e) { /* ignore */ }
  return Number(fallbackPrice) || 0;
}

function isCustomOrderItem(item) {
  return !!(item && (item.isCustomOrder || item.title === 'Свічка під замовлення'));
}

function calcCustomOrderPrice(item) {
  if (!isCustomOrderItem(item)) return Number(item?.price) || 0;
  const base = Number(item?.basePrice) || Number(item?.price) || 0;
  const matAdd = CUSTOM_ORDER_MATERIAL_PRICING[item?.material] ?? 0;
  const colAdd = CUSTOM_ORDER_COLOR_PRICING[item?.color] ?? 0;
  return base + matAdd + colAdd;
}

// --- Custom Order Modal helpers ---
const CUSTOM_ORDER_BASE_PRICE = 200; // Base shown in modal and used for custom candle configured via modal

function openCustomOrderModal() {
  const modal = document.getElementById('customOrderModal');
  const matSel = document.getElementById('materialSelect');
  const colSel = document.getElementById('colorSelect');
  const details = document.getElementById('customOrderDetails');
  try {
    if (matSel) matSel.value = 'soy';
    if (colSel) colSel.value = 'white';
    if (typeof updateFormColorLock === 'function') updateFormColorLock();
    if (typeof renderMaterialSwatches === 'function') renderMaterialSwatches();
    if (typeof renderColorSwatches === 'function') renderColorSwatches();
    if (details) details.value = '';
    updateCustomModalPrice();
  } catch(e) { /* no-op */ }
  if (modal) modal.style.display = 'block';
}

function closeCustomOrderModal() {
  const modal = document.getElementById('customOrderModal');
  if (modal) modal.style.display = 'none';
}

function calcCustomModalPrice(material, color) {
  const matAdd = CUSTOM_ORDER_MATERIAL_PRICING[material] ?? 0;
  const colAdd = CUSTOM_ORDER_COLOR_PRICING[color] ?? 0;
  return CUSTOM_ORDER_BASE_PRICE + matAdd + colAdd;
}

function updateCustomModalPrice() {
  const matSel = document.getElementById('materialSelect');
  const colSel = document.getElementById('colorSelect');
  const priceEl = document.getElementById('customCurrentPrice');
  if (!matSel || !colSel || !priceEl) return;
  const p = calcCustomModalPrice(matSel.value, colSel.value);
  priceEl.textContent = `₴${p}`;
}

function addToCart(title, price) {
  const safeTitle = (title == null ? '' : String(title)).trim() || 'Товар';
  const safePrice = parsePrice(price);

  // enrich from productsData (flags like isSet, isCustomOrder, items)
  const baseProduct = (window.productsData || []).find(p => p.title === safeTitle) || {};
  const existing = cart.find(item => item.title === safeTitle);
  if (existing) {
    if (existing.quantity < 10) {
      existing.quantity += 1;
    } else {
      alert("Максимум 10 одиниць одного товару.");
      return;
    }
  } else {
    const meta = {};
    if (baseProduct.isSet) {
      meta.isSet = true;
      meta.setItems = Array.isArray(baseProduct.items) ? baseProduct.items : [];
    }
    if (baseProduct.isCustomOrder) {
      meta.isCustomOrder = true;
    }
    // preserve basePrice for dynamic pricing later
    const basePrice = getBasePriceForTitle(safeTitle, safePrice);
    cart.push({ title: safeTitle, price: safePrice, basePrice, quantity: 1, ...meta });
  }
  updateCartCount();
  showCartNotification();
}

function addCertificateToCart(stars) {
  const certStars = parseInt(stars, 10) || 0;
  if (!certStars) return;
  const title = `Подарунковий сертифікат ${certStars} грн`;
  const existing = cart.find(item => item.isCertificate && Number(item.certificateStars) === certStars);
  if (existing) {
    if (existing.quantity >= 10) {
      alert("Максимум 10 одиниць одного товару.");
      return;
    }
    existing.quantity += 1;
  } else {
    cart.push({
      title,
      price: certStars,
      basePrice: certStars,
      quantity: 1,
      isCertificate: true,
      certificateStars: certStars
    });
  }
  updateCartCount();
  showCartNotification();
}

function addMasterclassToCart(buttonEl) {
  const title = buttonEl?.dataset?.title || 'Майстер-клас';
  const price = buttonEl?.dataset?.price || 0;
  const id = buttonEl?.dataset?.id || '';
  const video = buttonEl?.dataset?.video || '';
  try {
    const map = JSON.parse(localStorage.getItem('masterclassMap') || '{}');
    map[title] = { id, video, title };
    localStorage.setItem('masterclassMap', JSON.stringify(map));
    window.masterclassMap = map;
  } catch (error) {
    console.warn('Failed to persist masterclassMap:', error);
  }
  addToCart(title, price);
}


function addFromModalToCart(title, price) {
  const input = document.querySelector('#productModalContent input[type="number"]');
  const quantity = parseInt(input.value);

  const safeTitle = (title == null ? '' : String(title)).trim() || 'Товар';
  const safePrice = parsePrice(price);

  const baseProduct = (window.productsData || []).find(p => p.title === safeTitle) || {};
  const existing = cart.find(item => item.title === safeTitle);
  if (existing) {
    if (existing.quantity + quantity > 10) {
      alert("Максимум 10 одиниць одного товару.");
      existing.quantity = 10;
    } else {
      existing.quantity += quantity;
    }
  } else {
    const meta = {};
    if (baseProduct.isSet) {
      meta.isSet = true;
      meta.setItems = Array.isArray(baseProduct.items) ? baseProduct.items : [];
    }
    if (baseProduct.isCustomOrder) {
      meta.isCustomOrder = true;
    }
    const basePrice = getBasePriceForTitle(safeTitle, safePrice);
    cart.push({ title: safeTitle, price: safePrice, basePrice, quantity, ...meta });
  }

  updateCartCount();
  showAddToCartNotification(); // ПРАВИЛЬНО!
}


 
function getProductPriceByTitle(title) {
  const productElement = [...document.querySelectorAll('.product')].find(el => el.querySelector('h3').textContent === title);
  if (!productElement) return 0;
  const priceText = productElement.querySelector('p').textContent.replace('₴', '');
  return parseInt(priceText);
}


function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("cartCount").textContent = count;
}

function openCart() {
  // Auth guard: require login to open the cart
  if (!hasActiveAccountSession()) {
    if (confirm('Щоб відкрити кошик, потрібно увійти в акаунт. Перейти на сторінку входу?')) {
      window.location.href = 'auth.html';
    }
    return;
  }

  const cartItemsContainer = document.getElementById("cartItems");
  cartItemsContainer.innerHTML = "";

  let subtotal = 0;
  cart.forEach(item => {
    const perUnit = isCustomOrderItem(item) ? calcCustomOrderPrice(item) : Number(item.price) || 0;
    subtotal += perUnit * (Number(item.quantity) || 0);
  });

  // Display cart items
  cart.forEach((item, index) => {
    const unitPrice = isCustomOrderItem(item) ? calcCustomOrderPrice(item) : Number(item.price) || 0;
    const itemTotal = unitPrice * (Number(item.quantity) || 0);
    const itemDiv = document.createElement("div");
    itemDiv.className = "cart-item";
    
    // Check if this is the custom candle product
    const isCustomCandle = isCustomOrderItem(item);
    
    // Generate HTML for the item
    let itemHTML = `
      <div class="item-info">
        <span class="item-name">${item.title}</span>
        <span class="item-price">₴${unitPrice} × ${item.quantity} = ₴${itemTotal.toFixed(2)}</span>
      </div>
      <div class="item-controls">
        <button onclick="changeQuantity(${index}, -1)">−</button>
        <span>${item.quantity}</span>
        <button onclick="changeQuantity(${index}, 1)">+</button>
        <button onclick="removeFromCart(${index})" class="remove-btn">🗑️</button>
      </div>
    `;
    
    itemDiv.innerHTML = itemHTML;
    // If custom-order candle, do NOT render additional per-item inputs (disabled by request)
    if (false && isCustomCandle) {
      const customDiv = document.createElement('div');
      customDiv.className = 'custom-order-config';
      const matVal = item.material || '';
      const colorVal = item.color || '';
      const volumeVal = item.volume || '';
      const aromaVal = item.aroma || '';
      const notesVal = item.notes || '';
      customDiv.innerHTML = `
        <div class="co-card">
          <div class="co-title">Налаштування свічки</div>
          <div class="co-grid">
            <div class="co-field">
              <label class="co-label">Матеріал</label>
              <select class="co-select co-material">
                <option value="massage" ${matVal==='massage'?'selected':''}>Масажний</option>
                <option value="soy" ${matVal==='soy'?'selected':''}>Соєвий</option>
              </select>
            </div>
            <div class="co-field">
              <label class="co-label">Колір</label>
              <select class="co-select co-color">
                <option value="white" ${colorVal==='white'?'selected':''}>Білий</option>
                <option value="yellow" ${colorVal==='yellow'?'selected':''}>Жовтий</option>
                <option value="red" ${colorVal==='red'?'selected':''}>Червоний</option>
                <option value="green" ${colorVal==='green'?'selected':''}>Зелений</option>
                <option value="blue" ${colorVal==='blue'?'selected':''}>Блакитний</option>
                <option value="violet" ${colorVal==='violet'?'selected':''}>Фіолетовий</option>
              </select>
            </div>
            <div class="co-field">
              <label class="co-label">Об'єм</label>
              <select class="co-select co-volume">
                <option value="50 мл" ${volumeVal==='50 мл'?'selected':''}>50 мл</option>
                <option value="100 мл" ${volumeVal==='100 мл'?'selected':''}>100 мл</option>
                <option value="200 мл" ${volumeVal==='200 мл'?'selected':''}>200 мл</option>
                <option value="300 мл" ${volumeVal==='300 мл'?'selected':''}>300 мл</option>
              </select>
            </div>
            <div class="co-field">
              <label class="co-label">Аромат</label>
              <select class="co-select co-aroma">
                <option value="Без аромату" ${aromaVal===''||aromaVal==='Без аромату'?'selected':''}>Без аромату</option>
                <option value="Ваніль" ${aromaVal==='Ваніль'?'selected':''}>Ваніль</option>
                <option value="Лаванда" ${aromaVal==='Лаванда'?'selected':''}>Лаванда</option>
                <option value="Кава" ${aromaVal==='Кава'?'selected':''}>Кава</option>
                <option value="Карамель" ${aromaVal==='Карамель'?'selected':''}>Карамель</option>
                <option value="Цитрус" ${aromaVal==='Цитрус'?'selected':''}>Цитрус</option>
                <option value="Кокос" ${aromaVal==='Кокос'?'selected':''}>Кокос</option>
              </select>
            </div>
            <div class="co-field co-notes-field">
              <label class="co-label">Побажання</label>
              <textarea class="co-textarea co-notes" rows="2" placeholder="Опишіть ваші побажання...">${notesVal}</textarea>
            </div>
          </div>
        </div>
      `;
      // Bind changes back to cart item
      setTimeout(() => {
        const selMat = customDiv.querySelector('.co-material');
        const selColor = customDiv.querySelector('.co-color');
        const selVol = customDiv.querySelector('.co-volume');
        const selAroma = customDiv.querySelector('.co-aroma');
        const taNotes = customDiv.querySelector('.co-notes');

        // Helper: lock color selection when massage wax is chosen
        const applyCartColorLock = () => {
          const isMassage = selMat && selMat.value === 'massage';
          if (!selColor) return;
          // Force white for massage, disable other choices visually
          if (isMassage) {
            selColor.value = 'white';
            cart[index].color = 'white';
            // Disable all non-white options
            Array.from(selColor.options).forEach(opt => {
              if (opt.value !== 'white') opt.disabled = true; else opt.disabled = false;
            });
          } else {
            Array.from(selColor.options).forEach(opt => opt.disabled = false);
          }
        };

        if (selMat) selMat.addEventListener('change', () => { cart[index].material = selMat.value; applyCartColorLock(); openCart(); });
        if (selColor) selColor.addEventListener('change', () => { cart[index].color = selColor.value; openCart(); });
        if (selVol) selVol.addEventListener('change', () => { cart[index].volume = selVol.value; });
        if (selAroma) selAroma.addEventListener('change', () => { cart[index].aroma = selAroma.value; });
        if (taNotes) taNotes.addEventListener('input', () => { cart[index].notes = taNotes.value; });
        // Apply lock on init
        applyCartColorLock();
      }, 0);
      itemDiv.appendChild(customDiv);
    }
    cartItemsContainer.appendChild(itemDiv);
  });

  // Add star spending section
  const bonusStars = window.bonusStars || 0; // Use global variable instead of localStorage
  // Determine if user has purchased stars via redeemed certificates (remove 60⭐ limit for such users)
  const hasPurchasedStars = (() => {
    try {
      const list = JSON.parse(localStorage.getItem('certCodes') || '[]');
      return Array.isArray(list) && list.some(c => c && c.redeemed);
    } catch(_) { return false; }
  })();

// ===== Safety fallback for side menu on all pages (About, Info, etc.) =====
try {
  // Capture-phase to beat other handlers that might stop propagation
  document.addEventListener('click', function(e){
    const openBtn = e.target && (e.target.closest && e.target.closest('#openMenu, #openMenuMobile'));
    const closeBtn = e.target && (e.target.closest && e.target.closest('#closeCategories'));
    const panel = document.getElementById('categoryPanel');
    if (!panel) return;
    if (openBtn) {
      e.preventDefault();
      e.stopPropagation();
      panel.classList.add('open');
      document.body.classList.add('category-open');
    } else if (closeBtn) {
      e.preventDefault();
      e.stopPropagation();
      panel.classList.remove('open');
      document.body.classList.remove('category-open');
    }
  }, true);
  // ESC to close
  document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape') { const panel = document.getElementById('categoryPanel'); if (panel) { panel.classList.remove('open'); document.body.classList.remove('category-open'); } } });
} catch(_) {}
  const maxStarsPerOrder = hasPurchasedStars ? Number.MAX_SAFE_INTEGER : 60;
  const maxStarsFromSubtotal = Math.floor(subtotal);
  const maxStarsToUse = Math.min(bonusStars, maxStarsFromSubtotal, maxStarsPerOrder);
  const displayMaxPerOrder = hasPurchasedStars ? 'без обмежень' : String(60);
  
  // Initialize currentStarDiscount if not set
  if (typeof window.currentStarDiscount === 'undefined') {
    window.currentStarDiscount = 0;
  }
  
  const starDiscountSection = document.createElement("div");
  starDiscountSection.className = "star-discount-section";
  starDiscountSection.innerHTML = `
    <div class="star-discount-header">
      <div class="star-icon">⭐</div>
      <h4>Бонусні бали</h4>
    </div>
    <div class="available-stars">
      <span>Доступно: <strong>${bonusStars} ⭐</strong><span class="mobile-hide"> (макс. ${displayMaxPerOrder}${hasPurchasedStars ? '' : ' ⭐'} за замовлення)</span></span>
      <span class="star-rate">1 ⭐ = 1 ₴ знижки</span>
      <div class="star-note" style="font-size:12px; color:#7a6a5a; margin-top:4px; line-height:1.4;">
        Ліміт: <strong>до 60 ⭐</strong> з <em>звичайних</em> бонусів на замовлення, та <strong>без обмежень</strong> для зірок із сертифікатів.
        Загальна знижка не може перевищувати суму замовлення.
      </div>
      <div class="star-note-compact">Ліміт: 60 ⭐ звичайні; сертифікат — без обмежень.</div>
    </div>
    <div class="use-stars">
      <label for="starsToUse">Скільки зірок використати? (${hasPurchasedStars ? 'макс. 60 для звичайних' : `макс. ${Math.min(maxStarsToUse, 60)}`})</label>
      <div class="star-input-group">
        <button type="button" class="star-btn" data-action="decrease">-10</button>
        <input type="number" 
               id="starsToUse" 
               min="0" 
               max="${maxStarsToUse}" 
               value="${window.currentStarDiscount || 0}" 
               onchange="updateStarDiscount(this.value, ${subtotal})"
               oninput="this.value = Math.min(Math.max(0, parseInt(this.value) || 0), ${maxStarsToUse}); updateStarDiscount(this.value, ${subtotal})">
        <button type="button" class="star-btn" data-action="increase">+10</button>
      </div>
      <div class="star-slider">
        <input type="range" 
               min="0" 
               max="${maxStarsToUse}" 
               value="${window.currentStarDiscount || 0}" 
               oninput="document.getElementById('starsToUse').value=this.value; updateStarDiscount(this.value, ${subtotal})">
      </div>
    </div>
  `;
  
  // Add event listeners for the +10/-10 buttons
  starDiscountSection.addEventListener('click', function(e) {
    if (e.target.matches('.star-btn[data-action="decrease"]')) {
      e.preventDefault();
      const newValue = Math.max(0, (window.currentStarDiscount || 0) - 10);
      updateStarDiscount(newValue, subtotal);
    } else if (e.target.matches('.star-btn[data-action="increase"]')) {
      e.preventDefault();
      const newValue = Math.min(maxStarsToUse, (window.currentStarDiscount || 0) + 10);
      updateStarDiscount(newValue, subtotal);
    }
  });
  
  cartItemsContainer.appendChild(starDiscountSection);

  // Display total with discount
  const finalTotal = subtotal - (window.currentStarDiscount || 0);
  const totalElement = document.createElement("div");
  totalElement.id = "cartTotal";
  totalElement.className = "cart-total";
  totalElement.innerHTML = `
    <div class="subtotal-row">
      <span>Товари:</span>
      <span>₴${subtotal.toFixed(2)}</span>
    </div>
    <div id="starDiscount" class="discount-row" style="${window.currentStarDiscount ? '' : 'display: none;'}">
      <span>Знижка зірками:</span>
      <span class="discount-amount">-₴${(window.currentStarDiscount || 0).toFixed(2)}</span>
    </div>
    <div class="final-total">
      <span>До сплати:</span>
      <strong>₴${finalTotal.toFixed(2)}</strong>
    </div>
  `;
  
  cartItemsContainer.appendChild(totalElement);
  
  // Custom-order inputs are rendered per custom item above
  
  // Show modal with smooth animation (robust to CSS overrides)
  const cartModal = document.getElementById("cartModal");
  if (cartModal) {
    cartModal.classList.add('open');
    // Fallback in case some style overrides visibility
    cartModal.style.display = 'block';
    cartModal.setAttribute('aria-hidden', 'false');
    // Add body class to tune mobile layout while modal is open
    document.body.classList.add('modal-open');
  }

  // Quick chips interaction (dynamic)
  try {
    const chipsWrap = document.querySelector('.mobile-search-chips');
    if (chipsWrap) {
      chipsWrap.addEventListener('click', (ev) => {
        const chip = ev.target.closest('.chip');
        if (!chip) return;
        if (chip.hasAttribute('data-clear')) {
          // Reset all search state
          if (mobileInput) mobileInput.value = '';
          if (searchInput) searchInput.value = '';
          searchQuery = '';
          searchByNew = false;
          searchByDiscount = false;
          currentCategory = 'all';
          updateChipsActiveState();
          currentPage = 1;
      resetVisibleProducts();
      renderProductsPage(currentPage);
          const hint = document.getElementById('mobileSearchHint');
          if (hint) hint.style.opacity = '1';
          return;
        }
        if (chip.hasAttribute('data-special')) {
          const spec = chip.getAttribute('data-special');
          if (spec === 'new') searchByNew = !searchByNew;
          if (spec === 'discount') searchByDiscount = !searchByDiscount;
          // When enabling a special chip, keep category as-is; toggles are additive
          updateChipsActiveState();
          currentPage = 1;
      resetVisibleProducts();
      renderProductsPage(currentPage);
          return;
        }
        if (chip.hasAttribute('data-category')) {
          const cat = chip.getAttribute('data-category');
          currentCategory = cat || 'all';
          updateChipsActiveState();
          currentPage = 1;
      resetVisibleProducts();
      renderProductsPage(currentPage);
          return;
        }
      });
    }
  } catch(_) { /* ignore */ }
}

function updateStarDiscount(starsToUse, subtotal) {
  // Enforce limit: up to 60 from regular stars; unlimited from certificate stars; total <= subtotal
  starsToUse = parseInt(starsToUse) || 0;
  const bonusStars = window.bonusStars || 0; // total available
  let certStarsBalance = 0;
  try { certStarsBalance = parseInt(localStorage.getItem('certStarsBalance') || '0', 10) || 0; } catch(_) {}
  const regularAvailable = Math.max(0, bonusStars - certStarsBalance);
  const maxFromSubtotal = Math.max(0, Math.floor(subtotal));

  // First allocate from certificate stars (no per-order limit)
  const certUsed = Math.max(0, Math.min(starsToUse, certStarsBalance, maxFromSubtotal));
  const remainingDesired = Math.max(0, starsToUse - certUsed);
  const remainingSubtotal = Math.max(0, maxFromSubtotal - certUsed);

  // Regular stars limited to 60 per order
  const regularCap = Math.min(regularAvailable, 60, remainingSubtotal);
  const regularUsed = Math.max(0, Math.min(remainingDesired, regularCap));

  const totalUsed = certUsed + regularUsed;

  // Persist the effective discount
  window.currentStarDiscount = totalUsed;

  // Update input/slider with effective value
  const starsInput = document.getElementById('starsToUse');
  if (starsInput) starsInput.value = totalUsed;
  const slider = document.querySelector('.star-slider input[type="range"]');
  if (slider) slider.value = totalUsed;

  const discount = Math.min(totalUsed, subtotal);
  const finalTotal = Math.max(0, subtotal - discount);

  // Update the display
  const discountElement = document.querySelector('.discount-amount');
  const finalTotalElement = document.querySelector('.final-total strong');
  if (discountElement) {
    discountElement.textContent = `-₴${discount.toFixed(2)}`;
    const row = discountElement.closest('.discount-row');
    if (row) row.style.display = discount > 0 ? 'flex' : 'none';
  }
  if (finalTotalElement) {
    finalTotalElement.textContent = `₴${finalTotal.toFixed(2)}`;
  }
}

function closeCart() {
  const cartModal = document.getElementById("cartModal");
  if (!cartModal) return;
  cartModal.classList.remove('open');
  cartModal.setAttribute('aria-hidden', 'true');
  // Remove modal-open body class when closing
  document.body.classList.remove('modal-open');
  // Keep display:block to allow transition; remove after transition ends as safety
  setTimeout(() => {
    // If still not open, we can hide display to avoid focus traps if any custom CSS
    if (!cartModal.classList.contains('open')) {
      cartModal.style.display = 'none'; // hide after transition completes
    }
  }, 280);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartCount();
  openCart();
}

function changeQuantity(index, delta) {
  const item = cart[index];
  item.quantity += delta;
  if (item.quantity < 1) item.quantity = 1;
  if (item.quantity > 10) item.quantity = 10;
  updateCartCount();
  openCart();
}

function showCartNotification() {
  if (typeof window.siteNotify === 'function') {
    window.siteNotify('Товар додано до кошика', { type: 'success' });
    return;
  }

  const notification = document.getElementById("cartNotification");
  if (!notification) return;
  notification.style.display = "flex";

  setTimeout(() => {
    notification.style.display = "none";
  }, 2000);
}

function showAddToCartNotification() {
  if (typeof window.siteNotify === 'function') {
    window.siteNotify('Товар додано до кошика', { type: 'success' });
    return;
  }

  const notification = document.getElementById("addToCartNotification");
  if (!notification) return; // fail-safe if element missing

  // Show notification and restart CSS animation
  notification.style.display = "flex";
  notification.style.animation = "none";
  void notification.offsetWidth; // force reflow to reset animation
  notification.style.animation = ""; // use animation from CSS (fadeInOut)

  setTimeout(() => {
    notification.style.display = "none";
  }, 2000);
}

function initFloatingHeaderBehavior() {
  const header = document.querySelector('.floating-header');
  if (!header) return;

  let lastY = window.scrollY || 0;
  let ticking = false;
  const minDelta = 8;
  const revealZone = 80;

  const shouldKeepHeaderVisible = () =>
    document.body.classList.contains('category-open') ||
    document.body.classList.contains('modal-open') ||
    document.body.classList.contains('mobile-search-open') ||
    document.body.style.overflow === 'hidden';

  const update = () => {
    const currentY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    const diff = currentY - lastY;

    if (shouldKeepHeaderVisible() || currentY <= revealZone) {
      header.classList.remove('header-hidden');
    } else if (Math.abs(diff) >= minDelta) {
      header.classList.toggle('header-hidden', diff > 0);
    }

    lastY = currentY;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

function initPageScrollControl() {
  document.querySelectorAll('.page-scroll-control').forEach((control) => control.remove());
  return;

  if (document.querySelector('.page-scroll-control')) return;

  const control = document.createElement('div');
  control.className = 'page-scroll-control';
  control.setAttribute('role', 'scrollbar');
  control.setAttribute('aria-label', 'Прокрутка сторінки');
  control.setAttribute('aria-controls', 'productContainer');
  control.setAttribute('aria-orientation', 'vertical');
  control.setAttribute('aria-valuemin', '0');
  control.setAttribute('aria-valuemax', '100');
  control.tabIndex = 0;

  const thumb = document.createElement('div');
  thumb.className = 'page-scroll-thumb';
  control.appendChild(thumb);
  document.body.appendChild(control);

  let dragging = false;
  let dragOffset = 0;

  const getMaxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const getTrackMetrics = () => {
    const rect = control.getBoundingClientRect();
    const style = window.getComputedStyle(control);
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    return {
      rect,
      paddingTop,
      usableHeight: Math.max(1, rect.height - paddingTop - paddingBottom)
    };
  };

  const updateThumb = () => {
    const maxScroll = getMaxScroll();
    const metrics = getTrackMetrics();
    const pageRatio = window.innerHeight / Math.max(document.documentElement.scrollHeight, window.innerHeight);
    const thumbHeight = Math.max(42, metrics.usableHeight * pageRatio);
    const maxThumbTop = Math.max(0, metrics.usableHeight - thumbHeight);
    const progress = maxScroll ? window.scrollY / maxScroll : 0;

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translate3d(0, ${metrics.paddingTop + maxThumbTop * progress}px, 0)`;
    control.classList.toggle('is-visible', maxScroll > 24);
    control.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  };

  const scrollToPointer = (clientY, behavior = 'smooth') => {
    const maxScroll = getMaxScroll();
    const metrics = getTrackMetrics();
    const thumbHeight = thumb.offsetHeight || 42;
    const maxThumbTop = Math.max(1, metrics.usableHeight - thumbHeight);
    const localY = clientY - metrics.rect.top - metrics.paddingTop - dragOffset;
    const progress = Math.min(1, Math.max(0, localY / maxThumbTop));
    window.scrollTo({ top: maxScroll * progress, behavior });
  };

  control.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    control.setPointerCapture(event.pointerId);
    dragging = true;
    control.classList.add('is-dragging');
    const thumbRect = thumb.getBoundingClientRect();
    dragOffset = thumb.contains(event.target) ? event.clientY - thumbRect.top : (thumb.offsetHeight || 42) / 2;
    scrollToPointer(event.clientY, thumb.contains(event.target) ? 'auto' : 'smooth');
  });

  control.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    scrollToPointer(event.clientY, 'auto');
  });

  const stopDragging = () => {
    dragging = false;
    dragOffset = 0;
    control.classList.remove('is-dragging');
  };

  control.addEventListener('pointerup', stopDragging);
  control.addEventListener('pointercancel', stopDragging);

  control.addEventListener('keydown', (event) => {
    const step = window.innerHeight * 0.78;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      window.scrollBy({ top: step * 0.35, behavior: 'smooth' });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      window.scrollBy({ top: -step * 0.35, behavior: 'smooth' });
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      window.scrollBy({ top: step, behavior: 'smooth' });
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      window.scrollBy({ top: -step, behavior: 'smooth' });
    } else if (event.key === 'Home') {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (event.key === 'End') {
      event.preventDefault();
      window.scrollTo({ top: getMaxScroll(), behavior: 'smooth' });
    }
  });

  window.addEventListener('scroll', updateThumb, { passive: true });
  window.addEventListener('resize', updateThumb);
  window.addEventListener('load', updateThumb);
  setTimeout(updateThumb, 250);
  updateThumb();
}


document.addEventListener("DOMContentLoaded", function () {
  initFloatingHeaderBehavior();
  initPageScrollControl();

  // Global reveal-on-load: mark key elements to fade/slide in with small stagger
  try {
    const revealSelectors = [
      // Exclude fixed header from reveal to avoid overlap/jank
      '.hero',
      '#productContainer',
      '#homeMasterclasses',
      '#homeCertificates',
      '#pagination',
      '#cartIcon',
      '.search-bar',
      '.nav-links',
      // exclude #categoryPanel and #sideAd to keep their native animations
      'footer.footer'
    ];
    const nodes = revealSelectors
      .map(sel => Array.from(document.querySelectorAll(sel)))
      .flat()
      .filter((el, idx, arr) => el && arr.indexOf(el) === idx);
    let delay = 60; // ms
    nodes.forEach(el => {
      el.classList.add('reveal-on-load');
      el.style.setProperty('--delay', `${delay}ms`);
      delay += 60;
    });
    // Trigger the reveal on the next frame to ensure initial styles are applied
    requestAnimationFrame(() => {
      document.body.classList.add('page-loaded');
    });
  } catch (e) { /* no-op */ }

  // Mobile/desktop: open/close side category panel
  try {
    const categoryPanel = document.getElementById('categoryPanel');
    const openMenuMobileBtn = document.getElementById('openMenuMobile');
    const openMenuBtn = document.getElementById('openMenu');
    const closeCategoriesBtn = document.getElementById('closeCategories');

    const openCategoryPanel = (e) => {
      if (e) e.preventDefault();
      if (categoryPanel) {
        categoryPanel.classList.add('open');
        document.body.classList.add('category-open');
      }
    };
    const closeCategoryPanel = () => {
      if (categoryPanel) {
        categoryPanel.classList.remove('open');
        document.body.classList.remove('category-open');
      }
    };

    // Close on Escape for accessibility
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') closeCategoryPanel();
    });
  } catch (_) { /* ignore */ }

  // Adjust body top padding to actual header height (prevents overlapping)
  // Removed dynamic body padding adjustment to avoid extra top space and keep menu animations intact
  fetch("products.json?t=" + Date.now(), { cache: 'no-store' })
  .then(res => res.json())
  .then(data => {
    allProducts = data;
    window.productsData = data;
    updateCategoryPanel(); // ← обновляем панель
    renderProductsPage(currentPage); // ✅ Это будет рендерить постранично
    try { renderSearchChips(); renderSearchSort(); bindSearchSortHandlers(); } catch(_) {}
  })
  .catch(err => {
    console.error("Помилка завантаження товарів:", err);
  });

  const deliverySelect = document.getElementById("delivery");
  const warning = document.getElementById("ukrpostWarning");
  const submitBtn = document.getElementById("submitOrderBtn");

  if (deliverySelect && warning && submitBtn) {
    deliverySelect.addEventListener("change", function () {
      if (this.value === "Укрпошта") {
        warning.style.display = "block";
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.6";
        submitBtn.style.cursor = "not-allowed";
      } else {
        warning.style.display = "none";
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
      }
    });
  }

  // Налаштування способу зв'язку (телефон або Telegram)
  const contactRadios = document.querySelectorAll('input[name="contactMethod"]');
  const phoneFieldWrap = document.getElementById('phoneField');
  const tgFieldWrap = document.getElementById('tgField');
  const phoneInput = document.getElementById('phone');
  const tgInput = document.getElementById('telegram');

  function applyContactMethodUi(method) {
    if (!phoneFieldWrap || !tgFieldWrap) return;
    if (method === 'telegram') {
      // show tg, hide phone
      tgFieldWrap.style.display = '';
      phoneFieldWrap.style.display = 'none';
      if (tgInput) tgInput.required = true;
      if (phoneInput) phoneInput.required = false;
    } else {
      // default phone
      tgFieldWrap.style.display = 'none';
      phoneFieldWrap.style.display = '';
      if (phoneInput) phoneInput.required = true;
      if (tgInput) tgInput.required = false;
    }
  }

  // initial
  const checkedRadio = document.querySelector('input[name="contactMethod"]:checked');
  if (checkedRadio) applyContactMethodUi(checkedRadio.value);
  // changes
  contactRadios.forEach(r => r.addEventListener('change', () => applyContactMethodUi(r.value)));

  // --- Init custom order swatches (material & color) ---
  const materialSelect = document.getElementById('materialSelect');
  const materialSwatches = document.getElementById('materialSwatches');
  const colorSelect = document.getElementById('colorSelect');
  const colorSwatches = document.getElementById('colorSwatches');

  function clearActive(container){
    if (!container) return;
    container.querySelectorAll('.swatch').forEach(el=>el.classList.remove('active'));
  }

  function renderMaterialSwatches(){
    if (!materialSelect || !materialSwatches) return;
    materialSwatches.innerHTML = '';
    [...materialSelect.options].forEach((opt, idx)=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch material-swatch';
      btn.title = opt.textContent;
      const imgUrl = opt.dataset.image || '';
      btn.style.backgroundImage = imgUrl ? `url('${imgUrl}')` : '';
      btn.style.backgroundSize = 'cover';
      btn.style.backgroundPosition = 'center';
      if (idx === materialSelect.selectedIndex) btn.classList.add('active');
      btn.addEventListener('click', ()=>{
        materialSelect.value = opt.value;
        clearActive(materialSwatches);
        btn.classList.add('active');
        updateFormColorLock();
        updateCustomModalPrice();
      });
      materialSwatches.appendChild(btn);
    });
  }

  function cssColorFor(value){
    const map = {
      white:'#ffffff', yellow:'#ffd400', red:'#e53935', green:'#43a047', blue:'#4fc3f7', violet:'#8e24aa'
    };
    return map[value] || '#ccc';
  }

  function renderColorSwatches(){
    if (!colorSelect || !colorSwatches) return;
    colorSwatches.innerHTML = '';
    [...colorSelect.options].forEach((opt, idx)=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch color-swatch';
      btn.title = opt.textContent;
      btn.style.background = cssColorFor(opt.value);
      btn.setAttribute('data-key', opt.value);
      if (idx === colorSelect.selectedIndex) btn.classList.add('active');
      btn.addEventListener('click', ()=>{
        // block colors when massage selected
        if (materialSelect && materialSelect.value === 'massage' && opt.value !== 'white') return;
        colorSelect.value = opt.value;
        clearActive(colorSwatches);
        btn.classList.add('active');
        updateCustomModalPrice();
      });
      colorSwatches.appendChild(btn);
    });
  }

  function updateFormColorLock(){
    const lock = materialSelect && materialSelect.value === 'massage';
    const swWrap = colorSwatches;
    if (lock) {
      colorSelect.value = 'white';
    }
    if (swWrap) {
      [...swWrap.children].forEach(btn => {
        const key = btn.getAttribute('data-key');
        const disabled = lock && key !== 'white';
        btn.style.pointerEvents = disabled ? 'none' : 'auto';
        btn.style.opacity = disabled ? '0.5' : '1';
        if (disabled) btn.classList.remove('active');
      });
      if (lock) {
        [...swWrap.children].forEach(b => b.classList.remove('active'));
        const whiteBtn = [...swWrap.children].find(b => b.getAttribute('data-key') === 'white');
        if (whiteBtn) whiteBtn.classList.add('active');
      }
    }
  }

  renderMaterialSwatches();
  renderColorSwatches();
  updateFormColorLock();

  // Open/Close handlers for Custom Order Modal
  const openBtn = document.getElementById('customOrderBtn');
  const modal = document.getElementById('customOrderModal');
  const closeBtn = document.querySelector('#customOrderModal .close-custom-order');
  if (openBtn) openBtn.addEventListener('click', openCustomOrderProductModal);
  if (closeBtn) closeBtn.addEventListener('click', () => closeCustomOrderModal());
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeCustomOrderModal(); });
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeCustomOrderModal(); });

  // Keep modal price in sync when selects change directly (safety in case swatches not used)
  if (materialSelect) materialSelect.addEventListener('change', () => { updateFormColorLock(); updateCustomModalPrice(); });
  if (colorSelect) colorSelect.addEventListener('change', () => { updateCustomModalPrice(); });

  // === Periodic Side Ad Banner ===
  (function initSideAd(){
    const sideAd = document.getElementById('sideAd');
    if (!sideAd) return;
    const closeBtn = sideAd.querySelector('.side-ad-close');
    let hideTimeout = null;
    let scheduleTimeout = null;

    const isDesktop = () => window.innerWidth >= 992; // avoid on small screens
    const SHOW_AFTER_MS = 4000;     // first appearance delay
    const VISIBLE_MS = 8000;        // visible time before auto-hide
    const INTERVAL_MS = 30000;      // time between appearances

    const showAd = () => {
      if (!isDesktop()) return; // don't show on mobile
      sideAd.classList.add('show');
      sideAd.setAttribute('aria-hidden', 'false');
      // auto hide after VISIBLE_MS
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(hideAd, VISIBLE_MS);
    };

    const hideAd = () => {
      sideAd.classList.remove('show');
      sideAd.setAttribute('aria-hidden', 'true');
    };

    const scheduleNext = (delay = INTERVAL_MS) => {
      clearTimeout(scheduleTimeout);
      scheduleTimeout = setTimeout(showAd, delay);
    };

    // Close button: hide now and postpone next showing a bit longer
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hideAd();
        scheduleNext(INTERVAL_MS); // restart interval after manual close
      });
    }

    // Re-evaluate on resize to avoid showing on small screens
    window.addEventListener('resize', () => {
      if (!isDesktop()) hideAd();
    });

    // Start the cycle
    setTimeout(() => {
      showAd();
      scheduleNext();
    }, SHOW_AFTER_MS);
  })();

  // Submit custom order form: add configured item to cart
  const customForm = document.getElementById('customOrderForm');
  if (customForm) {
    customForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // Require auth like other cart actions
      if (!hasActiveAccountSession()) {
        if (confirm('Для оформлення індивідуального замовлення потрібно увійти в акаунт. Перейти на сторінку входу?')) {
          window.location.href = 'auth.html';
        }
        return;
      }

      const material = materialSelect ? materialSelect.value : 'soy';
      const color = colorSelect ? colorSelect.value : 'white';
      const notes = (document.getElementById('customOrderDetails')?.value || '').trim();
      const price = calcCustomModalPrice(material, color);

      const title = 'Свічка під замовлення';
      // Push directly with metadata so pricing stays dynamic in cart as well
      cart.push({
        title,
        price,                 // initial display price (cart will recalc per unit for custom item)
        basePrice: CUSTOM_ORDER_BASE_PRICE,
        quantity: 1,
        isCustomOrder: true,
        material,
        color,
        notes
      });

      updateCartCount();
      if (typeof showAddToCartNotification === 'function') showAddToCartNotification();
      closeCustomOrderModal();
    });
  }
});



const __orderForm = document.getElementById("orderForm");
if (__orderForm) __orderForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  // Сброс флага одноразового начисления для нового оформления
  window.__purchaseStarsAwarded = false;

  // Проверка авторизации перед оформлением заказа
  if (typeof requireAuthForCheckout === 'function' && !requireAuthForCheckout()) {
    return; // Останавливаем, если нужна авторизация
  }

  const name = this.name.value.trim();
  const surname = this.surname.value.trim();
  // Contact method values
  const contactMethod = (document.querySelector('input[name="contactMethod"]:checked')||{}).value || 'phone';
  const phone = (this.phone ? this.phone.value.trim() : '').replace(/\s+/g, '');
  const telegram = this.telegram ? this.telegram.value.trim() : '';
  const city = this.address.value.trim(); // місто
  const delivery = this.delivery.value;
  const warehouse = this.warehouse.value.trim(); // номер відділення

  // Тип оплаты
  const paymentType = document.querySelector('input[name="paymentType"]:checked').value;
  const paymentTypeText = paymentType === 'cashOnDelivery' 
    ? 'Оплата накладений платіж (післяплата)'
    : 'Оплата карткою';

  // Валідація способу зв'язку
  if (contactMethod === 'phone') {
    if (!/^\d{10}$/.test(phone)) {
      alert('Введіть коректний номер телефону з 10 цифр (без +38).');
      return;
    }
  } else {
    // Telegram: допускаємо з @ або без, латинські літери, цифри і _; довжина 5-32
    const tg = telegram.startsWith('@') ? telegram.slice(1) : telegram;
    if (!/^[A-Za-z0-9_]{5,32}$/.test(tg)) {
      alert('Введіть коректний Telegram юзернейм (наприклад, @my_name).');
      return;
    }
  }

  if (!Array.isArray(cart) || cart.length === 0) {
    alert("Кошик порожній!");
    return;
  }

  // Generate a unique order ID for tracking in the bot
  const orderId = 'O' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 100000).toString(36);

  let message = `🧾 *Замовлення #${orderId}*\n\n`;
  // Embed current site user ID to allow the bot to add stars even if PID is missing
  try {
    let uid = 0;
    try {
      const udRaw = localStorage.getItem('userData');
      if (udRaw) {
        const ud = JSON.parse(udRaw);
        if (ud && ud.id) uid = parseInt(ud.id, 10) || 0;
      }
    } catch(_) {}
    // Some flows store user in token payload only; as a fallback, try parsing when available
    if (!uid && typeof getUserData === 'function') {
      const ud2 = getUserData();
      if (ud2 && ud2.user && ud2.user.id) uid = parseInt(ud2.user.id, 10) || 0;
    }
    if (uid) {
      message += `UID: ${uid}\n`;
    }
  } catch(_) {}
  // Додаємо обраний спосіб зв'язку
  if (contactMethod === 'phone') {
    message += `👤 ПІБ: ${surname} ${name}\n📞 Телефон: ${phone}\n`;
  } else {
    const shownTg = telegram.startsWith('@') ? telegram : '@' + telegram;
    message += `👤 ПІБ: ${surname} ${name}\n💬 Telegram: ${shownTg}\n`;
  }
  message += `🏙 Місто: ${city}\n🏤 Відділення: ${warehouse}\n🚚 Пошта: ${delivery}\n💳 Тип оплати: ${paymentTypeText}\n\n`;
  message += `🕯 *Товари:*\n`;

  let total = 0;
  const orderItems = [];
  cart.forEach((item, i) => {
    const perUnit = isCustomOrderItem(item) ? calcCustomOrderPrice(item) : (Number(item.price) || 0);
    const itemTotal = perUnit * (Number(item.quantity) || 0);
    orderItems.push({
      title: item.title,
      quantity: Number(item.quantity) || 0,
      price: perUnit,
      total: itemTotal,
      isSet: !!item.isSet,
      isCertificate: !!item.isCertificate,
      certificateStars: Number(item.certificateStars || 0) || 0,
      isCustomOrder: isCustomOrderItem(item),
      material: item.material || '',
      color: item.color || '',
      volume: item.volume || '',
      aroma: item.aroma || '',
      notes: item.notes || '',
      setItems: Array.isArray(item.setItems) ? item.setItems : []
    });
    const materialMap = { massage: 'Масажний', soy: 'Соєвий' };
    const colorMap = {
      white: 'Білий', yellow: 'Жовтий', red: 'Червоний', green: 'Зелений', blue: 'Блакитний', violet: 'Фіолетовий'
    };

    message += `${i + 1}) ${item.title} — ₴${perUnit} × ${item.quantity} = ₴${itemTotal}`;

    // For sets include breakdown of items
    if (item.isSet && Array.isArray(item.setItems) && item.setItems.length) {
      message += `\n   📦 Склад набору:`;
      item.setItems.forEach((si, idx) => {
        message += `\n      • ${si.title} × ${si.qty}`;
      });
    }

    if (item.material) {
      message += `\n   🧾 Матеріал: ${materialMap[item.material] || item.material}`;
    }
    if (item.color) {
      message += `\n   🎨 Колір: ${colorMap[item.color] || item.color}`;
    }
    if (item.volume) {
      message += `\n   📦 Об'єм: ${item.volume}`;
    }
    if (item.aroma) {
      message += `\n   🌸 Аромат: ${item.aroma}`;
    }
    if (item.notes) {
      message += `\n   📝 Побажання: ${item.notes}`;
    }
    message += `\n`;
    total += itemTotal;
  });

  // Calculate stars to use before sending the message, so we can reflect discount and final total
  let starsToUse = 0;
  let certStarsBalance = 0;
  try { certStarsBalance = parseInt(localStorage.getItem('certStarsBalance') || '0', 10) || 0; } catch(_) { certStarsBalance = 0; }
  try {
    const starsInputEl = document.getElementById('starsToUse');
    let candidate = parseInt(starsInputEl?.value, 10);
    if (Number.isNaN(candidate)) {
      candidate = parseInt(window.currentStarDiscount || 0, 10) || 0;
    }
    const bonusStars = window.bonusStars || 0;
    let certStarsBalance = 0;
    try { certStarsBalance = parseInt(localStorage.getItem('certStarsBalance') || '0', 10) || 0; } catch(_) { certStarsBalance = 0; }
    const regularAvailable = Math.max(0, bonusStars - certStarsBalance);

    // Allocate respecting limits: cert unlimited, regular up to 60, total <= total
    const certUsed = Math.max(0, Math.min(candidate, certStarsBalance, Math.floor(total)));
    const remainingDesired = Math.max(0, candidate - certUsed);
    const remainingSubtotal = Math.max(0, Math.floor(total) - certUsed);
    const regularCap = Math.min(regularAvailable, 60, remainingSubtotal);
    const regularUsed = Math.max(0, Math.min(remainingDesired, regularCap));
    starsToUse = certUsed + regularUsed;
  } catch (e) { /* fall back to 0 */ }

  const finalToPay = Math.max(0, total - (starsToUse || 0));

  // Split discount: certificate stars vs regular
  const certStarsUsed = Math.max(0, Math.min(starsToUse, certStarsBalance));
  const regularStarsUsed = Math.max(0, starsToUse - certStarsUsed);

  // Add totals section to message (full total + discount + final)
  message += `\n💰 *Разом:* ₴${total}`;
  if (starsToUse > 0) {
    message += `\n⭐ Знижка зірками: ${starsToUse} (сертифікат: ${certStarsUsed}, звичайні: ${regularStarsUsed}) (−₴${starsToUse})`;
    message += `\n✅ До сплати: ₴${finalToPay}`;
  }

  if (total <= 0) {
    alert("Неможливо оформити замовлення з нульовою сумою.");
    return;
  }

  // Create consolidated pending action on the server for this order (masterclass grant + stars award)
  let pendingId = '';
  try {
    const map = JSON.parse(localStorage.getItem('masterclassMap') || '{}');
    const items = [];
    (cart || []).forEach(item => {
      if (map[item.title]) {
        const mc = map[item.title];
        items.push({ id: mc.id, title: item.title });
      }
    });
    const certificates = (cart || [])
      .filter(item => item && item.isCertificate && Number(item.certificateStars) > 0)
      .map(item => ({
        title: item.title,
        stars: Number(item.certificateStars) || 0,
        quantity: Number(item.quantity) || 1
      }));
    const payload = { items, certificates, stars: 10 }; // always award +10 ⭐ per confirmed order
    if (typeof makeAuthenticatedRequest === 'function') {
      const resp = await makeAuthenticatedRequest(`${API_BASE_URL}/pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'order', payload })
      });
      if (resp.ok) {
        const d = await resp.json();
        if (d && d.id) pendingId = d.id;
      }
    } else {
      // Fallback: direct fetch with JWT token if helper not available
      const apiBase = (typeof API_BASE_URL === 'string' && API_BASE_URL)
        ? API_BASE_URL
        : ((typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '/api');
      const token = localStorage.getItem('authToken');
      if (token) {
        const resp = await fetch(`${apiBase}/pending`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'order', payload })
        });
        if (resp.ok) {
          const d = await resp.json();
          if (d && d.id) pendingId = d.id;
        }
      }
    }
  } catch (e) { console.warn('Pending order create failed:', e); }

  const saveOrderOnSite = async () => {
    const rawOrderText = pendingId ? (message + `\n\nPID: ${pendingId}`) : message;
    const customerName = `${surname} ${name}`.trim();
    const siteOrder = {
      orderId,
      pendingId,
      status: 'нове',
      customer: customerName,
      total,
      final_total: finalToPay,
      stars_used: starsToUse,
      items: orderItems,
      raw: rawOrderText,
      summary: {
        raw: rawOrderText,
        total,
        final_total: finalToPay,
        stars_used: starsToUse,
        customer: customerName,
        city,
        delivery,
        department: warehouse,
        payment: paymentTypeText,
        contactMethod,
        phone: contactMethod === 'phone' ? phone : '',
        telegram: contactMethod === 'telegram' ? (telegram.startsWith('@') ? telegram : '@' + telegram) : ''
      }
    };
    const apiBase = (typeof API_BASE_URL === 'string' && API_BASE_URL)
      ? API_BASE_URL
      : ((typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '/api');
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(siteOrder)
    };
    const response = typeof makeAuthenticatedRequest === 'function'
      ? await makeAuthenticatedRequest(`${apiBase}/orders`, requestOptions)
      : await fetch(`${apiBase}/orders`, { ...requestOptions, credentials: 'include' });
    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(details || `Order save failed: ${response.status}`);
    }
    return response.json();
  };

  try {
    await saveOrderOnSite();
  } catch (error) {
    console.error('Site order save failed:', error);
    alert('Не вдалося зберегти замовлення на сайті. Спробуйте ще раз або оновіть сторінку.');
    return;
  }

  try {
    if (starsToUse > 0 && typeof useBonusStarsForDiscount === 'function') {
      const ok = await useBonusStarsForDiscount(starsToUse);
      if (ok) {
        window.currentStarDiscount = 0;
        if (typeof updateStarDiscount === 'function') {
          updateStarDiscount(0, total);
        }
        try {
          const balKey = 'certStarsBalance';
          const prevBal = parseInt(localStorage.getItem(balKey) || '0', 10) || 0;
          const newBal = Math.max(0, prevBal - certStarsUsed);
          localStorage.setItem(balKey, String(newBal));
        } catch (_) {}
      }
    }
  } catch (e) {
    console.error('Star spending flow error:', e);
  }

  alert("Замовлення відправлено! Ми зв'яжемося з вами.");
  closeCart();
  document.getElementById("orderForm").reset();
  cart = [];
  updateCartCount();
});

// Зміна кількості на картці товару
function changeProductQty(button, delta) {
  const container = button.parentElement;
  const input = container.querySelector("input");
  let value = parseInt(input.value);
  value += delta;

  if (value < 1) value = 1;
  if (value > 10) value = 10;

  input.value = value;
}

// Додавання товару з кількістю
function addToCartWithQty(title, price, button) {
  const quantityInput = button.previousElementSibling.querySelector("input");
  const quantity = parseInt(quantityInput.value) || 1;

  const safeTitle = (title == null ? '' : String(title)).trim() || 'Товар';
  const safePrice = parsePrice(price);

  const baseProduct = (window.productsData || []).find(p => p.title === safeTitle) || {};
  const existing = cart.find(item => item.title === safeTitle);
  if (existing) {
    if (existing.quantity + quantity > 10) {
      alert("Максимум 10 одиниць одного товару.");
      existing.quantity = 10;
    } else {
      existing.quantity += quantity;
    }
  } else {
    const meta = {};
    if (baseProduct.isSet) {
      meta.isSet = true;
      meta.setItems = Array.isArray(baseProduct.items) ? baseProduct.items : [];
    }
    if (baseProduct.isCustomOrder) {
      meta.isCustomOrder = true;
    }
    cart.push({ title: safeTitle, price: safePrice, quantity, ...meta });
  }
  updateCartCount();
  showCartNotification();
}


let currentPage = 1;
let productsPerPage = 9;
let allProducts = [];
let currentCategory = 'all'; // ← текущее выбранное
let searchQuery = ''; // Переменная для хранения поискового запроса
let searchByNew = false;      // Спец-фільтр: новинки
let searchByDiscount = false; // Спец-фільтр: зі знижкою
let sortOption = 'relevance';  // 'relevance' | 'price_low' | 'price_high' | 'discount' | 'name' | 'new'
let visibleProductsCount = 9;

function resetVisibleProducts() {
  visibleProductsCount = 9;
}

// Responsive: 8 items per page on mobile, 9 on desktop
(function setupResponsiveProductsPerPage(){
  try {
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => {
      const newVal = mq.matches ? 8 : 9;
      if (productsPerPage !== newVal) {
        productsPerPage = newVal;
        currentPage = 1; // reset to first page to avoid empty page edge cases
        resetVisibleProducts();
        try { renderProductsPage(currentPage); } catch(_) {}
      }
    };
    // initial apply (in case script loads after DOM)
    apply();
    // listen for breakpoint changes
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(apply);
    }
    // extra safety: resize fallback
    window.addEventListener('resize', apply);
  } catch (_) { /* no-op */ }
})();

// Функціональність пошуку + мобільне згортання/розгортання поля
function initializeSearch() {
  const searchBar = document.querySelector('.search-bar');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.querySelector('.search-bar .search-icon');
  // Mobile drawer elements
  const mobileSearch = document.getElementById('mobileSearch');
  const mobileInput = document.getElementById('mobileSearchInput');
  const mobileClose = mobileSearch ? mobileSearch.querySelector('.mobile-search-close') : null;
  const mobileGo = mobileSearch ? mobileSearch.querySelector('.mobile-search-go') : null;
  const searchBackdrop = document.getElementById('searchBackdrop');

  // Live filtering (desktop + mobile)
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      searchQuery = e.target.value.toLowerCase().trim();
      currentPage = 1;
      resetVisibleProducts();
      renderProductsPage(currentPage);
    });
  }

  if (!searchBar) return;

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  const openSearch = () => {
    if (!isMobile()) return;
    searchBar.classList.add('active');
    if (searchInput) setTimeout(() => searchInput.focus(), 10);
  };

  const closeSearch = () => {
    if (!isMobile()) return;
    // Закриваємо тільки якщо поле порожнє, щоб не ховати введений текст
    if (searchInput && searchInput.value) return;
    searchBar.classList.remove('active');
    if (searchInput) searchInput.blur();
  };

  // Mobile drawer open/close helpers
  const openMobileSearch = () => {
    if (!isMobile() || !mobileSearch) return;
    // Position the drawer just below the floating header
    try {
      const header = document.querySelector('.floating-header');
      if (header) {
        const rect = header.getBoundingClientRect();
        // 10px gap below header
        mobileSearch.style.top = Math.round(rect.bottom + 10) + 'px';
      }
    } catch(_) { /* no-op */ }
    // Render dynamic UI just-in-time
    try { renderSearchChips(); renderSearchSort(); bindSearchSortHandlers(); } catch(_) {}
    mobileSearch.classList.add('open');
    // Ensure it's not hidden by CSS attribute selector
    mobileSearch.setAttribute('aria-hidden', 'false');
    document.body.classList.add('mobile-search-open');
    if (searchBackdrop) {
      searchBackdrop.classList.add('open');
      searchBackdrop.setAttribute('aria-hidden', 'false');
    }
    // sync value from desktop input if any
    if (mobileInput && searchInput && mobileInput.value !== searchInput.value) {
      mobileInput.value = searchInput.value;
    }
    setTimeout(() => { if (mobileInput) mobileInput.focus(); }, 10);
  };
  const closeMobileSearch = (force = false) => {
    if (!isMobile() || !mobileSearch) return;
    // Keep open if there's text unless forced
    if (!force && mobileInput && mobileInput.value) return;
    mobileSearch.classList.remove('open');
    mobileSearch.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('mobile-search-open');
    if (searchBackdrop) {
      searchBackdrop.classList.remove('open');
      searchBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (mobileInput) mobileInput.blur();
  };

  // Клік по іконці лупи (если найден класс в шапке)
  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (isMobile()) {
        // Open the mobile drawer on phones
        openMobileSearch();
      } else {
        // Desktop behavior: ensure visible and focus
        if (!searchBar.classList.contains('active')) {
          searchBar.classList.add('active');
        }
        if (searchInput) setTimeout(() => searchInput.focus(), 10);
      }
    });
  }

  // Also bind by explicit id in case class selector changes
  const headerSearchBtn = document.getElementById('headerSearchBtn');
  if (headerSearchBtn && headerSearchBtn !== searchBtn) {
    headerSearchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isMobile()) {
        openMobileSearch();
      } else {
        if (!searchBar.classList.contains('active')) searchBar.classList.add('active');
        if (searchInput) setTimeout(() => searchInput.focus(), 10);
      }
    });
  }

  // Клік поза пошуком — закриття (на мобільному)
  document.addEventListener('click', (e) => {
    if (!isMobile()) return;
    const headerBtn = document.getElementById('headerSearchBtn');
    const clickedHeaderBtn = headerBtn ? headerBtn.contains(e.target) : false;

    if (!searchBar.contains(e.target)) {
      closeSearch();
    }
    // close drawer when clicking outside of it (but not when clicking the header search button or its children)
    if (mobileSearch && !mobileSearch.contains(e.target) && !clickedHeaderBtn) {
      closeMobileSearch();
    }
  });

  // ESC — закрити (на мобільному)
  document.addEventListener('keydown', (e) => {
    if (!isMobile()) return;
    if (e.key === 'Escape') {
      closeSearch();
      closeMobileSearch(true);
    }
  });

  // Перемикання стану при зміні ширини екрана
  const applyInitialState = () => {
    if (isMobile()) {
      // При старті на мобільному згорнуто, якщо немає тексту
      if (searchInput && searchInput.value) {
        searchBar.classList.add('active');
      } else {
        searchBar.classList.remove('active');
      }
      // Drawer starts closed; keep values synced
      if (mobileInput && searchInput && mobileInput.value !== searchInput.value) {
        mobileInput.value = searchInput.value;
      }
    } else {
      // На десктопі завжди показуємо поле
      searchBar.classList.add('active');
    }
  };

  applyInitialState();
  window.addEventListener('resize', applyInitialState);
  // keep drawer aligned on resize/scroll
  const alignDrawer = () => {
    if (!isMobile() || !mobileSearch) return;
    if (!mobileSearch.classList.contains('open')) return;
    try {
      const header = document.querySelector('.floating-header');
      if (header) {
        const rect = header.getBoundingClientRect();
        mobileSearch.style.top = Math.round(rect.bottom + 10) + 'px';
      }
    } catch(_) { /* no-op */ }
  };
  window.addEventListener('resize', alignDrawer);
  window.addEventListener('scroll', alignDrawer, { passive: true });

  // Wire mobile drawer controls
  if (mobileClose) mobileClose.addEventListener('click', () => closeMobileSearch(true));
  if (searchBackdrop) searchBackdrop.addEventListener('click', () => closeMobileSearch());
  if (mobileGo) mobileGo.addEventListener('click', () => closeMobileSearch(true));
  // Also open when tapping the whole search bar on mobile (bigger target)
  if (searchBar) {
    searchBar.addEventListener('click', (e) => {
      if (!isMobile()) return;
      // ignore clicks on menu button etc.
      const headerBtn = document.getElementById('headerSearchBtn');
      if (headerBtn && headerBtn.contains(e.target)) return; // already handled
      openMobileSearch();
    });
  }

  // Sync inputs both ways
  if (mobileInput) {
    mobileInput.addEventListener('input', (e) => {
      const val = (e.target.value || '').toString();
      if (searchInput && searchInput.value !== val) searchInput.value = val;
      // trigger the same filtering logic
      searchQuery = val.toLowerCase().trim();
      currentPage = 1;
      resetVisibleProducts();
      renderProductsPage(currentPage);
      // toggle hint
      const hint = document.getElementById('mobileSearchHint');
      if (hint) hint.style.opacity = val ? '0' : '1';
    });
  }
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = (e.target.value || '').toString();
      if (mobileInput && mobileInput.value !== val) mobileInput.value = val;
    });
  }
}

function filterProductsBySearch(products) {
  if (!searchQuery) {
    return products;
  }
  
  return products.filter(product => {
    const titleMatch = product.title.toLowerCase().includes(searchQuery);
    const descriptionMatch = product.description.toLowerCase().includes(searchQuery);
    return titleMatch || descriptionMatch;
  });
}

function getFilteredProducts(){
  let filtered = allProducts;
  
  // Сначала применяем поиск
  filtered = filterProductsBySearch(filtered);
  // Спец-фільтри
  if (searchByDiscount) {
    filtered = filtered.filter(p => Number(p.discount || 0) > 0);
  }
  if (searchByNew) {
    const hasNew = (txt) => /новинк/i.test(txt || '');
    filtered = filtered.filter(p => hasNew(p.title) || hasNew(p.description));
  }
  
  // Затем фильтр по категории
  if (currentCategory !== 'all') {
    filtered = filtered.filter(p => (p.category || 'Інші товари') === currentCategory);
  }

  // Сортування
  const byNum = (a, b) => a - b;
  const getPrice = (p) => Number(p?.price) || 0;
  const getDiscount = (p) => Number(p?.discount) || 0;
  const getIsNew = (p) => /новинк/i.test((p?.title || '') + ' ' + (p?.description || '')) ? 1 : 0;
  const collator = new Intl.Collator('uk', { sensitivity: 'base' });

  switch (sortOption) {
    case 'price_low':
      filtered = [...filtered].sort((a, b) => byNum(getPrice(a), getPrice(b)));
      break;
    case 'price_high':
      filtered = [...filtered].sort((a, b) => byNum(getPrice(b), getPrice(a)));
      break;
    case 'discount':
      filtered = [...filtered].sort((a, b) => byNum(getDiscount(b), getDiscount(a)));
      break;
    case 'name':
      filtered = [...filtered].sort((a, b) => collator.compare(a.title || '', b.title || ''));
      break;
    case 'new':
      filtered = [...filtered].sort((a, b) => byNum(getIsNew(b), getIsNew(a)));
      break;
    default:
      // relevance: keep current order from source
      break;
  }

  return filtered;
}

function renderProductsPage(page){
  const list = getFilteredProducts();
  const limit = Math.max(9, Number(visibleProductsCount) || 9);
  const pageProducts = list.slice(0, limit);
  const container=document.getElementById("productContainer");
  if (!container) return;
  container.innerHTML='';

  // ----- Показ/скрытие сообщения «Нічого не знайдено 😢» -----
  const noResultsEl = document.getElementById("noResults");
  const paginationEl = document.getElementById("pagination");
  if (list.length === 0) {
    if (noResultsEl) noResultsEl.style.display = "block";
    if (paginationEl) paginationEl.style.display = "none";
    // Ensure container is visible even when empty
    try { container.style.opacity = '1'; } catch(_) {}
    return; // нет товаров – дальше ничего не рендерим
  } else {
    if (noResultsEl) noResultsEl.style.display = "none";
    if (paginationEl) paginationEl.style.display = "none";
  }
  // ------------------------------------------------------------

  pageProducts.forEach(p=>container.appendChild(createProductCard(p)));
  if (paginationEl) paginationEl.innerHTML = '';
  renderProductsShowMore(list.length, pageProducts.length);
  renderRefreshButton();
  // Ensure container is visible after any animations
  try { container.style.opacity = '1'; } catch(_) {}
}

function renderProductsShowMore(totalItems, shownItems) {
  let button = document.getElementById('productsShowMore');
  const container = document.getElementById('productContainer');
  if (!container) return;
  if (!button) {
    button = document.createElement('button');
    button.id = 'productsShowMore';
    button.className = 'products-show-more';
    button.type = 'button';
    container.after(button);
    button.addEventListener('click', () => {
      visibleProductsCount += 9;
      renderProductsPage(currentPage);
    });
  }
  if (shownItems >= totalItems) {
    button.style.display = 'none';
    return;
  }
  button.style.display = 'inline-flex';
  button.innerHTML = `
    <span>Показати ще</span>
    <span class="show-more-arrow" aria-hidden="true">
      <span class="show-more-arrow-line"></span>
    </span>
  `;
}

// Smoothly navigate to a specific page with fade animation
function goToPage(page){
  const container = document.getElementById('productContainer');
  if (!container) { currentPage = page; return renderProductsPage(page); }
  if (container.__animating) return;
  container.__animating = true;

  // Use inline transition for reliability across styles
  const DURATION = 260;
  const prevTransition = container.style.transition;
  container.style.transition = `opacity ${DURATION}ms ease`;

  let swapped = false;
  const doSwap = () => {
    if (swapped) return;
    swapped = true;
    // Clamp page to valid range based on current filter
    const list = getFilteredProducts();
    const totalPages = Math.max(1, Math.ceil(list.length / productsPerPage));
    const targetPage = Math.min(Math.max(1, page), totalPages);
    // Swap content while hidden
    currentPage = targetPage;
    renderProductsPage(targetPage);
    // Force reflow and fade back in
    void container.offsetWidth;
    container.style.opacity = '1';
    // After fade-in completes, cleanup
    const onFadeInEnd = (ev2) => {
      if (ev2 && ev2.propertyName && ev2.propertyName !== 'opacity') return;
      container.removeEventListener('transitionend', onFadeInEnd);
      // restore transition style
      container.style.transition = prevTransition;
      container.__animating = false;
    };
    container.addEventListener('transitionend', onFadeInEnd, { once: true });
    setTimeout(() => { // fallback
      container.style.transition = prevTransition;
      container.__animating = false;
    }, DURATION + 80);
  };

  const onFadeOutEnd = (ev) => {
    if (ev && ev.propertyName && ev.propertyName !== 'opacity') return;
    container.removeEventListener('transitionend', onFadeOutEnd);
    doSwap();
  };

  container.addEventListener('transitionend', onFadeOutEnd, { once: true });
  // Trigger fade-out
  void container.offsetWidth;
  container.style.opacity = '0';
  // Fallback if transitionend doesn't fire
  setTimeout(() => { doSwap(); }, DURATION + 60);
}

function renderPaginationControls(totalItems){
  let paginationContainer = document.getElementById("pagination");
  if(!paginationContainer){
     paginationContainer=document.createElement('div');
     paginationContainer.id='pagination';
     paginationContainer.className='pagination-controls';
     document.getElementById('productContainer').after(paginationContainer);
  }
  const totalPages=Math.ceil(totalItems/productsPerPage)||1;
  paginationContainer.innerHTML='';
  for(let i=1;i<=totalPages;i++){
     const btn=document.createElement('button');
     btn.textContent=i;
     btn.className=i===currentPage?'active':'';
     btn.addEventListener('click',()=>{ goToPage(i); });
     paginationContainer.appendChild(btn);
  }
}

function renderRefreshButton() {
  const existingBtn = document.getElementById("refreshButton");
  if (existingBtn) return;

  const btn = document.createElement("button");
  btn.id = "refreshButton";
  btn.textContent = "🔁 Оновити товари";
  btn.onclick = reloadProducts;
  btn.style.display = "block";
  btn.style.margin = "30px auto";
  btn.style.padding = "10px 20px";
  btn.style.backgroundColor = "#8b5c2c";
  btn.style.color = "white";
  btn.style.border = "none";
  btn.style.borderRadius = "8px";

  document.body.appendChild(btn);
}

function homeEscapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const HOME_CERTIFICATES = [
  { stars: 500, image: 'images/500.png', note: 'Підійде для знайомства з Art Light.', term: 'Діє 6 місяців' },
  { stars: 1000, image: 'images/1000.png', note: 'Добрий вибір для подарунка.', term: 'Діє 9 місяців', popular: true },
  { stars: 2000, image: 'images/2000.png', note: 'Для щедрих подарунків.', term: 'Діє 1 рік' }
];

let homeMasterclassesCache = [];
let purchasedMasterclassesCache = [];

function normalizeMasterclassKey(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

async function loadPurchasedMasterclasses() {
  try {
    const response = await fetch('/api/user/masterclasses', { credentials: 'include' });
    if (!response.ok) {
      purchasedMasterclassesCache = [];
      return [];
    }
    const data = await response.json();
    purchasedMasterclassesCache = Array.isArray(data.items) ? data.items : [];
    return purchasedMasterclassesCache;
  } catch (_) {
    purchasedMasterclassesCache = [];
    return [];
  }
}

function isMasterclassPurchased(mc) {
  const id = String(mc && mc.id || '').trim();
  const titleKey = normalizeMasterclassKey(mc && mc.title);
  return purchasedMasterclassesCache.some(item => {
    const itemId = String(item && item.id || '').trim();
    return (id && itemId === id) || (titleKey && normalizeMasterclassKey(item && item.title) === titleKey);
  });
}

function masterclassRawVideoUrl(mc) {
  if (!mc || typeof mc !== 'object') return '';
  return String(
    mc.video_url ||
    mc.videoUrl ||
    mc.video ||
    mc.youtube_url ||
    mc.youtubeUrl ||
    mc.youtube ||
    mc.videoLink ||
    mc.link ||
    ''
  ).trim();
}

function masterclassVideoUrls(mc) {
  const raw = typeof mc === 'string' ? String(mc || '').trim() : masterclassRawVideoUrl(mc);
  if (!raw) return '';
  const normalizedRaw = /^(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\//i.test(raw)
    ? `https://${raw}`
    : raw;
  try {
    const url = new URL(normalizedRaw, window.location.origin);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id = '';
    if (host === 'youtu.be') {
      id = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host.endsWith('youtube.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (url.searchParams.get('v')) id = url.searchParams.get('v') || '';
      else if (['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1] || '';
    }
    id = String(id || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (id) {
      const start = url.searchParams.get('t') || url.searchParams.get('start') || '';
      const startParam = start ? `?start=${parseInt(start, 10) || 0}` : '';
      return {
        raw: normalizedRaw,
        embed: `https://www.youtube-nocookie.com/embed/${id}${startParam}`,
        watch: `https://www.youtube.com/watch?v=${id}`
      };
    }
  } catch (_) {}
  return { raw: normalizedRaw, embed: normalizedRaw, watch: normalizedRaw };
}

function ensureHomeExperienceModal() {
  let modal = document.getElementById('homeExperienceModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'homeExperienceModal';
  modal.className = 'home-experience-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="home-experience-dialog" role="dialog" aria-modal="true">
      <button class="home-experience-close" type="button" aria-label="Закрити">&times;</button>
      <div class="home-experience-content"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.classList.contains('home-experience-close')) closeHomeExperienceModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('active')) closeHomeExperienceModal();
  });
  return modal;
}

function closeHomeExperienceModal() {
  const modal = document.getElementById('homeExperienceModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('home-experience-open');
}

function showHomeExperienceModal(html) {
  const modal = ensureHomeExperienceModal();
  const content = modal.querySelector('.home-experience-content');
  content.classList.toggle('certificate-experience', html.includes('certificate-media'));
  content.innerHTML = html;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('home-experience-open');
  return modal;
}

function openCertificateModal(stars) {
  const cert = HOME_CERTIFICATES.find(item => Number(item.stars) === Number(stars)) || HOME_CERTIFICATES[0];
  if (!cert) return;
  const modal = showHomeExperienceModal(`
    <div class="home-experience-media certificate-media">
      <img src="${homeEscapeHtml(cert.image)}" alt="Подарунковий сертифікат ${homeEscapeHtml(cert.stars)} зірок">
      ${cert.popular ? '<span class="home-experience-ribbon">Популярний вибір</span>' : ''}
    </div>
    <div class="home-experience-info">
      <span class="home-experience-eyebrow">Подарунковий сертифікат</span>
      <h2>Подарунковий сертифікат на ${homeEscapeHtml(cert.stars)} грн</h2>
      <p>${homeEscapeHtml(cert.note)} Подарунковий сертифікат приходить у електронному форматі після підтвердження оплати адміністратором. Промокод потрібно активувати у профілі.</p>
      <div class="home-experience-facts">
        <span>${homeEscapeHtml(cert.term)}</span>
        <span>${homeEscapeHtml(cert.stars)} бонусних зірок</span>
        <span>1 ⭐ = 1 грн знижки</span>
        <span>Промокод потрібно активувати у профілі</span>
      </div>
      <div class="home-experience-price"><span>Номінал</span><strong>${homeEscapeHtml(cert.stars)} грн</strong></div>
      <div class="home-experience-actions">
        <button class="home-experience-primary" type="button" data-cert-stars="${homeEscapeHtml(cert.stars)}">Додати в кошик</button>
        <button class="home-experience-secondary" type="button">Продовжити вибір</button>
      </div>
    </div>
  `);
  modal.querySelector('[data-cert-stars]').addEventListener('click', () => {
    addCertificateToCart(cert.stars);
    closeHomeExperienceModal();
  });
  modal.querySelector('.home-experience-secondary').addEventListener('click', closeHomeExperienceModal);
}

function openMasterclassModal(index) {
  const mc = homeMasterclassesCache[Number(index)];
  if (!mc) return;
  const title = mc.title || 'Майстер-клас';
  const price = Number(mc.price || 0) || 0;
  const purchased = isMasterclassPurchased(mc);
  const rawVideoUrl = masterclassRawVideoUrl(mc);
  const videoUrls = masterclassVideoUrls(mc);
  const videoUrl = videoUrls && videoUrls.embed ? videoUrls.embed : '';
  const watchUrl = videoUrls && videoUrls.watch ? videoUrls.watch : videoUrl;
  const modal = showHomeExperienceModal(`
    <div class="home-experience-media">
      ${purchased && videoUrl
        ? `<iframe class="home-experience-video" src="${homeEscapeHtml(videoUrl)}" title="${homeEscapeHtml(title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>`
        : `<img src="${homeEscapeHtml(mc.image || 'images/reklama.png')}" alt="${homeEscapeHtml(title)}">`}
      <span class="home-experience-ribbon">Art Light Academy</span>
    </div>
    <div class="home-experience-info">
      <span class="home-experience-eyebrow">${purchased ? 'Доступ відкрито' : 'Майстер-клас'}</span>
      <h2>${homeEscapeHtml(title)}</h2>
      <p>${homeEscapeHtml(mc.description || 'Навчальний матеріал Art Light з практичними поясненнями та доступом після підтвердження оплати.')}</p>
      <div class="home-experience-facts">
        <span>${homeEscapeHtml(mc.duration || 'Тривалість не вказана')}</span>
        <span>${homeEscapeHtml(mc.level || 'Рівень не вказано')}</span>
        <span>${purchased ? 'Можна переглядати зараз' : (rawVideoUrl ? 'Доступ до відео після оплати' : 'Доступ після підтвердження')}</span>
      </div>
      <div class="home-experience-price"><span>Вартість</span><strong>${price ? `${homeEscapeHtml(price)} грн` : 'За домовленістю'}</strong></div>
      <div class="home-experience-actions">
        ${purchased
          ? (watchUrl ? `<a class="home-experience-primary" href="${homeEscapeHtml(watchUrl)}" target="_blank" rel="noopener">Відкрити відео</a>` : '<button class="home-experience-primary" type="button" disabled>Доступ відкрито</button>')
          : `<button class="home-experience-primary" type="button" data-masterclass-index="${homeEscapeHtml(index)}">Додати в кошик</button>`}
        <button class="home-experience-secondary" type="button">Закрити</button>
      </div>
    </div>
  `);
  const addButton = modal.querySelector('[data-masterclass-index]');
  if (addButton) addButton.addEventListener('click', () => {
    addMasterclassToCart({ dataset: { title, price: String(price), id: mc.id || '', video: rawVideoUrl || '' } });
    closeHomeExperienceModal();
  });
  modal.querySelector('.home-experience-secondary').addEventListener('click', closeHomeExperienceModal);
}

function renderHomeCertificates() {
  const container = document.getElementById('homeCertificateContainer');
  if (!container) return;
  const certificates = [
    { stars: 500, image: 'images/500.png', note: 'Підійде для знайомства з Art Light.', term: 'Діє 6 місяців' },
    { stars: 1000, image: 'images/1000.png', note: 'Добрий вибір для подарунка.', term: 'Діє 9 місяців', popular: true },
    { stars: 2000, image: 'images/2000.png', note: 'Для щедрих подарунків.', term: 'Діє 1 рік' }
  ];
  container.innerHTML = certificates.map(cert => `
    <article class="home-certificate-card ${cert.popular ? 'popular' : ''}">
      ${cert.popular ? '<div class="home-card-ribbon">Популярний вибір</div>' : ''}
      <button class="home-card-image-button" type="button" onclick="openCertificateModal(${cert.stars})" aria-label="Відкрити сертифікат ${homeEscapeHtml(cert.stars)} зірок">
        <img src="${homeEscapeHtml(cert.image)}" alt="Подарунковий сертифікат ${homeEscapeHtml(cert.stars)} зірок" loading="lazy">
      </button>
      <div class="home-card-body">
        <h3>Подарунковий сертифікат</h3>
        <strong>${homeEscapeHtml(cert.stars)} грн</strong>
        <p>${homeEscapeHtml(cert.note)}</p>
        <ul>
          <li>${homeEscapeHtml(cert.term)}</li>
          <li>${homeEscapeHtml(cert.stars)} бонусних зірок після активації</li>
          <li>Електронний формат</li>
          <li>Промокод потрібно активувати у профілі</li>
        </ul>
        <button type="button" onclick="openCertificateModal(${cert.stars})">Детальніше</button>
      </div>
    </article>
  `).join('');
}

async function renderHomeMasterclasses() {
  const container = document.getElementById('homeMasterclassContainer');
  if (!container) return;
  try {
    const [response] = await Promise.all([
      fetch('masterclasses.json?t=' + Date.now(), { cache: 'no-store' }),
      loadPurchasedMasterclasses()
    ]);
    const masterclasses = response.ok ? await response.json() : [];
    if (!Array.isArray(masterclasses) || !masterclasses.length) {
      container.innerHTML = '<p class="home-empty">Майстер-класів поки немає.</p>';
      return;
    }
    homeMasterclassesCache = masterclasses;
    container.innerHTML = masterclasses.map((mc, index) => {
      const purchased = isMasterclassPurchased(mc);
      return `
        <article class="home-masterclass-card ${purchased ? 'is-purchased' : ''}">
          ${purchased ? '<div class="home-card-ribbon purchased">Куплено</div>' : ''}
          <button class="home-card-image-button" type="button" onclick="openMasterclassModal(${index})" aria-label="Відкрити майстер-клас">
            <img src="${homeEscapeHtml(mc.image || 'images/reklama.png')}" alt="${homeEscapeHtml(mc.title || 'Майстер-клас')}" loading="lazy">
          </button>
          <div class="home-card-body">
            <h3>${homeEscapeHtml(mc.title || 'Майстер-клас')}</h3>
            <p>${homeEscapeHtml(mc.description || '')}</p>
            <div class="home-masterclass-meta">
              <span>${homeEscapeHtml(mc.duration || 'Тривалість не вказана')}</span>
              <span>${homeEscapeHtml(mc.level || 'Рівень не вказано')}</span>
              ${purchased ? '<span class="purchased-meta">Доступ відкрито</span>' : ''}
            </div>
            <div class="home-card-footer">
              <strong>${purchased ? 'Куплено' : (mc.price ? `${homeEscapeHtml(mc.price)} ₴` : 'За домовленістю')}</strong>
              <button type="button"
                data-title="${homeEscapeHtml(mc.title || 'Майстер-клас')}"
                data-price="${homeEscapeHtml(mc.price || 0)}"
                data-id="${homeEscapeHtml(mc.id || '')}"
                data-video="${homeEscapeHtml(masterclassRawVideoUrl(mc))}"
                onclick="openMasterclassModal(${index})">${purchased ? 'Дивитися' : 'Детальніше'}</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } catch (error) {
    console.error('Помилка завантаження майстер-класів:', error);
    container.innerHTML = '<p class="home-empty">Не вдалося завантажити майстер-класи.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderHomeCertificates();
  renderHomeMasterclasses();
  startAccountNotificationPolling();
});

function formatCertificateCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})/g, '$1-').replace(/-$/, '');
}

function showCertificateCodePopup(payload) {
  const code = formatCertificateCode(payload && payload.code);
  if (!code) return;
  let modal = document.getElementById('certificateCodePopup');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'certificateCodePopup';
    modal.className = 'certificate-code-popup';
    modal.innerHTML = `
      <div class="certificate-code-card" role="dialog" aria-modal="true" aria-labelledby="certificateCodeTitle">
        <button class="certificate-code-close" type="button" aria-label="Закрити">&times;</button>
        <span class="certificate-code-eyebrow">Подарунковий сертифікат активовано</span>
        <h2 id="certificateCodeTitle">Ваш промокод готовий</h2>
        <p>Оплату підтверджено. Скопіюйте код і активуйте його у профілі, щоб отримати бонусні зірки.</p>
        <button class="certificate-code-value" type="button" title="Натисніть, щоб скопіювати"></button>
        <small class="certificate-code-stars"></small>
        <div class="certificate-code-actions">
          <button class="certificate-code-copy" type="button">Скопіювати код</button>
          <a href="profile.html">Перейти у профіль</a>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.classList.contains('certificate-code-close')) {
        modal.classList.remove('active');
      }
    });
  }

  modal.querySelector('.certificate-code-value').textContent = code;
  modal.querySelector('.certificate-code-stars').textContent = payload && payload.stars
    ? `Номінал: ${payload.stars} ⭐`
    : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      if (typeof window.siteNotify === 'function') window.siteNotify('Промокод скопійовано', { type: 'success' });
    } catch (_) {
      if (typeof window.siteNotify === 'function') window.siteNotify(`Ваш промокод: ${code}`, { type: 'info', duration: 7000 });
    }
  };
  modal.querySelector('.certificate-code-value').onclick = copy;
  modal.querySelector('.certificate-code-copy').onclick = copy;
  modal.classList.add('active');
}

async function fetchUnreadAccountNotifications() {
  const apiBase = (typeof API_BASE_URL === 'string' && API_BASE_URL)
    ? API_BASE_URL
    : ((typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '/api');
  const request = typeof makeAuthenticatedRequest === 'function'
    ? makeAuthenticatedRequest(`${apiBase}/notifications`)
    : fetch(`${apiBase}/notifications`, {
        headers: localStorage.getItem('authToken') ? { Authorization: `Bearer ${localStorage.getItem('authToken')}` } : {},
        credentials: 'include'
      });
  const response = await request;
  if (!response || !response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
}

async function ackAccountNotifications(ids) {
  if (!Array.isArray(ids) || !ids.length) return;
  const apiBase = (typeof API_BASE_URL === 'string' && API_BASE_URL)
    ? API_BASE_URL
    : ((typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '/api');
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  };
  if (typeof makeAuthenticatedRequest === 'function') {
    await makeAuthenticatedRequest(`${apiBase}/notifications/ack`, options);
  } else {
    await fetch(`${apiBase}/notifications/ack`, {
      ...options,
      headers: {
        ...options.headers,
        ...(localStorage.getItem('authToken') ? { Authorization: `Bearer ${localStorage.getItem('authToken')}` } : {})
      },
      credentials: 'include'
    });
  }
}

function notificationToastText(item) {
  const payload = item.payload || {};
  if (item.type === 'order_created') {
    return 'Ви оформили замовлення. Ми отримали його і скоро опрацюємо.';
  }
  if (item.type === 'certificate_issued' && payload.code) {
    return `Подарунковий сертифікат готовий. Ваш промокод: ${formatCertificateCode(payload.code)}`;
  }
  if (item.type === 'payment_confirmed') return 'Оплату підтверджено. Дякуємо, ми вже готуємо ваше замовлення до виконання.';
  if (item.type === 'order_status') return 'Статус вашого замовлення оновлено.';
  if (item.type === 'stars_added' && payload.stars) return `Бонуси нараховано: +${payload.stars} ⭐`;
  return item.message || '';
}

let accountNotificationsStarted = false;
function startAccountNotificationPolling() {
  if (accountNotificationsStarted || !localStorage.getItem('authToken')) return;
  accountNotificationsStarted = true;
  const poll = async () => {
    try {
      const items = await fetchUnreadAccountNotifications();
      if (!items.length) return;
      if (typeof window.registerIncomingNotifications === 'function') {
        window.registerIncomingNotifications(items);
      }
      const ids = [];
      items.forEach(item => {
        if (item && item.id) ids.push(item.id);
        if (item.type === 'certificate_issued') showCertificateCodePopup(item.payload || {});
        if (item.type === 'masterclass_granted') {
          try {
            Promise.resolve(renderHomeMasterclasses()).catch(() => {});
          } catch (_) {}
        }
        const text = notificationToastText(item);
        if (text && typeof window.siteNotify === 'function') {
          window.siteNotify(text, { type: item.type === 'certificate_issued' ? 'success' : 'info', duration: item.type === 'certificate_issued' ? 9000 : 5200 });
        }
      });
      await ackAccountNotifications(ids);
    } catch (_) {}
  };
  setTimeout(poll, 1200);
  setInterval(poll, 12000);
}

function reloadProducts() {
  const cacheBust = new Date().getTime();
  fetch("products.json?t=" + cacheBust)
  .then(r => r.json())
  .then(products => {
    window.productsData = Array.isArray(products) ? products : [];
    allProducts = window.productsData;
    currentPage = 1;
    visibleProductsCount = 9;
    updateCategoryPanel();
    renderProductsPage(currentPage);
  })
  .catch(error => console.error("Помилка завантаження товарів:", error));
}

function createProductCard(product) {
  // Ensure product has required fields with defaults
  const productData = {
    title: product.title || 'Без назви',
    price: Number(product.price) || 0,
    discount: Number(product.discount) || 0,
    images: Array.isArray(product.images) && product.images.length > 0 
      ? product.images 
      : ['images/reklama.png'],
    description: product.description || '',
    specs: Array.isArray(product.specs) ? product.specs : [],
    category: product.category || 'Інші товари',
    availability: (product && (product.isCustomOrder || product.title === 'Свічка під замовлення'))
      ? 'preorder'
      : (product.availability || 'in_stock')
  };

  // Calculate prices
  const hasDiscount = productData.discount > 0;
  const originalPrice = productData.price;
  const discountedPrice = hasDiscount 
    ? Math.round(originalPrice * (1 - productData.discount / 100))
    : originalPrice;

  // Create card container
  const card = document.createElement("div");
  card.className = "product";

  // Add discount badge if applicable
  if (hasDiscount) {
    const discountBadge = document.createElement("div");
    discountBadge.className = "discount-badge";
    discountBadge.textContent = `-${productData.discount}%`;
    card.appendChild(discountBadge);
  }

  // Product image
  const imageWrap = document.createElement("div");
  imageWrap.className = "product-image";
  const img = document.createElement("img");
  img.src = productData.images[0];
  img.alt = productData.title;
  img.addEventListener("click", () => openProductModal(productData.title));
  imageWrap.appendChild(img);
  card.appendChild(imageWrap);

  // Product title
  const title = document.createElement("h3");
  title.textContent = productData.title;
  card.appendChild(title);

  // Availability badge
  (function(){
    const avail = (productData.availability || 'in_stock');
    const badge = document.createElement('div');
    badge.className = 'availability-badge';
    const isPre = avail === 'preorder';
    badge.textContent = isPre ? 'Під замовлення' : 'Є в наявності';
    badge.style.display = 'block';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = '600';
    badge.style.padding = '4px 8px';
    badge.style.borderRadius = '12px';
    badge.style.margin = '6px auto 8px';
    badge.style.width = 'fit-content';
    badge.style.background = isPre ? 'rgba(255, 153, 0, 0.12)' : 'rgba(46, 204, 113, 0.12)';
    badge.style.color = isPre ? '#cc7a00' : '#2ecc71';
    card.appendChild(badge);
  })();

  // Price container (hide for custom candle)
  const price = document.createElement("p");
  price.className = "price";
  if (productData.title === 'Свічка під замовлення') {
    // do not render static price here
    price.textContent = `${productData.price || 0} РіСЂРЅ`;
    price.classList.add('price-placeholder');
  } else if (hasDiscount) {
    const originalPriceSpan = document.createElement("span");
    originalPriceSpan.style.textDecoration = 'line-through';
    originalPriceSpan.style.color = '#999';
    originalPriceSpan.style.marginRight = '8px';
    originalPriceSpan.textContent = `${productData.price} грн`;
    price.appendChild(originalPriceSpan);

    const discountedPriceSpan = document.createElement("span");
    discountedPriceSpan.style.color = '#8b5e3c';
    discountedPriceSpan.style.fontWeight = 'bold';
    discountedPriceSpan.textContent = `${discountedPrice} грн`;
    price.appendChild(discountedPriceSpan);
  } else if (productData.title !== 'Свічка під замовлення') {
    price.textContent = `${productData.price} грн`;
  }
  card.appendChild(price);

  // Order button
  const button = document.createElement("button");
  button.textContent = "Замовити";
  button.className = "order-direct-btn";
  button.onclick = (e) => {
    e.stopPropagation();
    openProductModal(productData.title);
  };
  card.appendChild(button);

  return card;
}

function openProductModal(title) {
  const product = (window.productsData || []).find(p => p.title === title);
  if (!product) return;

  // If this is a set/bundle, render dedicated set modal
  if (product.isSet) {
    return openSetModal(product);
  }

  // Calculate prices for discount
  const hasDiscount = product.discount > 0;
  const originalPrice = Number(product.price) || 0;
  const discountedPrice = hasDiscount 
    ? Math.round(originalPrice * (1 - product.discount / 100))
    : originalPrice;

  // Store images in a variable to use in the carousel
  const productImages = Array.isArray(product.images) ? product.images : [product.images];

  // Create modal HTML with tabs for description, reviews, and specs
  const html = `
    <h2>${product.title}</h2>
    ${(() => { 
      // Determine availability using the same rule as product cards:
      // - If explicit availability is provided in products.json, use it
      // - Otherwise, custom-order items are treated as 'preorder'
      const a = (product && (product.isCustomOrder || product.title === 'Свічка під замовлення'))
        ? 'preorder'
        : (product.availability || 'in_stock');
      const isPre = a === 'preorder';
      const bg = isPre ? 'rgba(255, 153, 0, 0.12)' : 'rgba(46, 204, 113, 0.12)';
      const color = isPre ? '#cc7a00' : '#2ecc71';
      const text = isPre ? 'Під замовлення' : 'Є в наявності';
      return `<div class="availability-line" style="display:block;width:fit-content;margin:8px auto 12px;font-size:13px;font-weight:600;padding:6px 12px;border-radius:14px;background:${bg};color:${color};">${text}</div>`;
    })()}

    <div class="modal-image-container">
      ${productImages.length > 1 ? `
        <button class="modal-arrow left" onclick="event.stopPropagation(); changeImage(-1)" aria-label="Previous image">&#10094;</button>
        <img id="sliderImage" src="${productImages[0]}" class="modal-image" style="cursor: zoom-in; transition: opacity 0.3s ease-in-out;" onclick="openFullScreen(this.src)" alt="${product.title}" />
        <button class="modal-arrow right" onclick="event.stopPropagation(); changeImage(1)" aria-label="Next image">&#10095;</button>
      ` : `
        <img id="sliderImage" src="${productImages[0]}" class="modal-image" style="cursor: zoom-in;" onclick="openFullScreen(this.src)" alt="${product.title}" />
      `}
    </div>

    ${product.title === 'Свічка під замовлення' ? '' : `
      <div class="price-container" style="text-align: center; margin: 15px 0; color: #8b5e3c;">
        ${hasDiscount ? `
          <span style="text-decoration: line-through; color: #999; margin-right: 10px;">
            ${originalPrice} грн
          </span>
          <span style="font-weight: bold; font-size: 1.2em;">
            ${discountedPrice} грн
          </span>
          <span class="discount-chip">-${product.discount}%</span>
        ` : `
          <span style="font-weight: bold; font-size: 1.2em;">
            ${originalPrice} грн
          </span>
        `}
      </div>
    `}

    <div class="modal-tabs">
      <button class="tab-button active" onclick="switchTab('description')">Опис</button>
      <button class="tab-button" onclick="switchTab('specs')">Характеристики</button>
      <button class="tab-button" onclick="switchTab('reviews')">Відгуки</button>
    </div>

    <div class="tab-content">
      <div id="description" class="tab-section active">
        <p>${product.description || 'Опис відсутній'}</p>
      </div>
      <div id="specs" class="tab-section">
        ${product.specs && product.specs.length
          ? `<ul>${product.specs.map(s => `<li>${s}</li>`).join('')}</ul>`
          : `<p>Немає характеристик</p>`}
      </div>
      <div id="reviews" class="tab-section">
        <div id="reviewsList" class="reviews-list"></div>
        ${hasActiveAccountSession()
          ? `
            <form id="reviewForm" class="review-form">
              <h4>Залишити відгук</h4>
              <label>
                Оцінка:
                <select id="reviewRating" required>
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                </select>
              </label>
              <label>
                Коментар:
                <textarea id="reviewComment" rows="3" placeholder="Ваші враження..." required></textarea>
              </label>
              <button type="submit" class="submit-review-btn">Надіслати</button>
            </form>
          `
          : `
            <div class="review-login-prompt">
              Щоб залишити відгук, будь ласка, <a href="auth.html">увійдіть</a> у свій акаунт.
            </div>
          `}
      </div>
    </div>

    ${product.title === 'Свічка під замовлення' ? `
      <div class="custom-config" style="margin: 15px 0;">
        <div class="form-row" style="margin-bottom: 10px;">
          <label for="pmMaterialSelect" style="display:block; margin-bottom:4px;">Матеріал</label>
          <select id="pmMaterialSelect" style="display:none;">
            <option value="massage">Масажний віск</option>
            <option value="soy" selected>Соєвий віск</option>
          </select>

          <div id="pmMaterialSwatches" class="option-swatches material-swatches" aria-label="Вибір матеріалу"></div>
        </div>
        <div class="form-row" style="margin-bottom: 10px;">
          <label for="pmColorSelect" style="display:block; margin-bottom:4px;">Колір</label>
          <select id="pmColorSelect" style="display:none;">
            <option value="white">Білий</option>
            <option value="yellow">Жовтий</option>
            <option value="red">Червоний</option>
            <option value="green">Зелений</option>
            <option value="blue">Блакитний</option>
            <option value="violet">Фіолетовий</option>
          </select>

          <div id="pmColorSwatches" class="option-swatches color-swatches" aria-label="Вибір кольору"></div>
        </div>
        <div class="form-row two-col">
          <div class="field">
            <label for="pmAroma">Аромат</label>
            <select id="pmAroma" class="nice-select">
              <option value="Без аромату">Без аромату</option>
              <option value="Ваніль">Ваніль</option>
              <option value="Лаванда">Лаванда</option>
              <option value="Кава">Кава</option>
              <option value="Карамель">Карамель</option>
              <option value="Цитрус">Цитрус</option>
              <option value="Кокос">Кокос</option>
            </select>
          </div>
          <div class="field">
            <label for="pmVolume">Об'єм</label>
            <select id="pmVolume" class="nice-select">
              <option value="50 мл">50 мл</option>
              <option value="100 мл">100 мл</option>
              <option value="200 мл">200 мл</option>
              <option value="300 мл">300 мл</option>
            </select>
          </div>
        </div>
        <div class="current-price" style="font-weight:600;">Поточна ціна: <strong id="pmCurrentPrice">₴200</strong></div>
      </div>
    ` : ''}

    <div class="quantity-control">
      <button onclick="changeProductQty(this, -1)">−</button>
      <input type="number" value="1" min="1" max="10" readonly />
      <button onclick="changeProductQty(this, 1)">+</button>
    </div>
    ${product.title === 'Свічка під замовлення' 
      ? `<button class="order-btn" id="pmOrderBtn">Замовити</button>`
      : `<button class=\"order-btn\" onclick=\"addFromModalToCart('${product.title}', ${hasDiscount ? discountedPrice : originalPrice})\">Замовити</button>`}
  `;

  const modalContent = document.getElementById("productModalContent");
  modalContent.innerHTML = html;
  modalContent.dataset.images = JSON.stringify(productImages);
  // Initialize current index for slider to avoid src-based detection issues
  modalContent.dataset.currentIndex = '0';
  document.getElementById("productModal").classList.add('open');

// If it's a custom candle, wire up dynamic pricing inside the product modal
if (product.title === 'Свічка під замовлення') {
const BASE_PRICE = 200;
// Наценки: любой цвет, кроме белого, +₴30
const MATERIAL_PRICING = { massage: 0, soy: 0 };
const COLOR_PRICING = { white: 0, yellow: 30, red: 30, green: 30, blue: 30, violet: 30 };
// Аромат: +₴30, если выбран не "Без аромату"
const AROMA_SURCHARGE = 30;
// Объём: надбавки к базовой цене (можно легко отредактировать при необходимости)
const VOLUME_PRICING = { '50 мл': 0, '100 мл': 50, '200 мл': 120, '300 мл': 180 };

const mSel = document.getElementById('pmMaterialSelect');
const cSel = document.getElementById('pmColorSelect');
const priceEl = document.getElementById('pmCurrentPrice');
const qtyInput = document.querySelector('#productModalContent input[type="number"]');
const orderBtn = document.getElementById('pmOrderBtn');
const matSwatches = document.getElementById('pmMaterialSwatches');
const colSwatches = document.getElementById('pmColorSwatches');
const aromaSel = document.getElementById('pmAroma');
const volSel = document.getElementById('pmVolume');

    // Swatch wrapper for colors and lock flag
    const swWrap = colSwatches;
    let lock = false;

    // Disable non-white colors when massage wax is selected
    function updateColorLock() {
      lock = (mSel && mSel.value === 'massage');
      if (lock && cSel) cSel.value = 'white';
      if (swWrap) {
        Array.from(swWrap.children).forEach(btn => {
          const key = btn.getAttribute('data-key');
          const disabled = lock && key !== 'white';
          btn.style.pointerEvents = disabled ? 'none' : 'auto';
          btn.style.opacity = disabled ? '0.5' : '1';
          if (disabled) btn.classList.remove('active');
        });
        if (lock) {
          Array.from(swWrap.children).forEach(btn => btn.classList.remove('active'));
          const whiteBtn = Array.from(swWrap.children).find(b => b.getAttribute('data-key') === 'white');
          if (whiteBtn) whiteBtn.classList.add('active');
        }
      }
    }

    const calc = () => {
      const m = mSel ? mSel.value : 'massage';
      const c = cSel ? cSel.value : 'white';
      const aroma = aromaSel ? aromaSel.value : 'Без аромату';
      const vol = volSel ? volSel.value : '50 мл';

      // Base + material + color
      let price = BASE_PRICE
        + (MATERIAL_PRICING[m] || 0)
        + (COLOR_PRICING[c] || 0);

      // Add aroma and volume surcharges
      if (aroma && aroma !== 'Без аромату') price += AROMA_SURCHARGE;
      price += (VOLUME_PRICING[vol] || 0);

      // Apply lock visuals
      updateColorLock();

      // Update UI
      if (priceEl) priceEl.textContent = `₴${price}`;
      return price;
    }

    if (mSel) mSel.addEventListener('change', () => { updateColorLock(); calc(); });
    if (cSel) cSel.addEventListener('change', calc);
    if (aromaSel) aromaSel.addEventListener('change', calc);
    if (volSel) volSel.addEventListener('change', calc);
    calc();

    // Render swatches
    const materialOptions = [
      { key: 'massage', label: 'Масажний віск', img: 'images/масажний віск.webp' },
      { key: 'soy', label: 'Соєвий віск', img: 'images/соєвий віск.png' }
    ];
    const colorOptions = [
      { key: 'white', color: '#ffffff', title: 'Білий' },
      { key: 'yellow', color: '#ffd400', title: 'Жовтий' },
      { key: 'red', color: '#e53935', title: 'Червоний' },
      { key: 'green', color: '#43a047', title: 'Зелений' },
      { key: 'blue', color: '#4fc3f7', title: 'Блакитний' },
      { key: 'violet', color: '#8e24aa', title: 'Фіолетовий' }
    ];

    const renderMaterialSwatches = () => {
      if (!matSwatches) return;
      matSwatches.innerHTML = '';
      // set default to soy if not set
      if (mSel && !mSel.value) {
        mSel.value = 'soy';
      }
      materialOptions.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'swatch material';
        btn.title = opt.label;
        btn.setAttribute('data-tooltip', opt.label);
        btn.style.backgroundImage = `url('${opt.img}')`;
        btn.style.backgroundSize = 'cover';
        btn.style.backgroundPosition = 'center';
        // активный по значению селекта
        if (mSel && mSel.value === opt.key) btn.classList.add('active');

        btn.addEventListener('click', () => {
          Array.from(matSwatches.children).forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          if (mSel) mSel.value = opt.key;
          updateColorLock();
          calc();
        });
        matSwatches.appendChild(btn);
      });
    };

    const renderColorSwatches = () => {
      if (!colSwatches) return;
      colSwatches.innerHTML = '';
      colorOptions.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'swatch color';
        btn.title = opt.title;
        btn.setAttribute('data-tooltip', opt.title);
        btn.setAttribute('data-key', opt.key);
        btn.style.background = opt.color;
        // default active first circle
        if (idx === 0) btn.classList.add('active');
        btn.addEventListener('click', () => {
          Array.from(colSwatches.children).forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          if (cSel) cSel.value = opt.key;
          calc();
          updateColorLock();
        });
        colSwatches.appendChild(btn);
      });
      if (cSel) cSel.value = colorOptions[0].key;
      updateColorLock();
    };

    renderMaterialSwatches();
    renderColorSwatches();

    if (orderBtn) {
      orderBtn.addEventListener('click', () => {
        const qty = Math.max(1, Math.min(10, parseInt(qtyInput && qtyInput.value, 10) || 1));
        const unitPrice = calc();
        const aromaEl = document.getElementById('pmAroma');
        const volumeEl = document.getElementById('pmVolume');
        const aromaVal = (aromaEl && aromaEl.value) || '';
        const volumeVal = (volumeEl && volumeEl.value) || '';
        const existing = cart.find(i => i.title === 'Свічка під замовлення');
        if (existing) {
          const newQty = Math.min(10, existing.quantity + qty);
          if (existing.quantity + qty > 10) alert('Максимум 10 одиниць одного товару.');
          existing.quantity = newQty;
          existing.price = unitPrice; // обновляем цену на основе текущей конфігурації
          existing.material = mSel && mSel.value;
          existing.color = cSel && cSel.value;
          existing.aroma = aromaVal;
          existing.volume = volumeVal;
        } else {
          cart.push({ title: 'Свічка під замовлення', price: unitPrice, quantity: qty, material: mSel && mSel.value, color: cSel && cSel.value, aroma: aromaVal, volume: volumeVal });
        }
        updateCartCount();
        showAddToCartNotification();
      });
    }
  }

  // Render existing reviews and bind form
  renderReviews(product.title);
  const reviewForm = document.getElementById('reviewForm');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!hasActiveAccountSession()) {
        alert('Потрібно увійти в акаунт, щоб залишити відгук.');
        return;
      }
      const ratingEl = document.getElementById('reviewRating');
      const commentEl = document.getElementById('reviewComment');
      const rating = parseInt(ratingEl.value, 10);
      const comment = (commentEl.value || '').trim();
      if (!rating || !comment) return;
      const displayName = (typeof getCurrentUserDisplayName === 'function') 
        ? getCurrentUserDisplayName() 
        : (localStorage.getItem('userName') || 'Користувач');
      const review = {
        user: displayName,
        rating: Math.max(1, Math.min(5, rating)),
        comment,
        date: new Date().toISOString()
      };
      const saved = await saveReview(product.title, review);
      if (saved) {
        commentEl.value = '';
        ratingEl.value = '5';
        alert('Відгук відправлено на модерацію.');
        await renderReviews(product.title);
      }
    });
  }
}

async function openCustomOrderProductModal(event) {
  if (event) {
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  }
  const customTitle = 'Свічка під замовлення';
  const findProduct = () => (window.productsData || []).find(product => {
    const title = String(product && product.title || '');
    return product && (
      product.isCustomOrder ||
      title === customTitle ||
      title === 'Свічка під замовлення' ||
      title.toLowerCase().includes('під замовлення') ||
      title.toLowerCase().includes('рїс–рґ р·р°рјрѕрір»рµрѕрЅрЅсЏ'.toLowerCase())
    );
  });

  let product = findProduct();
  if (!product) {
    try {
      const response = await fetch("products.json?t=" + Date.now(), { cache: 'no-store' });
      const products = await response.json();
      window.productsData = Array.isArray(products) ? products : [];
      allProducts = window.productsData;
      product = findProduct();
    } catch (_) {
      product = null;
    }
  }

  if (product) {
    const oldModal = document.getElementById('customOrderModal');
    if (oldModal) oldModal.style.display = 'none';
    openProductModal(product.title);
  } else if (typeof siteNotify === 'function') {
    siteNotify('Не знайшов товар "Свічка під замовлення". Оновіть каталог і спробуйте ще раз.', { type: 'error' });
  }
}

// Modal for sets/bundles with clickable item list
function openSetModal(setProduct) {
  const productImages = Array.isArray(setProduct.images) ? setProduct.images : [setProduct.images];
  const hasDiscount = (Number(setProduct.discount) || 0) > 0;
  const originalPrice = Number(setProduct.price) || 0;
  const discountedPrice = hasDiscount ? Math.round(originalPrice * (1 - setProduct.discount / 100)) : originalPrice;

  // Build items list HTML
  const items = Array.isArray(setProduct.items) ? setProduct.items : [];
  const itemsListHtml = items.map((it, idx) => {
    const key = it.type === 'product' ? (it.productTitle || 'Товар') : (it.title || 'Елемент');
    const qty = it.qty != null ? it.qty : 1;
    return `<li class="set-item" data-index="${idx}" tabindex="0">${idx + 1}. ${key} × ${qty}</li>`;
  }).join('');

  const html = `
    <h2>${setProduct.title}</h2>
    <div class="modal-image-container">
      ${productImages.length > 1 ? `
        <button class="modal-arrow left" onclick="event.stopPropagation(); changeImage(-1)" aria-label="Previous image">&#10094;</button>
        <img id="sliderImage" src="${productImages[0]}" class="modal-image" style="cursor: zoom-in; transition: opacity 0.3s ease-in-out;" onclick="openFullScreen(this.src)" alt="${setProduct.title}" />
        <button class="modal-arrow right" onclick="event.stopPropagation(); changeImage(1)" aria-label="Next image">&#10095;</button>
      ` : `
        <img id="sliderImage" src="${productImages[0]}" class="modal-image" style="cursor: zoom-in;" onclick="openFullScreen(this.src)" alt="${setProduct.title}" />
      `}
    </div>

    <div class="price-container" style="text-align: center; margin: 15px 0; color: #8b5e3c;">
      ${hasDiscount ? `
        <span style="text-decoration: line-through; color: #999; margin-right: 10px;">${originalPrice} грн</span>
        <span style="font-weight: bold; font-size: 1.2em;">${discountedPrice} грн</span>
        <span class="discount-chip">-${setProduct.discount}%</span>
      ` : `
        <span style="font-weight: bold; font-size: 1.2em;">${originalPrice} грн</span>
      `}
    </div>

    <div class="set-layout" style="display:flex; gap: 16px; align-items:flex-start;">
      <div class="set-items" style="flex:0 0 280px; max-height:300px; overflow:auto; border:1px solid #eee; border-radius:8px; padding:8px;">
        <h4 style="margin:4px 6px 8px;">Склад набору</h4>
        <ul id="setItemsList" style="list-style:none; padding:0; margin:0;">
          ${itemsListHtml || '<li>Порожній</li>'}
        </ul>
      </div>
      <div class="set-detail" style="flex:1; min-height:160px; border:1px solid #eee; border-radius:8px; padding:12px;">
        <h4 id="setDetailTitle" style="margin-top:0;">Опис набору</h4>
        <div id="setDetailBody">${setProduct.description || 'Без опису'}</div>
      </div>
    </div>

    <div class="quantity-control" style="margin-top:12px;">
      <button onclick="changeProductQty(this, -1)">−</button>
      <input type="number" value="1" min="1" max="10" readonly />
      <button onclick="changeProductQty(this, 1)">+</button>
    </div>
    <button class="order-btn" id="addSetToCartBtn">Додати набір у кошик</button>

    <div class="set-reviews" style="margin-top:16px;">
      <h4 style="margin: 12px 0 8px;">Відгуки</h4>
      <div id="reviewsList" class="reviews-list"></div>
      ${hasActiveAccountSession()
        ? `
            <form id="reviewForm" class="review-form">
              <label style="display:block; margin:6px 0;">
                Оцінка:
                <select id="reviewRating" required>
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                </select>
              </label>
              <label style="display:block; margin:6px 0;">
                Коментар:
                <textarea id="reviewComment" rows="3" placeholder="Ваші враження..." required></textarea>
              </label>
              <button type="submit" class="submit-review-btn">Надіслати</button>
            </form>
          `
        : `
            <div class="review-login-prompt">
              Щоб залишити відгук, будь ласка, <a href="auth.html">увійдіть</a> у свій акаунт.
            </div>
          `}
    </div>
  `;

  const modalContent = document.getElementById('productModalContent');
  modalContent.innerHTML = html;
  modalContent.dataset.images = JSON.stringify(productImages);
  // Initialize current index for set modal slider
  modalContent.dataset.currentIndex = '0';
  document.getElementById('productModal').classList.add('open');

  // Hook up item click to update detail panel
  const listEl = document.getElementById('setItemsList');
  const detailTitleEl = document.getElementById('setDetailTitle');
  const detailBodyEl = document.getElementById('setDetailBody');
  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const li = e.target.closest('li.set-item');
      if (!li) return;
      const idx = parseInt(li.dataset.index, 10);
      const it = items[idx];
      if (!it) return;
      let title = '';
      let desc = '';
      let img = '';
      if (it.type === 'product') {
        const p = (window.productsData || []).find(pp => pp.title === it.productTitle);
        title = it.productTitle || 'Товар';
        desc = (p && p.description) || 'Без опису';
        img = p && p.images && p.images[0];
      } else {
        title = it.title || 'Елемент';
        desc = it.description || 'Без опису';
        img = (it.images && it.images[0]) || '';
      }
      detailTitleEl.textContent = title;
      detailBodyEl.innerHTML = `${img ? `<img src="${img}" alt="${title}" style="max-width:160px; border-radius:6px; float:right; margin:0 0 8px 12px;"/>` : ''}${desc}`;
    });
  }

  // Add to cart button
  const btn = document.getElementById('addSetToCartBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      const qtyInput = document.querySelector('#productModalContent input[type="number"]');
      const quantity = Math.max(1, Math.min(10, parseInt(qtyInput && qtyInput.value, 10) || 1));
      const unitPrice = hasDiscount ? discountedPrice : originalPrice;

      // Compose lightweight breakdown for order message
      const breakdown = items.map(it => ({
        type: it.type,
        title: it.type === 'product' ? (it.productTitle || 'Товар') : (it.title || 'Елемент'),
        qty: it.qty != null ? it.qty : 1
      }));

      const existing = cart.find(c => c.title === setProduct.title && c.isSet);
      if (existing) {
        const newQty = Math.min(10, existing.quantity + quantity);
        if (existing.quantity + quantity > 10) alert('Максимум 10 одиниць одного товару.');
        existing.quantity = newQty;
        existing.price = unitPrice;
        existing.setItems = breakdown;
      } else {
        cart.push({ title: setProduct.title, price: unitPrice, quantity, isSet: true, setItems: breakdown });
      }
      updateCartCount();
      showAddToCartNotification();
    });
  }

  // Render and handle reviews for sets
  try {
    renderReviews(setProduct.title);
  } catch (_) {}
  const reviewForm = document.getElementById('reviewForm');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!hasActiveAccountSession()) {
        alert('Потрібно увійти в акаунт, щоб залишити відгук.');
        return;
      }
      const ratingEl = document.getElementById('reviewRating');
      const commentEl = document.getElementById('reviewComment');
      const rating = parseInt(ratingEl.value, 10);
      const comment = (commentEl.value || '').trim();
      if (!rating || !comment) return;
      const displayName = (typeof getCurrentUserDisplayName === 'function') 
        ? getCurrentUserDisplayName() 
        : (localStorage.getItem('userName') || 'Користувач');
      const review = {
        user: displayName,
        rating: Math.max(1, Math.min(5, rating)),
        comment,
        date: new Date().toISOString()
      };
      const saved = await saveReview(setProduct.title, review);
      if (saved) {
        commentEl.value = '';
        ratingEl.value = '5';
        alert('Відгук відправлено на модерацію.');
        await renderReviews(setProduct.title);
      }
    });
  }
}

function changeImage(direction) {
  const modalContent = document.getElementById("productModalContent");
  const images = JSON.parse(modalContent.dataset.images || '[]');
  const imageElement = document.getElementById("sliderImage");

  if (!imageElement || images.length <= 1) return;

  // Prevent rapid double clicks during transition
  const buttons = document.querySelectorAll('.modal-arrow');
  buttons.forEach(btn => btn.style.pointerEvents = 'none');

  // Use tracked index instead of inferring from src (fixes skipping)
  let currentIndex = parseInt(modalContent.dataset.currentIndex || '0', 10) || 0;
  let newIndex = currentIndex + direction;
  if (newIndex < 0) newIndex = images.length - 1;
  if (newIndex >= images.length) newIndex = 0;

  // Crossfade via overlay image for maximum smoothness
  const DURATION_MS = 260;
  const container = imageElement.parentElement;
  const nextImg = new Image();
  nextImg.onload = () => {
    // Create overlay image for crossfade
    const overlay = document.createElement('img');
    overlay.src = images[newIndex];
    overlay.alt = `Product image ${newIndex + 1}`;
    overlay.className = imageElement.className; // inherit classes
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.objectFit = getComputedStyle(imageElement).objectFit || 'contain';
    overlay.style.opacity = '0';
    overlay.style.transition = `opacity ${DURATION_MS}ms ease`;
    overlay.style.pointerEvents = 'none';
    container.appendChild(overlay);

    // Force reflow and fade in overlay
    void overlay.offsetWidth;
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });

    // When overlay fade-in done: update base image, remove overlay, re-enable arrows
    overlay.addEventListener('transitionend', () => {
      imageElement.src = images[newIndex];
      imageElement.alt = `Product image ${newIndex + 1}`;
      modalContent.dataset.currentIndex = String(newIndex);
      // Remove overlay after swap
      container.removeChild(overlay);
      buttons.forEach(btn => btn.style.pointerEvents = 'auto');
    }, { once: true });
  };
  nextImg.onerror = () => {
    // Fallback: update index and re-enable buttons
    modalContent.dataset.currentIndex = String(newIndex);
    buttons.forEach(btn => btn.style.pointerEvents = 'auto');
  };
  nextImg.src = images[newIndex];
}

function closeProductModal() {
  document.getElementById("productModal").classList.remove('open');
  document.body.style.overflow = 'auto';
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));

  const tabButton = document.querySelector(`.tab-button[onclick*="${tabId}"]`);
  const tabSection = document.getElementById(tabId);
  
  if (tabButton) tabButton.classList.add('active');
  if (tabSection) tabSection.classList.add('active');
}

// ======================
// Reviews helpers
// ======================
function getReviewsKey(title) {
  return 'reviews_' + encodeURIComponent(title);
}

async function loadReviews(title) {
  // Try server first
  try {
    const res = await fetch(`/api/reviews?title=${encodeURIComponent(title)}`);
    if (res.ok) {
      let list = await res.json();
      if (!Array.isArray(list)) list = [];
      // Server is the single source of truth. Clear any legacy local cache so deletions via bot persist.
      try { localStorage.removeItem(getReviewsKey(title)); } catch (_) {}
      return list;
    }
  } catch (e) {
    // ignore, will fallback to localStorage
  }
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(getReviewsKey(title));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function saveReview(title, review) {
  try {
    const payload = { title, ...review };
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to save review');
    }
    return true;
  } catch (e) {
    alert('Не вдалося зберегти відгук. Увійдіть в акаунт і спробуйте ще раз.');
    return false;
  }
}

// Helper to get current user's display name from stored auth data
function getCurrentUserDisplayName() {
  try {
    // Prefer userData from auth-integration (contains firstName/lastName/username)
    const raw = localStorage.getItem('userData');
    if (raw) {
      const u = JSON.parse(raw);
      const first = (u && u.firstName) ? u.firstName.trim() : '';
      const last = (u && u.lastName) ? u.lastName.trim() : '';
      const username = (u && u.username) ? u.username.trim() : '';
      const full = [first, last].filter(Boolean).join(' ').trim();
      return full || username || 'Користувач';
    }
  } catch (e) {}
  // Legacy fallback
  const legacy = localStorage.getItem('userName');
  return (legacy && legacy.trim()) || 'Користувач';
}

async function renderReviews(title) {
  const container = document.getElementById('reviewsList');
  if (!container) return;
  container.innerHTML = '<p class="no-reviews">Завантаження відгуків...</p>';
  const list = await loadReviews(title);
  if (!list.length) {
    container.innerHTML = '<p class="no-reviews">Ще немає відгуків. Будьте першим!</p>';
    return;
  }

  // Build items (newest first)
  const items = list.slice().reverse();
  const DEFAULT_VISIBLE = 2; // show first N by default
  const html = items
    .map((r, idx) => {
      const date = new Date(r.date);
      const dateStr = isNaN(date) ? '' : date.toLocaleDateString();
      const stars = '⭐'.repeat(Math.max(1, Math.min(5, r.rating)));
      const hiddenCls = idx >= DEFAULT_VISIBLE ? ' hidden-review' : '';
      return `
        <div class="review-item${hiddenCls}">
          <div class="review-header">
            <span class="review-user">${r.user || 'Користувач'}</span>
            <span class="review-stars" aria-label="Оцінка: ${r.rating}">${stars}</span>
            <span class="review-date">${dateStr}</span>
          </div>
          <div class="review-comment">${(r.comment || '').replace(/</g, '&lt;')}</div>
          ${r.adminReply || r.reply ? `<div class="review-admin-reply"><strong>Відповідь Art Light</strong><span>${String(r.adminReply || r.reply || '').replace(/</g, '&lt;')}</span></div>` : ''}
        </div>
      `;
    })
    .join('');

  const needToggle = items.length > DEFAULT_VISIBLE;
  const toggleBtn = needToggle
    ? `<button type="button" class="reviews-toggle" aria-expanded="false">Показати більше відгуків</button>`
    : '';

  container.innerHTML = `<div class="reviews-wrap">${html}</div>${toggleBtn}`;

  // Wire up toggle
  if (needToggle) {
    const btn = container.querySelector('.reviews-toggle');
    btn.addEventListener('click', () => {
      const wrap = container.querySelector('.reviews-wrap');
      const expanded = wrap.classList.toggle('expanded');
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.textContent = expanded ? 'Згорнути відгуки' : 'Показати більше відгуків';
    });
  }
}

// Close modal when clicking outside of it
document.addEventListener('click', function(event) {
  const modal = document.getElementById('productModal');
  if (event.target === modal) {
    closeProductModal();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closeProductModal();
  }
});

fetch("products.json?t=" + new Date().getTime())
  .then(res => res.json())
  .then(products => {
    window.productsData = Array.isArray(products) ? products : [];
    allProducts = window.productsData;
    visibleProductsCount = 9;
    updateCategoryPanel(); // ← обновляем панель
    renderProductsPage(currentPage);
    // Initialize mobile search drawer UI (chips + sort)
    try {
      renderSearchChips();
      renderSearchSort();
      bindSearchSortHandlers();
    } catch(_) {}
  })
  .catch(err => {
    console.error("Помилка завантаження товарів:", err);
  });

function updateCategoryPanel() {
  const panel = document.getElementById('categoryPanel');
  // Ищем ul под заголовком "Категорії" (второй ul в панели)
  const categoryHeaders = panel.querySelectorAll('h3');
  let categoryList = null;
  
  // Находим заголовок "Категорії" и следующий за ним ul
  categoryHeaders.forEach(header => {
    if (header.textContent.trim() === 'Категорії') {
      categoryList = header.nextElementSibling;
    }
  });
  
  if (!categoryList || categoryList.tagName !== 'UL') return;

  // Собираем уникальные категории
  const categories = [...new Set(allProducts.map(p => p.category || 'Інше'))];
  
  // Очищаем список категорий
  categoryList.innerHTML = '';
  
  // Добавляем "Всі товари"
  const allItem = document.createElement('li');
  const allLink = document.createElement('a');
  allLink.href = '#';
  allLink.textContent = 'Всі товари';
  allLink.dataset.category = 'all';
  allItem.appendChild(allLink);
  categoryList.appendChild(allItem);
  
  // Добавляем категории
  categories.forEach(cat => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = cat;
    a.dataset.category = cat;
    li.appendChild(a);
    categoryList.appendChild(li);
  });
  
  // Collapse behavior: show only first 3 items, reveal others on toggle
  try {
    const catItems = Array.from(categoryList.querySelectorAll('li'));
    // skip the very first 'Всі товари' (index 0) and allow two more real categories by default
    const DEFAULT_VISIBLE = 3; // total visible rows including 'Всі товари'
    let hiddenCount = 0;
    catItems.forEach((li, idx) => {
      if (idx >= DEFAULT_VISIBLE) {
        li.classList.add('hidden-cat');
        hiddenCount++;
      }
    });
    // Add toggle button if there are hidden items
    const existingToggle = categoryList.querySelector('.cats-toggle');
    if (hiddenCount > 0 && !existingToggle) {
      const toggleLi = document.createElement('li');
      toggleLi.className = 'cats-toggle';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cats-toggle-btn';
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = 'Показати більше <span class="chev">▼</span>';
      btn.addEventListener('click', () => {
        const expanded = categoryList.classList.toggle('expanded');
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        btn.innerHTML = expanded ? 'Згорнути <span class="chev">▲</span>' : 'Показати більше <span class="chev">▼</span>';
      });
      toggleLi.appendChild(btn);
      categoryList.appendChild(toggleLi);
    }
  } catch (_) { /* no-op */ }
  
  // Навешиваем обработчики только на ссылки категорий
  const categoryLinks = categoryList.querySelectorAll('a');
  categoryLinks.forEach(link => {
    const cat = link.dataset.category || link.textContent.trim();
    link.addEventListener('click', e => {
      e.preventDefault();
      currentCategory = cat;
      currentPage = 1;
      resetVisibleProducts();
      panel.classList.remove('open');
      document.body.classList.remove('category-open');
      renderProductsPage(currentPage);
    });
  });
}

function openFullScreen(imageSrc) {
  const fullscreenOverlay = document.createElement("div");
  fullscreenOverlay.style.position = "fixed";
  fullscreenOverlay.style.top = "0";
  fullscreenOverlay.style.left = "0";
  fullscreenOverlay.style.width = "100%";
  fullscreenOverlay.style.height = "100%";
  fullscreenOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.95)";
  fullscreenOverlay.style.display = "flex";
  fullscreenOverlay.style.justifyContent = "center";
  fullscreenOverlay.style.alignItems = "center";
  fullscreenOverlay.style.zIndex = "3000";
  fullscreenOverlay.style.cursor = "zoom-out";

  const fullImg = document.createElement("img");
  fullImg.src = imageSrc;
  fullImg.style.maxWidth = "90%";
  fullImg.style.maxHeight = "90%";
  fullImg.style.boxShadow = "0 0 20px rgba(255,255,255,0.3)";
  fullImg.alt = "Зображення";

  fullscreenOverlay.appendChild(fullImg);

  fullscreenOverlay.addEventListener("click", () => {
    document.body.removeChild(fullscreenOverlay);
  });

  document.body.appendChild(fullscreenOverlay);
}

document.addEventListener('DOMContentLoaded', function() {
  const openMenuBtn = document.getElementById('openMenu');
  const openMenuMobileBtn = document.getElementById('openMenuMobile');
  const closeCategoriesBtn = document.getElementById('closeCategories');
  const categoryPanel = document.getElementById('categoryPanel');

  // helpers
  const openPanel = () => {
    categoryPanel.classList.add('open');
    document.body.classList.add('category-open');
  };
  const closePanel = () => {
    categoryPanel.classList.remove('open');
    document.body.classList.remove('category-open');
  };

  // Ensure menu buttons open the side panel on all pages (and don't navigate)
  if (openMenuBtn) openMenuBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); openPanel(); });
  if (openMenuMobileBtn) openMenuMobileBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); openPanel(); });
  if (closeCategoriesBtn) closeCategoriesBtn.addEventListener('click', closePanel);

  // Close panel when clicking outside
  document.addEventListener('click', function(event) {
    // don't close if click was inside either menu button (including its children)
    const clickedMenuBtn = (openMenuBtn && openMenuBtn.contains(event.target)) || (openMenuMobileBtn && openMenuMobileBtn.contains(event.target));
    const clickedInsidePanel = categoryPanel && categoryPanel.contains(event.target);
    if (!clickedInsidePanel && !clickedMenuBtn) {
      closePanel();
    }
  });

  // Handle clicks on category links (first ul)
  const categoryList = categoryPanel.querySelector('ul:first-of-type');
  if (categoryList) {
    categoryList.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (!link) return;
      
      e.preventDefault();
      const cat = link.dataset.category || link.textContent.trim();
      currentCategory = cat;
      currentPage = 1;
      resetVisibleProducts();
      closePanel();
      renderProductsPage(currentPage);
    });
  }

  // Handle clicks on additional options links (second ul)
  const additionalOptions = categoryPanel.querySelector('ul + ul');
  if (additionalOptions) {
    additionalOptions.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (!link) return;
      
      // Allow the default link behavior
      closePanel();
      
      // If it's a hash link, prevent default and handle scrolling
      if (link.getAttribute('href') === '#') {
        e.preventDefault();
      }
    });
  }
});

initializeSearch();

// Legacy helper for product cards (avoid clashing with main addToCart(title, price))
function addProductToCart(product) {
  const existing = cart.find(item => item.title === product.title);
  if (existing) {
    if (existing.quantity < 10) {
      existing.quantity += 1;
    } else {
      alert("Максимум 10 одиниць одного товару.");
      return;
    }
  } else {
    cart.push({ title: product.title, price: product.price, quantity: 1 });
  }
  updateCartCount();
  showCartNotification();
}

// Custom Order Functionality
document.addEventListener('DOMContentLoaded', function() {
  const customOrderBtn = document.getElementById('customOrderBtn');
  const heroCustomOrderBtn = document.getElementById('heroCustomOrderBtn');
  const customOrderModal = document.getElementById('customOrderModal');
  const closeCustomOrder = document.querySelector('.close-custom-order');
  const customOrderForm = document.getElementById('customOrderForm');
  const photoInput = document.getElementById('customOrderPhoto');
  const photoPreview = document.getElementById('photoPreview');
  let uploadedPhoto = null;
  // Dynamic pricing elements
  const materialSelect = document.getElementById('materialSelect');
  const colorSelect = document.getElementById('colorSelect');
  const currentPriceEl = document.getElementById('customCurrentPrice');
  const customOrderBtnPrice = document.getElementById('customOrderBtnPrice');
  const materialSwatches = document.getElementById('materialSwatches');
  const colorSwatches = document.getElementById('colorSwatches');

  // Pricing rules
  const BASE_PRICE = 200;
  const MATERIAL_PRICING = { paraffin: 0, soy: 50, beeswax: 80 };
  const COLOR_PRICING = { standard: 0, pastel: 10, custom: 30 };

  function calcCustomPrice() {
    const material = materialSelect ? materialSelect.value : 'paraffin';
    const color = colorSelect ? colorSelect.value : 'standard';
    const materialAdd = MATERIAL_PRICING[material] ?? 0;
    const colorAdd = COLOR_PRICING[color] ?? 0;
    return BASE_PRICE + materialAdd + colorAdd;
  }

  function updateCustomPriceUI() {
    const price = calcCustomPrice();
    if (currentPriceEl) currentPriceEl.textContent = `₴${price}`;
  }
  // Build swatches for custom order modal
function initSwatches() {
  if (materialSwatches && materialSelect) {
    const mats = [
      { key: 'paraffin', label: 'Парафін', img: 'images/парафин.jpg' },
      { key: 'soy', label: 'Соєвий', img: 'images/соевый.webp' },
      { key: 'beeswax', label: 'Бджолиний', img: 'images/бджолиний.jpg' }
    ];
    materialSwatches.innerHTML = '';
    mats.forEach((m, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch material';
      btn.title = m.label;
      btn.setAttribute('data-tooltip', m.label);
      btn.style.backgroundImage = `url('${m.img}')`;
      btn.style.backgroundSize = 'cover';
      btn.style.backgroundPosition = 'center';
      if (materialSelect.value === m.key) btn.classList.add('active');
      if (!materialSelect.value && idx === 0) btn.classList.add('active');
      btn.addEventListener('click', () => {
        Array.from(materialSwatches.children).forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        materialSelect.value = m.key;
        updateCustomPriceUI();
        });
        materialSwatches.appendChild(btn);
      });
    }

    if (colorSwatches && colorSelect) {
      const cols = [
        { key: 'standard', color: '#ffffff', title: 'Білий (стандарт)' },
        { key: 'pastel', color: '#ffe4e1', title: 'Рожевий пастель' },
        { key: 'pastel', color: '#e6e0ff', title: 'Лавандовий' },
        { key: 'pastel', color: '#dff5e3', title: 'М’ята' },
        { key: 'pastel', color: '#e3f2fd', title: 'Небесний' },
        { key: 'custom', color: '#ff7f50', title: 'Корал (індив.)' },
        { key: 'custom', color: '#ffa000', title: 'Бурштин' },
        { key: 'custom', color: '#2e7d32', title: 'Лісовий' },
        { key: 'custom', color: '#4e4e4e', title: 'Графіт' }
      ];
      colorSwatches.innerHTML = '';
      cols.forEach((c, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'swatch color';
        btn.title = c.title;
        btn.setAttribute('data-tooltip', c.title);
        btn.style.background = c.color;
        if (idx === 0) btn.classList.add('active');
        btn.addEventListener('click', () => {
          Array.from(colorSwatches.children).forEach(el => el.classList.remove('active'));
          btn.classList.add('active');
          colorSelect.value = c.key;
          updateCustomPriceUI();
        });
        colorSwatches.appendChild(btn);
      });
      colorSelect.value = 'standard';
    }
  }

  function openCustomOrderModal() {
    if (!customOrderModal) return;
    customOrderModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (materialSelect && materialSelect.options.length) {
      materialSelect.value = materialSelect.options[0].value;
    }
    if (colorSelect && colorSelect.options.length) {
      colorSelect.value = colorSelect.options[0].value;
    }
    updateCustomPriceUI();
    initSwatches();
  }

  // Open modal when custom order buttons are clicked
  if (customOrderBtn) {
    customOrderBtn.addEventListener('click', openCustomOrderProductModal);
  }
  if (heroCustomOrderBtn) {
    heroCustomOrderBtn.addEventListener('click', openCustomOrderProductModal);
  }

  // Close modal when X is clicked
  if (closeCustomOrder) {
    closeCustomOrder.addEventListener('click', function() {
      resetCustomOrderForm();
      customOrderModal.style.display = 'none';
      document.body.style.overflow = 'auto';
    });
  }

  // Close modal when clicking outside the modal content
  window.addEventListener('click', function(event) {
    if (event.target === customOrderModal) {
      resetCustomOrderForm();
      customOrderModal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  });

  // Handle photo upload
  if (photoInput) {
    photoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          alert('Розмір файлу не повинен перевищувати 5 МБ');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
          // Create image preview
          const img = document.createElement('img');
          img.src = event.target.result;
          
          // Create remove button
          const removeBtn = document.createElement('button');
          removeBtn.className = 'remove-photo';
          removeBtn.innerHTML = '&times;';
          removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            photoInput.value = '';
            photoPreview.innerHTML = '<div class="no-photo">Фото не вибрано</div>';
            photoPreview.classList.remove('has-image');
            
            // Remove the photo from the custom order data
            const customOrderIndex = cart.findIndex(item => item.title === 'Свічка під замовлення');
            if (customOrderIndex !== -1) {
              cart[customOrderIndex].photo = null;
            }
            uploadedPhoto = null;
          });
          
          // Update preview
          photoPreview.innerHTML = '';
          photoPreview.appendChild(img);
          photoPreview.appendChild(removeBtn);
          photoPreview.classList.add('has-image');
          uploadedPhoto = file;
          
          // Store the photo data in the cart item
          const customOrderIndex = cart.findIndex(item => item.title === 'Свічка під замовлення');
          if (customOrderIndex !== -1) {
            if (!cart[customOrderIndex].customData) {
              cart[customOrderIndex].customData = {};
            }
            cart[customOrderIndex].customData.photo = file;
            cart[customOrderIndex].customData.photoPreview = event.target.result;
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Update price when selections change
  if (materialSelect) materialSelect.addEventListener('change', updateCustomPriceUI);
  if (colorSelect) colorSelect.addEventListener('change', updateCustomPriceUI);
  // Initialize button min price text
  if (customOrderBtnPrice) customOrderBtnPrice.textContent = `від ₴${BASE_PRICE}`;

  // Reset photo upload
  function resetPhotoUpload() {
    photoInput.value = '';
    photoPreview.innerHTML = '<div class="no-photo">Фото не вибрано</div>';
    photoPreview.classList.remove('has-image');
    uploadedPhoto = null;
  }

  // Reset the entire form
  function resetCustomOrderForm() {
    if (customOrderForm) {
      customOrderForm.reset();
    }
    resetPhotoUpload();
  }

  // Handle form submission
  if (customOrderForm) {
    customOrderForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const orderDetails = document.getElementById('customOrderDetails').value.trim();
      
      if (!orderDetails) {
        alert('Будь ласка, опишіть ваше замовлення');
        return;
      }
      const selectedMaterial = materialSelect ? materialSelect.value : 'paraffin';
      const selectedColor = colorSelect ? colorSelect.value : 'standard';
      const calculatedPrice = calcCustomPrice();
      
      // Create FormData object to send both text and file data
      const formData = new FormData();
      formData.append('details', orderDetails);
      formData.append('material', selectedMaterial);
      formData.append('color', selectedColor);
      formData.append('price', String(calculatedPrice));
      if (uploadedPhoto) {
        formData.append('photo', uploadedPhoto);
      }
      formData.append('timestamp', new Date().toISOString());
      
      // Here you would typically send the form data to your server
      // For now, just show a success message
      console.log('Order data:', {
        details: orderDetails,
        material: selectedMaterial,
        color: selectedColor,
        price: calculatedPrice,
        hasPhoto: !!uploadedPhoto,
        timestamp: new Date().toISOString()
      });
      
      alert(`Дякуємо! Орієнтовна ціна: ₴${calculatedPrice}. Ми зв'яжемося з вами для уточнення деталей.`);
      
      // Close the modal and reset the form
      customOrderModal.style.display = 'none';
      document.body.style.overflow = 'auto';
      resetCustomOrderForm();
    });
  }
});

// ======================
// Бонусная система
// ======================

// Инициализируем глобальную переменную bonusStars
window.bonusStars = 0;

// Сброс локальных звезд (вызывается при загрузке страницы)
function resetLocalBonusStars() {
  // Сбрасываем локальные звезды
  localStorage.removeItem('bonusStars');
  
  // Инициализируем глобальную переменную
  if (hasActiveAccountSession()) {
    // Если авторизован - звезды будут загружены через syncBonusStars()
    window.bonusStars = 0;
  } else {
    // Если не авторизован - устанавливаем 0
    window.bonusStars = 0;
  }
  
  console.log('Локальные бонусные звезды сброшены');
}

// Инициализируем глобальную переменную bonusStars
window.bonusStars = 0;

// Инициализация бонусной системы
document.addEventListener('DOMContentLoaded', function() {
  // Элементы интерфейса
  const bonusCounter = document.querySelector('.bonus-counter');
  const bonusStarsElement = document.getElementById('bonusStars');
  const bonusModal = document.getElementById('bonusModal');
  const closeBonusModal = document.querySelector('.close-bonus-modal');
  const useBonusBtn = document.getElementById('useBonusBtn');
  const modalBonusStars = document.getElementById('modalBonusStars');

  // Загрузка количества звезд из localStorage
  function loadBonusStars() {
    // Проверяем, авторизован ли пользователь
    if (!hasActiveAccountSession()) {
      // Если не авторизован - сбрасываем звезды
      localStorage.removeItem('bonusStars');
      return 0;
    }
    
    // Если авторизован - загружаем звезды из backend через auth-integration.js
    // Возвращаем 0, звезды будут загружены из аккаунта
    return 0;
  }

  // Сохранение количества звезд в localStorage
  function saveBonusStars(stars) {
    // Проверяем авторизацию
    if (!hasActiveAccountSession()) {
      // Если не авторизован - не сохраняем локально
      localStorage.removeItem('bonusStars');
      return;
    }
    
    // Если авторизован - сохраняем через backend API
    // Пока что не сохраняем локально, звезды должны синхронизироваться с сервером
    // localStorage.setItem('bonusStars', stars.toString());
  }

  // Обновление отображения количества звезд
  function updateBonusDisplay() {
    if (!hasActiveAccountSession()) {
      // Если не авторизован - показываем 0 звезд
      bonusStars = 0;
    }
    
    const bonusCounter = document.getElementById('bonusCounter');
    if (bonusCounter) {
      bonusCounter.textContent = bonusStars;
    }
    
    // Обновляем отображение в корзине
    const cartStarsElement = document.querySelector('.bonus-stars-count');
    if (cartStarsElement) {
      cartStarsElement.textContent = bonusStars;
    }
  }

  // Добавление звезд за покупку
  function addStarsForPurchase() {
    if (!hasActiveAccountSession()) {
      // Если не авторизован - не добавляем звезды
      return;
    }
    
    // Звезды будут добавлены через backend при успешном заказе
    // bonusStars += 1;
    // saveBonusStars(bonusStars);
    // updateBonusDisplay();
  }

  // Использование звезд для скидки
  function useStars(amount) {
    if (!hasActiveAccountSession()) {
      alert('Для використання бонусних зірок потрібно увійти в акаунт');
      return false;
    }
    
    if (bonusStars >= amount) {
      // Временно блокируем использование звезд до синхронизации с backend
      alert('Функція використання зірок тимчасово недоступна. Зірки будуть синхронізовані з вашим акаунтом.');
      return false;
      
      // bonusStars -= amount;
      // saveBonusStars(bonusStars);
      // updateBonusDisplay();
      // return true;
    } else {
      alert('Недостатньо бонусних зірок');
      return false;
    }
  }

  // Обработчики событий
  if (bonusCounter) {
    bonusCounter.addEventListener('click', (e) => {
      e.preventDefault();
      bonusModal.style.display = 'flex';
      updateBonusDisplay();
    });
  }

  if (closeBonusModal) {
    closeBonusModal.addEventListener('click', () => {
      bonusModal.style.display = 'none';
    });
  }

  if (useBonusBtn) {
    useBonusBtn.addEventListener('click', () => {
      const currentStars = loadBonusStars();
      if (currentStars > 0) {
        const discount = useStars(currentStars);
        alert(`Використано ${discount} ⭐ для знижки ${discount} грн`);
        // Тут можна додати логіку застосування знижки до замовлення
        bonusModal.style.display = 'none';
      }
    });
  }

  // Закрытие модального окна при клике вне его
  window.addEventListener('click', (e) => {
    if (e.target === bonusModal) {
      bonusModal.style.display = 'none';
    }
  });

  // Инициализация отображения бонусов при загрузке страницы
  updateBonusDisplay();
  resetLocalBonusStars();
});

// Добавление звёзд за покупку (вызывать при успешном оформлении заказа)
async function addPurchaseToBonusSystem() {
  console.log('addPurchaseToBonusSystem called');
  // Предохранитель от двойного начисления в пределах одного оформления
  if (window.__purchaseStarsAwarded) {
    console.log('Purchase stars already awarded for this submit, skipping');
    return true;
  }
  window.__purchaseStarsAwarded = true;

  // Проверяем авторизацию
  if (!hasActiveAccountSession()) {
    console.log('User not logged in, cannot add purchase stars');
    return false;
  }

  try {
    if (typeof addBonusStarsForPurchase === 'function') {
      console.log('Calling addBonusStarsForPurchase...');
      const ok = await addBonusStarsForPurchase(10);
      if (ok && typeof syncBonusStars === 'function') {
        await syncBonusStars();
      }
      return !!ok;
    } else {
      console.error('addBonusStarsForPurchase function not found');
      // Fallback: показываем уведомление
      const notification = document.createElement('div');
      notification.className = 'bonus-notification show';
      notification.innerHTML = `
        <div class="bonus-notification-content">
          <p>Дякуємо за покупку! Бонусні зірки будуть додані до вашого акаунту.</p>
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 5000);
      return false;
    }
  } catch (err) {
    console.error('Failed to add purchase stars:', err);
    return false;
  }
}

// (Удалено дублирующийся обработчик отправки заказа)

// Стили для уведомлений о бонусах
const bonusNotificationStyles = document.createElement('style');
bonusNotificationStyles.textContent = `
  .bonus-notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #fff9e6;
    border: 1px solid #ffd700;
    border-radius: 8px;
    padding: 15px 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.3s ease;
    max-width: 300px;
  }
  
  .bonus-notification.show {
    transform: translateY(0);
    opacity: 1;
  }
  
  .bonus-notification-content {
    position: relative;
  }
  
  .bonus-notification-close {
    position: absolute;
    top: -10px;
    right: -10px;
    background: #ffd700;
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }
  
  .bonus-notification p {
    margin: 0;
    color: #8b5e3c;
    font-weight: 500;
  }
`;
document.head.appendChild(bonusNotificationStyles);

// Обновляем функцию addToCart, чтобы добавлять звезды при покупке
const originalAddToCart = window.addToCart;
window.addToCart = function(product) {
  const result = originalAddToCart.apply(this, arguments);
  
  // Добавляем звезды в корзину (можно раскомментировать, если нужно начислять звезды при добавлении в корзину)
  // addPurchaseToBonusSystem();
  
  return result;
};

// Добавляем звёзды при успешном оформлении заказа
// Найти в коде место, где обрабатывается успешное оформление заказа
// и добавить вызов addPurchaseToBonusSystem();
