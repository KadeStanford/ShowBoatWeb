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

      ${this.renderLinkedAccounts()}

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

      ${this.renderNotificationPrefs()}

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
  },

  renderNotificationPrefs() {
    const p = this.state.profile || {};
    const prefs = p.notificationPrefs || {};
    const enabled = prefs.enabled !== false;
    const categories = [
      { key: 'friends',        label: 'Friend Requests',   icon: 'user-plus' },
      { key: 'recommendations', label: 'Recommendations',  icon: 'star' },
      { key: 'shames',         label: 'Wall of Shame',     icon: 'alert-triangle' },
      { key: 'reactions',      label: 'Reactions',          icon: 'heart' },
      { key: 'matcher',        label: 'Matcher',            icon: 'shuffle' },
      { key: 'sharedLists',    label: 'Shared Lists',       icon: 'list' },
      { key: 'activity',       label: 'Friend Activity',    icon: 'activity' },
    ];
    return `<div class="settings-section">
      <div class="settings-section-title">${UI.icon('bell', 16)} Notifications</div>
      <div class="settings-card">
        <div class="settings-notif-row">
          <div>
            <label class="settings-label">Push Notifications</label>
            <p class="settings-desc">Receive push notifications on this device.</p>
          </div>
          <label class="settings-switch">
            <input type="checkbox" ${enabled ? 'checked' : ''} onchange="SettingsPage.toggleNotifPref('enabled', this.checked)">
            <span class="settings-switch-slider"></span>
          </label>
        </div>
      </div>
      ${enabled ? categories.map(c => `<div class="settings-card">
        <div class="settings-notif-row">
          <div><label class="settings-label">${UI.icon(c.icon, 14)} ${c.label}</label></div>
          <label class="settings-switch">
            <input type="checkbox" ${prefs[c.key] !== false ? 'checked' : ''} onchange="SettingsPage.toggleNotifPref('${c.key}', this.checked)">
            <span class="settings-switch-slider"></span>
          </label>
        </div>
      </div>`).join('') : ''}
    </div>`;
  },

  async toggleNotifPref(key, value) {
    try {
      const p = this.state.profile || {};
      if (!p.notificationPrefs) p.notificationPrefs = {};
      p.notificationPrefs[key] = value;
      await Services.updateProfile({ notificationPrefs: p.notificationPrefs });
      // Re-render if toggling master switch to show/hide categories
      if (key === 'enabled') this.draw(document.getElementById('page-content'));
    } catch (e) { UI.toast('Failed to update: ' + e.message, 'error'); }
  },

  renderLinkedAccounts() {
    const user = auth.currentUser;
    if (!user) return '';
    const providers = (user.providerData || []).map(p => p.providerId);
    const hasGoogle = providers.includes('google.com');
    const hasApple = providers.includes('apple.com');
    const hasPassword = providers.includes('password');
    // Only show linking options (unlinking requires at least 2 providers)
    const canUnlink = providers.length > 1;

    return `<div class="settings-section">
      <div class="settings-section-title">${UI.icon('link', 16)} Linked Accounts</div>
      <p class="settings-section-desc">Link additional sign-in methods to your account.</p>

      <div class="settings-card">
        <div class="settings-notif-row">
          <div class="settings-link-info">
            <label class="settings-label">${UI.icon('mail', 14)} Google</label>
            ${hasGoogle ? '<span class="settings-linked-badge">Linked</span>' : '<span class="settings-unlinked-badge">Not linked</span>'}
          </div>
          ${hasGoogle
            ? (canUnlink ? `<button class="settings-action-btn settings-unlink-btn" onclick="SettingsPage.unlinkProvider('google.com')">Unlink</button>` : '')
            : `<button class="settings-action-btn settings-link-btn" onclick="SettingsPage.linkGoogle()">Link</button>`
          }
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-notif-row">
          <div class="settings-link-info">
            <label class="settings-label">${UI.icon('smartphone', 14)} Apple</label>
            ${hasApple ? '<span class="settings-linked-badge">Linked</span>' : '<span class="settings-unlinked-badge">Not linked</span>'}
          </div>
          ${hasApple
            ? (canUnlink ? `<button class="settings-action-btn settings-unlink-btn" onclick="SettingsPage.unlinkProvider('apple.com')">Unlink</button>` : '')
            : `<button class="settings-action-btn settings-link-btn" onclick="SettingsPage.linkApple()">Link</button>`
          }
        </div>
      </div>

      ${hasPassword ? '' : `<div class="settings-card">
        <div class="settings-notif-row">
          <div class="settings-link-info">
            <label class="settings-label">${UI.icon('key', 14)} Email & Password</label>
            <span class="settings-unlinked-badge">Not linked</span>
          </div>
          <button class="settings-action-btn settings-link-btn" onclick="SettingsPage.linkPassword()">Link</button>
        </div>
      </div>`}
    </div>`;
  },

  async linkGoogle() {
    try {
      if (typeof Native !== 'undefined' && Native.isNative && Native.platform === 'ios') {
        await Native.nativeAuth.linkGoogle();
      } else {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.currentUser.linkWithPopup(provider);
      }
      UI.toast('Google account linked!', 'success');
      this.draw(document.getElementById('page-content'));
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use') {
        UI.toast('This Google account is already linked to another user', 'error');
      } else { UI.toast('Failed to link: ' + e.message, 'error'); }
    }
  },

  async linkApple() {
    try {
      if (typeof Native !== 'undefined' && Native.isNative && Native.platform === 'ios') {
        await Native.nativeAuth.linkApple();
      } else {
        const provider = new firebase.auth.OAuthProvider('apple.com');
        await auth.currentUser.linkWithPopup(provider);
      }
      UI.toast('Apple account linked!', 'success');
      this.draw(document.getElementById('page-content'));
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use') {
        UI.toast('This Apple account is already linked to another user', 'error');
      } else { UI.toast('Failed to link: ' + e.message, 'error'); }
    }
  },

  async linkPassword() {
    const email = auth.currentUser?.email;
    if (!email) { UI.toast('No email on account', 'error'); return; }
    const password = prompt('Set a password for email sign-in:');
    if (!password || password.length < 6) { UI.toast('Password must be at least 6 characters', 'error'); return; }
    try {
      const credential = firebase.auth.EmailAuthProvider.credential(email, password);
      await auth.currentUser.linkWithCredential(credential);
      UI.toast('Email & password linked!', 'success');
      this.draw(document.getElementById('page-content'));
    } catch (e) { UI.toast('Failed to link: ' + e.message, 'error'); }
  },

  async unlinkProvider(providerId) {
    try {
      await auth.currentUser.unlink(providerId);
      const name = providerId === 'google.com' ? 'Google' : providerId === 'apple.com' ? 'Apple' : 'Provider';
      UI.toast(`${name} unlinked`, 'success');
      this.draw(document.getElementById('page-content'));
    } catch (e) { UI.toast('Failed to unlink: ' + e.message, 'error'); }
  }
};
