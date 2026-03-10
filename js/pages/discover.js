/* ===================================================
   Discover Page (Watchlist)
   Ported from src/screens/Watchlist.tsx
   =================================================== */

const DiscoverPage = (() => {
  let currentFilter = 'all';
  let results = [];

  async function render(container) {
    container.innerHTML = `
      <div class="page">
        <div class="discover-header">
          <h1 class="discover-title">Discover</h1>
        </div>

        <div class="search-bar">
          <input class="search-input" id="searchInput" type="text"
                 placeholder="Search movies & TV shows..." autocomplete="off" />
          <button class="search-btn" id="searchBtn">GO</button>
        </div>

        <div class="filter-tabs" id="filterTabs">
          <button class="filter-tab active" data-filter="all">All</button>
          <button class="filter-tab" data-filter="movie">Movies</button>
          <button class="filter-tab" data-filter="tv">TV Shows</button>
        </div>

        <div id="discoverResults">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    document.getElementById('searchBtn').addEventListener('click', doSearch);
    document.getElementById('searchInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });
    document.getElementById('filterTabs').addEventListener('click', e => {
      const btn = e.target.closest('.filter-tab');
      if (!btn) return;
      currentFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t === btn));
      renderResults();
    });

    currentFilter = 'all';
    loadTrending();
  }

  async function loadTrending() {
    try {
      results = await TMDB.getTrending();
      renderResults();
    } catch {
      document.getElementById('discoverResults').innerHTML =
        '<div class="empty-state"><div class="empty-state-text">Could not load content.</div></div>';
    }
  }

  async function doSearch() {
    const q = document.getElementById('searchInput').value.trim();
    if (!q) { loadTrending(); return; }

    document.getElementById('discoverResults').innerHTML =
      '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
      results = await TMDB.searchMedia(q);
      renderResults();
    } catch {
      document.getElementById('discoverResults').innerHTML =
        '<div class="empty-state"><div class="empty-state-text">Search failed. Try again.</div></div>';
    }
  }

  function renderResults() {
    const el = document.getElementById('discoverResults');
    if (!el) return;

    let filtered = results;
    if (currentFilter === 'movie') filtered = results.filter(r => r.media_type === 'movie');
    else if (currentFilter === 'tv') filtered = results.filter(r => r.media_type === 'tv');

    if (!filtered.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No results found.</div></div>';
      return;
    }

    el.innerHTML = '<div class="results-list">' + filtered.map(item => {
      const poster = TMDB.getPosterUrl(item.poster_path);
      const title  = item.title || item.name || 'Untitled';
      const year   = (item.release_date || item.first_air_date || '').slice(0, 4);
      const type   = item.media_type === 'movie' ? 'movie' : 'tv';
      const rating = item.vote_average ? item.vote_average.toFixed(1) : '—';

      return `
        <div class="result-card" onclick="location.hash='#/details/${type}/${item.id}'">
          ${poster
            ? `<img class="result-poster" src="${poster}" alt="" loading="lazy" />`
            : '<div class="result-poster placeholder-img">🎬</div>'}
          <div class="result-info">
            <div class="result-title">${escapeHtml(title)}</div>
            <div class="result-meta">
              <span class="media-badge ${type}">${type === 'movie' ? 'Movie' : 'TV'}</span>
              ${year ? `<span>${year}</span>` : ''}
            </div>
            <div class="result-rating">★ ${rating}</div>
          </div>
        </div>
      `;
    }).join('') + '</div>';
  }

  function destroy() {}

  return { render, destroy };
})();
