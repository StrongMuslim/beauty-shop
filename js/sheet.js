(function (UB) {
  'use strict';

  const CLOSE_MS = 320;
  const DRAG_CLOSE_PX = 110;
  const stack = [];

  function open(el, { onClose } = {}) {
    if (stack.some(s => s.el === el)) return;
    el.hidden = false;
    // Two frames so the browser paints the closed state before transitioning to open.
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-open')));
    stack.push({ el, onClose, prevFocus: document.activeElement });
    document.documentElement.classList.add('is-locked');
    UB.tg.showBack(true);
  }

  function close(el) {
    const i = el ? stack.findIndex(s => s.el === el) : stack.length - 1;
    if (i < 0) return;
    const [entry] = stack.splice(i, 1);
    entry.el.classList.remove('is-open');
    setTimeout(() => {
      if (!entry.el.classList.contains('is-open')) entry.el.hidden = true;
    }, CLOSE_MS);
    if (!stack.length) {
      document.documentElement.classList.remove('is-locked');
      UB.tg.showBack(false);
    }
    if (entry.onClose) entry.onClose();
    if (entry.prevFocus && entry.prevFocus.focus) entry.prevFocus.focus({ preventScroll: true });
  }

  // Pull-down-to-close, only when the sheet content is scrolled to the top.
  function enableDrag(sheetEl) {
    const panel = sheetEl.querySelector('.sheet__panel');
    const scroller = sheetEl.querySelector('.sheet__scroll');
    let startX = 0;
    let startY = 0;
    let dy = 0;
    let decided = false;
    let dragging = false;

    panel.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dy = 0;
      decided = false;
      dragging = false;
    }, { passive: true });

    panel.addEventListener('touchmove', e => {
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const moveY = t.clientY - startY;
      if (!decided) {
        if (Math.abs(moveY) < 8 && Math.abs(dx) < 8) return;
        decided = true;
        const atTop = !scroller || scroller.scrollTop <= 0 || !scroller.contains(e.target);
        dragging = moveY > 0 && Math.abs(moveY) > Math.abs(dx) && atTop;
        if (dragging) panel.style.transition = 'none';
      }
      if (!dragging) return;
      dy = Math.max(0, moveY);
      panel.style.transform = `translateY(${dy}px)`;
    }, { passive: true });

    const end = () => {
      if (!dragging) return;
      dragging = false;
      // Clearing inline styles in the same frame lets the CSS transition run from the dragged position.
      panel.style.transition = '';
      panel.style.transform = '';
      if (dy > DRAG_CLOSE_PX) close(sheetEl);
    };
    panel.addEventListener('touchend', end);
    panel.addEventListener('touchcancel', end);
  }

  function bindAll() {
    document.querySelectorAll('.sheet').forEach(enableDrag);
    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-close]');
      if (!trigger) return;
      const sheet = trigger.closest('.sheet');
      if (sheet) close(sheet);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && stack.length) close();
    });
  }

  UB.sheet = {
    open,
    close,
    closeTop: () => close(),
    isOpen: el => stack.some(s => s.el === el),
    bindAll,
  };
})(window.UB = window.UB || {});
