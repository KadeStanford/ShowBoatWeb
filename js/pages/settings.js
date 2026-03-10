/* ===================================================
   Settings Page
   Ported from src/screens/Settings.tsx
   =================================================== */

const SettingsPage = (() => {

  async function render(container) {
    const serverUrl = Plex.getServerUrl();
    const token     = Plex.getToken();

    container.innerHTML = `
      <div class="page">
        <div class="settings-header">
          <h1 class="settings-title">Settings</h1>
        </div>

        <div class="settings-section">
          <div class="settings-label">Plex Server URL</div>
          <input class="settings-input" id="plexUrl" type="url"
                 placeholder="http://192.168.1.50:32400"
                 value="${escapeAttr(serverUrl)}" />
        </div>

        <div class="settings-section">
          <div class="settings-label">Plex Token</div>
          <input class="settings-input" id="plexToken" type="text"
                 placeholder="X-Plex-Token"
                 value="${escapeAttr(token)}" />
        </div>

        <button class="settings-save" id="saveSettings">Save Configuration</button>

        <div class="settings-info">
          <strong>How to find your Plex token:</strong><br />
          Open Plex Web App → open browser DevTools → go to any library page →
          look for the <code>X-Plex-Token</code> query parameter in network requests.
        </div>
      </div>
    `;

    document.getElementById('saveSettings').addEventListener('click', save);
  }

  function save() {
    const url   = document.getElementById('plexUrl').value.trim().replace(/\/+$/, '');
    const token = document.getElementById('plexToken').value.trim();

    Plex.setServerUrl(url);
    Plex.setToken(token);
    showToast('Settings saved ✓');
  }

  function destroy() {}

  return { render, destroy };
})();
