/* ShowBoat — Show/Movie Details Page */
const DetailsPage = {
  state: { id: null, type: 'tv', details: null, credits: null, inWatchlist: false, isWatched: false, rating: 0, seasonNum: 1, episodes: [], friendActivity: [], loading: true },

  async render(params) {
    this.state = { id: params.id, type: params.type || 'tv', details: null, credits: null, inWatchlist: false, isWatched: false, rating: 0, seasonNum: 1, episodes: [], friendActivity: [], loading: true };
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      let details;
      if (this.state.type === 'tv') {
        details = await API.getShowDetails(this.state.id);
        if (!details || details.success === false) { details = await API.getMovieDetails(this.state.id); this.state.type = 'movie'; }
      } else {
        details = await API.getMovieDetails(this.state.id);
      }
      this.state.details = details;
      const [credits, inWl, isW, rat] = await Promise.all([
        API.getMediaCredits(this.state.id, this.state.type),
        Services.isInWatchlist(this.state.id).catch(() => false),
        Services.isWatched(this.state.id).catch(() => false),
        Services.getRating(this.state.id).catch(() => null)
      ]);
      this.state.credits = credits;
      this.state.inWatchlist = inWl;
      this.state.isWatched = isW;
      this.state.rating = rat || 0;
      if (this.state.type === 'tv' && details.seasons?.length) {
        const firstSeason = details.seasons.find(s => s.season_number >= 1) || details.seasons[0];
        this.state.seasonNum = firstSeason.season_number;
        await this.loadEpisodes(this.state.seasonNum);
      }
      this.loadFriendActivity();
      this.state.loading = false;
      this.draw(el);
    } catch (e) { el.innerHTML = UI.pageHeader('Details', true) + UI.emptyState('Error loading details', e.message); }
  },

  draw(el) {
    const d = this.state.details;
    if (!d) return;
    const backdrop = d.backdrop_path ? API.imageUrl(d.backdrop_path, 'original') : '';
    const poster = d.poster_path ? API.imageUrl(d.poster_path, 'w342') : '';
    const title = d.name || d.title || '';
    const year = (d.first_air_date || d.release_date || '').substring(0, 4);
    const runtime = d.episode_run_time?.[0] || d.runtime;
    const genres = (d.genres || []).map(g => g.name).join(', ');
    const status = d.status || '';
    const cast = this.state.credits?.cast?.slice(0, 20) || [];

    el.innerHTML = `
      <div class="details-page">
        <div class="details-hero" style="background-image:linear-gradient(to bottom, transparent 30%, var(--bg-primary)), url('${backdrop}')">
          <button class="back-btn-float" onclick="App.back()">${UI.icon('arrow-left', 22)}</button>
        </div>
        <div class="details-body">
          <div class="details-top">
            ${poster ? `<img src="${poster}" class="details-poster" alt="">` : ''}
            <div class="details-info">
              <h1>${UI.escapeHtml(title)}</h1>
              <div class="details-meta">
                ${year ? `<span>${year}</span>` : ''}
                ${runtime ? `<span>${runtime}m</span>` : ''}
                ${status ? `<span class="status-badge">${status}</span>` : ''}
                ${d.vote_average ? `<span>${UI.icon('star', 14)} ${d.vote_average.toFixed(1)}</span>` : ''}
              </div>
              ${genres ? `<p class="details-genres">${UI.escapeHtml(genres)}</p>` : ''}
              ${d.number_of_seasons ? `<p class="detail-seasons">${d.number_of_seasons} Season${d.number_of_seasons > 1 ? 's' : ''}</p>` : ''}
            </div>
          </div>
          <div class="actions-row">
            <button class="action-btn ${this.state.inWatchlist ? 'active' : ''}" onclick="DetailsPage.toggleWatchlist()">
              ${UI.icon(this.state.inWatchlist ? 'bookmark' : 'bookmark', 20)}
              <span>${this.state.inWatchlist ? 'In Watchlist' : 'Watchlist'}</span>
            </button>
            <button class="action-btn ${this.state.isWatched ? 'active' : ''}" onclick="DetailsPage.toggleWatched()">
              ${UI.icon('check-circle', 20)}
              <span>${this.state.isWatched ? 'Watched' : 'Mark Watched'}</span>
            </button>
            <button class="action-btn" onclick="DetailsPage.showMoreActions()">
              ${UI.icon('more-horizontal', 20)}
              <span>More</span>
            </button>
          </div>
          <div class="rating-section">
            <label>Your Rating</label>
            <div class="rating-slider-row">
              <input type="range" min="0" max="10" step="0.5" value="${this.state.rating}" class="rating-slider" oninput="DetailsPage.onRate(this.value)" id="rating-slider">
              <span class="rating-value" id="rating-val">${this.state.rating > 0 ? this.state.rating : '—'}</span>
            </div>
          </div>
          ${d.overview ? `<div class="section"><h3>Overview</h3><p class="overview-text">${UI.escapeHtml(d.overview)}</p></div>` : ''}
          ${this.state.type === 'tv' && d.seasons?.length ? this.renderSeasons(d.seasons) : ''}
          <div id="episodes-container">${this.state.episodes.length ? this.renderEpisodeList() : ''}</div>
          ${cast.length ? this.renderCast(cast) : ''}
          <div id="friend-activity-section"></div>
          ${this.renderActionButtons()}
        </div>
      </div>`;
  },

  renderSeasons(seasons) {
    const filteredSeasons = seasons.filter(s => s.season_number >= 0);
    return `<div class="section seasons-section">
      <div class="section-header"><h3>Seasons</h3></div>
      <div class="season-tabs">${filteredSeasons.map(s => `<button class="season-tab ${s.season_number === this.state.seasonNum ? 'active' : ''}" onclick="DetailsPage.selectSeason(${s.season_number})">S${s.season_number}</button>`).join('')}</div>
    </div>`;
  },

  renderEpisodeList() {
    return `<div class="episode-list">${this.state.episodes.map((ep, i) => {
      const still = ep.still_path ? API.imageUrl(ep.still_path, 'w300') : '';
      return `<div class="episode-item" onclick="DetailsPage.showEpisodeDetails(${i})">
        ${still ? `<img src="${still}" class="episode-still" alt="" loading="lazy">` : `<div class="episode-still placeholder">${UI.icon('tv', 20)}</div>`}
        <div class="episode-info">
          <p class="ep-number">E${ep.episode_number}</p>
          <p class="ep-name">${UI.escapeHtml(ep.name || `Episode ${ep.episode_number}`)}</p>
          ${ep.air_date ? `<p class="ep-date">${ep.air_date}</p>` : ''}
        </div>
        <button class="ep-watched-btn" onclick="event.stopPropagation(); DetailsPage.toggleEpisodeWatched(${ep.season_number}, ${ep.episode_number}, this)" title="Mark watched">
          ${UI.icon('check', 18)}
        </button>
      </div>`;
    }).join('')}</div>`;
  },

  renderCast(cast) {
    return `<div class="section">
      <div class="section-header"><h3>Cast</h3><button class="see-all-btn" onclick="App.navigate('cast-list',{id:${this.state.id},type:'${this.state.type}'})">See All</button></div>
      <div class="horizontal-scroll cast-row">${cast.slice(0, 10).map(c => {
        const photo = c.profile_path ? API.imageUrl(c.profile_path, 'w185') : '';
        return `<div class="cast-card" onclick="App.navigate('actor-details',{id:${c.id}})">
          ${photo ? `<img src="${photo}" alt="" loading="lazy">` : `<div class="cast-placeholder">${UI.icon('user', 24)}</div>`}
          <p class="cast-name">${UI.escapeHtml(c.name || '')}</p>
          <p class="cast-char">${UI.escapeHtml(c.character || '')}</p>
        </div>`;
      }).join('')}</div>
    </div>`;
  },

  renderActionButtons() {
    return `<div class="detail-actions">
      <button class="detail-action-btn" onclick="DetailsPage.shameFriend()">${UI.icon('thumbs-down', 18)} Shame a Friend</button>
      <button class="detail-action-btn" onclick="DetailsPage.recommendToFriend()">${UI.icon('send', 18)} Recommend</button>
      <button class="detail-action-btn" onclick="DetailsPage.addToSharedList()">${UI.icon('list', 18)} Add to List</button>
    </div>`;
  },

  async selectSeason(num) {
    this.state.seasonNum = num;
    document.querySelectorAll('.season-tab').forEach(b => b.classList.toggle('active', b.textContent === `S${num}`));
    const container = document.getElementById('episodes-container');
    if (container) container.innerHTML = UI.loading();
    await this.loadEpisodes(num);
    if (container) container.innerHTML = this.renderEpisodeList();
  },

  async loadEpisodes(seasonNum) {
    try {
      const eps = await API.getSeasonEpisodes(this.state.id, seasonNum);
      this.state.episodes = eps || [];
    } catch (_) { this.state.episodes = []; }
  },

  async toggleWatchlist() {
    const d = this.state.details;
    const item = { id: this.state.id, showId: this.state.id, showName: d.name || d.title, showPoster: d.poster_path, showType: this.state.type, addedAt: Date.now() };
    this.state.inWatchlist = !this.state.inWatchlist;
    if (this.state.inWatchlist) { await Services.addToWatchlist(item); UI.toast('Added to watchlist', 'success'); }
    else { await Services.removeFromWatchlist(this.state.id); UI.toast('Removed from watchlist', 'success'); }
    const btn = document.querySelector('.actions-row .action-btn:first-child');
    if (btn) btn.classList.toggle('active', this.state.inWatchlist);
  },

  async toggleWatched() {
    const d = this.state.details;
    if (this.state.isWatched) {
      await Services.unmarkWatched(this.state.id);
      this.state.isWatched = false;
      UI.toast('Unmarked as watched', 'success');
    } else {
      await Services.markWatched({ id: this.state.id, showId: this.state.id, showName: d.name || d.title, showPoster: d.poster_path, showType: this.state.type, watchedAt: Date.now() });
      this.state.isWatched = true;
      UI.toast('Marked as watched!', 'success');
      // Auto-resolve shames
      await Services._resolveShames(this.state.id);
    }
    const btn = document.querySelectorAll('.actions-row .action-btn')[1];
    if (btn) { btn.classList.toggle('active', this.state.isWatched); btn.querySelector('span').textContent = this.state.isWatched ? 'Watched' : 'Mark Watched'; }
  },

  async toggleEpisodeWatched(season, episode, btn) {
    const d = this.state.details;
    const isWatched = btn.classList.contains('active');
    if (isWatched) {
      await Services.unmarkWatched(`${this.state.id}_s${season}e${episode}`);
      btn.classList.remove('active');
    } else {
      await Services.markWatched({ id: `${this.state.id}_s${season}e${episode}`, showId: this.state.id, showName: d.name || d.title, showPoster: d.poster_path, showType: 'tv', season, episode, watchedAt: Date.now() });
      btn.classList.add('active');
    }
  },

  rateTimeout: null,
  onRate(val) {
    const display = document.getElementById('rating-val');
    if (display) display.textContent = val > 0 ? val : '—';
    clearTimeout(this.rateTimeout);
    this.rateTimeout = setTimeout(async () => {
      this.state.rating = parseFloat(val);
      const d = this.state.details;
      await Services.rateShow(this.state.id, { showId: this.state.id, showName: d.name || d.title, showPoster: d.poster_path, showType: this.state.type, rating: parseFloat(val), ratedAt: Date.now() });
      UI.toast(`Rated ${val}/10`, 'success');
    }, 500);
  },

  showEpisodeDetails(idx) {
    const ep = this.state.episodes[idx];
    if (!ep) return;
    const still = ep.still_path ? API.imageUrl(ep.still_path, 'w500') : '';
    UI.showModal(`
      <div class="episode-modal">
        ${still ? `<img src="${still}" class="modal-still" alt="">` : ''}
        <h3>S${ep.season_number}E${ep.episode_number}: ${UI.escapeHtml(ep.name || '')}</h3>
        ${ep.air_date ? `<p class="modal-date">${ep.air_date}</p>` : ''}
        ${ep.vote_average ? `<p class="modal-rating">${UI.icon('star', 14)} ${ep.vote_average.toFixed(1)}</p>` : ''}
        ${ep.overview ? `<p class="modal-overview">${UI.escapeHtml(ep.overview)}</p>` : ''}
      </div>`);
  },

  showMoreActions() {
    const d = this.state.details;
    UI.showModal(`
      <div class="more-actions-modal">
        <h3>More Actions</h3>
        <button class="modal-action" onclick="DetailsPage.shameFriend(); UI.closeModal();">${UI.icon('thumbs-down', 18)} Shame a Friend</button>
        <button class="modal-action" onclick="DetailsPage.recommendToFriend(); UI.closeModal();">${UI.icon('send', 18)} Recommend to Friend</button>
        <button class="modal-action" onclick="DetailsPage.addToSharedList(); UI.closeModal();">${UI.icon('list', 18)} Add to Shared List</button>
        <button class="modal-action" onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent((d.name || d.title || '') + ' trailer')}','_blank'); UI.closeModal();">${UI.icon('play', 18)} Watch Trailer</button>
      </div>`);
  },

  async shameFriend() {
    const friends = await Services.getFriends();
    if (!friends.length) { UI.toast('Add friends first!', 'error'); return; }
    const d = this.state.details;
    UI.showModal(`<div class="friend-picker">
      <h3>Shame a Friend for not watching</h3>
      <p class="modal-subtitle">${UI.escapeHtml(d.name || d.title || '')}</p>
      <div class="friend-list">${friends.map(f => `<button class="friend-pick-btn" onclick="DetailsPage.doShame('${f.friendId}','${UI.escapeHtml(f.friendUsername || '')}')">
        <div class="friend-avatar">${(f.friendUsername || '?')[0].toUpperCase()}</div>
        <span>${UI.escapeHtml(f.friendUsername || f.friendId)}</span>
      </button>`).join('')}</div>
    </div>`);
  },

  async doShame(friendId, friendUsername) {
    UI.closeModal();
    const d = this.state.details;
    await Services.shameFriend({ friendId, friendUsername, showId: this.state.id, showName: d.name || d.title, showPoster: d.poster_path, showType: this.state.type });
    UI.toast('Friend shamed!', 'success');
  },

  async recommendToFriend() {
    const friends = await Services.getFriends();
    if (!friends.length) { UI.toast('Add friends first!', 'error'); return; }
    const d = this.state.details;
    UI.showModal(`<div class="friend-picker">
      <h3>Recommend to a Friend</h3>
      <p class="modal-subtitle">${UI.escapeHtml(d.name || d.title || '')}</p>
      <div class="friend-list">${friends.map(f => `<button class="friend-pick-btn" onclick="DetailsPage.doRecommend('${f.friendId}')">
        <div class="friend-avatar">${(f.friendUsername || '?')[0].toUpperCase()}</div>
        <span>${UI.escapeHtml(f.friendUsername || f.friendId)}</span>
      </button>`).join('')}</div>
    </div>`);
  },

  async doRecommend(friendId) {
    UI.closeModal();
    const d = this.state.details;
    await Services.sendRecommendation(friendId, { showId: this.state.id, showName: d.name || d.title, showPoster: d.poster_path, showType: this.state.type });
    UI.toast('Recommendation sent!', 'success');
  },

  async addToSharedList() {
    const lists = await Services.getSharedLists();
    if (!lists.length) { UI.toast('Create a shared list first', 'info'); App.navigate('shared-lists'); return; }
    const d = this.state.details;
    UI.showModal(`<div class="list-picker">
      <h3>Add to Shared List</h3>
      <p class="modal-subtitle">${UI.escapeHtml(d.name || d.title || '')}</p>
      <div class="lists-options">${lists.map(l => `<button class="list-pick-btn" onclick="DetailsPage.doAddToList('${l.id}')">
        ${UI.icon('list', 18)} <span>${UI.escapeHtml(l.name || 'Untitled')}</span>
      </button>`).join('')}</div>
    </div>`);
  },

  async doAddToList(listId) {
    UI.closeModal();
    const d = this.state.details;
    await Services.addToSharedList(listId, { showId: this.state.id, showName: d.name || d.title, showPoster: d.poster_path, showType: this.state.type });
    UI.toast('Added to list!', 'success');
  },

  async loadFriendActivity() {
    try {
      const friends = await Services.getFriends();
      const activity = [];
      for (const f of friends.slice(0, 20)) {
        const [inWl, isW] = await Promise.all([
          Services.isInWatchlist(this.state.id, f.friendId),
          Services.isWatched(this.state.id, f.friendId)
        ]);
        if (inWl || isW) activity.push({ ...f, inWatchlist: inWl, isWatched: isW });
      }
      this.state.friendActivity = activity;
      const section = document.getElementById('friend-activity-section');
      if (section && activity.length) {
        section.innerHTML = `<div class="section"><h3>Friends Activity</h3>
          <div class="friend-activity-list">${activity.map(f => `<div class="friend-activity-item">
            <div class="friend-avatar">${(f.friendUsername || '?')[0].toUpperCase()}</div>
            <span class="friend-name">${UI.escapeHtml(f.friendUsername || '')}</span>
            <span class="friend-status ${f.isWatched ? 'watched' : 'watchlist'}">${f.isWatched ? 'Watched' : 'In Watchlist'}</span>
          </div>`).join('')}</div></div>`;
      }
    } catch (_) {}
  }
};
