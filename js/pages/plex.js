/* ShowBoat — Plex Pages: Connect & Watched */
const PlexConnectPage = {
  state: { connected: false, server: null },

  async render() {
    const el = document.getElementById('page-content');
    this.state.connected = Services.plex.isConnected;
    this.state.server = Services.plex.serverUrl || null;
    this.draw(el);
    // Resume pending Plex auth (e.g. mobile redirect flow returned to app)
    const pendingPin = localStorage.getItem('plex_pending_pin');
    if (pendingPin && !this.state.connected) {
      try {
        const { id } = JSON.parse(pendingPin);
        this._pollPin(id, true);
      } catch (_) { localStorage.removeItem('plex_pending_pin'); }
    }
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
    const pendingPin = localStorage.getItem('plex_pending_pin');
    if (pendingPin) {
      return `<div class="plex-status disconnected">
        <div class="plex-icon">${UI.icon('loader', 48)}</div>
        <h3>Waiting for Plex Login…</h3>
        <p>Complete sign-in on Plex, then return to this page. Or cancel and try again.</p>
        <button class="btn-secondary" onclick="localStorage.removeItem('plex_pending_pin'); PlexConnectPage.render()">Cancel</button>
      </div>`;
    }
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
        <button class="btn-primary" onclick="App.navigate('plex-now-playing')">${UI.icon('play-circle', 18)} Now Playing</button>
        <button class="btn-secondary" onclick="App.navigate('plex-watched')">${UI.icon('check-circle', 18)} View Plex Watched</button>
        <button class="btn-secondary" onclick="PlexConnectPage.syncNow()" id="plex-sync-btn">${UI.icon('activity', 18)} Sync Now</button>
        <button class="btn-secondary" style="border-color:var(--rose-500);color:var(--rose-400)" onclick="PlexConnectPage.disconnect()">${UI.icon('x', 18)} Disconnect</button>
      </div>
    </div>`;
  },

  async startAuth() {
    const btn = document.getElementById('plex-connect-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Connecting...'; }
    try {
      const pin = await PlexAPI.createPin();
      const authUrl = PlexAPI.getAuthUrl(pin.code);

      // Store PIN so we can resume after a redirect (mobile) or page reload
      localStorage.setItem('plex_pending_pin', JSON.stringify({ id: pin.id }));

      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;

      if (isMobile) {
        // Mobile: redirect the current tab; resume polling when user returns
        UI.toast('You\'ll be redirected to Plex. Return here after signing in.', 'info');
        setTimeout(() => { window.location.href = authUrl; }, 800);
      } else {
        // Desktop: open popup and poll
        const popup = window.open(authUrl, '_blank', 'width=800,height=600');
        if (!popup) {
          // Popup blocked — fall back to redirect
          UI.toast('Popup blocked. Redirecting to Plex…', 'info');
          setTimeout(() => { window.location.href = authUrl; }, 800);
          return;
        }
        UI.toast('Complete sign-in in the new tab, then come back', 'info');
        if (btn) btn.textContent = 'Waiting for auth…';
        this._pollPin(pin.id, false);
      }
    } catch (e) {
      UI.toast('Failed to start Plex auth', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Connect Plex Account'; }
    }
  },

  // Shared polling logic (resumable = true when called after mobile redirect return)
  async _pollPin(pinId, resumable) {
    const btn = document.getElementById('plex-connect-btn');
    if (btn && !resumable) { btn.textContent = 'Waiting for auth…'; }
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const result = await PlexAPI.checkPin(pinId);
        if (result && result.authToken) {
          clearInterval(poll);
          localStorage.removeItem('plex_pending_pin');
          let serverName = '';
          try {
            const resources = await PlexAPI.getResources(result.authToken);
            const server = resources?.find(r => r.provides === 'server');
            if (server) { serverName = server.name || ''; Services.plex.connect(serverName, result.authToken); }
            else { Services.plex.connect('', result.authToken); }
          } catch (_) { Services.plex.connect('', result.authToken); }
          this.state.connected = true;
          this.state.server = serverName;
          UI.toast('Plex connected!', 'success');
          this.draw(document.getElementById('page-content'));
        } else if (attempts >= 90) { // 3 minutes
          clearInterval(poll);
          localStorage.removeItem('plex_pending_pin');
          UI.toast('Authentication timed out. Please try again.', 'error');
          if (btn) { btn.disabled = false; btn.textContent = 'Connect Plex Account'; }
        }
      } catch (_) {
        if (attempts >= 90) {
          clearInterval(poll);
          localStorage.removeItem('plex_pending_pin');
          if (btn) { btn.disabled = false; btn.textContent = 'Connect Plex Account'; }
        }
      }
    }, 2000);
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
              lastViewedAt: m.lastViewedAt,
              plexKey: m.key || '',
              machineId: server.clientIdentifier || ''
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
              lastViewedAt: m.lastViewedAt,
              plexKey: m.key || '',
              machineId: server.clientIdentifier || ''
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

        // Store all items on the instance so _validateTvMatch can use episode data
        this._syncItems = allItems;

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

    // Strip any remaining parenthetical content (e.g. "Show Name (Network)" or "Hacks (2021)")
    title = title.replace(/\s*\([^)]*\)\s*/g, '').trim();

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
  // For TV shows we validate by cross-checking episode titles from the Plex history
  // against TMDB episode data for the top candidate, to avoid wrong-language matches.
  async _matchTmdb(item) {
    const { title: cleanTitle, year, region } = this._parseTitle(item.title);
    const fallbackYear = item.year ? parseInt(item.year) : null;
    const searchYear = year || fallbackYear;

    try {
      const searchFn = item.type === 'movie' ? API.searchMovies : API.searchShows;
      let results = await searchFn.call(API, cleanTitle, 1);

      if ((!results || !results.length) && cleanTitle !== item.title.trim()) {
        results = await searchFn.call(API, item.title.trim(), 1);
      }
      if (!results || !results.length) return null;

      // Score all returned results and pick the top candidates
      const scored = results
        .map(r => ({ r, score: this._scoreTmdbMatch(r, cleanTitle, searchYear, region) }))
        .sort((a, b) => b.score - a.score);

      // For TV shows: validate the top few candidates via episode title matching
      if (item.type === 'show') {
        const candidates = scored.slice(0, 3);
        const validated = await this._validateTvMatch(item, candidates.map(c => c.r));
        if (validated) {
          return {
            key: `${item.type}:${item.title}`,
            tmdbId: validated.id,
            posterPath: validated.poster_path,
            tmdbTitle: validated.name || validated.title
          };
        }
      }

      // Fall back to the highest-scored result
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
  },

  // Validate a TV match by checking whether known episode titles from the Plex library
  // match TMDB episode data for each candidate show.
  async _validateTvMatch(plexItem, candidates) {
    // Collect episodes for this show from the raw sync data (stored on the instance during sync)
    const allItems = this._syncItems || [];
    const showKey = plexItem.title;
    const plexEpisodes = allItems.filter(i =>
      i.type === 'show' && i.title === showKey && i.episodeTitle && i.season != null && i.episode != null
    ).slice(0, 6); // check up to 6 episodes

    if (!plexEpisodes.length) return null; // can't validate without episode data

    // Normalise a string for fuzzy comparison
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const candidate of candidates) {
      let matchCount = 0;
      let checked = 0;
      for (const ep of plexEpisodes) {
        try {
          const data = await API.tmdb(`/tv/${candidate.id}/season/${ep.season}/episode/${ep.episode}`).catch(() => null);
          if (!data || !data.name) continue;
          checked++;
          const tmdbNorm = norm(data.name);
          const plexNorm = norm(ep.episodeTitle);
          // Count as match if titles share enough characters
          if (tmdbNorm === plexNorm ||
              tmdbNorm.includes(plexNorm) ||
              plexNorm.includes(tmdbNorm) ||
              (tmdbNorm.length > 4 && plexNorm.length > 4 && tmdbNorm.slice(0, 8) === plexNorm.slice(0, 8))
          ) {
            matchCount++;
          }
        } catch (_) {}
      }
      // Require at least 1 confirmed title match (or all checked match if only 1 ep available)
      if (checked > 0 && matchCount >= Math.max(1, Math.floor(checked * 0.5))) {
        return candidate;
      }
    }
    return null;
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
        const fixBtn = item.docId ? `<button class="fix-match-btn" onclick="event.stopPropagation(); PlexWatchedPage.showFixMatch('${item.docId}','${UI.escapeHtml(item.title || '')}','${item.type || 'show'}')" title="Fix TMDB match">${UI.icon('search', 12)} Fix Match</button>` : '';
        html += `<div class="plex-history-item" ${onclick} style="${item.tmdbId ? 'cursor:pointer' : ''}">
          ${poster ? `<img src="${poster}" class="plex-poster" alt="" loading="lazy">` : `<div class="plex-poster placeholder">${UI.icon(item.type === 'movie' ? 'film' : 'tv', 24)}</div>`}
          <div class="plex-item-info">
            <p class="plex-item-title">${UI.escapeHtml(item.title || '')}</p>
            ${subtitle ? `<p class="plex-item-sub">${subtitle}</p>` : ''}
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px"><span class="plex-tag">${item.type === 'movie' ? 'Movie' : 'TV'}</span>${fixBtn}</div>
          </div>
        </div>`;
      });
      html += '</div>';
    }
    html += '</div>';
    content.innerHTML = html;
  },

  showFixMatch(docId, rawTitle, type) {
    const mediaType = type === 'movie' ? 'movie' : 'tv';
    UI.showModal('Fix TMDB Match', `
      <p style="color:var(--text-secondary);margin-bottom:12px;font-size:.875rem">Search for the correct TMDB entry for <strong>${UI.escapeHtml(rawTitle)}</strong></p>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input id="fix-match-input" class="modal-input" type="text" placeholder="Search title…" value="${UI.escapeHtml(rawTitle)}" style="flex:1">
        <button class="btn-primary btn-sm" onclick="PlexWatchedPage.runFixMatchSearch('${docId}','${mediaType}')">${UI.icon('search', 14)}</button>
      </div>
      <div id="fix-match-results" style="max-height:320px;overflow-y:auto">${UI.loading()}</div>
    `);
    // Auto-search on open
    setTimeout(() => PlexWatchedPage.runFixMatchSearch(docId, mediaType), 100);
  },

  async runFixMatchSearch(docId, mediaType) {
    const input = document.getElementById('fix-match-input');
    const resultsEl = document.getElementById('fix-match-results');
    if (!input || !resultsEl) return;
    const query = input.value.trim();
    if (!query) return;
    resultsEl.innerHTML = UI.loading();
    try {
      const results = mediaType === 'movie'
        ? await API.searchMovies(query)
        : await API.searchShows(query);
      const trimmed = results.slice(0, 12);
      if (!trimmed.length) { resultsEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">No results found</p>'; return; }
      resultsEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">${trimmed.map(r => {
        const poster = r.poster_path ? API.imageUrl(r.poster_path, 'w92') : '';
        const title = UI.escapeHtml(r.name || r.title || '');
        const year = (r.first_air_date || r.release_date || '').substring(0, 4);
        return `<div class="fix-match-result" onclick="PlexWatchedPage.applyFixedMatch('${docId}','${r.id}','${r.poster_path || ''}','${mediaType}')">
          ${poster ? `<img src="${poster}" style="width:40px;height:60px;object-fit:cover;border-radius:4px;flex-shrink:0">` : `<div style="width:40px;height:60px;background:var(--bg-tertiary);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center">${UI.icon('film', 16)}</div>`}
          <div style="flex:1;min-width:0"><p style="font-weight:600;margin:0 0 2px;font-size:.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${title}</p><p style="color:var(--text-muted);margin:0;font-size:.75rem">${year} &bull; ${mediaType === 'movie' ? 'Movie' : 'TV'} &bull; ID: ${r.id}</p></div>
        </div>`;
      }).join('')}</div>`;
    } catch (e) { resultsEl.innerHTML = `<p style="color:var(--rose-400);text-align:center;padding:20px">${UI.escapeHtml(e.message)}</p>`; }
  },

  async applyFixedMatch(docId, tmdbId, posterPath, tmdbType) {
    try {
      await Services.updatePlexHistoryMatch(docId, tmdbId, posterPath || null, tmdbType === 'movie' ? 'movie' : 'show');
      UI.closeModal();
      const item = this.state.items.find(i => i.docId === docId);
      if (item) { item.tmdbId = Number(tmdbId); if (posterPath) item.posterPath = posterPath; }
      this.draw();
    } catch (e) { alert('Error saving match: ' + e.message); }
  }
};

/* ---------- Plex Companion — Now Playing ---------- */
const PlexNowPlayingPage = {
  state: { sessions: [], loading: false, details: {} },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="plex-now-playing-page">${UI.pageHeader('Now Playing', true)}<div id="np-content">${UI.loading()}</div></div>`;
    if (!Services.plex.isConnected) {
      document.getElementById('np-content').innerHTML = UI.emptyState('Not Connected', 'Connect your Plex account first.') + `<div style="padding:0 16px"><button class="btn-primary" onclick="App.navigate('plex-connect')">${UI.icon('monitor', 18)} Connect Plex</button></div>`;
      return;
    }
    try {
      const token = Services.plex.token;
      const resources = await PlexAPI.getResources(token);
      const server = resources?.find(r => r.provides?.includes('server'));
      if (!server) { document.getElementById('np-content').innerHTML = UI.emptyState('No Server', 'Could not find a Plex server on your account.'); return; }
      const data = await PlexAPI.serverFetch(token, server, '/status/sessions');
      const sessions = data?.MediaContainer?.Metadata || [];
      this.state.sessions = sessions;
      this.draw(server, token);
    } catch (e) {
      document.getElementById('np-content').innerHTML = UI.emptyState('Error', e.message);
    }
  },

  draw(server, token) {
    const el = document.getElementById('np-content');
    const sessions = this.state.sessions;

    if (!sessions.length) {
      el.innerHTML = `<div class="np-empty">
        ${UI.icon('monitor', 48)}
        <h3>Nothing Playing Right Now</h3>
        <p>Start playing something on Plex and it will appear here.</p>
        <button class="btn-secondary" onclick="PlexNowPlayingPage.refresh()">${UI.icon('refresh-cw', 16)} Refresh</button>
      </div>`;
      return;
    }

    el.innerHTML = `
      <div class="np-header">
        <p class="np-subtitle">${sessions.length} ${sessions.length === 1 ? 'stream' : 'streams'} active</p>
        <button class="btn-secondary btn-sm" onclick="PlexNowPlayingPage.refresh()">${UI.icon('refresh-cw', 14)} Refresh</button>
      </div>
      <div class="np-sessions">${sessions.map(s => this.renderSession(s)).join('')}</div>
    `;

    // Load TMDB enrichment in background
    sessions.forEach((s, i) => this.enrichSession(s, i));
  },

  renderSession(s) {
    const isEpisode = s.type === 'episode';
    const title = isEpisode ? (s.grandparentTitle || s.parentTitle || s.title) : s.title;
    const subtitle = isEpisode ? `S${s.parentIndex}E${s.index} · ${s.title}` : (s.year || '');
    const thumb = s.grandparentThumb || s.thumb || '';
    const thumbUrl = thumb ? `${Services.plex.serverUrl || ''}/photo/:/transcode?width=100&height=150&url=${encodeURIComponent(thumb)}&X-Plex-Token=${Services.plex.token}` : '';

    const viewOffset = s.viewOffset || 0;
    const duration = s.duration || 1;
    const progress = Math.min(100, (viewOffset / duration * 100)).toFixed(0);
    const minLeft = Math.round((duration - viewOffset) / 60000);

    const player = s.Player?.title || s.Player?.platform || '';
    const user = s.User?.title || '';
    const state = s.Player?.state || 'playing';
    const stateIcon = state === 'paused' ? 'pause' : 'play';

    const tmdbId = this.state.details[s.ratingKey]?.tmdbId;
    const mediaType = isEpisode ? 'tv' : 'movie';

    return `<div class="np-card" id="np-card-${s.ratingKey}" onclick="${tmdbId ? `App.navigate('details',{id:${tmdbId},type:'${mediaType}'})` : ''}">
      <div class="np-card-top">
        ${thumbUrl
          ? `<div class="np-thumb" style="background-image:url('${UI.escapeHtml(thumbUrl)}')"></div>`
          : `<div class="np-thumb np-thumb-ph">${UI.icon('film', 28)}</div>`
        }
        <div class="np-card-info">
          <div class="np-state-badge ${state}"><span>${UI.icon(stateIcon, 12)}</span> ${state}</div>
          <h3 class="np-title">${UI.escapeHtml(title)}</h3>
          <p class="np-subtitle-text">${UI.escapeHtml(subtitle)}</p>
          <div class="np-meta">
            ${user ? `<span class="np-meta-chip">${UI.icon('user', 12)} ${UI.escapeHtml(user)}</span>` : ''}
            ${player ? `<span class="np-meta-chip">${UI.icon('monitor', 12)} ${UI.escapeHtml(player)}</span>` : ''}
            ${minLeft > 0 ? `<span class="np-meta-chip">${UI.icon('clock', 12)} ~${minLeft}m left</span>` : ''}
          </div>
        </div>
      </div>
      <div class="np-progress-wrap">
        <div class="np-progress-bar">
          <div class="np-progress-fill" style="width:${progress}%"></div>
        </div>
        <span class="np-progress-pct">${progress}%</span>
      </div>
      <div id="np-details-${s.ratingKey}" class="np-tmdb-details"></div>
    </div>`;
  },

  async enrichSession(s, idx) {
    try {
      const isEpisode = s.type === 'episode';
      const title = isEpisode ? (s.grandparentTitle || '') : (s.title || '');
      const mediaType = isEpisode ? 'tv' : 'movie';
      const searchFn = isEpisode ? API.searchShows.bind(API) : API.searchMovies.bind(API);
      const results = await searchFn(title, 1);
      if (!results.length) return;
      const match = results[0];
      this.state.details[s.ratingKey] = { tmdbId: match.id };

      // Update the card to make it clickable
      const card = document.getElementById(`np-card-${s.ratingKey}`);
      if (card) card.onclick = () => App.navigate('details', { id: match.id, type: mediaType });

      // Load and inject cast + extra info
      const detailsEl = document.getElementById(`np-details-${s.ratingKey}`);
      if (!detailsEl) return;

      let castData = null;
      if (isEpisode && s.parentIndex && s.index) {
        castData = await API.tmdb(`/tv/${match.id}/season/${s.parentIndex}/episode/${s.index}/credits`).catch(() => null);
      } else if (mediaType === 'movie') {
        castData = await API.tmdb(`/movie/${match.id}/credits`).catch(() => null);
      } else {
        castData = await API.tmdb(`/tv/${match.id}/credits`).catch(() => null);
      }
      const cast = (castData?.cast || []).slice(0, 6);
      const mediaDetails = isEpisode
        ? await API.getShowDetails(match.id).catch(() => null)
        : await API.getMovieDetails(match.id).catch(() => null);

      const countries = (mediaDetails?.production_countries || []).map(c => c.name).join(', ');
      const overview = isEpisode
        ? (await API.tmdb(`/tv/${match.id}/season/${s.parentIndex}/episode/${s.index}`).catch(() => null))?.overview || ''
        : mediaDetails?.overview || '';

      detailsEl.innerHTML = `
        ${overview ? `<p class="np-overview">${UI.escapeHtml(overview.substring(0, 180))}${overview.length > 180 ? '…' : ''}</p>` : ''}
        ${countries ? `<p class="np-fact">${UI.icon('map-pin', 12)} Filmed in ${UI.escapeHtml(countries)}</p>` : ''}
        ${cast.length ? `<div class="np-cast-row">${cast.map(c => {
          const photo = c.profile_path ? API.imageUrl(c.profile_path, 'w92') : '';
          return `<div class="np-cast-chip" onclick="event.stopPropagation();App.navigate('actor-details',{id:${c.id}})">
            ${photo ? `<img src="${photo}" alt="">` : `<div class="np-cast-ph">${(c.name||'?')[0]}</div>`}
            <span>${UI.escapeHtml((c.name||'').split(' ')[0])}</span>
          </div>`;
        }).join('')}</div>` : ''}
      `;
    } catch (_) {}
  },

  async refresh() {
    this.state.sessions = [];
    this.state.details = {};
    await this.render();
  }
};
