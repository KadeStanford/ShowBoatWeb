/* ShowBoat — API Layer (TMDB + Plex) */
const TMDB_KEY = '02ce7d51a5b8a8614f1c06d0558f5acd';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

const API = {
  // --- Image URLs ---
  posterUrl(path, size = 'w342') { return path ? `${TMDB_IMG}/${size}${path}` : null; },
  backdropUrl(path, size = 'w1280') { return path ? `${TMDB_IMG}/${size}${path}` : null; },
  logoUrl(path, size = 'w300') { return path ? `${TMDB_IMG}/${size}${path}` : null; },
  stillUrl(path, size = 'w300') { return path ? `${TMDB_IMG}/${size}${path}` : null; },
  profileUrl(path, size = 'w185') { return path ? `${TMDB_IMG}/${size}${path}` : null; },

  // --- Fetch helper ---
  async tmdb(endpoint, params = {}) {
    const url = new URL(`${TMDB_BASE}${endpoint}`);
    url.searchParams.set('api_key', TMDB_KEY);
    Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, String(v)); });
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  },

  // --- Search ---
  async searchShows(query, page = 1) {
    const data = await this.tmdb('/search/tv', { query, page });
    return data ? this._mapShows(data.results, 'tv') : [];
  },
  async searchMovies(query, page = 1) {
    const data = await this.tmdb('/search/movie', { query, page });
    return data ? this._mapMovies(data.results) : [];
  },
  async searchPeople(query, page = 1) {
    const data = await this.tmdb('/search/person', { query, page });
    return data?.results || [];
  },
  async searchMulti(query, page = 1) {
    const data = await this.tmdb('/search/multi', { query, page });
    if (!data) return [];
    return data.results.map(r => {
      if (r.media_type === 'movie') return { id: r.id, name: r.title || r.name, posterPath: r.poster_path, backdropPath: r.backdrop_path, overview: r.overview || '', mediaType: 'movie', firstAirDate: r.release_date, genreIds: r.genre_ids || [], voteAverage: r.vote_average };
      if (r.media_type === 'tv') return { id: r.id, name: r.name, posterPath: r.poster_path, backdropPath: r.backdrop_path, overview: r.overview || '', mediaType: 'tv', firstAirDate: r.first_air_date, genreIds: r.genre_ids || [], voteAverage: r.vote_average };
      if (r.media_type === 'person') return { id: r.id, name: r.name, posterPath: r.profile_path, mediaType: 'person' };
      return null;
    }).filter(Boolean);
  },

  // --- Trending ---
  async getTrendingShows() {
    const data = await this.tmdb('/trending/tv/week');
    return data ? this._mapShows(data.results, 'tv') : [];
  },
  async getTrendingMovies() {
    const data = await this.tmdb('/trending/movie/week');
    return data ? this._mapMovies(data.results) : [];
  },

  // --- Genres ---
  async getGenres(type = 'tv') {
    const data = await this.tmdb(`/genre/${type}/list`);
    return data?.genres || [];
  },

  // --- Discover ---
  async discoverMedia(type = 'tv', params = {}) {
    const data = await this.tmdb(`/discover/${type}`, params);
    if (!data) return [];
    return type === 'movie' ? this._mapMovies(data.results) : this._mapShows(data.results, 'tv');
  },

  // --- Top Rated / Upcoming / On Air ---
  async getTopRated(type = 'tv', page = 1) {
    const data = await this.tmdb(`/${type}/top_rated`, { page });
    if (!data) return [];
    return type === 'movie' ? this._mapMovies(data.results) : this._mapShows(data.results, 'tv');
  },
  async getUpcomingMovies(page = 1) {
    const data = await this.tmdb('/movie/upcoming', { page });
    return data ? this._mapMovies(data.results) : [];
  },
  async getOnTheAirShows(page = 1) {
    const data = await this.tmdb('/tv/on_the_air', { page });
    return data ? this._mapShows(data.results, 'tv') : [];
  },

  // --- Details ---
  async getShowDetails(id) {
    const data = await this.tmdb(`/tv/${id}`, { append_to_response: 'credits,images' });
    if (!data) return null;
    const logoPath = data.images?.logos?.find(l => l.iso_639_1 === 'en')?.file_path || data.images?.logos?.[0]?.file_path || null;
    return {
      id: data.id, name: data.name, overview: data.overview || '',
      posterPath: data.poster_path, backdropPath: data.backdrop_path, logoPath,
      firstAirDate: data.first_air_date, lastAirDate: data.last_air_date,
      status: data.status, tagline: data.tagline || '',
      numberOfSeasons: data.number_of_seasons, numberOfEpisodes: data.number_of_episodes,
      episodeRunTime: data.episode_run_time || [],
      voteAverage: data.vote_average, voteCount: data.vote_count,
      genres: data.genres || [], homepage: data.homepage,
      networks: (data.networks || []).map(n => ({ id: n.id, name: n.name, logoPath: n.logo_path })),
      seasons: (data.seasons || []).map(s => ({
        id: s.id, seasonNumber: s.season_number, name: s.name,
        episodeCount: s.episode_count, posterPath: s.poster_path, airDate: s.air_date
      })),
      cast: (data.credits?.cast || []).slice(0, 20).map(c => ({
        id: c.id, name: c.name, character: c.character, profilePath: c.profile_path, order: c.order
      })),
      mediaType: 'tv'
    };
  },
  async getMovieDetails(id) {
    const data = await this.tmdb(`/movie/${id}`, { append_to_response: 'credits,images' });
    if (!data) return null;
    const logoPath = data.images?.logos?.find(l => l.iso_639_1 === 'en')?.file_path || data.images?.logos?.[0]?.file_path || null;
    return {
      id: data.id, name: data.title, overview: data.overview || '',
      posterPath: data.poster_path, backdropPath: data.backdrop_path, logoPath,
      firstAirDate: data.release_date, lastAirDate: null,
      status: data.status, tagline: data.tagline || '',
      numberOfSeasons: null, numberOfEpisodes: null,
      episodeRunTime: data.runtime ? [data.runtime] : [],
      voteAverage: data.vote_average, voteCount: data.vote_count,
      genres: data.genres || [], homepage: data.homepage, networks: [],
      seasons: [], mediaType: 'movie',
      cast: (data.credits?.cast || []).slice(0, 20).map(c => ({
        id: c.id, name: c.name, character: c.character, profilePath: c.profile_path, order: c.order
      }))
    };
  },

  // --- Season Episodes ---
  async getSeasonEpisodes(showId, seasonNum) {
    const data = await this.tmdb(`/tv/${showId}/season/${seasonNum}`);
    if (!data) return [];
    return (data.episodes || []).map(e => ({
      id: e.id, name: e.name, overview: e.overview || '',
      episodeNumber: e.episode_number, seasonNumber: e.season_number,
      stillPath: e.still_path, airDate: e.air_date,
      voteAverage: e.vote_average, runtime: e.runtime
    }));
  },

  // --- Episode Details ---
  async getEpisodeDetails(showId, seasonNum, epNum) {
    const data = await this.tmdb(`/tv/${showId}/season/${seasonNum}/episode/${epNum}`);
    if (!data) return null;
    return {
      id: data.id, name: data.name, overview: data.overview || '',
      episodeNumber: data.episode_number, seasonNumber: data.season_number,
      stillPath: data.still_path, airDate: data.air_date,
      voteAverage: data.vote_average, runtime: data.runtime,
      crew: data.crew || [], guestStars: data.guest_stars || []
    };
  },

  // --- Credits ---
  async getMediaCredits(id, type = 'tv') {
    const data = await this.tmdb(`/${type}/${id}/credits`);
    if (!data) return { cast: [], crew: [] };
    return {
      cast: (data.cast || []).map(c => ({ id: c.id, name: c.name, character: c.character, profilePath: c.profile_path, order: c.order })),
      crew: (data.crew || []).map(c => ({ id: c.id, name: c.name, job: c.job, department: c.department, profilePath: c.profile_path }))
    };
  },

  // --- Person Details ---
  async getPersonDetails(id) {
    const data = await this.tmdb(`/person/${id}`, { append_to_response: 'combined_credits' });
    if (!data) return null;
    return {
      id: data.id, name: data.name, biography: data.biography || '',
      profilePath: data.profile_path, birthday: data.birthday, deathday: data.deathday,
      placeOfBirth: data.place_of_birth, knownFor: data.known_for_department,
      credits: (data.combined_credits?.cast || []).map(c => ({
        id: c.id, name: c.title || c.name, posterPath: c.poster_path,
        mediaType: c.media_type, character: c.character, releaseDate: c.release_date || c.first_air_date,
        voteAverage: c.vote_average
      })).sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0))
    };
  },

  // --- Fetch Logo ---
  async fetchLogo(id, type = 'tv') {
    const data = await this.tmdb(`/${type}/${id}/images`);
    if (!data) return null;
    const en = data.logos?.find(l => l.iso_639_1 === 'en');
    return en?.file_path || data.logos?.[0]?.file_path || null;
  },

  // --- Helpers ---
  _mapShows(results, mediaType) {
    return (results || []).map(r => ({
      id: r.id, name: r.name || r.title, posterPath: r.poster_path,
      backdropPath: r.backdrop_path, overview: r.overview || '',
      firstAirDate: r.first_air_date || r.release_date,
      genreIds: r.genre_ids || [], mediaType, voteAverage: r.vote_average
    }));
  },
  _mapMovies(results) {
    return (results || []).map(r => ({
      id: r.id, name: r.title || r.name, posterPath: r.poster_path,
      backdropPath: r.backdrop_path, overview: r.overview || '',
      firstAirDate: r.release_date, genreIds: r.genre_ids || [],
      mediaType: 'movie', voteAverage: r.vote_average
    }));
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
    const res = await fetch('https://plex.tv/api/v2/resources?includeHttps=1', {
      headers: { ...this.headers(), 'X-Plex-Token': token }
    });
    return res.json();
  }
};
