let products = JSON.parse(localStorage.getItem('products')) || [
  {
    id: 1,
    name: "Tonal krem SPF30",
    brand: "Laneige",
    category: "yuz",
    price: "35,000 ₩",
    image: "https://placehold.co/300x300/fce4ec/c2185b?text=Laneige",
    inStock: true
  },
  {
    id: 2,
    name: "Lipstic matoviy №14",
    brand: "3CE",
    category: "lablar",
    price: "18,000 ₩",
    image: "https://placehold.co/300x300/fce4ec/c2185b?text=3CE",
    inStock: true
  },
  {
    id: 3,
    name: "Tush hajmli",
    brand: "Clio",
    category: "kozlar",
    price: "22,000 ₩",
    image: "https://placehold.co/300x300/fce4ec/c2185b?text=Clio",
    inStock: false
  },
  {
    id: 4,
    name: "Vitamin C serumi",
    brand: "Some By Mi",
    category: "parvarish",
    price: "29,000 ₩",
    image: "https://placehold.co/300x300/fce4ec/c2185b?text=SomeByMi",
    inStock: true
  }
];

let categories = JSON.parse(localStorage.getItem('categories')) || [
  { id: 'barchasi', label: 'Barchasi' },
  { id: 'yuz', label: 'Yuz' },
  { id: 'lablar', label: 'Lablar' },
  { id: 'kozlar', label: "Ko'zlar" },
  { id: 'parvarish', label: 'Parvarish' }
];

let currentCategory = 'barchasi';

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
    const matchBrand = p.brand.toLowerCase().includes(query);
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
      <img src="${p.image}" alt="${p.name}" onerror="this.src='https://placehold.co/300x300/f0f0f0/999?text=?'">
      <div class="card-body">
        <div class="brand">${p.brand}</div>
        <div class="name">${p.name}</div>
        <div class="price">${p.price}</div>
        <span class="badge ${p.inStock ? 'in-stock' : 'out-stock'}">
          ${p.inStock ? 'Mavjud' : 'Mavjud emas'}
        </span>
        <button class="order-btn"
          ${!p.inStock ? 'disabled' : ''}
          onclick="window.open('https://t.me/sayf1n?text=Salom! ${encodeURIComponent(p.name)} (${p.brand}) buyurtma bermoqchiman')">
          Sotuvchiga yozish
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// АДМИНКА
function openAdmin() {
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

function deleteProduct(index) {
  if (confirm('Mahsulotni o\'chirasizmi?')) {
    products.splice(index, 1);
    saveData();
    renderProductList();
    filterProducts();
  }
}

let editIndex = -1;

function editProduct(index) {
  editIndex = index;
  const p = products[index];

  document.getElementById('editName').value = p.name;
  document.getElementById('editBrand').value = p.brand;
  document.getElementById('editPrice').value = p.price.replace(' ₩', '');
  document.getElementById('editImage').value = p.image;
  document.getElementById('editDescription').value = p.description || '';
  document.getElementById('editStock').value = p.inStock ? 'true' : 'false';

  const select = document.getElementById('editCategory');
  select.innerHTML = '';
  categories.slice(1).forEach(cat => {
    select.innerHTML += `<option value="${cat.id}" ${cat.id === p.category ? 'selected' : ''}>${cat.label}</option>`;
  });

  document.getElementById('adminModal').classList.remove('open');
  document.getElementById('editModal').classList.add('open');
}

function saveEdit() {
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

  products[editIndex] = {
    ...products[editIndex],
    name, brand, category,
    price: price + ' ₩',
    image: image || products[editIndex].image,
    description,
    inStock
  };

  saveData();
  filterProducts();
  closeEdit();
  document.getElementById('adminModal').classList.add('open');
}

function closeEdit() {
  document.getElementById('editModal').classList.remove('open');
}

function addProduct() {
  const name = document.getElementById('newName').value.trim();
  const brand = document.getElementById('newBrand').value.trim();
  const category = document.getElementById('newCategory').value;
  const price = document.getElementById('newPrice').value.trim();
  const image = document.getElementById('newImage').value.trim();
const description = document.getElementById('newDescription').value.trim();
const inStock = document.getElementById('newStock').value === 'true';
  if (!name || !brand || !price) {
    alert('Ism, brend va narxni kiriting');
    return;
  }

  products.push({
    id: Date.now(),
    name, brand, category,
    price: price + ' ₩',
    image: image || 'https://placehold.co/300x300/f0f0f0/999?text=?',
    description,
    inStock
  });

  saveData();
  renderProductList();
  filterProducts();

  document.getElementById('newName').value = '';
  document.getElementById('newBrand').value = '';
  document.getElementById('newPrice').value = '';
  document.getElementById('newImage').value = '';
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
  currentPhotos = p.images ? p.images : [p.image];

  // Фото слайдер
  const slider = document.getElementById('productSlider');
  const dots = document.getElementById('sliderDots');
  
  // Удаляем старые фото
  slider.querySelectorAll('img').forEach(img => img.remove());
  dots.innerHTML = '';

  currentPhotos.forEach((src, i) => {
    const img = document.createElement('img');
    img.src = src;
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
  document.getElementById('modalPrice').textContent = p.price;
  document.getElementById('modalDescription').textContent = p.description || '';

  const badge = document.getElementById('modalBadge');
  badge.textContent = p.inStock ? 'Mavjud' : 'Mavjud emas';
  badge.className = 'badge ' + (p.inStock ? 'in-stock' : 'out-stock');

  const orderBtn = document.getElementById('modalOrderBtn');
  if (p.inStock) {
    orderBtn.disabled = false;
    orderBtn.style.background = '#222';
    orderBtn.onclick = () => window.open(`https://t.me/sayf1n?text=Salom! ${encodeURIComponent(p.name)} (${p.brand}) buyurtma bermoqchiman`);
  } else {
    orderBtn.disabled = true;
    orderBtn.style.background = '#ccc';
  }

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



// СТАРТ
renderCategories();
filterProducts();
updateCategorySelect();