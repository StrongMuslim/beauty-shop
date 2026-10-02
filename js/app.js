(function (UB) {
  'use strict';

  const { debounce, normalizeText, sleep, installImageHandlers } = UB.utils;
  const $ = id => document.getElementById(id);

  const DEFAULT_FILTERS = { query: '', category: 'all', brand: null, inStockOnly: false, sort: 'recommended' };

  UB.state = { products: [], categories: [], newIds: new Set(), loaded: false, ...DEFAULT_FILTERS };
  UB.byId = new Map();

  UB.track = (name, params) => {
    try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch (_) {}
  };

  // text/plain keeps this a "simple" CORS request — no preflight round-trip.
  UB.notify = payload => {
    try {
      fetch(UB.config.apiBase + '/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ ...payload, currency: UB.currency.get(), user: UB.tg.user || {} }),
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  };

  let toastTimer;
  UB.toast = message => {
    const toast = $('toast');
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => { if (!toast.classList.contains('is-visible')) toast.hidden = true; }, 300);
    }, 2200);
  };

  UB.actions = {
    addToCart(p) {
      UB.cart.add(p.id);
      UB.tg.haptic('light');
      UB.toast("Savatga qo'shildi");
      UB.track('add_to_cart', { item_id: p.id, item_name: p.name, item_brand: p.brand });
      const btn = $('cartBtn');
      btn.classList.remove('is-bump');
      void btn.offsetWidth;
      btn.classList.add('is-bump');
    },
  };

  // ─── Cart / currency reactions ────────────────────────────────────────────

  function updateCartUI() {
    const count = UB.cart.count();
    $('cartCount').textContent = count;
    $('cartCount').hidden = !count;

    const lines = UB.cart.lines()
      .map(l => ({ p: UB.byId.get(l.id), qty: l.qty }))
      .filter(x => x.p && x.p.inStock);
    const bar = $('cartBar');
    const visible = UB.state.loaded && count > 0;
    bar.classList.toggle('is-visible', visible);
    bar.setAttribute('aria-hidden', String(!visible));
    $('cartBarBtn').tabIndex = visible ? 0 : -1;
    if (visible) {
      $('cartBarCount').textContent = `Savatda ${count} ta mahsulot`;
      $('cartBarTotal').textContent = UB.currency.sum(lines) || "Narxi so'rov bo'yicha";
    }

    UB.catalog.refreshControls();
    UB.productView.refresh();
    UB.cartView.refresh();
  }

  function syncCurrencyToggle() {
    const current = UB.currency.get();
    document.querySelectorAll('[data-currency]').forEach(btn => {
      const on = btn.dataset.currency === current;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
  }

  function onCurrencyChange() {
    syncCurrencyToggle();
    if (!UB.state.loaded) return;
    UB.catalog.refreshPrices();
    if (UB.state.sort.startsWith('price')) UB.catalog.renderGrid();
    updateCartUI();
  }

  // ─── Data ─────────────────────────────────────────────────────────────────

  function setData({ products, categories }) {
    const labels = new Map(categories.map(c => [c.id, c.label]));
    products.forEach(p => {
      p.searchText = normalizeText(`${p.name} ${p.brand} ${labels.get(p.category) || p.category} id${p.id}`);
    });
    UB.state.products = products;
    UB.state.categories = categories;
    UB.byId = new Map(products.map(p => [p.id, p]));
    UB.state.newIds = new Set(
      products.filter(p => p.inStock)
        .sort((a, b) => b.idNum - a.idNum)
        .slice(0, UB.config.newArrivals)
        .map(p => p.id)
    );
    UB.cart.prune(new Set(UB.byId.keys()));
  }

  function openFromHash() {
    const m = location.hash.match(/^#p=([^&]+)/);
    if (!m) return;
    const p = UB.byId.get(decodeURIComponent(m[1]));
    history.replaceState(null, '', location.pathname + location.search);
    if (p) UB.productView.open(p);
  }

  let ratePromise = Promise.resolve();

  async function load() {
    UB.catalog.renderSkeleton();
    try {
      const data = await UB.data.load();
      // Give a fresh exchange rate a short head start so first-visit prices don't jump.
      await Promise.race([ratePromise, sleep(1500)]);
      UB.currency.useSheetFallback(data.sheetRate);
      setData(data);
      UB.state.loaded = true;
      UB.catalog.renderAll();
      updateCartUI();
      openFromHash();
    } catch (err) {
      UB.reportError(err, { where: 'catalog-load' });
      UB.catalog.renderError();
    }
  }

  // ─── Controls ─────────────────────────────────────────────────────────────

  function resetFilters() {
    Object.assign(UB.state, DEFAULT_FILTERS);
    $('searchInput').value = '';
    $('searchClear').hidden = true;
    $('inStockOnly').checked = false;
    $('sortSelect').value = DEFAULT_FILTERS.sort;
    UB.catalog.update();
  }

  function bindControls() {
    document.querySelectorAll('[data-currency]').forEach(btn => {
      btn.addEventListener('click', () => {
        UB.currency.set(btn.dataset.currency);
        UB.tg.haptic('light');
        UB.track('select_currency', { currency: btn.dataset.currency });
      });
    });

    $('cartBtn').addEventListener('click', () => UB.cartView.open());
    $('cartBarBtn').addEventListener('click', () => UB.cartView.open());

    const input = $('searchInput');
    const applySearch = debounce(() => {
      UB.state.query = input.value;
      UB.catalog.update();
    }, 150);
    const trackSearch = debounce(q => { if (q.length >= 2) UB.track('search', { search_term: q }); }, 1200);
    input.addEventListener('input', () => {
      $('searchClear').hidden = !input.value;
      applySearch();
      trackSearch(input.value.trim());
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    $('searchClear').addEventListener('click', () => {
      input.value = '';
      $('searchClear').hidden = true;
      UB.state.query = '';
      UB.catalog.update();
      input.focus();
    });

    $('inStockOnly').addEventListener('change', e => {
      UB.state.inStockOnly = e.target.checked;
      UB.catalog.update();
    });
    $('sortSelect').addEventListener('change', e => {
      UB.state.sort = e.target.value;
      UB.catalog.update();
    });

    document.querySelectorAll('[data-link]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const kind = el.dataset.link;
        if (kind === 'telegram') UB.tg.openChat(UB.config.seller);
        else if (kind === 'author') UB.tg.openChat(UB.config.author);
        else if (kind === 'instagram') UB.tg.openLink(UB.config.instagram);
      });
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        $('topbar').classList.toggle('is-scrolled', !entry.isIntersecting);
      }).observe($('topSentinel'));
    }

    // Keeps the rate fresh "several times a day" even if the app stays open.
    setInterval(() => UB.currency.refreshRate(), UB.config.rate.ttlMs);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') UB.currency.refreshRate();
    });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────

  function start() {
    installImageHandlers();
    UB.tg.init();
    UB.theme.apply();
    UB.tg.onBack(() => UB.sheet.closeTop());

    UB.currency.init();
    UB.currency.onChange(onCurrencyChange);
    UB.cart.onChange(updateCartUI);
    syncCurrencyToggle();
    ratePromise = UB.currency.refreshRate().catch(err => UB.reportError(err, { where: 'rate' }));

    UB.sheet.bindAll();
    UB.productView.bind();
    UB.cartView.bind();
    UB.catalog.bind({ onRetry: load, onReset: resetFilters });
    bindControls();

    updateCartUI();
    load();
  }

  try {
    start();
  } catch (err) {
    UB.reportError(err, { where: 'boot' });
    throw err;
  }
})(window.UB = window.UB || {});
