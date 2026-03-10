/* ===================================================
   ShowBoard — SPA Router & App Shell
   Hash-based routing for Capacitor compatibility
   =================================================== */

/* ---- Utilities ---- */
function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showToast(msg, duration) {
  duration = duration || 2500;
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

/* ---- Router ---- */
const Router = (() => {
  let currentPage = null;

  const pages = {
    home:     HomePage,
    discover: DiscoverPage,
    activity: ActivityPage,
    settings: SettingsPage,
    details:  DetailsPage
  };

  function parseHash() {
    const hash = location.hash.replace(/^#\/?/, '') || '';
    // details/:type/:id
    const detailMatch = hash.match(/^details\/(movie|tv)\/(\d+)/);
    if (detailMatch) {
      return { page: 'details', params: { type: detailMatch[1], id: detailMatch[2] } };
    }
    const name = hash || 'home';
    if (pages[name]) return { page: name, params: {} };
    return { page: 'home', params: {} };
  }

  function updateTabs(pageName) {
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.page === pageName);
    });
  }

  async function navigate() {
    const { page, params } = parseHash();
    const container = document.getElementById('app');

    // Destroy previous page
    if (currentPage && pages[currentPage] && pages[currentPage].destroy) {
      pages[currentPage].destroy();
    }

    currentPage = page;

    // Hide tabs on details
    if (page === 'details') {
      document.body.classList.add('details-open');
    } else {
      document.body.classList.remove('details-open');
    }

    updateTabs(page);

    // Scroll to top
    window.scrollTo(0, 0);

    // Render page
    if (pages[page]) {
      await pages[page].render(container, params);
    }
  }

  function init() {
    window.addEventListener('hashchange', navigate);
    navigate();
  }

  return { init };
})();

/* ---- Service Worker Registration ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', () => {
  Router.init();
});
