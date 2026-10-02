(function (UB) {
  'use strict';

  const MAX_REPORTS_PER_PAGE = 5;
  const sent = new Set();
  let count = 0;

  function describe(err) {
    if (err instanceof Error) return { message: err.message || err.name || 'Error', stack: err.stack || '' };
    if (err && typeof err === 'object') {
      let message = err.message;
      if (!message) { try { message = JSON.stringify(err); } catch (_) { message = String(err); } }
      return { message: String(message).slice(0, 500), stack: err.stack || '' };
    }
    return { message: String(err), stack: '' };
  }

  function telegramUser() {
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
      return user ? { id: user.id, username: user.username || '' } : null;
    } catch (_) {
      return null;
    }
  }

  function report(err, context) {
    try {
      const { message, stack } = describe(err);
      const frame = stack.split('\n').find(l => /\d+:\d+/.test(l)) || (context && context.source) || '';
      const key = message + '|' + frame;
      if (sent.has(key) || count >= MAX_REPORTS_PER_PAGE) return;
      sent.add(key);
      count += 1;

      const tg = window.Telegram && window.Telegram.WebApp;
      const payload = {
        message,
        stack: stack.slice(0, 2000),
        context: context || {},
        url: location.href,
        ua: navigator.userAgent,
        version: UB.config ? UB.config.version : '',
        platform: tg && tg.platform && tg.platform !== 'unknown' ? tg.platform : 'web',
        user: telegramUser(),
      };
      fetch(UB.config.apiBase + '/error', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch (_) { /* reporting must never break the page */ }
  }

  window.addEventListener('error', e => {
    // Cross-origin scripts surface as an opaque "Script error." with no detail — nothing actionable.
    if (!e.error && (!e.message || e.message === 'Script error.')) return;
    report(e.error || e.message, { kind: 'error', source: e.filename, line: e.lineno, col: e.colno });
  });

  window.addEventListener('unhandledrejection', e => {
    report(e.reason, { kind: 'unhandledrejection' });
  });

  UB.reportError = report;
})(window.UB = window.UB || {});
