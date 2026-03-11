/* ShowBoat — Shared Lists Pages */
const SharedListsPage = {
  state: { lists: [] },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="lists-page">
      ${UI.pageHeader('My Lists', true)}
      <div class="lists-toolbar">
        <button class="btn-primary" onclick="SharedListsPage.showCreate()">${UI.icon('plus', 18)} New List</button>
      </div>
      <div id="lists-content">${UI.loading()}</div>
    </div>`;
    try {
      this.state.lists = await Services.getSharedLists();
      this.drawLists();
      if (typeof Animate !== 'undefined') requestAnimationFrame(() => Animate.afterPageRender());
    } catch (e) { document.getElementById('lists-content').innerHTML = UI.emptyState('Error', e.message); }
  },

  drawLists() {
    const el = document.getElementById('lists-content');
    if (!this.state.lists.length) {
      el.innerHTML = `
        <div class="lists-empty-state">
          <div class="lists-empty-hero">
            <div class="lists-empty-icon">${UI.icon('list', 36)}</div>
            <h3>Build Your Perfect List</h3>
            <p>Curate and share collections of shows and movies with friends. Use lists to plan watchnights, track must-sees, or build genre collections.</p>
            <button class="btn-primary lists-create-cta" onclick="SharedListsPage.showCreate()">${UI.icon('plus', 16)} Create a List</button>
          </div>
          <p class="lists-inspiration-label">List ideas to get you started</p>
          <div class="lists-inspiration-grid">
            ${[
              { icon: 'moon', label: 'Weekend Binge', desc: 'Queue up a whole run to watch over the weekend', tag: 'Mixed', color: '#8b5cf6' },
              { icon: 'star', label: 'All-Time Favourites', desc: 'Your personal hall of fame — share it with friends', tag: 'TV', color: '#e5a00d' },
              { icon: 'compass', label: 'Genre Deep Dive', desc: 'Explore a genre from cult classics to new releases', tag: 'Movie', color: '#3b82f6' },
              { icon: 'users', label: 'Watch Together', desc: 'Co-created list — everyone adds what they want to see', tag: 'Mixed', color: '#10b981' }
            ].map(t => `
              <button class="lists-inspiration-card" onclick="SharedListsPage.showCreate('${t.label}')">
                <div class="lic-icon" style="background:${t.color}20;color:${t.color}">${UI.icon(t.icon, 22)}</div>
                <div class="lic-text">
                  <strong>${t.label}</strong>
                  <span>${t.desc}</span>
                </div>
                <span class="lic-tag" style="background:${t.color}22;color:${t.color}">${t.tag}</span>
              </button>`).join('')}
          </div>
        </div>`;
      return;
    }
    el.innerHTML = `<div class="lists-grid">${this.state.lists.map(l => this.renderListCard(l)).join('')}</div>`;
  },

  renderListCard(l) {
    const items = l.items || [];
    const posters = items.slice(0, 4).map(i => i.posterPath ? API.imageUrl(i.posterPath, 'w185') : '').filter(Boolean);
    const memberCount = l.members?.length || 1;
    const uid = auth.currentUser?.uid;
    const isOwner = l.createdBy === uid;

    // Determine list type mix
    const types = items.map(i => (i.mediaType || i.showType || 'tv') === 'movie' ? 'movie' : 'tv');
    const movieCount = types.filter(t => t === 'movie').length;
    const tvCount = types.length - movieCount;
    const typeLabel = types.length === 0 ? 'Empty' : movieCount === types.length ? 'Movies' : tvCount === types.length ? 'TV Shows' : 'Mixed';
    const typeColor = typeLabel === 'Movies' ? '#3b82f6' : typeLabel === 'TV Shows' ? '#8b5cf6' : typeLabel === 'Mixed' ? '#e5a00d' : 'var(--text-muted)';

    // Preview chips (first 2 item names)
    const previewNames = items.slice(0, 2).map(i => UI.escapeHtml(i.name || i.showName || '')).filter(Boolean);

    return `<div class="list-card" onclick="App.navigate('shared-list-detail',{id:'${l.id}'})">
      <div class="list-card-cover">
        ${posters.length
          ? `<div class="list-cover-grid">${[0,1,2,3].map(i => posters[i]
              ? `<div class="list-cover-cell" style="background-image:url('${posters[i]}')"></div>`
              : '<div class="list-cover-cell empty"></div>').join('')}</div>`
          : `<div class="list-cover-placeholder">${UI.icon('list', 32)}</div>`}
        <span class="list-role-badge ${isOwner ? 'owner' : 'shared'}">${isOwner ? 'Owner' : 'Shared'}</span>
        ${items.length > 0 ? `<span class="list-type-badge" style="background:${typeColor}22;color:${typeColor};border-color:${typeColor}44">${typeLabel}</span>` : ''}
      </div>
      <div class="list-card-info">
        <h4 class="list-card-name">${UI.escapeHtml(l.name || 'Untitled')}</h4>
        <div class="list-card-meta">
          <span>${UI.icon('film', 12)} ${items.length} item${items.length !== 1 ? 's' : ''}</span>
          <span>${UI.icon('users', 12)} ${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
        </div>
        ${previewNames.length ? `<div class="list-preview-chips">${previewNames.map(n => `<span class="list-preview-chip">${n}</span>`).join('')}${items.length > 2 ? `<span class="list-preview-chip more">+${items.length - 2}</span>` : ''}</div>` : ''}
        ${l.createdAt ? `<p class="list-card-date">${UI.timeAgo(l.createdAt)}</p>` : ''}
      </div>
    </div>`;
  },

  showCreate(prefill = '') {
    UI.showModal('New List', `<div>
      <input type="text" id="new-list-name" class="modal-input" placeholder="E.g. Weekend Binge, Sci-Fi Must Watch..." maxlength="50" value="${UI.escapeHtml(prefill)}" style="width:100%;box-sizing:border-box;margin-bottom:12px">
      <div class="create-list-suggestions">
        <p class="create-suggestions-label">Quick picks</p>
        <div class="create-suggestions-chips">
          ${['Weekend Binge','Must Watch','Comfort TV','Hidden Gems','Watch Together'].map(n =>
            `<button class="suggestion-chip" onclick="document.getElementById('new-list-name').value='${n}'">${n}</button>`).join('')}
        </div>
      </div>
      <div class="modal-buttons" style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="SharedListsPage.createList()">Create</button>
      </div>
    </div>`);
    setTimeout(() => { const el = document.getElementById('new-list-name'); if (el) { el.focus(); el.select(); } }, 100);
  },

  async createList() {
    const name = document.getElementById('new-list-name')?.value.trim();
    if (!name) { UI.toast('Enter a list name', 'error'); return; }
    UI.closeModal();
    try {
      const ref = await Services.createSharedList(name);
      UI.toast('List created!', 'success');
      this.state.lists = await Services.getSharedLists();
      this.drawLists();
      if (ref?.id) App.navigate('shared-list-detail', { id: ref.id });
    } catch (e) { UI.toast('Failed to create list', 'error'); }
  }
};

const SharedListDetailPage = {
  state: { id: '', list: null, items: [], sortBy: 'added', friends: [] },

  async render(params) {
    if (!params?.id) return;
    this.state.id = params.id;
    this.state.sortBy = 'added';
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const [data, friends] = await Promise.all([
        Services.getSharedListDetail(params.id),
        Services.getFriends()
      ]);
      this.state.list = data;
      this.state.items = data?.items || [];
      this.state.friends = friends;
      this.draw(el);
      if (typeof Animate !== 'undefined') requestAnimationFrame(() => Animate.afterPageRender());
    } catch (e) { el.innerHTML = UI.pageHeader('List', true) + UI.emptyState('Error', e.message); }
  },

  draw(el) {
    const l = this.state.list || {};
    const uid = auth.currentUser?.uid;
    const isOwner = l.createdBy === uid;
    const members = l.members || [];
    const sorted = this.getSortedItems();

    // Build member avatars
    const memberAvatars = members.map(mUid => {
      const f = this.state.friends.find(fr => fr.uid === mUid);
      const name = mUid === uid ? 'You' : (f?.username || 'Member');
      const initial = name.charAt(0).toUpperCase();
      const photo = f?.photoURL;
      return `<div class="sld-member" title="${UI.escapeHtml(name)}">
        ${photo ? `<img src="${photo}" alt="">` : `<span>${initial}</span>`}
      </div>`;
    }).join('');

    // Type stats
    const items = this.state.items;
    const movieCount = items.filter(i => (i.mediaType || 'tv') === 'movie').length;
    const tvCount = items.length - movieCount;

    el.innerHTML = `<div class="sld-page">
      <div class="sld-hero">
        <div class="sld-hero-bg">
          ${items.slice(0, 3).map(i => i.posterPath ? `<div class="sld-hero-poster" style="background-image:url('${API.imageUrl(i.posterPath, 'w342')}')"></div>` : '').join('')}
          <div class="sld-hero-overlay"></div>
        </div>
        <div class="sld-hero-content">
          <button class="back-btn-float" onclick="App.back()">${UI.icon('arrow-left', 20)}</button>
          <div class="sld-hero-info">
            <h1 class="sld-title">${UI.escapeHtml(l.name || 'Shared List')}</h1>
            <div class="sld-stats">
              <span class="sld-stat">${UI.icon('film', 14)} <strong id="sld-count">${items.length}</strong> item${items.length !== 1 ? 's' : ''}</span>
              ${tvCount ? `<span class="sld-stat">${UI.icon('tv', 14)} ${tvCount} show${tvCount !== 1 ? 's' : ''}</span>` : ''}
              ${movieCount ? `<span class="sld-stat">${UI.icon('clapperboard', 14)} ${movieCount} movie${movieCount !== 1 ? 's' : ''}</span>` : ''}
            </div>
            <div class="sld-members-row">
              <div class="sld-members-avatars">${memberAvatars}</div>
              <span class="sld-members-label">${members.length} member${members.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="sld-toolbar">
        <select class="sld-sort" onchange="SharedListDetailPage.setSortBy(this.value)">
          <option value="added" ${this.state.sortBy === 'added' ? 'selected' : ''}>Recently Added</option>
          <option value="name" ${this.state.sortBy === 'name' ? 'selected' : ''}>A → Z</option>
          <option value="type" ${this.state.sortBy === 'type' ? 'selected' : ''}>Type</option>
        </select>
        <div class="sld-toolbar-actions">
          ${isOwner ? `<button class="sld-action-btn" onclick="SharedListDetailPage.showRename()">${UI.icon('edit-2', 16)} Rename</button>` : ''}
          ${isOwner ? `<button class="sld-action-btn" onclick="SharedListDetailPage.showInvite()">${UI.icon('user-plus', 16)} Invite</button>` : ''}
          ${isOwner ? `<button class="sld-action-btn sld-danger" onclick="SharedListDetailPage.confirmDelete()">${UI.icon('trash-2', 16)} Delete</button>` : ''}
        </div>
      </div>

      <div id="sld-items">
        ${sorted.length
          ? `<div class="sld-grid">${sorted.map(item => this.renderItem(item)).join('')}</div>`
          : this._emptyHtml()}
      </div>
    </div>`;
  },

  _emptyHtml() {
    return `<div class="sld-empty">
      <div class="sld-empty-icon">${UI.icon('plus-circle', 48)}</div>
      <h3>This list is empty</h3>
      <p>Browse shows and movies, then add them from their detail page</p>
      <button class="btn-primary" onclick="App.navigate('discover')">${UI.icon('search', 16)} Browse</button>
    </div>`;
  },

  renderItem(item) {
    const poster = (item.posterPath || item.showPoster) ? API.imageUrl(item.posterPath || item.showPoster, 'w342') : '';
    const type = (item.mediaType || item.showType || 'tv') === 'show' ? 'tv' : (item.mediaType || item.showType || 'tv');
    return `<div class="sld-card" onclick="App.navigate('details',{id:${item.id || item.showId},type:'${type}'})">
      <div class="sld-card-poster">
        ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="sld-card-ph">${UI.icon('film', 28)}</div>`}
        <button class="sld-card-remove" onclick="event.stopPropagation(); SharedListDetailPage.removeItem('${item.id}')" title="Remove">${UI.icon('x', 14)}</button>
        <span class="sld-card-type">${type === 'movie' ? 'Movie' : 'Show'}</span>
      </div>
      <p class="sld-card-title">${UI.escapeHtml(item.name || item.showName || '')}</p>
    </div>`;
  },

  getSortedItems() {
    const items = [...this.state.items];
    if (this.state.sortBy === 'name') return items.sort((a, b) => (a.name || a.showName || '').localeCompare(b.name || b.showName || ''));
    if (this.state.sortBy === 'type') return items.sort((a, b) => (a.mediaType || 'tv').localeCompare(b.mediaType || 'tv'));
    return items.reverse();
  },

  setSortBy(val) {
    this.state.sortBy = val;
    const content = document.getElementById('sld-items');
    if (!content) return;
    const sorted = this.getSortedItems();
    content.innerHTML = sorted.length
      ? `<div class="sld-grid">${sorted.map(i => this.renderItem(i)).join('')}</div>`
      : this._emptyHtml();
  },

  async showInvite() {
    const members = new Set(this.state.list?.members || []);
    const available = this.state.friends.filter(f => !members.has(f.uid));

    const friendListHtml = available.length
      ? available.map(f => {
          const initial = (f.username || '?').charAt(0).toUpperCase();
          const photo = f.photoURL;
          return `<button class="sld-invite-friend" onclick="SharedListDetailPage.inviteFriend('${f.uid}', this)">
            <div class="sld-invite-avatar">
              ${photo ? `<img src="${photo}" alt="">` : `<span>${initial}</span>`}
            </div>
            <span class="sld-invite-name">${UI.escapeHtml(f.username || 'Friend')}</span>
            <span class="sld-invite-add">${UI.icon('plus', 16)}</span>
          </button>`;
        }).join('')
      : `<p class="sld-invite-none">All your friends are already in this list!</p>`;

    UI.showModal('Invite Friends', `<div class="sld-invite-modal">
      <p class="sld-invite-desc">Add friends to collaborate on this list</p>
      <div class="sld-invite-list">${friendListHtml}</div>
      <div class="modal-buttons" style="margin-top:16px">
        <button class="btn-secondary" onclick="UI.closeModal()">Done</button>
      </div>
    </div>`);
  },

  async inviteFriend(friendUid, btnEl) {
    try {
      await Services.inviteToSharedList(this.state.id, friendUid);
      if (btnEl) {
        btnEl.classList.add('invited');
        btnEl.querySelector('.sld-invite-add').innerHTML = UI.icon('check', 16);
        btnEl.disabled = true;
      }
      // Refresh list data
      const data = await Services.getSharedListDetail(this.state.id);
      this.state.list = data;
      UI.toast('Friend added!', 'success');
    } catch (e) { UI.toast('Failed to add friend', 'error'); }
  },

  showRename() {
    UI.showModal('Rename List', `<div>
      <input type="text" id="rename-list-input" class="modal-input" value="${UI.escapeHtml(this.state.list?.name || '')}" maxlength="50" style="width:100%;box-sizing:border-box;margin-bottom:16px">
      <div class="modal-buttons" style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="SharedListDetailPage.renameList()">Save</button>
      </div>
    </div>`);
    setTimeout(() => { const el = document.getElementById('rename-list-input'); if (el) { el.focus(); el.select(); } }, 100);
  },

  async renameList() {
    const name = document.getElementById('rename-list-input')?.value.trim();
    if (!name) return;
    UI.closeModal();
    try {
      await db.collection('sharedLists').doc(this.state.id).update({ name });
      if (this.state.list) this.state.list.name = name;
      const title = document.querySelector('.sld-title');
      if (title) title.textContent = name;
      UI.toast('Renamed!', 'success');
    } catch (e) { UI.toast('Failed to rename', 'error'); }
  },

  confirmDelete() {
    UI.showModal('Delete List', `<p style="color:var(--text-secondary);margin-bottom:20px">This will permanently delete "${UI.escapeHtml(this.state.list?.name || 'this list')}" and all its items. This cannot be undone.</p>
      <div class="modal-buttons" style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="btn-primary" style="background:var(--rose-600);border-color:var(--rose-600)" onclick="UI.closeModal();SharedListDetailPage.deleteList()">Delete</button>
      </div>`);
  },

  async deleteList() {
    try {
      await db.collection('sharedLists').doc(this.state.id).delete();
      UI.toast('List deleted', 'success');
      App.navigate('shared-lists');
    } catch (e) { UI.toast('Failed to delete', 'error'); }
  },

  async removeItem(itemId) {
    try {
      await Services.removeFromSharedList(this.state.id, itemId);
      this.state.items = this.state.items.filter(i => String(i.id) !== String(itemId));
      const content = document.getElementById('sld-items');
      if (content) {
        const sorted = this.getSortedItems();
        content.innerHTML = sorted.length
          ? `<div class="sld-grid">${sorted.map(i => this.renderItem(i)).join('')}</div>`
          : this._emptyHtml();
      }
      const countEl = document.getElementById('sld-count');
      if (countEl) countEl.textContent = this.state.items.length;
      UI.toast('Removed from list', 'success');
    } catch (e) { UI.toast('Error removing item', 'error'); }
  }
};

