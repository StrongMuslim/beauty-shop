(function (UB) {
  'use strict';

  const { storage, fetchWithTimeout, groupDigits } = UB.utils;
  const cfg = UB.config.rate;
  const KEY_CURRENCY = 'ub.currency';
  const KEY_RATE = 'ub.rate.v1';

  const listeners = new Set();
  let currency = 'UZS';
  let rate = null;      // { value: UZS per 1 KRW, source, date, fetchedAt }
  let inflight = null;

  // Timezone beats IP here: many users in Uzbekistan browse through a VPN, but the phone
  // keeps the real local timezone.
  function regionFromSignals({ timeZone = '', languages = [] } = {}) {
    if (timeZone === 'Asia/Seoul') return 'KRW';
    if (timeZone === 'Asia/Tashkent' || timeZone === 'Asia/Samarkand') return 'UZS';
    if (languages.some(l => /^ko(-|_|$)/i.test(l || ''))) return 'KRW';
    return 'UZS';
  }

  function detect() {
    const saved = storage.get(KEY_CURRENCY);
    if (saved === 'KRW' || saved === 'UZS') return saved;
    let timeZone = '';
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {}
    const languages = [...(navigator.languages || []), navigator.language, UB.tg.user && UB.tg.user.language_code];
    return regionFromSignals({ timeZone, languages: languages.filter(Boolean) });
  }

  function emit() {
    listeners.forEach(fn => {
      try { fn(); } catch (err) { UB.reportError(err, { where: 'currency-listener' }); }
    });
  }

  const validRate = v => typeof v === 'number' && isFinite(v) && v > 1 && v < 100;

  const SOURCES = [
    {
      name: 'cbu',
      url: cfg.sources.cbu,
      parse(json) {
        const row = Array.isArray(json) && json.find(r => r && r.Ccy === 'KRW');
        if (!row) return null;
        return { value: parseFloat(row.Rate) / (parseFloat(row.Nominal) || 1), date: row.Date || '' };
      },
    },
    {
      name: 'er-api',
      url: cfg.sources.backup,
      parse(json) {
        if (!json || json.result !== 'success' || !json.rates) return null;
        return { value: Number(json.rates.UZS), date: json.time_last_update_utc || '' };
      },
    },
  ];

  async function fetchFresh() {
    for (const src of SOURCES) {
      try {
        const res = await fetchWithTimeout(src.url, 5000, { cache: 'no-store' });
        if (!res.ok) continue;
        const parsed = src.parse(await res.json());
        if (parsed && validRate(parsed.value)) {
          return { value: +parsed.value.toFixed(4), date: parsed.date, source: src.name, fetchedAt: Date.now() };
        }
      } catch (_) { /* try the next source */ }
    }
    return null;
  }

  function setRate(next) {
    if (!next || !validRate(next.value)) return;
    const changed = !rate || rate.value !== next.value;
    rate = next;
    if (changed) emit();
  }

  function refreshRate() {
    const cached = storage.get(KEY_RATE);
    if (cached && validRate(cached.value) && Date.now() - cached.fetchedAt < cfg.ttlMs) {
      setRate(cached);
      return Promise.resolve(rate);
    }
    if (inflight) return inflight;
    inflight = fetchFresh()
      .then(fresh => {
        if (fresh) {
          storage.set(KEY_RATE, fresh);
          setRate(fresh);
        } else if (!rate) {
          UB.reportError(new Error('Kurs olinmadi: CBU va zaxira API javob bermadi'), { where: 'rate' });
        }
        return rate;
      })
      .finally(() => { inflight = null; });
    return inflight;
  }

  function useSheetFallback(value) {
    if (rate || !validRate(value)) return;
    rate = { value, source: 'sheet', date: '', fetchedAt: 0 };
    emit();
  }

  // Column E = KRW price, column F = manual UZS price. A missing side is derived from the rate.
  function priceFor(p, cur = currency) {
    const krw = p.priceKrw > 0 ? p.priceKrw : 0;
    const uzs = p.priceUzs > 0 ? p.priceUzs : 0;
    if (cur === 'KRW') {
      if (krw) return { amount: krw, currency: 'KRW' };
      if (uzs && rate) return { amount: Math.ceil(uzs / rate.value / cfg.roundKrwTo) * cfg.roundKrwTo, currency: 'KRW' };
      return null;
    }
    if (uzs) return { amount: uzs, currency: 'UZS' };
    if (krw && rate) return { amount: Math.ceil((krw * rate.value) / cfg.roundUzsTo) * cfg.roundUzsTo, currency: 'UZS' };
    return krw ? { amount: krw, currency: 'KRW' } : null;
  }

  const format = (amount, cur) => `${groupDigits(amount)} ${cur === 'KRW' ? '₩' : "so'm"}`;

  function display(p, cur) {
    const price = priceFor(p, cur);
    return price ? format(price.amount, price.currency) : '';
  }

  function sum(lines, cur = currency) {
    const totals = {};
    lines.forEach(({ p, qty }) => {
      const price = priceFor(p, cur);
      if (price) totals[price.currency] = (totals[price.currency] || 0) + price.amount * qty;
    });
    return Object.keys(totals).map(c => format(totals[c], c)).join(' + ');
  }

  const unique = list => list.filter((v, i) => v && list.indexOf(v) === i);
  const adminLabel = p => unique([display(p, 'KRW'), display(p, 'UZS')]).join(' / ');
  const adminSum = lines => unique([sum(lines, 'KRW'), sum(lines, 'UZS')]).join(' / ');

  UB.currency = {
    init() {
      currency = detect();
      const cached = storage.get(KEY_RATE);
      if (cached && validRate(cached.value)) rate = cached;
    },
    get: () => currency,
    set(next) {
      if ((next !== 'KRW' && next !== 'UZS') || next === currency) return;
      currency = next;
      storage.set(KEY_CURRENCY, next);
      emit();
    },
    rate: () => rate,
    refreshRate,
    useSheetFallback,
    priceFor,
    format,
    display,
    sum,
    adminLabel,
    adminSum,
    onChange: fn => listeners.add(fn),
    regionFromSignals,
  };
})(window.UB = window.UB || {});
