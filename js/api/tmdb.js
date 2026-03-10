/* ===================================================
   TMDB API Service
   Ported from src/services/tmdb.ts
   =================================================== */

const TMDB = (() => {
  const API_KEY = 'a1b89020e826683d82514d99e65047cc';
  const BASE    = 'https://api.themoviedb.org/3';
  const IMG_500 = 'https://image.tmdb.org/t/p/w500';
  const IMG_1280 = 'https://image.tmdb.org/t/p/w1280';

  function getPosterUrl(path) {
    return path ? `${IMG_500}${path}` : null;
  }

  function getBackdropUrl(path) {
    return path ? `${IMG_1280}${path}` : null;
  }

  async function searchMedia(query) {
    const url = `${BASE}/search/multi?api_key=${encodeURIComponent(API_KEY)}&query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('TMDB search failed');
    const data = await res.json();
    return (data.results || []).filter(r => r.media_type !== 'person');
  }

  async function getTrending() {
    const url = `${BASE}/trending/all/day?api_key=${encodeURIComponent(API_KEY)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('TMDB trending failed');
    const data = await res.json();
    return data.results || [];
  }

  async function getDetails(id, type) {
    const url = `${BASE}/${type}/${id}?api_key=${encodeURIComponent(API_KEY)}&append_to_response=credits,images&include_image_language=en,null`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('TMDB details failed');
    return res.json();
  }

  async function getSeasonDetails(tvId, seasonNumber) {
    const url = `${BASE}/tv/${tvId}/season/${seasonNumber}?api_key=${encodeURIComponent(API_KEY)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('TMDB season details failed');
    return res.json();
  }

  return { getPosterUrl, getBackdropUrl, searchMedia, getTrending, getDetails, getSeasonDetails };
})();
