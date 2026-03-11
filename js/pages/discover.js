/* ShowBoat — Discover Page */
const DiscoverPage = {
  state: {
    query: '', results: [], tab: 'multi', genres: [], selectedGenres: [],
    trending: [], page: 1, loading: false, friendActivityIds: new Set(),
    // Advanced filters
    sortBy: '', yearFrom: '', yearTo: '', language: '', voteMin: '', voteMax: '',
    castQuery: '', castId: '', castName: '', networkQuery: '', networkId: '', networkName: '',
    seasonsMin: '', seasonsMax: '', runtimeMin: '', runtimeMax: '',
    showFilters: false
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
      ${UI.pageHeader('Discover', false)}
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

  async loadContent() {
    const el = document.getElementById('discover-results');
    if (!el) return;
    this.state.loading = true;
    try {
      let results;
      if (this.state.query) {
        if (this.state.tab === 'multi') results = await API.searchMulti(this.state.query, this.state.page);
        else if (this.state.tab === 'person') results = await API.searchPeople(this.state.query, this.state.page);
        else if (this.state.tab === 'tv') results = await API.searchShows(this.state.query, this.state.page);
        else results = await API.searchMovies(this.state.query, this.state.page);
      } else if (this.state.tab === 'tv' || this.state.tab === 'movie') {
        // Build discover params from all filters
        const params = { page: this.state.page };
        if (this.state.selectedGenres.length) params.with_genres = this.state.selectedGenres.join(',');
        if (this.state.sortBy) params.sort_by = this.state.sortBy;
        if (this.state.language) params.with_original_language = this.state.language;
        if (this.state.voteMin) params['vote_average.gte'] = this.state.voteMin;
        if (this.state.voteMax) params['vote_average.lte'] = this.state.voteMax;
        if (this.state.castId) params.with_cast = this.state.castId;
        if (this.state.runtimeMin) params['with_runtime.gte'] = this.state.runtimeMin;
        if (this.state.runtimeMax) params['with_runtime.lte'] = this.state.runtimeMax;
        // Require at least some votes for rating-sorted results
        if (this.state.sortBy && this.state.sortBy.startsWith('vote_average')) params['vote_count.gte'] = 50;
        if (this.state.tab === 'tv') {
          if (this.state.yearFrom) params['first_air_date.gte'] = `${this.state.yearFrom}-01-01`;
          if (this.state.yearTo) params['first_air_date.lte'] = `${this.state.yearTo}-12-31`;
          if (this.state.networkId) params.with_networks = this.state.networkId;
        } else {
          if (this.state.yearFrom) params['primary_release_date.gte'] = `${this.state.yearFrom}-01-01`;
          if (this.state.yearTo) params['primary_release_date.lte'] = `${this.state.yearTo}-12-31`;
        }
        const hasFilters = Object.keys(params).length > 1;
        if (hasFilters) {
          results = await API.discoverMedia(this.state.tab, params);
        } else {
          results = await API.getTrending(this.state.tab);
        }
        // Client-side filter by season count if needed (TMDB discover doesn't support this natively)
        if ((this.state.seasonsMin || this.state.seasonsMax) && this.state.tab === 'tv') {
          const min = parseInt(this.state.seasonsMin) || 0;
          const max = parseInt(this.state.seasonsMax) || 999;
          // We need to fetch details for each to check season count. Filter client-side.
          const detailed = await Promise.all(results.map(r => API.getShowDetails(r.id).catch(() => null)));
          results = results.filter((r, i) => {
            const d = detailed[i];
            if (!d) return true;
            const seasons = d.number_of_seasons || 0;
            return seasons >= min && seasons <= max;
          });
        }
      } else {
        results = await API.getTrending(this.state.tab === 'multi' ? 'all' : this.state.tab === 'person' ? 'person' : this.state.tab);
      }
      this.state.results = results;
      el.innerHTML = results.length ? `<div class="media-grid">${results.map(item => this.renderCard(item)).join('')}</div>` : UI.emptyState('No results', 'Try different search terms or filters');
    } catch (e) {
      el.innerHTML = UI.emptyState('Error', e.message);
    }
    this.state.loading = false;
  },

  renderCard(item) {
    const type = item.media_type || this.state.tab;
    if (type === 'person') return this.renderPersonCard(item);
    const poster = item.poster_path ? API.imageUrl(item.poster_path, 'w342') : '';
    const title = item.name || item.title || '';
    const year = (item.first_air_date || item.release_date || '').substring(0, 4);
    const hasDot = this.state.friendActivityIds.has(String(item.id));
    return `<div class="media-card" data-media-id="${item.id}" onclick="App.navigate('details',{id:${item.id},type:'${type === 'multi' ? (item.media_type || 'tv') : type}'})">
      ${hasDot ? '<span class="activity-dot"></span>' : ''}
      ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="poster-placeholder">${UI.icon('film', 32)}</div>`}
      <div class="card-info">
        <p class="card-title">${UI.escapeHtml(title)}</p>
        <div class="card-meta">${year ? `<span>${year}</span>` : ''}${item.vote_average ? `<span>${UI.icon('star', 12)} ${item.vote_average.toFixed(1)}</span>` : ''}</div>
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
    this.state.query = '';
    this.state.page = 1;
    const input = document.getElementById('discover-search');
    if (input) input.value = '';
    this.loadContent();
  },

  setTab(tab) {
    this.state.tab = tab;
    this.state.query = '';
    this.state.selectedGenres = [];
    this.state.page = 1;
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
