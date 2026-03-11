/* ShowBoat — Social Pages: Friends, FriendProfile, ActivityFeed, WallOfShame */
const FriendsPage = {
  state: { friends: [], search: '', searchResults: [] },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="friends-page">
      ${UI.pageHeader('Friends', true)}
      <div class="search-container">
        <div class="search-bar">
          ${UI.icon('search', 20)}
          <input type="text" id="friend-search" placeholder="Search by username..." oninput="FriendsPage.onSearch(this.value)">
        </div>
      </div>
      <div id="search-results"></div>
      <div id="friends-list">${UI.loading()}</div>
    </div>`;
    await this.loadFriends();
  },

  async loadFriends() {
    try {
      this.state.friends = await Services.getFriends();
      // Enrich with current photoURL from each friend's profile
      const profiles = await Promise.all(
        this.state.friends.map(f => Services.getUserProfile(f.friendId || f.uid || f.docId).catch(() => null))
      );
      this.state.friends.forEach((f, i) => { if (profiles[i]?.photoURL) f.photoURL = profiles[i].photoURL; });
      this.drawFriends();
    } catch (e) { document.getElementById('friends-list').innerHTML = UI.emptyState('Error', e.message); }
  },

  drawFriends() {
    const el = document.getElementById('friends-list');
    if (!el) return;
    if (!this.state.friends.length) { el.innerHTML = UI.emptyState('No friends yet', 'Search for users to add them'); return; }
    el.innerHTML = `<div class="friend-items">${this.state.friends.map(f => {
      const fid = f.friendId || f.uid || f.docId;
      const fname = f.friendUsername || f.username || '';
      const avatarHtml = f.photoURL
        ? `<img src="${UI.escapeHtml(f.photoURL)}" class="friend-avatar friend-avatar-img" alt="">`
        : `<div class="friend-avatar">${(fname || '?')[0].toUpperCase()}</div>`;
      return `<div class="friend-item" onclick="App.navigate('friend-profile',{id:'${fid}',name:'${UI.escapeHtml(fname)}'})">
      ${avatarHtml}
      <div class="friend-info"><p class="friend-name">${UI.escapeHtml(fname || fid)}</p></div>
      <button class="friend-remove-btn" onclick="event.stopPropagation(); FriendsPage.removeFriend('${fid}')" title="Remove">${UI.icon('user-minus', 18)}</button>
    </div>`;
    }).join('')}</div>`;
  },

  searchTimeout: null,
  onSearch(val) {
    this.state.search = val.trim();
    clearTimeout(this.searchTimeout);
    if (!val.trim()) { document.getElementById('search-results').innerHTML = ''; return; }
    this.searchTimeout = setTimeout(() => this.doSearch(), 400);
  },

  async doSearch() {
    if (!this.state.search) return;
    const el = document.getElementById('search-results');
    try {
      const results = await Services.searchUsers(this.state.search);
      const uid = auth.currentUser.uid;
      const filtered = results.filter(u => u.uid !== uid);
      if (!filtered.length) { el.innerHTML = '<p class="empty-text">No users found</p>'; return; }
      const friendIds = new Set(this.state.friends.map(f => f.friendId || f.uid || f.docId));
      el.innerHTML = `<div class="search-result-items">${filtered.map(u => {
        const isFriend = friendIds.has(u.uid);
        return `<div class="friend-item">
          <div class="friend-avatar">${(u.username || '?')[0].toUpperCase()}</div>
          <div class="friend-info"><p class="friend-name">${UI.escapeHtml(u.username || u.uid)}</p></div>
          ${isFriend ? `<span class="already-friend">Friends ✓</span>` : `<button class="add-friend-btn" onclick="FriendsPage.addFriend('${u.uid}','${UI.escapeHtml(u.username || '')}')">${UI.icon('user-plus', 18)} Add</button>`}
        </div>`;
      }).join('')}</div>`;
    } catch (_) { el.innerHTML = '<p class="empty-text">Search error</p>'; }
  },

  async addFriend(id, username) {
    await Services.addFriend(id, { username });
    this.state.friends.push({ uid: id, username: username });
    UI.toast(`${username} added as friend!`, 'success');
    this.doSearch();
    this.drawFriends();
  },

  async removeFriend(id) {
    if (!confirm('Remove this friend?')) return;
    await Services.removeFriend(id);
    this.state.friends = this.state.friends.filter(f => (f.friendId || f.uid || f.docId) !== id);
    this.drawFriends();
    UI.toast('Friend removed', 'success');
  }
};

const FriendProfilePage = {
  state: { id: '', name: '', photoURL: null, watchlist: [], watched: [], ratings: [], activity: [], badges: [] },

  async render(params) {
    this.state.id = params.id;
    this.state.name = params.name || '';
    this.state.photoURL = null;
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="friend-profile-page">${UI.pageHeader('', true)}<div id="fp-content">${UI.loading()}</div></div>`;
    try {
      const uid = this.state.id;
      const [wl, w, r, profile] = await Promise.all([
        Services.getWatchlist(uid), Services.getWatched(uid), Services.getRatings(uid),
        Services.getUserProfile(uid).catch(() => null)
      ]);
      this.state.watchlist = wl;
      this.state.watched = w;
      this.state.ratings = r;
      this.state.photoURL = profile?.photoURL || null;
      if (profile?.username) this.state.name = profile.username;

      // Build stats + badges
      const friendStats = {
        watchlistCount: wl.length,
        watchedCount: w.length,
        ratingsCount: r.length,
        friendsCount: 0,
        movies: w.filter(x => x.mediaType === 'movie').length,
        episodes: w.filter(x => x.seasonNumber).length
      };
      this.state.badges = calculateBadges(friendStats).filter(b => b.earned);

      // Try to load activity
      try { const act = await Services.getActivityFeed([uid]); this.state.activity = act.slice(0, 20); } catch (_) {}

      this.draw(document.getElementById('fp-content'));
    } catch (e) {
      document.getElementById('fp-content').innerHTML = UI.emptyState('Error', e.message);
    }
  },

  draw(container) {
    const { name, photoURL, watchlist, watched, ratings, activity, badges, id } = this.state;
    const avatarHtml = photoURL
      ? `<img src="${UI.escapeHtml(photoURL)}" class="fp-avatar-img" alt="">`
      : `<div class="fp-avatar-initial">${(name || '?')[0].toUpperCase()}</div>`;

    const recentWatched = [...watched].sort((a, b) => (b.watchedAt || b.createdAt || 0) - (a.watchedAt || a.createdAt || 0)).slice(0, 10);
    const topRated = [...ratings].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);
    const recentActivity = activity.filter(a => {
      if ((a.type === 'rated' || a.type === 'rated_episode') && (!a.rating || a.rating <= 0)) return false;
      return true;
    }).slice(0, 5);

    // Taste compatibility: find overlap in top-rated genres
    const myWatched = []; // not loaded here; skip for now — the shared actors btn remains
    const totalContent = watchlist.length + watched.length;

    container.innerHTML = `
      <div class="fp-hero">
        <div class="fp-hero-avatar">${avatarHtml}</div>
        <div class="fp-hero-info">
          <h2 class="fp-name">${UI.escapeHtml(name)}</h2>
          <div class="fp-quick-stats">
            <span>${UI.icon('eye', 14)} ${watched.length} watched</span>
            <span>${UI.icon('star', 14)} ${ratings.length} rated</span>
            <span>${UI.icon('bookmark', 14)} ${watchlist.length} saved</span>
          </div>
        </div>
      </div>

      <div class="fp-body">
        ${badges.length ? `
        <div class="fp-section">
          <h3 class="fp-section-title">${UI.icon('award', 16)} Badges</h3>
          <div class="fp-badges-row">${badges.slice(0, 8).map(b => {
            const t = BADGE_TIERS[b.tier] || BADGE_TIERS.bronze;
            return `<div class="fp-badge-chip" style="border-color:${t.color}40;background:${t.bg}" title="${UI.escapeHtml(b.name)}">
              <span>${b.icon}</span>
              <span class="fp-badge-tier-dot" style="background:${t.color}"></span>
              <span class="fp-badge-chip-name">${UI.escapeHtml(b.name)}</span>
            </div>`;
          }).join('')}</div>
        </div>
        ` : ''}

        ${recentActivity.length ? `
        <div class="fp-section">
          <h3 class="fp-section-title">${UI.icon('activity', 16)} Recent Activity</h3>
          <div class="fp-activity-list">${recentActivity.map(a => {
            const poster = (a.mediaPosterPath || a.showPoster) ? API.imageUrl(a.mediaPosterPath || a.showPoster, 'w92') : '';
            const aType = (a.mediaType || a.showType || 'tv') === 'show' ? 'tv' : (a.mediaType || a.showType || 'tv');
            let verb = a.type === 'watched' ? 'watched' : a.type === 'rated' ? `rated ${a.rating}/10` : a.type === 'added_to_watchlist' ? 'saved' : a.type;
            return `<div class="fp-act-row" onclick="App.navigate('details',{id:${a.mediaId||a.showId},type:'${aType}'})">
              ${poster ? `<img src="${poster}" class="fp-act-thumb" alt="">` : `<div class="fp-act-thumb fp-act-thumb-ph">${UI.icon('film', 14)}</div>`}
              <div class="fp-act-info">
                <p class="fp-act-title">${UI.escapeHtml(a.mediaTitle || a.showName || '')}</p>
                <p class="fp-act-verb">${verb}${a.createdAt ? ` · ${UI.timeAgo(a.createdAt)}` : ''}</p>
              </div>
            </div>`;
          }).join('')}</div>
        </div>
        ` : ''}

        ${recentWatched.length ? `
        <div class="fp-section">
          <h3 class="fp-section-title">${UI.icon('eye', 16)} Recently Watched</h3>
          <div class="horizontal-scroll">${this.renderItems(recentWatched)}</div>
        </div>
        ` : ''}

        ${topRated.length ? `
        <div class="fp-section">
          <h3 class="fp-section-title">${UI.icon('star', 16)} Top Rated</h3>
          <div class="horizontal-scroll">${this.renderItems(topRated)}</div>
        </div>
        ` : ''}

        ${watchlist.length ? `
        <div class="fp-section">
          <h3 class="fp-section-title">${UI.icon('bookmark', 16)} Watchlist</h3>
          <div class="horizontal-scroll">${this.renderItems(watchlist.slice(0, 10))}</div>
        </div>
        ` : ''}

        <div class="fp-actions">
          <button class="detail-action-btn" onclick="App.navigate('shared-actors',{friendId:'${id}',friendName:'${UI.escapeHtml(name)}'})">
            ${UI.icon('users', 18)} Shared Actors
          </button>
        </div>
      </div>
    `;
  },

  renderItems(items) {
    return items.slice(0, 10).map(i => {
      const posterPath = i.poster_path || i.posterPath || i.mediaPosterPath || i.showPoster || '';
      const poster = posterPath ? API.imageUrl(posterPath, 'w185') : '';
      const fpType = (i.mediaType || i.showType || 'tv') === 'show' ? 'tv' : (i.mediaType || i.showType || 'tv');
      return `<div class="media-card-sm" onclick="App.navigate('details',{id:${i.tmdbId || i.mediaId || i.showId || i.id},type:'${fpType}'})">
        ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="poster-placeholder">${UI.icon('film', 24)}</div>`}
        <p class="card-title">${UI.escapeHtml(i.name || i.mediaTitle || i.showName || '')}</p>
        ${i.rating ? `<p class="card-subtitle">${UI.icon('star', 12)} ${i.rating}</p>` : ''}
      </div>`;
    }).join('');
  }
};


const ActivityPage = {
  state: {
    feed: [],
    seen: new Map(),
    cursors: {},
    friendUids: [],
    loading: false,
    allLoaded: false,
    _observer: null
  },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="activity-page">
      ${UI.pageHeader('Activity Feed', true)}
      <div id="feed-content"><div class="activity-feed-v2" id="feed-list"></div><div id="feed-sentinel" style="height:1px"></div><div id="feed-spinner" style="display:none">${UI.loading()}</div></div>
    </div>`;
    // Reset state
    this.state.feed = [];
    this.state.seen = new Map();
    this.state.cursors = {};
    this.state.allLoaded = false;
    this.state.loading = false;
    if (this.state._observer) { this.state._observer.disconnect(); this.state._observer = null; }

    try {
      const uid = auth.currentUser?.uid;
      const friends = uid ? await Services.getFriends() : [];
      const friendUids = friends.map(f => f.friendId || f.uid || f.docId);
      if (uid) friendUids.unshift(uid);
      this.state.friendUids = [...new Set(friendUids)];
    } catch (_) {
      this.state.friendUids = auth.currentUser?.uid ? [auth.currentUser.uid] : [];
    }

    await this._loadPage();
    this._setupObserver();
  },

  async _loadPage() {
    if (this.state.loading || this.state.allLoaded || !this.state.friendUids.length) return;
    this.state.loading = true;
    const spinner = document.getElementById('feed-spinner');
    if (spinner) spinner.style.display = '';
    try {
      const { items, cursors } = await Services.getActivityFeed(this.state.friendUids, this.state.cursors, 30);
      this.state.cursors = cursors;

      // Deduplicate globally
      const newItems = [];
      items.forEach(a => {
        const key = `${a.userId}_${a.mediaId || a.showId}_${(a.type === 'rated_episode' || a.type === 'watched_episode') ? `s${a.seasonNumber}e${a.episodeNumber}` : 'main'}`;
        if (!this.state.seen.has(key)) {
          this.state.seen.set(key, true);
          // Filter out unrated items logged as rating=0
          if ((a.type === 'rated' || a.type === 'rated_episode') && (!a.rating || a.rating <= 0)) return;
          newItems.push(a);
        }
      });

      if (!items.length) this.state.allLoaded = true;

      this.state.feed.push(...newItems);
      this._appendItems(newItems);
    } catch (e) {
      const fc = document.getElementById('feed-content');
      if (fc && !this.state.feed.length) fc.innerHTML = UI.emptyState('Error', e.message);
    } finally {
      this.state.loading = false;
      const spinner = document.getElementById('feed-spinner');
      if (spinner) spinner.style.display = 'none';
      if (!this.state.feed.length && !this.state.loading) {
        const list = document.getElementById('feed-list');
        if (list) list.innerHTML = UI.emptyState('No activity yet', 'Activity from you and your friends will appear here');
      }
    }
  },

  _appendItems(items) {
    const list = document.getElementById('feed-list');
    if (!list) return;
    const currentUid = auth.currentUser?.uid;
    list.insertAdjacentHTML('beforeend', items.map(a => this._renderCard(a, currentUid)).join(''));
  },

  _setupObserver() {
    const sentinel = document.getElementById('feed-sentinel');
    if (!sentinel) return;
    this.state._observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) this._loadPage();
    }, { rootMargin: '300px' });
    this.state._observer.observe(sentinel);
  },

  _renderCard(a, currentUid) {
    const isMine = a.userId === currentUid;
    const poster = (a.mediaPosterPath || a.showPoster) ? API.imageUrl(a.mediaPosterPath || a.showPoster, 'w185') : '';
    const isEpisode = a.type === 'rated_episode';
    const isEpWatched = a.type === 'watched_episode';
    const aType = (a.mediaType || a.showType || 'tv') === 'show' ? 'tv' : (a.mediaType || a.showType || 'tv');
    const displayName = isMine ? 'You' : (a.userName || a.username || 'Someone');

    let verb, dotClass, dotIcon;
    if (isEpisode) { verb = `rated S${a.seasonNumber || '?'}E${a.episodeNumber || '?'}`; dotClass = 'dot-rated'; dotIcon = 'star'; }
    else if (isEpWatched) { verb = `watched S${a.seasonNumber || '?'}E${a.episodeNumber || '?'}`; dotClass = 'dot-watched'; dotIcon = 'eye'; }
    else if (a.type === 'watched') { verb = 'watched'; dotClass = 'dot-watched'; dotIcon = 'eye'; }
    else if (a.type === 'rated') { verb = 'rated'; dotClass = 'dot-rated'; dotIcon = 'star'; }
    else if (a.type === 'added_to_watchlist') { verb = 'saved to watchlist'; dotClass = 'dot-watchlist'; dotIcon = 'bookmark'; }
    else if (a.type === 'shame') { verb = 'shamed'; dotClass = 'dot-shame'; dotIcon = 'flame'; }
    else { verb = a.type; dotClass = 'dot-watched'; dotIcon = 'activity'; }

    const avatarHtml = a.userPhoto
      ? `<img src="${UI.escapeHtml(a.userPhoto)}" class="act-avatar-img" alt="">`
      : `<div class="act-avatar-initial">${(a.userName || a.username || '?')[0].toUpperCase()}</div>`;

    const ratingStars = (a.type === 'rated' || isEpisode) && a.rating
      ? `<div class="act-rating-row">${Array.from({length: 5}, (_, i) => `<span class="act-star ${i < Math.round(a.rating / 2) ? 'filled' : ''}">${UI.icon('star', 12)}</span>`).join('')}<span class="act-rating-num">${a.rating}/10</span></div>`
      : '';

    const episodeRow = (isEpisode || isEpWatched) && a.episodeName
      ? `<p class="act-ep-name">${UI.escapeHtml(a.episodeName)}</p>` : '';

    return `<div class="activity-card-v2" onclick="App.navigate('details',{id:${a.mediaId || a.showId},type:'${aType}'})">
      <div class="act-avatar-col">
        <div class="act-avatar-wrap">${avatarHtml}</div>
        <div class="act-type-dot ${dotClass}">${UI.icon(dotIcon, 10)}</div>
      </div>
      <div class="act-body">
        <p class="act-headline"><strong class="act-username">${UI.escapeHtml(displayName)}</strong> <span class="act-verb">${verb}</span></p>
        <p class="act-title">${UI.escapeHtml(a.mediaTitle || a.showName || '')}</p>
        ${episodeRow}
        ${ratingStars}
        ${a.comment ? `<p class="act-comment">"${UI.escapeHtml(a.comment)}"</p>` : ''}
        ${a.createdAt ? `<p class="act-time">${UI.timeAgo(a.createdAt)}</p>` : ''}
      </div>
      ${poster ? `<div class="act-thumb" style="background-image:url('${poster}')"></div>` : ''}
    </div>`;
  }
};

const WallOfShamePage = {
  state: { received: [], sent: [], pendingAbsolutions: [], allFriends: [] },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="shame-page">${UI.pageHeader('Wall of Shame', true)}<div id="shame-content">${UI.loading()}</div></div>`;
    try {
      const [all, sent, pending, friends] = await Promise.all([
        Services.getAllShames(),
        Services.getSentShames(),
        Services.getPendingAbsolutions(),
        Services.getFriends()
      ]);
      this.state.received = all;
      this.state.sent = sent;
      this.state.pendingAbsolutions = pending;
      this.state.allFriends = friends;
      this.draw();
    } catch (e) { document.getElementById('shame-content').innerHTML = UI.emptyState('Error', e.message); }
  },

  draw() {
    const el = document.getElementById('shame-content');

    // Sections
    const myActiveShames = this.state.received.filter(s => s.status === 'active');
    const myPendingReceived = this.state.received.filter(s => s.status === 'pendingAbsolution');
    const sentActive = this.state.sent.filter(s => s.status === 'active');
    const absolvePending = this.state.pendingAbsolutions; // shames I sent where they watched it
    const recentResolved = [...this.state.received.filter(s => s.status === 'resolved'),
                           ...this.state.sent.filter(s => s.status === 'resolved')]
      .sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0)).slice(0, 10);

    el.innerHTML = `
      <div class="shame-stats">
        <div class="shame-stat"><span class="shame-stat-num">${myActiveShames.length + myPendingReceived.length}</span><span class="shame-stat-label">Active Shames on Me</span></div>
        <div class="shame-stat"><span class="shame-stat-num">${sentActive.length}</span><span class="shame-stat-label">Friends I'm Shaming</span></div>
        <div class="shame-stat"><span class="shame-stat-num">${absolvePending.length}</span><span class="shame-stat-label">Awaiting Absolution</span></div>
      </div>

      ${absolvePending.length ? `
      <div class="shame-section">
        <div class="shame-section-header">${UI.icon('bell', 16)} Awaiting Your Verdict
          <span class="shame-section-badge shame-badge-alert">${absolvePending.length}</span>
        </div>
        <div class="shame-items">${absolvePending.map(s => this._renderAbsolveCard(s)).join('')}</div>
      </div>` : ''}

      <div class="shame-section">
        <div class="shame-section-header">${UI.icon('flame', 16)} Friends I'm Shaming
          ${sentActive.length ? `<span class="shame-section-badge">${sentActive.length}</span>` : ''}
        </div>
        ${sentActive.length
          ? `<div class="shame-items">${sentActive.map(s => this._renderSentCard(s)).join('')}</div>`
          : `<p class="shame-empty-text">No active shames sent</p>`}
      </div>

      <div class="shame-section">
        <div class="shame-section-header">${UI.icon('skull', 16)} My Active Shames
          ${(myActiveShames.length + myPendingReceived.length) ? `<span class="shame-section-badge shame-badge-alert">${myActiveShames.length + myPendingReceived.length}</span>` : ''}
        </div>
        ${(myActiveShames.length + myPendingReceived.length)
          ? `<div class="shame-items">${[...myPendingReceived, ...myActiveShames].map(s => this._renderReceivedCard(s)).join('')}</div>`
          : `<p class="shame-empty-text">No active shames</p>`}
      </div>

      ${recentResolved.length ? `
      <div class="shame-section">
        <div class="shame-section-header">${UI.icon('check-circle', 16)} Recently Absolved</div>
        <div class="shame-items">${recentResolved.map(s => this._renderResolvedCard(s)).join('')}</div>
      </div>` : ''}

      <button class="shame-someone-btn" onclick="WallOfShamePage.shameFromPage()">
        ${UI.icon('flame', 20)} Shame a Friend
      </button>`;
  },

  _posterHtml(s) {
    const poster = (s.mediaPosterPath || s.showPoster) ? API.imageUrl(s.mediaPosterPath || s.showPoster, 'w185') : '';
    return poster ? `<img src="${poster}" class="shame-item-poster" alt="">` : `<div class="shame-item-poster placeholder">${UI.icon('tv', 20)}</div>`;
  },

  _renderAbsolveCard(s) {
    const shType = (s.mediaType || 'tv') === 'movie' ? 'movie' : 'tv';
    const days = s.createdAt ? Math.floor((Date.now() - s.createdAt) / 86400000) : 0;
    return `<div class="shame-list-item pending-absolution">
      <div class="shame-item-left" onclick="App.navigate('details',{id:${s.mediaId},type:'${shType}'})">
        ${this._posterHtml(s)}
        <div class="shame-item-info">
          <p class="shame-show">${UI.escapeHtml(s.mediaTitle || '')}</p>
          <p class="shame-detail"><strong>${UI.escapeHtml(s.shamedName || 'Someone')}</strong> just watched this!</p>
          <p class="shame-detail shame-verdict-prompt">Do you absolve them?</p>
          ${days > 0 ? `<span class="shame-timer">${UI.icon('clock', 12)} ${days}d</span>` : ''}
        </div>
      </div>
      <div class="shame-item-actions">
        <button class="shame-absolve-btn" onclick="event.stopPropagation(); WallOfShamePage.absolve('${s.id}')" title="Absolve">${UI.icon('check', 14)} Absolve</button>
        <button class="shame-deny-btn" onclick="event.stopPropagation(); WallOfShamePage.denyAbsolution('${s.id}')" title="Keep shame">${UI.icon('x', 14)} Keep</button>
      </div>
    </div>`;
  },

  _renderSentCard(s) {
    const shType = (s.mediaType || 'tv') === 'movie' ? 'movie' : 'tv';
    const days = s.createdAt ? Math.floor((Date.now() - s.createdAt) / 86400000) : 0;
    return `<div class="shame-list-item active sent">
      <div class="shame-item-left" onclick="App.navigate('details',{id:${s.mediaId},type:'${shType}'})">
        ${this._posterHtml(s)}
        <div class="shame-item-info">
          <p class="shame-show">${UI.escapeHtml(s.mediaTitle || '')}</p>
          <p class="shame-detail">You shamed <strong>${UI.escapeHtml(s.shamedName || 'Someone')}</strong></p>
          ${days > 0 ? `<span class="shame-timer">${UI.icon('clock', 12)} ${days}d unresolved</span>` : ''}
        </div>
      </div>
      <div class="shame-item-actions">
        <div class="shame-icon">${UI.icon('flame', 20)}</div>
      </div>
    </div>`;
  },

  _renderReceivedCard(s) {
    const shType = (s.mediaType || 'tv') === 'movie' ? 'movie' : 'tv';
    const days = s.createdAt ? Math.floor((Date.now() - s.createdAt) / 86400000) : 0;
    const isPending = s.status === 'pendingAbsolution';
    return `<div class="shame-list-item active received ${isPending ? 'pending-absolution' : ''}">
      <div class="shame-item-left" onclick="App.navigate('details',{id:${s.mediaId},type:'${shType}'})">
        ${this._posterHtml(s)}
        <div class="shame-item-info">
          <p class="shame-show">${UI.escapeHtml(s.mediaTitle || '')}</p>
          <p class="shame-detail">Shamed by <strong>${UI.escapeHtml(s.shamerName || 'Someone')}</strong></p>
          ${isPending ? `<p class="shame-detail shame-pending-note">${UI.icon('clock', 12)} Waiting for absolution...</p>` : ''}
          ${!isPending && days > 0 ? `<span class="shame-timer">${UI.icon('clock', 12)} ${days}d unresolved</span>` : ''}
        </div>
      </div>
      <div class="shame-item-actions">
        <div class="shame-icon ${isPending ? 'pending' : ''}">${UI.icon('skull', 20)}</div>
      </div>
    </div>`;
  },

  _renderResolvedCard(s) {
    const uid = auth.currentUser?.uid;
    const iSent = s.shamerUid === uid;
    const shType = (s.mediaType || 'tv') === 'movie' ? 'movie' : 'tv';
    return `<div class="shame-list-item resolved">
      <div class="shame-item-left" onclick="App.navigate('details',{id:${s.mediaId},type:'${shType}'})">
        ${this._posterHtml(s)}
        <div class="shame-item-info">
          <p class="shame-show">${UI.escapeHtml(s.mediaTitle || '')}</p>
          <p class="shame-detail">${iSent ? `You absolve <strong>${UI.escapeHtml(s.shamedName || 'Someone')}</strong>` : `Absolved by <strong>${UI.escapeHtml(s.shamerName || 'Someone')}</strong>`}</p>
          ${s.resolvedAt ? `<span class="shame-time">${UI.timeAgo(s.resolvedAt)}</span>` : ''}
        </div>
      </div>
      <div class="shame-item-actions">
        <span class="shame-resolved-badge">${UI.icon('check-circle', 14)} Absolved</span>
      </div>
    </div>`;
  },

  async absolve(shameId) {
    try {
      await Services.resolveShame(shameId);
      this.state.sent = this.state.sent.map(s => s.id === shameId ? { ...s, status: 'resolved', resolvedAt: Date.now() } : s);
      this.state.pendingAbsolutions = this.state.pendingAbsolutions.filter(s => s.id !== shameId);
      this.draw();
      UI.toast('Absolved! 🙏', 'success');
    } catch (e) { UI.toast(e.message || 'Error', 'error'); }
  },

  async denyAbsolution(shameId) {
    try {
      await Services.denyAbsolution(shameId);
      const shame = this.state.pendingAbsolutions.find(s => s.id === shameId);
      if (shame) {
        this.state.pendingAbsolutions = this.state.pendingAbsolutions.filter(s => s.id !== shameId);
        this.state.sent = this.state.sent.map(s => s.id === shameId ? { ...s, status: 'active' } : s);
      }
      this.draw();
      UI.toast('Shame continues! 🔥', 'success');
    } catch (e) { UI.toast(e.message || 'Error', 'error'); }
  },

  async shameFromPage() {
    const friends = await Services.getFriends();
    if (!friends.length) { UI.toast('Add friends first!', 'error'); return; }
    UI.showModal(`<div class="friend-picker">
      <h3>Choose a Friend to Shame</h3>
      <p class="modal-subtitle">Pick a friend, then search for the show/movie</p>
      <div class="friend-list">${friends.map(f => {
        const fid = f.friendId || f.uid || f.docId;
        const fname = f.friendUsername || f.username || fid;
        const fPhoto = f.photoURL;
        return `<button class="friend-pick-btn" onclick="WallOfShamePage.pickMediaForShame('${fid}','${UI.escapeHtml(fname)}')">
          ${fPhoto ? `<img src="${UI.escapeHtml(fPhoto)}" class="friend-avatar friend-avatar-img" alt="">` : `<div class="friend-avatar">${(fname || '?')[0].toUpperCase()}</div>`}
          <span>${UI.escapeHtml(fname)}</span>
        </button>`;
      }).join('')}</div>
    </div>`);
  },

  async pickMediaForShame(friendId, friendName) {
    UI.showModal(`<div class="shame-search-modal">
      <h3>Shame ${UI.escapeHtml(friendName)}</h3>
      <p class="modal-subtitle">Search for the show or movie they need to watch</p>
      <div class="search-bar" style="margin:12px 0">
        ${UI.icon('search', 20)}
        <input type="text" id="shame-search-input" placeholder="Search shows & movies..." oninput="WallOfShamePage._onShameSearch(this.value,'${friendId}','${UI.escapeHtml(friendName)}')">
      </div>
      <div id="shame-search-results"></div>
    </div>`);
    setTimeout(() => document.getElementById('shame-search-input')?.focus(), 100);
  },

  _shameSearchTimeout: null,
  _onShameSearch(val, friendId, friendName) {
    clearTimeout(this._shameSearchTimeout);
    if (!val.trim()) { document.getElementById('shame-search-results').innerHTML = ''; return; }
    this._shameSearchTimeout = setTimeout(async () => {
      const results = await API.searchMulti(val);
      const mediaResults = results.filter(r => r.media_type === 'tv' || r.media_type === 'movie').slice(0, 8);
      const el = document.getElementById('shame-search-results');
      if (!el) return;
      el.innerHTML = mediaResults.map(item => {
        const poster = item.poster_path ? API.imageUrl(item.poster_path, 'w92') : '';
        const title = item.name || item.title || '';
        return `<button class="shame-search-item" onclick="WallOfShamePage.doShame('${friendId}','${UI.escapeHtml(friendName)}',${item.id},'${UI.escapeHtml(title)}','${item.media_type}','${item.poster_path || ''}')">
          ${poster ? `<img src="${poster}" alt="">` : `<div class="shame-search-poster">${UI.icon('film', 16)}</div>`}
          <div><p class="shame-search-title">${UI.escapeHtml(title)}</p><p class="shame-search-type">${item.media_type === 'tv' ? 'TV Show' : 'Movie'}</p></div>
        </button>`;
      }).join('') || '<p class="empty-text">No results</p>';
    }, 350);
  },

  async doShame(friendId, friendName, mediaId, mediaTitle, mediaType, posterPath) {
    UI.closeModal();
    await Services.shameFriend(friendId, friendName, null, {
      id: mediaId, name: mediaTitle, mediaType, posterPath: posterPath || null
    });
    UI.toast(`${friendName} has been shamed! 😈`, 'success');
    const [sent, pending] = await Promise.all([Services.getSentShames(), Services.getPendingAbsolutions()]);
    this.state.sent = sent;
    this.state.pendingAbsolutions = pending;
    this.draw();
  }
};
