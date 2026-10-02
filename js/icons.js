(function (UB) {
  'use strict';

  const stroke = (paths, size = 20) =>
    `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  UB.icons = {
    plus: stroke('<path d="M12 5v14M5 12h14"/>', 18),
    minus: stroke('<path d="M5 12h14"/>', 18),
    bag: stroke('<path d="M6 7h12l-1 13H7z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/>'),
    share: stroke('<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
    trash: stroke('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    copy: stroke('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
    alert: stroke('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
    pin: stroke('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    truck: stroke('<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
    telegram:
      '<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' +
      '<path d="M21.9 4.6 18.8 19.3c-.2 1-.9 1.3-1.8.8l-4.8-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.4-.1-.6-.6-.2L6.5 13 1.8 11.5c-1-.3-1-1 .2-1.5L20.5 2.9c.9-.3 1.6.2 1.4 1.7z"/></svg>',
  };
})(window.UB = window.UB || {});
