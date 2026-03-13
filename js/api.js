/* ShowBoat — API Layer (TMDB + Plex) */
const TMDB_KEY = '02ce7d51a5b8a8614f1c06d0558f5acd';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

// In-memory TTL cache — eliminates redundant TMDB network calls within a session
const _tmdbCache = new Map();
const _CACHE_TTL       = 5  * 60 * 1000; // 5 min  — trending, search, discover
const _CACHE_TTL_LONG  = 30 * 60 * 1000; // 30 min — details, credits, people, genres
// Regex for endpoints whose data rarely changes mid-session
const _LONG_TTL_RE = /\/(tv|movie)\/\d+$|\/credits|\/aggregate_credits|\/images|\/person\/\d+|\/genre\//;
function _tmdbCacheGet(key) {
  const entry = _tmdbCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) { _tmdbCache.delete(key); return null; }
  return entry.data;
}
function _tmdbCacheSet(key, data, ttl) {
  _tmdbCache.set(key, { data, ts: Date.now(), ttl });
  // Evict expired entries if cache grows large
  if (_tmdbCache.size > 300) {
    const now = Date.now();
    for (const [k, v] of _tmdbCache) { if (now - v.ts > v.ttl) _tmdbCache.delete(k); }
  }
}

const API = {
  // --- Image URL (generic, used by all pages) ---
  imageUrl(path, size = 'w342') { return path ? `${TMDB_IMG}/${size}${path}` : ''; },

  // --- Fetch helper (cached) ---
  async tmdb(endpoint, params = {}) {
    const url = new URL(`${TMDB_BASE}${endpoint}`);
    url.searchParams.set('api_key', TMDB_KEY);
    Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, String(v)); });
    const cacheKey = url.toString();
    const cached = _tmdbCacheGet(cacheKey);
    if (cached) return cached;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const ttl = _LONG_TTL_RE.test(endpoint) ? _CACHE_TTL_LONG : _CACHE_TTL;
    _tmdbCacheSet(cacheKey, data, ttl);
    return data;
  },

  // --- Search (return raw TMDB results) ---
  async searchShows(query, page = 1, year = null) {
    const params = { query, page };
    if (year) params.first_air_date_year = year;
    const data = await this.tmdb('/search/tv', params);
    return data?.results || [];
  },
  async searchMovies(query, page = 1, year = null) {
    const params = { query, page };
    if (year) params.year = year;
    const data = await this.tmdb('/search/movie', params);
    return data?.results || [];
  },
  async searchPeople(query, page = 1) {
    const data = await this.tmdb('/search/person', { query, page });
    return data?.results || [];
  },
  async searchMulti(query, page = 1) {
    const data = await this.tmdb('/search/multi', { query, page });
    return data?.results || [];
  },

  // --- Trending (generic — accepts 'tv', 'movie', 'all', 'person') ---
  async getTrending(type = 'all') {
    const data = await this.tmdb(`/trending/${type}/week`);
    return data?.results || [];
  },

  // --- Genres ---
  async getGenres(type = 'tv') {
    const data = await this.tmdb(`/genre/${type}/list`);
    return data?.genres || [];
  },

  // --- Discover ---
  async discoverMedia(type = 'tv', params = {}) {
    const data = await this.tmdb(`/discover/${type}`, params);
    return data?.results || [];
  },

  // --- Top Rated / Upcoming / On Air ---
  async getTopRated(type = 'tv', page = 1) {
    const data = await this.tmdb(`/${type}/top_rated`, { page });
    return data?.results || [];
  },
  async getUpcomingMovies(page = 1) {
    const data = await this.tmdb('/movie/upcoming', { page });
    return data?.results || [];
  },
  async getOnTheAirShows(page = 1) {
    const data = await this.tmdb('/tv/on_the_air', { page });
    return data?.results || [];
  },
  async getSimilar(id, type = 'tv', page = 1) {
    const data = await this.tmdb(`/${type}/${id}/similar`, { page });
    return data?.results || [];
  },
  async getRecommendations(id, type = 'tv', page = 1) {
    const data = await this.tmdb(`/${type}/${id}/recommendations`, { page });
    return data?.results || [];
  },

  // --- Details (return raw TMDB data with credits & images appended) ---
  async getShowDetails(id) {
    const data = await this.tmdb(`/tv/${id}`, { append_to_response: 'credits,images' });
    if (!data) return null;
    data.media_type = 'tv';
    data.cast = (data.credits?.cast || []).slice(0, 20);
    return data;
  },
  async getMovieDetails(id) {
    const data = await this.tmdb(`/movie/${id}`, { append_to_response: 'credits,images' });
    if (!data) return null;
    data.media_type = 'movie';
    data.cast = (data.credits?.cast || []).slice(0, 20);
    return data;
  },

  // --- Season Episodes (raw) ---
  async getSeasonEpisodes(showId, seasonNum) {
    const data = await this.tmdb(`/tv/${showId}/season/${seasonNum}`);
    return data?.episodes || [];
  },

  // --- Episode Details (raw) ---
  async getEpisodeDetails(showId, seasonNum, epNum) {
    return this.tmdb(`/tv/${showId}/season/${seasonNum}/episode/${epNum}`);
  },

  // --- Credits (raw) ---
  async getMediaCredits(id, type = 'tv') {
    const data = await this.tmdb(`/${type}/${id}/credits`);
    return data || { cast: [], crew: [] };
  },

  // --- Aggregate Credits (TV shows only — includes episode_count and roles array) ---
  async getAggregateCredits(id) {
    const data = await this.tmdb(`/tv/${id}/aggregate_credits`);
    return data || { cast: [], crew: [] };
  },

  // --- Person Details (raw with combined_credits) ---
  async getPersonDetails(id) {
    return this.tmdb(`/person/${id}`, { append_to_response: 'combined_credits' });
  },

  // --- Fetch Logo ---
  async fetchLogo(id, type = 'tv') {
    const data = await this.tmdb(`/${type}/${id}/images`);
    if (!data) return null;
    const en = data.logos?.find(l => l.iso_639_1 === 'en');
    return en?.file_path || data.logos?.[0]?.file_path || null;
  }
};

/* --- Plex Auth API --- */
const PlexAPI = {
  clientId: localStorage.getItem('plex_client_id') || (() => {
    const id = 'showboat-web-' + crypto.randomUUID();
    localStorage.setItem('plex_client_id', id);
    return id;
  })(),

  headers() {
    return {
      'X-Plex-Product': 'ShowBoat',
      'X-Plex-Version': '1.0',
      'X-Plex-Client-Identifier': this.clientId,
      'Accept': 'application/json'
    };
  },

  async createPin() {
    const res = await fetch('https://plex.tv/api/v2/pins?strong=true', {
      method: 'POST', headers: this.headers()
    });
    return res.json();
  },

  async checkPin(pinId) {
    const res = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, { headers: this.headers() });
    return res.json();
  },

  getAuthUrl(pinCode) {
    const params = new URLSearchParams({
      clientID: this.clientId, code: pinCode,
      'context[device][product]': 'ShowBoat',
      'context[device][version]': '1.0'
    });
    return `https://app.plex.tv/auth#?${params}`;
  },

  async getResources(token) {
    const res = await fetch('https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1', {
      headers: { ...this.headers(), 'X-Plex-Token': token }
    });
    return res.json();
  },

  // Get usable server connection URIs, sorted: relay first, then remote HTTPS, then local
  getServerConnections(server) {
    const conns = server.connections || [];
    const relay = conns.filter(c => c.relay);
    const remote = conns.filter(c => !c.relay && !c.local && c.protocol === 'https');
    const local = conns.filter(c => c.local);
    return [...relay, ...remote, ...local];
  },

  // Try fetching from a Plex server, trying each connection until one works
  async serverFetch(token, server, path) {
    const conns = this.getServerConnections(server);
    for (const conn of conns) {
      try {
        const url = `${conn.uri}${path}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
          headers: { ...this.headers(), 'X-Plex-Token': token },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (res.ok) {
          this._lastWorkingUri = conn.uri;
          return res.json();
        }
      } catch (_) { /* try next connection */ }
    }
    return null;
  }
};
