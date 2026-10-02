(function (UB) {
  'use strict';

  const tg = window.Telegram && window.Telegram.WebApp;
  // telegram-web-app.js also defines WebApp in a normal browser, with platform "unknown".
  const inTelegram = !!(tg && tg.platform && tg.platform !== 'unknown');
  const supports = version => inTelegram && typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast(version);
  const safely = fn => { try { fn(); } catch (_) {} };

  let backHandler = null;

  UB.tg = {
    inTelegram,
    user: inTelegram ? (tg.initDataUnsafe && tg.initDataUnsafe.user) || null : null,

    init() {
      if (!inTelegram) return;
      safely(() => { tg.ready(); tg.expand(); });
      if (supports('7.7')) safely(() => tg.disableVerticalSwipes());
      safely(() => tg.onEvent('themeChanged', () => UB.theme.apply()));
      safely(() => tg.BackButton.onClick(() => backHandler && backHandler()));
    },

    colorScheme: () => (inTelegram ? tg.colorScheme : null),

    setChromeColor(hex) {
      if (supports('6.9')) safely(() => { tg.setHeaderColor(hex); tg.setBackgroundColor(hex); });
      if (supports('7.10')) safely(() => tg.setBottomBarColor(hex));
    },

    onBack(fn) { backHandler = fn; },

    showBack(visible) {
      if (!supports('6.1')) return;
      safely(() => (visible ? tg.BackButton.show() : tg.BackButton.hide()));
    },

    haptic(kind = 'light') {
      if (!supports('6.1')) return;
      safely(() => {
        if (kind === 'success' || kind === 'error' || kind === 'warning') tg.HapticFeedback.notificationOccurred(kind);
        else tg.HapticFeedback.impactOccurred(kind);
      });
    },

    openChat(username, text) {
      const url = `https://t.me/${username}` + (text ? `?text=${encodeURIComponent(text)}` : '');
      if (inTelegram) {
        try { tg.openTelegramLink(url); return; } catch (_) {}
      }
      window.open(url, '_blank', 'noopener');
    },

    openLink(url) {
      if (inTelegram) {
        try { tg.openLink(url); return; } catch (_) {}
      }
      window.open(url, '_blank', 'noopener');
    },

    share(url, text) {
      if (inTelegram) {
        try {
          tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
          return true;
        } catch (_) {}
      }
      if (navigator.share) {
        navigator.share({ title: text, text, url }).catch(() => {});
        return true;
      }
      return false;
    },
  };

  const THEME_KEY = 'ub.theme';

  // A manual choice beats Telegram's and the system's scheme; the head script reads the same key.
  UB.theme = {
    saved() {
      const value = UB.utils.storage.get(THEME_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    },
    current() {
      const saved = this.saved();
      if (saved) return saved;
      const scheme = UB.tg.colorScheme();
      if (scheme === 'dark' || scheme === 'light') return scheme;
      return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    apply() {
      const root = document.documentElement;
      const theme = this.current();
      root.dataset.theme = theme;
      const btn = document.getElementById('themeBtn');
      if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim');
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (!bg) return;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
      UB.tg.setChromeColor(bg);
    },
    toggle() {
      const next = this.current() === 'dark' ? 'light' : 'dark';
      UB.utils.storage.set(THEME_KEY, next);
      this.apply();
      return next;
    },
  };

  if (!inTelegram && window.matchMedia) {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', () => UB.theme.apply());
  }
})(window.UB = window.UB || {});
