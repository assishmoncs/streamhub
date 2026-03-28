/**
 * player.js — Video playback management via HLS.js
 * No video overlays — all status communicated via callback to UI + toast notifications.
 */

const Player = (() => {

  const VIDEO_ID    = 'video-player';
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2500;

  let hlsInstance    = null;
  let currentUrl     = null;
  let retryCount     = 0;
  let retryTimer     = null;
  let onStatusChange = null;

  const video   = () => document.getElementById(VIDEO_ID);
  const welcome = () => document.getElementById('welcome-overlay');

  // ── Public API ────────────────────────────────────────────

  function init(statusChangeCb) {
    onStatusChange = statusChangeCb || null;
    _bindVideoEvents();
    // Retry button in the info bar
    document.getElementById('btn-retry')?.addEventListener('click', () => retry());
  }

  function load(url) {
    if (!url) return;
    currentUrl = url;
    retryCount = 0;
    _clearRetry();
    _hideWelcome();
    _setStatus('buffering');
    _destroyHls();

    if (Hls.isSupported()) {
      _loadWithHls(url);
    } else if (video().canPlayType('application/vnd.apple.mpegurl')) {
      _loadNative(url);
    } else {
      ErrorHandler.streamError('UNSUPPORTED', 'HLS not supported in this browser');
      _setStatus('error');
    }
  }

  function retry() {
    if (!currentUrl) return;
    if (retryCount >= MAX_RETRIES) {
      ErrorHandler.toast('Max retries reached. Check the stream URL.', 'error');
      return;
    }
    retryCount++;
    ErrorHandler.toast(`Retrying… (${retryCount}/${MAX_RETRIES})`, 'warn');
    load(currentUrl);
  }

  function destroy() {
    _destroyHls();
    currentUrl = null;
    retryCount = 0;
    _clearRetry();
    _setStatus('idle');
  }

  // ── Private ───────────────────────────────────────────────

  function _loadWithHls(url) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      fragLoadingTimeOut: 20000,
      manifestLoadingTimeOut: 15000,
    });

    hls.loadSource(url);
    hls.attachMedia(video());
    hlsInstance = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video().play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        _onFatalError('NETWORK', 'Connection lost');
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        _onFatalError('PLAYBACK', 'Media decode error');
      } else {
        _onFatalError('PLAYBACK', data.details || 'Unknown HLS error');
      }
    });
  }

  function _loadNative(url) {
    const v = video();
    v.src = url;
    v.load();
    v.play().catch(() => _onFatalError('PLAYBACK', 'Autoplay blocked'));
  }

  function _bindVideoEvents() {
    const v = video();
    if (!v) return;

    v.addEventListener('waiting',  () => _setStatus('buffering'));
    v.addEventListener('stalled',  () => _setStatus('buffering'));
    v.addEventListener('playing',  () => { _setStatus('playing'); _clearRetry(); retryCount = 0; });
    v.addEventListener('pause',    () => _setStatus('idle'));
    v.addEventListener('canplay',  () => { /* status set by 'playing' */ });
    v.addEventListener('error',    () => { if (currentUrl) _onFatalError('PLAYBACK', 'Video element error'); });
  }

  function _onFatalError(type, message) {
    _setStatus('error');
    ErrorHandler.toast(`${message}. Retrying in ${RETRY_DELAY / 1000}s…`, 'error');

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      _clearRetry();
      retryTimer = setTimeout(() => { if (currentUrl) load(currentUrl); }, RETRY_DELAY);
    } else {
      ErrorHandler.toast('Stream unavailable. Press ↺ to try again.', 'error', 6000);
    }
  }

  function _destroyHls() {
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
    const v = video();
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
  }

  function _clearRetry() {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  }

  function _hideWelcome() {
    const el = welcome();
    if (el) el.style.display = 'none';
  }

  function _setStatus(status) {
    if (onStatusChange) onStatusChange(status);
  }

  return { init, load, retry, destroy };
})();