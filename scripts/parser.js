/**
 * parser.js — M3U / M3U8 playlist parsing logic
 */

const Parser = (() => {

  /**
   * Parse raw M3U text into an array of channel objects.
   * @param {string} text
   * @returns {Array<{id,name,url,group,logo}>}
   */
  function parseM3U(text) {
    if (!text || typeof text !== 'string') {
      ErrorHandler.parseError('Empty or invalid input');
      return [];
    }

    const lines = text.split(/\r?\n/);
    const channels = [];
    let pending = null;
    let idCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF')) {
        pending = _parseExtinf(line, ++idCounter);
      } else if (line.startsWith('#')) {
        // ignore other directives
      } else if (isValidUrl(line)) {
        const ch = pending || { id: ++idCounter, name: _urlToName(line), group: '', logo: '' };
        ch.url = line;
        channels.push(ch);
        pending = null;
      } else {
        // invalid line — skip
        pending = null;
      }
    }

    if (channels.length === 0) {
      ErrorHandler.parseError('No valid channels found');
    }

    return channels;
  }

  /**
   * Parse a single #EXTINF line into a channel meta object.
   */
  function _parseExtinf(line, id) {
    const meta = { id, name: 'Unknown Channel', group: '', logo: '' };

    // Extract tvg-name
    const nameMatch = line.match(/tvg-name="([^"]*)"/);
    if (nameMatch && nameMatch[1]) meta.name = nameMatch[1];

    // Extract group-title
    const groupMatch = line.match(/group-title="([^"]*)"/);
    if (groupMatch && groupMatch[1]) meta.group = groupMatch[1];

    // Extract tvg-logo
    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
    if (logoMatch && logoMatch[1]) meta.logo = logoMatch[1];

    // Fallback: trailing comma name
    const commaIdx = line.lastIndexOf(',');
    if (commaIdx !== -1) {
      const fallback = line.slice(commaIdx + 1).trim();
      if (fallback && meta.name === 'Unknown Channel') meta.name = fallback;
    }

    return meta;
  }

  function isValidUrl(str) {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

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

  /**
   * Read a File object and return parsed channels.
   */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file provided'));

      const reader = new FileReader();
      reader.onload  = (e) => resolve(parseM3U(e.target.result));
      reader.onerror = ()  => reject(new Error('File read error'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  return { parseM3U, readFile, isValidUrl };
})();
