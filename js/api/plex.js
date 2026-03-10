/* ===================================================
   Plex API Service
   Ported from src/services/plex.ts
   Uses localStorage instead of expo-secure-store
   Uses DOMParser instead of fast-xml-parser
   =================================================== */

const Plex = (() => {
  const SERVER_KEY = 'plex_server_url';
  const TOKEN_KEY  = 'plex_token';

  function getServerUrl() { return localStorage.getItem(SERVER_KEY) || ''; }
  function setServerUrl(url) { localStorage.setItem(SERVER_KEY, url); }
  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(token) { localStorage.setItem(TOKEN_KEY, token); }

  function isConfigured() {
    return !!(getServerUrl() && getToken());
  }

  async function fetchLibraries() {
    const server = getServerUrl();
    const token  = getToken();
    if (!server || !token) return [];

    const res = await fetch(`${server}/library/sections`, {
      headers: { 'X-Plex-Token': token, Accept: 'application/xml' }
    });
    if (!res.ok) throw new Error('Plex library fetch failed');

    const xml  = await res.text();
    const doc  = new DOMParser().parseFromString(xml, 'text/xml');
    const dirs = doc.querySelectorAll('Directory');
    return Array.from(dirs).map(d => ({
      key:   d.getAttribute('key'),
      title: d.getAttribute('title'),
      type:  d.getAttribute('type')
    }));
  }

  async function fetchRecentlyViewed() {
    const server = getServerUrl();
    const token  = getToken();
    if (!server || !token) return [];

    const res = await fetch(`${server}/status/sessions`, {
      headers: { 'X-Plex-Token': token, Accept: 'application/xml' }
    });
    if (!res.ok) throw new Error('Plex sessions fetch failed');

    const xml  = await res.text();
    const doc  = new DOMParser().parseFromString(xml, 'text/xml');
    const vids = doc.querySelectorAll('Video');
    return Array.from(vids).map(v => {
      const player = v.querySelector('Player');
      return {
        id:         v.getAttribute('ratingKey'),
        title:      v.getAttribute('title'),
        type:       v.getAttribute('type'),
        viewOffset: parseInt(v.getAttribute('viewOffset') || '0', 10),
        duration:   parseInt(v.getAttribute('duration') || '0', 10),
        player:     player ? (player.getAttribute('title') || player.getAttribute('product') || 'Unknown') : 'Unknown'
      };
    });
  }

  return { getServerUrl, setServerUrl, getToken, setToken, isConfigured, fetchLibraries, fetchRecentlyViewed };
})();
