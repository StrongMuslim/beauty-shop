(function (UB) {
  'use strict';

  const { esc, cldOpt, PLACEHOLDER, copyText, shortName } = UB.utils;
  const I = UB.icons;
  const $ = id => document.getElementById(id);

  let current = null;
  let index = 0;

  // ─── Gallery ──────────────────────────────────────────────────────────────

  function renderGallery(p) {
    const images = p.images.length ? p.images : [null];
    const multi = images.length > 1;
    const track = $('pdTrack');

    // All slides load eagerly so swiping never waits on the network.
    track.innerHTML = images.map((url, i) =>
      `<div class="gallery__slide" data-img>` +
        `<img src="${esc(url ? cldOpt(url, 900) : PLACEHOLDER)}" alt="${esc(p.name)}${multi ? ` — ${i + 1}` : ''}" decoding="async" draggable="false">` +
      `</div>`).join('');
    track.scrollLeft = 0;
    index = 0;

    $('pdDots').hidden = !multi;
    $('pdDots').innerHTML = multi
      ? images.map((_, i) => `<button type="button" class="gallery__dot${i === 0 ? ' is-active' : ''}" data-index="${i}" aria-label="${i + 1}-rasm"></button>`).join('')
      : '';
    $('pdCounter').hidden = !multi;
    $('pdCounter').textContent = `1 / ${images.length}`;
    $('pdPrev').hidden = !multi;
    $('pdNext').hidden = !multi;
  }

  function syncIndex() {
    const track = $('pdTrack');
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (i === index) return;
    index = i;
    $('pdDots').querySelectorAll('.gallery__dot').forEach((dot, k) => dot.classList.toggle('is-active', k === i));
    $('pdCounter').textContent = `${i + 1} / ${track.children.length}`;
  }

  function goTo(i) {
    const track = $('pdTrack');
    const n = track.children.length;
    const target = ((i % n) + n) % n;
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
  }

  // ─── Info & actions ───────────────────────────────────────────────────────

  function statusBadge(p) {
    if (p.inStock) return '<span class="badge badge--ok">Mavjud</span>';
    if (p.comingSoon) return '<span class="badge badge--warn">Yaqinda sotuvda</span>';
    return '<span class="badge badge--danger">Mavjud emas</span>';
  }

  function renderInfo(p) {
    const price = UB.currency.display(p);
    $('pdInfo').innerHTML =
      `<p class="pd__brand">${esc(p.brand)}</p>` +
      `<h2 class="pd__name" id="pdName">${esc(p.name)}</h2>` +
      `<div class="pd__meta">` +
        statusBadge(p) +
        (p.featured ? '<span class="badge badge--gold">★ Top tanlov</span>' : '') +
        `<button type="button" class="badge badge--id" data-pd="copy-id" aria-label="ID ${esc(p.id)} — nusxalash">ID ${esc(p.id)} ${I.copy}</button>` +
      `</div>` +
      `<p class="pd__price${price ? '' : ' is-request'}" data-price-for="${esc(p.id)}">${esc(price || "Narxi so'rov bo'yicha")}</p>` +
      (p.description
        ? `<div class="pd__desc"><h3 class="pd__desc-title">Tavsif</h3><p>${esc(p.description)}</p></div>`
        : '') +
      `<ul class="pd__perks">` +
        `<li>${I.pin} Koreya skladlaridan, buyurtma asosida</li>` +
        `<li>${I.truck} Yetkazib berish narxi alohida hisoblanadi</li>` +
      `</ul>`;
  }

  function renderActions(p) {
    const qty = UB.cart.qty(p.id);
    let main;
    if (p.inStock && qty) {
      main =
        `<div class="stepper stepper--lg" role="group" aria-label="Miqdor">` +
          `<button type="button" data-pd="dec" aria-label="Kamaytirish">${I.minus}</button>` +
          `<span>${qty}</span>` +
          `<button type="button" data-pd="inc" aria-label="Ko'paytirish">${I.plus}</button>` +
        `</div>` +
        `<button type="button" class="btn btn--primary btn--grow" data-pd="go-cart">Savatga o'tish</button>`;
    } else if (p.inStock) {
      main = `<button type="button" class="btn btn--primary btn--grow" data-pd="add">${I.bag} Savatga qo'shish</button>`;
    } else if (p.comingSoon) {
      main = `<button type="button" class="btn btn--accent btn--grow" data-pd="preorder">${I.telegram} Oldindan buyurtma</button>`;
    } else {
      main = `<button type="button" class="btn btn--grow" disabled>Hozircha mavjud emas</button>`;
    }
    // Once the item is in the cart the next step is the cart, not a separate chat.
    const contact = p.comingSoon || (p.inStock && qty)
      ? ''
      : `<button type="button" class="btn btn--icon" data-pd="contact" aria-label="Sotuvchiga yozish" title="Sotuvchiga yozish">${I.telegram}</button>`;
    $('pdActions').innerHTML =
      main + contact +
      `<button type="button" class="btn btn--icon" data-pd="share" aria-label="Ulashish" title="Ulashish">${I.share}</button>`;
  }

  function contactSeller(p, kind) {
    const price = UB.currency.display(p);
    const ask = kind === 'preorder'
      ? 'Oldindan buyurtma bermoqchiman'
      : p.inStock ? 'Buyurtma bermoqchiman' : 'Qachon mavjud bo\'ladi?';
    const text = `Assalomu alaykum!\nID${p.id} | ${shortName(p.name)} (${p.brand})` +
      (price ? `\nNarx: ${price}` : '') + `\n\n${ask}`;
    UB.notify({ type: 'product', name: p.name, brand: p.brand, price: UB.currency.adminLabel(p) });
    UB.track('contact_seller', { item_id: p.id, kind });
    UB.tg.openChat(UB.config.seller, text);
  }

  function share(p) {
    const url = `${UB.config.siteUrl}#p=${encodeURIComponent(p.id)}`;
    const text = `${p.brand} — ${p.name}`;
    UB.track('share', { item_id: p.id });
    if (UB.tg.share(url, text)) return;
    copyText(url).then(ok => UB.toast(ok ? 'Havola nusxalandi' : url));
  }

  function onAction(e) {
    const el = e.target.closest('[data-pd]');
    if (!el || !current) return;
    const p = current;
    switch (el.dataset.pd) {
      case 'add': UB.actions.addToCart(p); break;
      case 'inc': UB.cart.add(p.id); UB.tg.haptic('light'); break;
      case 'dec': UB.cart.setQty(p.id, UB.cart.qty(p.id) - 1); UB.tg.haptic('light'); break;
      case 'go-cart': UB.sheet.close($('productSheet')); UB.cartView.open(); break;
      case 'contact': contactSeller(p, 'ask'); break;
      case 'preorder': contactSeller(p, 'preorder'); break;
      case 'share': share(p); break;
      case 'copy-id':
        copyText(p.id).then(ok => UB.toast(ok ? `ID ${p.id} nusxalandi` : `ID: ${p.id}`));
        break;
    }
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  function open(p) {
    current = p;
    renderGallery(p);
    renderInfo(p);
    renderActions(p);
    $('productSheet').querySelector('.sheet__scroll').scrollTop = 0;
    UB.sheet.open($('productSheet'), { onClose: () => { current = null; } });
    UB.track('view_item', { item_id: p.id, item_name: p.name, item_brand: p.brand });
  }

  function refresh() {
    if (current) renderActions(current);
  }

  function bind() {
    let ticking = false;
    $('pdTrack').addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; syncIndex(); });
    }, { passive: true });
    $('pdDots').addEventListener('click', e => {
      const dot = e.target.closest('[data-index]');
      if (dot) goTo(Number(dot.dataset.index));
    });
    $('pdPrev').addEventListener('click', () => goTo(index - 1));
    $('pdNext').addEventListener('click', () => goTo(index + 1));
    $('productSheet').addEventListener('click', onAction);
  }

  UB.productView = { open, refresh, bind };
})(window.UB = window.UB || {});
