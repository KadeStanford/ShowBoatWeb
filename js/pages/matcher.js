/* ShowBoat — Matcher Pages: Setup, Swipe, Results, History */
const MatcherSetupPage = {
  state: { friends: [], selected: null, type: 'movie', genres: [] },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="matcher-page">${UI.pageHeader('Movie Night Matcher', true)}<div id="matcher-setup">${UI.loading()}</div></div>`;
    try {
      this.state.friends = await Services.getFriends();
      this.draw();
    } catch (e) { document.getElementById('matcher-setup').innerHTML = UI.emptyState('Error', e.message); }
  },

  draw() {
    const el = document.getElementById('matcher-setup');
    if (!this.state.friends.length) { el.innerHTML = UI.emptyState('No friends', 'Add friends to start matching!'); return; }
    el.innerHTML = `
      <div class="matcher-setup-content">
        <p class="setup-desc">Pick a friend and swipe on shows/movies together. Find what you both want to watch!</p>
        <div class="setup-section">
          <h3>Select a Friend</h3>
          <div class="friend-select-list">${this.state.friends.map(f => `<button class="friend-select-btn ${this.state.selected === f.friendId ? 'active' : ''}" onclick="MatcherSetupPage.selectFriend('${f.friendId}','${UI.escapeHtml(f.friendUsername || '')}')">
            <div class="friend-avatar">${(f.friendUsername || '?')[0].toUpperCase()}</div>
            <span>${UI.escapeHtml(f.friendUsername || f.friendId)}</span>
          </button>`).join('')}</div>
        </div>
        <div class="setup-section">
          <h3>Content Type</h3>
          <div class="filter-tabs">
            <button class="filter-tab ${this.state.type === 'movie' ? 'active' : ''}" onclick="MatcherSetupPage.setType('movie')">Movies</button>
            <button class="filter-tab ${this.state.type === 'tv' ? 'active' : ''}" onclick="MatcherSetupPage.setType('tv')">TV Shows</button>
          </div>
        </div>
        <button class="btn-primary start-matcher-btn" onclick="MatcherSetupPage.start()" ${!this.state.selected ? 'disabled' : ''}>Start Matching</button>
      </div>`;
  },

  selectFriend(id, name) {
    this.state.selected = id;
    this.state.selectedName = name;
    document.querySelectorAll('.friend-select-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelector('.start-matcher-btn')?.removeAttribute('disabled');
  },

  setType(type) {
    this.state.type = type;
    document.querySelectorAll('.setup-section .filter-tab').forEach(b => {
      b.classList.toggle('active', b.textContent.toLowerCase().includes(type));
    });
  },

  async start() {
    if (!this.state.selected) return;
    try {
      const session = await Services.createMatcherSession(this.state.selected, this.state.type);
      App.navigate('matcher-swipe', { sessionId: session.id, type: this.state.type });
    } catch (e) { UI.toast('Failed to create session', 'error'); }
  }
};

const MatcherSwipePage = {
  state: { sessionId: '', items: [], current: 0, votes: {} },

  async render(params) {
    this.state.sessionId = params.sessionId;
    this.state.current = 0;
    this.state.votes = {};
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const type = params.type || 'movie';
      const items = await API.getTrending(type);
      this.state.items = items.slice(0, 20);
      this.draw(el);
    } catch (e) { el.innerHTML = UI.emptyState('Error', e.message); }
  },

  draw(el) {
    const item = this.state.items[this.state.current];
    if (!item) { this.finish(el); return; }
    const backdrop = item.backdrop_path ? API.imageUrl(item.backdrop_path, 'w780') : '';
    const poster = item.poster_path ? API.imageUrl(item.poster_path, 'w342') : '';
    const title = item.name || item.title || '';
    const overview = (item.overview || '').substring(0, 150);
    const progress = `${this.state.current + 1} / ${this.state.items.length}`;

    el.innerHTML = `<div class="swipe-page">
      <div class="swipe-header">
        <button class="back-btn-sm" onclick="App.back()">${UI.icon('x', 22)}</button>
        <span class="swipe-progress">${progress}</span>
      </div>
      <div class="swipe-card" id="swipe-card" style="background-image:linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.9)), url('${backdrop || ''}')">
        <div class="swipe-card-content">
          ${poster ? `<img src="${poster}" class="swipe-poster" alt="">` : ''}
          <h2 class="swipe-title">${UI.escapeHtml(title)}</h2>
          ${item.vote_average ? `<p class="swipe-meta">${UI.icon('star', 14)} ${item.vote_average.toFixed(1)}</p>` : ''}
          ${overview ? `<p class="swipe-overview">${UI.escapeHtml(overview)}...</p>` : ''}
        </div>
      </div>
      <div class="swipe-buttons">
        <button class="swipe-btn dislike" onclick="MatcherSwipePage.vote(false)">${UI.icon('x', 28)}</button>
        <button class="swipe-btn like" onclick="MatcherSwipePage.vote(true)">${UI.icon('heart', 28)}</button>
      </div>
    </div>`;
  },

  async vote(liked) {
    const item = this.state.items[this.state.current];
    if (!item) return;
    this.state.votes[item.id] = liked;
    // Animate card out
    const card = document.getElementById('swipe-card');
    if (card) { card.style.transform = `translateX(${liked ? 100 : -100}%) rotate(${liked ? 15 : -15}deg)`; card.style.opacity = '0'; card.style.transition = 'all 0.3s ease'; }
    await new Promise(r => setTimeout(r, 300));
    this.state.current++;
    const el = document.getElementById('page-content');
    this.draw(el);
  },

  async finish(el) {
    el.innerHTML = UI.loading();
    try {
      const liked = Object.entries(this.state.votes).filter(([, v]) => v).map(([id]) => parseInt(id));
      await Services.submitVote(this.state.sessionId, liked);
      App.navigate('matcher-results', { sessionId: this.state.sessionId });
    } catch (e) { el.innerHTML = UI.emptyState('Error submitting', e.message); }
  }
};

const MatcherResultsPage = {
  async render(params) {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const session = await Services.getMatcherSession(params.sessionId);
      if (!session) { el.innerHTML = UI.emptyState('Session not found'); return; }
      const myVotes = new Set(session.votes?.[auth.currentUser.uid] || []);
      const otherUid = Object.keys(session.votes || {}).find(k => k !== auth.currentUser.uid);
      const otherVotes = new Set(session.votes?.[otherUid] || []);
      const matches = [...myVotes].filter(id => otherVotes.has(id));

      let matchDetails = [];
      for (const id of matches.slice(0, 10)) {
        try {
          const type = session.type || 'movie';
          const d = type === 'movie' ? await API.getMovieDetails(id) : await API.getShowDetails(id);
          if (d) matchDetails.push({ ...d, media_type: type });
        } catch (_) {}
      }

      el.innerHTML = `<div class="results-page">
        ${UI.pageHeader('Match Results', true)}
        <div class="results-summary">
          <div class="match-count">${matches.length}</div>
          <p>Matches Found!</p>
        </div>
        ${matchDetails.length ? `<div class="media-grid">${matchDetails.map(m => {
          const poster = m.poster_path ? API.imageUrl(m.poster_path, 'w342') : '';
          return `<div class="media-card" onclick="App.navigate('details',{id:${m.id},type:'${m.media_type}'})">
            ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="poster-placeholder">${UI.icon('film', 32)}</div>`}
            <div class="card-info"><p class="card-title">${UI.escapeHtml(m.name || m.title || '')}</p><p class="card-meta">${UI.icon('star', 12)} ${(m.vote_average || 0).toFixed(1)}</p></div>
          </div>`;
        }).join('')}</div>` : '<p class="empty-text">Waiting for your friend to finish swiping...</p>'}
        <button class="btn-primary" onclick="App.navigate('home')" style="margin-top:24px">Back to Home</button>
      </div>`;
    } catch (e) { el.innerHTML = UI.pageHeader('Results', true) + UI.emptyState('Error', e.message); }
  }
};

const MatcherHistoryPage = {
  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="history-page">${UI.pageHeader('Matcher History', true)}<div id="history-list">${UI.loading()}</div></div>`;
    try {
      const sessions = await Services.getMatcherHistory();
      const list = document.getElementById('history-list');
      if (!sessions.length) { list.innerHTML = UI.emptyState('No history', 'Start a matcher session to see history here'); return; }
      list.innerHTML = `<div class="history-items">${sessions.map(s => {
        const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '';
        const myVotes = new Set(s.votes?.[auth.currentUser.uid] || []);
        const otherUid = Object.keys(s.votes || {}).find(k => k !== auth.currentUser.uid);
        const otherVotes = new Set(s.votes?.[otherUid] || []);
        const matches = [...myVotes].filter(id => otherVotes.has(id));
        return `<div class="history-item" onclick="App.navigate('matcher-results',{sessionId:'${s.id}'})">
          <div class="history-info">
            <p class="history-type">${(s.type || 'movie') === 'movie' ? 'Movies' : 'TV Shows'}</p>
            <p class="history-matches">${matches.length} match${matches.length !== 1 ? 'es' : ''}</p>
            ${date ? `<p class="history-date">${date}</p>` : ''}
          </div>
          ${UI.icon('chevron-right', 18)}
        </div>`;
      }).join('')}</div>`;
    } catch (e) { document.getElementById('history-list').innerHTML = UI.emptyState('Error', e.message); }
  }
};
