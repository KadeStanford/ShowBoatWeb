/* ShowBoat — Analytics & Badges Pages */
const AnalyticsPage = {
  state: { stats: null, ratings: [], watched: [] },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="analytics-page">${UI.pageHeader('Analytics', true)}<div id="analytics-content">${UI.loading()}</div></div>`;
    try {
      const [stats, ratings, watched, tvGenres, movieGenres] = await Promise.all([
        Services.getUserStats(), Services.getRatings(), Services.getWatched(),
        API.getGenres('tv'), API.getGenres('movie')
      ]);
      this.state.stats = stats;
      this.state.ratings = ratings;
      this.state.watched = watched;

      // Build genre name map from both TV and Movie genre lists
      const genreMap = {};
      [...tvGenres, ...movieGenres].forEach(g => { genreMap[g.id] = g.name; });

      // Get unique show/movie-level items (skip individual episodes for genre lookup)
      const uniqueMedia = new Map();
      watched.forEach(w => {
        const id = w.tmdbId || w.id;
        const mt = (w.mediaType === 'show' ? 'tv' : w.mediaType) || 'tv';
        if (id && !uniqueMedia.has(`${mt}:${id}`)) uniqueMedia.set(`${mt}:${id}`, { id, type: mt });
      });

      // Fetch details in parallel (limited to 30 to avoid hammering the API)
      const entries = [...uniqueMedia.values()].slice(0, 30);
      const details = await Promise.all(entries.map(e =>
        (e.type === 'movie' ? API.getMovieDetails(e.id) : API.getShowDetails(e.id)).catch(() => null)
      ));

      // Tally genres
      const genres = {};
      details.forEach(d => {
        if (!d || !d.genres) return;
        d.genres.forEach(g => { genres[g.name] = (genres[g.name] || 0) + 1; });
      });

      this.state.genreData = genres;
      this.draw();
    } catch (e) { document.getElementById('analytics-content').innerHTML = UI.emptyState('Error', e.message); }
  },

  draw() {
    const el = document.getElementById('analytics-content');
    const s = this.state.stats || {};
    const ratings = this.state.ratings;
    const watched = this.state.watched;

    // Genre distribution from TMDB data
    const genres = this.state.genreData || {};
    const genreEntries = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxGenre = genreEntries.length ? genreEntries[0][1] : 1;

    // Rating distribution
    const ratingDist = Array(11).fill(0);
    ratings.forEach(r => { const bucket = Math.round(r.rating || 0); ratingDist[bucket]++; });
    const maxRating = Math.max(...ratingDist, 1);

    // Average rating
    const avgRating = ratings.length ? (ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length).toFixed(1) : '—';

    // Watch streak / monthly stats
    const monthCounts = {};
    watched.forEach(w => { if (w.watchedAt) { const d = new Date(w.watchedAt); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; monthCounts[key] = (monthCounts[key] || 0) + 1; } });
    const monthEntries = Object.entries(monthCounts).sort().slice(-6);
    const maxMonth = monthEntries.length ? Math.max(...monthEntries.map(e => e[1])) : 1;

    // TV vs Movie split
    const tvCount = watched.filter(w => w.mediaType === 'tv' || w.mediaType === 'show').length;
    const movieCount = watched.filter(w => w.mediaType === 'movie').length;

    el.innerHTML = `
      <div class="analytics-content">
        <div class="stats-grid">
          <div class="stat-card accent"><span class="stat-number">${s.watched || 0}</span><span class="stat-label">Total Watched</span></div>
          <div class="stat-card accent"><span class="stat-number">${avgRating}</span><span class="stat-label">Avg Rating</span></div>
          <div class="stat-card"><span class="stat-number">${tvCount}</span><span class="stat-label">TV Shows</span></div>
          <div class="stat-card"><span class="stat-number">${movieCount}</span><span class="stat-label">Movies</span></div>
        </div>

        ${genreEntries.length ? `<div class="chart-section">
          <h3>Top Genres</h3>
          <div class="bar-chart">${genreEntries.map(([name, count]) => `<div class="bar-row">
            <span class="bar-label">${UI.escapeHtml(name)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(count / maxGenre * 100).toFixed(0)}%"></div></div>
            <span class="bar-value">${count}</span>
          </div>`).join('')}</div>
        </div>` : ''}

        <div class="chart-section">
          <h3>Rating Distribution</h3>
          <div class="bar-chart horizontal">${ratingDist.map((count, i) => `<div class="rating-bar">
            <div class="rbar-fill" style="height:${(count / maxRating * 100).toFixed(0)}%"></div>
            <span class="rbar-label">${i}</span>
          </div>`).join('')}</div>
        </div>

        ${monthEntries.length ? `<div class="chart-section">
          <h3>Monthly Activity</h3>
          <div class="bar-chart">${monthEntries.map(([month, count]) => `<div class="bar-row">
            <span class="bar-label">${month}</span>
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
      const stats = await Services.getUserStats();
      const badges = calculateBadges(stats);
      const earned = badges.filter(b => b.earned);
      const locked = badges.filter(b => !b.earned);
      document.getElementById('badges-content').innerHTML = `
        <div class="badges-summary"><span class="badge-count">${earned.length}/${badges.length}</span> badges earned</div>
        ${earned.length ? `<div class="section"><h3>Earned</h3><div class="badges-grid">${earned.map(b => `<div class="badge-card earned">
          <span class="badge-emoji">${b.icon}</span>
          <p class="badge-name">${UI.escapeHtml(b.name)}</p>
          <p class="badge-desc">${UI.escapeHtml(b.description)}</p>
        </div>`).join('')}</div></div>` : ''}
        ${locked.length ? `<div class="section"><h3>Locked</h3><div class="badges-grid">${locked.map(b => `<div class="badge-card locked">
          <span class="badge-emoji">${b.icon}</span>
          <p class="badge-name">${UI.escapeHtml(b.name)}</p>
          <p class="badge-desc">${UI.escapeHtml(b.description)}</p>
          <div class="badge-progress"><div class="badge-progress-fill" style="width:${Math.min(100, (b.progress || 0)).toFixed(0)}%"></div></div>
        </div>`).join('')}</div></div>` : ''}`;
    } catch (e) { document.getElementById('badges-content').innerHTML = UI.emptyState('Error', e.message); }
  }
};
