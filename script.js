// ─── Config ───────────────────────────────────────────────────────────────────
const SHEET_ID  = '1J7cUeHCVm3CiwxwzGTOalSYey3f6vkEttk8ztmxXtTY';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Sheet1`;
const CAT_URL   = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=categories`;
const SELLER    = 'unitybeautykr'; // username to open when "Sotuvchiga yozish"

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
function tgOpen(username, text) {
  const url = `https://t.me/${username}?text=${encodeURIComponent(text)}`;
  if (window.Telegram?.WebApp?.openLink) {
    Telegram.WebApp.openLink(url);
  } else {
    window.open(url, '_blank');
  }
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
    const kurs  = pJson.table.rows[0]?.c[9]?.v || 3.5;

    products = pJson.table.rows.map(r => {
      const price    = r.c[4]?.v ? Number(r.c[4].v) : 0;
      const uzs      = r.c[5]?.v ? Number(r.c[5].v) : (price ? Math.round(price * kurs) : 0);
      return {
        id:          String(r.c[0]?.v || ''),
        name:        r.c[1]?.v || '',
        brand:       r.c[2]?.v || '',
        category:    r.c[3]?.v || '',
        price:       price ? price.toLocaleString('en-US') + ' ₩' : '',
        priceRaw:    price,
        price_uzs:   uzs  ? uzs.toLocaleString('en-US') + " so'm" : '',
        inStock:     r.c[6]?.v === true || String(r.c[6]?.v).toUpperCase() === 'TRUE',
        images:      r.c[7]?.v
          ? String(r.c[7].v).split(/[|,]/).map(s => s.trim()).filter(Boolean)
          : ['https://placehold.co/300x300/f0f0f0/999?text=?'],
        description: r.c[8]?.v || '',
        hidden:      r.c[10]?.v === true || String(r.c[10]?.v).toUpperCase() === 'TRUE',
      };
    });

    products.sort((a, b) => a.brand.localeCompare(b.brand));

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
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderProducts(
    products.filter(p =>
      !p.hidden &&
      p.brand.toLowerCase().includes(q) &&
      (currentCategory === 'barchasi' || p.category === currentCategory)
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
    card.innerHTML = `
      <img loading="lazy" decoding="async"
           src="${cldOpt(p.images[0], 400)}" alt="${p.name}"
           onerror="this.src='https://placehold.co/300x300/f0f0f0/999?text=?'">
      <div class="card-body">
        <div class="brand">${p.brand}</div>
        <div class="name">${p.name}</div>
        <div class="price">${p.price}</div>
        ${p.price_uzs ? `<div style="font-size:12px;color:#999;margin-top:2px">${p.price_uzs}</div>` : ''}
        <span class="badge ${off ? 'out-stock' : 'in-stock'}">${off ? 'Mavjud emas' : 'Mavjud'}</span>
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
      tgOpen(SELLER, `Salom! ${p.name} (${p.brand})\nNarx: ${p.price}${p.price_uzs ? ' / ' + p.price_uzs : ''}\n\nBuyurtma bermoqchiman`);
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
  badge.textContent = p.inStock ? 'Mavjud' : 'Mavjud emas';
  badge.className   = 'badge ' + (p.inStock ? 'in-stock' : 'out-stock');

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
    orderBtn.addEventListener('click', () => tgOpen(SELLER, `Salom! ${p.name} (${p.brand})\nNarx: ${p.price}${p.price_uzs ? ' / ' + p.price_uzs : ''}\n\nBuyurtma bermoqchiman`));
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
  const total = cart.reduce((s, i) => s + i.priceRaw * i.quantity, 0);
  const msg   = "Salom! Buyurtma bermoqchiman:\n\n"
    + cart.map(i => `• ${i.name} (${i.brand}) x${i.quantity} — ${i.price}`).join('\n')
    + `\n\nJami: ${total.toLocaleString('en-US')} ₩`;
  tgOpen(SELLER, msg);
}

// ─── Start ────────────────────────────────────────────────────────────────────
loadProducts();
