// ─── Config ───────────────────────────────────────────────────────────────────
const SHEET_ID  = '1J7cUeHCVm3CiwxwzGTOalSYey3f6vkEttk8ztmxXtTY';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Sheet1`;
const CAT_URL   = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=categories`;
const SELLER     = 'unitybeautykr';
const NOTIFY_URL = 'https://worker-production-ccde.up.railway.app/notify';

// ─── State ────────────────────────────────────────────────────────────────────
let products        = [];
let categories      = [{ id: 'barchasi', label: 'Barchasi' }];
let currentCategory = 'barchasi';
let cart            = [];
let currentSlide    = 0;
let currentPhotos   = [];

// ─── Telegram Mini App init ───────────────────────────────────────────────────
if (window.Telegram?.WebApp) {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
}

// ─── Utilities ────────────────────────────────────────────────────────────────

// Open Telegram chat. Inside Mini App: just open the chat (no prefill).
// In browser: open with prefilled text.
function shortName(name, max = 22) {
  return name.length > max ? name.slice(0, max).trimEnd() + '…' : name;
}

function tgOpen(username, text) {
  const url = `https://t.me/${username}?text=${encodeURIComponent(text)}`;
  if (window.Telegram?.WebApp?.openLink) {
    Telegram.WebApp.openLink(url);
  } else {
    window.open(url, '_blank');
  }
}

// Send notification to admin bot (fire-and-forget, never blocks UX)
function notifyAdmin(payload) {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
  try {
    fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, user })
    }).catch(() => {});
  } catch (_) {}
}

// Inject Cloudinary resize/optimize transforms. Non-Cloudinary URLs pass through.
function cldOpt(url, w) {
  if (!url || !url.includes('/upload/') || url.includes('f_auto')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${w}/`);
}

// ─── Load data from Google Sheets ────────────────────────────────────────────
async function loadProducts() {
  try {
    const [pRes, cRes] = await Promise.all([fetch(SHEET_URL), fetch(CAT_URL)]);
    const pJson = JSON.parse((await pRes.text()).slice(47, -2));
    const cJson = JSON.parse((await cRes.text()).slice(47, -2));
    const rawKurs = pJson.table.rows[0]?.c[9]?.v;
    const kurs = (typeof rawKurs === 'number' && !isNaN(rawKurs)) ? rawKurs
               : (typeof rawKurs === 'string' && parseFloat(rawKurs) > 0) ? parseFloat(rawKurs)
               : 3.5;

    products = pJson.table.rows.map(r => {
      const price      = r.c[4]?.v ? Number(r.c[4].v) : 0;
      const uzs        = r.c[5]?.v ? Number(r.c[5].v) : (price ? Math.round(price * kurs) : 0);
      const descRaw    = r.c[8]?.v || '';
      const comingSoon = descRaw.startsWith('[SOON]');
      const outOfStock = !comingSoon && descRaw.startsWith('[OUT]');
      // null from gviz = SheetDB wrote string "TRUE" → treat as in-stock
      // boolean false  = genuinely out of stock in Google Sheets
      const inStock    = !comingSoon && !outOfStock && r.c[6]?.v !== false;
      const featured   = r.c[11]?.v === true || String(r.c[11]?.v).toUpperCase() === 'TRUE';
      return {
        id:          String(r.c[0]?.v || ''),
        name:        r.c[1]?.v || '',
        brand:       r.c[2]?.v || '',
        category:    r.c[3]?.v || '',
        price:       price ? price.toLocaleString('en-US') + ' ₩' : '',
        priceRaw:    price,
        uzsRaw:      uzs,
        price_uzs:   uzs  ? uzs.toLocaleString('en-US') + " so'm" : '',
        inStock,
        comingSoon,
        featured,
        images:      r.c[7]?.v
          ? String(r.c[7].v).split(/[|,]/).map(s => s.trim()).filter(Boolean)
          : ['https://placehold.co/300x300/f0f0f0/999?text=?'],
        description: descRaw.replace(/^\[(SOON|OUT)\]\s*/, ''),
        hidden:      r.c[10]?.v === true || String(r.c[10]?.v).toUpperCase() === 'TRUE',
      };
    });

    // Sort: featured in-stock first → regular in-stock → coming soon → out of stock
    const stockRank = p => {
      if (p.inStock && p.featured) return 0;
      if (p.inStock)               return 1;
      if (p.comingSoon)            return 2;
      return 3;
    };
    products.sort((a, b) => {
      if (stockRank(a) !== stockRank(b)) return stockRank(a) - stockRank(b);
      return a.brand.localeCompare(b.brand);
    });

    categories = [
      { id: 'barchasi', label: 'Barchasi' },
      ...cJson.table.rows.slice(1)
        .filter(r => r.c[0]?.v && r.c[1]?.v)
        .map(r => ({ id: String(r.c[0].v), label: String(r.c[1].v) }))
    ];

    renderCategories();
    filterProducts();
  } catch (e) {
    console.error('loadProducts error:', e);
  }
}

// ─── Categories ───────────────────────────────────────────────────────────────
function renderCategories() {
  const el = document.getElementById('categories');
  el.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'cat-btn' + (cat.id === currentCategory ? ' active' : '');
    btn.textContent = cat.label;
    btn.addEventListener('click', () => {
      currentCategory = cat.id;
      renderCategories();
      filterProducts();
    });
    el.appendChild(btn);
  });

}

// ─── Product grid ─────────────────────────────────────────────────────────────
function filterProducts() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  renderProducts(
    products.filter(p =>
      !p.hidden &&
      (currentCategory === 'barchasi' || p.category === currentCategory) &&
      (!q ||
        p.brand.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.id === q
      )
    )
  );
}

function renderProducts(list) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  if (!list.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;padding:40px 0">Mahsulot topilmadi</p>';
    return;
  }

  list.forEach(p => {
    const card = document.createElement('div');
    card.className   = 'card';
    card.style.cursor = 'pointer';

    const off = !p.inStock;
    const badgeClass = p.inStock ? 'in-stock' : p.comingSoon ? 'coming-soon' : 'out-stock';
    const badgeText  = p.inStock ? 'Mavjud' : p.comingSoon ? 'Yaqinda sotuvda' : 'Mavjud emas';
    card.innerHTML = `
      <div style="position:relative">
        <img loading="lazy" decoding="async"
             src="${cldOpt(p.images[0], 400)}" alt="${p.name}"
             onerror="this.src='https://placehold.co/300x300/f0f0f0/999?text=?'"
             style="width:100%;aspect-ratio:1;object-fit:cover;background:#f0f0f0;display:block">
        ${p.featured ? '<div class="featured-ribbon">⭐ Top</div>' : ''}
      </div>
      <div class="card-body">
        <div class="brand">${p.brand}</div>
        <div class="name">${p.name}</div>
        <div class="price">${p.price}</div>
        ${p.price_uzs ? `<div style="font-size:12px;color:#999;margin-top:2px">${p.price_uzs}</div>` : ''}
        <span class="badge ${badgeClass}">${badgeText}</span>
        <div class="card-actions">
          <button class="order-btn js-cart" ${off ? 'disabled' : ''}
            style="${off ? 'background:#f5f5f5;color:#ccc;border:1px solid #eee' : 'background:#fff;color:#222;border:1px solid #222'};margin-bottom:6px">
            Savatga qo'shish
          </button>
          <button class="order-btn js-seller" ${off ? 'disabled' : ''}>
            Sotuvchiga yozish
          </button>
        </div>
      </div>`;

    // Use event listeners (not inline onclick) — safe for names with quotes/special chars
    card.querySelector('.js-cart').addEventListener('click', e => {
      e.stopPropagation();
      if (!p.inStock) return;
      addToCart(p);
    });
    card.querySelector('.js-seller').addEventListener('click', e => {
      e.stopPropagation();
      notifyAdmin({ type: 'product', name: p.name, brand: p.brand, price: p.price + (p.price_uzs ? ' / ' + p.price_uzs : '') });
      tgOpen(SELLER, `Assalomu alaykum!\nID${p.id} | ${shortName(p.name)} (${p.brand})\nNarx: ${p.price}${p.price_uzs ? ' / ' + p.price_uzs : ''}\n\nBuyurtma bermoqchiman`);
    });
    card.addEventListener('click', () => openProduct(p));

    grid.appendChild(card);
  });
}

// ─── Product modal ────────────────────────────────────────────────────────────
function openProduct(p) {
  if (!p) return;
  currentSlide  = 0;
  currentPhotos = p.images.length ? p.images : ['https://placehold.co/300x300/f0f0f0/999?text=?'];

  // Build slider
  const slider = document.getElementById('productSlider');
  const dots   = document.getElementById('sliderDots');
  slider.querySelectorAll('img').forEach(img => img.remove());
  dots.innerHTML = '';

  currentPhotos.forEach((src, i) => {
    const img     = document.createElement('img');
    img.src       = cldOpt(src, 900);
    img.loading   = i === 0 ? 'eager' : 'lazy';
    img.className = i === 0 ? 'active' : '';
    img.onerror   = () => { img.src = 'https://placehold.co/300x300/f0f0f0/999?text=?'; };
    slider.insertBefore(img, slider.querySelector('.slider-btn.prev').nextSibling);

    const dot = document.createElement('div');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goToSlide(i));
    dots.appendChild(dot);
  });

  const multi = currentPhotos.length > 1;
  slider.querySelector('.prev').style.display = multi ? 'flex' : 'none';
  slider.querySelector('.next').style.display = multi ? 'flex' : 'none';
  dots.style.display = multi ? 'flex' : 'none';

  // Fill info
  document.getElementById('modalBrand').textContent = p.brand;
  document.getElementById('modalName').textContent  = p.name;
  document.getElementById('modalId').textContent    = p.id ? '🆔 ' + p.id : '';
  document.getElementById('modalPrice').textContent = p.price;

  const oldUzs = document.getElementById('modalPriceUzs');
  if (oldUzs) oldUzs.remove();
  if (p.price_uzs) {
    document.getElementById('modalPrice').insertAdjacentHTML(
      'afterend',
      `<div id="modalPriceUzs" style="font-size:13px;color:#999;margin-top:2px">${p.price_uzs}</div>`
    );
  }

  document.getElementById('modalDescription').textContent = p.description || '';

  const badge = document.getElementById('modalBadge');
  badge.textContent = p.inStock ? 'Mavjud' : p.comingSoon ? 'Yaqinda sotuvda' : 'Mavjud emas';
  badge.className   = 'badge ' + (p.inStock ? 'in-stock' : p.comingSoon ? 'coming-soon' : 'out-stock');

  // Featured label in modal
  const oldFeat = document.getElementById('modalFeatured');
  if (oldFeat) oldFeat.remove();
  if (p.featured) {
    badge.insertAdjacentHTML('afterend', '<span id="modalFeatured" class="badge featured-badge">⭐ Top mahsulot</span>');
  }

  // Replace buttons to clear old event listeners cleanly
  const cartOld  = document.getElementById('modalCartBtn');
  const orderOld = document.getElementById('modalOrderBtn');
  const cartBtn  = cartOld.cloneNode(true);
  const orderBtn = orderOld.cloneNode(true);
  cartOld.replaceWith(cartBtn);
  orderOld.replaceWith(orderBtn);

  cartBtn.disabled  = !p.inStock;
  orderBtn.disabled = !p.inStock;

  // Outlined style for cart button, depends on stock
  cartBtn.style.cssText = p.inStock
    ? 'background:#fff;color:#222;border:1px solid #222;margin-bottom:8px'
    : 'background:#f5f5f5;color:#bbb;border:1px solid #eee;margin-bottom:8px;cursor:not-allowed';
  orderBtn.style.background = p.inStock ? '' : '#ccc';

  if (p.inStock) {
    cartBtn.addEventListener('click',  () => addToCart(p));
    orderBtn.addEventListener('click', () => {
      notifyAdmin({ type: 'product', name: p.name, brand: p.brand, price: p.price + (p.price_uzs ? ' / ' + p.price_uzs : '') });
      tgOpen(SELLER, `Assalomu alaykum!\nID${p.id} | ${shortName(p.name)} (${p.brand})\nNarx: ${p.price}${p.price_uzs ? ' / ' + p.price_uzs : ''}\n\nBuyurtma bermoqchiman`);
    });
  }

  document.getElementById('productModal').classList.add('open');
}

function closeProduct() {
  document.getElementById('productModal').classList.remove('open');
}

function goToSlide(i) {
  const imgs = document.getElementById('productSlider').querySelectorAll('img');
  const dots = document.getElementById('sliderDots').querySelectorAll('.dot');
  if (!imgs[i]) return;
  imgs[currentSlide]?.classList.remove('active');
  dots[currentSlide]?.classList.remove('active');
  currentSlide = i;
  imgs[i].classList.add('active');
  dots[i].classList.add('active');
}

function slidePhoto(dir) {
  if (!currentPhotos.length) return;
  goToSlide((currentSlide + dir + currentPhotos.length) % currentPhotos.length);
}

// ─── Swipe (attached once at startup) ────────────────────────────────────────
{
  let sx = 0, active = false;
  document.addEventListener('touchstart', e => {
    active = document.getElementById('productModal')?.classList.contains('open')
          && document.getElementById('productSlider')?.contains(e.target);
    if (active) sx = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!active || !e.changedTouches.length) return;
    active = false;
    const dx = sx - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 40) slidePhoto(dx > 0 ? 1 : -1);
  }, { passive: true });
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
function addToCart(p) {
  const ex = cart.find(i => i.id === p.id);
  if (ex) { ex.quantity++; } else { cart.push({ ...p, quantity: 1 }); }
  updateCartCount();
}

function removeFromCart(i) {
  cart.splice(i, 1);
  updateCartCount();
  renderCart();
}

function changeQty(i, dir) {
  cart[i].quantity += dir;
  if (cart[i].quantity <= 0) cart.splice(i, 1);
  updateCartCount();
  renderCart();
}

function updateCartCount() {
  const n     = cart.reduce((s, i) => s + i.quantity, 0);
  const badge = document.getElementById('cartCount');
  badge.textContent   = n;
  badge.style.display = n ? 'flex' : 'none';
}

function openCart()  { renderCart(); document.getElementById('cartModal').classList.add('open'); }
function closeCart() { document.getElementById('cartModal').classList.remove('open'); }

function renderCart() {
  const list     = document.getElementById('cartList');
  const totalEl  = document.getElementById('cartTotal');
  const orderBtn = document.getElementById('cartOrderBtn');

  if (!cart.length) {
    list.innerHTML        = "<div class='cart-empty'>Savat bo'sh</div>";
    totalEl.style.display = orderBtn.style.display = 'none';
    return;
  }

  let total = 0;
  list.innerHTML = cart.map((item, i) => {
    total += item.priceRaw * item.quantity;
    return `
      <div class="cart-item">
        <div class="cart-item-name">${item.name} (${item.brand})</div>
        <div style="display:flex;align-items:center;gap:8px">
          <button onclick="changeQty(${i},-1)" style="border:1px solid #ddd;background:#fff;border-radius:6px;width:24px;height:24px;cursor:pointer">−</button>
          <span>${item.quantity}</span>
          <button onclick="changeQty(${i},1)"  style="border:1px solid #ddd;background:#fff;border-radius:6px;width:24px;height:24px;cursor:pointer">+</button>
        </div>
        <div class="cart-item-price">${item.price}</div>
        <button class="cart-remove" onclick="removeFromCart(${i})">✕</button>
      </div>`;
  }).join('');

  totalEl.textContent   = 'Jami: ' + total.toLocaleString('en-US') + ' ₩';
  totalEl.style.display = orderBtn.style.display = 'block';
}

function sendCartToSeller() {
  if (!cart.length) return;
  const total    = cart.reduce((s, i) => s + i.priceRaw * i.quantity, 0);
  const totalUzs = cart.reduce((s, i) => s + i.uzsRaw  * i.quantity, 0);
  const totalStr = total.toLocaleString('en-US') + ' ₩'
    + (totalUzs ? ' / ' + totalUzs.toLocaleString('en-US') + " so'm" : '');
  notifyAdmin({
    type: 'cart',
    items: cart.map(i => ({ name: i.name, qty: i.quantity, price: i.price + (i.price_uzs ? ' / ' + i.price_uzs : '') })),
    total: totalStr
  });
  const msg = "Assalomu alaykum! Buyurtma bermoqchiman:\n\n"
    + cart.map(i => `• ID${i.id} ${shortName(i.name)} x${i.quantity} — ${i.price}${i.price_uzs ? ' / ' + i.price_uzs : ''}`).join('\n')
    + `\n\nJami: ${totalStr}`;
  tgOpen(SELLER, msg);
}

// ─── Start ────────────────────────────────────────────────────────────────────
loadProducts();
