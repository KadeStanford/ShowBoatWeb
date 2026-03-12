/* ShowBoat — Social Pages: Friends, FriendProfile, ActivityFeed, WallOfShame */
const FriendsPage = {
  state: { friends: [], search: '', searchResults: [], recommended: [] },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="friends-page">
      ${UI.pageHeader('Friends', true)}
      <div class="friends-search-wrap">
        <div class="friends-search-bar">
          ${UI.icon('search', 18)}
          <input type="text" id="friend-search" placeholder="Search by username..." oninput="FriendsPage.onSearch(this.value)">
        </div>
      </div>
      <div id="search-results"></div>
      <div id="recommended-friends"></div>
      <div id="friends-list">${UI.loading()}</div>
    </div>`;
    await this.loadFriends();
    this.loadRecommended().catch(() => {}).finally(() => this.drawRecommended());
  },

  async loadFriends() {
    try {
      this.state.friends = await Services.getFriends();
      const profiles = await Promise.all(
        this.state.friends.map(f => Services.getUserProfile(f.friendId || f.uid || f.docId).catch(() => null))
      );
      this.state.friends.forEach((f, i) => {
        if (profiles[i]) {
          if (profiles[i].photoURL) f.photoURL = profiles[i].photoURL;
          if (profiles[i].username) { f.username = profiles[i].username; f.friendUsername = profiles[i].username; }
          else if (profiles[i].displayName) { f.username = profiles[i].displayName; f.friendUsername = profiles[i].displayName; }
        }
      });
      this.drawFriends();
    } catch (e) { document.getElementById('friends-list').innerHTML = UI.emptyState('Error', e.message); }
  },

  // Taste-matching: find potential friends who share watched content with the user's friends
  async loadRecommended() {
    const el = document.getElementById('recommended-friends');
    if (!el) return;
    try {
      const uid = auth.currentUser?.uid;
      if (!uid || !this.state.friends.length) return;
      const friendIds = new Set(this.state.friends.map(f => f.friendId || f.uid || f.docId));

      // Get my watched list to calculate taste overlap
      const myWatched = await Services.getWatched(uid).catch(() => []);
      const myWatchedIds = new Set(myWatched.map(x => String(x.tmdbId)));
      if (!myWatchedIds.size) return;

      // For each friend, get their friends (mutual friend candidates)
      const candidateScores = new Map();
      const batchFriendIds = [...friendIds].slice(0, 5); // Limit to avoid too many reads
      await Promise.all(batchFriendIds.map(async fid => {
        try {
          const theirFriends = await Services.getFriends(fid).catch(() => []);
          for (const tf of theirFriends) {
            const cid = tf.friendId || tf.uid || tf.docId;
            if (!cid || cid === uid || friendIds.has(cid)) continue;
            if (!candidateScores.has(cid)) {
              candidateScores.set(cid, { uid: cid, username: tf.friendUsername || tf.username || '', mutualFriends: 0, sharedWatched: 0 });
            }
            candidateScores.get(cid).mutualFriends++;
          }
        } catch (_) {}
      }));

      if (!candidateScores.size) return;

      // Calculate watched overlap for top candidates
      const topCandidates = [...candidateScores.values()]
        .sort((a, b) => b.mutualFriends - a.mutualFriends)
        .slice(0, 8);

      await Promise.all(topCandidates.map(async c => {
        try {
          const theirWatched = await Services.getWatched(c.uid).catch(() => []);
          c.sharedWatched = theirWatched.filter(x => myWatchedIds.has(String(x.tmdbId))).length;
          const profile = await Services.getUserProfile(c.uid).catch(() => null);
          if (profile?.username) c.username = profile.username;
          if (profile?.photoURL) c.photoURL = profile.photoURL;
        } catch (_) {}
      }));

      // Score = shared watched * 3 + mutual friends * 10
      const scored = topCandidates
        .map(c => ({ ...c, score: c.sharedWatched * 3 + c.mutualFriends * 10 }))
        .filter(c => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      if (!scored.length) return;
      this.state.recommended = scored;
    } catch (_) {}
  },

  drawRecommended() {
    const el = document.getElementById('recommended-friends');
    if (!el) return;
    const friendIds = new Set(this.state.friends.map(f => f.friendId || f.uid || f.docId));
    const recs = (this.state.recommended || []).filter(c => !friendIds.has(c.uid));

    el.innerHTML = `
      <div class="recommended-section">
        <div class="recommended-header">
          ${UI.icon('user-check', 16)} <span>Recommended Friends</span>
          ${recs.length ? `<span class="recommended-subtitle">Based on your taste & mutual connections</span>` : ''}
        </div>
        ${recs.length ? `<div class="recommended-list">${recs.map(c => {
          const avatarHtml = c.photoURL
            ? `<img src="${UI.escapeHtml(c.photoURL)}" class="friend-avatar friend-avatar-img" alt="">`
            : `<div class="friend-avatar">${(c.username || '?')[0].toUpperCase()}</div>`;
          const reasons = [];
          if (c.mutualFriends > 0) reasons.push(`${c.mutualFriends} mutual friend${c.mutualFriends > 1 ? 's' : ''}`);
          if (c.sharedWatched > 0) reasons.push(`${c.sharedWatched} shows in common`);
          return `<div class="friend-item recommended-item" onclick="App.navigate('friend-profile',{id:'${c.uid}',name:'${UI.escapeHtml(c.username)}'})">
            ${avatarHtml}
            <div class="friend-info">
              <p class="friend-name">${UI.escapeHtml(c.username || 'Unknown User')}</p>
              <p class="friend-reason">${reasons.join(' · ')}</p>
            </div>
            <button class="add-friend-btn" onclick="event.stopPropagation(); FriendsPage.addFriend('${c.uid}','${UI.escapeHtml(c.username || '')}')">${UI.icon('user-plus', 16)} Add</button>
          </div>`;
        }).join('')}</div>` : `<div class="recommended-empty">
          <span class="recommended-empty-icon">${UI.icon('users', 28)}</span>
          <p>Add friends to get new friend recommendations</p>
        </div>`}
      </div>
      <div class="friends-section-header">My Friends</div>
    `;
  },

  drawFriends() {
    const el = document.getElementById('friends-list');
    if (!el) return;
    if (!this.state.friends.length) { el.innerHTML = UI.emptyState('No friends yet', 'Search for users to add them'); return; }
    el.innerHTML = `<div class="friend-items">${this.state.friends.map(f => {
      const fid = f.friendId || f.uid || f.docId;
      const fname = f.friendUsername || f.username || '';
      const safeName = fname && fname.length < 30 ? fname : '';
      const avatarHtml = f.photoURL
        ? `<img src="${UI.escapeHtml(f.photoURL)}" class="friend-avatar friend-avatar-img" alt="">`
        : `<div class="friend-avatar">${(safeName || '?')[0].toUpperCase()}</div>`;
      return `<div class="friend-item" onclick="App.navigate('friend-profile',{id:'${fid}',name:'${UI.escapeHtml(safeName)}'})">
      ${avatarHtml}
      <div class="friend-info"><p class="friend-name">${UI.escapeHtml(safeName || 'Unknown User')}</p></div>
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
          <div class="friend-info"><p class="friend-name">${UI.escapeHtml(u.username || 'Unknown User')}</p></div>
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
  state: { id: '', name: '', photoURL: null, watchlist: [], watched: [], ratings: [], activity: [], badges: [], activeTab: 'activity', myWatchedIds: new Set(), plexHistory: [], plexNowPlaying: [], plexLibraryIds: new Set() },

  async render(params) {
    this.state.id = params.id;
    this.state.name = params.name || '';
    this.state.photoURL = null;
    this.state.activeTab = params.tab || 'activity';
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="friend-profile-page">${UI.pageHeader('', true)}<div id="fp-content">${UI.loading()}</div></div>`;
    try {
      const uid = this.state.id;
      const myUid = auth.currentUser?.uid;
      const [wl, w, r, profile, myW, actResult, plexH, plexNP] = await Promise.all([
        Services.getWatchlist(uid), Services.getWatched(uid), Services.getRatings(uid),
        Services.getUserProfile(uid).catch(() => null),
        myUid ? Services.getWatched(myUid).catch(() => []) : Promise.resolve([]),
        Services.getActivityFeed([uid], {}, 30).catch(() => ({ items: [] })),
        Services.getPlexHistory(uid).catch(() => []),
        Services.getPlexNowPlaying(uid).catch(() => [])
      ]);
      this.state.watchlist = wl;
      this.state.watched = w;
      this.state.ratings = r;
      this.state.plexHistory = plexH;
      this.state.plexNowPlaying = plexNP;
      this.state.plexLibraryIds = new Set(plexH.filter(p => p.tmdbId).map(p => Number(p.tmdbId)));
      this.state.photoURL = profile?.photoURL || null;
      if (profile?.username) this.state.name = profile.username;
      this.state.myWatchedIds = new Set(myW.map(x => String(x.tmdbId)));
      const coreActivity = (actResult?.items || []).filter(a => {
        if ((a.type === 'rated' || a.type === 'rated_episode') && (!a.rating || a.rating <= 0)) return false;
        return true;
      });
      // Convert Plex history to activity items and merge
      const plexActivity = plexH.map(h => ({
        type: h.type === 'movie' ? 'watched' : (h.season != null ? 'watched_episode' : 'watched'),
        source: 'plex',
        mediaId: h.tmdbId || null,
        mediaTitle: h.tmdbTitle || h.title || '',
        mediaType: h.type === 'movie' ? 'movie' : 'tv',
        mediaPosterPath: h.posterPath || null,
        seasonNumber: h.season || null,
        episodeNumber: h.episode || null,
        createdAt: h.lastViewedAt ? h.lastViewedAt * 1000 : (h.savedAt || 0)
      }));
      // Deduplicate: skip plex items whose tmdbId+type already appears in core activity
      const coreKeys = new Set(coreActivity.map(a => `${a.mediaId||a.showId}:${a.type}`));
      const uniquePlex = plexActivity.filter(p => !coreKeys.has(`${p.mediaId}:${p.type}`));
      this.state.activity = [...coreActivity, ...uniquePlex].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const friendStats = {
        watchlistCount: wl.length, watchedCount: w.length, ratingsCount: r.length, friendsCount: 0,
        movies: w.filter(x => x.mediaType === 'movie').length,
        episodes: w.filter(x => x.seasonNumber != null).length
      };
      this.state.badges = typeof calculateBadges === 'function' ? calculateBadges(friendStats).filter(b => b.earned) : [];
      this.draw(document.getElementById('fp-content'));
    } catch (e) {
      document.getElementById('fp-content').innerHTML = UI.emptyState('Error', e.message);
    }
  },

  draw(container) {
    if (!container) return;
    const { name, photoURL, watchlist, watched, ratings, activity, badges, id, activeTab } = this.state;
    const avatarHtml = photoURL
      ? `<img src="${UI.escapeHtml(photoURL)}" class="fp-avatar-img" alt="">`
      : `<div class="fp-avatar-initial">${(name || '?')[0].toUpperCase()}</div>`;

    const tabs = [
      { key: 'activity', label: UI.icon('activity', 15) + ' Activity' },
      { key: 'watched',  label: UI.icon('eye', 15) + ' Watched' },
      { key: 'ratings',  label: UI.icon('star', 15) + ' Rated' },
      { key: 'watchlist',label: UI.icon('bookmark', 15) + ' Watchlist' },
      ...(this.state.plexHistory.length || this.state.plexNowPlaying.length ? [{ key: 'plex', label: UI.icon('monitor', 15) + ' Plex' }] : [])
    ];

    const movies = watched.filter(x => x.mediaType === 'movie').length;
    const shows = watched.length - movies;

    container.innerHTML = `
      <div class="fp-hero">
        <div class="fp-hero-top">
          <div class="fp-hero-avatar">${avatarHtml}</div>
          <div class="fp-hero-info">
            <h2 class="fp-name">${UI.escapeHtml(name)}</h2>
            <div class="fp-stats-row">
              <span class="fp-stat"><strong>${watched.length}</strong> watched</span>
              <span class="fp-stat-sep">·</span>
              <span class="fp-stat"><strong>${ratings.length}</strong> rated</span>
              <span class="fp-stat-sep">·</span>
              <span class="fp-stat"><strong>${watchlist.length}</strong> saved</span>
            </div>
            <div class="fp-stats-row fp-stats-sub">
              <span class="fp-stat">${UI.icon('film', 12)} ${movies} movie${movies !== 1 ? 's' : ''}</span>
              <span class="fp-stat-sep">·</span>
              <span class="fp-stat">${UI.icon('tv', 12)} ${shows} show${shows !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <div class="fp-hero-actions">
          <button class="fp-action-btn fp-action-primary" onclick="App.navigate('friend-analytics',{id:'${id}',name:'${UI.escapeHtml(name)}'})">
            ${UI.icon('bar-chart-2', 15)} Analytics
          </button>
          <button class="fp-action-btn" onclick="App.navigate('shared-actors',{friendId:'${id}',friendName:'${UI.escapeHtml(name)}'})">
            ${UI.icon('users', 15)} Actors
          </button>
          <button class="fp-action-btn" onclick="App.navigate('matcher-setup')">
            ${UI.icon('zap', 15)} Match
          </button>
          <button class="fp-action-btn fp-report-btn" onclick="UI.showReportUserModal('${id}','${UI.escapeHtml(name)}')">
            ${UI.icon('flag', 15)}
          </button>
        </div>
      </div>

      ${badges.length ? `
      <div class="fp-badges-section">
        <div class="fp-badges-grid">${badges.map(b => {
          const t = (typeof BADGE_TIERS !== 'undefined' ? BADGE_TIERS[b.tier] : null) || { color: '#d97706', bg: 'rgba(217,119,6,.1)' };
          return `<div class="fp-badge-card" style="--badge-color:${t.color};--badge-bg:${t.bg}" title="${UI.escapeHtml(b.description || '')}">
            <div class="fp-badge-icon">${b.icon}</div>
            <span class="fp-badge-name">${UI.escapeHtml(b.name)}</span>
            <span class="fp-badge-tier" style="color:${t.color}">${(b.tier || 'bronze').charAt(0).toUpperCase() + (b.tier || 'bronze').slice(1)}</span>
          </div>`;
        }).join('')}</div>
      </div>` : ''}

      <div class="fp-tabs">
        ${tabs.map(t => `<button class="fp-tab ${activeTab === t.key ? 'active' : ''}" onclick="FriendProfilePage.setTab('${t.key}')">${t.label}</button>`).join('')}
      </div>
      <div id="fp-tab-content"></div>
    `;
    this.renderTab(activeTab);
  },

  setTab(tab) {
    this.state.activeTab = tab;
    document.querySelectorAll('.fp-tab').forEach(b => b.classList.toggle('active', b.textContent.trim().toLowerCase().includes(tab.substring(0, 4).toLowerCase())));
    // Simpler: re-match by onclick
    document.querySelectorAll('.fp-tab').forEach(b => {
      const m = b.getAttribute('onclick')?.match(/'(\w+)'/);
      b.classList.toggle('active', m && m[1] === tab);
    });
    this.renderTab(tab);
  },

  renderTab(tab) {
    const el = document.getElementById('fp-tab-content');
    if (!el) return;
    const { watched, watchlist, ratings, activity, id, name, myWatchedIds } = this.state;

    if (tab === 'activity') {
      const np = this.state.plexNowPlaying;
      const npHtml = np.length ? `<div class="fp-act-plex-live">
        <div class="fp-act-plex-header">${UI.icon('play-circle', 14)} <span>Now Playing on Plex</span></div>
        ${np.map(s => {
          const stateIcon = s.state === 'paused' ? UI.icon('pause', 10) : UI.icon('play', 10);
          return `<div class="fp-act-plex-row">
            <span class="fp-plex-session-state ${s.state || ''}">${stateIcon}</span>
            <div class="fp-act-plex-info">
              <p class="fp-act-plex-title">${UI.escapeHtml(s.title)}${s.episodeLabel ? ` <span class="fp-act-plex-ep">${UI.escapeHtml(s.episodeLabel)}</span>` : ''}</p>
              ${s.episodeTitle ? `<p class="fp-act-plex-sub">${UI.escapeHtml(s.episodeTitle)}</p>` : ''}
            </div>
            <div class="fp-plex-session-bar" style="width:60px"><div class="fp-plex-session-fill" style="width:${(s.progress || 0).toFixed(1)}%"></div></div>
          </div>`;
        }).join('')}
      </div>` : '';
      if (!activity.length && !np.length) { el.innerHTML = `<div class="fp-empty">${UI.icon('activity', 28)}<p>No recent activity</p></div>`; return; }
      el.innerHTML = `${npHtml}<div class="fp-activity-list">${activity.slice(0, 20).map(a => {
        const poster = (a.mediaPosterPath || a.showPoster) ? API.imageUrl(a.mediaPosterPath || a.showPoster, 'w92') : '';
        const aType = (a.mediaType || a.showType || 'tv') === 'show' ? 'tv' : (a.mediaType || a.showType || 'tv');
        let verb = a.type === 'watched' ? 'watched' : a.type === 'watched_episode' ? `watched S${a.seasonNumber}E${a.episodeNumber}` : a.type === 'rated' ? `rated ${a.rating}/10` : a.type === 'rated_episode' ? `rated S${a.seasonNumber}E${a.episodeNumber} ${a.rating}/10` : a.type === 'added_to_watchlist' ? 'saved to watchlist' : a.type;
        const plexTag = a.source === 'plex' ? ' <span class="fp-act-plex-tag">Plex</span>' : '';
        return `<div class="fp-act-row" ${a.mediaId ? `onclick="App.navigate('details',{id:${a.mediaId},type:'${aType}'})"` : ''}>
          ${poster ? `<img src="${poster}" class="fp-act-thumb" alt="">` : `<div class="fp-act-thumb fp-act-thumb-ph">${UI.icon('film', 14)}</div>`}
          <div class="fp-act-info">
            <p class="fp-act-title">${UI.escapeHtml(a.mediaTitle || a.showName || '')}</p>
            <p class="fp-act-verb">${verb}${plexTag}${a.createdAt ? ` · ${UI.timeAgo(a.createdAt)}` : ''}</p>
          </div>
        </div>`;
      }).join('')}</div>`;
    }

    if (tab === 'watched') {
      const sorted = [...watched].sort((a, b) => (b.watchedAt || b.createdAt || 0) - (a.watchedAt || a.createdAt || 0));
      const preview = sorted.slice(0, 15);
      el.innerHTML = `
        <div class="fp-section-header-row">
          <span class="fp-section-count">${watched.length} watched</span>
          ${watched.length > 15 ? `<button class="fp-see-all-btn" onclick="App.navigate('friend-watched-all',{id:'${id}',name:'${UI.escapeHtml(name)}'})">${UI.icon('grid', 14)} See All</button>` : ''}
        </div>
        <div class="fp-media-list">${preview.map(i => this._renderListItem(i, myWatchedIds)).join('')}</div>`;
    }

    if (tab === 'ratings') {
      const sorted = [...ratings].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      const preview = sorted.slice(0, 15);
      el.innerHTML = `
        <div class="fp-section-header-row">
          <span class="fp-section-count">${ratings.length} rated</span>
        </div>
        <div class="fp-media-list">${preview.map(i => {
          const posterPath = i.posterPath || i.mediaPosterPath || '';
          const poster = posterPath ? API.imageUrl(posterPath, 'w92') : '';
          const fpType = (i.mediaType || 'tv') === 'show' ? 'tv' : (i.mediaType || 'tv');
          const bothWatched = myWatchedIds.has(String(i.tmdbId || i.id));
          return `<div class="fp-list-item ${bothWatched ? 'fp-both-watched' : ''}" onclick="App.navigate('details',{id:${i.tmdbId||i.id},type:'${fpType}'})">
            ${poster ? `<img src="${poster}" class="fp-list-poster" alt="">` : `<div class="fp-list-poster-ph">${UI.icon('film', 16)}</div>`}
            <div class="fp-list-info">
              <p class="fp-list-title">${UI.escapeHtml(i.name || i.mediaTitle || '')}</p>
              <div class="fp-list-meta">
                ${UI.icon('star', 12)} <strong>${i.rating || '—'}/10</strong>
                ${bothWatched ? `<span class="fp-both-badge">${UI.icon('check', 10)} Both watched</span>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}</div>`;
    }

    if (tab === 'watchlist') {
      el.innerHTML = `
        <div class="fp-section-header-row">
          <span class="fp-section-count">${watchlist.length} saved</span>
          ${watchlist.length > 15 ? `<button class="fp-see-all-btn" onclick="App.navigate('friend-watchlist-all',{id:'${id}',name:'${UI.escapeHtml(name)}'})">${UI.icon('grid', 14)} See All</button>` : ''}
        </div>
        <div class="fp-media-list">${watchlist.slice(0, 15).map(i => this._renderListItem(i, myWatchedIds)).join('')}</div>`;
    }

    if (tab === 'plex') {
      const { plexNowPlaying, plexHistory } = this.state;
      let html = '';
      if (plexNowPlaying.length) {
        html += `<div class="fp-plex-now-playing">
          <div class="fp-section-label">${UI.icon('play-circle', 14)} Now Playing</div>
          <div class="fp-plex-sessions">${plexNowPlaying.map(s => {
            const stateIcon = s.state === 'paused' ? UI.icon('pause', 10) : UI.icon('play', 10);
            return `<div class="fp-plex-session">
              <div class="fp-plex-session-info">
                <span class="fp-plex-session-state ${s.state}">${stateIcon}</span>
                <div>
                  <p class="fp-plex-session-title">${UI.escapeHtml(s.title)}</p>
                  ${s.episodeLabel ? `<p class="fp-plex-session-sub">${UI.escapeHtml(s.episodeLabel)}${s.episodeTitle ? ' \u00b7 ' + UI.escapeHtml(s.episodeTitle) : ''}</p>` : ''}
                  ${s.user ? `<p class="fp-plex-session-user">${UI.escapeHtml(s.user)}</p>` : ''}
                </div>
              </div>
              <div class="fp-plex-session-bar"><div class="fp-plex-session-fill" style="width:${(s.progress || 0).toFixed(1)}%"></div></div>
            </div>`;
          }).join('')}</div>
        </div>`;
      }
      // Deduplicate Plex history to show-level
      const deduped = new Map();
      plexHistory.forEach(h => {
        const key = h.tmdbId ? `id:${h.tmdbId}` : `t:${h.title}`;
        const existing = deduped.get(key);
        if (!existing || (h.lastViewedAt || 0) > (existing.lastViewedAt || 0)) deduped.set(key, h);
      });
      const items = [...deduped.values()].sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0));
      if (items.length) {
        html += `<div class="fp-section-label" style="margin-top:12px">${UI.icon('film', 14)} Plex Library (${items.length})</div>`;
        html += `<div class="fp-media-list">${items.slice(0, 30).map(h => {
          const poster = h.posterPath ? API.imageUrl(h.posterPath, 'w92') : '';
          const fpType = h.type === 'movie' ? 'movie' : 'tv';
          const tmdbId = h.tmdbId;
          const date = h.lastViewedAt ? new Date(h.lastViewedAt * 1000) : null;
          const dateStr = date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
          return `<div class="fp-list-item" ${tmdbId ? `onclick="App.navigate('details',{id:${tmdbId},type:'${fpType}'})"` : ''}>
            ${poster ? `<img src="${poster}" class="fp-list-poster" alt="">` : `<div class="fp-list-poster-ph">${UI.icon('film', 16)}</div>`}
            <div class="fp-list-info">
              <p class="fp-list-title">${UI.escapeHtml(h.tmdbTitle || h.title || '')}</p>
              <div class="fp-list-meta">
                <span class="fp-type-tag">${fpType === 'movie' ? 'Movie' : 'TV'}</span>
                <span class="fp-plex-badge">${UI.icon('monitor', 10)} Plex</span>
                ${dateStr ? `<span style="color:var(--slate-400);font-size:.75rem">${dateStr}</span>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}</div>`;
      }
      if (!html) html = `<div class="fp-empty">${UI.icon('monitor', 28)}<p>No Plex data</p></div>`;
      el.innerHTML = html;
    }
  },

  _renderListItem(i, myWatchedIds) {
    const posterPath = i.posterPath || i.mediaPosterPath || i.poster_path || '';
    const poster = posterPath ? API.imageUrl(posterPath, 'w92') : '';
    const fpType = (i.mediaType || i.type || 'tv') === 'movie' ? 'movie' : 'tv';
    const tmdbId = i.tmdbId || i.id;
    const bothWatched = myWatchedIds.has(String(tmdbId));
    const onPlex = this.state.plexLibraryIds.has(Number(tmdbId));
    return `<div class="fp-list-item ${bothWatched ? 'fp-both-watched' : ''}" onclick="App.navigate('details',{id:${tmdbId},type:'${fpType}'})">
      ${poster ? `<img src="${poster}" class="fp-list-poster" alt="">` : `<div class="fp-list-poster-ph">${UI.icon('film', 16)}</div>`}
      <div class="fp-list-info">
        <p class="fp-list-title">${UI.escapeHtml(i.name || i.mediaTitle || i.title || '')}</p>
        <div class="fp-list-meta">
          <span class="fp-type-tag">${fpType === 'movie' ? 'Movie' : 'TV'}</span>
          ${bothWatched ? `<span class="fp-both-badge">${UI.icon('check', 10)} Both watched</span>` : ''}
          ${onPlex ? `<span class="fp-plex-badge">${UI.icon('monitor', 10)} Plex</span>` : ''}
        </div>
      </div>
    </div>`;
  },

  renderItems(items) {
    return items.slice(0, 10).map(i => {
      const posterPath = i.poster_path || i.posterPath || i.mediaPosterPath || i.showPoster || '';
      const poster = posterPath ? API.imageUrl(posterPath, 'w342') : '';
      const fpType = (i.mediaType || i.showType || 'tv') === 'show' ? 'tv' : (i.mediaType || i.showType || 'tv');
      return `<div class="media-card-sm" onclick="App.navigate('details',{id:${i.tmdbId || i.mediaId || i.showId || i.id},type:'${fpType}'})">
        ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="poster-placeholder">${UI.icon('film', 24)}</div>`}
        <p class="card-title">${UI.escapeHtml(i.name || i.mediaTitle || i.showName || '')}</p>
        ${i.rating ? `<p class="card-subtitle">${UI.icon('star', 12)} ${i.rating}</p>` : ''}
      </div>`;
    }).join('');
  }
};

// Full searchable watched list for a friend
const FriendWatchedAllPage = {
  state: { id: '', name: '', items: [], filtered: [], query: '', filter: 'all' },
  async render(params) {
    this.state.id = params.id;
    this.state.name = params.name || 'Friend';
    this.state.query = '';
    this.state.filter = 'all';
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="fp-all-page">${UI.pageHeader(`${UI.escapeHtml(this.state.name)}'s Watched`, true)}<div id="fw-content">${UI.loading()}</div></div>`;
    try {
      const [items, myW] = await Promise.all([
        Services.getWatched(this.state.id),
        Services.getWatched(auth.currentUser?.uid).catch(() => [])
      ]);
      this.state.items = items.sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0));
      this.state.myWatchedIds = new Set(myW.map(x => String(x.tmdbId)));
      this.state.filtered = [...this.state.items];
      this.draw();
    } catch (e) { document.getElementById('fw-content').innerHTML = UI.emptyState('Error', e.message); }
  },
  draw() {
    const el = document.getElementById('fw-content');
    if (!el) return;
    const { filtered, items, query, filter, id, name, myWatchedIds } = this.state;
    el.innerHTML = `
      <div class="fw-controls">
        <div class="search-bar" style="margin-bottom:8px">
          ${UI.icon('search', 18)}
          <input type="text" placeholder="Search ${UI.escapeHtml(name)}'s watched list..." value="${UI.escapeHtml(query)}" oninput="FriendWatchedAllPage.search(this.value)" id="fw-search">
        </div>
        <div class="filter-tabs">
          ${['all','movie','tv'].map(f => `<button class="filter-tab ${filter===f?'active':''}" onclick="FriendWatchedAllPage.setFilter('${f}')">${f==='all'?'All':f==='movie'?'Movies':'TV'}</button>`).join('')}
          <button class="filter-tab ${filter==='both'?'active':''}" onclick="FriendWatchedAllPage.setFilter('both')">${UI.icon('check', 12)} Both Watched</button>
        </div>
      </div>
      <p class="fw-count">${filtered.length} item${filtered.length !== 1 ? 's' : ''}</p>
      <div class="fp-media-list">
        ${filtered.map(i => {
          const posterPath = i.posterPath || i.mediaPosterPath || '';
          const poster = posterPath ? API.imageUrl(posterPath, 'w92') : '';
          const fpType = (i.mediaType || 'tv') === 'movie' ? 'movie' : 'tv';
          const tmdbId = i.tmdbId;
          const bothWatched = myWatchedIds && myWatchedIds.has(String(tmdbId));
          return `<div class="fp-list-item ${bothWatched ? 'fp-both-watched' : ''}" onclick="App.navigate('details',{id:${tmdbId},type:'${fpType}'})">
            ${poster ? `<img src="${poster}" class="fp-list-poster" alt="">` : `<div class="fp-list-poster-ph">${UI.icon('film', 16)}</div>`}
            <div class="fp-list-info">
              <p class="fp-list-title">${UI.escapeHtml(i.name || i.mediaTitle || '')}</p>
              <div class="fp-list-meta">
                <span class="fp-type-tag">${fpType === 'movie' ? 'Movie' : 'TV'}</span>
                ${bothWatched ? `<span class="fp-both-badge">${UI.icon('check', 10)} Both watched</span>` : ''}
                ${i.watchedAt ? `<span class="fp-list-date">${UI.timeAgo(i.watchedAt)}</span>` : ''}
              </div>
            </div>
          </div>`;
        }).join('') || `<div style="padding:40px;text-align:center;color:var(--text-muted)">No results</div>`}
      </div>
    `;
  },
  search(q) {
    this.state.query = q;
    this._applyFilter();
  },
  setFilter(f) {
    this.state.filter = f;
    this._applyFilter();
  },
  _applyFilter() {
    const { items, query, filter, myWatchedIds } = this.state;
    let result = [...items];
    if (query) result = result.filter(i => (i.name || i.mediaTitle || '').toLowerCase().includes(query.toLowerCase()));
    if (filter === 'movie') result = result.filter(i => i.mediaType === 'movie');
    if (filter === 'tv') result = result.filter(i => i.mediaType !== 'movie');
    if (filter === 'both') result = result.filter(i => myWatchedIds && myWatchedIds.has(String(i.tmdbId)));
    this.state.filtered = result;
    this.draw();
  }
};

// Full searchable watchlist for a friend
const FriendWatchlistAllPage = {
  state: { id: '', name: '', items: [], filtered: [], query: '', filter: 'all' },
  async render(params) {
    this.state.id = params.id;
    this.state.name = params.name || 'Friend';
    this.state.query = '';
    this.state.filter = 'all';
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="fp-all-page">${UI.pageHeader(`${UI.escapeHtml(this.state.name)}'s Watchlist`, true)}<div id="fwl-content">${UI.loading()}</div></div>`;
    try {
      const [items, myW] = await Promise.all([
        Services.getWatchlist(this.state.id),
        Services.getWatched(auth.currentUser?.uid).catch(() => [])
      ]);
      this.state.items = items;
      this.state.myWatchedIds = new Set(myW.map(x => String(x.tmdbId)));
      this.state.filtered = [...items];
      this.draw();
    } catch (e) { document.getElementById('fwl-content').innerHTML = UI.emptyState('Error', e.message); }
  },
  draw() {
    const el = document.getElementById('fwl-content');
    if (!el) return;
    const { filtered, query, filter, name, myWatchedIds } = this.state;
    el.innerHTML = `
      <div class="fw-controls">
        <div class="search-bar" style="margin-bottom:8px">
          ${UI.icon('search', 18)}
          <input type="text" placeholder="Search ${UI.escapeHtml(name)}'s watchlist..." value="${UI.escapeHtml(query)}" oninput="FriendWatchlistAllPage.search(this.value)">
        </div>
        <div class="filter-tabs">
          ${['all','movie','tv'].map(f => `<button class="filter-tab ${filter===f?'active':''}" onclick="FriendWatchlistAllPage.setFilter('${f}')">${f==='all'?'All':f==='movie'?'Movies':'TV'}</button>`).join('')}
          <button class="filter-tab ${filter==='watched'?'active':''}" onclick="FriendWatchlistAllPage.setFilter('watched')">${UI.icon('eye', 12)} Already Watched</button>
        </div>
      </div>
      <p class="fw-count">${filtered.length} item${filtered.length !== 1 ? 's' : ''}</p>
      <div class="fp-media-list">
        ${filtered.map(i => {
          const posterPath = i.posterPath || '';
          const poster = posterPath ? API.imageUrl(posterPath, 'w92') : '';
          const fpType = (i.mediaType || 'tv') === 'movie' ? 'movie' : 'tv';
          const alreadyWatched = myWatchedIds && myWatchedIds.has(String(i.tmdbId || i.id));
          return `<div class="fp-list-item ${alreadyWatched ? 'fp-both-watched' : ''}" onclick="App.navigate('details',{id:${i.tmdbId||i.id},type:'${fpType}'})">
            ${poster ? `<img src="${poster}" class="fp-list-poster" alt="">` : `<div class="fp-list-poster-ph">${UI.icon('film', 16)}</div>`}
            <div class="fp-list-info">
              <p class="fp-list-title">${UI.escapeHtml(i.name || '')}</p>
              <div class="fp-list-meta">
                <span class="fp-type-tag">${fpType === 'movie' ? 'Movie' : 'TV'}</span>
                ${alreadyWatched ? `<span class="fp-both-badge">${UI.icon('check', 10)} You watched this</span>` : ''}
              </div>
            </div>
            <button class="fp-add-wl-btn" onclick="event.stopPropagation();FriendWatchlistAllPage.addToMyWatchlist(${i.tmdbId||i.id},'${fpType}','${UI.escapeHtml(i.name||'').replace(/'/g,"\\'")}','${posterPath}')" title="Add to my watchlist">${UI.icon('plus', 16)}</button>
          </div>`;
        }).join('') || `<div style="padding:40px;text-align:center;color:var(--text-muted)">No results</div>`}
      </div>`;
  },
  search(q) { this.state.query = q; this._apply(); },
  setFilter(f) { this.state.filter = f; this._apply(); },
  _apply() {
    const { items, query, filter, myWatchedIds } = this.state;
    let r = [...items];
    if (query) r = r.filter(i => (i.name || '').toLowerCase().includes(query.toLowerCase()));
    if (filter === 'movie') r = r.filter(i => i.mediaType === 'movie');
    if (filter === 'tv') r = r.filter(i => i.mediaType !== 'movie');
    if (filter === 'watched') r = r.filter(i => myWatchedIds && myWatchedIds.has(String(i.tmdbId || i.id)));
    this.state.filtered = r;
    this.draw();
  },
  async addToMyWatchlist(tmdbId, type, name, posterPath) {
    try {
      await Services.addToWatchlist({ id: tmdbId, name, mediaType: type, posterPath });
      UI.toast(`Added "${name}" to your watchlist!`, 'success');
    } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
  }
};

// Friend's watch analytics page
const FriendAnalyticsPage = {
  async render(params) {
    const el = document.getElementById('page-content');
    const friendId = params.id;
    const friendName = params.name || 'Friend';
    el.innerHTML = `<div class="fp-analytics-page">${UI.pageHeader(`${UI.escapeHtml(friendName)}'s Stats`, true)}<div id="fa-content">${UI.loading()}</div></div>`;
    try {
      const [watched, ratings, myWatched] = await Promise.all([
        Services.getWatched(friendId),
        Services.getRatings(friendId),
        Services.getWatched(auth.currentUser?.uid).catch(() => [])
      ]);
      const myWatchedIds = new Set(myWatched.map(x => String(x.tmdbId)));
      const movies = watched.filter(x => x.mediaType === 'movie');
      const tv = watched.filter(x => x.mediaType !== 'movie');
      const bothWatched = watched.filter(x => myWatchedIds.has(String(x.tmdbId)));
      const avgRating = ratings.length ? (ratings.reduce((s, r) => s + (r.rating || 0), 0) / ratings.length).toFixed(1) : '—';
      const topRated = [...ratings].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
      const recentWatched = [...watched].sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0)).slice(0, 5);

      document.getElementById('fa-content').innerHTML = `
        <div class="fa-stats-grid">
          <div class="fa-stat"><span class="fa-stat-num">${watched.length}</span><span class="fa-stat-label">Total Watched</span></div>
          <div class="fa-stat"><span class="fa-stat-num">${movies.length}</span><span class="fa-stat-label">Movies</span></div>
          <div class="fa-stat"><span class="fa-stat-num">${tv.length}</span><span class="fa-stat-label">TV Shows</span></div>
          <div class="fa-stat"><span class="fa-stat-num">${ratings.length}</span><span class="fa-stat-label">Rated</span></div>
          <div class="fa-stat"><span class="fa-stat-num">${avgRating}</span><span class="fa-stat-label">Avg Rating</span></div>
          <div class="fa-stat accent"><span class="fa-stat-num">${bothWatched.length}</span><span class="fa-stat-label">Both Watched</span></div>
        </div>
        ${topRated.length ? `
        <div class="fa-section">
          <h3 class="fa-section-title">${UI.icon('star', 16)} Top Rated by ${UI.escapeHtml(friendName)}</h3>
          <div class="fp-media-list">${topRated.map(i => {
            const poster = i.posterPath ? API.imageUrl(i.posterPath, 'w92') : '';
            const t = (i.mediaType || 'tv') === 'movie' ? 'movie' : 'tv';
            return `<div class="fp-list-item" onclick="App.navigate('details',{id:${i.tmdbId||i.id},type:'${t}'})">
              ${poster ? `<img src="${poster}" class="fp-list-poster" alt="">` : `<div class="fp-list-poster-ph"></div>`}
              <div class="fp-list-info">
                <p class="fp-list-title">${UI.escapeHtml(i.name || '')}</p>
                <p class="fp-list-meta">${UI.icon('star', 12)} <strong>${i.rating}/10</strong></p>
              </div>
            </div>`;
          }).join('')}</div>
        </div>` : ''}
        ${bothWatched.length ? `
        <div class="fa-section">
          <h3 class="fa-section-title">${UI.icon('check-circle', 16)} Both Watched</h3>
          <div class="horizontal-scroll">${bothWatched.slice(0, 12).map(i => {
            const poster = i.posterPath ? API.imageUrl(i.posterPath, 'w342') : '';
            const t = (i.mediaType || 'tv') === 'movie' ? 'movie' : 'tv';
            return `<div class="media-card-sm" onclick="App.navigate('details',{id:${i.tmdbId},type:'${t}'})">
              ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="poster-placeholder">${UI.icon('film', 24)}</div>`}
              <p class="card-title">${UI.escapeHtml(i.name || '')}</p>
            </div>`;
          }).join('')}</div>
        </div>` : ''}
        <div class="fa-actions">
          <button class="btn-secondary" onclick="App.navigate('friend-watched-all',{id:'${friendId}',name:'${UI.escapeHtml(friendName)}'})">
            ${UI.icon('list', 16)} View Full Watch List
          </button>
          <button class="btn-secondary" onclick="App.navigate('matcher-setup')">
            ${UI.icon('zap', 16)} Start Matcher Session
          </button>
        </div>
      `;
    } catch (e) { document.getElementById('fa-content').innerHTML = UI.emptyState('Error', e.message); }
  }
};

const ActivityPage = {
  state: {
    friendItems: [],
    seen: new Map(),
    cursors: {},
    friendUids: [],
    loading: false,
    allLoaded: false,
    _observer: null,
    plexGroups: [],
    plexLoaded: false,
    filter: 'all'
  },

  _plexLogoSm: `<svg width="10" height="10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#E5A00D"/><path fill="#1F1F1F" d="M9 7h4.5a3.5 3.5 0 0 1 0 7H11v3H9V7zm2 2v3h2.5a1.5 1.5 0 0 0 0-3H11z"/></svg>`,

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="activity-page">
      ${UI.pageHeader('Activity Feed', true)}
      <div class="act-filter-row">
        <button class="act-filter-pill active" id="afp-all" onclick="ActivityPage.setFilter('all')">All</button>
        <button class="act-filter-pill" id="afp-friends" onclick="ActivityPage.setFilter('friends')">${UI.icon('users', 12)} Friends</button>
        <button class="act-filter-pill" id="afp-plex" onclick="ActivityPage.setFilter('plex')"><svg width="12" height="12" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:3px"><circle cx="12" cy="12" r="12" fill="#E5A00D"/><path fill="#1F1F1F" d="M9 7h4.5a3.5 3.5 0 0 1 0 7H11v3H9V7zm2 2v3h2.5a1.5 1.5 0 0 0 0-3H11z"/></svg>My Plex</button>
      </div>
      <div class="activity-feed-v2" id="act-feed-list"></div>
      <div id="feed-sentinel" style="height:1px"></div>
      <div id="feed-spinner" style="display:none;padding:16px;text-align:center">${UI.loading()}</div>
    </div>`;
    // Reset state
    this.state.friendItems = [];
    this.state.seen = new Map();
    this.state.cursors = {};
    this.state.allLoaded = false;
    this.state.loading = false;
    this.state.plexGroups = [];
    this.state.plexLoaded = false;
    this.state.filter = 'all';
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

    // Load both in parallel — plex is loaded all at once, friends paginates
    await Promise.all([this._loadFriendPage(), this._loadPlexItems()]);
    this._redrawFeed();
    this._setupObserver();
  },

  setFilter(filter) {
    this.state.filter = filter;
    ['all', 'friends', 'plex'].forEach(f => {
      document.getElementById(`afp-${f}`)?.classList.toggle('active', f === filter);
    });
    this._redrawFeed();
  },

  _groupPlexItems(items) {
    // Group TV show episodes together by show; keep movies as singles
    const showMap = new Map();
    const result = [];
    items.forEach(a => {
      if (a.mediaType === 'tv' && a.mediaId) {
        if (!showMap.has(a.mediaId)) showMap.set(a.mediaId, []);
        showMap.get(a.mediaId).push(a);
      } else {
        result.push({ _plex: true, _group: false, item: a, time: a.createdAt || 0 });
      }
    });
    showMap.forEach(eps => {
      const latest = Math.max(...eps.map(e => e.createdAt || 0));
      result.push({ _plex: true, _group: true, entries: eps, time: latest });
    });
    return result;
  },

  _redrawFeed() {
    const list = document.getElementById('act-feed-list');
    if (!list) return;
    const currentUid = auth.currentUser?.uid;
    const { filter, friendItems, plexGroups } = this.state;
    const friendSource = filter !== 'plex' ? friendItems : [];
    const plexSource = filter !== 'friends' ? plexGroups : [];

    const all = [
      ...friendSource.map(a => ({ _src: 'friend', a, time: a.createdAt || 0 })),
      ...plexSource.map(g => ({ _src: 'plex', g, time: g.time || 0 }))
    ].sort((a, b) => b.time - a.time);

    if (!all.length && this.state.allLoaded && this.state.plexLoaded) {
      list.innerHTML = `<div style="padding:40px 20px;text-align:center">
        <p style="color:var(--text-secondary);margin-bottom:16px">Nothing here yet — rate episodes, watch something, or sync Plex!</p>
        <button class="btn-secondary btn-sm" onclick="App.navigate('discover')">${UI.icon('search',14)} Discover content</button>
      </div>`;
      return;
    }

    list.innerHTML = all.map(item => {
      if (item._src === 'friend') return this._renderCard(item.a, currentUid);
      return item.g._group ? this._renderPlexGroupCard(item.g) : this._renderPlexSingleCard(item.g.item);
    }).join('');
  },

  _renderPlexSingleCard(a) {
    const poster = a.mediaPosterPath ? API.imageUrl(a.mediaPosterPath, 'w342') : '';
    const isMovie = a.mediaType === 'movie';
    const navCall = a.mediaId ? `App.navigate('details',{id:${a.mediaId},type:'${a.mediaType || 'tv'}'})` : '';
    const epLabel = !isMovie && a.seasonNumber != null ? `S${a.seasonNumber}E${a.episodeNumber}` : '';
    return `<div class="activity-card-v2 plex-activity-card" ${navCall ? `onclick="${navCall}"` : ''}>
      ${poster ? `<div class="act-poster" style="background-image:url('${poster}')"></div>` : `<div class="act-poster act-poster-ph">${UI.icon(isMovie ? 'film' : 'tv', 20)}</div>`}
      <div class="act-body">
        <div class="act-top-row">
          <span class="act-badge act-badge-plex">${this._plexLogoSm} Plex</span>
          <span class="act-badge act-badge-watched">${UI.icon('eye', 10)} Watched</span>
          ${a.createdAt ? `<span class="act-time">${UI.timeAgo(a.createdAt)}</span>` : ''}
        </div>
        <p class="act-title">${UI.escapeHtml(a.mediaTitle || '')}${epLabel ? ` <span class="act-ep-label">${epLabel}</span>` : ''}</p>
      </div>
    </div>`;
  },

  _renderPlexGroupCard(g) {
    const first = g.entries[0];
    const poster = first.mediaPosterPath ? API.imageUrl(first.mediaPosterPath, 'w342') : '';
    const epCount = g.entries.length;
    const sorted = [...g.entries].sort((a, b) => {
      const ai = (a.seasonNumber || 0) * 1000 + (a.episodeNumber || 0);
      const bi = (b.seasonNumber || 0) * 1000 + (b.episodeNumber || 0);
      return ai - bi;
    });
    const epList = sorted.slice(0, 5)
      .map(ep => ep.seasonNumber != null ? `S${ep.seasonNumber}E${ep.episodeNumber}` : '').filter(Boolean).join(', ');
    const moreEps = epCount > 5 ? ` +${epCount - 5} more` : '';
    return `<div class="activity-card-v2 plex-activity-card" onclick="${first.mediaId ? `App.navigate('details',{id:${first.mediaId},type:'tv'})` : ''}">
      ${poster ? `<div class="act-poster" style="background-image:url('${poster}')"></div>` : `<div class="act-poster act-poster-ph">${UI.icon('tv', 20)}</div>`}
      <div class="act-body">
        <div class="act-top-row">
          <span class="act-badge act-badge-plex">${this._plexLogoSm} Plex</span>
          <span class="act-badge act-badge-watched">${UI.icon('eye', 10)} ${epCount} ep${epCount !== 1 ? 's' : ''}</span>
          ${g.time ? `<span class="act-time">${UI.timeAgo(g.time)}</span>` : ''}
        </div>
        <p class="act-title">${UI.escapeHtml(first.mediaTitle || '')}</p>
        ${epList ? `<p class="act-ep-name">${UI.escapeHtml(epList)}${moreEps}</p>` : ''}
      </div>
    </div>`;
  },

  async _loadFriendPage() {
    if (this.state.loading || this.state.allLoaded || !this.state.friendUids.length) return;
    this.state.loading = true;
    const spinner = document.getElementById('feed-spinner');
    if (spinner) spinner.style.display = '';
    try {
      const { items, cursors } = await Services.getActivityFeed(this.state.friendUids, this.state.cursors, 40);
      this.state.cursors = cursors;
      const newItems = [];
      items.forEach(a => {
        const key = `${a.userId}_${a.mediaId || a.showId}_${(a.type === 'rated_episode' || a.type === 'watched_episode') ? `s${a.seasonNumber}e${a.episodeNumber}` : 'main'}`;
        if (!this.state.seen.has(key)) {
          this.state.seen.set(key, true);
          if ((a.type === 'rated' || a.type === 'rated_episode') && (!a.rating || a.rating <= 0)) return;
          newItems.push(a);
        }
      });
      if (!items.length) this.state.allLoaded = true;
      this.state.friendItems.push(...newItems);
    } catch (e) {
      if (!this.state.friendItems.length) {
        const list = document.getElementById('act-feed-list');
        if (list) list.innerHTML = UI.emptyState('Error', e.message);
      }
    } finally {
      this.state.loading = false;
      const spinner = document.getElementById('feed-spinner');
      if (spinner) spinner.style.display = 'none';
    }
  },

  async _loadPlexItems() {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) { this.state.plexLoaded = true; return; }
      const items = await Services.getPlexHistoryAsActivity(uid);
      this.state.plexGroups = this._groupPlexItems(items);
      this.state.plexLoaded = true;
    } catch (_) { this.state.plexLoaded = true; }
  },

  _setupObserver() {
    const sentinel = document.getElementById('feed-sentinel');
    if (!sentinel) return;
    this.state._observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !this.state.loading && !this.state.allLoaded) {
        this._loadFriendPage().then(() => this._redrawFeed());
      }
    }, { rootMargin: '300px' });
    this.state._observer.observe(sentinel);
  },

  _renderCard(a, currentUid) {
    const isMine = a.userId === currentUid;
    const poster = (a.mediaPosterPath || a.showPoster) ? API.imageUrl(a.mediaPosterPath || a.showPoster, 'w342') : '';
    const isEpisode = a.type === 'rated_episode';
    const isEpWatched = a.type === 'watched_episode';
    const aType = (a.mediaType || a.showType || 'tv') === 'show' ? 'tv' : (a.mediaType || a.showType || 'tv');
    const rawName = a.userName || a.username || '';
    const displayName = isMine ? 'You' : (rawName && rawName.length < 30 ? rawName : 'Someone');

    let verb, badgeClass, badgeIcon, badgeLabel;
    if (isEpisode) { verb = `S${a.seasonNumber || '?'}E${a.episodeNumber || '?'}`; badgeClass = 'act-badge-rated'; badgeIcon = 'star'; badgeLabel = 'Rated'; }
    else if (isEpWatched) { verb = `S${a.seasonNumber || '?'}E${a.episodeNumber || '?'}`; badgeClass = 'act-badge-watched'; badgeIcon = 'eye'; badgeLabel = 'Watched'; }
    else if (a.type === 'watched') { verb = ''; badgeClass = 'act-badge-watched'; badgeIcon = 'eye'; badgeLabel = 'Watched'; }
    else if (a.type === 'rated') { verb = ''; badgeClass = 'act-badge-rated'; badgeIcon = 'star'; badgeLabel = 'Rated'; }
    else if (a.type === 'added_to_watchlist') { verb = ''; badgeClass = 'act-badge-watchlist'; badgeIcon = 'bookmark'; badgeLabel = 'Saved'; }
    else if (a.type === 'shame') { verb = ''; badgeClass = 'act-badge-shame'; badgeIcon = 'flame'; badgeLabel = 'Shamed'; }
    else { verb = ''; badgeClass = 'act-badge-watched'; badgeIcon = 'activity'; badgeLabel = a.type || 'Activity'; }

    const avatarHtml = a.userPhoto
      ? `<img src="${UI.escapeHtml(a.userPhoto)}" class="act-avatar-img" alt="">`
      : `<div class="act-avatar-initial">${(a.userName || a.username || '?')[0].toUpperCase()}</div>`;

    const ratingHtml = (a.type === 'rated' || isEpisode) && a.rating
      ? `<div class="act-rating-inline"><span class="act-rating-score">${a.rating}</span><span class="act-rating-max">/10</span></div>`
      : '';

    const episodeRow = (isEpisode || isEpWatched) && a.episodeName
      ? `<p class="act-ep-name">${UI.escapeHtml(a.episodeName)}</p>` : '';

    return `<div class="activity-card-v2" onclick="App.navigate('details',{id:${a.mediaId || a.showId},type:'${aType}'})">
      ${poster ? `<div class="act-poster" style="background-image:url('${poster}')"></div>` : `<div class="act-poster act-poster-ph">${UI.icon(aType === 'movie' ? 'film' : 'tv', 20)}</div>`}
      <div class="act-body">
        <div class="act-top-row">
          <div class="act-avatar-sm">${avatarHtml}</div>
          <span class="act-username">${UI.escapeHtml(displayName)}</span>
          <span class="act-badge ${badgeClass}">${UI.icon(badgeIcon, 10)} ${badgeLabel}</span>
          ${a.createdAt ? `<span class="act-time">${UI.timeAgo(a.createdAt)}</span>` : ''}
        </div>
        <p class="act-title">${UI.escapeHtml(a.mediaTitle || a.showName || '')}${verb ? ` <span class="act-ep-label">${verb}</span>` : ''}</p>
        ${episodeRow}
        ${ratingHtml}
        ${a.comment ? `<p class="act-comment">"${UI.escapeHtml(a.comment)}"</p>` : ''}
      </div>
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
    const poster = (s.mediaPosterPath || s.showPoster) ? API.imageUrl(s.mediaPosterPath || s.showPoster, 'w342') : '';
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
