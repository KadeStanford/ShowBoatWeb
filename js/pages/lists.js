/* ShowBoat — Shared Lists Pages */
const SharedListsPage = {
  state: { lists: [] },

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = `<div class="lists-page">
      ${UI.pageHeader('Shared Lists', true)}
      <button class="btn-primary create-list-btn" onclick="SharedListsPage.showCreate()">${UI.icon('plus', 18)} Create New List</button>
      <div id="lists-content">${UI.loading()}</div>
    </div>`;
    try {
      this.state.lists = await Services.getSharedLists();
      this.drawLists();
    } catch (e) { document.getElementById('lists-content').innerHTML = UI.emptyState('Error', e.message); }
  },

  drawLists() {
    const el = document.getElementById('lists-content');
    if (!this.state.lists.length) { el.innerHTML = UI.emptyState('No lists yet', 'Create a shared list to get started'); return; }
    el.innerHTML = `<div class="list-items">${this.state.lists.map(l => `<div class="list-item" onclick="App.navigate('shared-list-detail',{id:'${l.id}'})">
      <div class="list-icon" style="background:var(--indigo-500)20;color:var(--indigo-500)">${UI.icon('list', 22)}</div>
      <div class="list-info">
        <p class="list-name">${UI.escapeHtml(l.name || 'Untitled')}</p>
        <p class="list-count">${l.itemCount || 0} items</p>
        ${l.createdAt ? `<p class="list-date">Created ${UI.timeAgo(l.createdAt)}</p>` : ''}
      </div>
      ${UI.icon('chevron-right', 18)}
    </div>`).join('')}</div>`;
  },

  showCreate() {
    UI.showModal(`<div class="create-list-modal">
      <h3>Create Shared List</h3>
      <div class="input-group">
        <label>List Name</label>
        <input type="text" id="new-list-name" placeholder="e.g. Weekend Binge" maxlength="50">
      </div>
      <div class="modal-buttons">
        <button class="btn-secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="SharedListsPage.createList()">Create</button>
      </div>
    </div>`);
    setTimeout(() => document.getElementById('new-list-name')?.focus(), 100);
  },

  async createList() {
    const name = document.getElementById('new-list-name')?.value.trim();
    if (!name) { UI.toast('Enter a list name', 'error'); return; }
    UI.closeModal();
    try {
      await Services.createSharedList(name);
      UI.toast('List created!', 'success');
      this.state.lists = await Services.getSharedLists();
      this.drawLists();
    } catch (e) { UI.toast('Failed to create list', 'error'); }
  }
};

const SharedListDetailPage = {
  state: { id: '', list: null, items: [] },

  async render(params) {
    this.state.id = params.id;
    const el = document.getElementById('page-content');
    el.innerHTML = UI.loading();
    try {
      const data = await Services.getSharedListDetail(params.id);
      this.state.list = data;
      this.state.items = data?.items || [];
      this.draw(el);
    } catch (e) { el.innerHTML = UI.pageHeader('List', true) + UI.emptyState('Error', e.message); }
  },

  draw(el) {
    const l = this.state.list || {};
    el.innerHTML = `<div class="list-detail-page">
      ${UI.pageHeader(l.name || 'Shared List', true)}
      <p class="list-members">${l.members?.length || 1} member${(l.members?.length || 1) > 1 ? 's' : ''}</p>
      <div id="list-items-content">
        ${this.state.items.length ? `<div class="media-grid">${this.state.items.map(item => {
          const poster = (item.posterPath || item.showPoster) ? API.imageUrl(item.posterPath || item.showPoster, 'w342') : '';
          const lType1 = (item.mediaType || item.showType || 'tv') === 'show' ? 'tv' : (item.mediaType || item.showType || 'tv');
          return `<div class="media-card" style="position:relative" onclick="App.navigate('details',{id:${item.id || item.showId},type:'${lType1}'})">
            ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="poster-placeholder">${UI.icon('film', 32)}</div>`}
            <div class="card-info"><p class="card-title">${UI.escapeHtml(item.name || item.showName || '')}</p></div>
            <button class="card-remove-btn" onclick="event.stopPropagation(); SharedListDetailPage.removeItem('${item.id}')" title="Remove">${UI.icon('x', 16)}</button>
          </div>`;
        }).join('')}</div>` : UI.emptyState('Empty list', 'Add shows from their detail page')}
      </div>
    </div>`;
  },

  async removeItem(itemId) {
    try {
      await Services.removeFromSharedList(this.state.id, itemId);
      this.state.items = this.state.items.filter(i => i.id !== itemId);
      const content = document.getElementById('list-items-content');
      if (content) {
        if (this.state.items.length) {
          content.innerHTML = `<div class="media-grid">${this.state.items.map(item => {
            const poster = (item.posterPath || item.showPoster) ? API.imageUrl(item.posterPath || item.showPoster, 'w342') : '';
            const lType2 = (item.mediaType || item.showType || 'tv') === 'show' ? 'tv' : (item.mediaType || item.showType || 'tv');
            return `<div class="media-card" style="position:relative" onclick="App.navigate('details',{id:${item.id || item.showId},type:'${lType2}'})">
              ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="poster-placeholder">${UI.icon('film', 32)}</div>`}
              <div class="card-info"><p class="card-title">${UI.escapeHtml(item.name || item.showName || '')}</p></div>
              <button class="card-remove-btn" onclick="event.stopPropagation(); SharedListDetailPage.removeItem('${item.id}')" title="Remove">${UI.icon('x', 16)}</button>
            </div>`;
          }).join('')}</div>`;
        } else content.innerHTML = UI.emptyState('Empty list', 'Add shows from their detail page');
      }
      UI.toast('Removed from list', 'success');
    } catch (e) { UI.toast('Error removing item', 'error'); }
  }
};
