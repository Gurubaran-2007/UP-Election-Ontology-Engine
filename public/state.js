// public/state.js
// Shared application state for selection propagation

window.AppState = {
  selection: null,
  listeners: [],

  setSelection(sel) {
    this.selection = sel;
    console.log('[STATE] Selection updated:', sel);
    this.listeners.forEach(fn => {
      try { fn(sel); } catch (e) { console.error('[STATE] Listener error:', e); }
    });
  },

  onChange(fn) {
    if (typeof fn === 'function') {
      this.listeners.push(fn);
    }
  },

  getSelection() {
    return this.selection;
  }
};

// Initialize: check if we have a stored selection
document.addEventListener('DOMContentLoaded', () => {
  // Restore from sessionStorage if available
  try {
    const stored = sessionStorage.getItem('up-election-selection');
    if (stored) {
      window.AppState.selection = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[STATE] Could not restore selection:', e);
  }
});
