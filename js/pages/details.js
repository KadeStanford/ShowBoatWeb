/* ===================================================
   Details Page
   Ported from src/screens/Details.tsx
   Full genre-based theming, seasons/episodes, cast
   =================================================== */

const DetailsPage = (() => {

  /* Genre → color theme (ported from GENRE_THEMES) */
  const GENRE_THEMES = {
    28:    { bg: '#1a0505', accent: '#ef4444' },   // Action → Red
    12:    { bg: '#052e16', accent: '#10b981' },   // Adventure → Emerald
    16:    { bg: '#1e073b', accent: '#a855f7' },   // Animation → Purple
    35:    { bg: '#1c1105', accent: '#f59e0b' },   // Comedy → Amber
    80:    { bg: '#111827', accent: '#6b7280' },   // Crime → Gray
    99:    { bg: '#082f49', accent: '#0ea5e9' },   // Documentary → Sky
    18:    { bg: '#1c1105', accent: '#eab308' },   // Drama → Gold
    10751: { bg: '#042f2e', accent: '#14b8a6' },   // Family → Teal
    14:    { bg: '#1e073b', accent: '#a855f7' },   // Fantasy → Purple
    36:    { bg: '#1c1208', accent: '#a16207' },   // History → Brown
    27:    { bg: '#1a0505', accent: '#991b1b' },   // Horror → DarkRed
    10402: { bg: '#2b0a3d', accent: '#ec4899' },   // Music → Pink
    9648:  { bg: '#1e1b4b', accent: '#6366f1' },   // Mystery → Indigo
    10749: { bg: '#2b0a1e', accent: '#f43f5e' },   // Romance → Rose
    878:   { bg: '#042f2e', accent: '#06b6d4' },   // Sci-Fi → Cyan
    10770: { bg: '#111827', accent: '#6b7280' },   // TV Movie → Gray
    53:    { bg: '#052e16', accent: '#22c55e' },   // Thriller → Green
    10752: { bg: '#052e16', accent: '#22c55e' },   // War → Green
    37:    { bg: '#1c1208', accent: '#f97316' },   // Western → Orange
    10759: { bg: '#1a0505', accent: '#ef4444' },   // Action & Adventure (TV)
    10762: { bg: '#042f2e', accent: '#14b8a6' },   // Kids (TV)
    10763: { bg: '#082f49', accent: '#0ea5e9' },   // News
    10764: { bg: '#2b0a3d', accent: '#ec4899' },   // Reality
    10765: { bg: '#042f2e', accent: '#06b6d4' },   // Sci-Fi & Fantasy (TV)
    10766: { bg: '#2b0a1e', accent: '#f43f5e' },   // Soap
    10767: { bg: '#1c1105', accent: '#f59e0b' },   // Talk
    10768: { bg: '#052e16', accent: '#22c55e' },   // War & Politics (TV)
  };
  const DEFAULT_THEME = { bg: '#020617', accent: '#f59e0b' };

  let selectedSeason = null;
  let detailData     = null;
  let episodes       = [];

  function getTheme(genres) {
    if (!genres || !genres.length) return DEFAULT_THEME;
    return GENRE_THEMES[genres[0].id] || DEFAULT_THEME;
  }

  function formatCurrency(n) {
    if (!n) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n.toLocaleString();
  }

  function formatRuntime(mins) {
    if (!mins) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  async function render(container, params) {
    const { type, id } = params;
    document.body.classList.add('details-open');

    container.innerHTML = '<div class="page"><div class="loading-spinner"><div class="spinner"></div></div></div>';

    try {
      detailData = await TMDB.getDetails(id, type);
      selectedSeason = null;
      episodes = [];
      renderDetail(container, type);

      // Auto-load first season for TV
      if (type === 'tv' && detailData.seasons && detailData.seasons.length) {
        const firstReal = detailData.seasons.find(s => s.season_number > 0) || detailData.seasons[0];
        loadSeason(container, id, firstReal.season_number, type);
      }
    } catch (e) {
      container.innerHTML = `
        <div class="page">
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-text">Could not load details.</div>
          </div>
        </div>`;
    }
  }

  function renderDetail(container, type) {
    const d     = detailData;
    const theme = getTheme(d.genres);
    const backdrop = TMDB.getBackdropUrl(d.backdrop_path);
    const poster   = TMDB.getPosterUrl(d.poster_path);
    const title    = d.title || d.name || 'Untitled';
    const tagline  = d.tagline || '';
    const genres   = d.genres || [];
    const rating   = d.vote_average ? d.vote_average.toFixed(1) : '—';
    const cast     = (d.credits && d.credits.cast) ? d.credits.cast.slice(0, 10) : [];

    // Set CSS custom properties for theme
    document.documentElement.style.setProperty('--detail-bg', theme.bg);
    document.documentElement.style.setProperty('--detail-accent', theme.accent);
    document.documentElement.style.setProperty('--detail-accent-dim', theme.accent + '26');

    let statsHtml = '';
    if (type === 'movie') {
      const year    = (d.release_date || '').slice(0, 4) || '—';
      const runtime = formatRuntime(d.runtime);
      const status  = d.status || '—';
      statsHtml = `
        <div class="stat-box"><div class="stat-value">★ ${rating}</div><div class="stat-label">Rating</div></div>
        <div class="stat-box"><div class="stat-value">${year}</div><div class="stat-label">Year</div></div>
        <div class="stat-box"><div class="stat-value">${escapeHtml(status)}</div><div class="stat-label">Status</div></div>
        <div class="stat-box"><div class="stat-value">${runtime}</div><div class="stat-label">Runtime</div></div>
      `;
    } else {
      const seasons  = d.number_of_seasons || '—';
      const episodes = d.number_of_episodes || '—';
      const status   = d.status || '—';
      statsHtml = `
        <div class="stat-box"><div class="stat-value">★ ${rating}</div><div class="stat-label">Rating</div></div>
        <div class="stat-box"><div class="stat-value">${seasons}</div><div class="stat-label">Seasons</div></div>
        <div class="stat-box"><div class="stat-value">${episodes}</div><div class="stat-label">Episodes</div></div>
        <div class="stat-box"><div class="stat-value">${escapeHtml(status)}</div><div class="stat-label">Status</div></div>
      `;
    }

    let seasonsHtml = '';
    if (type === 'tv' && d.seasons && d.seasons.length) {
      seasonsHtml = `
        <div class="details-section">
          <div class="details-section-title">Seasons</div>
          <div class="seasons-scroll" id="seasonsScroll">
            ${d.seasons.map(s => {
              const sPoster = TMDB.getPosterUrl(s.poster_path);
              const isActive = selectedSeason === s.season_number;
              return `
                <div class="season-card ${isActive ? 'active' : ''}" data-season="${s.season_number}">
                  ${sPoster
                    ? `<img class="season-poster" src="${sPoster}" alt="" loading="lazy" />`
                    : '<div class="season-poster placeholder-img">📺</div>'}
                  <div class="season-name">${escapeHtml(s.name)}</div>
                  <div class="season-ep-count">${s.episode_count} episodes</div>
                </div>`;
            }).join('')}
          </div>
        </div>
        <div id="episodesList"></div>
      `;
    }

    let financeHtml = '';
    if (type === 'movie' && (d.budget || d.revenue)) {
      financeHtml = `
        <div class="details-section">
          <div class="details-section-title">Box Office</div>
          <div class="finance-grid">
            <div class="finance-box">
              <div class="finance-label">Budget</div>
              <div class="finance-value">${formatCurrency(d.budget)}</div>
            </div>
            <div class="finance-box">
              <div class="finance-label">Revenue</div>
              <div class="finance-value">${formatCurrency(d.revenue)}</div>
            </div>
          </div>
        </div>
      `;
    }

    let castHtml = '';
    if (cast.length) {
      castHtml = `
        <div class="details-section">
          <div class="details-section-title">Cast</div>
          <div class="cast-scroll">
            ${cast.map(c => {
              const photo = TMDB.getPosterUrl(c.profile_path);
              return `
                <div class="cast-card">
                  ${photo
                    ? `<img class="cast-photo" src="${photo}" alt="" loading="lazy" />`
                    : '<div class="cast-photo placeholder-img">👤</div>'}
                  <div class="cast-name">${escapeHtml(c.name)}</div>
                  <div class="cast-char">${escapeHtml(c.character || '')}</div>
                </div>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="page" style="padding:0;">
        <!-- Backdrop -->
        <div class="details-backdrop-wrap">
          ${backdrop
            ? `<img class="details-backdrop" src="${backdrop}" alt="" />`
            : '<div class="details-backdrop placeholder-img" style="height:100%;">🎬</div>'}
          <div class="details-backdrop-grad"></div>
          <button class="details-back" onclick="history.back()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        </div>

        <!-- Hero -->
        <div class="details-hero">
          ${poster
            ? `<img class="details-poster" src="${poster}" alt="" />`
            : '<div class="details-poster placeholder-img">🎬</div>'}
          <div class="details-title-block">
            <div class="details-name">${escapeHtml(title)}</div>
            ${tagline ? `<div class="details-tagline">${escapeHtml(tagline)}</div>` : ''}
            <div class="genre-pills">
              ${genres.map(g => `<span class="genre-pill">${escapeHtml(g.name)}</span>`).join('')}
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="details-stats">${statsHtml}</div>

        <!-- Synopsis -->
        ${d.overview ? `
        <div class="details-section">
          <div class="details-section-title">Synopsis</div>
          <div class="synopsis">${escapeHtml(d.overview)}</div>
        </div>` : ''}

        <!-- Seasons (TV) -->
        ${seasonsHtml}

        <!-- Finance (Movie) -->
        ${financeHtml}

        <!-- Cast -->
        ${castHtml}

        <div style="height:40px;"></div>
      </div>
    `;

    // Season click handler
    if (type === 'tv') {
      const scroll = document.getElementById('seasonsScroll');
      if (scroll) {
        scroll.addEventListener('click', e => {
          const card = e.target.closest('.season-card');
          if (!card) return;
          const sNum = parseInt(card.dataset.season, 10);
          loadSeason(container, d.id, sNum, type);
        });
      }
    }
  }

  async function loadSeason(container, tvId, seasonNum, type) {
    selectedSeason = seasonNum;

    // Update active state on season cards
    document.querySelectorAll('.season-card').forEach(c => {
      c.classList.toggle('active', parseInt(c.dataset.season, 10) === seasonNum);
    });

    const epEl = document.getElementById('episodesList');
    if (!epEl) return;
    epEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
      const season = await TMDB.getSeasonDetails(tvId, seasonNum);
      episodes = season.episodes || [];
      renderEpisodes(epEl);
    } catch {
      epEl.innerHTML = '<div class="empty-state"><div class="empty-state-text">Could not load episodes.</div></div>';
    }
  }

  function renderEpisodes(el) {
    if (!episodes.length) {
      el.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-state-text">No episodes available.</div></div>';
      return;
    }

    el.innerHTML = `
      <div class="details-section">
        <div class="details-section-title">Episodes</div>
        ${episodes.map(ep => {
          const thumb = ep.still_path ? TMDB.getBackdropUrl(ep.still_path) : null;
          const airDate = ep.air_date || '';
          const runtime = ep.runtime ? formatRuntime(ep.runtime) : '';
          return `
            <div class="episode-card">
              ${thumb
                ? `<img class="episode-thumb" src="${thumb}" alt="" loading="lazy" />`
                : '<div class="episode-thumb placeholder-img">🎬</div>'}
              <div class="episode-info">
                <div class="episode-num">Episode ${ep.episode_number}</div>
                <div class="episode-name">${escapeHtml(ep.name || '')}</div>
                <div class="episode-date">${airDate}${runtime ? ' · ' + runtime : ''}</div>
                ${ep.overview ? `<div class="episode-desc">${escapeHtml(ep.overview)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function destroy() {
    document.body.classList.remove('details-open');
    document.documentElement.style.removeProperty('--detail-bg');
    document.documentElement.style.removeProperty('--detail-accent');
    document.documentElement.style.removeProperty('--detail-accent-dim');
    detailData = null;
    episodes = [];
    selectedSeason = null;
  }

  return { render, destroy };
})();
