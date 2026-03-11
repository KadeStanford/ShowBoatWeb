/* ShowBoat — Watchlist Page */
const WatchlistPage = {
  state: { items: [], tab: 'all', loading: true },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="watchlist-page">
      ${UI.pageHeader('Watchlist', false)}
      <div class="filter-tabs">
        ${['all', 'tv', 'movie'].map(t => `<button class="filter-tab ${this.state.tab === t ? 'active' : ''}" onclick="WatchlistPage.setTab('${t}')">${t === 'all' ? 'All' : t === 'tv' ? 'TV Shows' : 'Movies'}</button>`).join('')}
      </div>
      <div id="watchlist-content">${UI.loading()}</div>
    </div>`;
    await this.loadData();
  },

  async loadData() {
    this.state.loading = true;
    try {
      this.state.items = await Services.getWatchlist();
      this.drawList();
    } catch (e) {
      document.getElementById('watchlist-content').innerHTML = UI.emptyState('Error', e.message);
    }
    this.state.loading = false;
  },

  drawList() {
    const el = document.getElementById('watchlist-content');
    if (!el) return;
    let items = this.state.items;
    if (this.state.tab !== 'all') items = items.filter(i => (i.showType || i.type) === this.state.tab);

    if (!items.length) {
      el.innerHTML = UI.emptyState('No items', this.state.tab === 'all' ? 'Your watchlist is empty' : `No ${this.state.tab === 'tv' ? 'TV shows' : 'movies'} in your watchlist`);
      return;
    }
    el.innerHTML = `<div class="watchlist-items">${items.map(item => {
      const posterPath = item.poster_path || item.posterPath || item.showPoster || '';
      const poster = posterPath ? API.imageUrl(posterPath, 'w185') : '';
      const type = item.showType || item.type || 'tv';
      return `<div class="watchlist-item" onclick="App.navigate('details',{id:${item.showId || item.id},type:'${type}'})">
        ${poster ? `<img src="${poster}" class="wl-poster" alt="" loading="lazy">` : `<div class="wl-poster placeholder">${UI.icon('film', 24)}</div>`}
        <div class="wl-info">
          <p class="wl-title">${UI.escapeHtml(item.showName || '')}</p>
          <p class="wl-type">${type === 'tv' ? 'TV Show' : 'Movie'}</p>
          ${item.addedAt ? `<p class="wl-date">Added ${UI.timeAgo(item.addedAt)}</p>` : ''}
        </div>
        <button class="wl-remove" onclick="event.stopPropagation(); WatchlistPage.removeItem('${item.showId || item.id}')" title="Remove">
          ${UI.icon('x', 18)}
        </button>
      </div>`;
    }).join('')}</div>`;
  },

  setTab(tab) {
    this.state.tab = tab;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(b => {
      b.classList.toggle('active', b.textContent === (tab === 'all' ? 'All' : tab === 'tv' ? 'TV Shows' : 'Movies'));
    });
    this.drawList();
  },

  async removeItem(id) {
    await Services.removeFromWatchlist(id);
    this.state.items = this.state.items.filter(i => (i.showId || i.id) != id);
    this.drawList();
    UI.toast('Removed from watchlist', 'success');
  }
};
