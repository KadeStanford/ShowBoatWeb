/* ShowBoat — Show/Movie Details Page */
const DetailsPage = {
  state: { id: null, type: 'tv', details: null, credits: null, inWatchlist: false, isWatched: false, rating: 0, review: '', seasonNum: 1, episodes: [], friendActivity: [], logoUrl: null, loading: true, friendEpRatings: {}, plexItem: null, watchedEps: new Set() },

  async render(params) {
    if (!params) return;
    const rawType = params.type || 'tv';
    this.state = { id: params.id, type: rawType === 'show' ? 'tv' : rawType, details: null, credits: null, inWatchlist: false, isWatched: false, rating: 0, review: '', seasonNum: 1, episodes: [], friendActivity: [], logoUrl: null, loading: true, friendEpRatings: {}, plexItem: null, watchedEps: new Set() };
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
      const [credits, inWl, isW, rat, logo, plexItem] = await Promise.all([
        API.getMediaCredits(this.state.id, this.state.type),
        Services.isInWatchlist(this.state.id).catch(() => false),
        Services.isWatched(this.state.id, this.state.type).catch(() => false),
        Services.getRating(this.state.id).catch(() => null),
        API.fetchLogo(this.state.id, this.state.type).catch(() => null),
        Services.findInPlexHistory(this.state.id).catch(() => null)
      ]);
      this.state.credits = credits;
      this.state.inWatchlist = inWl;
      this.state.isWatched = isW;
      this.state.rating = rat?.rating || 0;
      this.state.review = rat?.review || '';
      this.state.logoUrl = logo ? API.imageUrl(logo, 'w500') : null;
      this.state.plexItem = plexItem || null;
      if (this.state.type === 'tv' && details.seasons?.length) {
        const targetSeasonNum = params.season ? Number(params.season) : null;
        const matchedSeason = targetSeasonNum ? details.seasons.find(s => s.season_number === targetSeasonNum) : null;
        const firstSeason = matchedSeason || details.seasons.find(s => s.season_number >= 1) || details.seasons[0];
        this.state.seasonNum = firstSeason.season_number;
        await this.loadEpisodes(this.state.seasonNum);
        this.state.watchedEps = await Services.getWatchedEpisodesForShow(this.state.id).catch(() => new Set());
      }
      this.loadFriendActivity();
      this.state.loading = false;
      this.draw(el);
      if (params.episode && this.state.type === 'tv') {
        requestAnimationFrame(() => this._scrollToEpisode(Number(params.episode)));
      }
      if (this.state.type === 'tv') this.loadFriendEpAvatars();
    } catch (e) { el.innerHTML = UI.pageHeader('Details', true) + UI.emptyState('Error loading details', e.message); }
  },

  draw(el) {
    const d = this.state.details;
    if (!d) return;
    const backdrop = d.backdrop_path ? API.imageUrl(d.backdrop_path, 'original') : '';
    const poster = d.poster_path ? API.imageUrl(d.poster_path, 'w500') : '';
    const title = d.name || d.title || '';
    const year = (d.first_air_date || d.release_date || '').substring(0, 4);
    const runtime = d.episode_run_time?.[0] || d.runtime;
    const genres = (d.genres || []).map(g => g.name);
    const status = d.status || '';
    const cast = this.state.credits?.cast?.slice(0, 20) || [];
    const network = d.networks?.[0]?.name || '';
    const totalEps = d.number_of_episodes || 0;

    el.innerHTML = `
      <div class="details-page">
        <div class="details-hero" style="background-image:linear-gradient(to bottom, transparent 40%, var(--bg-primary) 100%), url('${backdrop}')">
          <button class="back-btn-float" onclick="App.back()">${UI.icon('arrow-left', 22)}</button>
        </div>
        <div class="details-body">
          <div class="details-top">
            ${poster ? `<img src="${poster}" class="details-poster" alt="">` : ''}
            <div class="details-info">
              ${this.state.logoUrl ? `<img src="${UI.escapeHtml(this.state.logoUrl)}" alt="${UI.escapeHtml(title)}" class="details-logo">` : ''}
              <h1 ${this.state.logoUrl ? 'class="sr-only"' : ''}>${UI.escapeHtml(title)}</h1>
              <div class="details-meta">
                ${year ? `<span class="meta-chip">${year}</span>` : ''}
                ${runtime ? `<span class="meta-chip">${runtime}m</span>` : ''}
                ${status ? `<span class="status-badge">${status}</span>` : ''}
                ${d.vote_average ? `<span class="meta-chip rating-chip">${UI.icon('star', 14)} ${d.vote_average.toFixed(1)}</span>` : ''}
                ${this.state.plexItem ? `<span class="plex-badge" onclick="event.stopPropagation();DetailsPage._openInPlex()"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg> Play on Plex</span>` : ''}
              </div>
              ${genres.length ? `<div class="details-genres">${genres.map(g => `<span class="genre-tag">${UI.escapeHtml(g)}</span>`).join('')}</div>` : ''}
              <div class="details-stats-row">
                ${d.number_of_seasons ? `<span>${d.number_of_seasons} Season${d.number_of_seasons > 1 ? 's' : ''}</span>` : ''}
                ${totalEps ? `<span>${totalEps} Episodes</span>` : ''}
                ${network ? `<span>${UI.escapeHtml(network)}</span>` : ''}
              </div>
              <div class="actions-row">
                <button class="action-btn ${this.state.inWatchlist ? 'active' : ''}" onclick="DetailsPage.toggleWatchlist()">
                  ${UI.icon('bookmark', 20)}
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
            </div>
          </div>
          <div class="details-content-grid">
            <div class="details-main">
              <div class="rating-section">
                <h3>Your Overall Rating</h3>
                <div id="star-rating">
                  ${this.renderRating(this.state.rating)}
                </div>
                <textarea id="overall-review" class="review-input" placeholder="Write your review of the ${this.state.type === 'tv' ? 'series' : 'movie'} as a whole..." rows="3" oninput="DetailsPage._pendingReview=this.value">${UI.escapeHtml(this.state.review)}</textarea>
                <button class="save-review-btn" onclick="DetailsPage.saveOverallReview()">Save Review</button>
              </div>
              ${d.overview ? `<div class="section overview-section"><h3>Overview</h3><p class="overview-text">${UI.escapeHtml(d.overview)}</p></div>` : ''}
              ${this.state.type === 'tv' && d.seasons?.length ? this.renderSeasons(d.seasons) : ''}
              <div id="episodes-container">${this.state.episodes.length ? this.renderEpisodeList() : ''}</div>
            </div>
            <div class="details-sidebar">
              ${cast.length ? this.renderCastSidebar(cast) : ''}
              <div id="friend-activity-section"></div>
              ${this.renderActionButtons()}
            </div>
          </div>
        </div>
      </div>`;
  },

  renderRating(rating, opts = {}) {
    const { prefix = '', interactive = true, onRate = 'DetailsPage.setRating' } = opts;
    const val = Math.round(rating || 0);
    if (interactive) {
      const clearFn = onRate === 'DetailsPage.setRating' ? 'DetailsPage.clearRating()' : `DetailsPage.clearEpisodeRating()`;
      const pct = val * 10;
      return `<div class="rating-slider-row" id="rating-row-${prefix}">
        <input type="range" class="rating-slider" id="slider-${prefix}" min="0" max="10" step="1" value="${val}"
          oninput="${onRate}(parseInt(this.value))"
          style="background:linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.1) ${pct}%)">
        <span class="rating-number" id="rating-num-${prefix}">${val > 0 ? val : '—'}/10</span>
        ${val > 0 ? `<button class="unrate-btn" onclick="${clearFn}" title="Clear rating">${UI.icon('x', 14)}</button>` : ''}
      </div>`;
    }
    return `<span class="rating-badge">${val}/10</span>`;
  },

  _pendingReview: '',
  _ratingDebounceTimer: null,

  async setRating(val) {
    const rating = val;
    this.state.rating = rating;
    const numEl = document.getElementById('rating-num-');
    if (numEl) numEl.textContent = `${rating > 0 ? rating : '—'}/10`;
    const slider = document.getElementById('slider-');
    if (slider) { const pct = rating * 10; slider.style.background = `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`; }
    // Update clear button visibility
    const row = document.getElementById('rating-row-');
    if (row) { let btn = row.querySelector('.unrate-btn'); if (rating > 0 && !btn) { btn = document.createElement('button'); btn.className = 'unrate-btn'; btn.title = 'Clear rating'; btn.innerHTML = UI.icon('x', 14); btn.onclick = () => DetailsPage.clearRating(); row.appendChild(btn); } else if (rating === 0 && btn) btn.remove(); }
    // Debounce: only save after user stops sliding for 600ms
    clearTimeout(this._ratingDebounceTimer);
    this._ratingDebounceTimer = setTimeout(async () => {
      if (rating === 0) { await this.clearRating(); return; }
      const d = this.state.details;
      const review = document.getElementById('overall-review')?.value || this._pendingReview || '';
      await Services.rateMedia(this.state.id, rating, { name: d.name || d.title, posterPath: d.poster_path, mediaType: this.state.type, review });
      UI.toast(`Rated ${rating}/10`, 'success');
    }, 600);
  },

  async clearRating() {
    clearTimeout(this._ratingDebounceTimer);
    this.state.rating = 0;
    const numEl = document.getElementById('rating-num-');
    if (numEl) numEl.textContent = '—/10';
    const slider = document.getElementById('slider-');
    if (slider) { slider.value = 0; slider.style.background = `linear-gradient(to right, var(--accent) 0%, rgba(255,255,255,0.1) 0%)`; }
    const row = document.getElementById('rating-row-');
    if (row) { const btn = row.querySelector('.unrate-btn'); if (btn) btn.remove(); }
    await Services.removeRating(this.state.id);
    UI.toast('Rating cleared', 'success');
  },

  async clearEpisodeRating() {
    this._epRating = 0;
    const numEl = document.getElementById('rating-num-ep');
    if (numEl) numEl.textContent = '—/10';
    const slider = document.getElementById('slider-ep');
    if (slider) { slider.value = 0; slider.style.background = `linear-gradient(to right, var(--accent) 0%, rgba(255,255,255,0.1) 0%)`; }
    const row = document.getElementById('rating-row-ep');
    if (row) { const btn = row.querySelector('.unrate-btn'); if (btn) btn.remove(); }
  },

  async saveOverallReview() {
    const d = this.state.details;
    const review = (document.getElementById('overall-review')?.value || '').trim();
    this.state.review = review;
    await Services.rateMedia(this.state.id, this.state.rating, { name: d.name || d.title, posterPath: d.poster_path, mediaType: this.state.type, review });
    UI.toast('Review saved!', 'success');
  },

  renderSeasons(seasons) {
    const filteredSeasons = seasons.filter(s => s.season_number >= 0);
    return `<div class="section seasons-section">
      <h3>Seasons</h3>
      <div class="season-tabs">${filteredSeasons.map(s => `<button class="season-tab ${s.season_number === this.state.seasonNum ? 'active' : ''}" onclick="DetailsPage.selectSeason(${s.season_number})">S${s.season_number}</button>`).join('')}</div>
    </div>`;
  },

  renderEpisodeList() {
    const watchedSet = this.state.watchedEps || new Set();
    return `<div class="episode-list">${this.state.episodes.map((ep, i) => {
      const still = ep.still_path ? API.imageUrl(ep.still_path, 'w300') : '';
      const desc = ep.overview ? (ep.overview.length > 120 ? ep.overview.substring(0, 120) + '...' : ep.overview) : '';
      const epKey = `s${ep.season_number}_e${ep.episode_number}`;
      const friends = this.state.friendEpRatings[epKey] || [];
      const isEpWatched = watchedSet.has(epKey);
      return `<div class="episode-item" data-ep="${ep.episode_number}" onclick="DetailsPage.showEpisodeDetails(${i})">
        ${still ? `<img src="${still}" class="episode-still" alt="" loading="lazy">` : `<div class="episode-still placeholder">${UI.icon('tv', 20)}</div>`}
        <div class="episode-info">
          <p class="ep-number">E${ep.episode_number}</p>
          <p class="ep-name">${UI.escapeHtml(ep.name || `Episode ${ep.episode_number}`)}</p>
          ${ep.air_date ? `<p class="ep-date">${ep.air_date}</p>` : ''}
          ${desc ? `<p class="ep-desc">${UI.escapeHtml(desc)}</p>` : ''}
          ${friends.length ? `<div class="ep-friend-avatars" id="ep-avatars-${epKey}">${friends.slice(0, 5).map(f => 
            f.photo ? `<img src="${UI.escapeHtml(f.photo)}" alt="${UI.escapeHtml(f.name)}" title="${UI.escapeHtml(f.name)} — ${f.rating}/10" class="ep-friend-av">` 
            : `<span class="ep-friend-av" title="${UI.escapeHtml(f.name)} — ${f.rating}/10">${(f.name || '?')[0].toUpperCase()}</span>`
          ).join('')}${friends.length > 5 ? `<span class="ep-friend-av more">+${friends.length - 5}</span>` : ''}</div>` : `<div class="ep-friend-avatars" id="ep-avatars-${epKey}"></div>`}
        </div>
        <button class="ep-watched-btn${isEpWatched ? ' active' : ''}" onclick="event.stopPropagation(); DetailsPage.toggleEpisodeWatched(${ep.season_number}, ${ep.episode_number}, this)" title="Mark watched">
          ${UI.icon('check', 18)}
        </button>
      </div>`;
    }).join('')}</div>`;
  },

  renderCastSidebar(cast) {
    return `<div class="section cast-section">
      <div class="cast-header"><h3>Cast</h3><button class="see-all-btn" onclick="App.navigate('cast-list',{id:${this.state.id},type:'${this.state.type}'})">See All</button></div>
      <div class="cast-grid">${cast.slice(0, 8).map(c => {
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
    this.loadFriendEpAvatars();
  },

  async loadEpisodes(seasonNum) {
    try {
      const eps = await API.getSeasonEpisodes(this.state.id, seasonNum);
      this.state.episodes = eps || [];
    } catch (_) { this.state.episodes = []; }
  },

  async toggleWatchlist() {
    const d = this.state.details;
    const item = { id: Number(this.state.id), name: d.name || d.title, posterPath: d.poster_path, mediaType: this.state.type };
    this.state.inWatchlist = !this.state.inWatchlist;
    if (this.state.inWatchlist) { await Services.addToWatchlist(item); UI.toast('Added to watchlist', 'success'); }
    else { await Services.removeFromWatchlist(this.state.id); UI.toast('Removed from watchlist', 'success'); }
    const btn = document.querySelector('.actions-row .action-btn:first-child');
    if (btn) btn.classList.toggle('active', this.state.inWatchlist);
  },

  async toggleWatched() {
    const d = this.state.details;
    if (this.state.isWatched) {
      await Services.markUnwatched(this.state.id, this.state.type);
      // Also remove all episode watched entries for TV shows
      if (this.state.type === 'tv') {
        Services.markAllEpisodesUnwatched(this.state.id).catch(() => {});
        document.querySelectorAll('.ep-watched-btn').forEach(b => b.classList.remove('active'));
        this.state.watchedEps = new Set();
      }
      this.state.isWatched = false;
      UI.toast('Unmarked as watched', 'success');
    } else {
      await Services.markWatched(this.state.id, this.state.type, null, null, { name: d.name || d.title, posterPath: d.poster_path });
      this.state.isWatched = true;
      UI.toast('Marked as watched!', 'success');
      // For TV shows, also mark all episodes as watched in the background
      if (this.state.type === 'tv' && d.seasons?.length) {
        const seasons = d.seasons.filter(s => s.season_number >= 1);
        Services.markAllEpisodesWatched(this.state.id, { name: d.name, posterPath: d.poster_path }, seasons).catch(() => {});
        // Update all visible episode watch buttons
        document.querySelectorAll('.ep-watched-btn').forEach(b => b.classList.add('active'));
      }
    }
    const btn = document.querySelectorAll('.actions-row .action-btn')[1];
    if (btn) { btn.classList.toggle('active', this.state.isWatched); btn.querySelector('span').textContent = this.state.isWatched ? 'Watched' : 'Mark Watched'; }
  },

  async toggleEpisodeWatched(season, episode, btn) {
    const d = this.state.details;
    const isWatched = btn.classList.contains('active');
    const epObj = this.state.episodes.find(e => e.season_number === season && e.episode_number === episode);
    if (isWatched) {
      await Services.markUnwatched(this.state.id, 'tv', season, episode);
      btn.classList.remove('active');
      this.state.watchedEps.delete(`s${season}_e${episode}`);
    } else {
      await Services.markWatched(this.state.id, 'tv', season, episode, {
        name: d.name || d.title, posterPath: d.poster_path, episodeName: epObj?.name || ''
      });
      btn.classList.add('active');
      this.state.watchedEps.add(`s${season}_e${episode}`);
      // Auto-mark show as watched if all episodes are now watched
      const totalEps = d.number_of_episodes || 0;
      if (totalEps > 0 && this.state.watchedEps.size >= totalEps && !this.state.isWatched) {
        await Services.markWatched(this.state.id, this.state.type, null, null, { name: d.name || d.title, posterPath: d.poster_path });
        this.state.isWatched = true;
        const showBtn = document.querySelectorAll('.actions-row .action-btn')[1];
        if (showBtn) { showBtn.classList.add('active'); showBtn.querySelector('span').textContent = 'Watched'; }
      }
    }
  },

  async setEpisodeRating(val) {
    this._epRating = val;
    const numEl = document.getElementById('rating-num-ep');
    if (numEl) numEl.textContent = `${val > 0 ? val : '—'}/10`;
    const slider = document.getElementById('slider-ep');
    if (slider) { const pct = val * 10; slider.style.background = `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`; }
  },

  showEpisodeDetails(idx) {
    const ep = this.state.episodes[idx];
    if (!ep) return;
    this._epRating = 0;
    this._epIdx = idx;
    this._epComment = '';
    const still = ep.still_path ? API.imageUrl(ep.still_path, 'w780') : '';
    const heroImg = still || (this.state.details.backdrop_path ? API.imageUrl(this.state.details.backdrop_path, 'w780') : '');
    const d = this.state.details;
    const showTitle = d.name || d.title || '';
    const logoHtml = this.state.logoUrl
      ? `<img src="${UI.escapeHtml(this.state.logoUrl)}" alt="${UI.escapeHtml(showTitle)}" class="ep-modal-logo">`
      : `<p class="ep-modal-show">${UI.escapeHtml(showTitle)}</p>`;

    UI.showModal(`
      <div class="ep-modal-full">
        <div class="ep-modal-hero" ${heroImg ? `style="background-image:linear-gradient(to bottom, rgba(15,23,42,0) 20%, rgba(15,23,42,0.85) 80%, #0f172a 100%), url('${heroImg}'); background-size:cover; background-position:center top;"` : ''}>
          <div class="ep-modal-hero-info">
            ${logoHtml}
            <h2>S${ep.season_number}E${ep.episode_number}: ${UI.escapeHtml(ep.name || '')}</h2>
            <div class="ep-modal-meta">
              ${ep.air_date ? `<span>${ep.air_date}</span>` : ''}
              ${ep.vote_average ? `<span>${UI.icon('star', 14)} ${ep.vote_average.toFixed(1)} TMDB</span>` : ''}
              ${ep.runtime ? `<span>${ep.runtime}m</span>` : ''}
            </div>
          </div>
        </div>
        <div class="ep-modal-tabs">
          <button class="ep-tab active" onclick="DetailsPage.switchEpTab('details')">Details</button>
          <button class="ep-tab" onclick="DetailsPage.switchEpTab('review')">Your Review</button>
          <button class="ep-tab" onclick="DetailsPage.switchEpTab('friends')">Friends</button>
        </div>
        <div class="ep-modal-content">
          <div id="ep-tab-details" class="ep-tab-panel active">
            ${ep.overview ? `<p class="ep-overview">${UI.escapeHtml(ep.overview)}</p>` : '<p class="ep-overview muted">No overview available.</p>'}
          </div>
          <div id="ep-tab-review" class="ep-tab-panel">
            <div class="ep-review-form">
              <label>Your Rating</label>
              <div id="ep-star-rating">
                ${this.renderRating(0, { prefix: 'ep', onRate: 'DetailsPage.setEpisodeRating' })}
              </div>
              <label>Your Thoughts</label>
              <textarea id="ep-comment" class="ep-comment-input" placeholder="What did you think of this episode?" rows="4"></textarea>
              <button class="ep-save-btn" onclick="DetailsPage.saveEpisodeRating()">Save Rating</button>
            </div>
          </div>
          <div id="ep-tab-friends" class="ep-tab-panel">
            <div id="ep-friends-ratings">${UI.loading()}</div>
          </div>
        </div>
      </div>`);
    this._loadEpisodeRating(ep.season_number, ep.episode_number);
    this._loadFriendEpisodeRatings(ep.season_number, ep.episode_number);
  },

  switchEpTab(tab) {
    document.querySelectorAll('.ep-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ep-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.ep-tab-panel#ep-tab-${tab}`)?.classList.add('active');
    const tabs = document.querySelectorAll('.ep-tab');
    const idx = tab === 'details' ? 0 : tab === 'review' ? 1 : 2;
    tabs[idx]?.classList.add('active');
  },

  async _loadEpisodeRating(season, episode) {
    try {
      const existing = await Services.getEpisodeRating(this.state.id, season, episode);
      if (existing) {
        this._epRating = existing.rating || 0;
        const container = document.getElementById('ep-star-rating');
        if (container) container.innerHTML = this.renderRating(this._epRating, { prefix: 'ep', onRate: 'DetailsPage.setEpisodeRating' });
        const comment = document.getElementById('ep-comment');
        if (comment && existing.comment) comment.value = existing.comment;
      }
    } catch (_) {}
  },

  async saveEpisodeRating() {
    const ep = this.state.episodes[this._epIdx];
    if (!ep) return;
    if (!this._epRating || this._epRating === 0) {
      await Services.removeEpisodeRating(this.state.id, ep.season_number, ep.episode_number);
      UI.toast('Episode rating cleared', 'success');
      return;
    }
    const comment = (document.getElementById('ep-comment')?.value || '').trim();
    const d = this.state.details;
    await Services.rateEpisode(this.state.id, ep.season_number, ep.episode_number, this._epRating, comment, {
      showName: d.name || d.title, posterPath: d.poster_path, episodeName: ep.name
    });
    UI.toast('Episode rating saved!', 'success');
  },

  async _loadFriendEpisodeRatings(season, episode) {
    try {
      const friends = await Services.getFriends();
      const ratings = [];
      const docId = `${this.state.id}_s${season}_e${episode}`;
      for (const f of friends.slice(0, 15)) {
        const fid = f.uid || f.docId;
        const fname = f.username || fid;
        const fPhoto = f.photoURL || null;
        const r = await Services.getEpisodeRating(this.state.id, season, episode, fid).catch(() => null);
        if (r) {
          const reactions = await Services.getReactions(fid, docId).catch(() => []);
          ratings.push({ ...r, friendId: fid, friendName: fname, friendPhoto: fPhoto, docId, reactions });
        }
      }
      const el = document.getElementById('ep-friends-ratings');
      if (!el) return;
      if (!ratings.length) {
        el.innerHTML = `<div class="ep-no-friends">No friends have rated this episode yet.</div>`;
        return;
      }
      const currentUid = auth.currentUser?.uid;
      el.innerHTML = ratings.map(r => {
        const myReaction = r.reactions.find(rx => rx.id === currentUid);
        const reactionCounts = {};
        r.reactions.forEach(rx => { reactionCounts[rx.emoji] = (reactionCounts[rx.emoji] || 0) + 1; });
        return `<div class="ep-friend-card">
          <div class="ep-friend-card-header">
            <div class="friend-avatar lg">${r.friendPhoto ? `<img src="${UI.escapeHtml(r.friendPhoto)}" alt="">` : (r.friendName || '?')[0].toUpperCase()}</div>
            <div class="ep-friend-card-info">
              <strong>${UI.escapeHtml(r.friendName)}</strong>
              <div class="ep-friend-card-rating">${this.renderRating(r.rating, { interactive: false })}</div>
            </div>
          </div>
          ${r.comment ? `<p class="ep-friend-card-comment">"${UI.escapeHtml(r.comment)}"</p>` : ''}
          <div class="reaction-bar">
            <div class="reaction-pills">${Object.entries(reactionCounts).map(([em, cnt]) =>
              `<span class="reaction-pill ${myReaction?.emoji === em ? 'mine' : ''}" onclick="DetailsPage.toggleReaction('${r.friendId}','${r.docId}','${em}')">${em} ${cnt}</span>`
            ).join('')}</div>
            <div class="reaction-add">
              ${['❤️','😂','🔥','👏','😢','💀'].map(em =>
                `<button class="reaction-btn ${myReaction?.emoji === em ? 'active' : ''}" onclick="DetailsPage.toggleReaction('${r.friendId}','${r.docId}','${em}')">${em}</button>`
              ).join('')}
            </div>
          </div>
          ${r.ratedAt ? `<p class="ep-friend-card-time">${UI.timeAgo(r.ratedAt)}</p>` : ''}
        </div>`;
      }).join('');
    } catch (_) {
      const el = document.getElementById('ep-friends-ratings');
      if (el) el.innerHTML = `<div class="ep-no-friends">Could not load friend ratings.</div>`;
    }
  },

  async toggleReaction(friendId, docId, emoji) {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    // Check if we already have this reaction
    const reactions = await Services.getReactions(friendId, docId).catch(() => []);
    const myReaction = reactions.find(r => r.id === currentUid);
    if (myReaction && myReaction.emoji === emoji) {
      await Services.removeReaction(friendId, docId);
    } else {
      await Services.addReaction(friendId, docId, emoji);
    }
    // Reload the friends tab
    const ep = this.state.episodes[this._epIdx];
    if (ep) this._loadFriendEpisodeRatings(ep.season_number, ep.episode_number);
  },

  _scrollToEpisode(epNum) {
    const el = document.querySelector(`.episode-item[data-ep="${epNum}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ep-highlight'); }
    // Auto-open the episode modal
    const idx = this.state.episodes.findIndex(ep => ep.episode_number === epNum);
    if (idx >= 0) this.showEpisodeDetails(idx);
  },

  _openInPlex() {
    const p = this.state.plexItem;
    const machineId = (p?.machineId || Services.plex.machineId || '').trim();
    const plexKey = (p?.plexKey || Services.findInPlexLibrary(this.state.id)?.plexKey || '').trim();
    if (machineId && plexKey) {
      window.open(`https://app.plex.tv/desktop/#!/server/${machineId}/details?key=${encodeURIComponent(plexKey)}`, '_blank');
    } else {
      const title = this.state.details?.name || this.state.details?.title || '';
      window.open(`https://app.plex.tv/desktop/#!/search?query=${encodeURIComponent(title)}`, '_blank');
    }
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
      <div class="friend-list">${friends.map(f => {
        const fid = f.uid || f.docId;
        const fname = f.username || fid;
        return `<button class="friend-pick-btn" onclick="DetailsPage.doShame('${fid}','${UI.escapeHtml(fname)}')">
          <div class="friend-avatar">${(fname || '?')[0].toUpperCase()}</div>
          <span>${UI.escapeHtml(fname)}</span>
        </button>`;
      }).join('')}</div>
    </div>`);
  },

  async doShame(friendId, friendName) {
    UI.closeModal();
    const d = this.state.details;
    await Services.shameFriend(friendId, friendName, null, { id: Number(this.state.id), name: d.name || d.title, mediaType: this.state.type, posterPath: d.poster_path });
    UI.toast('Friend shamed!', 'success');
  },

  async recommendToFriend() {
    const friends = await Services.getFriends();
    if (!friends.length) { UI.toast('Add friends first!', 'error'); return; }
    const d = this.state.details;
    UI.showModal(`<div class="friend-picker">
      <h3>Recommend to a Friend</h3>
      <p class="modal-subtitle">${UI.escapeHtml(d.name || d.title || '')}</p>
      <div class="friend-list">${friends.map(f => {
        const fid = f.uid || f.docId;
        const fname = f.username || fid;
        return `<button class="friend-pick-btn" onclick="DetailsPage.doRecommend('${fid}')">
          <div class="friend-avatar">${(fname || '?')[0].toUpperCase()}</div>
          <span>${UI.escapeHtml(fname)}</span>
        </button>`;
      }).join('')}</div>
    </div>`);
  },

  async doRecommend(friendId) {
    UI.closeModal();
    const d = this.state.details;
    await Services.sendRecommendation(friendId, { id: Number(this.state.id), name: d.name || d.title, mediaType: this.state.type, posterPath: d.poster_path });
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
    await Services.addToSharedList(listId, { id: Number(this.state.id), name: d.name || d.title, mediaType: this.state.type, posterPath: d.poster_path });
    UI.toast('Added to list!', 'success');
  },

  async loadFriendEpAvatars() {
    try {
      const friends = await Services.getFriends();
      const map = {};
      for (const f of friends.slice(0, 15)) {
        const fid = f.uid || f.docId;
        const fname = f.username || fid;
        const fPhoto = f.photoURL || null;
        const ratings = await Services.getAllEpisodeRatingsForShow(this.state.id, fid).catch(() => []);
        ratings.forEach(r => {
          const key = `s${r.seasonNumber}_e${r.episodeNumber}`;
          if (!map[key]) map[key] = [];
          map[key].push({ id: fid, name: fname, photo: fPhoto, rating: r.rating || 0 });
        });
      }
      this.state.friendEpRatings = map;
      // Inject avatars into already-rendered episode items
      Object.entries(map).forEach(([key, friends]) => {
        const el = document.getElementById(`ep-avatars-${key}`);
        if (!el || el.childElementCount > 0) return;
        el.innerHTML = friends.slice(0, 5).map(f =>
          f.photo ? `<img src="${UI.escapeHtml(f.photo)}" alt="${UI.escapeHtml(f.name)}" title="${UI.escapeHtml(f.name)} — ${f.rating}/10" class="ep-friend-av">` 
            : `<span class="ep-friend-av" title="${UI.escapeHtml(f.name)} — ${f.rating}/10">${(f.name || '?')[0].toUpperCase()}</span>`
        ).join('') + (friends.length > 5 ? `<span class="ep-friend-av more">+${friends.length - 5}</span>` : '');
      });
    } catch (_) {}
  },

  async loadFriendActivity() {
    try {
      const friends = await Services.getFriends();
      const activity = [];
      for (const f of friends.slice(0, 10)) {
        const fid = f.uid || f.docId;
        const fname = f.username || fid;
        const [wl, w, rat] = await Promise.all([
          Services.getWatchlist(fid).catch(() => []),
          Services.getWatched(fid).catch(() => []),
          Services.getRating(this.state.id).catch(() => null)
        ]);
        const inWl = wl.some(item => String(item.id || item.tmdbId) === String(this.state.id));
        const isW = w.some(item => String(item.tmdbId) === String(this.state.id));
        if (inWl || isW || rat) activity.push({ fid, fname, inWatchlist: inWl, isWatched: isW, rating: rat?.rating });
      }
      // Also load friend episode ratings for this show
      const epRatings = [];
      for (const f of friends.slice(0, 10)) {
        const fid = f.uid || f.docId;
        const fname = f.username || fid;
        const ratings = await Services.getAllEpisodeRatingsForShow(this.state.id, fid).catch(() => []);
        ratings.forEach(r => epRatings.push({ ...r, fname }));
      }
      this.state.friendActivity = activity;
      const section = document.getElementById('friend-activity-section');
      if (section && (activity.length || epRatings.length)) {
        section.innerHTML = `<div class="section"><h3>Friends</h3>
          ${activity.length ? `<div class="friend-activity-list">${activity.map(f => `<div class="friend-activity-item">
            <div class="friend-avatar">${(f.fname || '?')[0].toUpperCase()}</div>
            <div class="friend-activity-details">
              <span class="friend-name">${UI.escapeHtml(f.fname)}</span>
              <span class="friend-status ${f.isWatched ? 'watched' : 'watchlist'}">${f.isWatched ? 'Watched' : f.inWatchlist ? 'In Watchlist' : ''}${f.rating ? ` · ${f.rating}/10` : ''}</span>
            </div>
          </div>`).join('')}</div>` : ''}
          ${epRatings.length ? `<h4 class="friend-ep-header">Episode Reviews</h4>
          <div class="friend-ep-reviews">${epRatings.slice(0, 8).map(r => `<div class="friend-ep-review-item">
            <strong>${UI.escapeHtml(r.fname)}</strong>
            <span class="friend-ep-tag">S${r.seasonNumber}E${r.episodeNumber}</span>
            <span class="friend-ep-score">${r.rating}/10</span>
            ${r.comment ? `<p class="friend-ep-comment">${UI.escapeHtml(r.comment.length > 80 ? r.comment.substring(0, 80) + '...' : r.comment)}</p>` : ''}
          </div>`).join('')}</div>` : ''}
        </div>`;
      }
    } catch (_) {}
  }
};
