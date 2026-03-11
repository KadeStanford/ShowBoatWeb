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
  state: { feed: [], loading: true },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="activity-page">${UI.pageHeader('Activity Feed', true)}<div id="feed-content">${UI.loading()}</div></div>`;
    try {
      const uid = auth.currentUser?.uid;
      const friends = uid ? await Services.getFriends() : [];
      const friendUids = friends.map(f => f.friendId || f.uid || f.docId);
      // Fetch friend activity + own activity in parallel
      const [friendActivity, ownActivity] = await Promise.all([
        friendUids.length ? Services.getActivityFeed(friendUids) : Promise.resolve([]),
        uid ? Services.getActivityFeed([uid]) : Promise.resolve([])
      ]);
      // Merge, deduplicate by user+media (keep most recent action per media per user), and sort
      const allMap = new Map();
      [...ownActivity, ...friendActivity].forEach(a => { if (!allMap.has(a.id)) allMap.set(a.id, a); });
      const all = [...allMap.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      // Keep only the most recent entry per user+media combo (so accidental ratings don't stack)
      const seen = new Map();
      const deduped = [];
      for (const a of all) {
        const key = `${a.userId}_${a.mediaId || a.showId}_${(a.type === 'rated_episode' || a.type === 'watched_episode') ? `s${a.seasonNumber}e${a.episodeNumber}` : 'main'}`;
        if (!seen.has(key)) { seen.set(key, true); deduped.push(a); }
      }
      this.state.feed = deduped;
      this.drawFeed();
    } catch (e) { document.getElementById('feed-content').innerHTML = UI.emptyState('Error', e.message); }
  },

  drawFeed() {
    const el = document.getElementById('feed-content');
    const currentUid = auth.currentUser?.uid;

    // Filter out unrated items (rating=0 is logged as unrated, shouldn't display)
    const feed = this.state.feed.filter(a => {
      if ((a.type === 'rated' || a.type === 'rated_episode') && (!a.rating || a.rating <= 0)) return false;
      return true;
    });

    if (!feed.length) { el.innerHTML = UI.emptyState('No activity yet', 'Activity from you and your friends will appear here'); return; }

    el.innerHTML = `<div class="activity-feed-v2">${feed.map(a => {
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
      else if (a.type === 'rated') { verb = `rated`; dotClass = 'dot-rated'; dotIcon = 'star'; }
      else if (a.type === 'added_to_watchlist') { verb = 'saved to watchlist'; dotClass = 'dot-watchlist'; dotIcon = 'bookmark'; }
      else if (a.type === 'shame') { verb = 'shamed'; dotClass = 'dot-shame'; dotIcon = 'thumbs-down'; }
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
    }).join('')}</div>`;
  }
};

const WallOfShamePage = {
  state: { received: [], sent: [], tab: 'received' },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="shame-page">${UI.pageHeader('Wall of Shame', true)}<div id="shame-content">${UI.loading()}</div></div>`;
    try {
      const [all, sent] = await Promise.all([Services.getAllShames(), Services.getSentShames()]);
      this.state.received = all;
      this.state.sent = sent;
      this.draw();
    } catch (e) { document.getElementById('shame-content').innerHTML = UI.emptyState('Error', e.message); }
  },

  draw() {
    const el = document.getElementById('shame-content');
    const activeCount = this.state.received.filter(s => s.status === 'active').length;
    const sentActiveCount = this.state.sent.filter(s => s.status === 'active').length;

    el.innerHTML = `
      <div class="shame-stats">
        <div class="shame-stat"><span class="shame-stat-num">${activeCount}</span><span class="shame-stat-label">Active Shames</span></div>
        <div class="shame-stat"><span class="shame-stat-num">${this.state.received.length}</span><span class="shame-stat-label">Total Received</span></div>
        <div class="shame-stat"><span class="shame-stat-num">${this.state.sent.length}</span><span class="shame-stat-label">Sent</span></div>
      </div>
      <div class="shame-tabs">
        <button class="shame-tab ${this.state.tab === 'received' ? 'active' : ''}" onclick="WallOfShamePage.switchTab('received')">Received${activeCount ? ` (${activeCount})` : ''}</button>
        <button class="shame-tab ${this.state.tab === 'sent' ? 'active' : ''}" onclick="WallOfShamePage.switchTab('sent')">Sent${sentActiveCount ? ` (${sentActiveCount})` : ''}</button>
      </div>
      <div id="shame-list"></div>
      <button class="shame-someone-btn" onclick="WallOfShamePage.shameFromPage()">
        ${UI.icon('thumbs-down', 20)} Shame a Friend
      </button>`;
    this.drawList();
  },

  switchTab(tab) {
    this.state.tab = tab;
    document.querySelectorAll('.shame-tab').forEach(t => t.classList.toggle('active', t.textContent.startsWith(tab === 'received' ? 'Received' : 'Sent')));
    this.drawList();
  },

  drawList() {
    const el = document.getElementById('shame-list');
    if (!el) return;
    const items = this.state.tab === 'received' ? this.state.received : this.state.sent;
    if (!items.length) {
      el.innerHTML = UI.emptyState(
        this.state.tab === 'received' ? 'No shames received' : 'No shames sent',
        this.state.tab === 'received' ? 'Your friends haven\'t shamed you yet!' : 'Shame a friend who won\'t watch your recommendations!'
      );
      return;
    }
    el.innerHTML = `<div class="shame-items">${items.map(s => {
      const poster = (s.mediaPosterPath || s.showPoster) ? API.imageUrl(s.mediaPosterPath || s.showPoster, 'w185') : '';
      const shType = (s.mediaType || s.showType || 'tv') === 'show' ? 'tv' : (s.mediaType || s.showType || 'tv');
      const isActive = s.status === 'active';
      const isReceived = this.state.tab === 'received';
      const personName = isReceived ? (s.shamerName || s.shamerUsername || 'Someone') : (s.shamedName || s.shamedUsername || 'Someone');
      const daysSince = s.createdAt ? Math.floor((Date.now() - s.createdAt) / (1000 * 60 * 60 * 24)) : 0;

      return `<div class="shame-list-item ${isActive ? 'active' : 'resolved'}">
        <div class="shame-item-left" onclick="App.navigate('details',{id:${s.mediaId || s.showId},type:'${shType}'})">
          ${poster ? `<img src="${poster}" class="shame-item-poster" alt="">` : `<div class="shame-item-poster placeholder">${UI.icon('tv', 20)}</div>`}
          <div class="shame-item-info">
            <p class="shame-show">${UI.escapeHtml(s.mediaTitle || s.showName || '')}</p>
            <p class="shame-detail">${isReceived ? `Shamed by <strong>${UI.escapeHtml(personName)}</strong>` : `You shamed <strong>${UI.escapeHtml(personName)}</strong>`}</p>
            <div class="shame-item-meta">
              ${isActive && daysSince > 0 ? `<span class="shame-timer">${UI.icon('clock', 12)} ${daysSince}d unresolved</span>` : ''}
              ${!isActive ? `<span class="shame-resolved-badge">${UI.icon('check-circle', 12)} Resolved</span>` : ''}
              ${s.createdAt ? `<span class="shame-time">${UI.timeAgo(s.createdAt)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="shame-item-actions">
          ${isReceived && isActive ? `<button class="shame-resolve-btn" onclick="event.stopPropagation(); WallOfShamePage.resolveShame('${s.id}', '${shType}', ${s.mediaId || s.showId})" title="I watched it!">${UI.icon('check', 16)} Watched it!</button>` : ''}
          <div class="shame-icon ${isActive ? '' : 'resolved'}">${UI.icon('thumbs-down', 20)}</div>
        </div>
      </div>`;
    }).join('')}</div>`;
  },

  async resolveShame(shameId, mediaType, mediaId) {
    try {
      await Services.resolveShame(shameId);
      this.state.received = this.state.received.map(s => s.id === shameId ? { ...s, status: 'resolved', resolvedAt: Date.now() } : s);
      this.draw();
      UI.toast('Shame resolved! 🎬', 'success');
    } catch (e) { UI.toast('Error resolving shame', 'error'); }
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
        return `<button class="friend-pick-btn" onclick="WallOfShamePage.pickMediaForShame('${fid}','${UI.escapeHtml(fname)}')">
          <div class="friend-avatar">${(fname || '?')[0].toUpperCase()}</div>
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
    // Refresh the list
    const sent = await Services.getSentShames();
    this.state.sent = sent;
    if (this.state.tab === 'sent') this.drawList();
  }
};
