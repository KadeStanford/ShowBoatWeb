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
        <button class="profile-menu-item" onclick="ProfilePage.showShareCard()">${UI.icon('share-2', 20)} <span>Share Profile</span> ${UI.icon('chevron-right', 18)}</button>
        <button class="profile-menu-item" onclick="App.navigate('settings')">${UI.icon('settings', 20)} <span>Settings</span> ${UI.icon('chevron-right', 18)}</button>
        ${p.isAdmin ? `<button class="profile-menu-item profile-admin-btn" onclick="window.open('admin.html','_self')">${UI.icon('shield', 20)} <span>Admin Dashboard</span> ${UI.icon('chevron-right', 18)}</button>` : ''}
      </div>
      <div class="invite-section">
        <div class="invite-section-header">
          <span>${UI.icon('gift', 18)} Invite Codes <span class="ticket-badge">${this.state.tickets || 0} ticket${(this.state.tickets || 0) !== 1 ? 's' : ''}</span></span>
          <button class="invite-request-btn" onclick="ProfilePage.showTicketRequestModal()">${UI.icon('plus-circle', 16)} Request Tickets</button>
        </div>
        <p class="invite-desc">Share these codes with friends to invite them. Each recruit gets 5 bonus tickets.</p>
        <div class="invite-codes-list">${(this.state.inviteCodes || []).length ? (this.state.inviteCodes || []).map(c => `<div class="invite-code-row"><div class="invite-code-chip" onclick="ProfilePage.copyCode('${UI.escapeHtml(c)}')"><span>${UI.escapeHtml(c)}</span>${UI.icon('copy', 14)}</div><button class="invite-share-btn" onclick="ProfilePage.showInviteShareCard('${UI.escapeHtml(c)}')" title="Share card">${UI.icon('image', 14)}</button></div>`).join('') : '<p class="invite-empty">No invite codes yet.</p>'}</div>
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
  },

  /* ── Share Card System v2 ── Hundreds of themes, badge-unlockable, creative QR styles ── */
  _shareCardState: null,

  // ────────── THEME DEFINITIONS ──────────
  // Free themes (always available) + badge-unlocked themes
  _shareThemes: (() => {
    const free = [
      // ── Classic collection (12 free) ──
      { id: 'indigo',     name: 'Indigo',       bg1: '#1e1b4b', bg2: '#312e81', accent: '#a5b4fc', accent2: '#6366f1', category: 'Free' },
      { id: 'emerald',    name: 'Emerald',      bg1: '#022c22', bg2: '#064e3b', accent: '#6ee7b7', accent2: '#10b981', category: 'Free' },
      { id: 'rose',       name: 'Rose',         bg1: '#4c0519', bg2: '#881337', accent: '#fda4af', accent2: '#f43f5e', category: 'Free' },
      { id: 'amber',      name: 'Amber',        bg1: '#451a03', bg2: '#78350f', accent: '#fde68a', accent2: '#f59e0b', category: 'Free' },
      { id: 'purple',     name: 'Purple',       bg1: '#2e1065', bg2: '#4c1d95', accent: '#d8b4fe', accent2: '#a855f7', category: 'Free' },
      { id: 'slate',      name: 'Slate',        bg1: '#020617', bg2: '#1e293b', accent: '#cbd5e1', accent2: '#64748b', category: 'Free' },
      { id: 'cyan',       name: 'Cyan',         bg1: '#083344', bg2: '#164e63', accent: '#67e8f9', accent2: '#06b6d4', category: 'Free' },
      { id: 'pink',       name: 'Pink',         bg1: '#500724', bg2: '#831843', accent: '#f9a8d4', accent2: '#ec4899', category: 'Free' },
      { id: 'sky',        name: 'Sky',          bg1: '#0c4a6e', bg2: '#075985', accent: '#7dd3fc', accent2: '#0ea5e9', category: 'Free' },
      { id: 'teal',       name: 'Teal',         bg1: '#042f2e', bg2: '#115e59', accent: '#5eead4', accent2: '#14b8a6', category: 'Free' },
      { id: 'lime',       name: 'Lime',         bg1: '#1a2e05', bg2: '#365314', accent: '#bef264', accent2: '#84cc16', category: 'Free' },
      { id: 'zinc',       name: 'Zinc',         bg1: '#09090b', bg2: '#27272a', accent: '#d4d4d8', accent2: '#71717a', category: 'Free' },
    ];
    const badge = [
      // ── Binge Watcher (episodes) ──
      { id: 'tv_static',       name: 'TV Static',        bg1: '#0f0f23', bg2: '#1a1a3e', accent: '#c0c0ff', accent2: '#7070ff', category: 'Watcher', badgeId: 'binge_bronze' },
      { id: 'binge_night',     name: 'Binge Night',      bg1: '#0a0a1e', bg2: '#1c1040', accent: '#b794f6', accent2: '#805ad5', category: 'Watcher', badgeId: 'binge_bronze' },
      { id: 'remote_control',  name: 'Remote Control',   bg1: '#1a0a2e', bg2: '#2d1b69', accent: '#e9d5ff', accent2: '#a78bfa', category: 'Watcher', badgeId: 'binge_silver' },
      { id: 'couch_potato',    name: 'Couch Potato',     bg1: '#1b1708', bg2: '#3f3608', accent: '#fef08a', accent2: '#eab308', category: 'Watcher', badgeId: 'binge_silver' },
      { id: 'marathon_runner', name: 'Marathon Runner',   bg1: '#0d1b2a', bg2: '#1b3a5c', accent: '#93c5fd', accent2: '#3b82f6', category: 'Watcher', badgeId: 'binge_gold' },
      { id: 'tv_addict_glow',  name: 'TV Addict Glow',   bg1: '#160040', bg2: '#2d006b', accent: '#f0abfc', accent2: '#d946ef', category: 'Watcher', badgeId: 'binge_gold' },
      // ── Movie Buff (movies) ──
      { id: 'red_carpet',      name: 'Red Carpet',       bg1: '#2d0a0a', bg2: '#5c1010', accent: '#fca5a5', accent2: '#ef4444', category: 'Watcher', badgeId: 'movie_bronze' },
      { id: 'popcorn',         name: 'Popcorn',          bg1: '#2a1f00', bg2: '#4a3600', accent: '#fde68a', accent2: '#fbbf24', category: 'Watcher', badgeId: 'movie_bronze' },
      { id: 'silver_screen',   name: 'Silver Screen',    bg1: '#111118', bg2: '#2a2a35', accent: '#e2e8f0', accent2: '#94a3b8', category: 'Watcher', badgeId: 'movie_silver' },
      { id: 'directors_cut',   name: "Director's Cut",   bg1: '#1a0000', bg2: '#3d0000', accent: '#ff8a8a', accent2: '#dc2626', category: 'Watcher', badgeId: 'movie_silver' },
      { id: 'oscar_night',     name: 'Oscar Night',      bg1: '#1a1500', bg2: '#332a00', accent: '#ffd700', accent2: '#b8860b', category: 'Watcher', badgeId: 'movie_gold' },
      { id: 'film_reel',       name: 'Film Reel',        bg1: '#0a0a0a', bg2: '#1f1f1f', accent: '#fafafa', accent2: '#a1a1aa', category: 'Watcher', badgeId: 'movie_gold' },
      // ── Completionist (completed) ──
      { id: 'finish_line',     name: 'Finish Line',      bg1: '#001a0a', bg2: '#003d1a', accent: '#86efac', accent2: '#22c55e', category: 'Watcher', badgeId: 'finish_bronze' },
      { id: 'trophy_room',     name: 'Trophy Room',      bg1: '#1a1000', bg2: '#3d2400', accent: '#fdba74', accent2: '#f97316', category: 'Watcher', badgeId: 'finish_bronze' },
      { id: 'champion',        name: 'Champion',         bg1: '#0d1f1e', bg2: '#134e4a', accent: '#99f6e4', accent2: '#2dd4bf', category: 'Watcher', badgeId: 'finish_silver' },
      { id: 'completionist_aura', name: 'Completionist Aura', bg1: '#1e0533', bg2: '#3b0764', accent: '#e879f9', accent2: '#c026d3', category: 'Watcher', badgeId: 'finish_silver' },
      { id: 'golden_finale',   name: 'Golden Finale',    bg1: '#1a1400', bg2: '#3b2f00', accent: '#fef08a', accent2: '#eab308', category: 'Watcher', badgeId: 'finish_gold' },
      { id: 'victory_lap',     name: 'Victory Lap',      bg1: '#0c1e0c', bg2: '#15803d', accent: '#bbf7d0', accent2: '#4ade80', category: 'Watcher', badgeId: 'finish_gold' },
      // ── Critic (ratings) ──
      { id: 'ink_blot',        name: 'Ink Blot',         bg1: '#0f0f0f', bg2: '#262626', accent: '#e5e5e5', accent2: '#a3a3a3', category: 'Critic', badgeId: 'critic_bronze' },
      { id: 'star_rating',     name: 'Star Rating',      bg1: '#1a1500', bg2: '#42360a', accent: '#fde047', accent2: '#ca8a04', category: 'Critic', badgeId: 'critic_bronze' },
      { id: 'verdict',         name: 'The Verdict',      bg1: '#1a0505', bg2: '#450a0a', accent: '#fecaca', accent2: '#f87171', category: 'Critic', badgeId: 'critic_silver' },
      { id: 'critics_choice',  name: "Critic's Choice",  bg1: '#120824', bg2: '#2d1558', accent: '#c4b5fd', accent2: '#8b5cf6', category: 'Critic', badgeId: 'critic_silver' },
      { id: 'golden_pen',      name: 'Golden Pen',       bg1: '#1c1a00', bg2: '#433e00', accent: '#fef9c3', accent2: '#facc15', category: 'Critic', badgeId: 'critic_gold' },
      { id: 'masterclass',     name: 'Masterclass',      bg1: '#0a0a1e', bg2: '#1e1b4b', accent: '#c7d2fe', accent2: '#818cf8', category: 'Critic', badgeId: 'critic_gold' },
      // ── Reviews ──
      { id: 'notebook',        name: 'Notebook',         bg1: '#1a1410', bg2: '#3d3020', accent: '#fed7aa', accent2: '#fb923c', category: 'Critic', badgeId: 'review_bronze' },
      { id: 'typewriter',      name: 'Typewriter',       bg1: '#141414', bg2: '#2a2a2a', accent: '#d6d3d1', accent2: '#a8a29e', category: 'Critic', badgeId: 'review_bronze' },
      { id: 'editorial',       name: 'Editorial',        bg1: '#0f172a', bg2: '#1e3a5f', accent: '#bfdbfe', accent2: '#60a5fa', category: 'Critic', badgeId: 'review_silver' },
      { id: 'bestseller',      name: 'Bestseller',       bg1: '#1a0808', bg2: '#3b1515', accent: '#fecdd3', accent2: '#fb7185', category: 'Critic', badgeId: 'review_silver' },
      { id: 'pulitzer',        name: 'Pulitzer',         bg1: '#1a1705', bg2: '#3b3410', accent: '#fef3c7', accent2: '#fbbf24', category: 'Critic', badgeId: 'review_gold' },
      { id: 'columnist',       name: 'Columnist',        bg1: '#0c0c1e', bg2: '#1a1a40', accent: '#ddd6fe', accent2: '#a78bfa', category: 'Critic', badgeId: 'review_gold' },
      // ── Social (friends) ──
      { id: 'handshake',       name: 'Handshake',        bg1: '#0a1628', bg2: '#1e3a5f', accent: '#93c5fd', accent2: '#3b82f6', category: 'Social', badgeId: 'social_bronze' },
      { id: 'campfire',        name: 'Campfire',         bg1: '#1a0f00', bg2: '#3d2400', accent: '#fdba74', accent2: '#f97316', category: 'Social', badgeId: 'social_bronze' },
      { id: 'butterfly',       name: 'Butterfly',        bg1: '#180830', bg2: '#2e1065', accent: '#e9d5ff', accent2: '#a855f7', category: 'Social', badgeId: 'social_silver' },
      { id: 'party_lights',    name: 'Party Lights',     bg1: '#1a0028', bg2: '#3b0764', accent: '#f0abfc', accent2: '#d946ef', category: 'Social', badgeId: 'social_silver' },
      { id: 'golden_network',  name: 'Golden Network',   bg1: '#1a1500', bg2: '#332a00', accent: '#fde68a', accent2: '#eab308', category: 'Social', badgeId: 'social_gold' },
      { id: 'connector',       name: 'The Connector',    bg1: '#001a1a', bg2: '#003d3d', accent: '#5eead4', accent2: '#14b8a6', category: 'Social', badgeId: 'social_gold' },
      // ── Shame (shames_sent) ──
      { id: 'tough_love',      name: 'Tough Love',       bg1: '#1e0000', bg2: '#450a0a', accent: '#fca5a5', accent2: '#ef4444', category: 'Social', badgeId: 'shame_bronze' },
      { id: 'side_eye',        name: 'Side Eye',         bg1: '#1a1005', bg2: '#45300d', accent: '#fde68a', accent2: '#d97706', category: 'Social', badgeId: 'shame_bronze' },
      { id: 'hall_monitor',    name: 'Hall Monitor',     bg1: '#0a1020', bg2: '#1e2d4a', accent: '#a5b4fc', accent2: '#6366f1', category: 'Social', badgeId: 'shame_silver' },
      { id: 'shame_flame',     name: 'Shame Flame',      bg1: '#2d0a00', bg2: '#5c1a00', accent: '#fdba74', accent2: '#ea580c', category: 'Social', badgeId: 'shame_silver' },
      { id: 'inferno',         name: 'Inferno',          bg1: '#1a0000', bg2: '#4a0000', accent: '#ff6b6b', accent2: '#dc2626', category: 'Social', badgeId: 'shame_gold' },
      { id: 'devil',           name: 'Devil',            bg1: '#1a0010', bg2: '#4a0028', accent: '#ff6b9d', accent2: '#e11d48', category: 'Social', badgeId: 'shame_gold' },
      // ── Watchlist ──
      { id: 'bookmark',        name: 'Bookmark',         bg1: '#0a1a28', bg2: '#1a3050', accent: '#7dd3fc', accent2: '#0ea5e9', category: 'Watcher', badgeId: 'wl_bronze' },
      { id: 'reading_list',    name: 'Reading List',     bg1: '#0f1a0a', bg2: '#1a3010', accent: '#bbf7d0', accent2: '#4ade80', category: 'Watcher', badgeId: 'wl_bronze' },
      { id: 'library',         name: 'Library',          bg1: '#1a1008', bg2: '#3d2810', accent: '#fed7aa', accent2: '#fb923c', category: 'Watcher', badgeId: 'wl_silver' },
      { id: 'collection',      name: 'Collection',       bg1: '#0a0a20', bg2: '#1a1a45', accent: '#c7d2fe', accent2: '#818cf8', category: 'Watcher', badgeId: 'wl_silver' },
      { id: 'archivist',       name: 'The Archivist',    bg1: '#0d0d1a', bg2: '#1e1e35', accent: '#e2e8f0', accent2: '#94a3b8', category: 'Watcher', badgeId: 'wl_gold' },
      { id: 'infinite_shelf',  name: 'Infinite Shelf',   bg1: '#100a1e', bg2: '#2a1850', accent: '#ddd6fe', accent2: '#a78bfa', category: 'Watcher', badgeId: 'wl_gold' },
      // ── Plex ──
      { id: 'plex_orange',     name: 'Plex Orange',      bg1: '#1a1000', bg2: '#3d2800', accent: '#ffcc00', accent2: '#e5a800', category: 'Plex', badgeId: 'plex_connected' },
      { id: 'plex_dark',       name: 'Plex Dark',        bg1: '#0a0a0a', bg2: '#1a1a1a', accent: '#e5a800', accent2: '#cc9600', category: 'Plex', badgeId: 'plex_connected' },
      { id: 'plex_neon',       name: 'Plex Neon',        bg1: '#0d0d1e', bg2: '#1a1a35', accent: '#ffd700', accent2: '#ffaa00', category: 'Plex', badgeId: 'plex_connected' },
      { id: 'streaming_glow',  name: 'Streaming Glow',   bg1: '#001a0a', bg2: '#002a15', accent: '#86efac', accent2: '#22c55e', category: 'Plex', badgeId: 'plex_connected' },
      // ── Matcher ──
      { id: 'lightning',       name: 'Lightning',        bg1: '#1a1500', bg2: '#3d3000', accent: '#fde047', accent2: '#ca8a04', category: 'Social', badgeId: 'matcher_bronze' },
      { id: 'electric',        name: 'Electric',         bg1: '#001a2e', bg2: '#003d5c', accent: '#67e8f9', accent2: '#06b6d4', category: 'Social', badgeId: 'matcher_bronze' },
      { id: 'cupid',           name: 'Cupid',            bg1: '#2d0a1a', bg2: '#5c1535', accent: '#fda4af', accent2: '#f43f5e', category: 'Social', badgeId: 'matcher_silver' },
      { id: 'soulmate',        name: 'Soulmate',         bg1: '#1a0028', bg2: '#3b0050', accent: '#f0abfc', accent2: '#d946ef', category: 'Social', badgeId: 'matcher_silver' },
      // ── Episode Ratings ──
      { id: 'episode_tracker', name: 'Episode Tracker',  bg1: '#0a1a1a', bg2: '#0d3335', accent: '#5eead4', accent2: '#14b8a6', category: 'Critic', badgeId: 'ep_critic_bronze' },
      { id: 'scene_critic',    name: 'Scene Critic',     bg1: '#1a0a28', bg2: '#2d1550', accent: '#c4b5fd', accent2: '#8b5cf6', category: 'Critic', badgeId: 'ep_critic_bronze' },
      { id: 'episode_guru',    name: 'Episode Guru',     bg1: '#001a0d', bg2: '#003d1f', accent: '#bbf7d0', accent2: '#4ade80', category: 'Critic', badgeId: 'ep_critic_silver' },
      { id: 'series_analyst',  name: 'Series Analyst',   bg1: '#0a0a28', bg2: '#1a1a50', accent: '#a5b4fc', accent2: '#6366f1', category: 'Critic', badgeId: 'ep_critic_silver' },
      // ── Special multi-badge themes (need multiple badges) ──
      { id: 'obsidian',        name: 'Obsidian',         bg1: '#050505', bg2: '#111111', accent: '#666666', accent2: '#444444', category: 'Special', badgeId: 'binge_gold' },
      { id: 'holographic',     name: 'Holographic',      bg1: '#0a0020', bg2: '#1a0040', accent: '#ff6bff', accent2: '#6b6bff', category: 'Special', badgeId: 'movie_gold' },
      { id: 'aurora',          name: 'Aurora',           bg1: '#001020', bg2: '#001a30', accent: '#34d399', accent2: '#818cf8', category: 'Special', badgeId: 'finish_gold' },
      { id: 'supernova',       name: 'Supernova',        bg1: '#1a0800', bg2: '#3d1500', accent: '#ff9f43', accent2: '#ff6348', category: 'Special', badgeId: 'critic_gold' },
      { id: 'midnight_bloom',  name: 'Midnight Bloom',   bg1: '#0a0015', bg2: '#1a0030', accent: '#c084fc', accent2: '#f472b6', category: 'Special', badgeId: 'review_gold' },
      { id: 'constellation',   name: 'Constellation',    bg1: '#020617', bg2: '#0f172a', accent: '#e2e8f0', accent2: '#fde68a', category: 'Special', badgeId: 'social_gold' },
      { id: 'volcanic',        name: 'Volcanic',         bg1: '#1a0000', bg2: '#3d0a00', accent: '#ff4500', accent2: '#ff8c00', category: 'Special', badgeId: 'shame_gold' },
      { id: 'arctic',          name: 'Arctic',           bg1: '#001828', bg2: '#002840', accent: '#e0f2fe', accent2: '#bae6fd', category: 'Special', badgeId: 'wl_gold' },
      { id: 'quantum',         name: 'Quantum',          bg1: '#050010', bg2: '#100025', accent: '#a855f7', accent2: '#06b6d4', category: 'Special', badgeId: 'matcher_silver' },
      { id: 'neon_city',       name: 'Neon City',        bg1: '#0a001a', bg2: '#1a0035', accent: '#f472b6', accent2: '#22d3ee', category: 'Special', badgeId: 'ep_critic_silver' },
      // ── Tier bonus themes (any badge of that tier) ──
      { id: 'bronze_patina',   name: 'Bronze Patina',    bg1: '#1a1008', bg2: '#3d2810', accent: '#cd7f32', accent2: '#a0622a', category: 'Tier Bonus', tierReq: 'bronze' },
      { id: 'bronze_fire',     name: 'Bronze Fire',      bg1: '#1a0800', bg2: '#3d1a08', accent: '#f97316', accent2: '#cd7f32', category: 'Tier Bonus', tierReq: 'bronze' },
      { id: 'bronze_earth',    name: 'Bronze Earth',     bg1: '#14120a', bg2: '#2d2a18', accent: '#d4a76a', accent2: '#a68a55', category: 'Tier Bonus', tierReq: 'bronze' },
      { id: 'silver_chrome',   name: 'Silver Chrome',    bg1: '#0d0d10', bg2: '#1e1e25', accent: '#c0c0c0', accent2: '#8a8a90', category: 'Tier Bonus', tierReq: 'silver' },
      { id: 'silver_ice',      name: 'Silver Ice',       bg1: '#081018', bg2: '#101828', accent: '#e0e7ff', accent2: '#c0c0c0', category: 'Tier Bonus', tierReq: 'silver' },
      { id: 'silver_silk',     name: 'Silver Silk',      bg1: '#0f0f14', bg2: '#20202a', accent: '#d4d4dc', accent2: '#a1a1ab', category: 'Tier Bonus', tierReq: 'silver' },
      { id: 'gold_luxe',       name: 'Gold Luxe',        bg1: '#1a1500', bg2: '#332a00', accent: '#ffd700', accent2: '#b8860b', category: 'Tier Bonus', tierReq: 'gold' },
      { id: 'gold_royal',      name: 'Gold Royal',       bg1: '#1a1000', bg2: '#3b2800', accent: '#fbbf24', accent2: '#d97706', category: 'Tier Bonus', tierReq: 'gold' },
      { id: 'gold_crown',      name: 'Gold Crown',       bg1: '#1a1200', bg2: '#3d2d00', accent: '#fde047', accent2: '#ca8a04', category: 'Tier Bonus', tierReq: 'gold' },
      // ── Badge count milestone themes ──
      { id: 'collector_5',     name: 'Collector',        bg1: '#0a1020', bg2: '#152040', accent: '#93c5fd', accent2: '#3b82f6', category: 'Milestone', badgeCount: 5 },
      { id: 'hoarder_10',      name: 'Hoarder',          bg1: '#100a20', bg2: '#201540', accent: '#c4b5fd', accent2: '#8b5cf6', category: 'Milestone', badgeCount: 10 },
      { id: 'veteran_15',      name: 'Veteran',          bg1: '#0a2010', bg2: '#154020', accent: '#86efac', accent2: '#22c55e', category: 'Milestone', badgeCount: 15 },
      { id: 'elite_20',        name: 'Elite',            bg1: '#1a1000', bg2: '#3d2400', accent: '#fbbf24', accent2: '#f97316', category: 'Milestone', badgeCount: 20 },
      { id: 'legend_25',       name: 'Legend',           bg1: '#1a0a1e', bg2: '#3d1545', accent: '#f0abfc', accent2: '#d946ef', category: 'Milestone', badgeCount: 25 },
      { id: 'mythic_30',       name: 'Mythic',           bg1: '#0a0015', bg2: '#1a0030', accent: '#e879f9', accent2: '#a855f7', category: 'Milestone', badgeCount: 30 },
      { id: 'transcendent_35', name: 'Transcendent',     bg1: '#001018', bg2: '#002030', accent: '#67e8f9', accent2: '#22d3ee', category: 'Milestone', badgeCount: 35 },
      { id: 'supreme_40',      name: 'Supreme',          bg1: '#050505', bg2: '#0f0f0f', accent: '#fafafa', accent2: '#ffd700', category: 'Milestone', badgeCount: 40 },
      // ── Extra creative badge-linked ──
      { id: 'retro_tv',        name: 'Retro TV',         bg1: '#1a180a', bg2: '#2d2a10', accent: '#fef3c7', accent2: '#d97706', category: 'Watcher', badgeId: 'binge_bronze' },
      { id: 'static_noise',    name: 'Static Noise',     bg1: '#111111', bg2: '#1e1e1e', accent: '#d4d4d4', accent2: '#888888', category: 'Watcher', badgeId: 'binge_silver' },
      { id: 'premiere_night',  name: 'Premiere Night',   bg1: '#0d001a', bg2: '#1a0035', accent: '#e9d5ff', accent2: '#a78bfa', category: 'Watcher', badgeId: 'movie_bronze' },
      { id: 'matinee',         name: 'Matinee',          bg1: '#1a1508', bg2: '#3d3018', accent: '#fef9c3', accent2: '#eab308', category: 'Watcher', badgeId: 'movie_silver' },
      { id: 'blockbuster',     name: 'Blockbuster',      bg1: '#1a0005', bg2: '#3d0010', accent: '#ff8a8a', accent2: '#dc2626', category: 'Watcher', badgeId: 'movie_gold' },
      { id: 'deep_focus',      name: 'Deep Focus',       bg1: '#001020', bg2: '#002040', accent: '#7dd3fc', accent2: '#0284c7', category: 'Critic', badgeId: 'critic_bronze' },
      { id: 'sharp_tongue',    name: 'Sharp Tongue',     bg1: '#1a000a', bg2: '#3d0018', accent: '#fda4af', accent2: '#e11d48', category: 'Critic', badgeId: 'critic_silver' },
      { id: 'quill',           name: 'Quill',            bg1: '#0d0d18', bg2: '#1a1a30', accent: '#c7d2fe', accent2: '#818cf8', category: 'Critic', badgeId: 'review_bronze' },
      { id: 'manuscript',      name: 'Manuscript',       bg1: '#1a1810', bg2: '#302d1a', accent: '#fde68a', accent2: '#ca8a04', category: 'Critic', badgeId: 'review_silver' },
      { id: 'crowd_surfer',    name: 'Crowd Surfer',     bg1: '#0a001e', bg2: '#1a0040', accent: '#c4b5fd', accent2: '#7c3aed', category: 'Social', badgeId: 'social_bronze' },
      { id: 'high_five',       name: 'High Five',        bg1: '#001a10', bg2: '#003d20', accent: '#6ee7b7', accent2: '#10b981', category: 'Social', badgeId: 'social_silver' },
      { id: 'roast_master',    name: 'Roast Master',     bg1: '#1a0500', bg2: '#3d0f00', accent: '#fdba74', accent2: '#ea580c', category: 'Social', badgeId: 'shame_bronze' },
      { id: 'night_watch',     name: 'Night Watch',      bg1: '#000a1a', bg2: '#001530', accent: '#93c5fd', accent2: '#3b82f6', category: 'Social', badgeId: 'shame_silver' },
      { id: 'to_be_watched',   name: 'To Be Watched',    bg1: '#0a0018', bg2: '#1a0030', accent: '#ddd6fe', accent2: '#a78bfa', category: 'Watcher', badgeId: 'wl_bronze' },
      { id: 'curated',         name: 'Curated',          bg1: '#001410', bg2: '#002820', accent: '#a7f3d0', accent2: '#34d399', category: 'Watcher', badgeId: 'wl_silver' },
      { id: 'spark',           name: 'Spark',            bg1: '#1a1200', bg2: '#3d2800', accent: '#fde047', accent2: '#eab308', category: 'Social', badgeId: 'matcher_bronze' },
      { id: 'heart_radar',     name: 'Heart Radar',      bg1: '#1e0020', bg2: '#3d0040', accent: '#f9a8d4', accent2: '#ec4899', category: 'Social', badgeId: 'matcher_silver' },
      { id: 'precision',       name: 'Precision',        bg1: '#001a18', bg2: '#003530', accent: '#5eead4', accent2: '#14b8a6', category: 'Critic', badgeId: 'ep_critic_bronze' },
      { id: 'scene_stealer',   name: 'Scene Stealer',    bg1: '#1a0010', bg2: '#3b0025', accent: '#f9a8d4', accent2: '#ec4899', category: 'Critic', badgeId: 'ep_critic_silver' },
      // ── Gradient mix themes (various badge requirements) ──
      { id: 'sunset_drive',    name: 'Sunset Drive',     bg1: '#1a0a20', bg2: '#3d1820', accent: '#fda4af', accent2: '#fb923c', category: 'Special', badgeId: 'binge_silver' },
      { id: 'ocean_floor',     name: 'Ocean Floor',      bg1: '#001020', bg2: '#002040', accent: '#67e8f9', accent2: '#3b82f6', category: 'Special', badgeId: 'movie_silver' },
      { id: 'northern_lights', name: 'Northern Lights',  bg1: '#000a20', bg2: '#001030', accent: '#86efac', accent2: '#818cf8', category: 'Special', badgeId: 'finish_silver' },
      { id: 'cherry_blossom',  name: 'Cherry Blossom',   bg1: '#1a0510', bg2: '#300a20', accent: '#f9a8d4', accent2: '#f472b6', category: 'Special', badgeId: 'review_bronze' },
      { id: 'deep_sea',        name: 'Deep Sea',         bg1: '#000810', bg2: '#001020', accent: '#7dd3fc', accent2: '#0e7490', category: 'Special', badgeId: 'social_silver' },
      { id: 'wildfire',        name: 'Wildfire',         bg1: '#1a0500', bg2: '#3d0f00', accent: '#fca5a5', accent2: '#f97316', category: 'Special', badgeId: 'shame_silver' },
      { id: 'twilight',        name: 'Twilight',         bg1: '#0a0020', bg2: '#150035', accent: '#c4b5fd', accent2: '#f472b6', category: 'Special', badgeId: 'wl_silver' },
      { id: 'solar_flare',     name: 'Solar Flare',      bg1: '#1a0a00', bg2: '#3d1a00', accent: '#fde68a', accent2: '#f97316', category: 'Special', badgeId: 'critic_silver' },
      { id: 'cosmic_dust',     name: 'Cosmic Dust',      bg1: '#050510', bg2: '#0f0f20', accent: '#e2e8f0', accent2: '#a78bfa', category: 'Special', badgeId: 'matcher_bronze' },
      { id: 'plasma',          name: 'Plasma',           bg1: '#100020', bg2: '#200040', accent: '#e879f9', accent2: '#06b6d4', category: 'Special', badgeId: 'ep_critic_bronze' },
    ];
    return [...free, ...badge];
  })(),

  // ────────── QR STYLE DEFINITIONS ──────────
  _qrStyles: ['classic', 'dots', 'rounded', 'diamond', 'star'],

  // ────────── Get user's unlocked theme IDs ──────────
  _getUnlockedThemeIds() {
    const earned = new Set(this._shareCardState?.earnedBadgeIds || []);
    const earnedCount = earned.size;
    const earnedTiers = new Set();
    (typeof BADGE_DEFS !== 'undefined' ? BADGE_DEFS : []).forEach(b => {
      if (earned.has(b.id)) earnedTiers.add(b.tier);
    });
    return new Set(this._shareThemes.filter(t => {
      if (!t.badgeId && !t.tierReq && !t.badgeCount) return true; // free
      if (t.badgeId && earned.has(t.badgeId)) return true;
      if (t.tierReq && earnedTiers.has(t.tierReq)) return true;
      if (t.badgeCount && earnedCount >= t.badgeCount) return true;
      return false;
    }).map(t => t.id));
  },

  async showShareCard() {
    const uid = auth.currentUser.uid;
    const p = this.state.profile || {};
    const s = this.state.stats || {};
    const username = p.username || auth.currentUser?.displayName || 'User';
    const photoURL = p.photoURL || auth.currentUser?.photoURL || '';
    const profileUrl = `${window.location.origin}${window.location.pathname}#friend-profile?id=${uid}`;
    let earnedBadgeIds = [];
    try {
      const doc = await db.collection('users').doc(uid).get();
      earnedBadgeIds = doc.data()?.earnedBadgeIds || [];
    } catch (_) {}
    this._shareCardState = {
      type: 'profile', theme: 'indigo', style: 'minimal', qrStyle: 'classic',
      showStats: true, showQR: true, showBadges: true,
      username, photoURL, stats: s, qrData: profileUrl, earnedBadgeIds,
      joinDate: p.createdAt || null, themeCategory: 'All'
    };
    UI.showModal('Share Profile', this._shareCardModalHTML());
    setTimeout(() => this._renderShareCard(), 150);
  },

  async showInviteShareCard(code) {
    const uid = auth.currentUser?.uid;
    const p = this.state.profile || {};
    const username = p.username || auth.currentUser?.displayName || 'User';
    const photoURL = p.photoURL || auth.currentUser?.photoURL || '';
    const inviteUrl = `${window.location.origin}${window.location.pathname}#signup?invite=${encodeURIComponent(code)}`;
    let earnedBadgeIds = [];
    try {
      if (uid) { const doc = await db.collection('users').doc(uid).get(); earnedBadgeIds = doc.data()?.earnedBadgeIds || []; }
    } catch (_) {}
    this._shareCardState = {
      type: 'invite', theme: 'emerald', style: 'minimal', qrStyle: 'classic',
      showStats: false, showQR: true, showBadges: false,
      username, photoURL, code, qrData: inviteUrl, earnedBadgeIds,
      joinDate: p.createdAt || null, themeCategory: 'All'
    };
    UI.showModal('Share Invite', this._shareCardModalHTML());
    setTimeout(() => this._renderShareCard(), 150);
  },

  _shareCardModalHTML() {
    const st = this._shareCardState;
    const unlocked = this._getUnlockedThemeIds();
    const cats = ['All', 'Free', 'Watcher', 'Critic', 'Social', 'Plex', 'Special', 'Tier Bonus', 'Milestone'];
    const filtered = this._shareThemes.filter(t => st.themeCategory === 'All' || t.category === st.themeCategory);
    const earnedSet = new Set(st.earnedBadgeIds || []);
    const badgeMap = {};
    (typeof BADGE_DEFS !== 'undefined' ? BADGE_DEFS : []).forEach(b => { badgeMap[b.id] = b; });

    return `<div class="scb-wrapper">
      <div class="scb-preview"><canvas id="share-card-canvas"></canvas></div>
      <div class="scb-section">
        <span class="scb-section-label">Theme Category</span>
        <div class="scb-cat-tabs">${cats.map(c => {
          const count = this._shareThemes.filter(t => c === 'All' || t.category === c).length;
          const lockedCount = this._shareThemes.filter(t => (c === 'All' || t.category === c) && !unlocked.has(t.id)).length;
          return `<button class="scb-cat-btn ${st.themeCategory === c ? 'active' : ''}" onclick="ProfilePage._setThemeCategory('${c}')">${c}${lockedCount > 0 ? ` <span class="scb-lock-count">${UI.icon('lock', 10)}${lockedCount}</span>` : ''}</button>`;
        }).join('')}</div>
      </div>
      <div class="scb-section">
        <span class="scb-section-label">Themes (${unlocked.size}/${this._shareThemes.length} unlocked)</span>
        <div class="scb-themes" id="scb-themes-grid">${filtered.map(t => {
          const isUnlocked = unlocked.has(t.id);
          const badge = t.badgeId ? badgeMap[t.badgeId] : null;
          const lockTitle = !isUnlocked ? (t.badgeCount ? `Earn ${t.badgeCount} badges to unlock` : t.tierReq ? `Earn any ${t.tierReq} badge to unlock` : badge ? `Earn "${badge.name}" badge to unlock` : 'Locked') : t.name;
          return `<button class="scb-theme-btn ${st.theme === t.id ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}" style="background:linear-gradient(135deg,${t.bg1},${t.accent2})" onclick="ProfilePage._setShareTheme('${t.id}')" title="${UI.escapeHtml(lockTitle)}" data-theme="${t.id}">${!isUnlocked ? '<span class="scb-lock-icon">' + UI.icon('lock', 11) + '</span>' : ''}</button>`;
        }).join('')}</div>
      </div>
      <div class="scb-section">
        <span class="scb-section-label">Style</span>
        <div class="scb-styles">${['minimal', 'bold', 'neon', 'glass', 'retro'].map(s => `<button class="scb-style-btn ${st.style === s ? 'active' : ''}" onclick="ProfilePage._setShareStyle('${s}')">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
      </div>
      <div class="scb-section">
        <span class="scb-section-label">QR Style</span>
        <div class="scb-styles">${this._qrStyles.map(q => `<button class="scb-style-btn ${st.qrStyle === q ? 'active' : ''}" onclick="ProfilePage._setQrStyle('${q}')">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div>
      </div>
      <div class="scb-section">
        <span class="scb-section-label">Options</span>
        <div class="scb-toggles">
          ${st.type === 'profile' ? `<label class="scb-toggle"><input type="checkbox" ${st.showStats ? 'checked' : ''} onchange="ProfilePage._toggleShareOpt('showStats', this.checked)"> Stats</label>` : ''}
          ${st.type === 'profile' ? `<label class="scb-toggle"><input type="checkbox" ${st.showBadges ? 'checked' : ''} onchange="ProfilePage._toggleShareOpt('showBadges', this.checked)"> Badges</label>` : ''}
          <label class="scb-toggle"><input type="checkbox" ${st.showQR ? 'checked' : ''} onchange="ProfilePage._toggleShareOpt('showQR', this.checked)"> QR Code</label>
        </div>
      </div>
      <div class="scb-actions">
        <button class="scb-btn scb-btn-secondary" onclick="ProfilePage._downloadShareCard()">${UI.icon('download', 16)} Save</button>
        <button class="scb-btn scb-btn-primary" onclick="ProfilePage._shareShareCard()">${UI.icon('share-2', 16)} Share</button>
      </div>
    </div>`;
  },

  _setThemeCategory(cat) {
    this._shareCardState.themeCategory = cat;
    // Re-render just the modal HTML
    const wrapper = document.querySelector('.scb-wrapper');
    if (wrapper) {
      const parent = wrapper.parentElement;
      if (parent) { parent.innerHTML = this._shareCardModalHTML(); setTimeout(() => this._renderShareCard(), 50); }
    }
  },

  _setShareTheme(themeId) {
    const unlocked = this._getUnlockedThemeIds();
    if (!unlocked.has(themeId)) {
      const theme = this._shareThemes.find(t => t.id === themeId);
      if (!theme) return;
      const badgeMap = {};
      (typeof BADGE_DEFS !== 'undefined' ? BADGE_DEFS : []).forEach(b => { badgeMap[b.id] = b; });
      let msg = 'This theme is locked.';
      if (theme.badgeId && badgeMap[theme.badgeId]) msg = `Earn the "${badgeMap[theme.badgeId].name}" badge to unlock!`;
      else if (theme.tierReq) msg = `Earn any ${theme.tierReq} tier badge to unlock!`;
      else if (theme.badgeCount) msg = `Earn ${theme.badgeCount} badges to unlock!`;
      UI.toast(msg, 'info');
      return;
    }
    this._shareCardState.theme = themeId;
    document.querySelectorAll('.scb-theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === themeId));
    this._renderShareCard();
  },

  _setShareStyle(style) {
    this._shareCardState.style = style;
    document.querySelectorAll('.scb-styles')[0]?.querySelectorAll('.scb-style-btn').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === style));
    this._renderShareCard();
  },

  _setQrStyle(style) {
    this._shareCardState.qrStyle = style;
    document.querySelectorAll('.scb-styles')[1]?.querySelectorAll('.scb-style-btn').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === style));
    this._renderShareCard();
  },

  _toggleShareOpt(key, val) {
    this._shareCardState[key] = val;
    this._renderShareCard();
  },

  async _renderShareCard() {
    const canvas = document.getElementById('share-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 440, H = 640;
    canvas.width = W; canvas.height = H;
    const st = this._shareCardState;
    const themeObj = this._shareThemes.find(t => t.id === st.theme);
    const t = themeObj || this._shareThemes[0];

    // ── Background gradient ──
    const grad = ctx.createLinearGradient(0, 0, W * 0.3, H);
    grad.addColorStop(0, t.bg1); grad.addColorStop(1, t.bg2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // ── Style decorations ──
    if (st.style === 'bold') {
      ctx.globalAlpha = 0.08; ctx.fillStyle = t.accent;
      ctx.beginPath(); ctx.arc(W * 0.85, H * 0.12, 120, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W * 0.15, H * 0.88, 80, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W * 0.5, H * 0.5, 200, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (st.style === 'neon') {
      ctx.strokeStyle = t.accent + '30'; ctx.lineWidth = 1;
      ctx.strokeRect(20, 20, W - 40, H - 40);
      ctx.strokeStyle = t.accent + '80'; ctx.lineWidth = 2;
      ctx.shadowColor = t.accent; ctx.shadowBlur = 8;
      const c = 30;
      [[20, 20 + c, 20, 20, 20 + c, 20], [W - 20 - c, 20, W - 20, 20, W - 20, 20 + c],
       [20, H - 20 - c, 20, H - 20, 20 + c, H - 20], [W - 20 - c, H - 20, W - 20, H - 20, W - 20, H - 20 - c]]
        .forEach(([x1, y1, x2, y2, x3, y3]) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke(); });
      ctx.shadowBlur = 0;
    } else if (st.style === 'glass') {
      ctx.fillStyle = 'rgba(255,255,255,.03)';
      this._scRoundRect(ctx, 20, 20, W - 40, H - 40, 20); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
      this._scRoundRect(ctx, 20, 20, W - 40, H - 40, 20); ctx.stroke();
      // Frosted highlight
      const glassGrad = ctx.createLinearGradient(0, 0, W, 0);
      glassGrad.addColorStop(0, 'rgba(255,255,255,.04)'); glassGrad.addColorStop(0.5, 'rgba(255,255,255,.01)'); glassGrad.addColorStop(1, 'rgba(255,255,255,.04)');
      ctx.fillStyle = glassGrad; ctx.fillRect(20, 20, W - 40, H / 3);
    } else if (st.style === 'retro') {
      // Scanlines
      ctx.globalAlpha = 0.03; ctx.fillStyle = '#fff';
      for (let ry = 0; ry < H; ry += 4) { ctx.fillRect(0, ry, W, 1); }
      ctx.globalAlpha = 1;
      // CRT vignette
      const vigGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.8);
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)'); vigGrad.addColorStop(1, 'rgba(0,0,0,.35)');
      ctx.fillStyle = vigGrad; ctx.fillRect(0, 0, W, H);
    }

    let y = 70;
    // ── Avatar ──
    const size = 88;
    const drawInitial = () => {
      ctx.beginPath(); ctx.arc(W / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = t.accent2 + '40'; ctx.fill();
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = t.accent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((st.username || 'U')[0].toUpperCase(), W / 2, y + size / 2);
    };
    if (st.photoURL) {
      try {
        const img = await this._loadImg(st.photoURL);
        // Accent ring
        ctx.beginPath(); ctx.arc(W / 2, y + size / 2, size / 2 + 4, 0, Math.PI * 2);
        ctx.strokeStyle = t.accent; ctx.lineWidth = 3; ctx.stroke();
        ctx.save(); ctx.beginPath(); ctx.arc(W / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(img, W / 2 - size / 2, y, size, size); ctx.restore();
      } catch (_) { drawInitial(); }
    } else { drawInitial(); }
    y += size + 18;

    // ── Username ──
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#f1f5f9'; ctx.fillText(st.username, W / 2, y);
    y += 34;

    // ── Invite code ──
    if (st.type === 'invite' && st.code) {
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#94a3b8'; ctx.fillText('Invite Code', W / 2, y); y += 22;
      // Code background
      const codeWidth = 200;
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      this._scRoundRect(ctx, W / 2 - codeWidth / 2, y - 4, codeWidth, 38, 8); ctx.fill();
      ctx.font = 'bold 24px monospace'; ctx.fillStyle = t.accent;
      ctx.fillText(st.code, W / 2, y + 6); y += 44;
    }

    // ── Stats grid ──
    if (st.showStats && st.stats) {
      const s = st.stats;
      const episodes = s.episodes || s.watchedCount || 0;
      const movies = s.movies || 0;
      const completed = s.completed || 0;
      const ratings = s.ratings || s.ratingsCount || 0;
      const reviews = s.reviews || 0;
      const friends = s.friends || s.friendsCount || 0;

      const statItems = [
        { val: episodes, label: 'Episodes' },
        { val: movies, label: 'Movies' },
        { val: completed, label: 'Completed' },
        { val: ratings, label: 'Rated' },
        { val: reviews, label: 'Reviews' },
        { val: friends, label: 'Friends' },
      ].filter(si => si.val > 0);

      if (statItems.length) {
        // Draw stats in a 3-column grid
        const cols = Math.min(3, statItems.length);
        const colW = 120;
        const startX = W / 2 - (cols * colW) / 2;
        const rows = Math.ceil(statItems.length / 3);
        for (let i = 0; i < statItems.length; i++) {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const cx = startX + col * colW + colW / 2;
          const cy = y + row * 40;
          ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = t.accent; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(String(statItems[i].val), cx, cy);
          ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#94a3b8'; ctx.fillText(statItems[i].label, cx, cy + 20);
        }
        y += rows * 40 + 12;
      }
    }

    // ── Badge showcase ──
    if (st.showBadges && st.earnedBadgeIds?.length) {
      const badgeMap = {};
      (typeof BADGE_DEFS !== 'undefined' ? BADGE_DEFS : []).forEach(b => { badgeMap[b.id] = b; });
      const earned = st.earnedBadgeIds.map(id => badgeMap[id]).filter(Boolean).slice(0, 6);
      if (earned.length) {
        // Divider
        ctx.strokeStyle = t.accent + '20'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(W * 0.2, y); ctx.lineTo(W * 0.8, y); ctx.stroke();
        y += 14;
        // Badge count label
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#64748b'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`${st.earnedBadgeIds.length}/${typeof BADGE_DEFS !== 'undefined' ? BADGE_DEFS.length : 40} Badges Earned`, W / 2, y);
        y += 20;
        // Draw badge icons
        const bSize = 32;
        const gap = 8;
        const totalW = earned.length * bSize + (earned.length - 1) * gap;
        let bx = W / 2 - totalW / 2;
        earned.forEach(b => {
          const tierColor = BADGE_TIERS[b.tier]?.color || '#888';
          // Badge circle bg
          ctx.beginPath(); ctx.arc(bx + bSize / 2, y + bSize / 2, bSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = tierColor + '25'; ctx.fill();
          ctx.strokeStyle = tierColor + '60'; ctx.lineWidth = 1.5; ctx.stroke();
          // Emoji
          ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(b.icon, bx + bSize / 2, y + bSize / 2 + 1);
          bx += bSize + gap;
        });
        y += bSize + 12;
      }
    }

    // ── Divider ──
    ctx.strokeStyle = t.accent + '20'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W * 0.2, y); ctx.lineTo(W * 0.8, y); ctx.stroke();
    y += 16;

    // ── QR Code with creative styles ──
    if (st.showQR && st.qrData && typeof QRCode !== 'undefined') {
      const qrTemp = document.createElement('canvas');
      try {
        await new Promise((resolve, reject) => {
          QRCode.toCanvas(qrTemp, st.qrData, {
            width: 360, margin: 0, errorCorrectionLevel: 'H',
            color: { dark: '#000000', light: '#00000000' }
          }, err => err ? reject(err) : resolve());
        });
        const qrSize = 160, qrX = W / 2 - qrSize / 2, qrY = y;
        // QR background with good contrast
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        this._scRoundRect(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 14); ctx.fill();
        ctx.strokeStyle = t.accent + '30'; ctx.lineWidth = 1;
        this._scRoundRect(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 14); ctx.stroke();

        // Read QR modules for creative rendering
        const tempCtx = qrTemp.getContext('2d');
        const imgData = tempCtx.getImageData(0, 0, qrTemp.width, qrTemp.height);
        const moduleCount = Math.round(Math.sqrt(this._countDarkModules(imgData)));
        const actualModuleCount = moduleCount > 0 ? moduleCount : 33;
        const cellSize = qrSize / actualModuleCount;
        const sampleSize = qrTemp.width / actualModuleCount;

        // Draw QR modules with selected style
        for (let row = 0; row < actualModuleCount; row++) {
          for (let col = 0; col < actualModuleCount; col++) {
            const sx = Math.floor(col * sampleSize + sampleSize / 2);
            const sy = Math.floor(row * sampleSize + sampleSize / 2);
            const idx = (sy * qrTemp.width + sx) * 4;
            if (idx < imgData.data.length && imgData.data[idx + 3] > 128) {
              const mx = qrX + col * cellSize;
              const my = qrY + row * cellSize;
              ctx.fillStyle = '#ffffff';
              this._drawQrModule(ctx, mx, my, cellSize, st.qrStyle, t);
            }
          }
        }

        // Center logo
        if (st.photoURL) {
          try {
            const logoImg = await this._loadImg(st.photoURL);
            const ls = 36;
            ctx.fillStyle = t.bg1; ctx.beginPath();
            ctx.arc(W / 2, qrY + qrSize / 2, ls / 2 + 5, 0, Math.PI * 2); ctx.fill();
            ctx.save(); ctx.beginPath();
            ctx.arc(W / 2, qrY + qrSize / 2, ls / 2, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(logoImg, W / 2 - ls / 2, qrY + qrSize / 2 - ls / 2, ls, ls);
            ctx.restore();
          } catch (_) {}
        }
        y = qrY + qrSize + 16;
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#64748b'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(st.type === 'profile' ? 'Scan to add as friend' : 'Scan to join ShowBoat', W / 2, y);
      } catch (e) { console.warn('QR generation failed', e); }
    }

    // ── Branding ──
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = t.accent; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('ShowBoat', W / 2, H - 38);
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#475569'; ctx.fillText('showboat.me', W / 2, H - 20);
  },

  // Count dark pixels to estimate module count
  _countDarkModules(imgData) {
    let count = 0;
    for (let i = 3; i < imgData.data.length; i += 4) { if (imgData.data[i] > 128) count++; }
    return count;
  },

  // Draw a single QR module with the selected creative style
  _drawQrModule(ctx, x, y, size, style, theme) {
    const pad = size * 0.1;
    const s = size - pad * 2;
    const cx = x + size / 2;
    const cy = y + size / 2;
    switch (style) {
      case 'dots':
        ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, Math.PI * 2); ctx.fill();
        break;
      case 'rounded':
        this._scRoundRect(ctx, x + pad, y + pad, s, s, s * 0.3); ctx.fill();
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(cx, y + pad); ctx.lineTo(x + size - pad, cy);
        ctx.lineTo(cx, y + size - pad); ctx.lineTo(x + pad, cy);
        ctx.closePath(); ctx.fill();
        break;
      case 'star':
        this._drawStar(ctx, cx, cy, s * 0.5, s * 0.25, 4);
        ctx.fill();
        break;
      default: // classic
        ctx.fillRect(x + pad * 0.5, y + pad * 0.5, size - pad, size - pad);
    }
  },

  _drawStar(ctx, cx, cy, outerR, innerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  },

  _scRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  },

  _loadImg(url) {
    return new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img); img.onerror = reject; img.src = url;
    });
  },

  _downloadShareCard() {
    const canvas = document.getElementById('share-card-canvas');
    if (!canvas) return;
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `showboat-${this._shareCardState?.type === 'invite' ? 'invite' : 'profile'}-card.png`;
      a.click(); URL.revokeObjectURL(url);
    }, 'image/png');
  },

  async _shareShareCard() {
    const canvas = document.getElementById('share-card-canvas');
    if (!canvas) return;
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], 'showboat-card.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        const st = this._shareCardState;
        const shareText = st?.type === 'invite'
          ? `Join me on ShowBoat with my invite code: ${st.code}\nhttps://showboat.me`
          : `Check out my profile on ShowBoat!\nhttps://showboat.me`;
        await navigator.share({ files: [file], title: 'ShowBoat', text: shareText, url: 'https://showboat.me' });
      } else {
        this._downloadShareCard();
        UI.toast('Card saved! Share it manually', 'info');
      }
    } catch (e) { if (e.name !== 'AbortError') UI.toast('Share failed, try downloading instead', 'error'); }
  }
};
