/**
 * errorHandler.js — Centralized error handling & toast notifications.
 * Errors are shown as toasts and reflected in the status pill — no video overlays.
 */

const ErrorHandler = (() => {

  const TYPES = {
    NETWORK:     'Network error',
    INVALID_URL: 'Invalid stream URL',
    UNSUPPORTED: 'Unsupported stream format',
    PARSE:       'Playlist parse error',
    PLAYBACK:    'Playback error',
    EMPTY:       'Empty playlist',
  };

  function toast(message, type = 'info', duration = 3800) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
    container.appendChild(el);

    const remove = () => {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    };

    const timer = setTimeout(remove, duration);
    el.addEventListener('click', () => { clearTimeout(timer); remove(); });
  }

  function streamError(type, detail) {
    const msg = TYPES[type] || type;
    const full = detail ? `${msg}: ${detail}` : msg;
    console.warn('[StreamHub]', full);
    toast(full, 'error');
  }

  function parseError(detail) {
    const msg = TYPES.PARSE + (detail ? ': ' + detail : '');
    console.warn('[StreamHub]', msg);
    toast(msg, 'error');
  }

  return { toast, streamError, parseError, TYPES };
})();