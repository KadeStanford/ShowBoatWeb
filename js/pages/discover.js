/* ShowBoat — Discover Page */
const DiscoverPage = {
  state: { query: '', results: [], tab: 'multi', genres: [], selectedGenre: '', trending: [], page: 1, loading: false, friendActivityIds: new Set() },

  async render(params) {
    if (params?.tab) this.state.tab = params.tab;
    const el = document.getElementById('page-content');
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
      </div>
      <div id="genre-chips"></div>
      <div id="discover-results">${UI.loading()}</div>
    </div>`;
    this.loadFriendActivityDots();
    await this.loadGenres();
    await this.loadContent();
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
      // Inject dots into already-rendered cards
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
      if (el) el.innerHTML = `<div class="filter-chips"><button class="chip ${!this.state.selectedGenre ? 'active' : ''}" onclick="DiscoverPage.setGenre('')">All</button>${genres.map(g => `<button class="chip ${this.state.selectedGenre == g.id ? 'active' : ''}" onclick="DiscoverPage.setGenre('${g.id}')">${UI.escapeHtml(g.name)}</button>`).join('')}</div>`;
    } else {
      document.getElementById('genre-chips').innerHTML = '';
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
      } else if (this.state.selectedGenre) {
        results = await API.discoverMedia(this.state.tab, { with_genres: this.state.selectedGenre, page: this.state.page });
      } else {
        results = await API.getTrending(this.state.tab === 'multi' ? 'all' : this.state.tab === 'person' ? 'person' : this.state.tab);
      }
      this.state.results = results;
      el.innerHTML = results.length ? `<div class="media-grid">${results.map(item => this.renderCard(item)).join('')}</div>` : UI.emptyState('No results', 'Try a different search or filter');
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
    this.state.selectedGenre = '';
    this.state.page = 1;
    const input = document.getElementById('discover-search');
    if (input) input.value = '';
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.toggle('active', b.textContent === (tab === 'multi' ? 'All' : tab === 'tv' ? 'TV Shows' : tab === 'movie' ? 'Movies' : 'People')));
    this.loadGenres();
    this.loadContent();
  },

  setGenre(id) {
    this.state.selectedGenre = id;
    this.state.page = 1;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    this.loadContent();
  }
};
