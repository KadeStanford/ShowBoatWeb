/* ShowBoat — Media Pages: ActorDetails, CastList, SharedActors, YouTube */
const ActorDetailsPage = {
  state: { credits: [], watchlistIds: new Set(), showWatchlistFirst: false, _personId: null, activeTab: 'all' },

  async render(params) {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const [person, watchlist] = await Promise.all([
        API.getPersonDetails(params.id),
        Services.getWatchlist().catch(() => [])
      ]);
      this.state.watchlistIds = new Set(watchlist.map(w => Number(w.id)));
      this.state._personId = params.id;
      const photo = person.profile_path ? API.imageUrl(person.profile_path, 'w342') : '';
      const credits = [...(person.combined_credits?.cast || [])];
      // Default sort: newest to oldest by release/air date
      credits.sort((a, b) => {
        const da = new Date(a.first_air_date || a.release_date || '1900').getTime();
        const db = new Date(b.first_air_date || b.release_date || '1900').getTime();
        return db - da;
      });
      this.state.credits = credits;
      this.state.showWatchlistFirst = false;
      this.state.activeTab = 'all';
      const birthYear = person.birthday ? new Date(person.birthday).getFullYear() : '';
      const age = person.birthday && !person.deathday ? new Date().getFullYear() - new Date(person.birthday).getFullYear() : '';

      el.innerHTML = `<div class="actor-page">
        ${UI.pageHeader(person.name || 'Actor', true)}
        <div class="actor-header">
          ${photo ? `<img src="${photo}" class="actor-photo" alt="">` : `<div class="actor-photo placeholder">${UI.icon('user', 40)}</div>`}
          <div class="actor-info">
            <h2>${UI.escapeHtml(person.name || '')}</h2>
            ${person.known_for_department ? `<p class="actor-dept">${UI.escapeHtml(person.known_for_department)}</p>` : ''}
            ${birthYear ? `<p class="actor-birth">Born ${birthYear}${age ? ` (age ${age})` : ''}</p>` : ''}
            ${person.place_of_birth ? `<p class="actor-place">${UI.escapeHtml(person.place_of_birth)}</p>` : ''}
          </div>
        </div>
        ${person.biography ? `<div class="section"><h3 style="padding:0 32px">Biography</h3><p class="bio-text">${UI.escapeHtml(person.biography).substring(0, 500)}${person.biography.length > 500 ? '...' : ''}</p></div>` : ''}
        ${credits.length ? `<div class="section">
          <div class="section-header">
            <h3>Filmography (${credits.length})</h3>
            <button class="filter-tab" id="wl-toggle-btn" onclick="ActorDetailsPage.toggleWatchlistFirst()">${UI.icon('bookmark', 14)} Watchlist First</button>
          </div>
          <div class="act-type-tabs">
            <button class="filter-tab active" id="actor-tab-all" onclick="ActorDetailsPage.setTab('all')">All</button>
            <button class="filter-tab" id="actor-tab-tv" onclick="ActorDetailsPage.setTab('tv')">TV Shows</button>
            <button class="filter-tab" id="actor-tab-movie" onclick="ActorDetailsPage.setTab('movie')">Movies</button>
          </div>
          <div id="actor-credits-list"></div>
        </div>` : ''}
      </div>`;
      this.drawCredits();
    } catch (e) { el.innerHTML = UI.pageHeader('Actor', true) + UI.emptyState('x', 'Error', e.message); }
  },

  setTab(tab) {
    this.state.activeTab = tab;
    ['all', 'tv', 'movie'].forEach(t => {
      document.getElementById(`actor-tab-${t}`)?.classList.toggle('active', t === tab);
    });
    this.drawCredits();
  },

  toggleWatchlistFirst() {
    this.state.showWatchlistFirst = !this.state.showWatchlistFirst;
    const btn = document.getElementById('wl-toggle-btn');
    if (btn) btn.classList.toggle('active', this.state.showWatchlistFirst);
    this.drawCredits();
  },

  drawCredits() {
    const el = document.getElementById('actor-credits-list');
    if (!el) return;
    let credits = [...this.state.credits];
    if (this.state.showWatchlistFirst) {
      const inWl = credits.filter(c => this.state.watchlistIds.has(Number(c.id)));
      const notWl = credits.filter(c => !this.state.watchlistIds.has(Number(c.id)));
      credits = [...inWl, ...notWl];
    }
    // Split into Movies and TV Shows, filter by activeTab
    const movies = credits.filter(c => (c.media_type || 'movie') === 'movie');
    const tvShows = credits.filter(c => (c.media_type || 'movie') === 'tv');
    const tab = this.state.activeTab || 'all';

    const renderSection = (title, items) => {
      if (!items.length) return '';
      return `<div class="filmography-section">
        <h4 class="filmography-heading">${title} (${items.length})</h4>
        <div class="cast-list" style="padding:0">${items.map(c => {
          const poster = c.poster_path ? API.imageUrl(c.poster_path, 'w185') : '';
          const type = c.media_type || 'movie';
          const year = (c.first_air_date || c.release_date || '').slice(0, 4);
          const inWl = this.state.watchlistIds.has(Number(c.id));
          const epCount = c.episode_count;
          const isTV = type === 'tv';
          return `<div class="cast-list-item filmography-item" onclick="App.navigate('details',{id:${c.id},type:'${type}'})">
            ${poster ? `<img src="${poster}" style="width:48px;height:72px;border-radius:8px;object-fit:cover;background:var(--slate-800);flex-shrink:0" alt="" loading="lazy">` : `<div style="width:48px;height:72px;border-radius:8px;background:var(--slate-800);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--slate-600)">${UI.icon('film', 20)}</div>`}
            <div class="cast-info" style="flex:1;min-width:0">
              <p class="cast-name">${UI.escapeHtml(c.name || c.title || '')}</p>
              <p class="cast-char">${UI.escapeHtml(c.character || '')}${year ? `<span class="fi-year">· ${year}</span>` : ''}</p>
              ${isTV && epCount ? `<div class="fi-ep-row">
                <span class="cast-ep-chip">${epCount} ep${epCount !== 1 ? 's' : ''}</span>
                <button class="fi-expand-btn" onclick="event.stopPropagation();ActorDetailsPage.toggleEpisodeList(this,${c.id})" data-show-id="${c.id}" data-person-id="${this.state._personId}">
                  ${UI.icon('chevron-down', 14)} Episodes
                </button>
              </div>` : ''}
              <div class="fi-ep-detail" id="fi-ep-${c.id}" style="display:none"></div>
            </div>
            ${inWl ? `<span style="color:var(--emerald-400);flex-shrink:0" title="In your watchlist">${UI.icon('bookmark-filled', 18)}</span>` : ''}
          </div>`;
        }).join('')}</div>
      </div>`;
    };

    el.innerHTML = `<div style="padding:0 32px">
      ${tab !== 'tv' ? renderSection('Movies', movies) : ''}
      ${tab !== 'movie' ? renderSection('TV Shows', tvShows) : ''}
    </div>`;
  },

  async toggleEpisodeList(btn, showId) {
    const container = document.getElementById(`fi-ep-${showId}`);
    if (!container) return;
    const isOpen = container.style.display !== 'none';
    if (isOpen) {
      container.style.display = 'none';
      btn.querySelector('svg')?.classList.remove('rotate-180');
      return;
    }
    btn.querySelector('svg')?.classList.add('rotate-180');
    container.style.display = 'block';
    if (container.dataset.loaded) return;
    container.dataset.loaded = '1';
    const personId = btn.dataset.personId || this.state._personId;
    container.innerHTML = `<p class="fi-loading">${UI.icon('loader', 14)} Loading episodes…</p>`;
    try {
      const agg = await API.getAggregateCredits(showId);
      const person = (agg.cast || []).find(c => String(c.id) === String(personId));
      if (!person || !person.roles?.length) {
        container.innerHTML = `<p class="fi-empty">No episode details found</p>`;
        return;
      }
      container.innerHTML = person.roles.map(role => `
        <div class="fi-role-block">
          <p class="fi-role-char">${UI.icon('user', 12)} ${UI.escapeHtml(role.character || 'Unknown character')}</p>
          <p class="fi-role-eps">${role.episode_count} episode${role.episode_count !== 1 ? 's' : ''}</p>
        </div>`).join('');
    } catch (_) {
      container.innerHTML = `<p class="fi-empty">Could not load episode details</p>`;
    }
  }
};

const CastListPage = {
  state: { cast: [], query: '', id: null, type: null },

  async render(params) {
    this.state = { cast: [], query: '', id: params.id, type: params.type };
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      let cast;
      if (params.type === 'tv') {
        // Use aggregate credits for TV — includes episode_count and roles per actor
        const agg = await API.getAggregateCredits(params.id);
        // Normalise: map roles[0].character → character, and episode_count stays
        cast = (agg.cast || []).map(c => ({
          ...c,
          character: c.roles?.map(r => r.character).filter(Boolean).join(' / ') || c.character || ''
        }));
      } else {
        const credits = await API.getMediaCredits(params.id, params.type);
        cast = credits?.cast || [];
      }
      this.state.cast = cast;
      el.innerHTML = `<div class="cast-page">
        ${UI.pageHeader(`Full Cast (${cast.length})`, true)}
        <div class="cast-search-bar">
          <input
            type="search"
            id="cast-search-input"
            class="cast-search-input"
            placeholder="Search cast..."
            oninput="CastListPage.filterCast(this.value)"
            autocomplete="off"
          >
        </div>
        <div id="cast-list-results"></div>
      </div>`;
      this.drawCast();
    } catch (e) { el.innerHTML = UI.pageHeader('Cast', true) + UI.emptyState('Error', e.message); }
  },

  filterCast(q) {
    this.state.query = q.toLowerCase();
    this.drawCast();
  },

  drawCast() {
    const el = document.getElementById('cast-list-results');
    if (!el) return;
    const q = this.state.query;
    const list = q
      ? this.state.cast.filter(c => (c.name || '').toLowerCase().includes(q) || (c.character || '').toLowerCase().includes(q))
      : this.state.cast;
    if (!list.length) { el.innerHTML = `<p class="cast-empty">${q ? `No results for "${UI.escapeHtml(q)}"` : 'No cast info available'}</p>`; return; }
    el.innerHTML = `<div class="cast-list">${list.map(c => {
      const photo = c.profile_path ? API.imageUrl(c.profile_path, 'w185') : '';
      const epCount = c.total_episode_count || c.episode_count;
      return `<div class="cast-list-item" onclick="App.navigate('actor-details',{id:${c.id}})">
        ${photo ? `<img src="${photo}" class="cast-photo" alt="" loading="lazy">` : `<div class="cast-photo placeholder">${UI.icon('user', 20)}</div>`}
        <div class="cast-info">
          <p class="cast-name">${UI.escapeHtml(c.name || '')}</p>
          <p class="cast-char">${UI.escapeHtml(c.character || '')}</p>
        </div>
        ${epCount ? `<span class="cast-ep-chip">${epCount} ep${epCount !== 1 ? 's' : ''}</span>` : ''}
      </div>`;
    }).join('')}</div>`;
  }
};

const SharedActorsPage = {
  async render(params) {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const friendName = params.friendName || 'Friend';
      const [myWatched, friendWatched] = await Promise.all([
        Services.getWatched(), Services.getWatched(params.friendId)
      ]);
      // Deduplicate to show/movie level only (skip episode-level docs)
      const dedup = (list) => {
        const map = new Map();
        for (const w of list) {
          const id = w.tmdbId || w.id;
          if (!id) continue;
          // Skip episode-level entries — keep only show/movie level
          if (w.seasonNumber != null && w.episodeNumber != null) {
            if (map.has(id)) continue;
            // Add as show-level if we haven't seen this tmdbId yet
          }
          let type = w.mediaType || w.showType || w.type || 'tv';
          if (type === 'show') type = 'tv';
          if (!map.has(id)) map.set(id, { id, type, name: w.name || w.title || '' });
        }
        return map;
      };
      const myMap = dedup(myWatched);
      const friendMap = dedup(friendWatched);
      // Find overlapping media
      const sharedMedia = [];
      for (const [id, item] of myMap) {
        if (friendMap.has(id)) sharedMedia.push(item);
      }

      if (!sharedMedia.length) {
        el.innerHTML = `${UI.pageHeader(`Shared with ${UI.escapeHtml(friendName)}`, true)}${UI.emptyState('No shared shows', 'Watch more of the same shows to find shared actors')}`;
        return;
      }

      // Fetch credits for shared media (limit to 20 for performance)
      const actorMap = {};
      const toCheck = sharedMedia.slice(0, 20);
      await Promise.all(toCheck.map(async (item) => {
        try {
          const credits = await API.getMediaCredits(item.id, item.type);
          (credits?.cast || []).slice(0, 25).forEach(c => {
            if (!actorMap[c.id]) actorMap[c.id] = { id: c.id, name: c.name, profile_path: c.profile_path, shows: [] };
            actorMap[c.id].shows.push(item.name);
          });
        } catch (_) {}
      }));
      const sharedActors = Object.values(actorMap).filter(a => a.shows.length >= 2).sort((a, b) => b.shows.length - a.shows.length);

      el.innerHTML = `<div class="shared-actors-page">
        ${UI.pageHeader(`Shared Actors with ${UI.escapeHtml(friendName)}`, true)}
        <p style="padding:0 32px;color:var(--slate-400);font-size:.8125rem;margin-bottom:12px">${sharedMedia.length} shared title${sharedMedia.length !== 1 ? 's' : ''}</p>
        ${sharedActors.length ? `<div class="cast-list">${sharedActors.map(a => {
          const photo = a.profile_path ? API.imageUrl(a.profile_path, 'w185') : '';
          return `<div class="cast-list-item" onclick="App.navigate('actor-details',{id:${a.id}})">
            ${photo ? `<img src="${photo}" class="cast-photo" alt="" loading="lazy">` : `<div class="cast-photo placeholder">${UI.icon('user', 20)}</div>`}
            <div class="cast-info">
              <p class="cast-name">${UI.escapeHtml(a.name || '')}</p>
              <p class="cast-char">In ${a.shows.length} shared titles</p>
              <p style="color:var(--slate-500);font-size:.75rem;margin-top:2px">${a.shows.slice(0, 3).map(s => UI.escapeHtml(s)).join(', ')}${a.shows.length > 3 ? '...' : ''}</p>
            </div>
            <span style="color:var(--emerald-400);font-weight:800;font-size:1.25rem;flex-shrink:0">${a.shows.length}</span>
          </div>`;
        }).join('')}</div>` : UI.emptyState('No shared actors found', 'Need more overlapping shows')}
      </div>`;
    } catch (e) { el.innerHTML = UI.pageHeader('Shared Actors', true) + UI.emptyState('Error', e.message); }
  }
};

const YouTubePage = {
  render(params) {
    const query = params?.query || '';
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="youtube-page">
      ${UI.pageHeader('Trailers', true)}
      <div class="youtube-embed">
        <iframe src="https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query + ' trailer')}" 
          width="100%" height="400" frameborder="0" allowfullscreen 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
      </div>
      <p class="youtube-note">Showing results for: "${UI.escapeHtml(query)}"</p>
      <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' trailer')}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="display:inline-flex;align-items:center;gap:8px;margin-top:12px">${UI.icon('external-link', 16)} Open in YouTube</a>
    </div>`;
  }
};
