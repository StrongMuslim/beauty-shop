(function (UB) {
  'use strict';

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ESCAPES[c]);

  const NBSP = ' ';
  const groupDigits = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

  // Uzbek is written with several apostrophe variants (oʻ, o', o`, o’) — fold them for search.
  const normalizeText = value => String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[ʻʼ`’‘']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  const shortName = (name, max = 32) => (name.length > max ? name.slice(0, max).trimEnd() + '…' : name);

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  const storage = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    },
  };

  async function fetchWithTimeout(url, ms, options = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  const isCloudinary = url => /^https:\/\/res\.cloudinary\.com\/.+\/upload\//.test(url || '');

  function cldOpt(url, width) {
    if (!isCloudinary(url) || url.includes('f_auto')) return url;
    return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
  }

  const srcset = (url, widths) => (isCloudinary(url) ? widths.map(w => `${cldOpt(url, w)} ${w}w`).join(', ') : '');

  const PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
    '<rect width="120" height="120" fill="#f4efed"/>' +
    '<rect x="50" y="30" width="20" height="10" rx="2" fill="#dcd2ce"/>' +
    '<rect x="42" y="40" width="36" height="52" rx="10" fill="#e6ddd9"/>' +
    '</svg>'
  );

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) { /* fall through to the legacy path */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  // load/error don't bubble, so one capturing listener handles every <img> on the page.
  function installImageHandlers() {
    document.addEventListener('load', e => {
      const img = e.target;
      if (img.tagName === 'IMG') img.closest('[data-img]')?.classList.add('is-loaded');
    }, true);

    document.addEventListener('error', e => {
      const img = e.target;
      if (img.tagName !== 'IMG' || img.dataset.fallback) return;
      img.dataset.fallback = '1';
      img.removeAttribute('srcset');
      img.src = PLACEHOLDER;
    }, true);
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  UB.utils = {
    esc,
    groupDigits,
    normalizeText,
    shortName,
    debounce,
    storage,
    fetchWithTimeout,
    cldOpt,
    srcset,
    PLACEHOLDER,
    copyText,
    installImageHandlers,
    sleep,
  };
})(window.UB = window.UB || {});
