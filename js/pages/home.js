/* ShowBoat — Home Page */
const HomePage = {
  state: { featured: [], current: 0, timer: null, trending: { shows: [], movies: [] }, friendTrends: [], shames: [], friendActivityIds: new Set(), plexIds: new Set(), personalRecs: null, plexSessions: [], _plexServer: null, _plexTimer: null, _plexFetchedAt: {}, _plexHomeTick: null },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      await this.loadData();
      this.draw(el);
      this.startCarousel();
      if (auth.currentUser) this.loadKeepWatching();
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
    // Friend trends + activity dots + personal recs + plex sessions
    if (uid) { this.loadFriendTrends(); this.loadFriendActivityDots(); this.loadPersonalRecs(); this.loadPlexSessions(); this.loadPlexDots(); }
  },

  async loadPlexDots() {
    if (!Services.plex.isConnected) return;
    try {
      const library = Services.plex.getLibrary();
      const ids = new Set(library.map(p => String(p.tmdbId)).filter(Boolean));
      this.state.plexIds = ids;
      document.querySelectorAll('.media-card-sm[data-media-id]').forEach(card => {
        if (ids.has(card.dataset.mediaId) && !card.querySelector('.plex-card-badge')) {
          card.insertAdjacentHTML('afterbegin', '<span class="plex-card-badge"><svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#E5A00D"/><path fill="#1F1F1F" d="M9 7h4.5a3.5 3.5 0 0 1 0 7H11v3H9V7zm2 2v3h2.5a1.5 1.5 0 0 0 0-3H11z"/></svg></span>');
        }
      });
    } catch (_) {}
  },

  async loadPlexSessions() {
    if (!Services.plex.isConnected) return;
    try {
      const token = Services.plex.token;
      if (!this.state._plexServer) {
        const resources = await PlexAPI.getResources(token);
        if (!resources) return;
        this.state._plexServer = resources.find(r => r.provides?.includes('server'));
      }
      if (!this.state._plexServer) return;
      const data = await PlexAPI.serverFetch(token, this.state._plexServer, '/status/sessions');
      const sessions = data?.MediaContainer?.Metadata || [];
      const fetchedAt = Date.now();
      sessions.forEach(s => { this.state._plexFetchedAt[s.ratingKey] = fetchedAt; });
      this.state.plexSessions = sessions;
      this._patchPlexSection();
      this._startPlexHomeTick();
      // Poll every 10s while home page is active
      if (!this.state._plexTimer) {
        this.state._plexTimer = setInterval(() => {
          if (document.getElementById('plex-now-playing-home')) {
            this.loadPlexSessions();
          } else {
            clearInterval(this.state._plexTimer);
            this.state._plexTimer = null;
            this._stopPlexHomeTick();
          }
        }, 10000);
      }
    } catch (_) {}
  },

  _patchPlexSection() {
    const sec = document.getElementById('plex-now-playing-home');
    if (!sec) return;
    const sessions = this.state.plexSessions;
    if (!sessions.length) {
      sec.style.display = 'none';
      return;
    }
    sec.style.display = '';
    sec.innerHTML = `
      <div class="section-header">
        <h3>${UI.icon('monitor', 16)} Now Playing on Plex</h3>
        <button class="see-all-btn" onclick="App.navigate('plex-now-playing')">View All</button>
      </div>
      <div class="plex-home-sessions">${sessions.map(s => this._renderPlexHomeCard(s)).join('')}</div>
    `;
  },

  _renderPlexHomeCard(s) {
    const isEpisode = s.type === 'episode';
    const title = isEpisode ? (s.grandparentTitle || s.parentTitle || s.title) : s.title;
    const episodeLabel = isEpisode ? `S${s.parentIndex || '?'}E${s.index || '?'}` : (s.year || '');
    const episodeTitle = isEpisode ? (s.title || '') : '';
    const thumb = s.grandparentThumb || s.thumb || '';
    const thumbUrl = thumb
      ? `${Services.plex.serverUrl}/photo/:/transcode?width=96&height=144&url=${encodeURIComponent(thumb)}&X-Plex-Token=${Services.plex.token}`
      : '';
    const viewOffset = s.viewOffset || 0;
    const duration = s.duration || 1;
    const progress = s.duration ? Math.min(100, (viewOffset / duration) * 100) : 0;
    const fmtTime = ms => { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const sec = t % 60; const pad = n => String(n).padStart(2, '0'); return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`; };
    const elapsed = fmtTime(viewOffset);
    const remaining = fmtTime(Math.max(0, duration - viewOffset));
    const user = s.User?.title || '';
    const state = s.Player?.state || 'playing';
    const rk = s.ratingKey;
    return `<div class="plex-home-card" onclick="App.navigate('plex-now-playing')">
      ${thumbUrl
        ? `<div class="plex-home-thumb" style="background-image:url('${UI.escapeHtml(thumbUrl)}')"></div>`
        : `<div class="plex-home-thumb plex-home-thumb-ph">${UI.icon('film', 22)}</div>`}
      <div class="plex-home-info">
        <span class="plex-home-state ${state}">${state === 'paused' ? UI.icon('pause', 10) : UI.icon('play', 10)}</span>
        <p class="plex-home-title">${UI.escapeHtml(title)}</p>
        ${episodeLabel ? `<p class="plex-home-sub">${UI.escapeHtml(episodeLabel)}</p>` : ''}
        ${episodeTitle ? `<p class="plex-home-ep-title">${UI.escapeHtml(episodeTitle)}</p>` : ''}
        ${user ? `<p class="plex-home-user">${UI.escapeHtml(user)}</p>` : ''}
        <div class="plex-home-bar"><div class="plex-home-fill" id="phf-${rk}" style="width:${progress.toFixed(1)}%"></div></div>
        <div class="plex-home-times">
          <span id="phe-${rk}">${elapsed}</span>
          <span id="phr-${rk}">-${remaining}</span>
        </div>
      </div>
    </div>`;
  },

  _startPlexHomeTick() {
    this._stopPlexHomeTick();
    const fmtTime = ms => { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const sec = t % 60; const pad = n => String(n).padStart(2, '0'); return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`; };
    this.state._plexHomeTick = setInterval(() => {
      this.state.plexSessions.forEach(s => {
        const fetchedAt = this.state._plexFetchedAt[s.ratingKey];
        if (!fetchedAt) return;
        const isPaused = s.Player?.state === 'paused';
        const viewOffset = s.viewOffset || 0;
        const duration = s.duration || 1;
        const current = isPaused ? viewOffset : Math.min(duration, viewOffset + (Date.now() - fetchedAt));
        const pct = Math.min(100, (current / duration) * 100);
        const remaining = Math.max(0, duration - current);
        const rk = s.ratingKey;
        const fill = document.getElementById(`phf-${rk}`);
        const elEl = document.getElementById(`phe-${rk}`);
        const remEl = document.getElementById(`phr-${rk}`);
        if (fill) fill.style.width = pct.toFixed(1) + '%';
        if (elEl) elEl.textContent = fmtTime(current);
        if (remEl) remEl.textContent = '-' + fmtTime(remaining);
      });
    }, 1000);
  },

  _stopPlexHomeTick() {
    if (this.state._plexHomeTick) {
      clearInterval(this.state._plexHomeTick);
      this.state._plexHomeTick = null;
    }
  },

  async loadKeepWatching() {
    try {
      const shows = await Services.getKeepWatching(8);
      if (!shows.length) return;
      const sec = document.getElementById('keep-watching-section');
      const list = document.getElementById('keep-watching-list');
      if (!sec || !list) return;
      list.innerHTML = shows.map(show => {
        const poster = show.posterPath ? API.imageUrl(show.posterPath, 'w185') : '';
        const sub = `S${show.latestSeason} · E${show.latestEpisode}`;
        return `<div class="media-card-sm" onclick="App.navigate('details',{id:${show.tmdbId},type:'tv'})" style="cursor:pointer">
          ${poster ? `<img src="${UI.escapeHtml(poster)}" alt="" class="card-poster">` : '<div class="poster-placeholder"></div>'}
          <div class="card-info"><p class="card-title">${UI.escapeHtml(show.name || '')}</p><p class="card-subtitle">${sub}</p></div>
        </div>`;
      }).join('');
      sec.style.display = '';
    } catch (_) {}
  },

  async loadPersonalRecs() {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const watched = await Services.getWatched(uid);
      if (!watched.length) return;
      // Pick a random recently watched item with a TMDB id
      const candidates = watched.filter(w => (w.tmdbId || w.mediaId || w.showId) && (w.mediaType || w.showType || w.type));
      if (!candidates.length) return;
      const pick = candidates[Math.floor(Math.random() * Math.min(candidates.length, 10))];
      const id = pick.tmdbId || pick.mediaId || pick.showId;
      let type = pick.mediaType || pick.showType || pick.type || 'tv';
      if (type === 'show') type = 'tv';
      const recs = await API.getRecommendations(id, type);
      const filtered = recs.filter(r => !watched.some(w => (w.tmdbId || w.mediaId || w.showId) === r.id)).slice(0, 10);
      if (!filtered.length) return;
      this.state.personalRecs = { recs: filtered, title: pick.showName || pick.mediaTitle || pick.name || pick.title || '' };
      // Patch into DOM if already drawn
      const sec = document.getElementById('personal-recs-section');
      if (sec) {
        sec.innerHTML = `<div class="section-header"><h3>Because You Watched <em>${UI.escapeHtml(this.state.personalRecs.title)}</em></h3><button class="see-all-btn" onclick="App.navigate('discover')">See All</button></div><div class="horizontal-scroll">${this.renderHorizontalList(filtered)}</div>`;
        sec.style.display = '';
      }
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
      // Inject dots into already-rendered cards
      document.querySelectorAll('.media-card-sm[data-media-id]').forEach(card => {
        if (ids.has(card.dataset.mediaId) && !card.querySelector('.activity-dot')) {
          card.style.position = 'relative';
          card.insertAdjacentHTML('afterbegin', '<span class="activity-dot"></span>');
        }
      });
    } catch (_) {}
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
        <div class="section" id="plex-now-playing-home" style="display:none"></div>
        ${this.renderMenuGrid()}
        ${this.renderDynamicSection()}
        <div class="section" id="keep-watching-section" style="display:none">
          <div class="section-header"><h3>${UI.icon('play-circle', 16)} Keep Watching</h3><button class="see-all-btn" onclick="App.navigate('watched-history')">View All</button></div>
          <div class="horizontal-scroll" id="keep-watching-list"></div>
        </div>
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
        <div class="section" id="personal-recs-section" ${!s.personalRecs?.recs?.length ? 'style="display:none"' : ''}>
          ${s.personalRecs?.recs?.length ? `<div class="section-header"><h3>Because You Watched <em>${UI.escapeHtml(s.personalRecs.title)}</em></h3><button class="see-all-btn" onclick="App.navigate('discover')">See All</button></div><div class="horizontal-scroll">${this.renderHorizontalList(s.personalRecs.recs)}</div>` : ''}
        </div>
      </div>`;
    if (typeof Animate !== 'undefined') requestAnimationFrame(() => Animate.afterPageRender());
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
      { icon: 'flame', label: 'Wall of Shame', page: 'wall-of-shame', color: 'var(--rose-500)' },
      { icon: 'activity', label: 'Activity', page: 'activity', color: 'var(--blue-500)' },
      { icon: 'list', label: 'Lists', page: 'shared-lists', color: 'var(--teal-500)' },
      { icon: 'zap', label: 'Matcher', page: 'matcher-setup', color: 'var(--orange-500)' },
      { icon: 'bar-chart-2', label: 'Stats', page: 'analytics', color: 'var(--teal-500)' },
      { icon: 'users', label: 'Friends', page: 'friends', color: 'var(--violet-500)' },
      { icon: 'play-circle', label: 'Watched', page: 'watched-history', color: 'var(--sky-500)' },
      { icon: 'award', label: 'Badges', page: 'badges', color: 'var(--yellow-500)' },
      { icon: 'alert-circle', label: 'Report Bug', page: '__bug__', color: 'var(--rose-400)' }
    ];
    return `<div class="menu-grid">${items.map(i => {
      const onclick = i.page === '__bug__' ? 'onclick="UI.showBugReportModal()"' : `onclick="App.navigate('${i.page}')"`;
      return `<button class="menu-item" ${onclick}><div class="menu-icon" style="background:${i.color}20;color:${i.color}">${UI.icon(i.icon, 22)}</div><span>${i.label}</span></button>`;
    }).join('')}</div>`;
  },

  renderDynamicSection() {
    const s = this.state;
    const pool = [...(s.trending.shows || []), ...(s.trending.movies || [])].filter(i => i.backdrop_path);
    if (!pool.length) return '';

    // Pick a random carousel flavor once per home render session (stable via state)
    if (!s._dynLabel) {
      const flavors = [
        { label: 'Top Picks Right Now', icon: 'zap', filter: i => i.vote_average >= 7.5 },
        { label: 'Critically Acclaimed', icon: 'star', filter: i => i.vote_average >= 8.0 && i.vote_count > 300 },
        { label: 'Popular Right Now', icon: 'trending-up', filter: i => i.popularity > 100 },
        { label: 'Hidden Gems', icon: 'compass', filter: i => i.vote_average >= 7.5 && i.popularity < 80 },
        { label: 'International Hits', icon: 'globe', filter: i => i.original_language !== 'en' && i.vote_average >= 6.8 },
        { label: 'Highly Rated Drama', icon: 'award', filter: i => (i.genre_ids || []).some(g => [18, 36].includes(g)) && i.vote_average >= 7.5 },
        { label: 'Action & Adventure', icon: 'activity', filter: i => (i.genre_ids || []).some(g => [28, 12, 10759].includes(g)) },
        { label: 'Comedies Worth Watching', icon: 'smile', filter: i => (i.genre_ids || []).includes(35) && i.vote_average >= 7.0 }
      ];
      const pick = flavors[Math.floor(Math.random() * flavors.length)];
      s._dynLabel = pick.label;
      s._dynIcon = pick.icon;
      s._dynFilter = pick.filter;
    }

    let filtered = pool.filter(s._dynFilter);
    if (filtered.length < 4) filtered = pool; // fallback to full pool
    const items = filtered.sort(() => Math.random() - 0.5).slice(0, 10);
    return `<div class="section">
      <div class="section-header"><h3>${UI.icon(s._dynIcon, 16)} ${s._dynLabel}</h3><button class="see-all-btn" onclick="App.navigate('discover')">See All</button></div>
      <div class="horizontal-scroll">${this.renderHorizontalList(items)}</div>
    </div>`;
  },

  renderShameSection() {
    return `<div class="section"><div class="section-header"><h3>${UI.icon('flame', 18)} Wall of Shame</h3><button class="see-all-btn" onclick="App.navigate('wall-of-shame')">See All</button></div>
      <div class="horizontal-scroll">${this.state.shames.map(s => {
        const poster = (s.mediaPosterPath || s.poster_path || s.posterPath || s.showPoster) ? API.imageUrl(s.mediaPosterPath || s.poster_path || s.posterPath || s.showPoster, 'w185') : '';
        const sType = (s.mediaType || s.showType || 'tv') === 'show' ? 'tv' : (s.mediaType || s.showType || 'tv');
        return `<div class="shame-card" onclick="App.navigate('details',{id:${s.mediaId || s.showId},type:'${sType}'})">
          ${poster ? `<img src="${poster}" alt="" class="shame-poster">` : `<div class="shame-poster placeholder">${UI.icon('tv', 24)}</div>`}
          <div class="shame-badge">${UI.icon('flame', 12)}</div>
          <p class="shame-name">${UI.escapeHtml(s.shamedName || s.shamedUsername || '')}</p>
        </div>`;
      }).join('')}</div></div>`;
  },

  renderHorizontalList(items, isFriend) {
    return items.map(item => {
      const id = item.tmdbId || item.mediaId || item.showId || item.id;
      let type = item.media_type || item.mediaType || item.showType || 'tv';
      if (type === 'show') type = 'tv';
      const posterPath = item.poster_path || item.posterPath || item.showPoster || '';
      const poster = posterPath ? API.imageUrl(posterPath, 'w185') : '';
      const title = item.name || item.title || item.showName || '';
      const hasDot = this.state.friendActivityIds.has(String(id));
      const hasPlex = this.state.plexIds.has(String(id));
      return `<div class="media-card-sm" data-media-id="${id}" onclick="App.navigate('details',{id:${id},type:'${type}'})">
        ${hasDot ? '<span class="activity-dot"></span>' : ''}
        ${hasPlex ? '<span class="plex-card-badge"><svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#E5A00D"/><path fill="#1F1F1F" d="M9 7h4.5a3.5 3.5 0 0 1 0 7H11v3H9V7zm2 2v3h2.5a1.5 1.5 0 0 0 0-3H11z"/></svg></span>' : ''}
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

  destroy() {
    clearInterval(this.state.timer);
    clearInterval(this.state._plexTimer);
    this.state._plexTimer = null;
    this.state._plexServer = null;
  }
};
