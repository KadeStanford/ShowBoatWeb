/* ShowBoat — Profile Page */
const ProfilePage = {
  state: { profile: null, stats: null },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const uid = auth.currentUser.uid;
      const [profile, stats] = await Promise.all([Services.getUserProfile(uid), Services.getUserStats()]);
      this.state.profile = profile;
      this.state.stats = stats;
      this.draw(el);
    } catch (e) { el.innerHTML = UI.emptyState('Error', e.message); }
  },

  draw(el) {
    const p = this.state.profile || {};
    const s = this.state.stats || {};
    const username = p.username || auth.currentUser?.displayName || 'User';
    const initial = username[0].toUpperCase();
    const photoURL = p.photoURL || auth.currentUser?.photoURL || '';

    const avatarHtml = photoURL
      ? `<img src="${UI.escapeHtml(photoURL)}" class="profile-avatar-lg profile-avatar-img" id="profile-avatar-img" alt="">`
      : `<div class="profile-avatar-lg" id="profile-avatar-initial">${initial}</div>`;

    el.innerHTML = `<div class="profile-page">
      <div class="profile-header">
        <div class="profile-avatar-wrap" onclick="ProfilePage.triggerPhotoUpload()" title="Change photo">
          ${avatarHtml}
          <div class="profile-avatar-edit">${UI.icon('camera', 14)}</div>
        </div>
        <input type="file" id="profile-photo-input" accept="image/*" style="display:none" onchange="ProfilePage.handlePhotoUpload(this.files[0])">
        <h2>${UI.escapeHtml(username)}</h2>
        <p class="profile-email">${UI.escapeHtml(auth.currentUser?.email || '')}</p>
        ${p.createdAt ? `<p class="profile-joined">Joined ${new Date(p.createdAt).toLocaleDateString()}</p>` : ''}
      </div>
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-number">${s.watchlistCount || 0}</span><span class="stat-label">Watchlist</span></div>
        <div class="stat-card"><span class="stat-number">${s.watchedCount || 0}</span><span class="stat-label">Watched</span></div>
        <div class="stat-card"><span class="stat-number">${s.ratingsCount || 0}</span><span class="stat-label">Rated</span></div>
        <div class="stat-card"><span class="stat-number">${s.friendsCount || 0}</span><span class="stat-label">Friends</span></div>
      </div>
      <div class="profile-menu">
        <button class="profile-menu-item" onclick="App.navigate('analytics')">${UI.icon('bar-chart-2', 20)} <span>Analytics & Stats</span> ${UI.icon('chevron-right', 18)}</button>
        <button class="profile-menu-item" onclick="App.navigate('badges')">${UI.icon('award', 20)} <span>Badges</span> ${UI.icon('chevron-right', 18)}</button>
        <button class="profile-menu-item" onclick="App.navigate('plex-connect')">${UI.icon('monitor', 20)} <span>Plex Connection</span> ${UI.icon('chevron-right', 18)}</button>
        <button class="profile-menu-item" onclick="App.navigate('wall-of-shame')">${UI.icon('thumbs-down', 20)} <span>Wall of Shame</span> ${UI.icon('chevron-right', 18)}</button>
        <button class="profile-menu-item" onclick="App.navigate('shared-lists')">${UI.icon('list', 20)} <span>Shared Lists</span> ${UI.icon('chevron-right', 18)}</button>
        <button class="profile-menu-item" onclick="App.navigate('matcher-history')">${UI.icon('zap', 20)} <span>Matcher History</span> ${UI.icon('chevron-right', 18)}</button>
      </div>
      <button class="btn-logout" onclick="ProfilePage.logout()">${UI.icon('log-out', 18)} Sign Out</button>
      <div class="tmdb-attribution">
        <img src="img/tmdb-logo.svg" alt="TMDB" class="tmdb-attr-logo">
        <p>This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</p>
      </div>
      <p class="app-version">ShowBoat &middot; <a href="https://showboat.me" style="color:var(--accent)">showboat.me</a></p>
    </div>`;
  },

  triggerPhotoUpload() {
    document.getElementById('profile-photo-input')?.click();
  },

  async handlePhotoUpload(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { UI.toast('Photo must be under 5MB', 'error'); return; }
    UI.toast('Uploading photo...', 'info');
    try {
      const url = await Services.uploadProfilePhoto(file);
      if (this.state.profile) this.state.profile.photoURL = url;
      // Update avatar in place without full redraw
      const wrap = document.querySelector('.profile-avatar-wrap');
      if (wrap) {
        const old = wrap.querySelector('.profile-avatar-lg');
        if (old) { const img = document.createElement('img'); img.src = url; img.className = 'profile-avatar-lg profile-avatar-img'; img.id = 'profile-avatar-img'; old.replaceWith(img); }
      }
      UI.toast('Profile photo updated!', 'success');
    } catch (e) { UI.toast('Upload failed: ' + e.message, 'error'); }
  },

  async logout() {
    if (confirm('Are you sure you want to sign out?')) {
      await auth.signOut();
    }
  }
};
