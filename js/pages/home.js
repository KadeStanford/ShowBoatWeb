/* ShowBoat — Home Page */
const HomePage = {
  state: { featured: [], current: 0, timer: null, trending: { shows: [], movies: [] }, friendTrends: [], shames: [] },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      await this.loadData();
      this.draw(el);
      this.startCarousel();
    } catch (e) { el.innerHTML = UI.emptyState('Error loading home', e.message); }
  },

  async loadData() {
    const uid = auth.currentUser?.uid;
    const [trendTV, trendMov, shames] = await Promise.all([
      API.getTrending('tv'), API.getTrending('movie'),
      uid ? Services.getActiveShames().catch(() => []) : Promise.resolve([])
    ]);
    this.state.trending.shows = trendTV.slice(0, 10);
    this.state.trending.movies = trendMov.slice(0, 10);
    this.state.shames = shames.slice(0, 10);
    // Build featured from trending
    const movies = trendMov.filter(m => m.backdrop_path).slice(0, 3);
    const shows = trendTV.filter(s => s.backdrop_path).slice(0, 3);
    const combined = [];
    for (let i = 0; i < 3; i++) { if (shows[i]) combined.push({ ...shows[i], media_type: 'tv' }); if (movies[i]) combined.push({ ...movies[i], media_type: 'movie' }); }
    this.state.featured = combined.slice(0, 6);
    this.state.current = 0;
    // Fetch logos in background
    this.state.featured.forEach(async (item, i) => {
      const logo = await API.fetchLogo(item.id, item.media_type);
      if (logo) { const url = API.imageUrl(logo, 'w500'); this.state.featured[i].logoUrl = url; const el = document.getElementById(`hero-logo-${i}`); if (el) el.innerHTML = `<img src="${UI.escapeHtml(url)}" alt="" class="hero-logo-img">`; }
    });
    // Friend trends
    if (uid) this.loadFriendTrends();
  },

  async loadFriendTrends() {
    try {
      const friends = await Services.getFriends();
      const allItems = [];
      for (const f of friends.slice(0, 15)) {
        const fid = f.friendId || f.uid || f.docId;
        const fname = f.friendUsername || f.username || fid;
        const watched = await Services.getWatched(fid);
        watched.slice(0, 5).forEach(w => allItems.push({ ...w, friendName: fname }));
      }
      const counts = {};
      allItems.forEach(item => {
        const key = `${item.tmdbId || item.showId || item.id}`;
        if (!counts[key]) counts[key] = { ...item, count: 0 };
        counts[key].count++;
      });
      this.state.friendTrends = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
      const container = document.getElementById('friend-trends-list');
      if (container) container.innerHTML = this.state.friendTrends.length ? this.renderHorizontalList(this.state.friendTrends, true) : '<p class="empty-text">No friend activity yet</p>';
    } catch (_) {}
  },

  draw(el) {
    const s = this.state;
    el.innerHTML = `
      <div class="home-page">
        ${this.renderHero()}
        ${this.renderMenuGrid()}
        ${s.shames.length ? this.renderShameSection() : ''}
        ${s.friendTrends.length ? `<div class="section"><div class="section-header"><h3>Trending Among Friends</h3></div><div id="friend-trends-list" class="horizontal-scroll">${this.renderHorizontalList(s.friendTrends, true)}</div></div>` : `<div class="section" id="friend-trends-section"><div class="section-header"><h3>Trending Among Friends</h3></div><div id="friend-trends-list" class="horizontal-scroll"><p class="empty-text">Loading...</p></div></div>`}
        <div class="section">
          <div class="section-header"><h3>Trending Shows</h3><button class="see-all-btn" onclick="App.navigate('discover',{tab:'tv'})">See All</button></div>
          <div class="horizontal-scroll">${this.renderHorizontalList(s.trending.shows)}</div>
        </div>
        <div class="section">
          <div class="section-header"><h3>Trending Movies</h3><button class="see-all-btn" onclick="App.navigate('discover',{tab:'movie'})">See All</button></div>
          <div class="horizontal-scroll">${this.renderHorizontalList(s.trending.movies)}</div>
        </div>
      </div>`;
  },

  renderHero() {
    const s = this.state;
    if (!s.featured.length) return '';
    const slides = s.featured.map((item, i) => {
      const bg = item.backdrop_path ? API.imageUrl(item.backdrop_path, 'original') : '';
      const title = item.name || item.title || '';
      const year = (item.first_air_date || item.release_date || '').substring(0, 4);
      const overview = (item.overview || '').substring(0, 120);
      return `<div class="hero-slide ${i === s.current ? 'active' : ''}" data-slide="${i}" style="background-image:url('${bg}')">
        <div class="hero-slide-content">
          <div id="hero-logo-${i}" class="hero-logo-container">
            ${item.logoUrl ? `<img src="${UI.escapeHtml(item.logoUrl)}" alt="" class="hero-logo-img">` : `<h2 class="hero-title">${UI.escapeHtml(title)}</h2>`}
          </div>
          <div class="hero-meta">
            <span class="hero-type">${item.media_type === 'tv' ? 'TV Show' : 'Movie'}</span>
            ${year ? `<span class="hero-year">${year}</span>` : ''}
            ${item.vote_average ? `<span class="hero-rating">${UI.icon('star', 14)} ${item.vote_average.toFixed(1)}</span>` : ''}
          </div>
          ${overview ? `<p class="hero-overview">${UI.escapeHtml(overview)}...</p>` : ''}
        </div>
      </div>`;
    }).join('');
    const dots = s.featured.map((_, i) => `<span class="carousel-dot ${i === s.current ? 'active' : ''}" onclick="event.stopPropagation(); HomePage.goToSlide(${i})"></span>`).join('');
    return `<div class="hero-carousel" onclick="HomePage.onHeroClick()">
      <button class="hero-profile-btn" onclick="event.stopPropagation(); App.navigate('profile')">${UI.icon('user', 22)}</button>
      ${slides}
      <div class="carousel-controls">
        <button class="carousel-arrow" onclick="event.stopPropagation(); HomePage.prevSlide()">${UI.icon('chevron-left', 24)}</button>
        <button class="carousel-arrow" onclick="event.stopPropagation(); HomePage.nextSlide()">${UI.icon('chevron-right', 24)}</button>
      </div>
      <div class="carousel-dots">${dots}</div>
    </div>`;
  },

  renderMenuGrid() {
    const items = [
      { icon: 'search', label: 'Discover', page: 'discover', color: 'var(--emerald-500)' },
      { icon: 'bookmark', label: 'Watchlist', page: 'watchlist', color: 'var(--indigo-500)' },
      { icon: 'monitor', label: 'Plex', page: 'plex-connect', color: 'var(--amber-500)' },
      { icon: 'check-circle', label: 'Watched', page: 'analytics', color: 'var(--purple-500)' },
      { icon: 'activity', label: 'Activity', page: 'activity', color: 'var(--blue-500)' },
      { icon: 'list', label: 'Lists', page: 'shared-lists', color: 'var(--rose-500)' },
      { icon: 'zap', label: 'Matcher', page: 'matcher-setup', color: 'var(--orange-500)' },
      { icon: 'bar-chart-2', label: 'Stats', page: 'analytics', color: 'var(--teal-500)' }
    ];
    return `<div class="menu-grid">${items.map(i => `<button class="menu-item" onclick="App.navigate('${i.page}')"><div class="menu-icon" style="background:${i.color}20;color:${i.color}">${UI.icon(i.icon, 22)}</div><span>${i.label}</span></button>`).join('')}</div>`;
  },

  renderShameSection() {
    return `<div class="section"><div class="section-header"><h3>${UI.icon('thumbs-down', 18)} Wall of Shame</h3><button class="see-all-btn" onclick="App.navigate('wall-of-shame')">See All</button></div>
      <div class="horizontal-scroll">${this.state.shames.map(s => {
        const poster = (s.mediaPosterPath || s.poster_path || s.posterPath || s.showPoster) ? API.imageUrl(s.mediaPosterPath || s.poster_path || s.posterPath || s.showPoster, 'w185') : '';
        return `<div class="shame-card" onclick="App.navigate('details',{id:${s.mediaId || s.showId},type:'${s.mediaType || s.showType || 'tv'}'})">
          ${poster ? `<img src="${poster}" alt="" class="shame-poster">` : `<div class="shame-poster placeholder">${UI.icon('tv', 24)}</div>`}
          <div class="shame-badge">${UI.icon('thumbs-down', 12)}</div>
          <p class="shame-name">${UI.escapeHtml(s.shamedName || s.shamedUsername || '')}</p>
        </div>`;
      }).join('')}</div></div>`;
  },

  renderHorizontalList(items, isFriend) {
    return items.map(item => {
      const id = item.tmdbId || item.mediaId || item.showId || item.id;
      const type = item.media_type || item.mediaType || item.showType || 'tv';
      const posterPath = item.poster_path || item.posterPath || item.showPoster || '';
      const poster = posterPath ? API.imageUrl(posterPath, 'w185') : '';
      const title = item.name || item.title || item.showName || '';
      return `<div class="media-card-sm" onclick="App.navigate('details',{id:${id},type:'${type}'})">
        ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="poster-placeholder">${UI.icon('film', 24)}</div>`}
        <p class="card-title">${UI.escapeHtml(title)}</p>
        ${isFriend && item.friendName ? `<p class="card-subtitle">${UI.escapeHtml(item.friendName)}</p>` : ''}
      </div>`;
    }).join('');
  },

  startCarousel() {
    clearInterval(this.state.timer);
    if (this.state.featured.length <= 1) return;
    this.state.timer = setInterval(() => this.nextSlide(), 5000);
  },

  onHeroClick() {
    const item = this.state.featured[this.state.current];
    if (item) App.navigate('details', { id: item.id, type: item.media_type });
  },

  goToSlide(i) {
    if (i === this.state.current) return;
    this.state.current = i;
    document.querySelectorAll('.hero-slide').forEach(s => s.classList.toggle('active', parseInt(s.dataset.slide) === i));
    document.querySelectorAll('.carousel-dot').forEach((d, j) => d.classList.toggle('active', j === i));
    clearInterval(this.state.timer);
    this.state.timer = setInterval(() => this.nextSlide(), 5000);
  },

  prevSlide() {
    const len = this.state.featured.length;
    if (len <= 1) return;
    this.goToSlide((this.state.current - 1 + len) % len);
  },

  nextSlide() {
    const len = this.state.featured.length;
    if (len <= 1) return;
    this.goToSlide((this.state.current + 1) % len);
  },

  destroy() { clearInterval(this.state.timer); }
};
