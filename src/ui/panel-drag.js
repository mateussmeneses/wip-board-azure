// Draggable Snapshot / Daily / Sprint panel. No writes to the Azure board.
// Uses Pointer Events, keyboard arrows and clamped viewport coordinates.
// Stores only non-sensitive panel geometry in chrome.storage.local.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WIPBoardPanelDrag = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const POSITION_KEY = 'wipx:snapshot-panel-position:v1';
  const MARGIN = 8;

  function clampPosition(x, y, width, height, viewportWidth, viewportHeight, margin) {
    const m = Number.isFinite(margin) ? margin : MARGIN;
    const vw = Math.max(0, Number(viewportWidth) || 0);
    const vh = Math.max(0, Number(viewportHeight) || 0);
    const w = Math.max(0, Number(width) || 0);
    const h = Math.max(0, Number(height) || 0);
    const maxX = Math.max(m, vw - w - m);
    const maxY = Math.max(m, vh - h - m);
    const bound = (v, max) => Math.min(max, Math.max(m, Number.isFinite(v) ? v : m));
    return { x: bound(Number(x), maxX), y: bound(Number(y), maxY) };
  }

  function attach(panel, handle, options) {
    if (!panel || !handle || panel.dataset.dragInitialized === 'true') return null;
    const opts = options || {};
    const view = opts.view || window;
    const storage = opts.storage || (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
    panel.dataset.dragInitialized = 'true';
    let moved = false;
    let active = null;

    function moveTo(x, y) {
      const rect = panel.getBoundingClientRect();
      const next = clampPosition(x, y, rect.width, rect.height, view.innerWidth, view.innerHeight);
      panel.style.left = next.x + 'px';
      panel.style.top = next.y + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      moved = true;
      return next;
    }
    function reclamp() {
      if (!moved) return;
      const rect = panel.getBoundingClientRect();
      moveTo(rect.left, rect.top);
    }
    function save() {
      if (!storage || typeof storage.set !== 'function' || !moved) return;
      const rect = panel.getBoundingClientRect();
      try { storage.set({ [POSITION_KEY]: { x: rect.left, y: rect.top } }); }
      catch (_) { /* A failed preference write must not break panel controls. */ }
    }

    handle.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || event.target.closest('button,input,textarea,select,a')) return;
      const rect = panel.getBoundingClientRect();
      active = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        left: rect.left, top: rect.top, dragStarted: false
      };
      if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', function (event) {
      if (!active || active.id !== event.pointerId) return;
      const dx = event.clientX - active.x;
      const dy = event.clientY - active.y;
      if (!active.dragStarted && Math.hypot(dx, dy) < 5) return;
      active.dragStarted = true;
      event.preventDefault();
      moveTo(active.left + dx, active.top + dy);
    });
    function finish(event, cancelled) {
      if (!active || active.id !== event.pointerId) return;
      const wasDragging = active.dragStarted;
      active = null;
      if (handle.hasPointerCapture && handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      if (wasDragging && !cancelled) save();
    }
    handle.addEventListener('pointerup', e => finish(e, false));
    handle.addEventListener('pointercancel', e => finish(e, true));
    handle.addEventListener('keydown', function (event) {
      const steps = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] };
      if (!steps[event.key]) return;
      event.preventDefault();
      const rect = panel.getBoundingClientRect();
      const step = event.shiftKey ? 48 : 16;
      moveTo(rect.left + steps[event.key][0] * step,
        rect.top + steps[event.key][1] * step);
      save();
    });
    view.addEventListener('resize', reclamp);

    if (storage && typeof storage.get === 'function') {
      try {
        storage.get(POSITION_KEY, function (result) {
          const value = result && result[POSITION_KEY];
          if (value && Number.isFinite(value.x) && Number.isFinite(value.y) && !moved) {
            moveTo(value.x, value.y);
          }
        });
      } catch (_) { /* Position restoration is optional. */ }
    }
    return { reclamp, moveTo };
  }
  return { clampPosition, attach, POSITION_KEY };
});
