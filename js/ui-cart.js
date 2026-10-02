(function (UB) {
  'use strict';

  const { esc, cldOpt, PLACEHOLDER, shortName, copyText } = UB.utils;
  const I = UB.icons;
  const $ = id => document.getElementById(id);

  let confirmClear = false;
  let confirmTimer = null;

  function entries() {
    return UB.cart.lines()
      .map(l => ({ p: UB.byId.get(l.id), qty: l.qty }))
      .filter(x => x.p);
  }

  function lineMarkup({ p, qty }) {
    const img = p.images[0];
    const unit = UB.currency.display(p);
    return `<div class="cart-line${p.inStock ? '' : ' is-unavailable'}" data-id="${esc(p.id)}">` +
      `<div class="cart-line__media" data-img><img src="${esc(img ? cldOpt(img, 200) : PLACEHOLDER)}" alt="" loading="lazy" decoding="async"></div>` +
      `<div>` +
        `<p class="cart-line__brand">${esc(p.brand)}</p>` +
        `<p class="cart-line__name">${esc(p.name)}</p>` +
        `<p class="cart-line__price">${p.inStock ? esc(unit || "Narxi so'rov bo'yicha") : 'Hozir mavjud emas'}</p>` +
      `</div>` +
      `<div class="cart-line__side">` +
        (p.inStock
          ? `<div class="stepper stepper--sm" role="group" aria-label="Miqdor">` +
              `<button type="button" data-cart="dec" aria-label="Kamaytirish">${I.minus}</button>` +
              `<span>${qty}</span>` +
              `<button type="button" data-cart="inc" aria-label="Ko'paytirish">${I.plus}</button>` +
            `</div>`
          : '') +
        `<button type="button" class="cart-line__remove" data-cart="remove" aria-label="O'chirish">${I.trash}</button>` +
      `</div>` +
    `</div>`;
  }

  function render() {
    const list = entries();
    const body = $('cartBody');
    const foot = $('cartFoot');
    $('cartTitleCount').textContent = list.length ? `· ${UB.cart.count()} ta` : '';

    if (!list.length) {
      body.innerHTML =
        `<div class="state">` +
          `<div class="state__icon" aria-hidden="true">🛍️</div>` +
          `<p class="state__title">Savat bo'sh</p>` +
          `<p class="state__text">Yoqqan mahsulotlarni “+” tugmasi bilan qo'shing</p>` +
          `<button type="button" class="btn btn--primary" data-cart="browse">Katalogga qaytish</button>` +
        `</div>`;
      foot.hidden = true;
      return;
    }

    const available = list.filter(x => x.p.inStock);
    const unavailable = list.length - available.length;
    body.innerHTML =
      `<div class="cart-list">${list.map(lineMarkup).join('')}</div>` +
      (unavailable
        ? `<p class="cart-note">${I.alert} ${unavailable} ta mahsulot hozir mavjud emas — buyurtmaga qo'shilmaydi</p>`
        : '');

    foot.hidden = false;
    foot.innerHTML =
      `<div class="cart-summary">` +
        `<div class="cart-summary__row"><span>Jami</span><strong>${esc(UB.currency.sum(available) || '—')}</strong></div>` +
        `<p class="cart-summary__note">Yetkazib berish narxi alohida hisoblanadi</p>` +
      `</div>` +
      `<div class="cart-actions">` +
        `<button type="button" class="btn btn--ghost" data-cart="clear">${confirmClear ? 'Rostdan ham?' : 'Tozalash'}</button>` +
        `<button type="button" class="btn btn--accent btn--grow" data-cart="checkout"${available.length ? '' : ' disabled'}>${I.telegram} Sotuvchiga yuborish</button>` +
      `</div>`;
  }

  function checkout() {
    const list = entries().filter(x => x.p.inStock);
    if (!list.length) return;

    const total = UB.currency.sum(list);
    const lines = list.map(({ p, qty }) => {
      const price = UB.currency.display(p);
      return `• ID${p.id} ${shortName(p.name)} ×${qty}` + (price ? ` — ${price}` : '');
    });
    const text = `Assalomu alaykum! Buyurtma bermoqchiman:\n\n${lines.join('\n')}\n\nJami: ${total}`;

    UB.notify({
      type: 'cart',
      items: list.map(({ p, qty }) => ({ name: `ID${p.id} ${p.name} (${p.brand})`, qty, price: UB.currency.adminLabel(p) })),
      total: UB.currency.adminSum(list),
    });
    UB.track('begin_checkout', { items: list.length });
    UB.tg.haptic('success');
    // Prefill can fail on old Telegram clients — the clipboard copy is the fallback.
    copyText(text).then(ok => { if (ok) UB.toast('Buyurtma matni nusxalandi'); });
    UB.tg.openChat(UB.config.seller, text);
  }

  function onAction(e) {
    const el = e.target.closest('[data-cart]');
    if (!el) return;
    const id = el.closest('[data-id]')?.dataset.id;
    switch (el.dataset.cart) {
      case 'inc': UB.cart.add(id); UB.tg.haptic('light'); break;
      case 'dec': UB.cart.setQty(id, UB.cart.qty(id) - 1); UB.tg.haptic('light'); break;
      case 'remove': UB.cart.remove(id); UB.tg.haptic('light'); break;
      case 'checkout': checkout(); break;
      case 'browse': UB.sheet.close($('cartSheet')); break;
      case 'clear':
        if (!confirmClear) {
          confirmClear = true;
          render();
          clearTimeout(confirmTimer);
          confirmTimer = setTimeout(() => { confirmClear = false; render(); }, 3000);
        } else {
          confirmClear = false;
          clearTimeout(confirmTimer);
          UB.cart.clear();
          UB.tg.haptic('warning');
        }
        break;
    }
  }

  function open() {
    confirmClear = false;
    render();
    UB.sheet.open($('cartSheet'));
    UB.track('view_cart', { items: UB.cart.count() });
  }

  function refresh() {
    if (UB.sheet.isOpen($('cartSheet'))) render();
  }

  function bind() {
    $('cartSheet').addEventListener('click', onAction);
  }

  UB.cartView = { open, refresh, bind };
})(window.UB = window.UB || {});
