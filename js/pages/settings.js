/* ShowBoat — Settings Page */
const SettingsPage = {
  state: { profile: null, saving: false },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const uid = auth.currentUser.uid;
      this.state.profile = await Services.getUserProfile(uid);
      this.draw(el);
    } catch (e) { el.innerHTML = UI.emptyState('Error', e.message); }
  },

  draw(el) {
    const p = this.state.profile || {};
    const username = p.username || auth.currentUser?.displayName || '';
    const visibility = p.profileVisibility || 'public';

    el.innerHTML = `<div class="settings-page">
      ${UI.pageHeader('Settings', true)}

      <div class="settings-section">
        <div class="settings-section-title">${UI.icon('user', 16)} Account</div>

        <div class="settings-card">
          <label class="settings-label">Username</label>
          <div class="settings-input-row">
            <input type="text" id="settings-username" class="settings-input" value="${UI.escapeHtml(username)}" maxlength="30" placeholder="Enter username">
            <button class="settings-save-btn" id="save-username-btn" onclick="SettingsPage.saveUsername()">Save</button>
          </div>
        </div>

        <div class="settings-card">
          <label class="settings-label">Email</label>
          <p class="settings-value">${UI.escapeHtml(auth.currentUser?.email || '')}</p>
        </div>

        <div class="settings-card">
          <label class="settings-label">Password</label>
          <p class="settings-desc">We'll send a password reset link to your email.</p>
          <button class="settings-action-btn" onclick="SettingsPage.sendPasswordReset()">
            ${UI.icon('mail', 16)} Send Reset Email
          </button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">${UI.icon('eye', 16)} Privacy</div>

        <div class="settings-card">
          <label class="settings-label">Profile Visibility</label>
          <p class="settings-desc">Control who can see your profile and activity.</p>
          <div class="settings-toggle-group">
            <button class="settings-toggle ${visibility === 'public' ? 'active' : ''}" onclick="SettingsPage.setVisibility('public')">
              ${UI.icon('globe', 14)} Public
            </button>
            <button class="settings-toggle ${visibility === 'friends' ? 'active' : ''}" onclick="SettingsPage.setVisibility('friends')">
              ${UI.icon('users', 14)} Friends Only
            </button>
            <button class="settings-toggle ${visibility === 'private' ? 'active' : ''}" onclick="SettingsPage.setVisibility('private')">
              ${UI.icon('lock', 14)} Private
            </button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">${UI.icon('compass', 16)} Experience</div>

        <div class="settings-card">
          <label class="settings-label">Guided Tour</label>
          <p class="settings-desc">Replay the feature walkthrough to learn what ShowBoat can do.</p>
          <button class="settings-action-btn" onclick="SettingsPage.restartTour()">
            ${UI.icon('play-circle', 16)} Start Tour
          </button>
        </div>
      </div>
    </div>`;
  },

  async saveUsername() {
    const input = document.getElementById('settings-username');
    const btn = document.getElementById('save-username-btn');
    const newName = input?.value?.trim();
    if (!newName || newName.length < 2) { UI.toast('Username must be at least 2 characters', 'error'); return; }
    if (newName.length > 30) { UI.toast('Username must be 30 characters or less', 'error'); return; }
    btn.textContent = '...';
    btn.disabled = true;
    try {
      await Services.updateProfile({ username: newName });
      if (this.state.profile) this.state.profile.username = newName;
      UI.toast('Username updated!', 'success');
    } catch (e) { UI.toast('Failed to update: ' + e.message, 'error'); }
    btn.textContent = 'Save';
    btn.disabled = false;
  },

  async sendPasswordReset() {
    const email = auth.currentUser?.email;
    if (!email) { UI.toast('No email on account', 'error'); return; }
    try {
      await auth.sendPasswordResetEmail(email);
      UI.toast('Reset email sent to ' + email, 'success');
    } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
  },

  async setVisibility(vis) {
    try {
      await Services.updateProfile({ profileVisibility: vis });
      if (this.state.profile) this.state.profile.profileVisibility = vis;
      document.querySelectorAll('.settings-toggle').forEach(b => {
        b.classList.toggle('active', b.textContent.trim().toLowerCase().includes(vis === 'friends' ? 'friends' : vis));
      });
      // More reliable: re-match by onclick
      document.querySelectorAll('.settings-toggle').forEach(b => {
        const m = b.getAttribute('onclick')?.match(/'(\w+)'/);
        b.classList.toggle('active', m && m[1] === vis);
      });
      UI.toast('Visibility updated to ' + vis, 'success');
    } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
  },

  restartTour() {
    if (typeof GuidedTour !== 'undefined') {
      localStorage.removeItem('showboat_tour_complete');
      App.navigate('home');
      setTimeout(() => GuidedTour.start(), 400);
    } else {
      UI.toast('Tour not available', 'error');
    }
  }
};
