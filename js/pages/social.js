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
      return `<div class="friend-item" onclick="App.navigate('friend-profile',{id:'${fid}',name:'${UI.escapeHtml(fname)}'})">
      <div class="friend-avatar">${(fname || '?')[0].toUpperCase()}</div>
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
  state: { id: '', name: '', watchlist: [], watched: [], ratings: [] },

  async render(params) {
    this.state.id = params.id;
    this.state.name = params.name || '';
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const [wl, w, r] = await Promise.all([
        Services.getWatchlist(this.state.id), Services.getWatched(this.state.id), Services.getRatings(this.state.id)
      ]);
      this.state.watchlist = wl; this.state.watched = w; this.state.ratings = r;
      this.draw(el);
    } catch (e) { el.innerHTML = UI.pageHeader(this.state.name, true) + UI.emptyState('Error', e.message); }
  },

  draw(el) {
    const { name, watchlist, watched, ratings } = this.state;
    el.innerHTML = `<div class="friend-profile-page">
      ${UI.pageHeader(name || 'Friend', true)}
      <div class="profile-header">
        <div class="profile-avatar-lg">${(name || '?')[0].toUpperCase()}</div>
        <h2>${UI.escapeHtml(name)}</h2>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-number">${watchlist.length}</span><span class="stat-label">Watchlist</span></div>
        <div class="stat-card"><span class="stat-number">${watched.length}</span><span class="stat-label">Watched</span></div>
        <div class="stat-card"><span class="stat-number">${ratings.length}</span><span class="stat-label">Rated</span></div>
      </div>
      ${watchlist.length ? `<div class="section"><h3>Watchlist</h3><div class="horizontal-scroll">${this.renderItems(watchlist)}</div></div>` : ''}
      ${watched.length ? `<div class="section"><h3>Recently Watched</h3><div class="horizontal-scroll">${this.renderItems(watched)}</div></div>` : ''}
      ${ratings.length ? `<div class="section"><h3>Top Rated</h3><div class="horizontal-scroll">${this.renderItems(ratings.sort((a, b) => (b.rating || 0) - (a.rating || 0)))}</div></div>` : ''}
      <button class="detail-action-btn" onclick="App.navigate('shared-actors',{friendId:'${this.state.id}',friendName:'${UI.escapeHtml(name)}'})" style="margin:16px">${UI.icon('users', 18)} Shared Actors</button>
    </div>`;
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
        const key = `${a.userId}_${a.mediaId || a.showId}_${a.type === 'rated_episode' ? `s${a.seasonNumber}e${a.episodeNumber}` : 'main'}`;
        if (!seen.has(key)) { seen.set(key, true); deduped.push(a); }
      }
      this.state.feed = deduped;
      this.drawFeed();
    } catch (e) { document.getElementById('feed-content').innerHTML = UI.emptyState('Error', e.message); }
  },

  drawFeed() {
    const el = document.getElementById('feed-content');
    if (!this.state.feed.length) { el.innerHTML = UI.emptyState('No activity yet', 'Activity from you and your friends will appear here'); return; }
    const currentUid = auth.currentUser?.uid;
    el.innerHTML = `<div class="activity-items">${this.state.feed.map(a => {
      const poster = (a.mediaPosterPath || a.showPoster) ? API.imageUrl(a.mediaPosterPath || a.showPoster, 'w92') : '';
      const isEpisode = a.type === 'rated_episode';
      let actionText;
      if (isEpisode) {
        actionText = `rated S${a.seasonNumber || '?'}E${a.episodeNumber || '?'} — ${a.rating || '?'}/10`;
      } else if (a.type === 'watched') {
        actionText = 'watched';
      } else if (a.type === 'rated') {
        actionText = `rated ${a.rating || '?'}/10`;
      } else if (a.type === 'added_to_watchlist') {
        actionText = 'added to watchlist';
      } else if (a.type === 'shame') {
        actionText = 'shamed';
      } else {
        actionText = a.type;
      }
      const displayName = a.userId === currentUid ? 'You' : (a.userName || a.username || 'Someone');
      const aType = (a.mediaType || a.showType || 'tv') === 'show' ? 'tv' : (a.mediaType || a.showType || 'tv');
      return `<div class="activity-item" onclick="App.navigate('details',{id:${a.mediaId || a.showId},type:'${aType}'})">
        ${poster ? `<img src="${poster}" class="activity-poster" alt="">` : `<div class="activity-poster placeholder">${UI.icon('film', 16)}</div>`}
        <div class="activity-info">
          <p><strong>${UI.escapeHtml(displayName)}</strong> ${actionText}</p>
          <p class="activity-show">${UI.escapeHtml(a.mediaTitle || a.showName || '')}${isEpisode && a.episodeName ? ` — ${UI.escapeHtml(a.episodeName)}` : ''}</p>
          ${a.comment ? `<p class="activity-comment">"${UI.escapeHtml(a.comment)}"</p>` : ''}
          ${a.createdAt ? `<p class="activity-time">${UI.timeAgo(a.createdAt)}</p>` : ''}
        </div>
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
