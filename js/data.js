(function (UB) {
  'use strict';

  const { fetchWithTimeout, normalizeText } = UB.utils;

  const DEFAULT_COLUMNS = {
    id: 0, name: 1, brand: 2, category: 3, price: 4, price_uzs: 5,
    instock: 6, image: 7, description: 8, kurs: 9, hidden: 10, featured: 11,
  };

  const str = v => (v === null || v === undefined ? '' : String(v).trim());
  const num = v => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const n = parseFloat(str(v).replace(/[\s,]/g, ''));
    return isFinite(n) ? n : 0;
  };
  const isTrue = v => v === true || str(v).toUpperCase() === 'TRUE';
  // gviz types column G as boolean or string depending on which values dominate it.
  const isFalse = v => v === false || str(v).toUpperCase() === 'FALSE';
  const brandKey = brand => normalizeText(brand).replace(/[^a-z0-9а-яё]/g, '');

  function parseGviz(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('gviz: kutilmagan javob');
    const json = JSON.parse(text.slice(start, end + 1));
    if (json.status === 'error') {
      const e = (json.errors && json.errors[0]) || {};
      throw new Error('gviz: ' + (e.detailed_message || e.message || 'xato'));
    }
    return json.table;
  }

  function columnIndex(cols) {
    const index = { ...DEFAULT_COLUMNS };
    (cols || []).forEach((col, i) => {
      const key = str(col.label).toLowerCase();
      if (key in index) index[key] = i;
    });
    return index;
  }

  function splitImages(raw) {
    return str(raw)
      .split(/\s*\|\s*|\s*,\s*(?=https?:\/\/)/)
      .map(s => s.trim())
      .filter(u => /^https?:\/\//i.test(u));
  }

  function parseProducts(table) {
    const ix = columnIndex(table.cols);
    const cell = (row, key) => {
      const c = row.c && row.c[ix[key]];
      return c && c.v !== undefined ? c.v : null;
    };

    let sheetRate = 0;
    const products = [];

    table.rows.forEach((row, i) => {
      if (i === 0) sheetRate = num(cell(row, 'kurs'));

      const rawId = cell(row, 'id');
      if (rawId === null || rawId === '') return;
      const name = str(cell(row, 'name'));
      if (!name || isTrue(cell(row, 'hidden'))) return;

      const id = typeof rawId === 'number' ? String(Math.trunc(rawId)) : str(rawId);
      const descRaw = str(cell(row, 'description'));
      const comingSoon = descRaw.startsWith('[SOON]');
      const outTagged = !comingSoon && descRaw.startsWith('[OUT]');
      const brand = str(cell(row, 'brand'));

      products.push({
        id,
        idNum: parseInt(id, 10) || 0,
        name,
        brand,
        brandKey: brandKey(brand),
        category: str(cell(row, 'category')).toLowerCase(),
        priceKrw: num(cell(row, 'price')),
        priceUzs: num(cell(row, 'price_uzs')),
        inStock: !comingSoon && !outTagged && !isFalse(cell(row, 'instock')),
        comingSoon,
        featured: isTrue(cell(row, 'featured')),
        images: splitImages(cell(row, 'image')),
        description: descRaw.replace(/^\[(SOON|OUT)\]\s*/, ''),
      });
    });

    return { products, sheetRate };
  }

  function parseCategories(table) {
    // A missing tab makes gviz silently return the first sheet; the real one has exactly 2 columns.
    if (!table || (table.cols || []).length > 3) return [];
    return table.rows
      .map(r => [str(r.c && r.c[0] && r.c[0].v), str(r.c && r.c[1] && r.c[1].v)])
      .filter(([id, label]) => id && label && id.toLowerCase() !== 'id')
      .map(([id, label]) => ({ id: id.toLowerCase(), label }));
  }

  async function fetchTable(sheet) {
    const res = await fetchWithTimeout(UB.config.gviz(sheet), 15000, { cache: 'no-store' });
    if (!res.ok) throw new Error(`gviz ${sheet}: HTTP ${res.status}`);
    return parseGviz(await res.text());
  }

  async function load() {
    const { sheets } = UB.config;
    const [productsTable, categoriesTable] = await Promise.all([
      fetchTable(sheets.products),
      fetchTable(sheets.categories).catch(err => {
        UB.reportError(err, { where: 'categories' });
        return null;
      }),
    ]);
    const { products, sheetRate } = parseProducts(productsTable);
    if (!products.length) throw new Error('Katalog bo\'sh qaytdi (0 ta mahsulot)');
    return { products, categories: parseCategories(categoriesTable), sheetRate };
  }

  UB.data = { load, parseProducts, parseCategories, parseGviz };
})(window.UB = window.UB || {});
