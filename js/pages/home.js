/* ===================================================
   Home Page
   Ported from src/screens/Home.tsx
   =================================================== */

const HomePage = (() => {
  let carouselTimer = null;
  let currentSlide  = 0;
  let trending      = [];

  function getDateString() {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  async function render(container) {
    container.innerHTML = `
      <div class="page">
        <div class="home-header">
          <div>
            <div class="home-date">${getDateString()}</div>
            <h1 class="home-title">Show<span class="accent">Board</span></h1>
          </div>
        </div>

        <div class="carousel-wrap" id="carousel">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>

        <div class="home-cards">
          <a href="#/activity" class="home-card">
            <div class="home-card-icon emerald">▶</div>
            <div>
              <div class="home-card-label">Activity</div>
              <div class="home-card-sub">Plex sessions</div>
            </div>
          </a>
          <a href="#/discover" class="home-card">
            <div class="home-card-icon blue">☰</div>
            <div>
              <div class="home-card-label">List</div>
              <div class="home-card-sub">Browse catalog</div>
            </div>
          </a>
        </div>

        <div class="home-tip">
          <span class="home-tip-icon">💡</span>
          <span>Tap a trending title or use Discover to search for movies and TV shows.</span>
        </div>
      </div>
    `;

    loadTrending();
  }

  async function loadTrending() {
    try {
      const results = await TMDB.getTrending();
      trending = results.slice(0, 5);
      if (!trending.length) return;
      currentSlide = 0;
      renderCarousel();
      startTimer();
    } catch (e) {
      document.getElementById('carousel').innerHTML =
        '<div class="empty-state"><div class="empty-state-text">Could not load trending.</div></div>';
    }
  }

  function renderCarousel() {
    const wrap = document.getElementById('carousel');
    if (!wrap) return;

    const cards = trending.map((item, i) => {
      const backdrop = TMDB.getBackdropUrl(item.backdrop_path);
      const title    = item.title || item.name || 'Untitled';
      const year     = (item.release_date || item.first_air_date || '').slice(0, 4);
      const rating   = item.vote_average ? item.vote_average.toFixed(1) : '—';
      const type     = item.media_type === 'movie' ? 'Movie' : 'TV';

      return `
        <div class="carousel-card ${i === currentSlide ? 'active' : ''}"
             data-index="${i}"
             onclick="location.hash='#/details/${item.media_type}/${item.id}'">
          ${backdrop
            ? `<img class="carousel-img" src="${backdrop}" alt="" loading="lazy" />`
            : '<div class="carousel-img placeholder-img">🎬</div>'}
          <div class="carousel-overlay"></div>
          <div class="carousel-content">
            <div class="carousel-badge">🔥 Trending</div>
            <div class="carousel-title">${escapeHtml(title)}</div>
            <div class="carousel-meta">
              <span class="carousel-rating">★ ${rating}</span>
              <span class="carousel-type">${type}</span>
              ${year ? `<span>${year}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const dots = trending.map((_, i) =>
      `<div class="carousel-dot ${i === currentSlide ? 'active' : ''}" data-dot="${i}"></div>`
    ).join('');

    wrap.innerHTML = cards + `<div class="carousel-dots">${dots}</div>`;

    wrap.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        goToSlide(parseInt(e.target.dataset.dot, 10));
        resetTimer();
      });
    });
  }

  function goToSlide(index) {
    currentSlide = index;
    const wrap = document.getElementById('carousel');
    if (!wrap) return;
    wrap.querySelectorAll('.carousel-card').forEach(c => {
      c.classList.toggle('active', parseInt(c.dataset.index, 10) === index);
    });
    wrap.querySelectorAll('.carousel-dot').forEach(d => {
      d.classList.toggle('active', parseInt(d.dataset.dot, 10) === index);
    });
  }

  function nextSlide() {
    goToSlide((currentSlide + 1) % trending.length);
  }

  function startTimer() {
    stopTimer();
    carouselTimer = setInterval(nextSlide, 8000);
  }

  function resetTimer() {
    startTimer();
  }

  function stopTimer() {
    if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
  }

  function destroy() {
    stopTimer();
  }

  return { render, destroy };
})();
