/* ShowBoat Admin Dashboard */
const ADMIN_EMAILS = ['admin@showboat.me']; // Add admin email addresses here

const AdminDash = {
  _allCodes: [],
  _allTickets: [],
  _allUsers: [],
  _allWaitlist: [],
  _allReports: [],
  _allBugs: [],
  _activeTab: 'overview',

  init() {
    auth.onAuthStateChanged(user => {
      document.getElementById('loading-screen').style.display = 'none';
      if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
        document.getElementById('admin-login').style.display = 'block';
        document.getElementById('admin-app').style.display = 'none';
        if (user) { auth.signOut(); this._showLoginError('Access denied. Not an admin account.'); }
      } else {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-app').style.display = 'block';
        document.getElementById('admin-user-label').textContent = user.email;
        this.loadAll();
      }
    });
  },

  _showLoginError(msg) {
    const el = document.getElementById('admin-login-error');
    el.textContent = msg; el.style.display = 'block';
  },

  async login() {
    const email = document.getElementById('admin-email').value.trim();
    const pass = document.getElementById('admin-pass').value;
    if (!email || !pass) { this._showLoginError('Please enter email and password.'); return; }
    try {
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) { this._showLoginError(e.message); }
  },

  async logout() {
    await auth.signOut();
    window.location.reload();
  },

  switchTab(tab) {
    this._activeTab = tab;
    const allTabs = ['overview', 'codes', 'tickets', 'users', 'waitlist', 'reports', 'bugs', 'announcements'];
    document.querySelectorAll('.admin-tab').forEach((btn, i) => {
      btn.classList.toggle('active', allTabs[i] === tab);
    });
    document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab)?.classList.add('active');
  },

  async loadAll() {
    await Promise.all([this.loadOverview(), this.loadCodes(), this.loadTickets(), this.loadUsers(), this.loadWaitlist(), this.loadReports(), this.loadBugs(), this.loadAnnouncements()]);
  },

  // ==================== OVERVIEW ====================
  async loadOverview() {
    try {
      const [users, codes, tickets, waitlist] = await Promise.all([
        db.collection('users').get(),
        db.collection('inviteCodes').get(),
        db.collection('ticketRequests').where('status', '==', 'pending').get(),
        db.collection('waitlist').get()
      ]);
      document.getElementById('stat-total-users').textContent = users.size;
      document.getElementById('stat-total-codes').textContent = codes.size;
      document.getElementById('stat-used-codes').textContent = codes.docs.filter(d => d.data().usedBy).length;
      document.getElementById('stat-pending-tickets').textContent = tickets.size;
      document.getElementById('stat-waitlist').textContent = waitlist.size;
    } catch (e) { console.error('Overview load error:', e); }
  },

  // ==================== INVITE CODES ====================
  async loadCodes() {
    try {
      const snap = await db.collection('inviteCodes').orderBy('createdAt', 'desc').get();
      this._allCodes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.filterCodes();
    } catch (e) { console.error('Codes load error:', e); }
  },

  filterCodes() {
    const filter = document.getElementById('codes-filter')?.value || 'all';
    const codes = filter === 'all' ? this._allCodes
      : filter === 'active' ? this._allCodes.filter(c => c.active && !c.usedBy)
      : this._allCodes.filter(c => c.usedBy);
    const tbody = document.getElementById('codes-tbody');
    if (!tbody) return;
    tbody.innerHTML = codes.length ? codes.map(c => `<tr>
      <td><span class="code-chip">${this._esc(c.code)}</span></td>
      <td style="color:var(--text-secondary);font-size:12px">${this._esc(c.createdBy || 'admin')}</td>
      <td>${c.usedBy ? `<span style="color:var(--text-secondary);font-size:12px">${this._esc(c.usedBy)}</span>` : '—'}</td>
      <td>${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
      <td><span class="status-pill ${c.usedBy ? 'status-used' : 'status-active'}">${c.usedBy ? 'used' : 'active'}</span></td>
      <td>${!c.usedBy ? `<button class="btn-sm btn-deny" onclick="AdminDash.deactivateCode('${this._esc(c.code)}')">Deactivate</button>` : ''}</td>
    </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">No codes found.</td></tr>';
  },

  async generateCodes() {
    const count = parseInt(document.getElementById('gen-count')?.value) || 5;
    const status = document.getElementById('gen-status');
    if (!status) return;
    status.textContent = 'Generating...';
    try {
      const uid = auth.currentUser?.uid || 'admin';
      const batch = db.batch();
      for (let i = 0; i < count; i++) {
        const code = this._genCode();
        batch.set(db.collection('inviteCodes').doc(code), {
          code, createdBy: uid, usedBy: null, usedAt: null, active: true, createdAt: Date.now()
        });
      }
      await batch.commit();
      status.textContent = `✓ ${count} codes generated`;
      setTimeout(() => { if (status) status.textContent = ''; }, 3000);
      await this.loadCodes();
      await this.loadOverview();
    } catch (e) { status.textContent = 'Error: ' + e.message; }
  },

  _genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += '-';
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  },

  async deactivateCode(code) {
    if (!confirm(`Deactivate code ${code}?`)) return;
    await db.collection('inviteCodes').doc(code).update({ active: false });
    await this.loadCodes();
  },

  // ==================== TICKET REQUESTS ====================
  async loadTickets() {
    try {
      const snap = await db.collection('ticketRequests').orderBy('createdAt', 'desc').get();
      this._allTickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.filterTickets();
    } catch (e) { console.error('Tickets load error:', e); }
  },

  filterTickets() {
    const filter = document.getElementById('tickets-filter')?.value || 'pending';
    const tickets = filter === 'all' ? this._allTickets : this._allTickets.filter(t => t.status === filter);
    const tbody = document.getElementById('tickets-tbody');
    if (!tbody) return;
    tbody.innerHTML = tickets.length ? tickets.map(t => `<tr>
      <td style="font-size:13px">${this._esc(t.username || t.uid || '—')}</td>
      <td><a href="${this._esc(t.postUrl || '')}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-size:12px;max-width:200px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._esc(t.postUrl || '—')}</a></td>
      <td style="color:var(--text-secondary);font-size:12px;max-width:180px">${this._esc(t.message || '—')}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
      <td><span class="status-pill status-${t.status || 'pending'}">${t.status || 'pending'}</span></td>
      <td style="display:flex;gap:6px">${t.status === 'pending' ? `
        <button class="btn-sm btn-approve" onclick="AdminDash.reviewTicket('${t.id}','approved','${this._esc(t.uid)}')">Approve</button>
        <button class="btn-sm btn-deny" onclick="AdminDash.reviewTicket('${t.id}','denied','${this._esc(t.uid)}')">Deny</button>` : '—'}
      </td>
    </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">No requests found.</td></tr>';
  },

  async reviewTicket(requestId, decision, uid) {
    try {
      await db.collection('ticketRequests').doc(requestId).update({ status: decision, reviewedAt: Date.now() });
      if (decision === 'approved' && uid) {
        // Give user 1 extra ticket
        await db.collection('users').doc(uid).update({ tickets: firebase.firestore.FieldValue.increment(1) });
      }
      await this.loadTickets();
      await this.loadOverview();
    } catch (e) { alert('Error: ' + e.message); }
  },

  // ==================== USERS ====================
  async loadUsers() {
    try {
      const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(200).get();
      this._allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.filterUsers();
    } catch (e) { console.error('Users load error:', e); }
  },

  filterUsers() {
    const q = (document.getElementById('users-search')?.value || '').toLowerCase();
    const users = q ? this._allUsers.filter(u => (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)) : this._allUsers;
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    tbody.innerHTML = users.length ? users.map(u => `<tr>
      <td>${this._esc(u.username || '—')}</td>
      <td style="color:var(--text-secondary);font-size:12px">${this._esc(u.email || '—')}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
      <td style="text-align:center">${u.tickets || 0}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${(u.inviteCodes || []).length} codes</td>
    </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">No users found.</td></tr>';
  },

  // ==================== WAITLIST ====================
  async loadWaitlist() {
    try {
      const snap = await db.collection('waitlist').orderBy('createdAt', 'desc').get();
      this._allWaitlist = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const tbody = document.getElementById('waitlist-tbody');
      if (!tbody) return;
      tbody.innerHTML = this._allWaitlist.length ? this._allWaitlist.map(w => `<tr>
        <td>${this._esc(w.email || '—')}</td>
        <td>${this._esc(w.name || '—')}</td>
        <td style="font-size:12px;color:var(--text-secondary)">${w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '—'}</td>
        <td><button class="btn-sm btn-approve" onclick="AdminDash.inviteFromWaitlist('${this._esc(w.id)}','${this._esc(w.email)}')">Send Invite Code</button></td>
      </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">No waitlist signups.</td></tr>';
    } catch (e) { console.error('Waitlist load error:', e); }
  },

  async inviteFromWaitlist(waitlistId, email) {
    if (!confirm(`Generate and mark an invite code for ${email}?`)) return;
    try {
      const code = this._genCode();
      await db.collection('inviteCodes').doc(code).set({
        code, createdBy: 'admin-waitlist', usedBy: null, usedAt: null, active: true, createdAt: Date.now(), forEmail: email
      });
      await db.collection('waitlist').doc(waitlistId).update({ inviteCode: code, invitedAt: Date.now() });
      alert(`Invite code for ${email}: ${code}\n\nSend this to the user manually.`);
      await this.loadWaitlist();
    } catch (e) { alert('Error: ' + e.message); }
  },

  exportWaitlist() {
    if (!this._allWaitlist.length) { alert('No waitlist data to export.'); return; }
    const rows = [['Email', 'Name', 'Signed Up', 'Invite Code']];
    this._allWaitlist.forEach(w => rows.push([
      w.email || '', w.name || '',
      w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '',
      w.inviteCode || ''
    ]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'showboat-waitlist.csv';
    a.click();
  },

  _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  },

  // ==================== USER REPORTS ====================
  async loadReports() {
    try {
      const snap = await db.collection('userReports').orderBy('createdAt', 'desc').get();
      this._allReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.filterReports();
    } catch (e) { console.error('Reports load error:', e); }
  },

  filterReports() {
    const filter = document.getElementById('reports-filter')?.value || 'pending';
    const list = filter === 'all' ? this._allReports : this._allReports.filter(r => r.status === filter);
    const tbody = document.getElementById('reports-tbody');
    if (!tbody) return;
    tbody.innerHTML = list.length ? list.map(r => `<tr>
      <td style="font-size:12px;color:var(--text-secondary)">${this._esc(r.reporterUid || '—')}</td>
      <td style="font-size:12px">${this._esc(r.targetUid || '—')}</td>
      <td><span class="status-pill status-pending">${this._esc(r.reason || '—')}</span></td>
      <td style="color:var(--text-secondary);font-size:12px;max-width:180px">${this._esc(r.message || '—')}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
      <td><span class="status-pill status-${r.status || 'pending'}">${r.status || 'pending'}</span></td>
      <td style="display:flex;gap:4px">
        ${r.status === 'pending' ? `
          <button class="btn-sm btn-approve" onclick="AdminDash.updateReport('${r.id}','reviewed')">Reviewed</button>
          <button class="btn-sm btn-deny" onclick="AdminDash.updateReport('${r.id}','dismissed')">Dismiss</button>` : '—'}
      </td>
    </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">No reports found.</td></tr>';
  },

  async updateReport(id, status) {
    try {
      await db.collection('userReports').doc(id).update({ status, reviewedAt: Date.now() });
      await this.loadReports();
    } catch (e) { alert('Error: ' + e.message); }
  },

  // ==================== BUG REPORTS ====================
  async loadBugs() {
    try {
      const snap = await db.collection('bugReports').orderBy('createdAt', 'desc').get();
      this._allBugs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.filterBugs();
    } catch (e) { console.error('Bug reports load error:', e); }
  },

  filterBugs() {
    const filter = document.getElementById('bugs-filter')?.value || 'open';
    const list = filter === 'all' ? this._allBugs : this._allBugs.filter(b => b.status === filter);
    const tbody = document.getElementById('bugs-tbody');
    if (!tbody) return;
    tbody.innerHTML = list.length ? list.map(b => `<tr>
      <td style="font-size:12px">${this._esc(b.username || b.uid || '—')}</td>
      <td><span class="status-pill status-pending">${this._esc(b.category || '—')}</span></td>
      <td style="color:var(--text-secondary);font-size:12px;max-width:200px">${this._esc(b.description || '—')}</td>
      <td>${b.screenshotUrl ? `<a href="${this._esc(b.screenshotUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-size:12px">View</a>` : '—'}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—'}</td>
      <td><span class="status-pill status-${b.status === 'open' ? 'pending' : b.status === 'resolved' ? 'approved' : 'active'}">${b.status || 'open'}</span></td>
      <td style="display:flex;gap:4px">
        ${b.status !== 'resolved' ? `
          <button class="btn-sm btn-approve" onclick="AdminDash.updateBug('${b.id}','resolved')">Resolve</button>
          <button class="btn-sm" style="background:var(--surface-2);color:var(--text-secondary)" onclick="AdminDash.updateBug('${b.id}','in-progress')">In Progress</button>` : '—'}
      </td>
    </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary)">No bug reports found.</td></tr>';
  },

  async updateBug(id, status) {
    try {
      await db.collection('bugReports').doc(id).update({ status, updatedAt: Date.now() });
      await this.loadBugs();
    } catch (e) { alert('Error: ' + e.message); }
  },

  // ==================== ANNOUNCEMENTS ====================
  async loadAnnouncements() {
    try {
      const snap = await db.collection('announcements').orderBy('createdAt', 'desc').get();
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const el = document.getElementById('ann-list');
      if (!el) return;
      el.innerHTML = list.length ? list.map(a => `
        <div class="admin-card" style="margin-bottom:10px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
            <div>
              <p style="font-weight:600;margin:0 0 4px">${this._esc(a.title)}</p>
              <p style="color:var(--text-secondary);font-size:13px;margin:0 0 4px">${this._esc(a.body)}</p>
              <p style="color:var(--text-tertiary,#64748b);font-size:11px;margin:0">${a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</p>
            </div>
            <button class="btn-sm btn-delete" onclick="AdminDash.deleteAnnouncement('${a.id}')">Delete</button>
          </div>
        </div>`).join('') : '<p style="color:var(--text-secondary)">No announcements yet.</p>';
    } catch (e) { console.error('Announcements load error:', e); }
  },

  async postAnnouncement() {
    const title = document.getElementById('ann-title')?.value.trim();
    const body = document.getElementById('ann-body')?.value.trim();
    const status = document.getElementById('ann-status');
    if (!title || !body) { if (status) { status.textContent = 'Title and body required.'; status.style.color = '#ef4444'; } return; }
    try {
      await db.collection('announcements').add({
        title, body, createdBy: auth.currentUser?.email || 'admin', createdAt: Date.now(), active: true
      });
      if (document.getElementById('ann-title')) document.getElementById('ann-title').value = '';
      if (document.getElementById('ann-body')) document.getElementById('ann-body').value = '';
      if (status) { status.textContent = '✓ Posted'; status.style.color = ''; setTimeout(() => { if (status) status.textContent = ''; }, 3000); }
      await this.loadAnnouncements();
    } catch (e) { if (status) { status.textContent = 'Error: ' + e.message; status.style.color = '#ef4444'; } }
  },

  async deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return;
    try {
      await db.collection('announcements').doc(id).delete();
      await this.loadAnnouncements();
    } catch (e) { alert('Error: ' + e.message); }
  }
};

document.addEventListener('DOMContentLoaded', () => AdminDash.init());
