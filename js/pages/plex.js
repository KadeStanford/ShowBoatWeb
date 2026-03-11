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
            let serverName = '';
            try {
              const resources = await PlexAPI.getResources(result.authToken);
              const server = resources?.find(r => r.provides === 'server');
              if (server) {
                serverName = server.name || '';
                Services.plex.connect(serverName, result.authToken);
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

  // Paginated fetch: gets ALL items from a Plex section endpoint
  async _fetchAllPaged(token, server, basePath) {
    const pageSize = 200;
    let start = 0;
    const all = [];
    while (true) {
      const sep = basePath.includes('?') ? '&' : '?';
      const url = `${basePath}${sep}X-Plex-Container-Start=${start}&X-Plex-Container-Size=${pageSize}`;
      const data = await PlexAPI.serverFetch(token, server, url);
      const items = data?.MediaContainer?.Metadata || [];
      all.push(...items);
      const totalSize = data?.MediaContainer?.totalSize || 0;
      start += pageSize;
      if (items.length < pageSize || start >= totalSize) break;
    }
    return all;
  },

  async syncNow() {
    const btn = document.getElementById('plex-sync-btn');
    if (!btn) return;
    btn.disabled = true; btn.innerHTML = `${UI.icon('activity', 18)} Syncing...`;
    try {
      const token = Services.plex.token;
      if (!token) { UI.toast('Not connected to Plex', 'error'); return; }

      const resources = await PlexAPI.getResources(token);
      const server = resources?.find(r => r.provides?.includes('server'));
      if (!server) { UI.toast('No Plex server found on your account', 'error'); return; }

      btn.innerHTML = `${UI.icon('activity', 18)} Connecting to ${UI.escapeHtml(server.name || 'server')}...`;

      const sectionsData = await PlexAPI.serverFetch(token, server, '/library/sections');
      if (!sectionsData) {
        UI.toast(`Could not reach "${server.name}". Make sure remote access is enabled in Plex settings.`, 'error');
        return;
      }

      const sections = sectionsData?.MediaContainer?.Directory || [];
      const allItems = [];

      btn.innerHTML = `${UI.icon('activity', 18)} Fetching ALL watch history...`;

      for (const section of sections.filter(s => s.type === 'show' || s.type === 'movie')) {
        if (section.type === 'show') {
          const metadata = await this._fetchAllPaged(token, server, `/library/sections/${section.key}/all?type=4&viewCount%3E=1&sort=lastViewedAt:desc`);
          metadata.forEach(m => {
            allItems.push({
              title: m.grandparentTitle || m.title || '',
              episodeTitle: m.title || '',
              season: m.parentIndex,
              episode: m.index,
              year: m.year || m.parentYear || '',
              type: 'show',
              thumb: m.grandparentThumb || m.thumb || '',
              lastViewedAt: m.lastViewedAt
            });
          });
        } else {
          const metadata = await this._fetchAllPaged(token, server, `/library/sections/${section.key}/all?unwatched=0&sort=lastViewedAt:desc`);
          metadata.forEach(m => {
            allItems.push({
              title: m.title || '',
              year: m.year || '',
              type: 'movie',
              thumb: m.thumb || '',
              lastViewedAt: m.lastViewedAt
            });
          });
        }
      }

      // Fallback if nothing found
      if (!allItems.length) {
        for (const section of sections.filter(s => s.type === 'show' || s.type === 'movie')) {
          const recentData = await PlexAPI.serverFetch(token, server, `/library/sections/${section.key}/recentlyViewed`);
          if (recentData) {
            (recentData?.MediaContainer?.Metadata || []).forEach(m => {
              allItems.push({ title: m.title || m.grandparentTitle || '', year: m.year || '', type: section.type, thumb: m.thumb || '' });
            });
          }
        }
      }

      if (allItems.length) {
        btn.innerHTML = `${UI.icon('activity', 18)} Matching with TMDB...`;
        // Build unique title+type map for matching
        const uniqueKeys = new Map();
        allItems.forEach(item => {
          const key = `${item.type}:${item.title}`;
          if (!uniqueKeys.has(key)) uniqueKeys.set(key, item);
        });

        const tmdbCache = {};
        const matchEntries = [...uniqueKeys.values()];
        const batchSize = 5;
        for (let i = 0; i < matchEntries.length; i += batchSize) {
          const batch = matchEntries.slice(i, i + batchSize);
          const results = await Promise.all(batch.map(item => this._matchTmdb(item)));
          results.filter(Boolean).forEach(r => { tmdbCache[r.key] = r; });
          // Update progress on button
          const pct = Math.round(((i + batchSize) / matchEntries.length) * 100);
          btn.innerHTML = `${UI.icon('activity', 18)} Matching... ${Math.min(pct, 100)}%`;
        }

        // Enrich items with TMDB data
        allItems.forEach(item => {
          const match = tmdbCache[`${item.type}:${item.title}`];
          if (match) {
            item.tmdbId = match.tmdbId;
            item.posterPath = match.posterPath;
            item.tmdbTitle = match.tmdbTitle;
          }
        });

        Services.plex.setLibrary(allItems);
        // Persist to Firestore
        btn.innerHTML = `${UI.icon('activity', 18)} Saving...`;
        try { await Services.savePlexHistory(allItems); } catch (_) {}

        // Backport to activity log
        btn.innerHTML = `${UI.icon('activity', 18)} Updating activity...`;
        try { await Services.backportPlexActivity(allItems); } catch (_) {}

        Services.plex.connect(server.name, token);
        this.state.server = server.name;
        UI.toast(`Synced ${allItems.length} items from "${server.name}"`, 'success');
      } else {
        UI.toast(`Connected to "${server.name}" but no watched items found.`, 'info');
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
  },

  // Parse a raw Plex title into clean title + optional year + optional region/country code.
  // Handles cases like:
  //   "Ghosts (2021)"            → { title: "Ghosts", year: 2021, region: null }
  //   "The Office (US)"          → { title: "The Office", year: null, region: "US" }
  //   "Ghosts (US) (2021)"       → { title: "Ghosts", year: 2021, region: "US" }
  //   "Monarch: Legacy (2023) [UHD]" → { title: "Monarch: Legacy", year: 2023, region: null }
  _parseTitle(rawTitle) {
    let title = (rawTitle || '').trim();

    // Strip square-bracket quality/edition tags: [4K], [UHD], [Extended Cut], etc.
    title = title.replace(/\s*\[[^\]]*\]\s*/g, '').trim();

    let year = null;
    let region = null;

    // Try to match combined patterns first: "Title (US) (2021)" or "Title (2021) (US)"
    const combined1 = title.match(/^(.*?)\s*\(([A-Z]{2,4})\)\s*\((\d{4})\)\s*$/);
    const combined2 = title.match(/^(.*?)\s*\((\d{4})\)\s*\(([A-Z]{2,4})\)\s*$/);
    if (combined1) {
      title = combined1[1].trim();
      region = combined1[2];
      year = parseInt(combined1[3]);
      return { title, year, region };
    }
    if (combined2) {
      title = combined2[1].trim();
      year = parseInt(combined2[2]);
      region = combined2[3];
      return { title, year, region };
    }

    // Strip trailing year: "Ghosts (2021)"
    const yearMatch = title.match(/^(.*?)\s*\((\d{4})\)\s*$/);
    if (yearMatch) {
      year = parseInt(yearMatch[2]);
      title = yearMatch[1].trim();
    }

    // Strip trailing region code (2-4 uppercase letters) after any year is removed
    const regionMatch = title.match(/^(.*?)\s*\(([A-Z]{2,4})\)\s*$/);
    if (regionMatch) {
      // Only treat as region if it looks like a country/language code, not an acronym title
      const knownRegions = new Set(['US', 'UK', 'GB', 'AU', 'CA', 'NZ', 'IE', 'IN', 'ZA', 'SG', 'HK', 'TW', 'JP', 'KR', 'FR', 'DE', 'ES', 'IT', 'MX', 'BR', 'AR', 'CL', 'PT', 'NL', 'SE', 'NO', 'DK', 'FI', 'PL', 'RU', 'TR']);
      if (knownRegions.has(regionMatch[2])) {
        region = regionMatch[2];
        title = regionMatch[1].trim();
      }
    }

    return { title, year, region };
  },

  // Score a TMDB result against the parsed title components.
  _scoreTmdbMatch(result, cleanTitle, year, region) {
    let score = 0;
    const rTitle = (result.name || result.title || '').toLowerCase();
    const sTitle = cleanTitle.toLowerCase();

    // Title similarity
    if (rTitle === sTitle) score += 100;
    else if (rTitle.startsWith(sTitle) || sTitle.startsWith(rTitle)) score += 60;
    else if (rTitle.includes(sTitle) || sTitle.includes(rTitle)) score += 30;

    // Year match
    if (year) {
      const rYear = parseInt((result.first_air_date || result.release_date || '').substring(0, 4));
      if (rYear === year) score += 80;
      else if (Math.abs(rYear - year) === 1) score += 25; // off-by-one common for Jan air dates
      else if (rYear > 0) score -= 20; // wrong year penalises
    }

    // Region / origin country match
    if (region) {
      // Map common Plex region codes to ISO 3166-1 alpha-2
      const regionToCountry = { US: 'US', UK: 'GB', GB: 'GB', AU: 'AU', CA: 'CA', NZ: 'NZ', IE: 'IE', IN: 'IN', ZA: 'ZA', SG: 'SG', HK: 'HK', TW: 'TW', JP: 'JP', KR: 'KR', FR: 'FR', DE: 'DE', ES: 'ES', IT: 'IT', MX: 'MX', BR: 'BR', PT: 'PT', NL: 'NL', SE: 'SE', NO: 'NO', DK: 'DK', FI: 'FI', PL: 'PL' };
      const regionToLang = { US: 'en', UK: 'en', GB: 'en', AU: 'en', CA: 'en', NZ: 'en', JP: 'ja', KR: 'ko', FR: 'fr', DE: 'de', ES: 'es', IT: 'it', PT: 'pt', NL: 'nl', SE: 'sv', NO: 'no', DK: 'da', FI: 'fi', PL: 'pl', BR: 'pt', MX: 'es', AR: 'es' };
      const iso = regionToCountry[region];
      const lang = regionToLang[region];
      if (iso && result.origin_country?.includes(iso)) score += 50;
      if (lang && result.original_language === lang) score += 15;
    }

    // Prefer results that have a poster
    if (result.poster_path) score += 5;

    return score;
  },

  // Search TMDB for a single Plex item and return the best-scored match.
  async _matchTmdb(item) {
    const { title: cleanTitle, year, region } = this._parseTitle(item.title);
    // Plex sometimes provides the year in a separate field — use as extra signal
    const fallbackYear = item.year ? parseInt(item.year) : null;
    const searchYear = year || fallbackYear;

    try {
      const searchFn = item.type === 'movie' ? API.searchMovies : API.searchShows;
      let results = await searchFn.call(API, cleanTitle, 1);

      // If no results under cleaned title, retry with the raw title
      if ((!results || !results.length) && cleanTitle !== item.title.trim()) {
        results = await searchFn.call(API, item.title.trim(), 1);
      }
      if (!results || !results.length) return null;

      // Score all returned results and pick the winner
      const scored = results
        .map(r => ({ r, score: this._scoreTmdbMatch(r, cleanTitle, searchYear, region) }))
        .sort((a, b) => b.score - a.score);

      const best = scored[0].r;
      return {
        key: `${item.type}:${item.title}`,
        tmdbId: best.id,
        posterPath: best.poster_path,
        tmdbTitle: best.name || best.title
      };
    } catch (_) {
      return null;
    }
  }
};

const PlexWatchedPage = {
  state: { items: [], tab: 'all', loading: true },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="plex-watched-page">
      ${UI.pageHeader('Plex Watch History', true)}
      <div class="filter-tabs" id="plex-tabs">
        ${['all', 'show', 'movie'].map(t => `<button class="filter-tab ${this.state.tab === t ? 'active' : ''}" onclick="PlexWatchedPage.setTab('${t}')">${t === 'all' ? 'All' : t === 'show' ? 'TV Shows' : 'Movies'}</button>`).join('')}
      </div>
      <div id="plex-watched-content">${UI.loading()}</div>
    </div>`;
    await this.loadItems();
  },

  async loadItems() {
    const content = document.getElementById('plex-watched-content');
    try {
      // Try Firestore first, then localStorage fallback
      let items = await Services.getPlexHistory();
      if (!items.length) items = Services.plex.getLibrary();
      this.state.items = items;
      this.state.loading = false;
      this.draw();
    } catch (_) {
      this.state.items = Services.plex.getLibrary();
      this.state.loading = false;
      this.draw();
    }
  },

  setTab(tab) {
    this.state.tab = tab;
    document.querySelectorAll('#plex-tabs .filter-tab').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    this.draw();
  },

  draw() {
    const content = document.getElementById('plex-watched-content');
    if (!content) return;
    let items = this.state.items;
    if (!items.length) {
      content.innerHTML = UI.emptyState('monitor', 'No Plex history', 'Sync your Plex account to see watch history here');
      return;
    }
    // Filter by tab
    if (this.state.tab !== 'all') items = items.filter(i => i.type === this.state.tab);
    if (!items.length) {
      content.innerHTML = UI.emptyState('monitor', `No ${this.state.tab === 'show' ? 'TV' : 'movie'} history`, 'Nothing matched this filter');
      return;
    }
    // Sort by lastViewedAt descending
    items.sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0));

    // Group by date
    const groups = {};
    items.forEach(item => {
      const ts = item.lastViewedAt ? item.lastViewedAt * 1000 : null;
      const dateKey = ts ? new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown Date';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });

    let html = '<div class="plex-history-list">';
    for (const [date, groupItems] of Object.entries(groups)) {
      html += `<div class="plex-date-separator"><span>${UI.escapeHtml(date)}</span><span class="plex-date-count">${groupItems.length} item${groupItems.length > 1 ? 's' : ''}</span></div>`;
      html += '<div class="plex-history-group">';
      groupItems.forEach(item => {
        const poster = item.posterPath ? API.imageUrl(item.posterPath, 'w185') : '';
        const subtitle = item.type === 'show' && item.season != null
          ? `S${item.season}E${item.episode}${item.episodeTitle ? ' — ' + UI.escapeHtml(item.episodeTitle) : ''}`
          : (item.year ? `${item.year}` : '');
        const onclick = item.tmdbId ? `onclick="App.navigate('details',{id:${item.tmdbId},type:'${item.type === 'show' ? 'tv' : 'movie'}'})"`  : '';
        html += `<div class="plex-history-item" ${onclick} style="${item.tmdbId ? 'cursor:pointer' : ''}">
          ${poster ? `<img src="${poster}" class="plex-poster" alt="" loading="lazy">` : `<div class="plex-poster placeholder">${UI.icon(item.type === 'movie' ? 'film' : 'tv', 24)}</div>`}
          <div class="plex-item-info">
            <p class="plex-item-title">${UI.escapeHtml(item.title || '')}</p>
            ${subtitle ? `<p class="plex-item-sub">${subtitle}</p>` : ''}
            <span class="plex-tag">${item.type === 'movie' ? 'Movie' : 'TV'}</span>
          </div>
        </div>`;
      });
      html += '</div>';
    }
    html += '</div>';
    content.innerHTML = html;
  }
};
