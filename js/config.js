(function (UB) {
  'use strict';

  const SHEET_ID = '1J7cUeHCVm3CiwxwzGTOalSYey3f6vkEttk8ztmxXtTY';

  UB.config = {
    version: '31',
    seller: 'unitybeautykr',
    instagram: 'https://instagram.com/unity.beauty.kr',
    author: 'eyf1n',
    siteUrl: 'https://strongmuslim.github.io/beauty-shop/',
    apiBase: 'https://worker-production-ccde.up.railway.app',

    sheets: { products: 'products', categories: 'categories' },
    gviz: name => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(name)}`,

    rate: {
      ttlMs: 3 * 60 * 60 * 1000,
      sources: {
        cbu: 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/KRW/',
        backup: 'https://open.er-api.com/v6/latest/KRW',
      },
      roundUzsTo: 1000,
      roundKrwTo: 100,
    },

    newArrivals: 8,
    categoryIcons: { yuz: '🧴', sogliq: '💊', makiyaj: '💄', boshqa: '✨' },
  };
})(window.UB = window.UB || {});
