(function (UB) {
  'use strict';

  const { storage } = UB.utils;
  const KEY = 'ub.cart.v1';
  const MAX_QTY = 99;
  const listeners = new Set();

  const clamp = q => Math.max(0, Math.min(MAX_QTY, q));

  function sanitize(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter(l => l && typeof l.id === 'string' && Number.isInteger(l.qty) && l.qty > 0)
      .map(l => ({ id: l.id, qty: clamp(l.qty) }));
  }

  // Only ids and quantities are stored — prices always come from the live catalog.
  let lines = sanitize(storage.get(KEY, []));

  function commit() {
    storage.set(KEY, lines);
    listeners.forEach(fn => {
      try { fn(); } catch (err) { UB.reportError(err, { where: 'cart-listener' }); }
    });
  }

  UB.cart = {
    qty: id => (lines.find(l => l.id === id) || {}).qty || 0,

    add(id, n = 1) {
      const line = lines.find(l => l.id === id);
      if (line) line.qty = clamp(line.qty + n);
      else lines.push({ id, qty: clamp(n) });
      commit();
    },

    setQty(id, qty) {
      const next = clamp(qty);
      if (!next) lines = lines.filter(l => l.id !== id);
      else {
        const line = lines.find(l => l.id === id);
        if (line) line.qty = next;
        else lines.push({ id, qty: next });
      }
      commit();
    },

    remove(id) {
      lines = lines.filter(l => l.id !== id);
      commit();
    },

    clear() {
      lines = [];
      commit();
    },

    prune(validIds) {
      const before = lines.length;
      lines = lines.filter(l => validIds.has(l.id));
      if (lines.length !== before) commit();
    },

    lines: () => lines.map(l => ({ ...l })),
    count: () => lines.reduce((s, l) => s + l.qty, 0),
    onChange: fn => listeners.add(fn),
  };
})(window.UB = window.UB || {});
