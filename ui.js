/**
 * ui.js — UI rendering & interactions
 */

const UI = (() => {

  // ── State ─────────────────────────────────────────────────
  let channels        = [];
  let filtered        = [];
  let activeId        = null;
  let currentCategory = 'all';
  let searchQuery     = '';
  let favorites       = new Set();
  let onSelect        = null; // callback(channel)

  const FAVORITES_KEY    = 'streamhub_favorites';
  const LAST_CHANNEL_KEY = 'streamhub_last';

  // ── Init ──────────────────────────────────────────────────
  function init(selectCallback) {
    onSelect = selectCallback;
    _loadFavorites();
    _bindSearch();
    _bindCategories();
    _bindFavButton();
    _bindFullscreenButton();
    _renderEmpty();
  }

  // ── Channel list ──────────────────────────────────────────

  function setChannels(list) {
    channels = list;
    activeId = null;
    _updateCategories();
    _applyFilter();
    _updateCount();
  }

  function setActiveChannel(channel) {
    activeId = channel?.id ?? null;

    // Update channel items
    document.querySelectorAll('.channel-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id == activeId);
    });

    // Update player info bar
    document.getElementById('now-playing-title').textContent = channel?.name || '—';
    document.getElementById('now-playing-group').textContent = channel?.group || '';

    // Update favorite button
    _updateFavButton(channel);

    // Persist last channel
    if (channel) {
      try { localStorage.setItem(LAST_CHANNEL_KEY, JSON.stringify(channel)); } catch {}
    }
  }

  function getLastChannel() {
    try {
      const raw = localStorage.getItem(LAST_CHANNEL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // ── Status pill (in info bar) ─────────────────────────────
  function setPlaybackStatus(status) {
    const pill  = document.getElementById('player-status-pill');
    const dot   = document.getElementById('status-dot-inline');
    const label = document.getElementById('status-text-inline');
    if (!pill) return;

    const map = {
      playing:   { text: 'LIVE',       show: true },
      buffering: { text: 'BUFFERING',  show: true },
      error:     { text: 'ERROR',      show: true },
      idle:      { text: '',           show: false },
    };

    const s = map[status] || map.idle;
    pill.dataset.status = s.show ? status : 'idle';
    if (label) label.textContent = s.text;
  }

  // ── Favorites ─────────────────────────────────────────────
  function _loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      favorites = new Set(raw ? JSON.parse(raw) : []);
    } catch { favorites = new Set(); }
  }

  function _saveFavorites() {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); } catch {}
  }

  function isFavorite(channelId) {
    return favorites.has(String(channelId));
  }

  function toggleFavorite(channelId) {
    const id = String(channelId);
    if (favorites.has(id)) {
      favorites.delete(id);
      ErrorHandler.toast('Removed from favorites', 'info', 2000);
    } else {
      favorites.add(id);
      ErrorHandler.toast('Added to favorites', 'success', 2000);
    }
    _saveFavorites();
    _updateFavButton(channels.find(c => c.id == channelId));

    // Re-render to update dots
    _renderList(filtered);
    _updateFavButton(channels.find(c => c.id == activeId));
  }

  function _updateFavButton(channel) {
    const btn = document.getElementById('btn-fav');
    if (!btn || !channel) { btn?.classList.remove('active'); return; }
    btn.classList.toggle('active', isFavorite(channel.id));
  }

  function _bindFavButton() {
    document.getElementById('btn-fav')?.addEventListener('click', () => {
      const ch = channels.find(c => c.id == activeId);
      if (ch) toggleFavorite(ch.id);
    });
  }

  // ── Fullscreen ────────────────────────────────────────────
  function _bindFullscreenButton() {
    document.getElementById('btn-fullscreen')?.addEventListener('click', _toggleFullscreen);
  }

  function _toggleFullscreen() {
    const wrap = document.getElementById('video-wrap');
    if (!wrap) return;
    if (!document.fullscreenElement) {
      wrap.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  // ── Search ────────────────────────────────────────────────
  function _bindSearch() {
    const input = document.getElementById('channel-search');
    const clear = document.getElementById('clear-search');
    if (!input) return;

    input.addEventListener('input', () => {
      searchQuery = input.value.trim().toLowerCase();
      clear.hidden = !searchQuery;
      _applyFilter();
    });

    clear?.addEventListener('click', () => {
      input.value = '';
      searchQuery = '';
      clear.hidden = true;
      _applyFilter();
      input.focus();
    });
  }

  // ── Categories ────────────────────────────────────────────
  function _updateCategories() {
    const groups = [...new Set(channels.map(c => c.group).filter(Boolean))];
    const tabs = document.getElementById('category-tabs');
    if (!tabs) return;

    // Remove dynamic tabs
    tabs.querySelectorAll('.cat-tab.dynamic').forEach(el => el.remove());

    groups.forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'cat-tab dynamic';
      btn.dataset.cat = g;
      btn.textContent = g;
      tabs.appendChild(btn);
    });
  }

  function _bindCategories() {
    document.getElementById('category-tabs')?.addEventListener('click', e => {
      const btn = e.target.closest('.cat-tab');
      if (!btn) return;
      document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      _applyFilter();
    });
  }

  // ── Filtering ─────────────────────────────────────────────
  function _applyFilter() {
    let result = channels;

    if (currentCategory === 'favorites') {
      result = result.filter(c => isFavorite(c.id));
    } else if (currentCategory !== 'all') {
      result = result.filter(c => c.group === currentCategory);
    }

    if (searchQuery) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(searchQuery) ||
        c.group.toLowerCase().includes(searchQuery)
      );
    }

    filtered = result;
    _renderList(filtered);
  }

  // ── Rendering ─────────────────────────────────────────────
  function _renderList(list) {
    const ul    = document.getElementById('channel-list');
    const empty = document.getElementById('empty-state');
    if (!ul) return;

    if (list.length === 0) {
      ul.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');
    ul.innerHTML = '';

    // Use fragment for perf
    const frag = document.createDocumentFragment();
    list.forEach(ch => {
      const li = _buildChannelItem(ch);
      frag.appendChild(li);
    });
    ul.appendChild(frag);
  }

  function _buildChannelItem(ch) {
    const li = document.createElement('li');
    li.className = 'channel-item' +
      (ch.id == activeId ? ' active' : '') +
      (isFavorite(ch.id) ? ' fav' : '');
    li.dataset.id = ch.id;

    const initials = ch.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

    li.innerHTML = `
      <div class="channel-thumb">
        ${ch.logo
          ? `<img src="${_esc(ch.logo)}" alt="" loading="lazy" onerror="this.parentElement.textContent='${_esc(initials)}'">`
          : `<span>${_esc(initials)}</span>`}
      </div>
      <div class="channel-meta">
        <div class="channel-name">${_esc(ch.name)}</div>
        ${ch.group ? `<div class="channel-group">${_esc(ch.group)}</div>` : ''}
      </div>
      <span class="channel-fav-dot"></span>
    `;

    li.addEventListener('click', () => {
      if (onSelect) onSelect(ch);
    });

    return li;
  }

  function _renderEmpty() {
    const empty = document.getElementById('empty-state');
    empty?.classList.remove('hidden');
  }

  function _updateCount() {
    const el = document.getElementById('channel-count');
    if (el) el.textContent = `${channels.length} channel${channels.length !== 1 ? 's' : ''}`;
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return {
    init,
    setChannels,
    setActiveChannel,
    setPlaybackStatus,
    getLastChannel,
    isFavorite,
    toggleFavorite,
  };
})();