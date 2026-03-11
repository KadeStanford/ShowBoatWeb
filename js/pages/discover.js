/* ShowBoat — Discover Page */
const DiscoverPage = {
  state: {
    query: '', results: [], tab: 'multi', genres: [], selectedGenres: [],
    trending: [], page: 1, totalPages: 1, loading: false, friendActivityIds: new Set(), plexIds: new Set(),
    _observer: null,
    // Advanced filters
    sortBy: '', yearFrom: '', yearTo: '', language: '', voteMin: '', voteMax: '',
    castQuery: '', castId: '', castName: '', networkQuery: '', networkId: '', networkName: '',
    seasonsMin: '', seasonsMax: '', runtimeMin: '', runtimeMax: '',
    showFilters: false,
    watchedIds: new Set(), hideWatched: false
  },

  languages: [
    { code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' }, { code: 'ja', name: 'Japanese' }, { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' }, { code: 'hi', name: 'Hindi' }, { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' }, { code: 'ru', name: 'Russian' }, { code: 'ar', name: 'Arabic' },
    { code: 'th', name: 'Thai' }, { code: 'tr', name: 'Turkish' }, { code: 'pl', name: 'Polish' },
    { code: 'nl', name: 'Dutch' }, { code: 'sv', name: 'Swedish' }, { code: 'da', name: 'Danish' },
    { code: 'no', name: 'Norwegian' }, { code: 'fi', name: 'Finnish' }
  ],

  sortOptions: {
    tv: [
      { value: '', label: 'Default' },
      { value: 'vote_average.desc', label: 'Highest Rated' },
      { value: 'vote_average.asc', label: 'Lowest Rated' },
      { value: 'first_air_date.desc', label: 'Newest First' },
      { value: 'first_air_date.asc', label: 'Oldest First' },
      { value: 'popularity.desc', label: 'Most Popular' },
      { value: 'name.asc', label: 'A → Z' }
    ],
    movie: [
      { value: '', label: 'Default' },
      { value: 'vote_average.desc', label: 'Highest Rated' },
      { value: 'vote_average.asc', label: 'Lowest Rated' },
      { value: 'primary_release_date.desc', label: 'Newest First' },
      { value: 'primary_release_date.asc', label: 'Oldest First' },
      { value: 'popularity.desc', label: 'Most Popular' },
      { value: 'revenue.desc', label: 'Highest Revenue' },
      { value: 'original_title.asc', label: 'A → Z' }
    ]
  },

  async render(params) {
    if (params?.tab) this.state.tab = params.tab;
    const el = document.getElementById('page-content');
    const isFilterable = this.state.tab === 'tv' || this.state.tab === 'movie';
    const activeCount = this._activeFilterCount();
    el.innerHTML = `<div class="discover-page">
      ${UI.pageHeader('Discover', true)}
      <div class="search-container">
        <div class="search-bar">
          ${UI.icon('search', 20)}
          <input type="text" id="discover-search" placeholder="Search movies, shows, people..." value="${UI.escapeHtml(this.state.query)}" oninput="DiscoverPage.onSearch(this.value)">
          ${this.state.query ? `<button class="clear-btn" onclick="DiscoverPage.clearSearch()">${UI.icon('x', 18)}</button>` : ''}
        </div>
      </div>
      <div class="filter-tabs">
        ${['multi', 'tv', 'movie', 'person'].map(t => `<button class="filter-tab ${this.state.tab === t ? 'active' : ''}" onclick="DiscoverPage.setTab('${t}')">${t === 'multi' ? 'All' : t === 'tv' ? 'TV Shows' : t === 'movie' ? 'Movies' : 'People'}</button>`).join('')}
        ${isFilterable ? `<button class="filter-tab filter-toggle ${this.state.showFilters ? 'active' : ''}" onclick="DiscoverPage.toggleFilters()">${UI.icon('bar-chart-2', 14)} Filters${activeCount ? ` (${activeCount})` : ''}</button>` : ''}
      </div>
      <div id="genre-chips"></div>
      <div id="advanced-filters" class="${this.state.showFilters && isFilterable ? '' : 'hidden'}"></div>
      <div id="discover-results">${UI.loading()}</div>
    </div>`;
    this.loadFriendActivityDots();
    this.loadWatchedIds();
    this.loadPlexDots();
    await this.loadGenres();
    if (this.state.showFilters && isFilterable) this.renderFilters();
    await this.loadContent();
  },

  _activeFilterCount() {
    let c = 0;
    if (this.state.selectedGenres.length) c++;
    if (this.state.sortBy) c++;
    if (this.state.yearFrom || this.state.yearTo) c++;
    if (this.state.language) c++;
    if (this.state.voteMin || this.state.voteMax) c++;
    if (this.state.castId) c++;
    if (this.state.networkId) c++;
    if (this.state.seasonsMin || this.state.seasonsMax) c++;
    if (this.state.runtimeMin || this.state.runtimeMax) c++;
    if (this.state.hideWatched) c++;
    return c;
  },

  toggleFilters() {
    this.state.showFilters = !this.state.showFilters;
    const el = document.getElementById('advanced-filters');
    const btn = document.querySelector('.filter-toggle');
    if (el) el.classList.toggle('hidden', !this.state.showFilters);
    if (btn) btn.classList.toggle('active', this.state.showFilters);
    if (this.state.showFilters) this.renderFilters();
  },

  renderFilters() {
    const el = document.getElementById('advanced-filters');
    if (!el) return;
    const type = this.state.tab;
    const sorts = this.sortOptions[type] || this.sortOptions.movie;
    el.innerHTML = `<div class="adv-filters-panel">
      <div class="adv-filters-grid">
        <div class="filter-group">
          <label>Sort By</label>
          <select onchange="DiscoverPage.setFilter('sortBy', this.value)">
            ${sorts.map(s => `<option value="${s.value}" ${this.state.sortBy === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>Language</label>
          <select onchange="DiscoverPage.setFilter('language', this.value)">
            <option value="">Any</option>
            ${this.languages.map(l => `<option value="${l.code}" ${this.state.language === l.code ? 'selected' : ''}>${l.name}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>Year From</label>
          <input type="number" min="1900" max="2030" placeholder="e.g. 2000" value="${this.state.yearFrom}" onchange="DiscoverPage.setFilter('yearFrom', this.value)">
        </div>
        <div class="filter-group">
          <label>Year To</label>
          <input type="number" min="1900" max="2030" placeholder="e.g. 2024" value="${this.state.yearTo}" onchange="DiscoverPage.setFilter('yearTo', this.value)">
        </div>
        <div class="filter-group">
          <label>Min Rating</label>
          <input type="number" min="0" max="10" step="0.5" placeholder="0" value="${this.state.voteMin}" onchange="DiscoverPage.setFilter('voteMin', this.value)">
        </div>
        <div class="filter-group">
          <label>Max Rating</label>
          <input type="number" min="0" max="10" step="0.5" placeholder="10" value="${this.state.voteMax}" onchange="DiscoverPage.setFilter('voteMax', this.value)">
        </div>
        <div class="filter-group">
          <label>Min Runtime (min)</label>
          <input type="number" min="0" placeholder="e.g. 30" value="${this.state.runtimeMin}" onchange="DiscoverPage.setFilter('runtimeMin', this.value)">
        </div>
        <div class="filter-group">
          <label>Max Runtime (min)</label>
          <input type="number" min="0" placeholder="e.g. 180" value="${this.state.runtimeMax}" onchange="DiscoverPage.setFilter('runtimeMax', this.value)">
        </div>
        ${type === 'tv' ? `
        <div class="filter-group">
          <label>Min Seasons</label>
          <input type="number" min="1" placeholder="e.g. 1" value="${this.state.seasonsMin}" onchange="DiscoverPage.setFilter('seasonsMin', this.value)">
        </div>
        <div class="filter-group">
          <label>Max Seasons</label>
          <input type="number" min="1" placeholder="e.g. 10" value="${this.state.seasonsMax}" onchange="DiscoverPage.setFilter('seasonsMax', this.value)">
        </div>` : ''}
        <div class="filter-group filter-group-wide">
          <label>Actor / Cast Member</label>
          <div class="filter-search-wrap">
            <input type="text" placeholder="Search for an actor..." value="${UI.escapeHtml(this.state.castName || this.state.castQuery)}" oninput="DiscoverPage.searchCast(this.value)" id="cast-search">
            <div id="cast-results" class="filter-dropdown hidden"></div>
          </div>
          ${this.state.castName ? `<span class="filter-chip">${UI.escapeHtml(this.state.castName)} <button onclick="DiscoverPage.clearCast()">${UI.icon('x', 12)}</button></span>` : ''}
        </div>
        ${type === 'tv' ? `<div class="filter-group filter-group-wide">
          <label>Network</label>
          <div class="filter-search-wrap">
            <input type="text" placeholder="Search for a network..." value="${UI.escapeHtml(this.state.networkName || this.state.networkQuery)}" oninput="DiscoverPage.searchNetwork(this.value)" id="network-search">
            <div id="network-results" class="filter-dropdown hidden"></div>
          </div>
          ${this.state.networkName ? `<span class="filter-chip">${UI.escapeHtml(this.state.networkName)} <button onclick="DiscoverPage.clearNetwork()">${UI.icon('x', 12)}</button></span>` : ''}
        </div>` : ''}
      </div>
      <div class="adv-filters-actions">
        <label class="filter-check-label"><input type="checkbox" ${this.state.hideWatched ? 'checked' : ''} onchange="DiscoverPage.state.hideWatched=this.checked; DiscoverPage.loadContent()"> Hide Watched</label>
        <button class="btn-primary btn-sm" onclick="DiscoverPage.applyFilters()">Apply Filters</button>
        <button class="btn-secondary btn-sm" onclick="DiscoverPage.resetFilters()">Reset All</button>
      </div>
    </div>`;
  },

  setFilter(key, value) {
    this.state[key] = value;
  },

  _castSearchTimeout: null,
  async searchCast(q) {
    this.state.castQuery = q;
    clearTimeout(this._castSearchTimeout);
    if (!q || q.length < 2) { document.getElementById('cast-results')?.classList.add('hidden'); return; }
    this._castSearchTimeout = setTimeout(async () => {
      const results = await API.searchPeople(q, 1);
      const el = document.getElementById('cast-results');
      if (!el) return;
      if (results.length) {
        el.innerHTML = results.slice(0, 8).map(p => `<div class="dropdown-item" onclick="DiscoverPage.selectCast(${p.id}, '${UI.escapeHtml(p.name).replace(/'/g, "\\'")}')">${UI.escapeHtml(p.name)}<span class="dropdown-sub">${UI.escapeHtml(p.known_for_department || '')}</span></div>`).join('');
        el.classList.remove('hidden');
      } else { el.classList.add('hidden'); }
    }, 300);
  },

  selectCast(id, name) {
    this.state.castId = id;
    this.state.castName = name;
    this.state.castQuery = '';
    document.getElementById('cast-results')?.classList.add('hidden');
    this.renderFilters();
  },

  clearCast() {
    this.state.castId = '';
    this.state.castName = '';
    this.state.castQuery = '';
    this.renderFilters();
  },

  _networkSearchTimeout: null,
  async searchNetwork(q) {
    this.state.networkQuery = q;
    clearTimeout(this._networkSearchTimeout);
    if (!q || q.length < 2) { document.getElementById('network-results')?.classList.add('hidden'); return; }
    this._networkSearchTimeout = setTimeout(async () => {
      const data = await API.tmdb('/search/company', { query: q });
      const results = data?.results || [];
      const el = document.getElementById('network-results');
      if (!el) return;
      if (results.length) {
        el.innerHTML = results.slice(0, 8).map(n => `<div class="dropdown-item" onclick="DiscoverPage.selectNetwork(${n.id}, '${UI.escapeHtml(n.name).replace(/'/g, "\\'")}')">${UI.escapeHtml(n.name)}</div>`).join('');
        el.classList.remove('hidden');
      } else { el.classList.add('hidden'); }
    }, 300);
  },

  selectNetwork(id, name) {
    this.state.networkId = id;
    this.state.networkName = name;
    this.state.networkQuery = '';
    document.getElementById('network-results')?.classList.add('hidden');
    this.renderFilters();
  },

  clearNetwork() {
    this.state.networkId = '';
    this.state.networkName = '';
    this.state.networkQuery = '';
    this.renderFilters();
  },

  applyFilters() {
    this.state.page = 1;
    this.loadContent();
  },

  resetFilters() {
    this.state.selectedGenres = [];
    this.state.sortBy = '';
    this.state.yearFrom = '';
    this.state.yearTo = '';
    this.state.language = '';
    this.state.voteMin = '';
    this.state.voteMax = '';
    this.state.castId = '';
    this.state.castName = '';
    this.state.castQuery = '';
    this.state.networkId = '';
    this.state.networkName = '';
    this.state.networkQuery = '';
    this.state.seasonsMin = '';
    this.state.seasonsMax = '';
    this.state.runtimeMin = '';
    this.state.runtimeMax = '';
    this.state.page = 1;
    this.renderFilters();
    this.loadGenres();
    this.loadContent();
  },

  async loadWatchedIds() {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const watched = await Services.getWatched(uid);
      const ids = new Set(watched.map(w => String(w.tmdbId || w.mediaId || w.showId || w.id)).filter(Boolean));
      this.state.watchedIds = ids;
      document.querySelectorAll('.media-card[data-media-id]').forEach(card => {
        if (ids.has(String(card.dataset.mediaId))) {
          card.classList.add('is-watched');
          if (!card.querySelector('.watched-overlay')) card.insertAdjacentHTML('afterbegin', '<div class="watched-overlay">Watched</div>');
        }
      });
      if (this.state.hideWatched) this.loadContent();
    } catch (_) {}
  },

  async loadPlexDots() {
    if (!Services.plex.isConnected) return;
    try {
      const library = Services.plex.getLibrary();
      const ids = new Set(library.map(p => String(p.tmdbId)).filter(Boolean));
      this.state.plexIds = ids;
      document.querySelectorAll('.media-card[data-media-id]').forEach(card => {
        if (ids.has(card.dataset.mediaId) && !card.querySelector('.plex-card-badge')) {
          card.insertAdjacentHTML('afterbegin', '<span class="plex-card-badge">▶</span>');
        }
      });
    } catch (_) {}
  },

  async loadFriendActivityDots() {
    try {
      const friends = await Services.getFriends();
      const fids = friends.slice(0, 15).map(f => f.friendId || f.uid || f.docId);
      if (!fids.length) return;
      const activities = await Services.getActivityFeed(fids);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recent = activities.filter(a => (a.createdAt || 0) > weekAgo);
      const ids = new Set();
      recent.forEach(a => { const mid = String(a.mediaId || a.showId || ''); if (mid) ids.add(mid); });
      this.state.friendActivityIds = ids;
      document.querySelectorAll('.media-card[data-media-id]').forEach(card => {
        if (ids.has(card.dataset.mediaId) && !card.querySelector('.activity-dot')) {
          card.insertAdjacentHTML('afterbegin', '<span class="activity-dot"></span>');
        }
      });
    } catch (_) {}
  },

  async loadGenres() {
    if (this.state.tab === 'tv' || this.state.tab === 'movie') {
      const genres = await API.getGenres(this.state.tab);
      this.state.genres = genres;
      const el = document.getElementById('genre-chips');
      if (el) el.innerHTML = `<div class="filter-chips">${genres.map(g => `<button class="chip ${this.state.selectedGenres.includes(String(g.id)) ? 'active' : ''}" onclick="DiscoverPage.toggleGenre('${g.id}')">${UI.escapeHtml(g.name)}</button>`).join('')}</div>`;
    } else {
      const el = document.getElementById('genre-chips');
      if (el) el.innerHTML = '';
    }
  },

  async _fetchPage(page) {
    if (this.state.query) {
      let endpoint;
      if (this.state.tab === 'multi') endpoint = '/search/multi';
      else if (this.state.tab === 'person') endpoint = '/search/person';
      else if (this.state.tab === 'tv') endpoint = '/search/tv';
      else endpoint = '/search/movie';
      const data = await API.tmdb(endpoint, { query: this.state.query, page });
      return { results: data?.results || [], totalPages: data?.total_pages || 1 };
    } else if (this.state.tab === 'tv' || this.state.tab === 'movie') {
      const params = { page };
      if (this.state.selectedGenres.length) params.with_genres = this.state.selectedGenres.join(',');
      if (this.state.sortBy) params.sort_by = this.state.sortBy;
      if (this.state.language) params.with_original_language = this.state.language;
      if (this.state.voteMin) params['vote_average.gte'] = this.state.voteMin;
      if (this.state.voteMax) params['vote_average.lte'] = this.state.voteMax;
      if (this.state.castId) params.with_cast = this.state.castId;
      if (this.state.runtimeMin) params['with_runtime.gte'] = this.state.runtimeMin;
      if (this.state.runtimeMax) params['with_runtime.lte'] = this.state.runtimeMax;
      if (this.state.sortBy?.startsWith('vote_average')) params['vote_count.gte'] = 50;
      if (this.state.tab === 'tv') {
        if (this.state.yearFrom) params['first_air_date.gte'] = `${this.state.yearFrom}-01-01`;
        if (this.state.yearTo) params['first_air_date.lte'] = `${this.state.yearTo}-12-31`;
        if (this.state.networkId) params.with_networks = this.state.networkId;
      } else {
        if (this.state.yearFrom) params['primary_release_date.gte'] = `${this.state.yearFrom}-01-01`;
        if (this.state.yearTo) params['primary_release_date.lte'] = `${this.state.yearTo}-12-31`;
      }
      const hasFilters = Object.keys(params).length > 1;
      const data = hasFilters
        ? await API.tmdb(`/discover/${this.state.tab}`, params)
        : await API.tmdb(`/trending/${this.state.tab}/week`, { page });
      return { results: data?.results || [], totalPages: Math.min(data?.total_pages || 1, 500) };
    } else {
      const type = this.state.tab === 'multi' ? 'all' : this.state.tab === 'person' ? 'person' : this.state.tab;
      const data = await API.tmdb(`/trending/${type}/week`, { page });
      return { results: data?.results || [], totalPages: Math.min(data?.total_pages || 1, 500) };
    }
  },

  _setupObserver() {
    if (this.state._observer) { this.state._observer.disconnect(); this.state._observer = null; }
    const sentinel = document.getElementById('discover-sentinel');
    if (!sentinel) return;
    this.state._observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !this.state.loading && this.state.page < this.state.totalPages) {
        this.loadMoreContent();
      }
    }, { rootMargin: '300px' });
    this.state._observer.observe(sentinel);
  },

  async loadContent() {
    const el = document.getElementById('discover-results');
    if (!el) return;
    if (this.state._observer) { this.state._observer.disconnect(); this.state._observer = null; }
    this.state.page = 1;
    this.state.loading = true;
    el.innerHTML = UI.loading();
    try {
      let { results, totalPages } = await this._fetchPage(1);
      this.state.totalPages = totalPages;
      // Season filter (client-side, disable load-more when active)
      if ((this.state.seasonsMin || this.state.seasonsMax) && this.state.tab === 'tv') {
        const min = parseInt(this.state.seasonsMin) || 0;
        const max = parseInt(this.state.seasonsMax) || 999;
        const detailed = await Promise.all(results.map(r => API.getShowDetails(r.id).catch(() => null)));
        results = results.filter((r, i) => { const d = detailed[i]; if (!d) return true; const s = d.number_of_seasons || 0; return s >= min && s <= max; });
        this.state.totalPages = 1; // season filter can't paginate cleanly
      }
      this.state.results = results;
      let filtered = results;
      if (this.state.hideWatched && this.state.watchedIds.size) {
        filtered = results.filter(r => !this.state.watchedIds.has(String(r.id)));
      }
      el.innerHTML = filtered.length
        ? `<div class="media-grid" id="discover-grid">${filtered.map(item => this.renderCard(item)).join('')}</div><div id="discover-sentinel" style="height:1px;margin-bottom:20px"></div>`
        : UI.emptyState('No results', 'Try different search terms or filters');
      if (filtered.length && this.state.totalPages > 1) this._setupObserver();
      if (typeof Animate !== 'undefined') requestAnimationFrame(() => Animate.afterPageRender());
    } catch (e) {
      el.innerHTML = UI.emptyState('Error', e.message);
    }
    this.state.loading = false;
  },

  async loadMoreContent() {
    if (this.state.loading || this.state.page >= this.state.totalPages) return;
    this.state.loading = true;
    this.state.page++;
    const sentinel = document.getElementById('discover-sentinel');
    if (sentinel) sentinel.innerHTML = `<div class="load-more-spinner">${UI.icon('loader', 22)}</div>`;
    try {
      let { results } = await this._fetchPage(this.state.page);
      if (this.state.hideWatched && this.state.watchedIds.size) {
        results = results.filter(r => !this.state.watchedIds.has(String(r.id)));
      }
      const grid = document.getElementById('discover-grid');
      if (grid && results.length) grid.insertAdjacentHTML('beforeend', results.map(item => this.renderCard(item)).join(''));
      if (sentinel) sentinel.innerHTML = '';
      if (this.state.page >= this.state.totalPages && this.state._observer) {
        this.state._observer.disconnect(); this.state._observer = null;
      }
    } catch (_) {}
    this.state.loading = false;
  },

  renderCard(item) {
    const type = item.media_type || this.state.tab;
    if (type === 'person') return this.renderPersonCard(item);
    const poster = item.poster_path ? API.imageUrl(item.poster_path, 'w342') : '';
    const title = item.name || item.title || '';
    const year = (item.first_air_date || item.release_date || '').substring(0, 4);
    const hasDot = this.state.friendActivityIds.has(String(item.id));
    const hasPlex = this.state.plexIds.has(String(item.id));
    const isWatched = this.state.watchedIds.has(String(item.id));
    const vote = item.vote_average;
    return `<div class="media-card${isWatched ? ' is-watched' : ''}" data-media-id="${item.id}" onclick="App.navigate('details',{id:${item.id},type:'${type === 'multi' ? (item.media_type || 'tv') : type}'})">
      ${hasDot ? '<span class="activity-dot"></span>' : ''}
      ${hasPlex ? '<span class="plex-card-badge">▶</span>' : ''}
      ${isWatched ? '<div class="watched-overlay">Watched</div>' : ''}
      ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="poster-placeholder">${UI.icon('film', 32)}</div>`}
      ${vote ? `<span class="disc-rating-chip">${UI.icon('star', 10)} ${vote.toFixed(1)}</span>` : ''}
      <div class="card-info">
        <p class="card-title">${UI.escapeHtml(title)}</p>
        <div class="card-meta">${year ? `<span>${year}</span>` : ''}</div>
      </div>
    </div>`;
  },

  renderPersonCard(item) {
    const photo = item.profile_path ? API.imageUrl(item.profile_path, 'w185') : '';
    return `<div class="media-card person-card" onclick="App.navigate('actor-details',{id:${item.id}})">
      ${photo ? `<img src="${photo}" alt="" loading="lazy">` : `<div class="poster-placeholder">${UI.icon('user', 32)}</div>`}
      <div class="card-info"><p class="card-title">${UI.escapeHtml(item.name || '')}</p><p class="card-subtitle">${UI.escapeHtml(item.known_for_department || '')}</p></div>
    </div>`;
  },

  searchTimeout: null,
  onSearch(val) {
    this.state.query = val;
    this.state.page = 1;
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.loadContent(), 350);
    const clear = document.querySelector('.clear-btn');
    if (val && !clear) {
      const bar = document.querySelector('.search-bar');
      if (bar) { const btn = document.createElement('button'); btn.className = 'clear-btn'; btn.innerHTML = UI.icon('x', 18); btn.onclick = () => this.clearSearch(); bar.appendChild(btn); }
    } else if (!val && clear) clear.remove();
  },

  clearSearch() {
    if (this.state._observer) { this.state._observer.disconnect(); this.state._observer = null; }
    this.state.query = '';
    this.state.page = 1;
    this.state.totalPages = 1;
    const input = document.getElementById('discover-search');
    if (input) input.value = '';
    this.loadContent();
  },

  setTab(tab) {
    if (this.state._observer) { this.state._observer.disconnect(); this.state._observer = null; }
    this.state.tab = tab;
    this.state.query = '';
    this.state.selectedGenres = [];
    this.state.page = 1;
    this.state.totalPages = 1;
    this.state.showFilters = false;
    const input = document.getElementById('discover-search');
    if (input) input.value = '';
    this.render();
  },

  toggleGenre(id) {
    const idx = this.state.selectedGenres.indexOf(String(id));
    if (idx >= 0) this.state.selectedGenres.splice(idx, 1);
    else this.state.selectedGenres.push(String(id));
    this.state.page = 1;
    // Update chip active states
    document.querySelectorAll('#genre-chips .chip').forEach(c => {
      const gid = c.getAttribute('onclick')?.match(/'(\d+)'/)?.[1];
      if (gid) c.classList.toggle('active', this.state.selectedGenres.includes(gid));
    });
    this.loadContent();
  }
};
