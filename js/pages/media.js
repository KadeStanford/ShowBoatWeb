/* ShowBoat — Media Pages: ActorDetails, CastList, SharedActors, YouTube */
const ActorDetailsPage = {
  state: { credits: [], watchlistIds: new Set(), showWatchlistFirst: false },

  async render(params) {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const [person, watchlist] = await Promise.all([
        API.getPersonDetails(params.id),
        Services.getWatchlist().catch(() => [])
      ]);
      this.state.watchlistIds = new Set(watchlist.map(w => Number(w.id)));
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
          <div id="actor-credits-list"></div>
        </div>` : ''}
      </div>`;
      this.drawCredits();
    } catch (e) { el.innerHTML = UI.pageHeader('Actor', true) + UI.emptyState('x', 'Error', e.message); }
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
    el.innerHTML = `<div class="cast-list" style="padding:0 32px">${credits.map(c => {
      const poster = c.poster_path ? API.imageUrl(c.poster_path, 'w185') : '';
      const type = c.media_type || 'movie';
      const year = (c.first_air_date || c.release_date || '').slice(0, 4);
      const inWl = this.state.watchlistIds.has(Number(c.id));
      return `<div class="cast-list-item" onclick="App.navigate('details',{id:${c.id},type:'${type}'})">
        ${poster ? `<img src="${poster}" style="width:48px;height:72px;border-radius:8px;object-fit:cover;background:var(--slate-800);flex-shrink:0" alt="" loading="lazy">` : `<div style="width:48px;height:72px;border-radius:8px;background:var(--slate-800);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--slate-600)">${UI.icon('film', 20)}</div>`}
        <div class="cast-info" style="flex:1">
          <p class="cast-name">${UI.escapeHtml(c.name || c.title || '')}</p>
          <p class="cast-char">${UI.escapeHtml(c.character || '')}${year ? ` · ${year}` : ''} · ${type === 'tv' ? 'TV' : 'Movie'}</p>
        </div>
        ${inWl ? `<span style="color:var(--emerald-400);flex-shrink:0" title="In your watchlist">${UI.icon('bookmark-filled', 18)}</span>` : ''}
      </div>`;
    }).join('')}</div>`;
  }
};

const CastListPage = {
  async render(params) {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const credits = await API.getMediaCredits(params.id, params.type);
      const cast = credits?.cast || [];
      el.innerHTML = `<div class="cast-page">
        ${UI.pageHeader('Full Cast', true)}
        ${cast.length ? `<div class="cast-list">${cast.map(c => {
          const photo = c.profile_path ? API.imageUrl(c.profile_path, 'w185') : '';
          return `<div class="cast-list-item" onclick="App.navigate('actor-details',{id:${c.id}})">
            ${photo ? `<img src="${photo}" class="cast-photo" alt="" loading="lazy">` : `<div class="cast-photo placeholder">${UI.icon('user', 20)}</div>`}
            <div class="cast-info"><p class="cast-name">${UI.escapeHtml(c.name || '')}</p><p class="cast-char">${UI.escapeHtml(c.character || '')}</p></div>
          </div>`;
        }).join('')}</div>` : UI.emptyState('No cast info', '')}
      </div>`;
    } catch (e) { el.innerHTML = UI.pageHeader('Cast', true) + UI.emptyState('Error', e.message); }
  }
};

const SharedActorsPage = {
  async render(params) {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const friendName = params.friendName || 'Friend';
      // Get my watched and friend's watched, find shared actors
      const [myWatched, friendWatched] = await Promise.all([
        Services.getWatched(), Services.getWatched(params.friendId)
      ]);
      // Gather unique media IDs from both
      const myIds = new Set(myWatched.map(w => w.tmdbId || w.id));
      const friendIds = new Set(friendWatched.map(w => w.tmdbId || w.id));
      // Find overlapping shows
      const shared = [...myIds].filter(id => friendIds.has(id));

      if (!shared.length) {
        el.innerHTML = `${UI.pageHeader(`Shared with ${friendName}`, true)}${UI.emptyState('No shared shows', 'Watch more of the same shows to find shared actors')}`;
        return;
      }

      // Get credits for shared shows (limit to 5 for performance)
      const actorCounts = {};
      for (const showId of shared.slice(0, 5)) {
        try {
          const credits = await API.getMediaCredits(showId, 'tv');
          (credits?.cast || []).forEach(c => {
            if (!actorCounts[c.id]) actorCounts[c.id] = { ...c, count: 0 };
            actorCounts[c.id].count++;
          });
        } catch (_) {}
      }
      const sharedActors = Object.values(actorCounts).filter(a => a.count > 1).sort((a, b) => b.count - a.count);

      el.innerHTML = `<div class="shared-actors-page">
        ${UI.pageHeader(`Shared Actors with ${UI.escapeHtml(friendName)}`, true)}
        ${sharedActors.length ? `<div class="cast-list">${sharedActors.map(a => {
          const photo = a.profile_path ? API.imageUrl(a.profile_path, 'w185') : '';
          return `<div class="cast-list-item" onclick="App.navigate('actor-details',{id:${a.id}})">
            ${photo ? `<img src="${photo}" class="cast-photo" alt="" loading="lazy">` : `<div class="cast-photo placeholder">${UI.icon('user', 20)}</div>`}
            <div class="cast-info"><p class="cast-name">${UI.escapeHtml(a.name || '')}</p><p class="cast-char">In ${a.count} shared shows</p></div>
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
