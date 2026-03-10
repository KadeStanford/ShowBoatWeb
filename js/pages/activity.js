/* ===================================================
   Activity Page (Watched)
   Ported from src/screens/Watched.tsx
   =================================================== */

const ActivityPage = (() => {

  async function render(container) {
    container.innerHTML = `
      <div class="page">
        <div class="activity-header">
          <h1 class="activity-title">Activity</h1>
          <button class="refresh-btn" id="refreshActivity">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            REFRESH
          </button>
        </div>
        <div id="activityList">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    document.getElementById('refreshActivity').addEventListener('click', loadSessions);
    loadSessions();
  }

  async function loadSessions() {
    const el = document.getElementById('activityList');
    if (!el) return;

    if (!Plex.isConfigured()) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚙️</div>
          <div class="empty-state-text">Configure your Plex server in Settings to see active sessions.</div>
        </div>`;
      return;
    }

    el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
      const sessions = await Plex.fetchRecentlyViewed();
      if (!sessions.length) {
        el.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📺</div>
            <div class="empty-state-text">No active sessions found.</div>
          </div>`;
        return;
      }

      el.innerHTML = sessions.map(s => {
        const initial = (s.title || '?')[0].toUpperCase();
        return `
          <div class="session-card">
            <div class="session-avatar">${escapeHtml(initial)}</div>
            <div class="session-info">
              <div class="session-title">${escapeHtml(s.title)}</div>
              <div class="session-player">${escapeHtml(s.player)}</div>
            </div>
            <div class="session-status"></div>
          </div>
        `;
      }).join('');

    } catch (e) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-text">Could not connect to Plex server.</div>
        </div>`;
    }
  }

  function destroy() {}

  return { render, destroy };
})();
