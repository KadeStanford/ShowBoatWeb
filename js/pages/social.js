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
    el.innerHTML = `<div class="friend-items">${this.state.friends.map(f => `<div class="friend-item" onclick="App.navigate('friend-profile',{id:'${f.friendId}',name:'${UI.escapeHtml(f.friendUsername || '')}'})">
      <div class="friend-avatar">${(f.friendUsername || '?')[0].toUpperCase()}</div>
      <div class="friend-info"><p class="friend-name">${UI.escapeHtml(f.friendUsername || f.friendId)}</p></div>
      <button class="friend-remove-btn" onclick="event.stopPropagation(); FriendsPage.removeFriend('${f.friendId}')" title="Remove">${UI.icon('user-minus', 18)}</button>
    </div>`).join('')}</div>`;
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
      const posterPath = i.poster_path || i.posterPath || i.showPoster || '';
      const poster = posterPath ? API.imageUrl(posterPath, 'w185') : '';
      return `<div class="media-card-sm" onclick="App.navigate('details',{id:${i.showId || i.id},type:'${i.showType || 'tv'}'})">
        ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="poster-placeholder">${UI.icon('film', 24)}</div>`}
        <p class="card-title">${UI.escapeHtml(i.showName || '')}</p>
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
      this.state.feed = await Services.getActivityFeed();
      this.drawFeed();
    } catch (e) { document.getElementById('feed-content').innerHTML = UI.emptyState('Error', e.message); }
  },

  drawFeed() {
    const el = document.getElementById('feed-content');
    if (!this.state.feed.length) { el.innerHTML = UI.emptyState('No activity yet', 'Activity from you and your friends will appear here'); return; }
    el.innerHTML = `<div class="activity-items">${this.state.feed.map(a => {
      const poster = a.showPoster ? API.imageUrl(a.showPoster, 'w92') : '';
      const actionText = a.type === 'watched' ? 'watched' : a.type === 'rated' ? `rated ${a.rating}/10` : a.type === 'watchlist' ? 'added to watchlist' : a.type === 'shame' ? 'shamed' : a.type;
      return `<div class="activity-item" onclick="App.navigate('details',{id:${a.showId},type:'${a.showType || 'tv'}'})">
        ${poster ? `<img src="${poster}" class="activity-poster" alt="">` : `<div class="activity-poster placeholder">${UI.icon('film', 16)}</div>`}
        <div class="activity-info">
          <p><strong>${UI.escapeHtml(a.username || 'You')}</strong> ${actionText}</p>
          <p class="activity-show">${UI.escapeHtml(a.showName || '')}</p>
          ${a.timestamp ? `<p class="activity-time">${UI.timeAgo(a.timestamp)}</p>` : ''}
        </div>
      </div>`;
    }).join('')}</div>`;
  }
};

const WallOfShamePage = {
  state: { shames: [], sent: [] },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="shame-page">${UI.pageHeader('Wall of Shame', true)}<div id="shame-content">${UI.loading()}</div></div>`;
    try {
      const [shames, sent] = await Promise.all([Services.getActiveShames(), Services.getSentShames()]);
      this.state.shames = shames;
      this.state.sent = sent;
      this.draw();
    } catch (e) { document.getElementById('shame-content').innerHTML = UI.emptyState('Error', e.message); }
  },

  draw() {
    const el = document.getElementById('shame-content');
    const all = [...this.state.shames.map(s => ({ ...s, isReceived: true })), ...this.state.sent.map(s => ({ ...s, isReceived: false }))];
    if (!all.length) { el.innerHTML = UI.emptyState('No shames', 'Nobody has been shamed yet!'); return; }
    el.innerHTML = `<div class="shame-items">${all.map(s => {
      const poster = s.showPoster ? API.imageUrl(s.showPoster, 'w185') : '';
      return `<div class="shame-list-item" onclick="App.navigate('details',{id:${s.showId},type:'${s.showType || 'tv'}'})">
        ${poster ? `<img src="${poster}" class="shame-item-poster" alt="">` : `<div class="shame-item-poster placeholder">${UI.icon('tv', 20)}</div>`}
        <div class="shame-item-info">
          <p class="shame-show">${UI.escapeHtml(s.showName || '')}</p>
          <p class="shame-detail">${s.isReceived ? `Shamed by ${UI.escapeHtml(s.shamerUsername || '')}` : `You shamed ${UI.escapeHtml(s.shamedUsername || '')}`}</p>
          ${s.createdAt ? `<p class="shame-time">${UI.timeAgo(s.createdAt)}</p>` : ''}
        </div>
        <div class="shame-icon">${UI.icon('thumbs-down', 20)}</div>
      </div>`;
    }).join('')}</div>`;
  }
};
