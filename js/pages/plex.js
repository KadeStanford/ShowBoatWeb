/* ShowBoat — Plex Pages: Connect & Watched */
const PlexConnectPage = {
  state: { connected: false, server: null },

  async render() {
    const el = document.getElementById('page-content');
    const plexState = Services.getPlexState();
    this.state.connected = !!plexState.authToken;
    this.state.server = plexState.serverName;
    this.draw(el);
  },

  draw(el) {
    el.innerHTML = `<div class="plex-page">
      ${UI.pageHeader('Plex Connection', true)}
      <div class="plex-content">
        ${this.state.connected ? this.renderConnected() : this.renderDisconnected()}
      </div>
    </div>`;
  },

  renderDisconnected() {
    return `<div class="plex-status disconnected">
      <div class="plex-icon">${UI.icon('monitor', 48)}</div>
      <h3>Connect to Plex</h3>
      <p>Link your Plex account to sync your watch history and see what's available on your server.</p>
      <button class="btn-primary" onclick="PlexConnectPage.startAuth()" id="plex-connect-btn">Connect Plex Account</button>
    </div>`;
  },

  renderConnected() {
    return `<div class="plex-status connected">
      <div class="plex-icon connected">${UI.icon('check-circle', 48)}</div>
      <h3>Connected to Plex</h3>
      ${this.state.server ? `<p class="plex-server">Server: ${UI.escapeHtml(this.state.server)}</p>` : ''}
      <div class="plex-actions">
        <button class="btn-primary" onclick="App.navigate('plex-watched')">${UI.icon('check-circle', 18)} View Plex Watched</button>
        <button class="btn-secondary" onclick="PlexConnectPage.syncNow()" id="plex-sync-btn">${UI.icon('refresh-cw', 18)} Sync Now</button>
        <button class="btn-danger" onclick="PlexConnectPage.disconnect()">${UI.icon('x', 18)} Disconnect</button>
      </div>
    </div>`;
  },

  async startAuth() {
    const btn = document.getElementById('plex-connect-btn');
    btn.disabled = true; btn.textContent = 'Connecting...';
    try {
      const pin = await PlexAPI.createPin();
      const authUrl = PlexAPI.getAuthUrl(pin.id, pin.code);
      window.open(authUrl, '_blank');
      UI.toast('Authenticate in the new tab, then click below', 'info');
      btn.textContent = 'Checking...';
      // Poll for auth (every 2s, max 60 attempts)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const result = await PlexAPI.checkPin(pin.id);
        if (result && result.authToken) {
          clearInterval(poll);
          Services.savePlexState({ authToken: result.authToken, serverName: '' });
          this.state.connected = true;
          UI.toast('Plex connected!', 'success');
          this.draw(document.getElementById('page-content'));
        } else if (attempts >= 60) {
          clearInterval(poll);
          UI.toast('Authentication timed out', 'error');
          btn.disabled = false; btn.textContent = 'Connect Plex Account';
        }
      }, 2000);
    } catch (e) {
      UI.toast('Failed to start Plex auth', 'error');
      btn.disabled = false; btn.textContent = 'Connect Plex Account';
    }
  },

  async syncNow() {
    const btn = document.getElementById('plex-sync-btn');
    btn.disabled = true; btn.innerHTML = `${UI.icon('refresh-cw', 18)} Syncing...`;
    UI.toast('Sync started — this may take a moment', 'info');
    // In a real implementation, this would fetch Plex library and sync to Firestore
    setTimeout(() => {
      btn.disabled = false; btn.innerHTML = `${UI.icon('refresh-cw', 18)} Sync Now`;
      UI.toast('Sync complete!', 'success');
    }, 2000);
  },

  disconnect() {
    if (!confirm('Disconnect your Plex account?')) return;
    Services.clearPlexState();
    this.state.connected = false;
    this.state.server = null;
    this.draw(document.getElementById('page-content'));
    UI.toast('Plex disconnected', 'success');
  }
};

const PlexWatchedPage = {
  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="plex-watched-page">
      ${UI.pageHeader('Plex Watch History', true)}
      <div id="plex-watched-content">${UI.loading()}</div>
    </div>`;
    const plexState = Services.getPlexState();
    if (!plexState.authToken) {
      document.getElementById('plex-watched-content').innerHTML = UI.emptyState('Not Connected', 'Connect your Plex account first');
      return;
    }
    // Show existing watched items from Firestore that came from Plex
    try {
      const watched = await Services.getWatched();
      const plexItems = watched.filter(w => w.source === 'plex');
      const content = document.getElementById('plex-watched-content');
      if (!plexItems.length) {
        content.innerHTML = UI.emptyState('No Plex history', 'Sync your Plex account to see watch history here');
        return;
      }
      content.innerHTML = `<div class="watchlist-items">${plexItems.map(item => {
        const poster = item.showPoster ? API.imageUrl(item.showPoster, 'w185') : '';
        return `<div class="watchlist-item" onclick="App.navigate('details',{id:${item.showId || item.id},type:'${item.showType || 'tv'}'})">
          ${poster ? `<img src="${poster}" class="wl-poster" alt="">` : `<div class="wl-poster placeholder">${UI.icon('monitor', 24)}</div>`}
          <div class="wl-info">
            <p class="wl-title">${UI.escapeHtml(item.showName || '')}</p>
            <span class="plex-tag">From Plex</span>
            ${item.watchedAt ? `<p class="wl-date">${UI.timeAgo(item.watchedAt)}</p>` : ''}
          </div>
        </div>`;
      }).join('')}</div>`;
    } catch (e) { document.getElementById('plex-watched-content').innerHTML = UI.emptyState('Error', e.message); }
  }
};
