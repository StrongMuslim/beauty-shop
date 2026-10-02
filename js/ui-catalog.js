(function (UB) {
  'use strict';

  const { esc, normalizeText, cldOpt, srcset, PLACEHOLDER } = UB.utils;
  const I = UB.icons;
  const $ = id => document.getElementById(id);
  const state = () => UB.state;

  const GRID_SIZES = '(min-width: 1200px) 20vw, (min-width: 900px) 25vw, (min-width: 600px) 33vw, 50vw';
  const RAIL_SIZES = '(min-width: 900px) 220px, (min-width: 600px) 190px, 158px';

  // ─── Filtering & sorting ──────────────────────────────────────────────────

  const availability = p => (p.inStock ? 0 : p.comingSoon ? 1 : 2);
  const recommendRank = p => (p.inStock && p.featured ? 0 : availability(p) + 1);
  const priceValue = (p, missing) => {
    const price = UB.currency.priceFor(p);
    return price ? price.amount : missing;
  };

  const SORTS = {
    recommended: (a, b) => recommendRank(a) - recommendRank(b) || b.idNum - a.idNum,
    new: (a, b) => availability(a) - availability(b) || b.idNum - a.idNum,
    price_asc: (a, b) => availability(a) - availability(b) || priceValue(a, Infinity) - priceValue(b, Infinity) || b.idNum - a.idNum,
    price_desc: (a, b) => availability(a) - availability(b) || priceValue(b, -1) - priceValue(a, -1) || b.idNum - a.idNum,
  };

  const queryTokens = q => normalizeText(q).replace(/^(#|id\s*(?=\d))/, '').split(' ').filter(Boolean);

  function filtered() {
    const st = state();
    const tokens = queryTokens(st.query);
    const list = st.products.filter(p =>
      (st.category === 'all' || p.category === st.category) &&
      (!st.brand || p.brandKey === st.brand) &&
      (!st.inStockOnly || p.inStock) &&
      (!tokens.length || tokens.every(t => p.searchText.includes(t))));
    list.sort(SORTS[st.sort] || SORTS.recommended);

    if (tokens.length === 1 && /^\d+$/.test(tokens[0])) {
      const i = list.findIndex(p => p.id === tokens[0]);
      if (i > 0) list.unshift(list.splice(i, 1)[0]);
    }
    return list;
  }

  function filtersActive() {
    const st = state();
    return st.category !== 'all' || !!st.brand || st.inStockOnly || !!st.query.trim();
  }

  function brandIndex(products) {
    const map = new Map();
    products.forEach(p => {
      if (!p.brandKey) return;
      let entry = map.get(p.brandKey);
      if (!entry) map.set(p.brandKey, (entry = { key: p.brandKey, count: 0, spellings: new Map() }));
      entry.count += 1;
      entry.spellings.set(p.brand, (entry.spellings.get(p.brand) || 0) + 1);
    });
    return [...map.values()].map(e => ({
      key: e.key,
      count: e.count,
      label: [...e.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }));
  }

  // ─── Markup ───────────────────────────────────────────────────────────────

  function priceMarkup(p, cls) {
    const text = UB.currency.display(p);
    return `<p class="${cls}${text ? '' : ' is-request'}" data-price-for="${esc(p.id)}">${esc(text || "Narxi so'rov bo'yicha")}</p>`;
  }

  function controlMarkup(p) {
    if (!p.inStock) return '';
    const qty = UB.cart.qty(p.id);
    if (!qty) return `<button type="button" class="add-btn" data-action="add" aria-label="Savatga qo'shish">${I.plus}</button>`;
    return `<div class="stepper" role="group" aria-label="Miqdor">` +
      `<button type="button" data-action="dec" aria-label="Kamaytirish">${I.minus}</button>` +
      `<span>${qty}</span>` +
      `<button type="button" data-action="inc" aria-label="Ko'paytirish">${I.plus}</button></div>`;
  }

  function cardMarkup(p, rail) {
    const img = p.images[0];
    const set = img ? srcset(img, [300, 500, 800]) : '';
    const tag = p.featured
      ? '<span class="tag tag--top">★ Top</span>'
      : state().newIds.has(p.id) ? '<span class="tag tag--new">Yangi</span>' : '';
    const status = p.inStock
      ? ''
      : `<span class="card__status ${p.comingSoon ? 'is-soon' : 'is-out'}">${p.comingSoon ? 'Yaqinda' : 'Tugagan'}</span>`;

    return `<article class="card${p.inStock ? '' : ' is-unavailable'}" data-id="${esc(p.id)}">` +
      `<div class="card__media" data-img>` +
        `<img src="${esc(img ? cldOpt(img, 500) : PLACEHOLDER)}"` +
          (set ? ` srcset="${esc(set)}" sizes="${rail ? RAIL_SIZES : GRID_SIZES}"` : '') +
          ` alt="" loading="lazy" decoding="async">` +
        (tag ? `<div class="card__tags">${tag}</div>` : '') +
        status +
        `<div class="card__ctrl" data-ctrl-for="${esc(p.id)}">${controlMarkup(p)}</div>` +
      `</div>` +
      `<div class="card__body">` +
        `<p class="card__brand">${esc(p.brand)}</p>` +
        `<h3 class="card__name"><button type="button" class="card__link" data-action="open">${esc(p.name)}</button></h3>` +
        `<div class="card__foot">${priceMarkup(p, 'price')}</div>` +
      `</div>` +
    `</article>`;
  }

  const stateMarkup = ({ icon, title, text, action, actionId }) =>
    `<div class="state">` +
      `<div class="state__icon" aria-hidden="true">${icon}</div>` +
      `<p class="state__title">${esc(title)}</p>` +
      `<p class="state__text">${esc(text)}</p>` +
      (action ? `<button type="button" class="btn btn--primary" data-state-action="${actionId}">${esc(action)}</button>` : '') +
    `</div>`;

  // Re-rendering a horizontal strip would otherwise jump it back to the start.
  function setStrip(el, html) {
    const left = el.scrollLeft;
    el.innerHTML = html;
    el.scrollLeft = left;
  }

  // ─── Renderers ────────────────────────────────────────────────────────────

  function renderCategories() {
    const st = state();
    const counts = new Map();
    st.products.forEach(p => counts.set(p.category, (counts.get(p.category) || 0) + 1));

    const known = st.categories.filter(c => counts.get(c.id));
    const extra = [...counts.keys()]
      .filter(id => id && !st.categories.some(c => c.id === id))
      .map(id => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }));
    const list = [{ id: 'all', label: 'Barchasi' }, ...known, ...extra];

    setStrip($('categoryChips'), list.map(c => {
      const active = st.category === c.id;
      const count = c.id === 'all' ? st.products.length : counts.get(c.id) || 0;
      const icon = c.id === 'all' ? '🛍️' : UB.config.categoryIcons[c.id] || '✨';
      return `<button type="button" class="chip${active ? ' is-active' : ''}" data-category="${esc(c.id)}" aria-pressed="${active}">` +
        `<span aria-hidden="true">${icon}</span>${esc(c.label)}<span class="chip__count">${count}</span></button>`;
    }).join(''));
  }

  function renderBrands() {
    const st = state();
    const scope = st.products.filter(p => st.category === 'all' || p.category === st.category);
    const brands = brandIndex(scope).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const strip = $('brandChips');
    strip.hidden = brands.length < 2;
    setStrip(strip, `<span class="chips__label">Brendlar</span>` + brands.map(b => {
      const active = st.brand === b.key;
      return `<button type="button" class="chip chip--sm${active ? ' is-active' : ''}" data-brand="${esc(b.key)}" aria-pressed="${active}">` +
        `${esc(b.label)}<span class="chip__count">${b.count}</span></button>`;
    }).join(''));
  }

  function renderGrid() {
    const list = filtered();
    $('resultCount').textContent = `${list.length} ta mahsulot`;
    $('grid').innerHTML = list.length
      ? list.map(p => cardMarkup(p, false)).join('')
      : stateMarkup({
        icon: '🔍',
        title: 'Hech narsa topilmadi',
        text: "So'rovni o'zgartiring yoki filtrlarni tozalang",
        action: 'Filtrlarni tozalash',
        actionId: 'reset',
      });
  }

  function renderFeatured() {
    const items = state().products
      .filter(p => p.featured && p.inStock)
      .sort((a, b) => b.idNum - a.idNum)
      .slice(0, 16);
    $('featuredRail').innerHTML = items.map(p => cardMarkup(p, true)).join('');
    $('featuredSection').dataset.count = items.length;
    updateFeaturedVisibility();
  }

  function updateFeaturedVisibility() {
    const section = $('featuredSection');
    section.hidden = !Number(section.dataset.count) || filtersActive();
  }

  function renderSkeleton(n = 8) {
    $('resultCount').textContent = '';
    $('grid').innerHTML = Array.from({ length: n }, () =>
      `<div class="card card--skeleton" aria-hidden="true">` +
        `<div class="card__media shimmer"></div>` +
        `<div class="card__body"><span class="sk-line shimmer"></span><span class="sk-line sk-line--lg shimmer"></span><span class="sk-line sk-line--sm shimmer"></span></div>` +
      `</div>`).join('');
  }

  function renderError() {
    $('resultCount').textContent = '';
    $('grid').innerHTML = stateMarkup({
      icon: '⚠️',
      title: "Katalogni yuklab bo'lmadi",
      text: "Internet aloqasini tekshirib, qayta urinib ko'ring",
      action: 'Qayta urinish',
      actionId: 'retry',
    });
  }

  function update() {
    const st = state();
    if (st.brand && !st.products.some(p => p.brandKey === st.brand && (st.category === 'all' || p.category === st.category))) {
      st.brand = null;
    }
    renderCategories();
    renderBrands();
    renderGrid();
    updateFeaturedVisibility();
  }

  function renderAll() {
    renderFeatured();
    update();
  }

  // ─── Live refreshers (no full re-render, so images don't flicker) ────────

  function refreshPrices() {
    document.querySelectorAll('[data-price-for]').forEach(el => {
      const p = UB.byId.get(el.dataset.priceFor);
      if (!p) return;
      const text = UB.currency.display(p);
      el.textContent = text || "Narxi so'rov bo'yicha";
      el.classList.toggle('is-request', !text);
    });
  }

  function refreshControls() {
    document.querySelectorAll('[data-ctrl-for]').forEach(el => {
      const p = UB.byId.get(el.dataset.ctrlFor);
      if (!p) return;
      const qty = UB.cart.qty(p.id);
      const counter = el.querySelector('.stepper span');
      if (qty && counter) {
        counter.textContent = qty;
        return;
      }
      if (!qty && el.querySelector('.add-btn')) return;
      el.innerHTML = controlMarkup(p);
    });
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  function onCardsClick(e) {
    const actionEl = e.target.closest('[data-action]');
    const card = e.target.closest('.card[data-id]');
    if (!actionEl || !card) return;
    const p = UB.byId.get(card.dataset.id);
    if (!p) return;
    switch (actionEl.dataset.action) {
      case 'open': UB.productView.open(p); break;
      case 'add': UB.actions.addToCart(p); break;
      case 'inc': UB.cart.add(p.id); UB.tg.haptic('light'); break;
      case 'dec': UB.cart.setQty(p.id, UB.cart.qty(p.id) - 1); UB.tg.haptic('light'); break;
    }
  }

  function bind({ onRetry, onReset }) {
    $('grid').addEventListener('click', e => {
      const stateBtn = e.target.closest('[data-state-action]');
      if (stateBtn) {
        if (stateBtn.dataset.stateAction === 'retry') onRetry();
        else onReset();
        return;
      }
      onCardsClick(e);
    });
    $('featuredRail').addEventListener('click', onCardsClick);

    $('categoryChips').addEventListener('click', e => {
      const chip = e.target.closest('[data-category]');
      if (!chip || chip.dataset.category === state().category) return;
      state().category = chip.dataset.category;
      UB.tg.haptic('light');
      update();
    });

    $('brandChips').addEventListener('click', e => {
      const chip = e.target.closest('[data-brand]');
      if (!chip) return;
      const st = state();
      st.brand = st.brand === chip.dataset.brand ? null : chip.dataset.brand;
      UB.tg.haptic('light');
      update();
    });
  }

  UB.catalog = {
    bind,
    update,
    renderAll,
    renderGrid,
    renderSkeleton,
    renderError,
    refreshPrices,
    refreshControls,
    filtersActive,
  };
})(window.UB = window.UB || {});
