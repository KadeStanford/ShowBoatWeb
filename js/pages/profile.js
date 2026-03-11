/* ShowBoat — Profile Page */
const ProfilePage = {
  state: { profile: null, stats: null },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const uid = auth.currentUser.uid;
      const [profile, stats, inviteCodes, tickets] = await Promise.all([
        Services.getUserProfile(uid), Services.getUserStats(),
        Services.getUserInviteCodes().catch(() => []),
        Services.getMyTickets().catch(() => 0)
      ]);
      this.state.profile = profile;
      this.state.stats = stats;
      this.state.inviteCodes = inviteCodes;
      this.state.tickets = tickets;
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
      ${UI.pageHeader('Profile', true)}
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
        <div class="stat-card"><span class="stat-number">${s.watchlist || s.watchlistCount || 0}</span><span class="stat-label">Watchlist</span></div>
        <div class="stat-card"><span class="stat-number">${s.watched || s.watchedCount || 0}</span><span class="stat-label">Watched</span></div>
        <div class="stat-card"><span class="stat-number">${s.ratings || s.ratingsCount || 0}</span><span class="stat-label">Rated</span></div>
        <div class="stat-card"><span class="stat-number">${s.friends || s.friendsCount || 0}</span><span class="stat-label">Friends</span></div>
      </div>
      <div class="profile-menu">
        <button class="profile-menu-item" onclick="App.navigate('analytics')">${UI.icon('bar-chart-2', 20)} <span>Analytics & Stats</span> ${UI.icon('chevron-right', 18)}</button>
        <button class="profile-menu-item" onclick="App.navigate('badges')">${UI.icon('award', 20)} <span>Badges</span> ${UI.icon('chevron-right', 18)}</button>
        <button class="profile-menu-item" onclick="App.navigate('plex-connect')">${UI.icon('monitor', 20)} <span>Plex Connection</span> ${UI.icon('chevron-right', 18)}</button>
        <button class="profile-menu-item" onclick="App.navigate('wall-of-shame')">${UI.icon('thumbs-down', 20)} <span>Wall of Shame</span> ${UI.icon('chevron-right', 18)}</button>
        <button class="profile-menu-item" onclick="App.navigate('shared-lists')">${UI.icon('list', 20)} <span>Shared Lists</span> ${UI.icon('chevron-right', 18)}</button>
        <button class="profile-menu-item" onclick="App.navigate('matcher-history')">${UI.icon('zap', 20)} <span>Matcher History</span> ${UI.icon('chevron-right', 18)}</button>
        ${p.isAdmin ? `<button class="profile-menu-item profile-admin-btn" onclick="window.open('admin.html','_self')">${UI.icon('shield', 20)} <span>Admin Dashboard</span> ${UI.icon('chevron-right', 18)}</button>` : ''}
      </div>
      <div class="invite-section">
        <div class="invite-section-header">
          <span>${UI.icon('gift', 18)} Invite Codes <span class="ticket-badge">${this.state.tickets || 0} ticket${(this.state.tickets || 0) !== 1 ? 's' : ''}</span></span>
          <button class="invite-request-btn" onclick="ProfilePage.showTicketRequestModal()">${UI.icon('plus-circle', 16)} Request Tickets</button>
        </div>
        <p class="invite-desc">Share these codes with friends to invite them. Each recruit gets 5 bonus tickets.</p>
        <div class="invite-codes-list">${(this.state.inviteCodes || []).length ? (this.state.inviteCodes || []).map(c => `<div class="invite-code-chip" onclick="ProfilePage.copyCode('${UI.escapeHtml(c)}')"><span>${UI.escapeHtml(c)}</span>${UI.icon('copy', 14)}</div>`).join('') : '<p class="invite-empty">No invite codes yet.</p>'}</div>
      </div>
      <button class="btn-logout" onclick="ProfilePage.logout()">${UI.icon('log-out', 18)} Sign Out</button>
      <div class="tmdb-attribution">
        <img src="img/tmdb-logo.svg" alt="TMDB" class="tmdb-attr-logo">
        <p>This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</p>
      </div>
      <p class="app-version">ShowBoat &middot; <a href="https://showboat.me" style="color:var(--accent)">showboat.me</a></p>
    </div>`;
  },

  copyCode(code) {
    navigator.clipboard?.writeText(code).then(() => UI.toast(`Code ${code} copied!`, 'success')).catch(() => UI.toast(code, 'info'));
  },

  showTicketRequestModal() {
    UI.showModal('Request Extra Tickets', `
      <p style="color:var(--slate-300);margin-bottom:16px">Post about ShowBoat on social media and submit the link for review. Approved posts earn extra tickets.</p>
      <div class="input-group">
        <label>Post URL (Twitter/X, Instagram, TikTok, etc.)</label>
        <div class="input-wrapper">${UI.icon('link', 16)}<input type="url" id="ticket-post-url" placeholder="https://twitter.com/..."></div>
      </div>
      <div class="input-group" style="margin-top:12px">
        <label>Message (optional)</label>
        <textarea id="ticket-message" placeholder="Tell us about the post..." style="width:100%;background:var(--surface-2);border:1px solid var(--border);color:var(--text-primary);border-radius:8px;padding:10px;font-family:inherit;resize:vertical;min-height:80px"></textarea>
      </div>
      <div class="modal-buttons" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="ProfilePage._submitTicketRequest()">${UI.icon('send', 16)} Submit Request</button>
      </div>`);
  },

  async _submitTicketRequest() {
    const postUrl = document.getElementById('ticket-post-url')?.value?.trim();
    const message = document.getElementById('ticket-message')?.value?.trim() || '';
    if (!postUrl) { UI.toast('Please enter the post URL', 'error'); return; }
    try {
      await Services.submitTicketRequest(postUrl, message);
      UI.closeModal();
      UI.toast('Request submitted! We\'ll review it soon.', 'success');
    } catch (e) { UI.toast('Failed to submit: ' + e.message, 'error'); }
  },

  triggerPhotoUpload() {
    document.getElementById('profile-photo-input')?.click();
  },

  async _compressImage(file) {
    return new Promise(resolve => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 400;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => { URL.revokeObjectURL(objUrl); resolve(blob || file); }, 'image/jpeg', 0.75);
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
      img.src = objUrl;
    });
  },

  async handlePhotoUpload(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { UI.toast('Photo must be under 10MB', 'error'); return; }
    UI.toast('Uploading photo...', 'info');
    try {
      const compressed = await this._compressImage(file);
      const url = await Services.uploadProfilePhoto(compressed);
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
    UI.showModal('Sign Out', `<p style="color:var(--slate-300);margin-bottom:20px">Are you sure you want to sign out of ShowBoat?</p>
      <div class="modal-buttons" style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="btn-primary" style="background:var(--rose-600);box-shadow:none" onclick="UI.closeModal();ProfilePage._doLogout()">Sign Out</button>
      </div>`);
  },

  async _doLogout() {
    try { await auth.signOut(); } catch (e) { UI.toast('Sign out failed', 'error'); }
  }
};
