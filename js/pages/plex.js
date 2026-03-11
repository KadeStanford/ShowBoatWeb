/* ShowBoat — Plex Pages: Connect & Watched */
const PlexConnectPage = {
  state: { connected: false, server: null },

  async render() {
    const el = document.getElementById('page-content');
    this.state.connected = Services.plex.isConnected;
    this.state.server = Services.plex.serverUrl || null;
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
        <button class="btn-secondary" onclick="PlexConnectPage.syncNow()" id="plex-sync-btn">${UI.icon('activity', 18)} Sync Now</button>
        <button class="btn-secondary" style="border-color:var(--rose-500);color:var(--rose-400)" onclick="PlexConnectPage.disconnect()">${UI.icon('x', 18)} Disconnect</button>
      </div>
    </div>`;
  },

  async startAuth() {
    const btn = document.getElementById('plex-connect-btn');
    btn.disabled = true; btn.textContent = 'Connecting...';
    try {
      const pin = await PlexAPI.createPin();
      const authUrl = PlexAPI.getAuthUrl(pin.code);
      window.open(authUrl, '_blank');
      UI.toast('Authenticate in the new tab, then wait for confirmation', 'info');
      btn.textContent = 'Waiting for auth...';
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const result = await PlexAPI.checkPin(pin.id);
          if (result && result.authToken) {
            clearInterval(poll);
            // Try to find servers
            let serverName = '';
            try {
              const resources = await PlexAPI.getResources(result.authToken);
              const server = resources?.find(r => r.provides === 'server');
              if (server) {
                const conn = server.connections?.find(c => c.local === false) || server.connections?.[0];
                if (conn) Services.plex.connect(conn.uri, result.authToken);
                serverName = server.name || '';
              } else {
                Services.plex.connect('', result.authToken);
              }
            } catch (_) {
              Services.plex.connect('', result.authToken);
            }
            this.state.connected = true;
            this.state.server = serverName;
            UI.toast('Plex connected!', 'success');
            this.draw(document.getElementById('page-content'));
          } else if (attempts >= 60) {
            clearInterval(poll);
            UI.toast('Authentication timed out', 'error');
            btn.disabled = false; btn.textContent = 'Connect Plex Account';
          }
        } catch (_) {
          if (attempts >= 60) { clearInterval(poll); btn.disabled = false; btn.textContent = 'Connect Plex Account'; }
        }
      }, 2000);
    } catch (e) {
      UI.toast('Failed to start Plex auth', 'error');
      btn.disabled = false; btn.textContent = 'Connect Plex Account';
    }
  },

  async syncNow() {
    const btn = document.getElementById('plex-sync-btn');
    if (!btn) return;
    btn.disabled = true; btn.innerHTML = `${UI.icon('activity', 18)} Syncing...`;
    try {
      const token = Services.plex.token;
      const serverUrl = Services.plex.serverUrl;
      if (!token) { UI.toast('Not connected to Plex', 'error'); return; }
      if (serverUrl) {
        // Fetch library sections
        const res = await fetch(`${serverUrl}/library/sections?X-Plex-Token=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
        const data = await res.json();
        const sections = data?.MediaContainer?.Directory || [];
        // Fetch recently watched from each section
        const allItems = [];
        for (const section of sections.filter(s => s.type === 'show' || s.type === 'movie')) {
          try {
            const r = await fetch(`${serverUrl}/library/sections/${section.key}/recentlyViewed?X-Plex-Token=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
            const d = await r.json();
            (d?.MediaContainer?.Metadata || []).forEach(m => allItems.push({ title: m.title, year: m.year, type: section.type }));
          } catch (_) {}
        }
        Services.plex.setLibrary(allItems);
        UI.toast(`Synced ${allItems.length} items from Plex`, 'success');
      } else {
        UI.toast('No Plex server URL configured', 'info');
      }
    } catch (e) {
      UI.toast('Sync failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.innerHTML = `${UI.icon('activity', 18)} Sync Now`;
    }
  },

  disconnect() {
    if (!confirm('Disconnect your Plex account?')) return;
    Services.plex.disconnect();
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
    if (!Services.plex.isConnected) {
      document.getElementById('plex-watched-content').innerHTML = UI.emptyState('monitor', 'Not Connected', 'Connect your Plex account first');
      return;
    }
    // Show items from local Plex library cache
    const plexItems = Services.plex.getLibrary();
    const content = document.getElementById('plex-watched-content');
    if (!plexItems.length) {
      content.innerHTML = UI.emptyState('monitor', 'No Plex history', 'Sync your Plex account to see watch history here');
      return;
    }
    content.innerHTML = `<div class="watchlist-items">${plexItems.map(item => {
      return `<div class="watchlist-item">
        <div class="wl-poster placeholder">${UI.icon('monitor', 24)}</div>
        <div class="wl-info">
          <p class="wl-title">${UI.escapeHtml(item.title || '')}</p>
          <span class="plex-tag">From Plex</span>
          ${item.year ? `<p class="wl-date">${item.year} &middot; ${item.type === 'show' ? 'TV Show' : 'Movie'}</p>` : ''}
        </div>
      </div>`;
    }).join('')}</div>`;
  }
};
