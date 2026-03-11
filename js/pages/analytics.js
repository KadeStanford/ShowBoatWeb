/* ShowBoat — Analytics & Badges Pages */
const AnalyticsPage = {
  state: { stats: null, ratings: [], watched: [], episodeRatings: [] },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="analytics-page">${UI.pageHeader('Analytics', true)}<div id="analytics-content">${UI.loading()}</div></div>`;
    try {
      const [stats, ratings, watched, episodeRatings, tvGenres, movieGenres] = await Promise.all([
        Services.getUserStats(), Services.getRatings(), Services.getWatched(),
        Services.getAllMyEpisodeRatings(),
        API.getGenres('tv'), API.getGenres('movie')
      ]);
      this.state.stats = stats;
      this.state.ratings = ratings;
      this.state.watched = watched;
      this.state.episodeRatings = episodeRatings;

      // Build genre name map
      const genreMap = {};
      [...tvGenres, ...movieGenres].forEach(g => { genreMap[g.id] = g.name; });

      // Fetch TMDB details for top-rated items (limited to avoid spam)
      const topRated = ratings.filter(r => r.rating >= 7).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 20);
      const details = await Promise.all(topRated.map(r => {
        const mt = r.mediaType === 'movie' ? 'movie' : 'tv';
        return (mt === 'movie' ? API.getMovieDetails(r.tmdbId) : API.getShowDetails(r.tmdbId)).catch(() => null);
      }));

      // Tally genres from top-rated items
      const genres = {};
      details.forEach((d, i) => {
        if (!d || !d.genres) return;
        const weight = topRated[i]?.rating || 1;
        d.genres.forEach(g => { genres[g.name] = (genres[g.name] || 0) + 1; });
      });
      this.state.genreData = genres;
      this.draw();
    } catch (e) { document.getElementById('analytics-content').innerHTML = UI.emptyState('Error', e.message); }
  },

  draw() {
    const el = document.getElementById('analytics-content');
    const ratings = this.state.ratings;
    const watched = this.state.watched;
    const epRatings = this.state.episodeRatings;

    // ---- Count breakdowns ----
    const movies = watched.filter(w => w.mediaType === 'movie' || (w.docId || '').startsWith('movie:'));
    const tvWatched = watched.filter(w => w.mediaType === 'tv' || w.mediaType === 'show' || (w.docId || '').startsWith('tv:'));
    // Episodes: tv entries that have a season+episode in docId
    const episodesWatched = tvWatched.filter(w => (w.docId || '').match(/:s\d+:e\d+/) || (w.seasonNumber != null && w.episodeNumber != null));
    // Series: tv entries that are show-level (no season:episode)
    const seriesWatched = new Set(tvWatched.filter(w => !((w.docId || '').match(/:s\d+:e\d+/)) && !(w.seasonNumber != null && w.episodeNumber != null)).map(w => w.tmdbId)).size;

    const movieRatings = ratings.filter(r => r.mediaType === 'movie');
    const tvRatings = ratings.filter(r => r.mediaType === 'tv' || r.mediaType === 'show');

    const avgRating = ratings.length ? (ratings.reduce((s, r) => s + (r.rating || 0), 0) / ratings.length).toFixed(1) : '—';
    const avgMovieRating = movieRatings.length ? (movieRatings.reduce((s, r) => s + (r.rating || 0), 0) / movieRatings.length).toFixed(1) : '—';
    const avgShowRating = tvRatings.length ? (tvRatings.reduce((s, r) => s + (r.rating || 0), 0) / tvRatings.length).toFixed(1) : '—';

    // Top rated shows / movies / episodes
    const topShows = tvRatings.sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);
    const topMovies = movieRatings.sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);
    const topEpisodes = [...epRatings].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);

    // Genre distribution
    const genres = this.state.genreData || {};
    const genreEntries = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxGenre = genreEntries.length ? genreEntries[0][1] : 1;

    // Rating distribution
    const ratingDist = Array(11).fill(0);
    ratings.forEach(r => { const bucket = Math.round(r.rating || 0); if (bucket >= 0 && bucket <= 10) ratingDist[bucket]++; });
    const maxRating = Math.max(...ratingDist, 1);

    // Monthly activity (from watchedAt)
    const monthCounts = {};
    watched.forEach(w => { if (w.watchedAt) { const d = new Date(w.watchedAt); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; monthCounts[key] = (monthCounts[key] || 0) + 1; } });
    const monthEntries = Object.entries(monthCounts).sort().slice(-6);
    const maxMonth = monthEntries.length ? Math.max(...monthEntries.map(e => e[1])) : 1;

    const renderTopScroll = (items, type) => {
      if (!items.length) return '';
      return items.map(r => {
        const poster = r.posterPath ? API.imageUrl(r.posterPath, 'w185') : '';
        const mt = type || (r.mediaType === 'movie' ? 'movie' : 'tv');
        return `<div class="analytics-top-card" onclick="App.navigate('details',{id:${r.tmdbId},type:'${mt}'})">
          ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="analytics-top-poster-ph">${UI.icon('film', 20)}</div>`}
          <p class="analytics-top-title">${UI.escapeHtml(r.name || r.showName || '')}</p>
          <p class="analytics-top-rating">${UI.icon('star', 12)} ${r.rating}/10</p>
        </div>`;
      }).join('');
    };

    el.innerHTML = `
      <div class="analytics-content">

        <!-- Stat Cards -->
        <div class="stats-grid analytics-stats">
          <div class="stat-card accent"><span class="stat-number">${seriesWatched}</span><span class="stat-label">Series Watched</span></div>
          <div class="stat-card accent"><span class="stat-number">${episodesWatched.length}</span><span class="stat-label">Episodes Watched</span></div>
          <div class="stat-card accent"><span class="stat-number">${movies.length}</span><span class="stat-label">Movies Watched</span></div>
          <div class="stat-card"><span class="stat-number">${avgRating}</span><span class="stat-label">Avg Rating</span></div>
          <div class="stat-card"><span class="stat-number">${avgShowRating}</span><span class="stat-label">Avg Show Rating</span></div>
          <div class="stat-card"><span class="stat-number">${avgMovieRating}</span><span class="stat-label">Avg Movie Rating</span></div>
          <div class="stat-card"><span class="stat-number">${tvRatings.length}</span><span class="stat-label">Shows Rated</span></div>
          <div class="stat-card"><span class="stat-number">${epRatings.length}</span><span class="stat-label">Episodes Rated</span></div>
        </div>

        <!-- Top Rated Shows -->
        ${topShows.length ? `<div class="chart-section">
          <h3>${UI.icon('tv', 18)} Top Rated Shows</h3>
          <div class="analytics-top-scroll">${renderTopScroll(topShows, 'tv')}</div>
        </div>` : ''}

        <!-- Top Rated Movies -->
        ${topMovies.length ? `<div class="chart-section">
          <h3>${UI.icon('film', 18)} Top Rated Movies</h3>
          <div class="analytics-top-scroll">${renderTopScroll(topMovies, 'movie')}</div>
        </div>` : ''}

        <!-- Top Rated Episodes -->
        ${topEpisodes.length ? `<div class="chart-section">
          <h3>${UI.icon('play-circle', 18)} Top Rated Episodes</h3>
          <div class="analytics-ep-list">${topEpisodes.map(ep => `
            <div class="analytics-ep-item">
              <div class="analytics-ep-info">
                <p class="analytics-ep-show">${UI.escapeHtml(ep.showName || '')}</p>
                <p class="analytics-ep-name">${UI.escapeHtml(ep.episodeName || `S${ep.seasonNumber}E${ep.episodeNumber}`)}</p>
                <p class="analytics-ep-num">S${ep.seasonNumber}E${ep.episodeNumber}</p>
              </div>
              <span class="analytics-ep-rating">${ep.rating}/10</span>
            </div>`).join('')}
          </div>
        </div>` : ''}

        <!-- Rating Distribution -->
        ${ratings.length ? `<div class="chart-section">
          <h3>${UI.icon('bar-chart-2', 18)} Rating Distribution</h3>
          <div class="bar-chart horizontal">${ratingDist.map((count, i) => `<div class="rating-bar">
            <div class="rbar-fill" style="height:${(count / maxRating * 100).toFixed(0)}%"></div>
            <span class="rbar-label">${i}</span>
          </div>`).join('')}</div>
        </div>` : ''}

        <!-- Top Genres -->
        ${genreEntries.length ? `<div class="chart-section">
          <h3>${UI.icon('tag', 18)} Top Genres</h3>
          <div class="bar-chart">${genreEntries.map(([name, count]) => `<div class="bar-row">
            <span class="bar-label">${UI.escapeHtml(name)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(count / maxGenre * 100).toFixed(0)}%"></div></div>
            <span class="bar-value">${count}</span>
          </div>`).join('')}</div>
        </div>` : ''}

        <!-- Monthly Activity -->
        ${monthEntries.length ? `<div class="chart-section">
          <h3>${UI.icon('calendar', 18)} Monthly Activity</h3>
          <div class="bar-chart">${monthEntries.map(([month, count]) => `<div class="bar-row">
            <span class="bar-label">${month.substring(5)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(count / maxMonth * 100).toFixed(0)}%"></div></div>
            <span class="bar-value">${count}</span>
          </div>`).join('')}</div>
        </div>` : ''}

        <button class="btn-primary" onclick="App.navigate('badges')" style="margin-top:16px">${UI.icon('award', 18)} View Badges</button>
      </div>`;
  }
};

const BadgesPage = {
  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="badges-page">${UI.pageHeader('Badges', true)}<div id="badges-content">${UI.loading()}</div></div>`;
    try {
      const [stats, profile] = await Promise.all([
        Services.getUserStats(),
        Services.getUserProfile(auth.currentUser?.uid).catch(() => ({}))
      ]);
      const badges = calculateBadges(stats);
      const displayedIds = new Set(profile?.displayedBadges || []);
      const earned = badges.filter(b => b.earned);
      const locked = badges.filter(b => !b.earned);

      // Group earned by category
      const earnedByCategory = {};
      earned.forEach(b => { earnedByCategory[b.category] = earnedByCategory[b.category] || []; earnedByCategory[b.category].push(b); });

      const renderBadge = (b, showToggle = false) => {
        const tierData = BADGE_TIERS[b.tier] || BADGE_TIERS.bronze;
        const isDisplayed = displayedIds.has(b.id);
        const progressPct = b.progress.toFixed(0);
        return `<div class="badge-card-v2 ${b.earned ? 'earned' : 'locked'}" data-tier="${b.tier}">
          <div class="badge-card-shine"></div>
          <div class="badge-tier-dot" style="background:${tierData.color}" title="${tierData.label}"></div>
          <div class="badge-icon-wrap" style="background:${tierData.bg};border-color:${tierData.color}40">
            <span class="badge-emoji-v2">${b.icon}</span>
          </div>
          <p class="badge-name-v2">${UI.escapeHtml(b.name)}</p>
          <p class="badge-desc-v2">${UI.escapeHtml(b.desc)}</p>
          ${b.earned
            ? `<div class="badge-tier-label" style="color:${tierData.color}">${tierData.label}</div>`
            : `<div class="badge-progress-wrap"><div class="badge-progress-bar-v2"><div class="badge-progress-fill-v2" style="width:${progressPct}%;background:${tierData.color}"></div></div><span class="badge-progress-pct">${progressPct}%</span></div>`
          }
          ${showToggle && b.earned ? `<button class="badge-display-btn ${isDisplayed ? 'active' : ''}" onclick="BadgesPage.toggleDisplay('${b.id}','${b.name}')" title="${isDisplayed ? 'Remove from profile' : 'Show on profile'}">
            ${isDisplayed ? UI.icon('eye-off', 14) + ' Showing' : UI.icon('eye', 14) + ' Display'}
          </button>` : ''}
        </div>`;
      };

      const categories = ['Watcher', 'Critic', 'Social', 'Plex'];
      document.getElementById('badges-content').innerHTML = `
        <div class="badges-header-strip">
          <div class="badges-summary-v2">
            <div class="badges-progress-ring">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="var(--bg-tertiary)" stroke-width="6"/>
                <circle cx="40" cy="40" r="32" fill="none" stroke="var(--indigo-500)" stroke-width="6"
                  stroke-dasharray="${(earned.length / badges.length * 201).toFixed(1)} 201"
                  stroke-linecap="round" transform="rotate(-90 40 40)"/>
              </svg>
              <div class="badges-ring-label"><span class="ring-num">${earned.length}</span><span class="ring-total">/${badges.length}</span></div>
            </div>
            <div>
              <p class="badges-earned-text"><strong>${earned.length}</strong> badges earned</p>
              <p class="badges-sub-text">${badges.length - earned.length} still to unlock</p>
            </div>
          </div>
          ${displayedIds.size
            ? `<div class="badges-displayed-preview">
                <p class="badges-displayed-label">${UI.icon('eye', 14)} On your profile</p>
                <div class="badges-displayed-chips">${[...displayedIds].slice(0, 5).map(id => {
                  const b = badges.find(x => x.id === id);
                  return b ? `<span class="displayed-badge-chip" title="${UI.escapeHtml(b.name)}">${b.icon}</span>` : '';
                }).join('')}</div>
              </div>`
            : `<p class="badges-tip">${UI.icon('info', 14)} Earned badges can be displayed on your profile</p>`
          }
        </div>

        ${categories.map(cat => {
          const catEarned = earned.filter(b => b.category === cat);
          const catLocked = locked.filter(b => b.category === cat);
          if (!catEarned.length && !catLocked.length) return '';
          return `<div class="badge-category-section">
            <h3 class="badge-cat-title">${UI.icon(
              cat === 'Watcher' ? 'tv' : cat === 'Critic' ? 'edit-3' : cat === 'Social' ? 'users' : 'monitor',
              16)} ${cat}</h3>
            ${catEarned.length ? `<div class="badges-grid-v2">${catEarned.map(b => renderBadge(b, true)).join('')}</div>` : ''}
            ${catLocked.length ? `<div class="badges-grid-v2 locked-group">${catLocked.map(b => renderBadge(b, false)).join('')}</div>` : ''}
          </div>`;
        }).join('')}
      `;
    } catch (e) { document.getElementById('badges-content').innerHTML = UI.emptyState('Error', e.message); }
  },

  async toggleDisplay(badgeId, badgeName) {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const profile = await Services.getUserProfile(uid).catch(() => ({}));
      let displayed = profile?.displayedBadges || [];
      if (displayed.includes(badgeId)) {
        displayed = displayed.filter(id => id !== badgeId);
        UI.toast(`${badgeName} removed from profile`, 'success');
      } else {
        if (displayed.length >= 5) { UI.toast('You can display up to 5 badges', 'error'); return; }
        displayed = [...displayed, badgeId];
        UI.toast(`${badgeName} added to profile!`, 'success');
      }
      await db.collection('users').doc(uid).update({ displayedBadges: displayed });
      this.render();
    } catch (e) { UI.toast('Error updating badges', 'error'); }
  }
};

