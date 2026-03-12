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

  /* ── Share Card System ── */
  _shareCardState: null,

  showShareCard() {
    const uid = auth.currentUser.uid;
    const p = this.state.profile || {};
    const s = this.state.stats || {};
    const username = p.username || auth.currentUser?.displayName || 'User';
    const photoURL = p.photoURL || auth.currentUser?.photoURL || '';
    const profileUrl = `${window.location.origin}${window.location.pathname}#friend-profile?id=${uid}`;
    this._shareCardState = { type: 'profile', theme: 'indigo', style: 'minimal', showStats: true, showQR: true, username, photoURL, stats: s, qrData: profileUrl };
    UI.showModal('Share Profile', this._shareCardModalHTML());
    setTimeout(() => this._renderShareCard(), 150);
  },

  showInviteShareCard(code) {
    const p = this.state.profile || {};
    const username = p.username || auth.currentUser?.displayName || 'User';
    const photoURL = p.photoURL || auth.currentUser?.photoURL || '';
    const inviteUrl = `${window.location.origin}${window.location.pathname}#signup?invite=${encodeURIComponent(code)}`;
    this._shareCardState = { type: 'invite', theme: 'emerald', style: 'minimal', showStats: false, showQR: true, username, photoURL, code, qrData: inviteUrl };
    UI.showModal('Share Invite', this._shareCardModalHTML());
    setTimeout(() => this._renderShareCard(), 150);
  },

  _shareCardModalHTML() {
    const themes = [
      { id: 'indigo', color: '#6366f1' }, { id: 'emerald', color: '#10b981' },
      { id: 'rose', color: '#f43f5e' }, { id: 'amber', color: '#f59e0b' },
      { id: 'purple', color: '#a855f7' }, { id: 'slate', color: '#475569' },
      { id: 'cyan', color: '#06b6d4' }, { id: 'pink', color: '#ec4899' }
    ];
    const st = this._shareCardState;
    return `<div class="scb-wrapper">
      <div class="scb-preview"><canvas id="share-card-canvas"></canvas></div>
      <div class="scb-section">
        <span class="scb-section-label">Theme</span>
        <div class="scb-themes">${themes.map(t => `<button class="scb-theme-btn ${st.theme === t.id ? 'active' : ''}" style="background:${t.color}" onclick="ProfilePage._setShareTheme('${t.id}')" title="${t.id}"></button>`).join('')}</div>
      </div>
      <div class="scb-section">
        <span class="scb-section-label">Style</span>
        <div class="scb-styles">${['minimal', 'bold', 'neon'].map(s => `<button class="scb-style-btn ${st.style === s ? 'active' : ''}" onclick="ProfilePage._setShareStyle('${s}')">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
      </div>
      <div class="scb-section">
        <span class="scb-section-label">Options</span>
        <div class="scb-toggles">
          ${st.type === 'profile' ? `<label class="scb-toggle"><input type="checkbox" ${st.showStats ? 'checked' : ''} onchange="ProfilePage._toggleShareOpt('showStats', this.checked)"> Show Stats</label>` : ''}
          <label class="scb-toggle"><input type="checkbox" ${st.showQR ? 'checked' : ''} onchange="ProfilePage._toggleShareOpt('showQR', this.checked)"> Show QR Code</label>
        </div>
      </div>
      <div class="scb-actions">
        <button class="scb-btn scb-btn-secondary" onclick="ProfilePage._downloadShareCard()">${UI.icon('download', 16)} Save</button>
        <button class="scb-btn scb-btn-primary" onclick="ProfilePage._shareShareCard()">${UI.icon('share-2', 16)} Share</button>
      </div>
    </div>`;
  },

  _setShareTheme(theme) {
    this._shareCardState.theme = theme;
    document.querySelectorAll('.scb-theme-btn').forEach(b => b.classList.toggle('active', b.title === theme));
    this._renderShareCard();
  },

  _setShareStyle(style) {
    this._shareCardState.style = style;
    document.querySelectorAll('.scb-style-btn').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === style));
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
    const themes = {
      indigo:  { bg1: '#1e1b4b', bg2: '#312e81', accent: '#818cf8', accent2: '#6366f1' },
      emerald: { bg1: '#022c22', bg2: '#064e3b', accent: '#34d399', accent2: '#10b981' },
      rose:    { bg1: '#4c0519', bg2: '#881337', accent: '#fb7185', accent2: '#f43f5e' },
      amber:   { bg1: '#451a03', bg2: '#78350f', accent: '#fbbf24', accent2: '#f59e0b' },
      purple:  { bg1: '#2e1065', bg2: '#4c1d95', accent: '#c084fc', accent2: '#a855f7' },
      slate:   { bg1: '#020617', bg2: '#1e293b', accent: '#94a3b8', accent2: '#64748b' },
      cyan:    { bg1: '#083344', bg2: '#164e63', accent: '#22d3ee', accent2: '#06b6d4' },
      pink:    { bg1: '#500724', bg2: '#831843', accent: '#f472b6', accent2: '#ec4899' }
    };
    const t = themes[st.theme] || themes.indigo;

    // Background
    const grad = ctx.createLinearGradient(0, 0, W * 0.3, H);
    grad.addColorStop(0, t.bg1); grad.addColorStop(1, t.bg2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // Style decorations
    if (st.style === 'bold') {
      ctx.globalAlpha = 0.08; ctx.fillStyle = t.accent;
      ctx.beginPath(); ctx.arc(W * 0.85, H * 0.12, 120, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W * 0.15, H * 0.88, 80, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (st.style === 'neon') {
      ctx.strokeStyle = t.accent + '30'; ctx.lineWidth = 1;
      ctx.strokeRect(20, 20, W - 40, H - 40);
      ctx.strokeStyle = t.accent + '60'; ctx.lineWidth = 2;
      const c = 30;
      [[20, 20 + c, 20, 20, 20 + c, 20], [W - 20 - c, 20, W - 20, 20, W - 20, 20 + c],
       [20, H - 20 - c, 20, H - 20, 20 + c, H - 20], [W - 20 - c, H - 20, W - 20, H - 20, W - 20, H - 20 - c]]
        .forEach(([x1, y1, x2, y2, x3, y3]) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke(); });
    }

    let y = 80;
    // Avatar
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
        ctx.beginPath(); ctx.arc(W / 2, y + size / 2, size / 2 + 4, 0, Math.PI * 2);
        ctx.fillStyle = t.accent2; ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(W / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(img, W / 2 - size / 2, y, size, size); ctx.restore();
      } catch (_) { drawInitial(); }
    } else { drawInitial(); }
    y += size + 20;

    // Username
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#f1f5f9'; ctx.fillText(st.username, W / 2, y);
    y += 36;

    // Invite code
    if (st.type === 'invite' && st.code) {
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#94a3b8'; ctx.fillText('Invite Code', W / 2, y); y += 24;
      ctx.font = 'bold 28px monospace'; ctx.fillStyle = t.accent;
      ctx.fillText(st.code, W / 2, y); y += 42;
    }

    // Stats
    if (st.showStats && st.stats) {
      const watched = st.stats.watched || st.stats.watchedCount || 0;
      const friends = st.stats.friends || st.stats.friendsCount || 0;
      const rated = st.stats.ratings || st.stats.ratingsCount || 0;
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = t.accent;
      ctx.fillText(`${watched} Watched  \u2022  ${friends} Friends  \u2022  ${rated} Rated`, W / 2, y);
      y += 32;
    }

    // Divider
    ctx.strokeStyle = t.accent + '25'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W * 0.2, y); ctx.lineTo(W * 0.8, y); ctx.stroke();
    y += 24;

    // QR code
    if (st.showQR && st.qrData && typeof QRCode !== 'undefined') {
      const qrCanvas = document.createElement('canvas');
      try {
        await new Promise((resolve, reject) => {
          QRCode.toCanvas(qrCanvas, st.qrData, {
            width: 180, margin: 0, errorCorrectionLevel: 'H',
            color: { dark: t.accent, light: '#00000000' }
          }, err => err ? reject(err) : resolve());
        });
        const qrSize = 180, qrX = W / 2 - qrSize / 2, qrY = y;
        // QR bg
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        this._scRoundRect(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 12); ctx.fill();
        // Draw QR
        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
        // Center logo
        if (st.photoURL) {
          try {
            const logoImg = await this._loadImg(st.photoURL);
            const ls = 40;
            ctx.fillStyle = t.bg1; ctx.beginPath();
            ctx.arc(W / 2, qrY + qrSize / 2, ls / 2 + 5, 0, Math.PI * 2); ctx.fill();
            ctx.save(); ctx.beginPath();
            ctx.arc(W / 2, qrY + qrSize / 2, ls / 2, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(logoImg, W / 2 - ls / 2, qrY + qrSize / 2 - ls / 2, ls, ls);
            ctx.restore();
          } catch (_) {}
        }
        y = qrY + qrSize + 20;
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#64748b'; ctx.textAlign = 'center';
        ctx.fillText(st.type === 'profile' ? 'Scan to add as friend' : 'Scan to join ShowBoat', W / 2, y);
      } catch (e) { console.warn('QR generation failed', e); }
    }

    // Branding
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = t.accent; ctx.textAlign = 'center';
    ctx.fillText('ShowBoat', W / 2, H - 36);
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#475569'; ctx.fillText('showboat.me', W / 2, H - 18);
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
        await navigator.share({
          files: [file], title: 'ShowBoat',
          text: this._shareCardState?.type === 'invite'
            ? `Join ShowBoat with my invite code: ${this._shareCardState.code}`
            : 'Add me on ShowBoat!'
        });
      } else {
        this._downloadShareCard();
        UI.toast('Card saved! Share it manually', 'info');
      }
    } catch (e) { if (e.name !== 'AbortError') UI.toast('Share failed, try downloading instead', 'error'); }
  }
};
