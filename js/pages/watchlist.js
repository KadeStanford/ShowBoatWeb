/* ShowBoat — Watchlist Page */
const WatchlistPage = {
  state: { items: [], tab: 'all', loading: true, sharedActors: [] },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="watchlist-page">
      ${UI.pageHeader('Watchlist', false)}
      <div class="filter-tabs" style="padding:0 32px">
        ${['all', 'tv', 'movie', 'actors'].map(t => `<button class="filter-tab ${this.state.tab === t ? 'active' : ''}" onclick="WatchlistPage.setTab('${t}')">${t === 'all' ? 'All' : t === 'tv' ? 'TV Shows' : t === 'movie' ? 'Movies' : 'Shared Actors'}</button>`).join('')}
      </div>
      <div id="watchlist-content">${UI.loading()}</div>
    </div>`;
    await this.loadData();
  },

  async loadData() {
    this.state.loading = true;
    try {
      this.state.items = await Services.getWatchlist();
      if (this.state.tab === 'actors') {
        await this.loadSharedActors();
      } else {
        this.drawList();
      }
    } catch (e) {
      document.getElementById('watchlist-content').innerHTML = UI.emptyState('x', 'Error', e.message);
    }
    this.state.loading = false;
  },

  async loadSharedActors() {
    const el = document.getElementById('watchlist-content');
    if (!el) return;
    el.innerHTML = UI.loading();
    try {
      const items = this.state.items;
      if (items.length < 2) {
        el.innerHTML = UI.emptyState('users', 'Need more items', 'Add at least 2 shows or movies to find shared actors');
        return;
      }
      // Fetch credits for watchlist items (limit to 15 for performance)
      const actorMap = {};
      const itemsToCheck = items.slice(0, 15);
      await Promise.all(itemsToCheck.map(async (item) => {
        try {
          const type = item.mediaType || 'tv';
          const id = item.id;
          const credits = await API.getMediaCredits(id, type);
          const cast = (credits?.cast || []).slice(0, 20);
          cast.forEach(c => {
            if (!actorMap[c.id]) {
              actorMap[c.id] = { id: c.id, name: c.name, profile_path: c.profile_path, shows: [] };
            }
            actorMap[c.id].shows.push(item.name || '');
          });
        } catch (_) {}
      }));
      const shared = Object.values(actorMap).filter(a => a.shows.length >= 2).sort((a, b) => b.shows.length - a.shows.length);
      this.state.sharedActors = shared;
      if (!shared.length) {
        el.innerHTML = UI.emptyState('users', 'No shared actors', 'No actors appear in 2 or more of your watchlisted titles');
        return;
      }
      el.innerHTML = `<div class="cast-list" style="padding:0 32px">${shared.map(a => {
        const photo = a.profile_path ? API.imageUrl(a.profile_path, 'w185') : '';
        return `<div class="cast-list-item" onclick="App.navigate('actor-details',{id:${a.id}})">
          ${photo ? `<img src="${photo}" class="cast-photo" alt="" loading="lazy">` : `<div class="cast-photo placeholder">${UI.icon('user', 20)}</div>`}
          <div class="cast-info">
            <p class="cast-name">${UI.escapeHtml(a.name)}</p>
            <p class="cast-char">In ${a.shows.length} watchlisted titles</p>
            <p style="color:var(--slate-500);font-size:.75rem;margin-top:2px">${a.shows.slice(0, 3).map(s => UI.escapeHtml(s)).join(', ')}${a.shows.length > 3 ? '...' : ''}</p>
          </div>
          <span style="color:var(--emerald-400);font-weight:800;font-size:1.25rem;flex-shrink:0">${a.shows.length}</span>
        </div>`;
      }).join('')}</div>`;
    } catch (e) {
      el.innerHTML = UI.emptyState('x', 'Error', e.message);
    }
  },

  drawList() {
    const el = document.getElementById('watchlist-content');
    if (!el) return;
    let items = this.state.items;
    if (this.state.tab !== 'all') items = items.filter(i => (i.mediaType || i.showType || i.type) === this.state.tab);

    if (!items.length) {
      el.innerHTML = UI.emptyState('No items', this.state.tab === 'all' ? 'Your watchlist is empty' : `No ${this.state.tab === 'tv' ? 'TV shows' : 'movies'} in your watchlist`);
      return;
    }
    el.innerHTML = `<div class="watchlist-items">${items.map(item => {
      const posterPath = item.poster_path || item.posterPath || item.showPoster || '';
      const poster = posterPath ? API.imageUrl(posterPath, 'w185') : '';
      const type = item.mediaType || item.showType || item.type || 'tv';
      return `<div class="watchlist-item" onclick="App.navigate('details',{id:${item.tmdbId || item.showId || item.id},type:'${type}'})">
        ${poster ? `<img src="${poster}" class="wl-poster" alt="" loading="lazy">` : `<div class="wl-poster placeholder">${UI.icon('film', 24)}</div>`}
        <div class="wl-info">
          <p class="wl-title">${UI.escapeHtml(item.name || item.showName || '')}</p>
          <p class="wl-type">${type === 'tv' ? 'TV Show' : 'Movie'}</p>
          ${item.addedAt ? `<p class="wl-date">Added ${UI.timeAgo(item.addedAt)}</p>` : ''}
        </div>
        <button class="wl-remove" onclick="event.stopPropagation(); WatchlistPage.removeItem('${item.tmdbId || item.showId || item.id}')" title="Remove">
          ${UI.icon('x', 18)}
        </button>
      </div>`;
    }).join('')}</div>`;
  },

  setTab(tab) {
    this.state.tab = tab;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(b => {
      const label = tab === 'all' ? 'All' : tab === 'tv' ? 'TV Shows' : tab === 'movie' ? 'Movies' : 'Shared Actors';
      b.classList.toggle('active', b.textContent.trim() === label);
    });
    if (tab === 'actors') {
      this.loadSharedActors();
    } else {
      this.drawList();
    }
  },

  async removeItem(id) {
    await Services.removeFromWatchlist(id);
    this.state.items = this.state.items.filter(i => (i.tmdbId || i.showId || i.id) != id);
    this.drawList();
    UI.toast('Removed from watchlist', 'success');
  }
};
