/**
 * app.js — Main controller: wires together player, parser, and UI
 */

(() => {
  'use strict';

  // ── Bootstrap ─────────────────────────────────────────────
  function init() {
    UI.init(onChannelSelect);
    Player.init(onStatusChange);

    _bindUpload();
    _bindAddUrl();
    _bindModal();
    _bindKeyboard();

    // Restore last channel if available
    const last = UI.getLastChannel();
    if (last) {
      // Don't autoplay but show info
      document.getElementById('now-playing-title').textContent = last.name || '—';
    }
  }

  // ── Channel selection ─────────────────────────────────────
  function onChannelSelect(channel) {
    if (!channel?.url) {
      ErrorHandler.toast('Invalid channel URL', 'error');
      return;
    }
    UI.setActiveChannel(channel);
    Player.load(channel.url);
  }

  // ── Playback status ───────────────────────────────────────
  function onStatusChange(status) {
    UI.setPlaybackStatus(status);
  }

  // ── M3U file upload ───────────────────────────────────────
  function _bindUpload() {
    const input = document.getElementById('playlist-upload');
    input?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      input.value = ''; // reset so same file can be re-uploaded

      try {
        ErrorHandler.toast('Parsing playlist…', 'info', 2000);
        const channels = await Parser.readFile(file);
        if (channels.length === 0) {
          ErrorHandler.toast('No valid channels found in playlist', 'error');
          return;
        }
        UI.setChannels(channels);
        ErrorHandler.toast(`Loaded ${channels.length} channel${channels.length !== 1 ? 's' : ''}`, 'success');
      } catch (err) {
        ErrorHandler.parseError(err.message);
      }
    });
  }

  // ── Add URL modal ─────────────────────────────────────────
  function _bindAddUrl() {
    document.getElementById('btn-add-url')?.addEventListener('click', _openModal);
  }

  function _bindModal() {
    document.getElementById('modal-close')?.addEventListener('click', _closeModal);
    document.getElementById('modal-cancel')?.addEventListener('click', _closeModal);
    document.getElementById('modal-confirm')?.addEventListener('click', _confirmUrl);
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') _closeModal();
    });

    // Enter key in URL input
    document.getElementById('url-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _confirmUrl();
    });
  }

  function _openModal() {
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.hidden = false;
    setTimeout(() => document.getElementById('url-input')?.focus(), 50);
  }

  function _closeModal() {
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.hidden = true;
    document.getElementById('url-input').value = '';
    document.getElementById('url-name-input').value = '';
  }

  function _confirmUrl() {
    const url  = document.getElementById('url-input')?.value.trim();
    const name = document.getElementById('url-name-input')?.value.trim() || _urlToName(url);

    if (!url) {
      ErrorHandler.toast('Please enter a URL', 'warn');
      return;
    }

    if (!Parser.isValidUrl(url)) {
      ErrorHandler.streamError('INVALID_URL', 'Must start with http:// or https://');
      return;
    }

    // If it's a plain M3U playlist (not a stream), try to fetch & parse it
    if (_isM3UPlaylist(url)) {
      _fetchAndParsePlaylist(url);
    } else {
      // Treat as direct stream
      const channel = { id: Date.now(), name, url, group: '', logo: '' };
      _addAndPlay(channel);
    }

    _closeModal();
  }

  function _isM3UPlaylist(url) {
    const lower = url.toLowerCase();
    // Ends with .m3u (not .m3u8) or has 'playlist' or 'list' in path
    return lower.endsWith('.m3u') ||
      (lower.includes('playlist') && !lower.endsWith('.m3u8'));
  }

  async function _fetchAndParsePlaylist(url) {
    ErrorHandler.toast('Fetching playlist…', 'info', 2500);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const channels = Parser.parseM3U(text);
      if (channels.length === 0) {
        ErrorHandler.toast('No valid channels found', 'error');
        return;
      }
      UI.setChannels(channels);
      ErrorHandler.toast(`Loaded ${channels.length} channels`, 'success');
    } catch (err) {
      ErrorHandler.streamError('NETWORK', err.message);
    }
  }

  function _addAndPlay(channel) {
    // Get existing channels and prepend new one
    const existing = Array.from(document.querySelectorAll('.channel-item'))
      .map(el => ({ id: el.dataset.id }));

    // Just play the channel directly
    onChannelSelect(channel);
    ErrorHandler.toast(`Playing: ${channel.name}`, 'success', 2500);
  }

  // ── Keyboard shortcuts ────────────────────────────────────
  function _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Ignore when typing in inputs
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      switch (e.key) {
        case ' ':
        case 'k': {
          e.preventDefault();
          const v = document.getElementById('video-player');
          if (v) v.paused ? v.play() : v.pause();
          break;
        }
        case 'f':
        case 'F': {
          const wrap = document.getElementById('video-wrap');
          if (!document.fullscreenElement) wrap?.requestFullscreen?.();
          else document.exitFullscreen?.();
          break;
        }
        case 'Escape': {
          const backdrop = document.getElementById('modal-backdrop');
          if (backdrop && !backdrop.hidden) _closeModal();
          break;
        }
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  function _urlToName(url) {
    try {
      const path = new URL(url).pathname;
      const parts = path.split('/').filter(Boolean);
      const last = parts[parts.length - 1] || 'Stream';
      return last.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    } catch {
      return 'Stream';
    }
  }

  // ── Start ─────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
