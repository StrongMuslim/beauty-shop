const SHEET_ID = '1J7cUeHCVm3CiwxwzGTOalSYey3f6vkEttk8ztmxXtTY';

function tgOpen(username, text) {
  const url = `https://t.me/${username}?text=${encodeURIComponent(text)}`;
  if (window.Telegram?.WebApp?.openTelegramLink) {
    Telegram.WebApp.openTelegramLink(url);
  } else {
    window.open(url);
  }
}
// Cloudinary optimization: scale + auto format/quality.
// Non-Cloudinary URLs are returned unchanged.
function cldOpt(url, width) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('/upload/')) return url;
  if (url.includes('/upload/f_auto') || url.includes(',f_auto')) return url; // already optimized
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Sheet1`;
const CAT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=categories`;
const SHEETDB_URL = 'https://sheetdb.io/api/v1/htqsduumkcfa9';
let products = [];
let categories = [{ id: 'barchasi', label: 'Barchasi' }];

let currentCategory = 'barchasi';

async function loadProducts() {
  try {
    const [productsRes, categoriesRes] = await Promise.all([
      fetch(SHEET_URL),
      fetch(CAT_URL)
    ]);

    const productsText = await productsRes.text();
    const categoriesText = await categoriesRes.text();

    const productsJson = JSON.parse(productsText.substring(47).slice(0, -2));
    const kurs = productsJson.table.rows[0]?.c[9]?.v || 3.5;
    const categoriesJson = JSON.parse(categoriesText.substring(47).slice(0, -2));

    products = productsJson.table.rows.map(row => ({
      id: String(row.c[0]?.v || Date.now()),
      name: row.c[1]?.v || '',
      brand: row.c[2]?.v || '',
      category: row.c[3]?.v || '',
      price: row.c[4]?.v ? Number(row.c[4].v).toLocaleString('en-US') + ' ₩' : '',
      price_uzs: row.c[5]?.v
  ?     Number(row.c[5].v).toLocaleString('en-US') + ' so\'m'
         : row.c[4]?.v ? Math.round(Number(row.c[4].v) * kurs).toLocaleString('en-US') + ' so\'m' : '',
      inStock: row.c[6]?.v === true || row.c[6]?.v === 'TRUE',
      hidden: row.c[10]?.v === true || row.c[10]?.v === 'TRUE',
      images: row.c[7]?.v ? String(row.c[7].v).split(/[|,]/).map(s => s.trim()).filter(Boolean) : ['https://placehold.co/300x300/f0f0f0/999?text=?'],
      description: row.c[8]?.v || ''
    }));

    // Sort by brand so same-brand products appear together
    products.sort((a, b) => a.brand.localeCompare(b.brand));

    const catRows = categoriesJson.table.rows.slice(1);
categories = [
  { id: 'barchasi', label: 'Barchasi' },
  ...catRows
    .filter(row => row.c[0]?.v && row.c[1]?.v)
    .map(row => ({
      id: row.c[0].v,
      label: row.c[1].v
    }))
];

    renderCategories();
    filterProducts();
    updateCategorySelect();
  } catch (e) {
    console.error('Xato:', e);
  }
}

function saveData() {
  localStorage.setItem('products', JSON.stringify(products));
  localStorage.setItem('categories', JSON.stringify(categories));
}

function renderCategories() {
  const container = document.getElementById('categories');
  container.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (cat.id === currentCategory ? ' active' : '');
    btn.textContent = cat.label;
    btn.onclick = () => {
      currentCategory = cat.id;
      renderCategories();
      filterProducts();
    };
    container.appendChild(btn);
  });
}

function filterProducts() {
  const query = document.getElementById('searchInput').value.toLowerCase();
 const filtered = products.filter(p => {
    if (p.hidden) return false;    const matchBrand = p.brand.toLowerCase().includes(query);
    const matchCat = currentCategory === 'barchasi' || p.category === currentCategory;
    return matchBrand && matchCat;
  });
  renderProducts(filtered);
}

function renderProducts(list) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;padding:40px 0">Mahsulot topilmadi</p>';
    return;
  }

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cursor = 'pointer';
card.onclick = (e) => {
  if (e.target.classList.contains('order-btn')) return;
  openProduct(products.indexOf(p));
};
    card.innerHTML = `
<img loading="lazy" decoding="async" src="${cldOpt(p.images[0], 400)}" alt="${p.name}" onerror="this.src='https://placehold.co/300x300/f0f0f0/999?text=?'">      <div class="card-body">
        <div class="brand">${p.brand}</div>
        <div class="name">${p.name}</div>
        <div class="price">${p.price}</div>
        ${p.price_uzs ? `<div style="font-size:12px;color:#999;margin-top:2px">${p.price_uzs}</div>` : ''}
        <span class="badge ${p.inStock ? 'in-stock' : 'out-stock'}">
          ${p.inStock ? 'Mavjud' : 'Mavjud emas'}
        </span>
        <div class="card-actions">
          <button class="order-btn" style="background:#fff;color:#222;border:1px solid #222;margin-bottom:6px"
               ${!p.inStock ? 'disabled style="background:#f5f5f5;color:#ccc;border-color:#ccc"' : ''}
                onclick="event.stopPropagation(); addToCart(${JSON.stringify(p).replace(/"/g, '&quot;')})">
               Savatga qo'shish
          </button>
          <button class="order-btn"
            ${!p.inStock ? 'disabled' : ''}
            onclick="event.stopPropagation(); tgOpen('eyf1n', 'Salom! ${p.name} (${p.brand}) buyurtma bermoqchiman')">
            Sotuvchiga yozish
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// АДМИНКА
let tapCount = 0;
let tapTimer = null;

function handleAdminTap() {
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => {
    tapCount = 0;
  }, 2000);

  if (tapCount >= 5) {
    tapCount = 0;
    openAdmin();
  }
}


function openAdmin() {
  const password = prompt('Parol:');
  if (password !== '1234') {
    alert('Noto\'g\'ri parol');
    return;
  }
  renderProductList();
  renderCategoryList();
  document.getElementById('adminModal').classList.add('open');
}

function closeAdmin() {
  document.getElementById('adminModal').classList.remove('open');
}

function renderProductList() {
  const list = document.getElementById('productList');
  list.innerHTML = '';
  products.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'product-item';
    item.innerHTML = `
      <span>${p.name} — ${p.price}</span>
      <div style="display:flex;gap:6px">
        <button class="del-btn" style="background:#e8f0fe;color:#1a56db" onclick="editProduct(${i})">Tahrirlash</button>
        <button class="del-btn" onclick="deleteProduct(${i})">O'chirish</button>
      </div>
    `;
    list.appendChild(item);
  });
}

async function deleteProduct(index) {
  if (confirm('Mahsulotni o\'chirasizmi?')) {
    try {
      await fetch(SHEETDB_URL + '/id/' + products[index].id, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
      await loadProducts();
      renderProductList();
    } catch (e) {
      alert('Xato yuz berdi');
      console.error(e);
    }
  }
}

let editIndex = -1;

function editProduct(index) {
  editIndex = index;
  const p = products[index];

  document.getElementById('editName').value = p.name;
  document.getElementById('editBrand').value = p.brand;
  document.getElementById('editPrice').value = p.price.replace(' ₩', '');
  document.getElementById('editImage').value = p.images?.[0] || '';  document.getElementById('editDescription').value = p.description || '';
  document.getElementById('editStock').value = p.inStock ? 'true' : 'false';

  const select = document.getElementById('editCategory');
  select.innerHTML = '';
  categories.slice(1).forEach(cat => {
    select.innerHTML += `<option value="${cat.id}" ${cat.id === p.category ? 'selected' : ''}>${cat.label}</option>`;
  });

  document.getElementById('adminModal').classList.remove('open');
  document.getElementById('editModal').classList.add('open');
}

async function saveEdit() {
  const name = document.getElementById('editName').value.trim();
  const brand = document.getElementById('editBrand').value.trim();
  const price = document.getElementById('editPrice').value.trim();
  const image = document.getElementById('editImage').value.trim();
  const description = document.getElementById('editDescription').value.trim();
  const category = document.getElementById('editCategory').value;
  const inStock = document.getElementById('editStock').value === 'true';

  if (!name || !brand || !price) {
    alert('Nomi, brend va narxni kiriting');
    return;
  }

  try {
    await fetch(SHEETDB_URL + '/id/' + products[editIndex].id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          "name": name,
          "brand": brand,
          "category": category,
          "price": price,
          "image": image || products[editIndex].images[0],
          "description": description,
          "inStock": String(inStock)
        }
      })
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await loadProducts();
    closeEdit();
    document.getElementById('adminModal').classList.add('open');
  } catch (e) {
    alert('Xato yuz berdi');
    console.error(e);
  }
}

function closeEdit() {
  document.getElementById('editModal').classList.remove('open');
}

async function addProduct() {
  const name = document.getElementById('newName').value.trim();
  const brand = document.getElementById('newBrand').value.trim();
  const category = document.getElementById('newCategory').value;
  const price = document.getElementById('newPrice').value.trim();
  const image = document.getElementById('newImage').value.trim();
  const description = document.getElementById('newDescription').value.trim();
  const inStock = document.getElementById('newStock').value === 'true';

  if (!name || !brand || !price) {
    alert('Nomi, brend va narxni kiriting');
    return;
  }

  try {
    await fetch(SHEETDB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          id: String(Date.now()),
          name: name,
          brand: brand,
          category: category,
          price: price,
          image: image || 'https://placehold.co/300x300/f0f0f0/999?text=?',
          description: description,
          inStock: String(inStock)
        }]
      })
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await loadProducts();
    document.getElementById('newName').value = '';
    document.getElementById('newBrand').value = '';
    document.getElementById('newPrice').value = '';
    document.getElementById('newImage').value = '';
    document.getElementById('newDescription').value = '';
    alert('Mahsulot qo\'shildi!');
  } catch (e) {
    alert('Xato yuz berdi');
    console.error(e);
  }
}

function renderCategoryList() {
  const list = document.getElementById('categoryList');
  list.innerHTML = '';
  categories.slice(1).forEach((cat, i) => {
    const item = document.createElement('div');
    item.className = 'product-item';
    item.innerHTML = `
      <span>${cat.label}</span>
      <button class="del-btn" onclick="deleteCategory(${i + 1})">O'chirish</button>
    `;
    list.appendChild(item);
  });
}

function addCategory() {
  const label = document.getElementById('newCatLabel').value.trim();
  if (!label) return;
  const id = label.toLowerCase().replace(/\s+/g, '_');
  categories.push({ id, label });
  saveData();
  renderCategories();
  renderCategoryList();
  updateCategorySelect();
  document.getElementById('newCatLabel').value = '';
}

function deleteCategory(index) {
  categories.splice(index, 1);
  saveData();
  renderCategories();
  renderCategoryList();
  updateCategorySelect();
}

function updateCategorySelect() {
  const select = document.getElementById('newCategory');
  select.innerHTML = '';
  categories.slice(1).forEach(cat => {
    select.innerHTML += `<option value="${cat.id}">${cat.label}</option>`;
  });
}



let currentSlide = 0;
let currentPhotos = [];

function openProduct(index) {
  const p = products[index];
  currentSlide = 0;
  currentPhotos = p.images || ['https://placehold.co/300x300/f0f0f0/999?text=?'];
  // Фото слайдер
  const slider = document.getElementById('productSlider');
  const dots = document.getElementById('sliderDots');
  
  // Удаляем старые фото
  slider.querySelectorAll('img').forEach(img => img.remove());
  dots.innerHTML = '';

  currentPhotos.forEach((src, i) => {
    const img = document.createElement('img');
    img.src = cldOpt(src, 1000);
    img.loading = i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.className = i === 0 ? 'active' : '';
    img.onerror = () => img.src = 'https://placehold.co/300x300/f0f0f0/999?text=?';
    slider.insertBefore(img, slider.querySelector('.slider-btn.prev').nextSibling);

    const dot = document.createElement('div');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.onclick = () => goToSlide(i);
    dots.appendChild(dot);
  });

  // Скрываем кнопки если фото одно
  const prevBtn = slider.querySelector('.prev');
  const nextBtn = slider.querySelector('.next');
  prevBtn.style.display = currentPhotos.length > 1 ? 'block' : 'none';
  nextBtn.style.display = currentPhotos.length > 1 ? 'block' : 'none';
  dots.style.display = currentPhotos.length > 1 ? 'flex' : 'none';

  // Заполняем данные
  document.getElementById('modalBrand').textContent = p.brand;
  document.getElementById('modalName').textContent = p.name;
  document.getElementById('modalId').textContent = '🆔 ' + p.id;

  document.getElementById('modalPrice').textContent = p.price;

  // удаляем старую цену в сумах если уже была
  const oldUzs = document.getElementById('modalPriceUzs');
  if (oldUzs) oldUzs.remove();

  // добавляем новую
  if (p.price_uzs) {
    document.getElementById('modalPrice').insertAdjacentHTML(
      'afterend',
      `<div id="modalPriceUzs" style="font-size:13px;color:#999;margin-top:2px">${p.price_uzs}</div>`
    );
  }

document.getElementById('modalDescription').textContent = p.description || '';
  const badge = document.getElementById('modalBadge');
  badge.textContent = p.inStock ? 'Mavjud' : 'Mavjud emas';
  badge.className = 'badge ' + (p.inStock ? 'in-stock' : 'out-stock');

  const orderBtn = document.getElementById('modalOrderBtn');
  if (p.inStock) {
    orderBtn.disabled = false;
    orderBtn.style.background = '#222';
    orderBtn.onclick = () => tgOpen('eyf1n', `Salom! ${p.name} (${p.brand}) buyurtma bermoqchiman`);
  } else {
    orderBtn.disabled = true;
    orderBtn.style.background = '#ccc';
  }

  const cartBtn = document.getElementById('modalCartBtn');
  if (cartBtn) {
    cartBtn.disabled = !p.inStock;
    cartBtn.style.opacity = p.inStock ? '1' : '0.5';
    cartBtn.onclick = () => {
      if (!p.inStock) return;
      addToCart(p);
    };
  }

  // Swipe support
  const sliderEl = document.getElementById('productSlider');
  let swipeStartX = 0;
  sliderEl.ontouchstart = e => { swipeStartX = e.touches[0].clientX; };
  sliderEl.ontouchend = e => {
    const diff = swipeStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) slidePhoto(diff > 0 ? 1 : -1);
  };

  document.getElementById('productModal').classList.add('open');
}

function closeProduct() {
  document.getElementById('productModal').classList.remove('open');
}

function goToSlide(index) {
  const imgs = document.getElementById('productSlider').querySelectorAll('img');
  const dots = document.getElementById('sliderDots').querySelectorAll('.dot');
  imgs[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');
  currentSlide = index;
  imgs[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');
}

function slidePhoto(dir) {
  const total = currentPhotos.length;
  const next = (currentSlide + dir + total) % total;
  goToSlide(next);
}



// Telegram Mini App init
if (window.Telegram?.WebApp) {
  try {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
  } catch (e) { console.warn('WebApp init:', e); }
}

// СТАРТ
loadProducts();
updateCategorySelect();

// КОРЗИНА
let cart = [];

function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  updateCartCount();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartCount();
  renderCart();
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('cartCount');
  if (count > 0) {
    badge.style.display = 'flex';
    badge.textContent = count;
  } else {
    badge.style.display = 'none';
  }
}

function openCart() {
  renderCart();
  document.getElementById('cartModal').classList.add('open');
}

function closeCart() {
  document.getElementById('cartModal').classList.remove('open');
}

function renderCart() {
  const list = document.getElementById('cartList');
  const total = document.getElementById('cartTotal');
  const orderBtn = document.getElementById('cartOrderBtn');

  if (cart.length === 0) {
    list.innerHTML = '<div class="cart-empty">Savat bo\'sh</div>';
    total.style.display = 'none';
    orderBtn.style.display = 'none';
    return;
  }

  list.innerHTML = '';
  let totalPrice = 0;

  cart.forEach((item, i) => {
    const price = parseInt(item.price.replace(/[^0-9]/g, ''));
    totalPrice += price * item.quantity;

    list.innerHTML += `
      <div class="cart-item">
        <div class="cart-item-name">${item.name} (${item.brand})</div>
        <div style="display:flex;align-items:center;gap:8px">
          <button onclick="changeQty(${i}, -1)" style="border:1px solid #ddd;background:#fff;border-radius:6px;width:24px;height:24px;cursor:pointer">−</button>
          <span>${item.quantity}</span>
          <button onclick="changeQty(${i}, 1)" style="border:1px solid #ddd;background:#fff;border-radius:6px;width:24px;height:24px;cursor:pointer">+</button>
        </div>
        <div class="cart-item-price">${item.price}</div>
        <button class="cart-remove" onclick="removeFromCart(${i})">✕</button>
      </div>
    `;
  });

  total.style.display = 'block';
  total.textContent = 'Jami: ' + totalPrice.toLocaleString() + ' ₩';
  orderBtn.style.display = 'block';
}

function changeQty(index, dir) {
  cart[index].quantity += dir;
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }
  updateCartCount();
  renderCart();
}

function sendCartToSeller() {
  if (cart.length === 0) return;

  let message = 'Salom! Buyurtma bermoqchiman:\n\n';
  cart.forEach(item => {
    message += `• ${item.name} (${item.brand}) x${item.quantity} — ${item.price}\n`;
  });

  const total = cart.reduce((sum, item) => {
    const price = parseInt(item.price.replace(/[^0-9]/g, ''));
    return sum + price * item.quantity;
  }, 0);

  message += `\nJami: ${total.toLocaleString()} ₩`;

  tgOpen('eyf1n', message);
}