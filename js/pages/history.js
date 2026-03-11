/* ShowBoat — Watched History Page */
const WatchedHistoryPage = {
  state: {
    tab: 'all',       // 'all' | 'tv' | 'movie'
    items: [],
    tvShows: [],      // grouped TV shows
    movies: [],
    loading: false,
  },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    this.state.tab = 'all';
    try {
      await this._loadData();
      this._draw(el);
    } catch (e) {
      el.innerHTML = UI.emptyState('Could not load history', e.message);
    }
  },

  async _loadData() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const watched = await Services.getWatched(uid);

    // Also load Plex history to enrich episode data
    let plexItems = [];
    try { plexItems = await Services.getPlexHistory(); } catch (_) {}

    // Group TV episodes by show
    const showMap = new Map();
    const movieMap = new Map();
    const epPattern = /^tv:(\d+):s(\d+):e(\d+)$/;

    for (const doc of watched) {
      if (doc.mediaType === 'movie' || doc.docId?.startsWith('movie:')) {
        // Deduplicate movies by tmdbId — keep the most recent entry
        const mid = doc.tmdbId || Number((doc.docId || '').replace('movie:', '')) || doc.docId;
        const existing = movieMap.get(mid);
        if (!existing || (doc.watchedAt || 0) > (existing.watchedAt || 0)) {
          movieMap.set(mid, doc);
        }
        continue;
      }
      const m = doc.docId?.match(epPattern);
      if (m) {
        const showId = Number(m[1]);
        const s = Number(m[2]), ep = Number(m[3]);
        if (!showMap.has(showId)) {
          showMap.set(showId, {
            tmdbId: showId,
            name: doc.name || doc.showName || '',
            posterPath: doc.posterPath || null,
            episodes: [],
            latestAt: 0,
          });
        }
        const show = showMap.get(showId);
        show.episodes.push({ season: s, episode: ep, watchedAt: doc.watchedAt || 0 });
        if ((doc.watchedAt || 0) > show.latestAt) show.latestAt = doc.watchedAt || 0;
      } else if (doc.mediaType === 'tv' || doc.docId?.startsWith('tv:')) {
        // Whole-show doc without episode breakdown
        const showId = doc.tmdbId || Number((doc.docId || '').split(':')[1]) || 0;
        if (!showMap.has(showId)) {
          showMap.set(showId, {
            tmdbId: showId,
            name: doc.name || doc.showName || '',
            posterPath: doc.posterPath || null,
            episodes: [],
            latestAt: doc.watchedAt || 0,
          });
        }
      }
    }

    // Enrich from Plex history — add episode data for shows that exist in showMap
    // and merge any Plex-only shows/movies the watched collection is missing
    const plexEpPattern = /^tv:(\d+):s(\d+):e(\d+)$/;
    for (const item of plexItems) {
      if (!item.tmdbId) continue;
      const id = Number(item.tmdbId);
      if (item.type === 'movie') {
        if (!movieMap.has(id)) {
          movieMap.set(id, {
            docId: `movie:${id}`, tmdbId: id, mediaType: 'movie',
            name: item.tmdbTitle || item.title || '',
            posterPath: item.posterPath || null,
            watchedAt: item.lastViewedAt ? item.lastViewedAt * 1000 : 0
          });
        }
        continue;
      }
      if (item.type === 'show' && item.season != null && item.episode != null) {
        if (!showMap.has(id)) {
          showMap.set(id, {
            tmdbId: id,
            name: item.tmdbTitle || item.title || '',
            posterPath: item.posterPath || null,
            episodes: [],
            latestAt: 0,
          });
        }
        const show = showMap.get(id);
        // Only add if this episode isn't already tracked
        const alreadyHas = show.episodes.some(e => e.season === item.season && e.episode === item.episode);
        if (!alreadyHas) {
          const ts = item.lastViewedAt ? item.lastViewedAt * 1000 : 0;
          show.episodes.push({ season: item.season, episode: item.episode, watchedAt: ts });
          if (ts > show.latestAt) show.latestAt = ts;
        }
        // Update name/poster if missing
        if (!show.name && (item.tmdbTitle || item.title)) show.name = item.tmdbTitle || item.title;
        if (!show.posterPath && item.posterPath) show.posterPath = item.posterPath;
      } else if (item.type === 'show') {
        if (!showMap.has(id)) {
          showMap.set(id, {
            tmdbId: id,
            name: item.tmdbTitle || item.title || '',
            posterPath: item.posterPath || null,
            episodes: [],
            latestAt: item.lastViewedAt ? item.lastViewedAt * 1000 : 0,
          });
        }
      }
    }

    this.state.tvShows = [...showMap.values()].filter(s => s.episodes.length > 0).sort((a, b) => b.latestAt - a.latestAt);
    this.state.movies = [...movieMap.values()].sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0));
    this.state.items = watched;

    // Fetch total episode counts from TMDB in parallel (for progress rings)
    await Promise.all(this.state.tvShows.map(async show => {
      try {
        const details = await API.getShowDetails(show.tmdbId);
        if (details) {
          show.totalEpisodes = details.number_of_episodes || 0;
          show.year = (details.first_air_date || '').substring(0, 4);
          if (!show.name && (details.name || details.title)) show.name = details.name || details.title;
          if (!show.posterPath && details.poster_path) show.posterPath = details.poster_path;
        }
      } catch (_) {}
    }));

    // Fix same-name show mismatches — if two shows share a name and one has more
    // watched episodes than its total while another has fewer, the Plex sync likely
    // assigned episodes to the wrong TMDB ID (title-based docId collision).
    this._fixSameNameMismatches();
  },

  _fixSameNameMismatches() {
    const byName = new Map();
    for (const show of this.state.tvShows) {
      const key = (show.name || '').toLowerCase().trim();
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(show);
    }
    for (const [, group] of byName) {
      if (group.length < 2) continue;
      const withTotal = group.filter(s => s.totalEpisodes > 0);
      if (withTotal.length < 2) continue;
      // Only intervene if at least one show has more watched than its total
      if (!withTotal.some(s => s.episodes.length > s.totalEpisodes)) continue;
      // Reassign: show with the most total episodes gets the largest episode list
      withTotal.sort((a, b) => b.totalEpisodes - a.totalEpisodes);
      const epArrays = withTotal.map(s => s.episodes).sort((a, b) => b.length - a.length);
      for (let i = 0; i < withTotal.length; i++) {
        withTotal[i].episodes = epArrays[i];
        withTotal[i].latestAt = epArrays[i].reduce((max, e) => Math.max(max, e.watchedAt || 0), 0);
      }
    }
  },

  _draw(el) {
    const { tab, tvShows, movies } = this.state;
    const totalTV = tvShows.length;
    const totalMovies = movies.length;
    const totalEps = tvShows.reduce((acc, s) => acc + s.episodes.length, 0);

    el.innerHTML = `
      <div class="watched-history-page">
        ${UI.pageHeader('Watch History', true)}
        <div class="wh-summary">
          <div class="wh-stat"><span class="wh-stat-num">${totalTV}</span><span class="wh-stat-label">Shows</span></div>
          <div class="wh-stat"><span class="wh-stat-num">${totalEps}</span><span class="wh-stat-label">Episodes</span></div>
          <div class="wh-stat"><span class="wh-stat-num">${totalMovies}</span><span class="wh-stat-label">Movies</span></div>
        </div>
        <div class="act-type-tabs wh-tabs">
          <button class="act-tab-btn ${tab === 'all' ? 'active' : ''}" onclick="WatchedHistoryPage.setTab('all')">All</button>
          <button class="act-tab-btn ${tab === 'tv' ? 'active' : ''}" onclick="WatchedHistoryPage.setTab('tv')">TV Shows</button>
          <button class="act-tab-btn ${tab === 'movie' ? 'active' : ''}" onclick="WatchedHistoryPage.setTab('movie')">Movies</button>
        </div>
        <div class="wh-list" id="wh-list">
          ${this._renderList()}
        </div>
      </div>`;
  },

  setTab(tab) {
    this.state.tab = tab;
    const list = document.getElementById('wh-list');
    if (list) list.innerHTML = this._renderList();
    document.querySelectorAll('.wh-tabs .act-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.toLowerCase().replace(' shows', '').replace(' ', '') === tab.replace('movie', 'movie').replace('tv', 'tv').replace('all', 'all'));
    });
    // Re-match active tab text
    document.querySelectorAll('.wh-tabs .act-tab-btn').forEach(btn => {
      const t = btn.getAttribute('onclick').match(/'(\w+)'/)?.[1];
      btn.classList.toggle('active', t === tab);
    });
  },

  _renderList() {
    const { tab, tvShows, movies } = this.state;
    const showTV = tab === 'all' || tab === 'tv';
    const showMovies = tab === 'all' || tab === 'movie';
    const parts = [];

    if (showTV && tvShows.length) {
      parts.push(tvShows.map(show => this._renderShowCard(show)).join(''));
    }
    if (showMovies && movies.length) {
      parts.push(movies.map(m => this._renderMovieCard(m)).join(''));
    }

    if (!parts.length || (!tvShows.length && !movies.length)) {
      return '<p class="empty-text" style="text-align:center;padding:40px 0">Nothing watched yet</p>';
    }
    return parts.join('');
  },

  _renderShowCard(show) {
    const poster = show.posterPath ? API.imageUrl(show.posterPath, 'w342') : '';
    const eps = show.episodes.length;
    const total = show.totalEpisodes || null;
    const ringHtml = eps > 0 ? this._ringHtml(eps, total) : '';

    return `<div class="wh-card" onclick="App.navigate('details',{id:${show.tmdbId},type:'tv'})">
      ${poster
        ? `<img src="${UI.escapeHtml(poster)}" alt="" class="wh-poster">`
        : `<div class="wh-poster wh-poster-placeholder">${UI.icon('tv', 28)}</div>`
      }
      <div class="wh-card-info">
        <p class="wh-card-title">${UI.escapeHtml(show.name || 'Unknown Show')}${show.year ? ` <span class="wh-card-year">(${show.year})</span>` : ''}</p>
        <p class="wh-card-sub">${eps}${total ? ` / ${total}` : ''} episode${eps !== 1 ? 's' : ''} watched</p>
        ${show.latestAt ? `<p class="wh-card-date">${this._fmtDate(show.latestAt)}</p>` : ''}
      </div>
      ${ringHtml}
    </div>`;
  },

  _renderMovieCard(movie) {
    const poster = movie.posterPath ? API.imageUrl(movie.posterPath, 'w342') : '';
    return `<div class="wh-card" onclick="App.navigate('details',{id:${movie.tmdbId || 0},type:'movie'})">
      ${poster
        ? `<img src="${UI.escapeHtml(poster)}" alt="" class="wh-poster">`
        : `<div class="wh-poster wh-poster-placeholder">${UI.icon('film', 28)}</div>`
      }
      <div class="wh-card-info">
        <p class="wh-card-title">${UI.escapeHtml(movie.name || movie.title || 'Unknown Movie')}</p>
        <p class="wh-card-sub">Movie</p>
        ${movie.watchedAt ? `<p class="wh-card-date">${this._fmtDate(movie.watchedAt)}</p>` : ''}
      </div>
      <div class="wh-ring-wrap">${this._movieCheckHtml()}</div>
    </div>`;
  },

  /** Circular progress ring: watched/total. If total is null, show ep count badge. */
  _ringHtml(watched, total) {
    if (!total) {
      // Simple episode count circle
      return `<div class="wh-ring-wrap">
        <svg class="wh-ring" viewBox="0 0 36 36">
          <circle class="wh-ring-bg" cx="18" cy="18" r="15" fill="none" stroke-width="3"/>
          <circle class="wh-ring-fill" cx="18" cy="18" r="15" fill="none" stroke-width="3"
            stroke-dasharray="60,40" stroke-dashoffset="25"/>
          <text x="18" y="21" class="wh-ring-text" text-anchor="middle">${watched > 99 ? '99+' : watched}</text>
        </svg>
        <span class="wh-ring-label">eps</span>
      </div>`;
    }
    const pct = Math.min(100, Math.round((watched / total) * 100));
    const dash = Math.round((pct / 100) * 94);
    const gap = 94 - dash;
    return `<div class="wh-ring-wrap">
      <svg class="wh-ring" viewBox="0 0 36 36">
        <circle class="wh-ring-bg" cx="18" cy="18" r="15" fill="none" stroke-width="3"/>
        <circle class="wh-ring-fill" cx="18" cy="18" r="15" fill="none" stroke-width="3"
          stroke-dasharray="${dash},${gap}" stroke-dashoffset="25"/>
        <text x="18" y="14" class="wh-ring-text wh-ring-text-sm" text-anchor="middle">${watched}</text>
        <text x="18" y="22" class="wh-ring-text wh-ring-text-tiny" text-anchor="middle">of ${total}</text>
      </svg>
      <span class="wh-ring-label">${pct}%</span>
    </div>`;
  },

  _movieCheckHtml() {
    return `<svg class="wh-ring" viewBox="0 0 36 36">
      <circle class="wh-ring-bg" cx="18" cy="18" r="15" fill="none" stroke-width="3"/>
      <circle class="wh-ring-fill wh-ring-complete" cx="18" cy="18" r="15" fill="none" stroke-width="3"
        stroke-dasharray="94,0" stroke-dashoffset="25"/>
      <text x="18" y="22" class="wh-ring-text" text-anchor="middle">✓</text>
    </svg>`;
  },

  _fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
};
